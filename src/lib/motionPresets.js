// Animation + frame rendering shared by the GIF Lab preview and its exports.
//
// Every preset is a pure function of the loop phase `t` (0..1), so the live
// preview and the exported file are drawn by exactly the same code, and every
// loop closes seamlessly. Anything "random" is seeded by the frame number.

export const MOTION_PRESETS = [
  { id: 'bounce', name: 'Kawaii Bounce', desc: 'Squash & stretch hop' },
  { id: 'float', name: 'Floating Magic', desc: 'Gentle bob with sparkles' },
  { id: 'shake', name: 'Rage Shake', desc: 'Battle tremor & speed lines' },
  { id: 'heartbeat', name: 'Heartbeat Pulse', desc: 'Double-thump throb' },
  { id: 'wiggle', name: 'Playful Wiggle', desc: 'Side-to-side sway' },
  { id: 'glitch', name: 'Neon Glitch', desc: 'Chromatic slice flicker' },
  { id: 'flip', name: '3D Coin Flip', desc: 'Spins on its vertical axis' },
  { id: 'sakura', name: 'Sakura Drift', desc: 'Falling cherry petals' },
  { id: 'spin', name: 'Full Spin', desc: 'One smooth rotation' },
  { id: 'zoom', name: 'Zoom Pulse', desc: 'Breathes in and out' },
  { id: 'jelly', name: 'Jelly Wobble', desc: 'Elastic wibble-wobble' },
  { id: 'pop', name: 'Pop In', desc: 'Springs in, then out' },
  { id: 'tada', name: 'Ta-da!', desc: 'Grow, rattle, settle' },
  { id: 'swing', name: 'Charm Swing', desc: 'Hangs and swings' },
  { id: 'slide', name: 'Slide Through', desc: 'Whooshes across' },
  { id: 'rainbow', name: 'Rainbow Shift', desc: 'Cycles through hues' },
  { id: 'party', name: 'Party Mode', desc: 'Hue cycle, hop & confetti' },
  { id: 'none', name: 'Hold Still', desc: 'No motion (caption only)' },
];

const TAU = Math.PI * 2;

