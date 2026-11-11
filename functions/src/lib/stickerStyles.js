// Server-side prompt vocabulary. Clients send style / colour / emotion ids;
// only these vetted clauses ever reach the model. Keep the keys in sync with
// src/lib/animeStyles.js.

const STYLE_CLAUSES = {
  'Kawaii Chibi':
    'chibi anime, oversized head with a small body, giant sparkling expressive eyes, rosy blush marks, soft pastel cel shading',
  'Cyberpunk Neon':
    'cyberpunk anime, glowing neon cyan and magenta accents, tech visor and circuitry details, high-contrast cel shading',
  'Shonen Battle':
    'shonen action anime, dynamic heroic pose, dramatic thick ink linework, glowing energy aura, intense expression',
  'Retro 90s Cel':
    'vintage 1990s cel anime, hand-painted cel look, warm nostalgic palette, classic retro anime outlines',
  'Studio Watercolor':
    'whimsical painterly anime, soft watercolour washes, gentle storybook lighting, delicate linework',
  'Manga Screentone':
    'black and white manga, crisp ink lineart, halftone screentone shading, high contrast',
  'Dark Fantasy':
    'dark fantasy anime, gothic outfit, glowing arcane runes, violet and crimson magical light, ornate details',
  '16-Bit Pixel':
    '16-bit pixel art anime sprite, crisp visible pixels, limited vibrant retro palette, clean pixel outline',
};

const COLOR_CLAUSES = {
  vibrant: 'saturated vibrant colours with punchy contrast',
  pastel: 'soft pastel strawberry, mint and lavender tones',
  cyber: 'electric cyan, neon magenta and violet',
  sunset: 'warm amber, peach and golden-hour tones',
  monochrome: 'monochrome ink black, silver and white',
  sakura: 'cherry-blossom pinks with fresh jade accents',
};

const EMOTIONS = [
  { id: 'happy', clause: 'radiant happy smile, sparkling joyful eyes, blush marks, celebrating' },
  { id: 'tsundere', clause: 'tsundere pout, arms crossed, flustered blushing cheeks, small anime anger mark' },
  { id: 'shock', clause: 'comedic over-the-top shock, wide eyes, big blue anime sweat drop' },
  { id: 'victory', clause: 'victory peace sign, playful wink, confident triumphant grin' },
];

module.exports = { STYLE_CLAUSES, COLOR_CLAUSES, EMOTIONS };
