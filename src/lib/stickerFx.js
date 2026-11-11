// Sticker image pipeline for AmiBuzz — everything runs on-device.
//
//  1. removeBackground  – cuts a flat background away by flood-filling in from
//                         the image edges, then softens and de-fringes the rim.
//  2. animeFilter       – cel-shading "toon" filters, one look per art style.
//  3. renderDieCut      – a sticker border that follows the subject's contour.
//  4. makeSticker       – the three steps above, from any image to a 512px
//                         transparent sticker.
//
// The pixel functions take plain `{ data, width, height }` objects (ImageData
// works) and have no DOM dependencies; the canvas helpers sit at the bottom.

import { quantize } from './gifEncoder.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Perceptually weighted colour distance, scaled back to roughly 0..255.
const colorDistance = (r1, g1, b1, r2, g2, b2) => {
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
};

// ---------------------------------------------------------------------------
// Transparency helpers
// ---------------------------------------------------------------------------

/** True when a meaningful share of the image is already see-through. */
export function hasTransparency(img, minFraction = 0.02) {
  const { data } = img;
  let clear = 0;
  for (let i = 3; i < data.length; i += 16) if (data[i] < 128) clear++;
  return clear / (data.length / 16) >= minFraction;
}

/**
 * Share (0..1) of the visible pixels that belong to the largest connected
 * piece. 1 means the subject is one solid shape.
 */
export function largestPieceShare(img, threshold = 128) {
  const { data, width, height } = img;
  const total = width * height;
  const seen = new Uint8Array(total);
  const stack = new Int32Array(total);
  let visible = 0;
  let largest = 0;
  for (let start = 0; start < total; start++) {
    if (seen[start] || data[start * 4 + 3] < threshold) continue;
    let top = 0;
    let size = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top > 0) {
      const p = stack[--top];
      size++;
      const x = p % width;
      const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
      for (const q of neighbours) {
        if (q < 0 || q >= total || seen[q] || data[q * 4 + 3] < threshold) continue;
        seen[q] = 1;
        stack[top++] = q;
      }
    }
    visible += size;
    if (size > largest) largest = size;
  }
  return visible ? largest / visible : 0;
}

/** Bounding box of the visible pixels, or null when the image is empty. */
export function alphaBounds(img, threshold = 8) {
  const { data, width, height } = img;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// ---------------------------------------------------------------------------
// Background removal
// ---------------------------------------------------------------------------

/**
 * Finds the dominant colour along the image border.
 * @returns {{color: number[], confidence: number}} confidence is the share of
 *          border pixels that are close to that colour (0..1)
 */
export function detectBackground(img, tolerance = 34) {
  const { data, width, height } = img;
  const samples = [];
  const push = (x, y) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] >= 128) samples.push(data[i], data[i + 1], data[i + 2]);
  };
  const stepX = Math.max(1, Math.floor(width / 160));
  const stepY = Math.max(1, Math.floor(height / 160));
  for (let x = 0; x < width; x += stepX) {
    push(x, 0);
    push(x, Math.min(height - 1, 1));
    push(x, height - 1);
    push(x, Math.max(0, height - 2));
  }
  for (let y = 0; y < height; y += stepY) {
    push(0, y);
    push(Math.min(width - 1, 1), y);
    push(width - 1, y);
    push(Math.max(0, width - 2), y);
  }
  if (samples.length === 0) return { color: [255, 255, 255], confidence: 0 };

  // Vote in a coarse 16x16x16 colour grid, then average the winning cell.
  const votes = new Map();
  for (let i = 0; i < samples.length; i += 3) {
    const key = ((samples[i] >> 4) << 8) | ((samples[i + 1] >> 4) << 4) | (samples[i + 2] >> 4);
    votes.set(key, (votes.get(key) || 0) + 1);
  }
  let bestKey = 0, bestVotes = 0;
  for (const [key, n] of votes) {
    if (n > bestVotes) {
      bestVotes = n;
      bestKey = key;
    }
  }
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < samples.length; i += 3) {
    const key = ((samples[i] >> 4) << 8) | ((samples[i + 1] >> 4) << 4) | (samples[i + 2] >> 4);
    if (key !== bestKey) continue;
    r += samples[i];
    g += samples[i + 1];
    b += samples[i + 2];
    n++;
  }
  const color = [r / n, g / n, b / n];

  let close = 0;
  for (let i = 0; i < samples.length; i += 3) {
    if (colorDistance(samples[i], samples[i + 1], samples[i + 2], color[0], color[1], color[2]) <= tolerance) close++;
  }
  return { color, confidence: close / (samples.length / 3) };
}

