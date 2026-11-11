// Pure JavaScript GIF89a encoder for AmiBuzz.
//
// Zero dependencies. The core (`encodeGif`) works on raw RGBA buffers, so it
// runs anywhere (browser, worker, Node) and can be tested without a canvas.
//
// What it does:
//  - Median-cut colour quantisation refined with k-means, on a shared (global)
//    palette or a palette per frame.
//  - Optional ordered (Bayer) or Floyd-Steinberg dithering.
//  - Real transparency for stickers (frames are cropped to their opaque area).
//  - Frame differencing for opaque clips: only pixels that changed since the
//    previous frame are stored, which is what keeps video GIFs small.
//  - Variable-width LZW exactly as GIF decoders expect it.

const ALPHA_THRESHOLD = 128;
const HIST_BITS = 5;
const HIST_SIZE = 1 << (HIST_BITS * 3); // 32768 bins
const HIST_SHIFT = 8 - HIST_BITS;

const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const binOf = (r, g, b) =>
  ((r >> HIST_SHIFT) << (HIST_BITS * 2)) | ((g >> HIST_SHIFT) << HIST_BITS) | (b >> HIST_SHIFT);

// ---------------------------------------------------------------------------
// Colour quantisation
// ---------------------------------------------------------------------------

function createHistogram() {
  return {
    count: new Float64Array(HIST_SIZE),
    sumR: new Float64Array(HIST_SIZE),
    sumG: new Float64Array(HIST_SIZE),
    sumB: new Float64Array(HIST_SIZE),
  };
}

function addToHistogram(hist, rgba, stride) {
  const { count, sumR, sumG, sumB } = hist;
  const step = Math.max(1, stride) * 4;
  for (let i = 0; i < rgba.length; i += step) {
    if (rgba[i + 3] < ALPHA_THRESHOLD) continue;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const bin = binOf(r, g, b);
    count[bin]++;
    sumR[bin] += r;
    sumG[bin] += g;
    sumB[bin] += b;
  }
}

/**
 * Reduces a histogram to at most `maxColors` colours.
 * @returns {Uint8Array} palette as r,g,b triples
 */
