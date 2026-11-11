// Elite Anime Art Styles, Preset Inspirations, Color Harmonies, and Manga SFX for AmiBuzz

export const ANIME_STYLES = [
  {
    id: 'makoto-shinkai',
    name: 'Makoto Shinkai',
    japanese: '新海誠スタイル',
    badge: 'Cinematic',
    desc: 'Luminous skies, breathtaking lighting, emotional realism, Your Name aesthetic.',
    color: '#38bdf8',
    img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80',
    promptSuffix: 'Makoto Shinkai anime style, CoMix Wave Films aesthetic, Your Name aesthetic, ethereal lighting, radiant sky reflections, volumetric sunbeams, warm color harmony, highly detailed anime portrait',
  },
  {
    id: 'modern-shonen',
    name: 'Modern Shonen',
    japanese: 'MAPPA風',
    badge: 'Hype',
    desc: 'Studio MAPPA & Jujutsu Kaisen aesthetic, sharp ink linework, dynamic cel shading.',
    color: '#ef4444',
    img: 'https://images.unsplash.com/photo-1541562232579-512a21360020?auto=format&fit=crop&w=400&q=80',
    promptSuffix: 'modern shonen anime illustration, Studio MAPPA style, Jujutsu Kaisen aesthetic, crisp dynamic lines, sharp cel shading, vibrant colors, anime character portrait',
  },
  {
    id: 'pastel-shoujo',
    name: 'Pastel Shoujo',
    japanese: '京アニ風',
    badge: 'Aesthetic',
    desc: 'Kyoto Animation & K-On charm, soft glowing eyes, delicate hair strands, pastel warmth.',
    color: '#f472b6',
    img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&q=80',
    promptSuffix: 'Kyoto Animation style, Violet Evergarden aesthetic, soft glowing anime eyes, delicate hair strands, pastel cherry blossom tones, dreamy ethereal lighting',
  },
  {
    id: 'chibi-kawaii',
    name: 'Kawaii Chibi',
    japanese: 'ちびカワイイ',
    badge: 'Popular',
    desc: 'Oversized head, sparkling eyes, blush stickers, cute proportions.',
    color: '#ec4899',
    img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&q=80',
    promptSuffix: 'chibi anime sticker, oversized head, giant sparkling expressive anime eyes, rosy blush stickers, soft pastel coloring, thick crisp white die-cut contour border, isolated on clean background, vector sticker illustration',
  },
  {
    id: 'cyberpunk-mecha',
    name: 'Cyberpunk Neon',
    japanese: 'サイバーパンク',
    badge: 'Trending',
    desc: 'Futuristic visor, glowing circuits, holographic neon accents.',
    color: '#06b6d4',
    img: 'https://images.unsplash.com/photo-1580477667995-2b94f01c9516?auto=format&fit=crop&w=400&q=80',
    promptSuffix: 'cyberpunk anime sticker, futuristic glowing neon cyan and magenta circuitry, cyber visor, holographic accents, bold crisp lineart, high contrast cel shading, white sticker outline border, isolated vector style',
  },
  {
    id: 'shonen-battle',
    name: 'Shonen Battle',
    japanese: '少年バトル',
    badge: 'Action',
    desc: 'Dynamic action ink, glowing energy aura, intense battle expressions.',
    color: '#f97316',
    img: 'https://images.unsplash.com/photo-1541562232579-512a21360020?auto=format&fit=crop&w=400&q=80',
    promptSuffix: 'shonen anime action sticker, dynamic fighting pose, dramatic ink linework, glowing energy aura, intense emotion, vibrant cel shaded colors, bold white die-cut sticker outline, isolated subject',
  },
  {
    id: 'retro-90s',
    name: 'Retro 90s Cel',
    japanese: '90年代レトロ',
    badge: 'Classic',
    desc: 'Vintage hand-painted cel animation look with golden-age charm.',
    color: '#f59e0b',
    img: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=400&q=80',
    promptSuffix: 'vintage 1990s anime sticker, classic hand-painted cel animation style, nostalgic warm palette, bold retro anime outlines, white die-cut border, clean sticker aesthetic',
  },
  {
    id: 'ghibli-watercolor',
    name: 'Studio Watercolor',
    japanese: 'スタジオ水彩',
    badge: 'Peaceful',
    desc: 'Gentle painterly watercolor washes, serene lighting, whimsical vibes.',
    color: '#10b981',
    img: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?auto=format&fit=crop&w=400&q=80',
    promptSuffix: 'whimsical watercolor anime sticker, Ghibli inspired, soft gentle painterly brushstrokes, dreamy serene lighting, handcrafted feel, crisp white sticker boundary',
  },
  {
    id: 'manga-screentone',
    name: 'Manga Screentone',
    japanese: '漫画インク',
    badge: 'Comic',
    desc: 'High-contrast black & white ink, halftone dots, speed lines.',
    color: '#94a3b8',
    img: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?auto=format&fit=crop&w=400&q=80',
    promptSuffix: 'manga comic sticker, high contrast black and white lineart, authentic halftone screentone patterns, dramatic speed lines, crisp white sticker border',
  },
  {
    id: 'dark-fantasy',
    name: 'Dark Fantasy',
    japanese: 'ダークファンタジー',
    badge: 'Mystic',
    desc: 'Solo Leveling manhwa style, glowing ethereal runes, shadow auras.',
    color: '#a855f7',
    img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80',
    promptSuffix: 'dark fantasy anime sticker, Solo Leveling manhwa style, glowing mystical runes, ethereal violet and blue flames, ornate cel shading, crisp white sticker die-cut',
  },
  {
    id: 'pixel-arcade',
    name: '16-Bit Pixel',
    japanese: 'ピクセルアート',
    badge: 'Arcade',
    desc: 'Crisp nostalgic arcade sprite with vibrant 16-bit color palette.',
    color: '#e11d48',
    img: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
    promptSuffix: '16-bit pixel art anime sticker, crisp nostalgic arcade sprite, clean pixel contours, vibrant pixel palette, thick white sticker border outline',
  },
];