/**
 * Removes a flat background by flood-filling inwards from the image edges
 * (and from any extra seed points), then feathers and de-fringes the rim.
 * Mutates `img.data`.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} img
 * @param {Object} [options]
 * @param {number} [options.tolerance=34] how far a pixel may stray from the
 *        background colour and still count as background (0..255)
 * @param {number[]} [options.color] background colour; detected when omitted
 * @param {Array<{x: number, y: number}>} [options.seeds] extra points to
 *        erase from (e.g. where the user tapped), each using its own colour
 * @param {boolean} [options.fromEdges=true]
 * @returns {{removedFraction: number, color: number[], confidence: number}}
 */
export function removeBackground(img, options = {}) {
  const { data, width, height } = img;
  const tolerance = options.tolerance ?? 34;
  const fromEdges = options.fromEdges ?? true;
  const total = width * height;
  const detected = options.color
    ? { color: options.color, confidence: 1 }
    : detectBackground(img, tolerance);

  // 0 = subject; otherwise 1 + the index (in `refs`) of the colour the pixel
  // was matched against. refs[0] is always the detected background colour.
  const mask = new Uint8Array(total);
  const stack = new Int32Array(total);
  const refs = [detected.color];

  const flood = (starts, refIndex) => {
    const ref = refs[refIndex - 1];
    const [rr, rg, rb] = ref;
    const tol2 = tolerance * tolerance * 9;
    const matches = (p) => {
      const i = p * 4;
      if (data[i + 3] < 16) return true;
      const dr = data[i] - rr, dg = data[i + 1] - rg, db = data[i + 2] - rb;
      return 2 * dr * dr + 4 * dg * dg + 3 * db * db <= tol2;
    };
    let top = 0;
    for (const p of starts) {
      if (mask[p] === 0 && matches(p)) {
        mask[p] = refIndex;
        stack[top++] = p;
      }
    }
    while (top > 0) {
      const p = stack[--top];
      const x = p % width;
      if (x > 0 && mask[p - 1] === 0 && matches(p - 1)) {
        mask[p - 1] = refIndex;
        stack[top++] = p - 1;
      }
      if (x < width - 1 && mask[p + 1] === 0 && matches(p + 1)) {
        mask[p + 1] = refIndex;
        stack[top++] = p + 1;
      }
      if (p >= width && mask[p - width] === 0 && matches(p - width)) {
        mask[p - width] = refIndex;
        stack[top++] = p - width;
      }
      if (p < total - width && mask[p + width] === 0 && matches(p + width)) {
        mask[p + width] = refIndex;
        stack[top++] = p + width;
      }
    }
  };

  if (fromEdges) {
    const border = [];
    for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
    for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
    flood(border, 1);
  }
  for (const seed of (options.seeds || []).slice(0, 64)) {
    const sx = clamp(Math.round(seed.x), 0, width - 1);
    const sy = clamp(Math.round(seed.y), 0, height - 1);
    const p = sy * width + sx;
    flood([p], refs.push([data[p * 4], data[p * 4 + 1], data[p * 4 + 2]]));
  }

  // Drop stray specks: foreground islands too small to be part of the subject.
  const minIsland = Math.max(12, Math.round(total * 0.0004));
  const seen = new Uint8Array(total);
  const island = new Int32Array(total);
  for (let start = 0; start < total; start++) {
    if (mask[start] !== 0 || seen[start]) continue;
    let top = 0, size = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top > 0) {
      const p = stack[--top];
      island[size++] = p;
      const x = p % width;
      if (x > 0 && !seen[p - 1] && mask[p - 1] === 0) { seen[p - 1] = 1; stack[top++] = p - 1; }
      if (x < width - 1 && !seen[p + 1] && mask[p + 1] === 0) { seen[p + 1] = 1; stack[top++] = p + 1; }
      if (p >= width && !seen[p - width] && mask[p - width] === 0) { seen[p - width] = 1; stack[top++] = p - width; }
      if (p < total - width && !seen[p + width] && mask[p + width] === 0) { seen[p + width] = 1; stack[top++] = p + width; }
    }
    if (size < minIsland) {
      for (let k = 0; k < size; k++) mask[island[k]] = 1;
    }
  }

  // Rim pixels are a blend of subject and background. Estimate how much
  // subject is in each one, fade it accordingly and pull the background
  // colour back out so no halo is left behind.
  const soft = tolerance * 2.2;
  let removed = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      if (mask[p] !== 0) {
        data[i + 3] = 0;
        removed++;
        continue;
      }
      let neighbour = 0;
      for (let dy = -1; dy <= 1 && !neighbour; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          const m = mask[yy * width + xx];
          if (m !== 0) {
            neighbour = m;
            break;
          }
        }
      }
      if (!neighbour) continue;
      const ref = refs[neighbour - 1];
      const d = colorDistance(data[i], data[i + 1], data[i + 2], ref[0], ref[1], ref[2]);
      const a = clamp(d / soft, 0, 1);
      if (a >= 1) continue;
      if (a < 0.08) {
        data[i + 3] = 0;
        continue;
      }
      data[i] = clamp(ref[0] + (data[i] - ref[0]) / a, 0, 255);
      data[i + 1] = clamp(ref[1] + (data[i + 1] - ref[1]) / a, 0, 255);
      data[i + 2] = clamp(ref[2] + (data[i + 2] - ref[2]) / a, 0, 255);
      data[i + 3] = Math.round(data[i + 3] * a);
    }
  }

  return { removedFraction: removed / total, color: detected.color, confidence: detected.confidence };
}

