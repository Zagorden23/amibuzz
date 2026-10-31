// Pure JavaScript GIF89a Multi-Frame Encoder
// Produces real animated .gif files compatible with Discord, Telegram, WhatsApp, Slack, etc.
// 100% self-contained, no external binaries or dependencies.

/**
 * Builds a 256-color palette from RGBA pixel data with transparency support.
 * Index 0 is reserved for transparent pixels if any pixel has alpha < 128.
 */
function buildPalette(rgbaData) {
  const colorMap = new Map();
  let hasAlpha = false;

  for (let i = 0; i < rgbaData.length; i += 4) {
    const a = rgbaData[i + 3];
    if (a < 128) {
      hasAlpha = true;
      continue;
    }
    // Quantize 5 bits per channel to group similar colors
    const r = rgbaData[i] & 0xf8;
    const g = rgbaData[i + 1] & 0xf8;
    const b = rgbaData[i + 2] & 0xf8;
    const key = (r << 16) | (g << 8) | b;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }

  // Sort colors by frequency
  const sorted = Array.from(colorMap.entries()).sort((a, b) => b[1] - a[1]);
  const palette = [];
  const maxColors = hasAlpha ? 255 : 256;

  if (hasAlpha) {
    // Index 0: Transparent placeholder (black with alpha key)
    palette.push([0, 0, 0]);
  }

  for (let i = 0; i < Math.min(sorted.length, maxColors); i++) {
    const key = sorted[i][0];
    const r = (key >> 16) & 0xff;
    const g = (key >> 8) & 0xff;
    const b = key & 0xff;
    palette.push([r, g, b]);
  }

  // Fill up to 256 colors if palette is small
  while (palette.length < 256) {
    palette.push([0, 0, 0]);
  }

  return { palette, hasAlpha };
}

/**
 * Maps RGBA pixels to palette indices using Euclidean distance.
 */
function mapPixelsToPalette(rgbaData, palette, hasAlpha) {
  const pixelCount = rgbaData.length / 4;
  const indexed = new Uint8Array(pixelCount);
  const cache = new Map();

  const startIndex = hasAlpha ? 1 : 0;

  for (let i = 0; i < rgbaData.length; i += 4) {
    const pIdx = i / 4;
    const a = rgbaData[i + 3];
    if (hasAlpha && a < 128) {
      indexed[pIdx] = 0; // Transparent index
      continue;
    }

    const r = rgbaData[i];
    const g = rgbaData[i + 1];
    const b = rgbaData[i + 2];
    const key = (r << 16) | (g << 8) | b;

    if (cache.has(key)) {
      indexed[pIdx] = cache.get(key);
      continue;
    }

    let bestDist = Infinity;
    let bestIdx = startIndex;

    for (let c = startIndex; c < palette.length; c++) {
      const pr = palette[c][0];
      const pg = palette[c][1];
      const pb = palette[c][2];
      const dist = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = c;
        if (dist === 0) break;
      }
    }

    cache.set(key, bestIdx);
    indexed[pIdx] = bestIdx;
  }

  return indexed;
}

/**
 * GIF LZW Encoder. Compresses stream of palette indices into GIF image data sub-blocks.
 */
function encodeLZW(minCodeSize, pixels) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let curCode = minCodeSize + 2;
  let codeSize = minCodeSize + 1;
  let maxCode = (1 << codeSize) - 1;

  const dict = new Map();
  function resetDict() {
    dict.clear();
    for (let i = 0; i < clearCode; i++) {
      dict.set(String.fromCharCode(i), i);
    }
    curCode = minCodeSize + 2;
    codeSize = minCodeSize + 1;
    maxCode = (1 << codeSize) - 1;
  }
  resetDict();

  const out = [];
  let curByte = 0;
  let curBit = 0;

  function writeBits(val, bits) {
    while (bits > 0) {
      const take = Math.min(bits, 8 - curBit);
      curByte |= ((val & ((1 << take) - 1)) << curBit);
      curBit += take;
      val >>= take;
      bits -= take;
      if (curBit === 8) {
        out.push(curByte);
        curByte = 0;
        curBit = 0;
      }
    }
  }

  writeBits(clearCode, codeSize);
  let prefix = '';

  for (let i = 0; i < pixels.length; i++) {
    const c = String.fromCharCode(pixels[i]);
    const phrase = prefix + c;
    if (dict.has(phrase)) {
      prefix = phrase;
    } else {
      writeBits(dict.get(prefix), codeSize);
      if (curCode <= 4095) {
        dict.set(phrase, curCode++);
        if (curCode > maxCode && codeSize < 12) {
          codeSize++;
          maxCode = (1 << codeSize) - 1;
        }
      } else {
        writeBits(clearCode, codeSize);
        resetDict();
      }
      prefix = c;
    }
  }

  if (prefix !== '') writeBits(dict.get(prefix), codeSize);
  writeBits(eoiCode, codeSize);
  if (curBit > 0) out.push(curByte);

  // Split into GIF sub-blocks (max 255 bytes each)
  const blocks = [minCodeSize];
  for (let i = 0; i < out.length; i += 255) {
    const chunk = out.slice(i, i + 255);
    blocks.push(chunk.length, ...chunk);
  }
  blocks.push(0); // Block terminator
  return new Uint8Array(blocks);
}