// Color Harmonies & Mood Locking (Recraft-style)
export const COLOR_HARMONIES = [
  {
    id: 'vibrant',
    name: 'Vibrant Pop',
    desc: 'Rich saturated anime palette',
    colors: ['#ef4444', '#3b82f6', '#eab308'],
    promptClause: 'saturated vibrant anime colors, punchy contrast, crisp highlights',
  },
  {
    id: 'pastel',
    name: 'Kawaii Pastel',
    desc: 'Soft strawberry, mint & lavender',
    colors: ['#f472b6', '#a7f3d0', '#c084fc'],
    promptClause: 'soft pastel anime palette, dreamy lavender and strawberry tones, gentle aesthetic',
  },
  {
    id: 'cyber',
    name: 'Cyber Neon',
    desc: 'Electric cyan & neon magenta',
    colors: ['#06b6d4', '#ec4899', '#8b5cf6'],
    promptClause: 'cyberpunk neon lighting, glowing cyan and electric magenta accents, synthwave aesthetic',
  },
  {
    id: 'sunset',
    name: 'Sunset Warmth',
    desc: 'Amber, peach & golden hour',
    colors: ['#f97316', '#fb7185', '#fbbf24'],
    promptClause: 'golden hour anime warmth, amber and peach highlights, radiant glow',
  },
  {
    id: 'monochrome',
    name: 'Manga Noir',
    desc: 'Deep ink, silver & pure white',
    colors: ['#1e293b', '#64748b', '#f8fafc'],
    promptClause: 'monochrome manga ink style, pure black and silver tones, clean graphic contrast',
  },
  {
    id: 'sakura',
    name: 'Sakura Mist',
    desc: 'Cherry blossom & soft jade',
    colors: ['#fbcfe8', '#f43f5e', '#6ee7b7'],
    promptClause: 'cherry blossom sakura pinks, delicate petals, fresh spring aesthetic',
  },
];