// ---------------------------------------------------------------------------
// Anime "toon" filters
// ---------------------------------------------------------------------------

/**
 * One on-device look per AmiBuzz art style (keys match `ANIME_STYLES[].name`).
 *  smooth  – edge-preserving blur: passes and how far tones may differ (sigma)
 *  levels  – number of flat shading bands
 *  line    – ink outline: edge threshold, softness, opacity, thickness
 *  tint    – gradient map from shadow to highlight colour, blended at `mix`
 */
export const TOON_STYLES = {
  'Kawaii Chibi': {
    smooth: { passes: 2, sigma: 30 }, levels: 6, saturation: 1.3, contrast: 1.02, brightness: 1.07, pastel: 0.1,
    line: { threshold: 70, soft: 90, strength: 0.75, thick: 1 }, ink: [88, 48, 72],
  },
  'Cyberpunk Neon': {
    smooth: { passes: 2, sigma: 28 }, levels: 5, saturation: 1.45, contrast: 1.2, brightness: 1,
    tint: { shadow: [24, 8, 64], highlight: [90, 255, 245], mix: 0.3 },
    line: { threshold: 60, soft: 80, strength: 0.9, thick: 1 }, ink: [10, 6, 40],
  },
  'Shonen Battle': {
    smooth: { passes: 2, sigma: 26 }, levels: 4, saturation: 1.4, contrast: 1.3, brightness: 1.02,
    line: { threshold: 55, soft: 70, strength: 1, thick: 2 }, ink: [12, 10, 14],
  },
  'Retro 90s Cel': {
    smooth: { passes: 2, sigma: 28 }, levels: 5, saturation: 1.1, contrast: 1.1, brightness: 1.02, grain: 10,
    tint: { shadow: [60, 30, 40], highlight: [255, 236, 200], mix: 0.18 },
    line: { threshold: 65, soft: 80, strength: 0.85, thick: 1 }, ink: [40, 24, 30],
  },
  'Studio Watercolor': {
    smooth: { passes: 3, sigma: 42 }, levels: 9, saturation: 0.94, contrast: 0.96, brightness: 1.08, pastel: 0.08, grain: 6,
    line: { threshold: 90, soft: 110, strength: 0.45, thick: 1 }, ink: [90, 70, 60],
  },
  'Manga Screentone': {
    smooth: { passes: 2, sigma: 26 }, levels: 4, saturation: 0, contrast: 1.25, brightness: 1.04, halftone: true,
    line: { threshold: 50, soft: 70, strength: 1, thick: 2 }, ink: [15, 15, 18],
  },
  'Dark Fantasy': {
    smooth: { passes: 2, sigma: 28 }, levels: 5, saturation: 1.15, contrast: 1.3, brightness: 0.9,
    tint: { shadow: [30, 0, 50], highlight: [255, 170, 190], mix: 0.28 },
    line: { threshold: 60, soft: 80, strength: 0.95, thick: 1 }, ink: [8, 0, 16],
  },
  '16-Bit Pixel': { pixel: true, colors: 24, blocks: 72, saturation: 1.25, ink: [20, 12, 28] },
};