/**
 * Encodes an array of HTML5 Canvas elements into an animated GIF Blob.
 *
 * @param {HTMLCanvasElement[]} canvases - Array of canvas frames
 * @param {Object} options
 * @param {number} [options.delay=100] - Delay in milliseconds per frame (100ms = 10 FPS)
 * @param {number} [options.repeat=0] - 0 for infinite loop, >0 for repeat count
 * @param {Function} [options.onProgress] - Callback with 0.0 to 1.0 progress
 * @returns {Promise<Blob>} The animated GIF Blob (image/gif)
 */
export async function createAnimatedGif(canvases, options = {}) {
  if (!canvases || canvases.length === 0) {
    throw new Error('At least one canvas frame is required.');
  }

  const width = canvases[0].width;
  const height = canvases[0].height;
  const delayMs = options.delay || 100;
  // GIF delay unit is 1/100 of a second (10ms)
  const gifDelayUnits = Math.max(1, Math.round(delayMs / 10));
  const repeat = options.repeat !== undefined ? options.repeat : 0;
  const onProgress = options.onProgress || (() => {});

  const byteChunks = [];

  // 1. GIF89a Header
  byteChunks.push(new TextEncoder().encode('GIF89a'));

  // 2. Logical Screen Descriptor (7 bytes)
  const lsd = new Uint8Array(7);
  lsd[0] = width & 0xff;
  lsd[1] = (width >> 8) & 0xff;
  lsd[2] = height & 0xff;
  lsd[3] = (height >> 8) & 0xff;
  lsd[4] = 0x70; // No Global Color Table flag initially (per-frame local color tables)
  lsd[5] = 0;    // Background color index
  lsd[6] = 0;    // Pixel aspect ratio
  byteChunks.push(lsd);

  // 3. Netscape 2.0 Application Extension (for looping)
  const appExt = new Uint8Array([
    0x21, 0xff, 0x0b, // Extension header
    0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, // "NETSCAPE2.0"
    0x03, 0x01,
    repeat & 0xff,
    (repeat >> 8) & 0xff,
    0x00, // Terminator
  ]);
  byteChunks.push(appExt);

  // 4. Process each frame
  for (let f = 0; f < canvases.length; f++) {
    onProgress((f / canvases.length) * 0.9);

    const canvas = canvases[f];
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, width, height).data;

    // Palette & Indexing
    const { palette, hasAlpha } = buildPalette(imgData);
    const indexedPixels = mapPixelsToPalette(imgData, palette, hasAlpha);

    // Graphic Control Extension (8 bytes)
    const gce = new Uint8Array(8);
    gce[0] = 0x21; // Extension introducer
    gce[1] = 0xf9; // Graphic control label
    gce[2] = 0x04; // Block size
    // Packed field: Disposal (restore to background = 2 << 2 = 0x08), transparent flag
    gce[3] = hasAlpha ? 0x09 : 0x08;
    gce[4] = gifDelayUnits & 0xff;
    gce[5] = (gifDelayUnits >> 8) & 0xff;
    gce[6] = hasAlpha ? 0 : 0; // Transparent color index
    gce[7] = 0x00; // Block terminator
    byteChunks.push(gce);

    // Image Descriptor (10 bytes) + Local Color Table
    const id = new Uint8Array(10);
    id[0] = 0x2c; // Image separator
    id[1] = 0; id[2] = 0; // Left position
    id[3] = 0; id[4] = 0; // Top position
    id[5] = width & 0xff;
    id[6] = (width >> 8) & 0xff;
    id[7] = height & 0xff;
    id[8] = (height >> 8) & 0xff;
    // Local Color Table present: flag (0x80) | 256 colors (0x07) = 0x87
    id[9] = 0x87;
    byteChunks.push(id);

    // Local Color Table: 256 colors * 3 = 768 bytes
    const lct = new Uint8Array(768);
    for (let c = 0; c < 256; c++) {
      const col = palette[c] || [0, 0, 0];
      lct[c * 3] = col[0];
      lct[c * 3 + 1] = col[1];
      lct[c * 3 + 2] = col[2];
    }
    byteChunks.push(lct);

    // LZW Raster Data
    const lzwData = encodeLZW(8, indexedPixels);
    byteChunks.push(lzwData);
  }

  // 5. Trailer byte
  byteChunks.push(new Uint8Array([0x3b]));

  onProgress(1.0);
  return new Blob(byteChunks, { type: 'image/gif' });
}
