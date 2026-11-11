// Animated WebP writer for AmiBuzz.
//
// Browsers can encode a single canvas to WebP but not an animation, so this
// takes one still WebP per frame and muxes them into a real animated WebP
// (RIFF container with VP8X + ANIM + ANMF chunks). The muxer itself is pure
// byte shuffling and has no browser dependencies.

const fourCC = (bytes, offset) =>
  String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);

const u32 = (bytes, o) => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;

/** Splits a still WebP file into its RIFF chunks. */
function readChunks(bytes) {
  if (bytes.length < 20 || fourCC(bytes, 0) !== 'RIFF' || fourCC(bytes, 8) !== 'WEBP') {
    throw new Error('Frame is not a WebP image.');
  }
  const chunks = [];
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const id = fourCC(bytes, pos);
    const size = u32(bytes, pos + 4);
    const end = Math.min(bytes.length, pos + 8 + size);
    chunks.push({ id, data: bytes.subarray(pos + 8, end) });
    pos = end + (size & 1);
  }
  return chunks;
}

/** Serialises one RIFF chunk (header + payload + pad byte when odd). */
function chunk(id, payload) {
  const out = new Uint8Array(8 + payload.length + (payload.length & 1));
  for (let i = 0; i < 4; i++) out[i] = id.charCodeAt(i);
  out[4] = payload.length & 0xff;
  out[5] = (payload.length >> 8) & 0xff;
  out[6] = (payload.length >> 16) & 0xff;
  out[7] = (payload.length >>> 24) & 0xff;
  out.set(payload, 8);
  return out;
}

const put24 = (arr, offset, value) => {
  arr[offset] = value & 0xff;
  arr[offset + 1] = (value >> 8) & 0xff;
  arr[offset + 2] = (value >> 16) & 0xff;
};

/**
 * Muxes still WebP images into one animated WebP.
 *
 * @param {Array<{bytes: Uint8Array, duration: number}>} frames still WebP files
 *        (all `width` x `height`) with their display time in milliseconds
 * @param {Object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {number} [options.loop=0] 0 loops forever, otherwise the play count
 * @returns {Uint8Array} the animated WebP file
 */
export function muxAnimatedWebp(frames, { width, height, loop = 0 }) {
  if (!frames.length) throw new Error('At least one frame is required.');
  if (width < 1 || height < 1 || width > 16384 || height > 16384) {
    throw new Error('Invalid WebP dimensions.');
  }

  let anyAlpha = false;
  const frameChunks = frames.map(({ bytes, duration }) => {
    const parts = readChunks(bytes);
    const lossless = parts.find((c) => c.id === 'VP8L');
    const lossy = parts.find((c) => c.id === 'VP8 ');
    const alpha = parts.find((c) => c.id === 'ALPH');
    if (!lossless && !lossy) throw new Error('WebP frame has no image data.');

    let hasAlpha = Boolean(alpha);
    if (lossless) {
      // VP8L header: signature byte, then 14 bits width, 14 bits height, 1 bit alpha.
      hasAlpha = Boolean(lossless.data[4] & 0x10);
    }
    if (hasAlpha) anyAlpha = true;

    const image = lossless
      ? chunk('VP8L', lossless.data)
      : alpha
      ? concat([chunk('ALPH', alpha.data), chunk('VP8 ', lossy.data)])
      : chunk('VP8 ', lossy.data);

    const header = new Uint8Array(16);
    put24(header, 0, 0); // x offset / 2
    put24(header, 3, 0); // y offset / 2
    put24(header, 6, width - 1);
    put24(header, 9, height - 1);
    put24(header, 12, Math.max(1, Math.min(0xffffff, Math.round(duration))));
    // Every frame covers the whole canvas, so replace instead of blending
    // (bit 1) and leave the canvas alone afterwards (bit 0 clear).
    header[15] = 0x02;

    return chunk('ANMF', concat([header, image]));
  });

  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x02 | (anyAlpha ? 0x10 : 0); // animation (+ alpha)
  put24(vp8x, 4, width - 1);
  put24(vp8x, 7, height - 1);

  const anim = new Uint8Array(6); // background colour 0x00000000, then loop count
  anim[4] = loop & 0xff;
  anim[5] = (loop >> 8) & 0xff;

  const body = concat([chunk('VP8X', vp8x), chunk('ANIM', anim), ...frameChunks]);
  const out = new Uint8Array(12 + body.length);
  out.set([0x52, 0x49, 0x46, 0x46]); // RIFF
  const riffSize = 4 + body.length;
  out[4] = riffSize & 0xff;
  out[5] = (riffSize >> 8) & 0xff;
  out[6] = (riffSize >> 16) & 0xff;
  out[7] = (riffSize >>> 24) & 0xff;
  out.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  out.set(body, 12);
  return out;
}

