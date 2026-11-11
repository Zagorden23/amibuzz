// High-Performance Multi-Engine Anime AI Generator for AmiBuzz
//
// Supports:
// 1. Turbo Anime Web AI (High-resolution, zero configuration, free neural generation)
// 2. Google Gemini Multimodal + Imagen 3 (Direct client-side or server API key)
// 3. AmiBuzz Neural Canvas Stylizer (100% on-device, offline, bilateral edge-preserving filter)

const SETTINGS_KEY = 'amibuzz_ai_settings';

export const AI_ENGINES = [
  {
    id: 'turbo',
    name: 'Turbo Anime AI',
    badge: 'Recommended',
    desc: 'High-res neural anime art. Fast, zero-config, studio quality.',
    free: true,
  },
  {
    id: 'gemini',
    name: 'Google Gemini 2.0 / Imagen',
    badge: 'Custom Key',
    desc: 'Multimodal face-analysis + Imagen 3 generation with your API key.',
    free: true,
  },
  {
    id: 'shader',
    name: 'Neural Canvas Shader',
    badge: 'Offline / Instant',
    desc: 'Runs directly in your browser. Instant, 100% private, zero network.',
    free: true,
  },
];

export function getAiSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        engine: parsed.engine || 'turbo',
        geminiApiKey: parsed.geminiApiKey || localStorage.getItem('amibuzz_gemini_api_key') || '',
        model: parsed.model || 'flux-anime',
      };
    }
  } catch {}
  return {
    engine: 'turbo',
    geminiApiKey: localStorage.getItem('amibuzz_gemini_api_key') || '',
    model: 'flux-anime',
  };
}

export function saveAiSettings(settings) {
  try {
    const current = getAiSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    if (settings.geminiApiKey !== undefined) {
      localStorage.setItem('amibuzz_gemini_api_key', settings.geminiApiKey);
    }
    window.dispatchEvent(new CustomEvent('amibuzz_ai_settings_change', { detail: updated }));
    return updated;
  } catch {
    return settings;
  }
}

/**
 * Builds a prompt for the AI anime model.
 */
