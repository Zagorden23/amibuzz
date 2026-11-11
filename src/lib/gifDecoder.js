// Pure JavaScript GIF decoder for AmiBuzz.
//
// Turns an animated GIF into fully composited RGBA frames (disposal methods,
// transparency, local palettes and interlacing are all applied), so an existing
// GIF can be trimmed, restyled, captioned and re-exported in the GIF Lab.

/** True when the bytes start with a GIF signature. */
export function isGif(bytes) {
  return (
    bytes.length > 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  );
}

/** Decodes GIF LZW data into `pixelCount` palette indices. */
function lzwDecode(minCodeSize, data, pixelCount) {
  const out = new Uint8Array(pixelCount);
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const prefix = new Uint16Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4097);
  for (let i = 0; i < clearCode; i++) suffix[i] = i;

  let codeSize = minCodeSize + 1;
  let codeMask = (1 << codeSize) - 1;
  let available = clearCode + 2;
  let oldCode = -1;
  let first = 0;
  let top = 0;
  let bits = 0;
  let acc = 0;
  let pos = 0;
  let written = 0;

  while (written < pixelCount) {
    if (top === 0) {
      if (bits < codeSize) {
        if (pos >= data.length) break;
        acc |= data[pos++] << bits;
        bits += 8;
        continue;
      }
      let code = acc & codeMask;
      acc >>>= codeSize;
      bits -= codeSize;

      if (code > available || code === eoiCode) break;
      if (code === clearCode) {
        codeSize = minCodeSize + 1;
        codeMask = (1 << codeSize) - 1;
        available = clearCode + 2;
        oldCode = -1;
        continue;
      }
      if (oldCode === -1) {
        stack[top++] = suffix[code];
        oldCode = code;
        first = code;
        continue;
      }
      const inCode = code;
      if (code === available) {
        stack[top++] = first;
        code = oldCode;
      }
      while (code > clearCode) {
        stack[top++] = suffix[code];
        code = prefix[code];
      }
      first = suffix[code];
      stack[top++] = first;
      if (available < 4096) {
        prefix[available] = oldCode;
        suffix[available] = first;
        available++;
        if ((available & codeMask) === 0 && available < 4096) {
          codeSize++;
          codeMask = (1 << codeSize) - 1;
        }
      }
      oldCode = inCode;
    }
    out[written++] = stack[--top];
  }
  return out;
}

/**
 * Decodes a GIF.
 *
 * @param {Uint8Array} bytes the GIF file
 * @param {Object} [options]
 * @param {number} [options.maxFrames=Infinity] stop after this many frames
 * @param {(frame: {data: Uint8ClampedArray, delay: number, index: number, width: number, height: number}) => void} [options.onFrame]
 *        when given, frames are handed over one by one and not kept in memory
 *        (`data` is reused between calls, so copy or draw it straight away)
 * @returns {{width: number, height: number, loopCount: number, frameCount: number,
 *            frames: Array<{data: Uint8ClampedArray, delay: number}>}}
 *          `loopCount` is 0 for "forever" and -1 when the GIF plays once.
 */