export const DEFAULT_TOON_STYLE = 'Kawaii Chibi';

/** Edge-preserving blur: averages neighbours whose brightness is similar. */
function surfaceBlur(data, width, height, passes, sigma) {
  const total = width * height;
  const weightByDiff = new Float32Array(256);
  for (let d = 0; d < 256; d++) weightByDiff[d] = Math.exp(-(d * d) / (2 * sigma * sigma));
  const lum = new Uint8Array(total);
  let src = data;
  let dst = new Uint8ClampedArray(data.length);

  for (let pass = 0; pass < passes; pass++) {
    for (let p = 0, i = 0; p < total; p++, i += 4) {
      lum[p] = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
    }
    for (let y = 0; y < height; y++) {
      const y0 = y < 2 ? 0 : y - 2;
      const y1 = y > height - 3 ? height - 1 : y + 2;
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const i = p * 4;
        dst[i + 3] = src[i + 3];
        if (src[i + 3] < 16) {
          dst[i] = src[i];
          dst[i + 1] = src[i + 1];
          dst[i + 2] = src[i + 2];
          continue;
        }
        const centre = lum[p];
        const x0 = x < 2 ? 0 : x - 2;
        const x1 = x > width - 3 ? width - 1 : x + 2;
        let r = 0, g = 0, b = 0, sum = 0;
        for (let yy = y0; yy <= y1; yy++) {
          const row = yy * width;
          for (let xx = x0; xx <= x1; xx++) {
            const q = row + xx;
            const j = q * 4;
            if (src[j + 3] < 16) continue;
            const diff = lum[q] - centre;
            const w = weightByDiff[diff < 0 ? -diff : diff];
            r += src[j] * w;
            g += src[j + 1] * w;
            b += src[j + 2] * w;
            sum += w;
          }
        }
        dst[i] = r / sum;
        dst[i + 1] = g / sum;
        dst[i + 2] = b / sum;
      }
    }
    const swap = src;
    src = dst;
    dst = swap;
  }
  if (src !== data) data.set(src);
}

/** Sobel edge strength (0..1) per pixel, with optional thickening. */
function inkEdges(data, width, height, line) {
  const total = width * height;
  const lum = new Float32Array(total);
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    lum[p] = data[i + 3] < 16 ? 0 : (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) / 256;
  }
  let edges = new Float32Array(total);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      const a = lum[p - width - 1], b = lum[p - width], c = lum[p - width + 1];
      const d = lum[p - 1], f = lum[p + 1];
      const g = lum[p + width - 1], h = lum[p + width], k = lum[p + width + 1];
      const gx = c + 2 * f + k - a - 2 * d - g;
      const gy = g + 2 * h + k - a - 2 * b - c;
      edges[p] = smoothstep(line.threshold, line.threshold + line.soft, Math.abs(gx) + Math.abs(gy));
    }
  }
  for (let t = 1; t < (line.thick || 1); t++) {
    const grown = new Float32Array(total);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = y * width + x;
        grown[p] = Math.max(edges[p], edges[p - 1], edges[p + 1], edges[p - width], edges[p + width]);
      }
    }
    edges = grown;
  }
  return edges;
}

// Cheap repeatable noise so previews and exports grain identically.
const hashNoise = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295 - 0.5;
};