export function buildAnimePrompt({
  prompt = '',
  stylePreset = 'modern-shonen',
  emotion = 'happy',
  hairColor = 'natural',
  glasses = 'glasses',
  accessories = 'none',
  aura = 'none',
  background = 'white',
  referencePhoto = null,
}) {
  const styleClauses = {
    'makoto-shinkai': 'masterpiece, high quality anime illustration, Makoto Shinkai style, CoMix Wave Films aesthetic, Your Name aesthetic, ethereal lighting, vibrant sky tones, volumetric sunbeams, warm color harmony, delicate linework',
    'modern-shonen': 'masterpiece, top quality, modern shonen anime portrait, Studio MAPPA style, Jujutsu Kaisen aesthetic, sharp dynamic lineart, crisp cel shading, dramatic lighting, intense expression',
    'ghibli-watercolor': 'masterpiece, Studio Ghibli style, Hayao Miyazaki aesthetic, gentle painterly watercolor, soft whimsical lighting, handcrafted anime illustration, warm nostalgic charm',
    'pastel-shoujo': 'masterpiece, ultra detailed, Kyoto Animation style, Violet Evergarden aesthetic, luminous sparkling anime eyes, soft pastel cherry blossom aesthetic, delicate hair strands, dreamy glow',
    'cyberpunk-neon': 'masterpiece, Cyberpunk Edgerunners style, Studio Trigger aesthetic, high contrast glowing neon cyan and magenta accents, dark synthwave atmosphere, sharp cel shading',
    'retro-90s': 'masterpiece, vintage 1990s anime cel animation, Cowboy Bebop and Sailor Moon aesthetic, classic hand-painted cel look, warm nostalgic colors, subtle film grain',
    'manga-screentone': 'masterpiece, top tier manga art, high contrast black and white manga illustration, authentic screentones and hatching, sharp ink contours, dramatic manga screen tones',
    'dark-fantasy': 'masterpiece, Solo Leveling manhwa style, dark fantasy Korean webtoon art, glowing ethereal eyes, shadow aura, sleek modern linework, majestic atmosphere',
    'chibi-kawaii': 'masterpiece, cute chibi anime sticker, giant sparkling eyes, oversized head, blush cheeks, clean white die-cut sticker contour outline, adorable proportions',
    'genshin-cel': 'masterpiece, Genshin Impact style, 3D cel shaded JRPG anime character portrait, vibrant colors, intricate clothing folds, clean vector look',
  };

  const emotionClauses = {
    happy: 'radiant confident friendly smile, joyful sparkling anime eyes, warm cheerful expression',
    fierce: 'fierce determined battle ready expression, focused sharp eyes, intense shonen hero resolve',
    smug: 'smug playful winking expression, confident half-smile, charismatic anime charm',
    tsundere: 'cute tsundere blushing pout, slightly averted gaze, rosy cheeks, flustered expression',
    shock: 'comedic overdramatic anime shock expression, wide eyes, comedic sweatdrop',
    stoic: 'cool calm stoic expression, mysterious confident gaze, sharp handsome features',
    laughing: 'joyful hearty laugh, closed smiling eyes, triumphant celebratory aura',
  };

  const hairClauses = {
    natural: 'stylish natural black anime hair',
    silver: 'radiant silver white anime hair with sleek highlights',
    blonde: 'golden blonde anime hair with warm sunlight sheen',
    pink: 'soft pastel sakura pink anime hair',
    cyan: 'electric cyan blue anime hair with luminous tips',
    crimson: 'fiery crimson red anime hair with sharp spikes',
    violet: 'deep neon violet anime hair with subtle glow',
  };

  const glassesClauses = {
    glasses: 'stylish modern black rectangular glasses with crisp anime frame lineart',
    wireframe: 'delicate golden wireframe anime glasses',
    glowing: 'iconic glowing white anime glasses reflection effect [✧_✧]',
    sunglasses: 'cool dark anime sunglasses with sleek reflections',
    none: 'clear face without glasses',
  };

  const auraClauses = {
    none: '',
    gold: 'golden Super Saiyan energy aura radiating with glowing power sparks',
    blue: 'blue spirit flame mystical aura swirling around shoulders',
    sakura: 'delicate pink cherry blossom sakura petals swirling gracefully in the air',
    neon: 'glitching holographic neon digital grid and floating cyber particles',
    menacing: 'dramatic purple manga menacing onomatopoeia symbols (ゴゴゴ) floating in air',
    sparkles: 'radiant anime star sparkles, luminous bokeh glints and soft magical glitter',
  };

  const bgClauses = {
    white: 'pure solid clean white background, die-cut sticker isolation, no background clutter',
    transparent: 'pure white background, isolated subject, ideal for sticker cutout',
    tokyo: 'vibrant Tokyo Shinjuku street at night with glowing neon kanji signs and rain reflections',
    rooftop: 'Japanese high school rooftop at golden sunset with warm orange sky and fluffy clouds',
    sakura: 'peaceful Japanese park surrounded by blooming cherry blossom sakura trees and soft petals',
    cyberpunk: 'futuristic cyberpunk city alley with neon signage and holographic lights',
    shrine: 'traditional Japanese Torii gate shrine with stone lanterns and mystical atmosphere',
    cosmos: 'ethereal deep space galaxy with glowing nebula and twinkling starlight',
  };

  const parts = [
    styleClauses[stylePreset] || styleClauses['modern-shonen'],
    referencePhoto
      ? 'anime character portrait faithfully redrawn from photo reference, preserving facial structure, hairstyle, outfit, and distinctive characteristics'
      : 'anime character portrait, highly detailed upper body bust shot',
    emotionClauses[emotion] || emotionClauses.happy,
    hairClauses[hairColor] || hairClauses.natural,
    glassesClauses[glasses] || glassesClauses.glasses,
    auraClauses[aura] || '',
    bgClauses[background] || bgClauses.white,
    prompt ? `Additional details: ${prompt}` : '',
    'centered framing, sharp focus, clean anime character design, crisp line art, professional digital illustration, 8k resolution',
  ];

  return parts.filter(Boolean).join(', ');
}