// 4-Sticker Character Emotion Matrix Presets (Picsart / Midjourney style)
export const EMOTION_MATRIX_PRESETS = [
  {
    id: 'happy',
    label: 'Sugoi Happy',
    icon: '✨',
    japanese: 'キラキラ',
    promptModifier: 'radiant happy smiling anime expression, sparkling joyful eyes, blush marks, celebratory aura',
  },
  {
    id: 'tsundere',
    label: 'Tsundere Pout',
    icon: '💢',
    japanese: 'ツンデレ',
    promptModifier: 'cute tsundere pout expression, arms crossed, flustered blushing cheeks, tiny anime anger mark, feisty look',
  },
  {
    id: 'shock',
    label: 'Comedic Shock',
    icon: '💧',
    japanese: 'ガーン',
    promptModifier: 'comedic overdramatic anime shock expression, giant blue sweatdrop, wide eyes, funny disbelief',
  },
  {
    id: 'victory',
    label: 'Victory Peace',
    icon: '✌️',
    japanese: 'やったー',
    promptModifier: 'enthusiastic victory peace sign pose, playful winking eye, confident triumphant anime smile, star sparkles',
  },
];

// Manga SFX Onomatopoeia & Badges
export const MANGA_SFX_STAMPS = [
  { id: 'sfx_menacing', text: 'ドドド', label: 'Menacing (JoJo)', category: 'sfx' },
  { id: 'sfx_rumble', text: 'ゴゴゴ', label: 'Ominous Rumble', category: 'sfx' },
  { id: 'sfx_sparkle', text: 'キラキラ', label: 'Radiant Sparkle', category: 'sfx' },
  { id: 'sfx_heartbeat', text: 'ドキドキ', label: 'Heart Throb', category: 'sfx' },
  { id: 'sfx_yay', text: 'わーい！', label: 'Pure Joy', category: 'sfx' },
  { id: 'sfx_bam', text: 'バーン！', label: 'Dynamic Entrance', category: 'sfx' },
  { id: 'word_sugoi', text: 'SUGOI!', label: 'Amazing!', category: 'badge' },
  { id: 'word_nani', text: 'NANI?!', label: 'What?!', category: 'badge' },
  { id: 'word_baka', text: 'BAKA!', label: 'Idiot!', category: 'badge' },
  { id: 'word_gambare', text: 'GAMBARE!', label: 'Do Your Best!', category: 'badge' },
  { id: 'word_senpai', text: 'SENPAI!', label: 'Notice Me!', category: 'badge' },
  { id: 'word_ggez', text: 'GG EZ', label: 'Gamer Victory', category: 'badge' },
];

export const INSPIRATION_PROMPTS = [
  'A grumpy Shiba Inu wearing a pink samurai kimono eating strawberry mochi',
  'Chibi kitsune nine-tailed fox priestess summoning glowing blue spirit fireballs',
  'Cyberpunk cat hacker with holographic neon goggles typing on a glowing deck',
  'Anime gamer girl with bunny ear RGB headset slurping giant bowl of ramen',
  'Tiny angry dragon sitting inside a cozy ceramic teacup blowing smoke rings',
  'Mecha anime pilot girl holding a golden trophy with victory peace sign',
  'Sleepy panda monk meditating on a floating cloud surrounded by cherry blossoms',
  'Tsundere catgirl maid crossing her arms with a pout and cute anger mark',
  'Neon samurai slicing a digital neon watermelon in half with lightning sword',
  'Cute ghost barista pouring latte art into a mug with floating star sparkles',
  'Magical girl bunny with angelic wings holding a star wand casting pastel magic',
  'Retro 90s cyber courier girl riding a hovering delivery scooter with noodles',
];

export const QUICK_TAG_CATEGORIES = [
  {
    category: 'Emotions',
    tags: [
      '✨ Sugoi Sparkle',
      '💢 Tsundere Pout',
      '💧 Clueless Sweatdrop',
      '💖 Heart Eyes',
      '😎 Smug Grin',
      '😭 Anime Crying',
      '😴 Sleepy Zzz',
    ],
  },
  {
    category: 'Characters',
    tags: [
      'Fox Kitsune',
      'Catgirl (Neko)',
      'Cyber Samurai',
      'Mecha Pilot',
      'Boba Bear',
      'Dragon Tamer',
      'Astronaut Penguin',
      'Magical Bunny',
    ],
  },
  {
    category: 'Accessories',
    tags: [
      'RGB Gaming Headset',
      'Giant Steaming Ramen',
      'Foxfire Orbs',
      'Samurai Katana',
      'Cherry Blossoms',
      'Cyber Visor',
      'Boba Tea Cup',
      'Star Wand',
    ],
  },
  {
    category: 'Manga SFX',
    tags: [
      'ドドド (Menacing)',
      'ゴゴゴ (Ominous)',
      'キラキラ (Sparkle)',
      'ドキドキ (Heartbeat)',
      'バーン (BAM!)',
      'わーい (Yay!)',
    ],
  },
];

