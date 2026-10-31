// Scalable Vector Graphics (SVG) Die-Cut Exporter for AmiBuzz
// Generates commercial-grade SVG sticker containers with vector cutlines,
// holographic foil gradients, and scalable die-cut contours (Recraft-style).

/**
 * Builds a vector SVG string for an anime sticker.
 * @param {Object} options
 * @param {string} options.imgUrl Data URL or image src
 * @param {string} options.name Sticker title
 * @param {string} [options.borderType] 'white' | 'holo' | 'neon' | 'dashed'
 * @param {number} [options.borderWidth] Border stroke width
 * @param {string} [options.caption] Optional caption or Japanese SFX
 * @returns {string} SVG XML string
 */
export function generateStickerSvg({
  imgUrl,
  name = 'Anime Sticker',
  borderType = 'white',
  borderWidth = 14,
  caption = '',
}) {
  const size = 600;
  const pad = 36;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - pad * 2) / 2;

  // Define gradients and filters
  const defs = `
  <defs>
    <!-- Die-Cut Drop Shadow -->
    <filter id="stickerShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.45" />
    </filter>

    <!-- Holographic Prismatic Foil Gradient -->
    <linearGradient id="holoFoil" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff0080" />
      <stop offset="20%" stop-color="#7928ca" />
      <stop offset="40%" stop-color="#0070f3" />
      <stop offset="60%" stop-color="#00dfd8" />
      <stop offset="80%" stop-color="#f5a623" />
      <stop offset="100%" stop-color="#ff0080" />
    </linearGradient>

    <!-- Cyberpunk Neon Glow -->
    <linearGradient id="cyberNeon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#ec4899" />
    </linearGradient>

    <!-- Clip Path for Circular Artwork -->
    <clipPath id="circleClip">
      <circle cx="${cx}" cy="${cy}" r="${r - borderWidth / 2}" />
    </clipPath>
  </defs>
  `;

  let strokeColor = '#ffffff';
  let strokeDash = '';
  let filterAttr = 'filter="url(#stickerShadow)"';

  if (borderType === 'holo') {
    strokeColor = 'url(#holoFoil)';
  } else if (borderType === 'neon') {
    strokeColor = 'url(#cyberNeon)';
  } else if (borderType === 'dashed') {
    strokeColor = '#ffffff';
    strokeDash = 'stroke-dasharray="10 6"';
  }

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <title>${name} - AmiBuzz Anime Sticker</title>
  ${defs}

  <!-- Background Vector Die-Cut Outline -->
  <circle
    cx="${cx}"
    cy="${cy}"
    r="${r}"
    fill="#ffffff"
    stroke="${strokeColor}"
    stroke-width="${borderWidth}"
    ${strokeDash}
    ${filterAttr}
  />

  <!-- Embedded Image Artwork with Circular Clip -->
  <g clip-path="url(#circleClip)">
    <image
      href="${imgUrl}"
      x="${cx - r}"
      y="${cy - r}"
      width="${r * 2}"
      height="${r * 2}"
      preserveAspectRatio="xMidYMid slice"
    />
  </g>

  ${
    borderType === 'dashed'
      ? `
  <!-- Scissor Cut Marker -->
  <g transform="translate(${cx + r - 10}, ${cy - 10}) rotate(30)">
    <text font-size="18" fill="#e2e8f0" font-family="sans-serif">✂</text>
  </g>`
      : ''
  }

  ${
    caption
      ? `
  <!-- Anime Speech Ribbon -->
  <g transform="translate(${cx}, ${size - pad - 10})">
    <rect
      x="-110"
      y="-18"
      width="220"
      height="36"
      rx="18"
      fill="#ef4444"
      stroke="#ffffff"
      stroke-width="3"
      filter="url(#stickerShadow)"
    />
    <text
      x="0"
      y="6"
      text-anchor="middle"
      fill="#ffffff"
      font-size="16"
      font-weight="900"
      font-family="system-ui, -apple-system, sans-serif"
      letter-spacing="1.5"
    >
      ${caption}
    </text>
  </g>`
      : ''
  }
</svg>`;

  return svgContent;
}

/**
 * Downloads sticker as a scalable SVG file.
 * @param {Object} options
 */
export function downloadStickerSvg(options) {
  const svgText = generateStickerSvg(options);
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeName = (options.name || 'anime-sticker').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeName || 'amibuzz-sticker'}-vector.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