/** Small seeded PRNG so "random" motion is identical in preview and export. */
function seeded(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let v = Math.imul(s ^ (s >>> 15), 1 | s);
    v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

const easeOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

function star(ctx, x, y, r, color, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const radius = i % 2 === 0 ? r : r * 0.32;
    ctx.lineTo(Math.cos((i / 8) * TAU - Math.PI / 2) * radius, Math.sin((i / 8) * TAU - Math.PI / 2) * radius);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function petal(ctx, x, y, size, rotation, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.9, -size * 0.6, size * 0.7, size * 0.7, 0, size);
  ctx.bezierCurveTo(-size * 0.7, size * 0.7, -size * 0.9, -size * 0.6, 0, -size);
  ctx.fill();
  ctx.restore();
}

/**
 * Draws one frame of an animated still.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource & {width: number, height: number}} image
 * @param {number} t loop phase, 0..1
 * @param {string} presetId one of MOTION_PRESETS
 * @param {Object} frame
 * @param {number} frame.width canvas width
 * @param {number} frame.height canvas height
 * @param {number} [frame.frameIndex=0]
 * @param {string} [frame.filter] extra CSS filter applied to the image
 */
export function drawMotionFrame(ctx, image, t, presetId, frame) {
  const { width, height } = frame;
  const frameIndex = frame.frameIndex ?? 0;
  const wave = Math.sin(t * TAU);
  const cx = width / 2;
  const cy = height / 2;

  // Fit the artwork into a box that leaves room for the motion.
  const box = Math.min(width, height) * (presetId === 'none' ? 0.92 : 0.72);
  const fit = Math.min(box / image.width, box / image.height);
  const dw = image.width * fit;
  const dh = image.height * fit;

  let filter = frame.filter && frame.filter !== 'none' ? frame.filter : '';
  let alpha = 1;

  ctx.save();
  ctx.translate(cx, cy);

  switch (presetId) {
    case 'bounce':
      ctx.translate(0, -Math.abs(wave) * height * 0.09 + height * 0.04);
      ctx.scale(1 + (1 - Math.abs(wave)) * 0.1, 1 - (1 - Math.abs(wave)) * 0.1);
      break;
    case 'float':
      ctx.translate(0, wave * height * 0.045);
      ctx.rotate(Math.sin(t * TAU + 0.6) * 0.05);
      break;
    case 'shake': {
      const rand = seeded(frameIndex + 1);
      ctx.translate((rand() - 0.5) * width * 0.05, (rand() - 0.5) * height * 0.05);
      ctx.rotate((rand() - 0.5) * 0.05);
      break;
    }
    case 'heartbeat': {
      let pulse = 1;
      if (t < 0.22) pulse = 1 + Math.sin((t / 0.22) * Math.PI) * 0.14;
      else if (t < 0.44) pulse = 1 + Math.sin(((t - 0.22) / 0.22) * Math.PI) * 0.07;
      ctx.scale(pulse, pulse);
      break;
    }
    case 'wiggle':
      ctx.rotate(wave * 0.16);
      break;
    case 'flip':
      ctx.scale(Math.cos(t * TAU) || 0.001, 1);
      break;
    case 'sakura':
      ctx.translate(0, wave * height * 0.03);
      ctx.rotate(wave * 0.03);
      break;
    case 'spin':
      ctx.rotate(t * TAU);
      break;
    case 'zoom':
      ctx.scale(1 + wave * 0.13, 1 + wave * 0.13);
      break;
    case 'jelly':
      ctx.transform(1 + wave * 0.1, 0, Math.sin(t * TAU * 2) * 0.08, 1 - wave * 0.1, 0, 0);
      break;
    case 'pop': {
      // in (0-35%), hold, out (85-100%)
      let s = 1;
      if (t < 0.35) s = Math.max(0.001, easeOutBack(t / 0.35));
      else if (t > 0.85) s = Math.max(0.001, 1 - Math.pow((t - 0.85) / 0.15, 2));
      ctx.scale(s, s);
      break;
    }
    case 'tada': {
      const grow = t < 0.15 ? 1 - (t / 0.15) * 0.08 : t < 0.85 ? 1.1 : 1.1 - ((t - 0.85) / 0.15) * 0.1;
      const rattle = t > 0.15 && t < 0.85 ? Math.sin(((t - 0.15) / 0.7) * TAU * 3) * 0.09 : 0;
      ctx.scale(grow, grow);
      ctx.rotate(rattle);
      break;
    }
    case 'swing':
      ctx.translate(0, -dh / 2);
      ctx.rotate(wave * 0.22);
      ctx.translate(0, dh / 2);
      break;
    case 'slide': {
      const span = width / 2 + dw / 2;
      let x = 0;
      if (t < 0.25) x = -span * (1 - easeOutBack(t / 0.25) * 1) ;
      else if (t > 0.75) x = span * Math.pow((t - 0.75) / 0.25, 2);
      ctx.translate(x, 0);
      break;
    }
    case 'rainbow':
      filter = `${filter} hue-rotate(${Math.round(t * 360)}deg)`;
      break;
    case 'party':
      filter = `${filter} hue-rotate(${Math.round(t * 360)}deg) saturate(1.3)`;
      ctx.translate(0, -Math.abs(Math.sin(t * TAU * 2)) * height * 0.06 + height * 0.03);
      ctx.rotate(Math.sin(t * TAU * 2) * 0.08);
      break;
    case 'glitch':
    case 'none':
    default:
      break;
  }

  ctx.globalAlpha = alpha;
  if (filter.trim()) ctx.filter = filter.trim();

  if (presetId === 'glitch') {
    const rand = seeded(frameIndex + 7);
    const active = rand() < 0.45;
    if (active) {
      // Colour-fringed ghosts, then the image cut into shifted slices.
      const shift = (rand() - 0.5) * width * 0.06;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(image, -dw / 2 - Math.abs(shift) - 4, -dh / 2, dw, dh);
      ctx.drawImage(image, -dw / 2 + Math.abs(shift) + 4, -dh / 2, dw, dh);
      ctx.globalAlpha = 1;
      const slices = 6;
      for (let s = 0; s < slices; s++) {
        const offset = rand() < 0.5 ? (rand() - 0.5) * width * 0.12 : 0;
        ctx.drawImage(
          image,
          0, (image.height / slices) * s, image.width, image.height / slices,
          -dw / 2 + offset, -dh / 2 + (dh / slices) * s, dw, dh / slices + 0.5
        );
      }
    } else {
      ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
    }
  } else {
    ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
  }
  ctx.restore();

  // ---- Overlays, in canvas space ------------------------------------------
  const unit = Math.min(width, height);
  if (presetId === 'float') {
    const twinkle = (phase) => 0.6 + 0.4 * Math.sin(t * TAU + phase);
    star(ctx, cx - dw * 0.52, cy - dh * 0.36 + wave * unit * 0.02, unit * 0.045 * twinkle(0), '#fde047', t * TAU);
    star(ctx, cx + dw * 0.5, cy - dh * 0.28 - wave * unit * 0.02, unit * 0.055 * twinkle(2), '#f472b6', -t * TAU);
    star(ctx, cx + dw * 0.4, cy + dh * 0.42, unit * 0.035 * twinkle(4), '#67e8f9', t * TAU);
  } else if (presetId === 'sakura') {
    const rand = seeded(11);
    for (let i = 0; i < 9; i++) {
      const lane = rand();
      const speed = 1 + Math.floor(rand() * 2);
      const phase = rand();
      const size = unit * (0.018 + rand() * 0.018);
      const fall = (t * speed + phase) % 1;
      const x = lane * width + Math.sin((fall + phase) * TAU) * unit * 0.05;
      const y = -size * 2 + fall * (height + size * 4);
      petal(ctx, x, y, size, (fall * speed + phase) * TAU, i % 2 ? '#f9a8d4' : '#fbcfe8');
    }
  } else if (presetId === 'shake') {
    const rand = seeded(frameIndex + 31);
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, unit * 0.008);
    for (let i = 0; i < 10; i++) {
      const angle = rand() * TAU;
      const inner = unit * (0.4 + rand() * 0.04);
      const outer = inner + unit * (0.04 + rand() * 0.06);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  } else if (presetId === 'heartbeat') {
    const beat = t < 0.44 ? Math.sin((t / 0.44) * Math.PI) : 0;
    if (beat > 0.05) {
      ctx.save();
      ctx.globalAlpha = beat * 0.9;
      ctx.fillStyle = '#fb7185';
      ctx.font = `${Math.round(unit * 0.09)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('♥', cx + dw * 0.46, cy - dh * 0.4 - beat * unit * 0.03);
      ctx.restore();
    }
  } else if (presetId === 'party') {
    const rand = seeded(5);
    const colors = ['#f43f5e', '#facc15', '#22d3ee', '#a78bfa', '#4ade80'];
    for (let i = 0; i < 16; i++) {
      const lane = rand();
      const phase = rand();
      const size = unit * (0.012 + rand() * 0.012);
      const fall = (t + phase) % 1;
      ctx.save();
      ctx.translate(lane * width, -size + fall * (height + size * 2));
      ctx.rotate((fall + phase) * TAU * 2);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(-size, -size * 0.5, size * 2, size);
      ctx.restore();
    }
  }
}

/**
 * Draws a clip frame into the output box.
 * @param {'cover'|'contain'} fit crop to fill, or letterbox
 */
export function drawClipFrame(ctx, source, { width, height, fit = 'cover', filter }) {
  const scale =
    fit === 'contain'
      ? Math.min(width / source.width, height / source.height)
      : Math.max(width / source.width, height / source.height);
  const dw = source.width * scale;
  const dh = source.height * scale;
  ctx.save();
  if (filter && filter !== 'none') ctx.filter = filter;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, (width - dw) / 2, (height - dh) / 2, dw, dh);
  ctx.restore();
}

export const CAPTION_COLORS = {
  white: { fill: '#ffffff', stroke: '#000000' },
  yellow: { fill: '#fde047', stroke: '#1c1917' },
  red: { fill: '#ef4444', stroke: '#ffffff' },
  cyan: { fill: '#22d3ee', stroke: '#083344' },
  pink: { fill: '#f472b6', stroke: '#500724' },
  black: { fill: '#111114', stroke: '#ffffff' },
};

/**
 * Draws a bold outlined caption that wraps and shrinks to fit the frame.
 * @param {{text: string, position: 'top'|'bottom', color: keyof CAPTION_COLORS, size: number}} caption
 *        `size` is a multiplier around 1
 */
export function drawCaption(ctx, width, height, caption) {
  const text = (caption?.text || '').trim();
  if (!text) return;
  const colors = CAPTION_COLORS[caption.color] || CAPTION_COLORS.white;
  const maxWidth = width * 0.92;
  let fontSize = Math.max(10, Math.min(width, height) * 0.115 * (caption.size || 1));
  const fontFor = (px) => `900 ${Math.round(px)}px Impact, "Arial Black", "Segoe UI Black", system-ui, sans-serif`;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';

  // Wrap on words; shrink until it fits in at most three lines.
  let lines = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    ctx.font = fontFor(fontSize);
    lines = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      lines.push(line);
    }
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= 3 && widest <= maxWidth) break;
    fontSize *= 0.88;
  }

  const lineHeight = fontSize * 1.08;
  const blockHeight = lineHeight * lines.length;
  const pad = height * 0.035;
  let y = caption.position === 'top' ? pad + fontSize * 0.9 : height - pad - blockHeight + fontSize * 0.9;

  ctx.lineWidth = Math.max(2, fontSize * 0.16);
  ctx.strokeStyle = colors.stroke;
  ctx.fillStyle = colors.fill;
  for (const line of lines) {
    ctx.strokeText(line, width / 2, y);
    ctx.fillText(line, width / 2, y);
    y += lineHeight;
  }
  ctx.restore();
}

/** Small corner mark for free-plan exports. */
export function drawWatermark(ctx, width, height) {
  ctx.save();
  const size = Math.max(9, Math.round(Math.min(width, height) * 0.038));
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = Math.max(2, size * 0.22);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineJoin = 'round';
  const x = width - size * 0.6;
  const y = height - size * 0.6;
  ctx.strokeText('AmiBuzz', x, y);
  ctx.fillText('AmiBuzz', x, y);
  ctx.restore();
}

/**
 * Applies trim, direction, speed and a frame-rate cap to a clip.
 *
 * @param {Array<{canvas: any, delay: number}>} frames
 * @param {Object} edit
 * @param {number} [edit.trimStart=0] first frame index
 * @param {number} [edit.trimEnd] last frame index (inclusive)
 * @param {'forward'|'reverse'|'boomerang'} [edit.direction='forward']
 * @param {number} [edit.speed=1]
 * @param {number} [edit.maxFps=50]
 * @returns {Array<{canvas: any, delay: number}>}
 */
export function buildSequence(frames, edit = {}) {
  if (!frames.length) return [];
  const start = Math.max(0, Math.min(frames.length - 1, edit.trimStart ?? 0));
  const end = Math.max(start, Math.min(frames.length - 1, edit.trimEnd ?? frames.length - 1));
  let seq = frames.slice(start, end + 1);

  if (edit.direction === 'reverse') {
    seq = seq.slice().reverse();
  } else if (edit.direction === 'boomerang' && seq.length > 2) {
    // There and back again, without showing the turning frames twice.
    seq = seq.concat(seq.slice(1, -1).reverse());
  }

  const speed = edit.speed || 1;
  const minDelay = 1000 / Math.min(50, edit.maxFps || 50);
  const out = [];
  let carried = 0;
  for (const frame of seq) {
    const delay = frame.delay / speed;
    if (out.length && carried < minDelay - 0.5) {
      // Too soon after the last kept frame: fold its time into that one.
      out[out.length - 1].delay += delay;
      carried += delay;
      continue;
    }
    out.push({ canvas: frame.canvas, delay });
    carried = delay;
  }
  return out;
}