function paletteFromHistogram(hist, maxColors) {
  const { count, sumR, sumG, sumB } = hist;

  // Collect the bins that are actually used, with their mean colour.
  let used = 0;
  for (let i = 0; i < HIST_SIZE; i++) if (count[i] > 0) used++;
  if (used === 0) return new Uint8Array([0, 0, 0]);

  const bins = new Int32Array(used);
  const cr = new Float32Array(used);
  const cg = new Float32Array(used);
  const cb = new Float32Array(used);
  const cw = new Float64Array(used);
  for (let i = 0, n = 0; i < HIST_SIZE; i++) {
    if (count[i] === 0) continue;
    bins[n] = n;
    cw[n] = count[i];
    cr[n] = sumR[i] / count[i];
    cg[n] = sumG[i] / count[i];
    cb[n] = sumB[i] / count[i];
    n++;
  }

  if (used <= maxColors) {
    const exact = new Uint8Array(used * 3);
    for (let i = 0; i < used; i++) {
      exact[i * 3] = Math.round(cr[i]);
      exact[i * 3 + 1] = Math.round(cg[i]);
      exact[i * 3 + 2] = Math.round(cb[i]);
    }
    return exact;
  }

  // --- Median cut -----------------------------------------------------------
  const channels = [cr, cg, cb];
  const measure = (lo, hi) => {
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0, weight = 0;
    for (let i = lo; i < hi; i++) {
      const k = bins[i];
      const r = cr[k], g = cg[k], b = cb[k];
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (g < minG) minG = g;
      if (g > maxG) maxG = g;
      if (b < minB) minB = b;
      if (b > maxB) maxB = b;
      weight += cw[k];
    }
    const dr = maxR - minR, dg = maxG - minG, db = maxB - minB;
    // Green carries the most perceived detail, blue the least.
    const wr = dr * 0.9, wg = dg * 1.2, wb = db * 0.7;
    const axis = wg >= wr && wg >= wb ? 1 : wr >= wb ? 0 : 2;
    const range = Math.max(wr, wg, wb);
    return { lo, hi, axis, weight, score: hi - lo > 1 ? range * Math.sqrt(weight) : -1 };
  };

  const boxes = [measure(0, used)];
  while (boxes.length < maxColors) {
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].score > bestScore) {
        bestScore = boxes[i].score;
        best = i;
      }
    }
    if (best < 0) break;

    const box = boxes[best];
    const channel = channels[box.axis];
    const slice = bins.subarray(box.lo, box.hi);
    slice.sort((a, b) => channel[a] - channel[b]);

    // Split where the pixel weight is halved, never leaving a side empty.
    const half = box.weight / 2;
    let acc = 0;
    let cut = box.lo + 1;
    for (let i = box.lo; i < box.hi - 1; i++) {
      acc += cw[bins[i]];
      cut = i + 1;
      if (acc >= half) break;
    }
    boxes[best] = measure(box.lo, cut);
    boxes.push(measure(cut, box.hi));
  }

  const n = boxes.length;
  const pr = new Float64Array(n);
  const pg = new Float64Array(n);
  const pb = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0, g = 0, b = 0, w = 0;
    for (let j = boxes[i].lo; j < boxes[i].hi; j++) {
      const k = bins[j];
      r += cr[k] * cw[k];
      g += cg[k] * cw[k];
      b += cb[k] * cw[k];
      w += cw[k];
    }
    pr[i] = r / w;
    pg[i] = g / w;
    pb[i] = b / w;
  }

  // --- k-means refinement over the histogram bins ---------------------------
  const accR = new Float64Array(n);
  const accG = new Float64Array(n);
  const accB = new Float64Array(n);
  const accW = new Float64Array(n);
  for (let iter = 0; iter < 2; iter++) {
    accR.fill(0);
    accG.fill(0);
    accB.fill(0);
    accW.fill(0);
    for (let k = 0; k < used; k++) {
      const r = cr[k], g = cg[k], b = cb[k];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < n; c++) {
        const dr = r - pr[c], dg = g - pg[c], db = b - pb[c];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c;
        }
      }
      const w = cw[k];
      accR[bestIdx] += r * w;
      accG[bestIdx] += g * w;
      accB[bestIdx] += b * w;
      accW[bestIdx] += w;
    }
    for (let c = 0; c < n; c++) {
      if (accW[c] > 0) {
        pr[c] = accR[c] / accW[c];
        pg[c] = accG[c] / accW[c];
        pb[c] = accB[c] / accW[c];
      }
    }
  }

  const palette = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    palette[i * 3] = Math.round(pr[i]);
    palette[i * 3 + 1] = Math.round(pg[i]);
    palette[i * 3 + 2] = Math.round(pb[i]);
  }
  return palette;
}

/**
 * Builds a palette of at most `maxColors` colours from one or more RGBA buffers.
 * Fully transparent pixels are ignored.
 * @param {ArrayLike<number>[]} buffers RGBA buffers
 * @param {number} maxColors 2..256
 * @returns {Uint8Array} r,g,b triples
 */
export function quantize(buffers, maxColors = 256) {
  const hist = createHistogram();
  let totalPixels = 0;
  for (const b of buffers) totalPixels += b.length / 4;
  // Sampling ~2M pixels is plenty to place 256 colours.
  const stride = Math.max(1, Math.floor(totalPixels / 2_000_000));
  for (const b of buffers) addToHistogram(hist, b, stride);
  return paletteFromHistogram(hist, Math.max(2, Math.min(256, maxColors)));
}