export function decodeGif(bytes, options = {}) {
  if (!isGif(bytes)) throw new Error('Not a GIF file.');
  const maxFrames = options.maxFrames ?? Infinity;
  const onFrame = options.onFrame || null;

  const u16 = (o) => bytes[o] | (bytes[o + 1] << 8);
  const width = u16(6);
  const height = u16(8);
  if (!width || !height) throw new Error('GIF has no dimensions.');

  let pos = 13;
  let globalTable = null;
  const lsdPacked = bytes[10];
  if (lsdPacked & 0x80) {
    const size = 3 * (1 << ((lsdPacked & 7) + 1));
    globalTable = bytes.subarray(pos, pos + size);
    pos += size;
  }

  const canvas = new Uint8ClampedArray(width * height * 4);
  let restore = null; // snapshot for disposal method 3
  const frames = [];
  let frameCount = 0;
  let loopCount = -1;

  // Pending Graphic Control Extension state
  let delay = 100;
  let disposal = 0;
  let transparentIndex = -1;

  const skipSubBlocks = () => {
    while (pos < bytes.length) {
      const size = bytes[pos++];
      if (size === 0) return;
      pos += size;
    }
  };

  while (pos < bytes.length && frameCount < maxFrames) {
    const marker = bytes[pos++];

    if (marker === 0x3b) break; // trailer

    if (marker === 0x21) {
      const label = bytes[pos++];
      if (label === 0xf9) {
        // Graphic Control Extension
        const packed = bytes[pos + 1];
        disposal = (packed >> 2) & 7;
        const cs = u16(pos + 2);
        // Browsers play "0" and "1" delays at 100 ms, so mirror that.
        delay = cs < 2 ? 100 : cs * 10;
        transparentIndex = packed & 1 ? bytes[pos + 4] : -1;
        pos += 1 + bytes[pos];
        skipSubBlocks();
      } else if (label === 0xff) {
        // Application extension — NETSCAPE2.0 carries the loop count.
        const blockSize = bytes[pos];
        const id = String.fromCharCode(...bytes.subarray(pos + 1, pos + 1 + blockSize));
        pos += 1 + blockSize;
        if (id === 'NETSCAPE2.0' && bytes[pos] === 3 && bytes[pos + 1] === 1) {
          loopCount = u16(pos + 2);
        }
        skipSubBlocks();
      } else {
        skipSubBlocks();
      }
      continue;
    }

    if (marker !== 0x2c) break; // not an image descriptor: stop on garbage

    const left = u16(pos);
    const top = u16(pos + 2);
    const fw = u16(pos + 4);
    const fh = u16(pos + 6);
    const packed = bytes[pos + 8];
    pos += 9;

    let table = globalTable;
    if (packed & 0x80) {
      const size = 3 * (1 << ((packed & 7) + 1));
      table = bytes.subarray(pos, pos + size);
      pos += size;
    }
    const interlaced = Boolean(packed & 0x40);

    const minCodeSize = bytes[pos++];
    // Join the data sub-blocks into one buffer.
    let dataLen = 0;
    let scan = pos;
    while (scan < bytes.length && bytes[scan] !== 0) {
      dataLen += bytes[scan];
      scan += bytes[scan] + 1;
    }
    const data = new Uint8Array(dataLen);
    let offset = 0;
    while (pos < bytes.length && bytes[pos] !== 0) {
      const size = bytes[pos++];
      data.set(bytes.subarray(pos, pos + size), offset);
      offset += size;
      pos += size;
    }
    pos++; // block terminator

    if (!table || fw === 0 || fh === 0 || minCodeSize < 1 || minCodeSize > 11) continue;

    if (disposal === 3) restore = canvas.slice();

    const indices = lzwDecode(minCodeSize, data, fw * fh);
    const tableColors = table.length / 3;

    const drawRow = (srcRow, dstRow) => {
      const y = top + dstRow;
      if (y >= height) return;
      const src = srcRow * fw;
      for (let x = 0; x < fw; x++) {
        const cx = left + x;
        if (cx >= width) break;
        const idx = indices[src + x];
        if (idx === transparentIndex || idx >= tableColors) continue;
        const o = (y * width + cx) * 4;
        const c = idx * 3;
        canvas[o] = table[c];
        canvas[o + 1] = table[c + 1];
        canvas[o + 2] = table[c + 2];
        canvas[o + 3] = 255;
      }
    };

    if (interlaced) {
      let srcRow = 0;
      for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
        for (let row = start; row < fh; row += step) drawRow(srcRow++, row);
      }
    } else {
      for (let row = 0; row < fh; row++) drawRow(row, row);
    }

    if (onFrame) {
      onFrame({ data: canvas, delay, index: frameCount, width, height });
    } else {
      frames.push({ data: canvas.slice(), delay });
    }
    frameCount++;

    // Apply this frame's disposal before the next one is drawn.
    if (disposal === 2) {
      const x1 = Math.min(width, left + fw);
      const y1 = Math.min(height, top + fh);
      for (let y = top; y < y1; y++) {
        canvas.fill(0, (y * width + left) * 4, (y * width + x1) * 4);
      }
    } else if (disposal === 3 && restore) {
      canvas.set(restore);
    }

    delay = 100;
    disposal = 0;
    transparentIndex = -1;
  }

  if (frameCount === 0) throw new Error('GIF contains no image data.');
  return { width, height, loopCount, frameCount, frames };
}