function pixelArt(img, style) {
  const { data, width, height } = img;
  const block = Math.max(2, Math.round(Math.max(width, height) / style.blocks));
  const cols = Math.ceil(width / block);
  const rows = Math.ceil(height / block);
  const cells = new Uint8ClampedArray(cols * rows * 4);

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0, opaque = 0;
      const yEnd = Math.min(height, (cy + 1) * block);
      const xEnd = Math.min(width, (cx + 1) * block);
      for (let y = cy * block; y < yEnd; y++) {
        for (let x = cx * block; x < xEnd; x++) {
          const i = (y * width + x) * 4;
          n++;
          a += data[i + 3];
          if (data[i + 3] < 128) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          opaque++;
        }
      }
      const o = (cy * cols + cx) * 4;
      if (opaque && a / n >= 128) {
        const mean = (r + g + b) / (3 * opaque);
        cells[o] = clamp(mean + (r / opaque - mean) * style.saturation, 0, 255);
        cells[o + 1] = clamp(mean + (g / opaque - mean) * style.saturation, 0, 255);
        cells[o + 2] = clamp(mean + (b / opaque - mean) * style.saturation, 0, 255);
        cells[o + 3] = 255;
      }
    }
  }

  // Snap to a small arcade palette.
  const palette = quantize([cells], style.colors);
  const colors = palette.length / 3;
  for (let o = 0; o < cells.length; o += 4) {
    if (cells[o + 3] === 0) continue;
    let best = 0, bestDist = Infinity;
    for (let c = 0; c < colors; c++) {
      const d = colorDistance(cells[o], cells[o + 1], cells[o + 2], palette[c * 3], palette[c * 3 + 1], palette[c * 3 + 2]);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    cells[o] = palette[best * 3];
    cells[o + 1] = palette[best * 3 + 1];
    cells[o + 2] = palette[best * 3 + 2];
  }

  // Sprite outline: opaque cells that touch empty space become ink.
  const outline = new Uint8Array(cols * rows);
  const empty = (cx, cy) => cx < 0 || cy < 0 || cx >= cols || cy >= rows || cells[(cy * cols + cx) * 4 + 3] === 0;
  let anyEmpty = false;
  for (let o = 3; o < cells.length; o += 4) if (cells[o] === 0) { anyEmpty = true; break; }
  if (anyEmpty) {
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        if (empty(cx, cy)) continue;
        if (empty(cx - 1, cy) || empty(cx + 1, cy) || empty(cx, cy - 1) || empty(cx, cy + 1)) outline[cy * cols + cx] = 1;
      }
    }
  }

  for (let y = 0; y < height; y++) {
    const cy = Math.floor(y / block);
    for (let x = 0; x < width; x++) {
      const c = cy * cols + Math.floor(x / block);
      const o = c * 4;
      const i = (y * width + x) * 4;
      if (outline[c]) {
        data[i] = style.ink[0];
        data[i + 1] = style.ink[1];
        data[i + 2] = style.ink[2];
        data[i + 3] = 255;
      } else {
        data[i] = cells[o];
        data[i + 1] = cells[o + 1];
        data[i + 2] = cells[o + 2];
        data[i + 3] = cells[o + 3];
      }
    }
  }
}

/**
 * Applies an anime cel-shading look in place.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} img
 * @param {string} [styleName] a key of `TOON_STYLES`
 * @param {Object} [options]
 * @param {number} [options.strength=1] 0..1 blend between the photo and the effect
 */