/** Nearest-palette-colour lookup, memoised per 15-bit colour. */
function createMatcher(palette) {
  const n = palette.length / 3;
  const cache = new Int16Array(HIST_SIZE).fill(-1);
  return (r, g, b) => {
    const key = binOf(r, g, b);
    const hit = cache[key];
    if (hit >= 0) return hit;
    let best = 0;
    let bestDist = Infinity;
    for (let c = 0, o = 0; c < n; c++, o += 3) {
      const dr = r - palette[o], dg = g - palette[o + 1], db = b - palette[o + 2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    cache[key] = best;
    return best;
  };
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Maps an RGBA frame onto a palette.
 * @returns {Int16Array} palette index per pixel, -1 where the pixel is transparent
 */
function indexFrame(rgba, width, height, palette, match, dither) {
  const out = new Int16Array(width * height);

  if (dither === 'fs') {
    // Floyd-Steinberg error diffusion (two rolling rows of error).
    let cur = new Float32Array((width + 2) * 3);
    let next = new Float32Array((width + 2) * 3);
    for (let y = 0; y < height; y++) {
      next.fill(0);
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const i = p * 4;
        if (rgba[i + 3] < ALPHA_THRESHOLD) {
          out[p] = -1;
          continue;
        }
        const e = (x + 1) * 3;
        const r = clamp255(rgba[i] + cur[e]);
        const g = clamp255(rgba[i + 1] + cur[e + 1]);
        const b = clamp255(rgba[i + 2] + cur[e + 2]);
        const idx = match(r | 0, g | 0, b | 0);
        out[p] = idx;
        const er = r - palette[idx * 3];
        const eg = g - palette[idx * 3 + 1];
        const eb = b - palette[idx * 3 + 2];
        cur[e + 3] += er * 0.4375;
        cur[e + 4] += eg * 0.4375;
        cur[e + 5] += eb * 0.4375;
        next[e - 3] += er * 0.1875;
        next[e - 2] += eg * 0.1875;
        next[e - 1] += eb * 0.1875;
        next[e] += er * 0.3125;
        next[e + 1] += eg * 0.3125;
        next[e + 2] += eb * 0.3125;
        next[e + 3] += er * 0.0625;
        next[e + 4] += eg * 0.0625;
        next[e + 5] += eb * 0.0625;
      }
      const swap = cur;
      cur = next;
      next = swap;
    }
    return out;
  }

  if (dither === 'ordered') {
    // The fewer colours we have, the wider the gaps the pattern has to bridge.
    const colors = palette.length / 3;
    const spread = colors >= 192 ? 20 : colors >= 96 ? 28 : colors >= 48 ? 40 : 56;
    for (let y = 0; y < height; y++) {
      const row = (y & 3) * 4;
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const i = p * 4;
        if (rgba[i + 3] < ALPHA_THRESHOLD) {
          out[p] = -1;
          continue;
        }
        const t = ((BAYER_4[row + (x & 3)] + 0.5) / 16 - 0.5) * spread;
        out[p] = match(clamp255(rgba[i] + t) | 0, clamp255(rgba[i + 1] + t) | 0, clamp255(rgba[i + 2] + t) | 0);
      }
    }
    return out;
  }

  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    out[p] = rgba[i + 3] < ALPHA_THRESHOLD ? -1 : match(rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Byte output + LZW
// ---------------------------------------------------------------------------

class ByteWriter {
  constructor(initial = 1 << 16) {
    this.buf = new Uint8Array(initial);
    this.len = 0;
  }
  ensure(extra) {
    if (this.len + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + extra) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(this.buf.subarray(0, this.len));
    this.buf = grown;
  }
  byte(v) {
    this.ensure(1);
    this.buf[this.len++] = v & 0xff;
  }
  u16(v) {
    this.ensure(2);
    this.buf[this.len++] = v & 0xff;
    this.buf[this.len++] = (v >> 8) & 0xff;
  }
  bytes(arr) {
    this.ensure(arr.length);
    this.buf.set(arr, this.len);
    this.len += arr.length;
  }
  ascii(str) {
    for (let i = 0; i < str.length; i++) this.byte(str.charCodeAt(i));
  }
  result() {
    return this.buf.slice(0, this.len);
  }
}

// One table shared by every frame: key = (prefixCode << 8) | pixel, value = code.
// 0 means "empty" — real codes for new strings always start above the EOI code.
const LZW_TABLE = new Uint16Array(1 << 20);
const LZW_USED = new Int32Array(4096);

/**
 * LZW-compresses palette indices and writes them as GIF data sub-blocks.
 * @param {Uint8Array} indices one palette index per pixel
 * @param {number} minCodeSize 2..8
 * @param {ByteWriter} out
 */
function writeLzw(indices, minCodeSize, out) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let usedCount = 0;

  // Compressed bytes are buffered into 255-byte sub-blocks.
  const block = new Uint8Array(255);
  let blockLen = 0;
  let acc = 0;
  let accBits = 0;

  const emit = (code) => {
    acc |= code << accBits;
    accBits += codeSize;
    while (accBits >= 8) {
      block[blockLen++] = acc & 0xff;
      acc >>>= 8;
      accBits -= 8;
      if (blockLen === 255) {
        out.byte(255);
        out.bytes(block);
        blockLen = 0;
      }
    }
  };

  out.byte(minCodeSize);
  emit(clearCode);

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const pixel = indices[i];
    const key = (prefix << 8) | pixel;
    const known = LZW_TABLE[key];
    if (known !== 0) {
      prefix = known;
      continue;
    }
    emit(prefix);
    if (nextCode === 4096) {
      // Dictionary full: tell the decoder to start over.
      emit(clearCode);
      for (let u = 0; u < usedCount; u++) LZW_TABLE[LZW_USED[u]] = 0;
      usedCount = 0;
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
    } else {
      // The code width grows only once the decoder has caught up to it.
      if (nextCode >= 1 << codeSize) codeSize++;
      LZW_TABLE[key] = nextCode++;
      LZW_USED[usedCount++] = key;
    }
    prefix = pixel;
  }
  emit(prefix);
  emit(eoiCode);
  if (accBits > 0) block[blockLen++] = acc & 0xff;
  if (blockLen > 0) {
    out.byte(blockLen);
    out.bytes(block.subarray(0, blockLen));
  }
  out.byte(0); // block terminator

  for (let u = 0; u < usedCount; u++) LZW_TABLE[LZW_USED[u]] = 0;
}

// ---------------------------------------------------------------------------
// GIF assembly
// ---------------------------------------------------------------------------

/** Smallest n (1..8) such that 2^n >= count. */
function bitsFor(count) {
  let bits = 1;
  while (1 << bits < count) bits++;
  return bits;
}

function writeColorTable(out, palette, bits) {
  const table = new Uint8Array((1 << bits) * 3);
  table.set(palette.subarray(0, Math.min(palette.length, table.length)));
  out.bytes(table);
}

const yieldToUi = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Encodes RGBA frames into an animated GIF.
 *
 * @param {Array<{data: ArrayLike<number>, delay?: number}>} frames RGBA buffers
 *        (width * height * 4) with an optional per-frame delay in milliseconds.
 * @param {Object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {number} [options.delay=100] default frame delay in ms
 * @param {number} [options.repeat=0] 0 loops forever, -1 plays once, n repeats n times
 * @param {number} [options.maxColors=256] 2..256
 * @param {'none'|'ordered'|'fs'} [options.dither='none']
 * @param {'global'|'frame'} [options.palette='global'] one shared palette (small
 *        files, stable colours) or a fresh palette per frame (best for clips
 *        whose colours change a lot)
 * @param {(progress: number) => void} [options.onProgress] 0..1
 * @param {() => boolean} [options.isCancelled]
 * @returns {Promise<Uint8Array>} the GIF file bytes
 */
export async function encodeGif(frames, options) {
  const { width, height } = options;
  if (!frames || frames.length === 0) throw new Error('At least one frame is required.');
  if (!(width > 0 && height > 0) || width > 0xffff || height > 0xffff) {
    throw new Error('Invalid GIF dimensions.');
  }
  const pixelCount = width * height;
  for (const f of frames) {
    if (f.data.length !== pixelCount * 4) throw new Error('Frame size does not match the GIF dimensions.');
  }

  const defaultDelay = options.delay ?? 100;
  const repeat = options.repeat ?? 0;
  const dither = options.dither || 'none';
  const perFrame = options.palette === 'frame';
  const onProgress = options.onProgress || (() => {});
  const isCancelled = options.isCancelled || (() => false);

  // Does anything need to stay see-through?
  let hasAlpha = false;
  for (const f of frames) {
    const d = f.data;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < ALPHA_THRESHOLD) {
        hasAlpha = true;
        break;
      }
    }
    if (hasAlpha) break;
  }

  // One palette slot is always kept free: it marks transparent pixels for
  // stickers, and "unchanged since the last frame" pixels for opaque clips.
  const colorBudget = Math.max(2, Math.min(255, (options.maxColors ?? 256) - 1));

  let globalPalette = null;
  let globalMatch = null;
  if (!perFrame) {
    globalPalette = quantize(frames.map((f) => f.data), colorBudget);
    globalMatch = createMatcher(globalPalette);
  }

  const out = new ByteWriter(Math.max(1 << 16, Math.min(pixelCount * frames.length, 1 << 24) >> 2));
  out.ascii('GIF89a');
  out.u16(width);
  out.u16(height);
  if (globalPalette) {
    const bits = bitsFor(globalPalette.length / 3 + 1);
    out.byte(0x80 | 0x70 | (bits - 1));
    out.byte(0);
    out.byte(0);
    writeColorTable(out, globalPalette, bits);
  } else {
    out.byte(0x70);
    out.byte(0);
    out.byte(0);
  }

  if (repeat >= 0 && frames.length > 1) {
    out.bytes([0x21, 0xff, 0x0b]);
    out.ascii('NETSCAPE2.0');
    out.bytes([0x03, 0x01]);
    out.u16(repeat);
    out.byte(0);
  }

  // What the viewer currently shows, as packed 0xRRGGBB (-1 = nothing yet).
  const shown = hasAlpha ? null : new Int32Array(pixelCount).fill(-1);

  let elapsedMs = 0;
  let elapsedCs = 0;

  for (let f = 0; f < frames.length; f++) {
    if (isCancelled()) throw new DOMException('GIF export cancelled.', 'AbortError');
    const rgba = frames[f].data;

    const palette = perFrame ? quantize([rgba], colorBudget) : globalPalette;
    const match = perFrame ? createMatcher(palette) : globalMatch;
    const colorCount = palette.length / 3;
    const transparentIndex = colorCount; // the slot right after the real colours
    const tableBits = bitsFor(colorCount + 1);

    const indexed = indexFrame(rgba, width, height, palette, match, dither);

    // Work out the rectangle that actually has to be stored.
    let minX = width, minY = height, maxX = -1, maxY = -1;
    if (shown) {
      for (let y = 0, p = 0; y < height; y++) {
        for (let x = 0; x < width; x++, p++) {
          const o = indexed[p] * 3;
          const rgb = (palette[o] << 16) | (palette[o + 1] << 8) | palette[o + 2];
          if (rgb === shown[p]) {
            indexed[p] = -1; // identical to what is on screen: leave it alone
          } else {
            shown[p] = rgb;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    } else {
      for (let y = 0, p = 0; y < height; y++) {
        for (let x = 0; x < width; x++, p++) {
          if (indexed[p] < 0) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      // Nothing to draw: emit a single transparent pixel so the delay survives.
      minX = 0;
      minY = 0;
      maxX = 0;
      maxY = 0;
    }
    const rw = maxX - minX + 1;
    const rh = maxY - minY + 1;

    const pixels = new Uint8Array(rw * rh);
    for (let y = 0; y < rh; y++) {
      const src = (minY + y) * width + minX;
      const dst = y * rw;
      for (let x = 0; x < rw; x++) {
        const v = indexed[src + x];
        pixels[dst + x] = v < 0 ? transparentIndex : v;
      }
    }

    // Delays are stored in 1/100 s. Rounding the running total (rather than
    // each frame) keeps the clip's overall length right; browsers treat
    // anything under 2 as "slow", so that is the floor.
    elapsedMs += frames[f].delay ?? defaultDelay;
    const targetCs = Math.round(elapsedMs / 10);
    const delayCs = Math.max(2, targetCs - elapsedCs);
    elapsedCs += delayCs;

    // Graphic Control Extension: stickers are wiped between frames (disposal 2),
    // opaque clips build on the previous frame (disposal 1).
    out.bytes([0x21, 0xf9, 0x04]);
    out.byte(((hasAlpha ? 2 : 1) << 2) | 0x01);
    out.u16(Math.min(0xffff, delayCs));
    out.byte(transparentIndex);
    out.byte(0);

    // Image Descriptor
    out.byte(0x2c);
    out.u16(minX);
    out.u16(minY);
    out.u16(rw);
    out.u16(rh);
    if (perFrame) {
      out.byte(0x80 | (tableBits - 1));
      writeColorTable(out, palette, tableBits);
    } else {
      out.byte(0);
    }

    writeLzw(pixels, Math.max(2, tableBits), out);

    onProgress((f + 1) / frames.length);
    await yieldToUi();
  }

  out.byte(0x3b);
  return out.result();
}

/**
 * Convenience wrapper: encodes canvas frames into an animated GIF Blob.
 *
 * @param {HTMLCanvasElement[]} canvases frames, all the same size
 * @param {Object} [options] see `encodeGif`; `delay` may also be an array of
 *        per-frame delays in ms
 * @returns {Promise<Blob>} image/gif
 */
export async function createAnimatedGif(canvases, options = {}) {
  if (!canvases || canvases.length === 0) {
    throw new Error('At least one canvas frame is required.');
  }
  const width = canvases[0].width;
  const height = canvases[0].height;
  const delays = Array.isArray(options.delay) ? options.delay : null;

  const frames = canvases.map((canvas, i) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return {
      data: ctx.getImageData(0, 0, width, height).data,
      delay: delays ? delays[i] : undefined,
    };
  });

  const bytes = await encodeGif(frames, {
    ...options,
    width,
    height,
    delay: delays ? 100 : options.delay,
  });
  return new Blob([bytes], { type: 'image/gif' });
}