function concat(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/** True when this browser can encode a canvas to WebP (Safari cannot). */
export function canEncodeWebp() {
  try {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 2;
    return c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

const canvasToWebpBytes = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob || blob.type !== 'image/webp') {
          reject(new Error('This browser cannot encode WebP. Export as GIF instead.'));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      'image/webp',
      quality
    );
  });

/**
 * Encodes canvas frames into an animated WebP Blob, optionally squeezing the
 * result under a byte budget (WhatsApp animated stickers must be <= 500 KB).
 *
 * When a budget is set the encoder lowers quality first and then, if that is
 * not enough, drops every other frame (doubling the remaining delays so the
 * animation keeps its length).
 *
 * @param {HTMLCanvasElement[]} canvases frames, all the same size
 * @param {Object} [options]
 * @param {number|number[]} [options.delay=100] ms, shared or per frame
 * @param {number} [options.loop=0]
 * @param {number} [options.quality=0.9] 0..1 starting quality
 * @param {number} [options.maxBytes] byte budget
 * @param {(progress: number) => void} [options.onProgress]
 * @returns {Promise<{blob: Blob, quality: number, frameCount: number, fitsBudget: boolean}>}
 */
export async function createAnimatedWebp(canvases, options = {}) {
  if (!canvases || canvases.length === 0) throw new Error('At least one canvas frame is required.');
  const width = canvases[0].width;
  const height = canvases[0].height;
  const onProgress = options.onProgress || (() => {});
  const maxBytes = options.maxBytes || Infinity;

  let frames = canvases.map((canvas, i) => ({
    canvas,
    duration: Array.isArray(options.delay) ? options.delay[i] : options.delay ?? 100,
  }));

  const qualities = [options.quality ?? 0.9, 0.75, 0.6, 0.45, 0.3, 0.18].filter(
    (q, i, list) => i === 0 || q < list[0]
  );
  const passes = Number.isFinite(maxBytes) ? 4 : 1;
  let best = null;

  for (let pass = 0; pass < passes; pass++) {
    for (let qi = 0; qi < qualities.length; qi++) {
      const quality = qualities[qi];
      const encoded = [];
      for (let i = 0; i < frames.length; i++) {
        encoded.push({
          bytes: await canvasToWebpBytes(frames[i].canvas, quality),
          duration: frames[i].duration,
        });
        onProgress(Math.min(0.99, (pass + (qi + (i + 1) / frames.length) / qualities.length) / passes));
      }
      const bytes = muxAnimatedWebp(encoded, { width, height, loop: options.loop ?? 0 });
      best = { bytes, quality, frameCount: frames.length };
      if (bytes.length <= maxBytes) {
        onProgress(1);
        return { blob: new Blob([bytes], { type: 'image/webp' }), quality, frameCount: frames.length, fitsBudget: true };
      }
    }
    if (frames.length <= 4) break;
    // Still too big at the lowest quality: halve the frame count.
    const thinned = [];
    for (let i = 0; i < frames.length; i += 2) {
      thinned.push({
        canvas: frames[i].canvas,
        duration: frames[i].duration + (frames[i + 1]?.duration ?? 0),
      });
    }
    frames = thinned;
  }

  onProgress(1);
  return {
    blob: new Blob([best.bytes], { type: 'image/webp' }),
    quality: best.quality,
    frameCount: best.frameCount,
    fitsBudget: best.bytes.length <= maxBytes,
  };
}