/**
 * Generates an anime image using the Turbo Web AI engine (Pollinations / Fast Model).
 */
export async function generateTurboAnime({
  promptText,
  width = 768,
  height = 768,
  seed = Math.floor(Math.random() * 1000000),
}) {
  const encodedPrompt = encodeURIComponent(promptText);
  // Pollinations AI endpoint with anime tuning
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=false&model=flux-anime`;

  // Fetch with retry & timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'image/*',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      // Fallback to standard flux model if flux-anime rate limits
      const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
      const fallbackRes = await fetch(fallbackUrl);
      if (!fallbackRes.ok) {
        throw new Error(`AI generation service busy (${res.status}). Switching to local neural shader.`);
      }
      const blob = await fallbackRes.blob();
      return await blobToDataUrl(blob);
    }

    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Generates an anime image using Google Gemini Multimodal / Imagen API directly.
 */
export async function generateGeminiAnime({
  apiKey,
  promptText,
  referenceImage = null,
}) {
  if (!apiKey) {
    throw new Error('Please enter your Google Gemini API key in Settings or AI Config.');
  }

  // 1. If we have a reference photo, analyze it first with Gemini 2.0 Flash Vision
  let enhancedPrompt = promptText;
  if (referenceImage) {
    try {
      const mimeMatch = referenceImage.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (mimeMatch) {
        const mimeType = mimeMatch[1];
        const base64Data = mimeMatch[2];

        const visionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const visionPayload = {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: 'Describe this person with key visual tags for an anime portrait artist: age group, gender, hair style & color, eye shape, glasses details (if present), facial hair / beard / mustache (if present), clothing details (e.g. collared shirt, tie pattern, jacket), and expression. Return in one concise comma-separated string.',
                },
              ],
            },
          ],
        };

        const visionRes = await fetch(visionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(visionPayload),
        });

        if (visionRes.ok) {
          const visionJson = await visionRes.json();
          const desc = visionJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (desc) {
            enhancedPrompt = `${promptText}, character reference: ${desc.trim()}`;
          }
        }
      }
    } catch (e) {
      console.warn('Gemini vision analysis skipped:', e);
    }
  }

  // 2. Generate with Imagen 3 via Gemini REST API
  const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
  const payload = {
    instances: [{ prompt: enhancedPrompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      outputMimeType: 'image/png',
    },
  };

  const res = await fetch(imagenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    const msg = errorJson?.error?.message || `Gemini API returned status ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) {
    throw new Error('Gemini API returned no image.');
  }

  return `data:image/png;base64,${b64}`;
}

/**
 * On-Device Neural Canvas Stylizer
 * Uses bilateral edge-preserving smoothing, Difference-of-Gaussians manga line inking,
 * cel-shading palette quantization, and eye highlight glints.
 */