// Aesthetic Canvas Backgrounds
export const CANVA_BACKGROUNDS = [
  { id: 'white', name: 'Pure White (Sticker)', type: 'solid', color: '#ffffff' },
  { id: 'transparent', name: 'Transparent Checker', type: 'transparent' },
  { id: 'tokyo', name: 'Shinjuku Neon Rain', type: 'image', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80' },
  { id: 'sakura', name: 'Cherry Blossom Lane', type: 'image', url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=1200&q=80' },
  { id: 'rooftop', name: 'Sunset School Rooftop', type: 'image', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80' },
  { id: 'cyberpunk', name: 'Cyberpunk Alley', type: 'image', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80' },
  { id: 'shrine', name: 'Torii Gate Shrine', type: 'image', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80' },
  { id: 'cosmos', name: 'Celestial Galaxy', type: 'image', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80' },
  { id: 'gradient_synth', name: 'Synthwave Gradient', type: 'gradient', gradient: 'linear-gradient(135deg, #180929 0%, #3b0764 50%, #0369a1 100%)' },
  { id: 'gradient_pastel', name: 'Pastel Dream', type: 'gradient', gradient: 'linear-gradient(135deg, #fce7f3 0%, #ede9fe 50%, #e0f2fe 100%)' },
];

export const ANIME_GLASSES_PRESETS = [
  { id: 'glasses', label: 'Classic Glasses', icon: '👓', desc: 'Stylish black rectangular frames' },
  { id: 'wireframe', label: 'Wireframe Gold', icon: '✨', desc: 'Refined intellectual gold round frames' },
  { id: 'glowing', label: 'Glowing Anime Glint', icon: '✧', desc: 'Iconic anime tactical glasses reflection' },
  { id: 'sunglasses', label: 'Cool Shades', icon: '🕶️', desc: 'Tinted dark anime sunglasses' },
  { id: 'none', label: 'No Glasses', icon: '👤', desc: 'Clear unobstructed anime face' },
];

export const ANIME_HAIR_COLORS = [
  { id: 'natural', label: 'Natural Match', color: '#18181b' },
  { id: 'silver', label: 'Silver White', color: '#e2e8f0' },
  { id: 'blonde', label: 'Golden Blonde', color: '#facc15' },
  { id: 'pink', label: 'Sakura Pink', color: '#f472b6' },
  { id: 'cyan', label: 'Electric Cyan', color: '#38bdf8' },
  { id: 'crimson', label: 'Fiery Crimson', color: '#ef4444' },
  { id: 'violet', label: 'Neon Violet', color: '#a855f7' },
];

export const ANIME_AURAS = [
  { id: 'none', label: 'No Aura', icon: '⚪' },
  { id: 'gold', label: 'Super Saiyan Gold', icon: '🔥' },
  { id: 'blue', label: 'Spirit Blue Flame', icon: '⚡' },
  { id: 'sakura', label: 'Sakura Petal Storm', icon: '🌸' },
  { id: 'neon', label: 'Cyber Glitch Grid', icon: '🌐' },
  { id: 'menacing', label: 'Menacing (ゴゴゴ)', icon: '🟣' },
  { id: 'sparkles', label: 'Radiant Sparkles', icon: '✨' },
];

// Sample test photos including the user's tie & glasses avatar from Canva!
export const SAMPLE_PORTRAITS = [
  {
    id: 'sample_canva_pro',
    label: 'Formal with Tie & Glasses (Reference)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    promptHint: 'Young professional man with black hair, stylish glasses, collared shirt and striped necktie',
  },
  {
    id: 'sample_student',
    label: 'Anime Protagonist Girl',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    promptHint: 'Young woman with brown hair, gentle smile, casual aesthetic outfit',
  },
  {
    id: 'sample_urban',
    label: 'Urban Streetwear',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    promptHint: 'Young man with stylish haircut, confident smirk, trendy black hoodie',
  },
];