export function animeFilter(img, styleName = DEFAULT_TOON_STYLE, options = {}) {
  const style = TOON_STYLES[styleName] || TOON_STYLES[DEFAULT_TOON_STYLE];
  const strength = clamp(options.strength ?? 1, 0, 1);
  if (strength === 0) return img;
  const { data, width, height } = img;
  const original = strength < 1 ? new Uint8ClampedArray(data) : null;

  if (style.pixel) {
    pixelArt(img, style);
  } else {
    surfaceBlur(data, width, height, style.smooth.passes, style.smooth.sigma);
    const edges = inkEdges(data, width, height, style.line);
    const bands = style.levels - 1;
    const [inkR, inkG, inkB] = style.ink;
    const cell = Math.max(4, Math.round(Math.max(width, height) / 96));

    for (let y = 0, p = 0; y < height; y++) {
      for (let x = 0; x < width; x++, p++) {
        const i = p * 4;
        if (data[i + 3] < 16) continue;
        let r = data[i], g = data[i + 1], b = data[i + 2];

        // Tone: brightness and contrast first, so banding lands where the
        // style wants its shadows.
        r = (r - 128) * style.contrast + 128;
        g = (g - 128) * style.contrast + 128;
        b = (b - 128) * style.contrast + 128;
        r *= style.brightness;
        g *= style.brightness;
        b *= style.brightness;

        // Cel shading: snap brightness to a few flat bands with a soft step.
        const lum = clamp((r * 77 + g * 150 + b * 29) / 256, 0, 255);
        const v = (lum / 255) * bands;
        const base = Math.floor(v);
        const banded = ((base + smoothstep(0.38, 0.62, v - base)) / bands) * 255;

        if (style.halftone) {
          // Manga: black, two densities of screentone dots, paper white.
          const band = Math.round((banded / 255) * bands);
          let ink = band === 0 ? 1 : 0;
          if (band === 1 || band === 2) {
            const u = (x + y) * 0.7071;
            const w = (x - y) * 0.7071;
            const du = u - Math.floor(u / cell) * cell - cell / 2;
            const dw = w - Math.floor(w / cell) * cell - cell / 2;
            const radius = cell * (band === 1 ? 0.42 : 0.26);
            ink = 1 - smoothstep(radius - 0.7, radius + 0.7, Math.sqrt(du * du + dw * dw));
          }
          r = g = b = 250 - ink * 232;
        } else {
          if (lum > 24) {
            const scale = banded / lum;
            r *= scale;
            g *= scale;
            b *= scale;
          } else {
            const shift = banded - lum;
            r += shift;
            g += shift;
            b += shift;
          }
          const mean = (r + g + b) / 3;
          r = mean + (r - mean) * style.saturation;
          g = mean + (g - mean) * style.saturation;
          b = mean + (b - mean) * style.saturation;

          if (style.tint) {
            const t = banded / 255;
            const { shadow, highlight, mix } = style.tint;
            r += (shadow[0] + (highlight[0] - shadow[0]) * t - r) * mix;
            g += (shadow[1] + (highlight[1] - shadow[1]) * t - g) * mix;
            b += (shadow[2] + (highlight[2] - shadow[2]) * t - b) * mix;
          }
          if (style.pastel) {
            r += (255 - r) * style.pastel;
            g += (255 - g) * style.pastel;
            b += (255 - b) * style.pastel;
          }
          if (style.grain) {
            const n = hashNoise(x, y) * style.grain;
            r += n;
            g += n;
            b += n;
          }
        }

        // Ink outlines on top.
        const e = edges[p] * style.line.strength;
        data[i] = clamp(r + (inkR - r) * e, 0, 255);
        data[i + 1] = clamp(g + (inkG - g) * e, 0, 255);
        data[i + 2] = clamp(b + (inkB - b) * e, 0, 255);
      }
    }
  }

  if (original) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = original[i] + (data[i] - original[i]) * strength;
      data[i + 1] = original[i + 1] + (data[i + 1] - original[i + 1]) * strength;
      data[i + 2] = original[i + 2] + (data[i + 2] - original[i + 2]) * strength;
      data[i + 3] = original[i + 3] + (data[i + 3] - original[i + 3]) * strength;
    }
  }
  return img;
}

// ---------------------------------------------------------------------------
// Canvas helpers (browser only)
// ---------------------------------------------------------------------------

export function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/**
 * Loads an image so its pixels can be read back. Remote images are requested
 * with CORS; if the host refuses, they are re-fetched as a blob.
 * @param {string|Blob} src URL, data URL or Blob/File
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  const fromUrl = (url, cors) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      if (cors) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load that image.'));
      img.src = url;
    });

  if (typeof src !== 'string') {
    const url = URL.createObjectURL(src);
    return fromUrl(url, false).finally(() => URL.revokeObjectURL(url));
  }
  if (src.startsWith('data:') || src.startsWith('blob:')) return fromUrl(src, false);
  return fromUrl(src, true).catch(async () => {
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) throw new Error('Could not load that image.');
    const url = URL.createObjectURL(await res.blob());
    return fromUrl(url, false).finally(() => URL.revokeObjectURL(url));
  });
}

/** Draws any image source onto a new canvas, shrinking it to fit `maxSize`. */
export function toCanvas(source, maxSize = Infinity) {
  const sw = source.naturalWidth || source.videoWidth || source.width;
  const sh = source.naturalHeight || source.videoHeight || source.height;
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const canvas = createCanvas(sw * scale, sh * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Crops a canvas down to its visible pixels. */
export function trimCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const bounds = alphaBounds(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (!bounds) return canvas;
  const out = createCanvas(bounds.width, bounds.height);
  out.getContext('2d').drawImage(canvas, -bounds.x, -bounds.y);
  return out;
}

/**
 * Centre-crops a canvas into a simple sticker shape.
 * @param {'circle'|'rounded'|'square'} shape
 */
export function shapeCut(source, shape = 'rounded') {
  const side = Math.min(source.width, source.height);
  const out = createCanvas(side, side);
  const ctx = out.getContext('2d');
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2);
  } else {
    const radius = shape === 'rounded' ? side * 0.16 : 0;
    ctx.roundRect(0, 0, side, side, radius);
  }
  ctx.clip();
  ctx.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, side, side);
  return out;
}