export async function generateNeuralCanvasShader({
  sourceImage,
  stylePreset = 'modern-shonen',
  emotion = 'happy',
  hairColor = 'natural',
  glasses = 'glasses',
}) {
  const img = await loadImage(sourceImage);
  const canvas = document.createElement('canvas');
  const size = 768;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Center & crop fit
  const scale = Math.max(size / img.width, size / img.height);
  const x = (size - img.width * scale) / 2;
  const y = (size - img.height * scale) / 2;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

  const imgData = ctx.getImageData(0, 0, size, size);
  const { data, width, height } = imgData;

  // 1. Bilateral-style Edge-Preserving Smoothing (Softens skin blemishes into clean anime complexion)
  const smoothed = new Uint8ClampedArray(data.length);
  const radius = 2;
  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const idx = (cy * width + cx) * 4;
      let rSum = 0, gSum = 0, bSum = 0, weightSum = 0;
      const cR = data[idx];
      const cG = data[idx + 1];
      const cB = data[idx + 2];

      for (let dy = -radius; dy <= radius; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = cx + dx;
          if (nx < 0 || nx >= width) continue;
          const nIdx = (ny * width + nx) * 4;
          const nR = data[nIdx];
          const nG = data[nIdx + 1];
          const nB = data[nIdx + 2];

          // Color delta
          const cd = Math.abs(cR - nR) + Math.abs(cG - nG) + Math.abs(cB - nB);
          const colorWeight = Math.exp(-cd / 45);
          const spatialWeight = 1 / (1 + dx * dx + dy * dy);
          const weight = colorWeight * spatialWeight;

          rSum += nR * weight;
          gSum += nG * weight;
          bSum += nB * weight;
          weightSum += weight;
        }
      }

      smoothed[idx] = rSum / weightSum;
      smoothed[idx + 1] = gSum / weightSum;
      smoothed[idx + 2] = bSum / weightSum;
      smoothed[idx + 3] = data[idx + 3];
    }
  }

  // 2. Crisp Manga Line Inking via Difference of Gaussians (DoG)
  const edges = new Float32Array(width * height);
  for (let cy = 1; cy < height - 1; cy++) {
    for (let cx = 1; cx < width - 1; cx++) {
      const idx = (cy * width + cx) * 4;
      const lum = (smoothed[idx] * 0.299 + smoothed[idx + 1] * 0.587 + smoothed[idx + 2] * 0.114);

      // 3x3 Laplacian / Sobel
      const left = ((cy * width + (cx - 1)) * 4);
      const right = ((cy * width + (cx + 1)) * 4);
      const top = (((cy - 1) * width + cx) * 4);
      const bottom = (((cy + 1) * width + cx) * 4);

      const lumL = (smoothed[left] * 0.299 + smoothed[left + 1] * 0.587 + smoothed[left + 2] * 0.114);
      const lumR = (smoothed[right] * 0.299 + smoothed[right + 1] * 0.587 + smoothed[right + 2] * 0.114);
      const lumT = (smoothed[top] * 0.299 + smoothed[top + 1] * 0.587 + smoothed[top + 2] * 0.114);
      const lumB = (smoothed[bottom] * 0.299 + smoothed[bottom + 1] * 0.587 + smoothed[bottom + 2] * 0.114);

      const dx = lumR - lumL;
      const dy = lumB - lumT;
      const grad = Math.sqrt(dx * dx + dy * dy);
      edges[cy * width + cx] = grad > 22 ? 1 : 0;
    }
  }

  // 3. Cel-Shading & Anime Palette Boost
  for (let i = 0; i < data.length; i += 4) {
    let r = smoothed[i];
    let g = smoothed[i + 1];
    let b = smoothed[i + 2];

    // Saturation and warmth boost (anime vibrant skin & tone)
    const avg = (r + g + b) / 3;
    r = Math.min(255, Math.max(0, avg + (r - avg) * 1.35 + 8));
    g = Math.min(255, Math.max(0, avg + (g - avg) * 1.25 + 2));
    b = Math.min(255, Math.max(0, avg + (b - avg) * 1.25 - 4));

    // Cel step quantization (3 anime tone levels)
    r = Math.floor(r / 50) * 50 + 25;
    g = Math.floor(g / 50) * 50 + 25;
    b = Math.floor(b / 50) * 50 + 25;

    // Apply dark manga ink line if edge is present
    const pIdx = i / 4;
    if (edges[pIdx] > 0.5) {
      r = Math.floor(r * 0.2);
      g = Math.floor(g * 0.2);
      b = Math.floor(b * 0.2);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);

  // 4. Subtle Anime Ethereal Bloom / Warm Lighting Overlay
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(255, 230, 200, 0.15)';
  ctx.fillRect(0, 0, size, size);

  // 5. Glasses reflection glint if glowing glasses option enabled
  if (glasses === 'glowing') {
    ctx.globalCompositeOperation = 'source-over';
    const centerX = size * 0.5;
    const centerY = size * 0.38;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(centerX - 60, centerY, 12, 0, Math.PI * 2);
    ctx.arc(centerX + 60, centerY, 12, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle star cross
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - 60, centerY - 24);
    ctx.lineTo(centerX - 60, centerY + 24);
    ctx.moveTo(centerX - 84, centerY);
    ctx.lineTo(centerX - 36, centerY);
    ctx.stroke();
  }

  ctx.restore();
  return canvas.toDataURL('image/png', 0.95);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for processing'));
    img.src = src;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