export const BORDER_STYLES = {
  white: { label: 'Classic White', fill: '#ffffff', glow: null },
  holo: { label: 'Holo Rainbow', fill: 'holo', glow: 'rgba(168, 85, 247, 0.6)' },
  cyan: { label: 'Cyber Neon', fill: '#ffffff', glow: 'rgba(6, 182, 212, 0.9)' },
  pink: { label: 'Kawaii Pink', fill: '#ffffff', glow: 'rgba(236, 72, 153, 0.9)' },
  gold: { label: 'Gold Aura', fill: '#fff7d6', glow: 'rgba(234, 179, 8, 0.9)' },
  black: { label: 'Ink Black', fill: '#111114', glow: null },
};

/**
 * Renders a die-cut sticker: the subject, a border that hugs its outline and
 * a soft drop shadow, on a transparent square canvas.
 *
 * @param {HTMLCanvasElement} subject transparent-background artwork
 * @param {Object} [options]
 * @param {number} [options.size=512] output edge length
 * @param {number} [options.borderWidth=14] in output pixels; 0 for none
 * @param {keyof BORDER_STYLES} [options.borderStyle='white']
 * @param {boolean} [options.shadow=true]
 * @returns {HTMLCanvasElement}
 */
export function renderDieCut(subject, options = {}) {
  const size = options.size ?? 512;
  const borderWidth = Math.max(0, options.borderWidth ?? 14);
  const style = BORDER_STYLES[options.borderStyle] || BORDER_STYLES.white;
  const shadow = options.shadow ?? true;
  const glowPad = style.glow ? size * 0.045 : 0;
  const shadowPad = shadow ? size * 0.03 : 0;
  const margin = borderWidth + Math.max(glowPad, shadowPad) + 2;

  const avail = Math.max(8, size - margin * 2);
  const scale = Math.min(avail / subject.width, avail / subject.height);
  const dw = Math.max(1, Math.round(subject.width * scale));
  const dh = Math.max(1, Math.round(subject.height * scale));
  const dx = Math.round((size - dw) / 2);
  const dy = Math.round((size - dh) / 2 - (style.glow ? 0 : shadowPad * 0.35));

  const out = createCanvas(size, size);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  if (borderWidth > 0) {
    // A solid silhouette of the subject…
    const silhouette = createCanvas(size, size);
    const sctx = silhouette.getContext('2d');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(subject, dx, dy, dw, dh);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, size, size);

    // …stamped around three rings grows it outwards evenly, like a die line.
    const outline = createCanvas(size, size);
    const octx = outline.getContext('2d');
    for (const ring of [1, 0.66, 0.33]) {
      const radius = borderWidth * ring;
      const steps = clamp(Math.ceil((Math.PI * 2 * radius) / 2.5), 12, 56);
      for (let s = 0; s < steps; s++) {
        const angle = (s / steps) * Math.PI * 2;
        octx.drawImage(silhouette, Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
    }
    octx.drawImage(silhouette, 0, 0);

    octx.globalCompositeOperation = 'source-in';
    if (style.fill === 'holo') {
      const holo = octx.createLinearGradient(0, 0, size, size);
      holo.addColorStop(0, '#ff0080');
      holo.addColorStop(0.25, '#7928ca');
      holo.addColorStop(0.5, '#0070f3');
      holo.addColorStop(0.75, '#00dfd8');
      holo.addColorStop(1, '#ff0080');
      octx.fillStyle = holo;
    } else {
      octx.fillStyle = style.fill;
    }
    octx.fillRect(0, 0, size, size);

    ctx.save();
    if (style.glow) {
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = glowPad * 0.9;
    } else if (shadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.38)';
      ctx.shadowBlur = shadowPad * 0.8;
      ctx.shadowOffsetY = shadowPad * 0.45;
    }
    ctx.drawImage(outline, 0, 0);
    ctx.restore();
  }

  ctx.drawImage(subject, dx, dy, dw, dh);
  return out;
}

/** Encodes a sticker canvas compactly (WebP where supported, else PNG). */
export function canvasToStickerDataUrl(canvas, quality = 0.92) {
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}

/**
 * Turns any image into a die-cut sticker.
 *
 * @param {string|Blob|HTMLCanvasElement} src
 * @param {Object} [options]
 * @param {string|null} [options.toonStyle] apply this `TOON_STYLES` look
 * @param {number} [options.toonStrength=1]
 * @param {'auto'|'contour'|'circle'|'rounded'|'square'} [options.cut='auto']
 *        'auto' follows the subject when the background can be removed and
 *        falls back to a rounded card when it cannot
 * @param {number} [options.tolerance=34] background removal sensitivity
 * @param {Array<{x: number, y: number}>} [options.seeds] extra erase points,
 *        in 0..1 coordinates of the source image
 * @param {number} [options.borderWidth=14]
 * @param {string} [options.borderStyle='white']
 * @param {boolean} [options.shadow=true]
 * @param {number} [options.size=512]
 * @returns {Promise<{canvas: HTMLCanvasElement, dataUrl: string, cut: string, backgroundRemoved: boolean}>}
 */
export async function makeSticker(src, options = {}) {
  const { subject, cut, backgroundRemoved } = await extractSubject(src, options);
  const canvas = renderDieCut(subject, {
    size: options.size ?? 512,
    borderWidth: options.borderWidth ?? 14,
    borderStyle: options.borderStyle ?? 'white',
    shadow: options.shadow ?? true,
  });
  return { canvas, subject, dataUrl: canvasToStickerDataUrl(canvas), cut, backgroundRemoved };
}

/**
 * Isolates the artwork of an image: background removed and trimmed when
 * possible, otherwise cropped into the requested card shape.
 * Takes the same options as `makeSticker` (minus the border ones).
 * @returns {Promise<{subject: HTMLCanvasElement, cut: string, backgroundRemoved: boolean}>}
 */
export async function extractSubject(src, options = {}) {
  const cut = options.cut ?? 'auto';
  const source = src instanceof HTMLCanvasElement ? src : await loadImage(src);
  const work = toCanvas(source, options.workSize ?? 640);
  const ctx = work.getContext('2d', { willReadFrequently: true });
  let pixels;
  try {
    pixels = ctx.getImageData(0, 0, work.width, work.height);
  } catch {
    throw new Error('That image is protected by its host and cannot be edited. Download it and upload the file instead.');
  }

  let contour = hasTransparency(pixels);
  let backgroundRemoved = false;
  if (!contour && (cut === 'auto' || cut === 'contour')) {
    const backup = new Uint8ClampedArray(pixels.data);
    const seeds = (options.seeds || []).map((s) => ({ x: s.x * work.width, y: s.y * work.height }));
    const result = removeBackground(pixels, { tolerance: options.tolerance ?? 34, seeds });
    // Only trust the cut when the border really was one flat colour, a
    // sensible amount of subject is left, and it is still in one main piece
    // (a busy photo "cut" this way falls apart into fragments).
    const plausible =
      result.removedFraction > 0.04 &&
      result.removedFraction < 0.96 &&
      (result.confidence >= 0.75 || seeds.length > 0) &&
      largestPieceShare(pixels) >= 0.75;
    if (plausible || cut === 'contour') {
      contour = result.removedFraction < 0.995;
      backgroundRemoved = contour;
    }
    if (!contour) pixels.data.set(backup);
  }

  if (options.toonStyle) animeFilter(pixels, options.toonStyle, { strength: options.toonStrength ?? 1 });
  ctx.putImageData(pixels, 0, 0);

  const shape = contour && cut !== 'circle' && cut !== 'rounded' && cut !== 'square' ? 'contour' : cut === 'auto' || cut === 'contour' ? 'rounded' : cut;
  const subject = shape === 'contour' ? trimCanvas(work) : shapeCut(work, shape);
  return { subject, cut: shape, backgroundRemoved };
}

/** Scales a canvas down so its longest edge is at most `maxSize`. */
export function downscale(canvas, maxSize) {
  if (Math.max(canvas.width, canvas.height) <= maxSize) return canvas;
  return toCanvas(canvas, maxSize);
}

/**
 * Shrinks an uploaded photo before it is sent anywhere (callable payloads are
 * capped at 10 MB and the model doesn't need more than ~1 megapixel).
 * @returns {Promise<string>} JPEG data URL (PNG when the photo has transparency)
 */
export async function prepareReferencePhoto(src, maxSize = 1024) {
  const image = await loadImage(src);
  const canvas = toCanvas(image, maxSize);
  const pixels = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
  return hasTransparency(pixels, 0.001) ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
}

/** Converts any image source to a PNG Blob (for clipboard and downloads). */
export async function toPngBlob(src) {
  const canvas = src instanceof HTMLCanvasElement ? src : toCanvas(await loadImage(src));
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode PNG.'))), 'image/png')
  );
}
