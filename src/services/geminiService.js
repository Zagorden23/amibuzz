// Anime sticker generation client.
// High-performance multi-engine architecture with intelligent fallback:
// 1. Google Gemini 2.0 / Imagen 3 (via direct API key or server-side functions)
// 2. Turbo Anime Web AI (High-res neural anime generation)
// 3. AmiBuzz Neural Canvas Stylizer (Bilateral edge-preserving shader on-device)

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';
import { EMOTION_MATRIX_PRESETS, COLOR_HARMONIES } from '../lib/animeStyles.js';
import { makeSticker, canvasToStickerDataUrl, downscale, prepareReferencePhoto } from '../lib/stickerFx.js';
import {
  getAiSettings,
  buildAnimePrompt,
  generateTurboAnime,
  generateGeminiAnime,
  generateNeuralCanvasShader,
} from '../lib/animeAiEngine.js';

// Errors the user has to act on; everything else triggers graceful AI fallback.
const USER_FACING = new Set(['functions/resource-exhausted', 'functions/invalid-argument']);

function titleFrom(prompt, fallback) {
  const words = (prompt || '').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 4);
  if (!words.length) return fallback;
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** Turns raw artwork into a stored sticker record (die-cut + reusable cut-out). */
export async function finishSticker(art, meta, options = {}) {
  const result = await makeSticker(art, {
    toonStyle: options.toonStyle || null,
    borderWidth: options.borderWidth !== undefined ? options.borderWidth : 14,
    borderStyle: options.borderStyle || 'white',
    cut: 'auto',
    workSize: 768,
  });
  return {
    id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...meta,
    img: result.dataUrl,
    rawArt: art,
    // Border-less artwork, so the customizer can re-border without re-cutting.
    cutout: canvasToStickerDataUrl(downscale(result.subject, 512), 0.9),
    backgroundRemoved: result.backgroundRemoved,
    time: 'Just now',
    status: 'Saved',
    animated: false,
    createdAt: Date.now(),
  };
}

/**
 * Generates 1, 2 or 4 stickers (4 = the emotion matrix).
 *
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} [params.stylePreset]
 * @param {string|null} [params.referenceImage] data URL of an uploaded photo
 * @param {number} [params.variantCount]
 * @param {boolean} [params.emotionMatrix]
 * @param {string} [params.colorHarmony]
 * @param {'ai'|'turbo'|'gemini'|'device'} [params.engine='ai']
 * @param {Object} [params.extraOptions] e.g. hairColor, glasses, aura, background
 * @returns {Promise<{stickers: Object[], usage: Object|null, engine: string, notice: string}>}
 */
export async function generateStickerBatch({
  prompt = '',
  stylePreset = 'modern-shonen',
  referenceImage = null,
  variantCount = 1,
  emotionMatrix = false,
  colorHarmony = 'vibrant',
  engine = 'turbo',
  extraOptions = {},
}) {
  const aiSettings = getAiSettings();
  const effectiveEngine = engine === 'ai' ? (aiSettings.engine || 'turbo') : engine;
  const count = emotionMatrix ? EMOTION_MATRIX_PRESETS.length : Math.min(4, Math.max(1, variantCount));
  const reference = referenceImage ? await prepareReferencePhoto(referenceImage) : null;
  const baseName = titleFrom(prompt, reference ? 'Anime Avatar' : 'Anime Sticker');

  // Option 1: Try Cloud Functions if explicitly configured and reachable
  if (effectiveEngine === 'functions' && functions) {
    try {
      const callable = httpsCallable(functions, 'generateStickerBatch', { timeout: 180000 });
      const res = await callable({
        prompt,
        stylePreset,
        referenceImage: reference,
        count,
        emotionMatrix,
        colorHarmony,
      });
      const data = res?.data || {};
      if (Array.isArray(data.stickers) && data.stickers.length) {
        const stickers = [];
        for (let i = 0; i < data.stickers.length; i++) {
          const item = data.stickers[i];
          const emotion = EMOTION_MATRIX_PRESETS.find((e) => e.id === item.emotion) || null;
          const suffix = emotion ? ` (${emotion.label})` : data.stickers.length > 1 ? ` (Var ${i + 1})` : '';
          stickers.push(
            await finishSticker(
              item.imageUrl,
              {
                name: `${baseName}${suffix}`,
                prompt: emotion ? `${prompt}${prompt ? ', ' : ''}${emotion.promptModifier}` : prompt,
                stylePreset,
                colorHarmony,
                emotion: emotion?.id || null,
                emotionLabel: emotion?.label || null,
                emotionIcon: emotion?.icon || null,
                source: 'functions',
              },
              {}
            )
          );
        }
        return {
          stickers,
          engine: 'functions',
          usage: { plan: data.plan, quota: data.quota, used: data.used, remaining: data.remaining },
          notice: data.failed ? `${data.failed} of ${count} variants failed.` : '',
        };
      }
    } catch (err) {
      if (USER_FACING.has(err?.code)) throw err;
      console.warn('Firebase Cloud Function unavailable, falling back to direct AI engine:', err?.message);
    }
  }

  // Option 2: Try Direct Gemini API (if user configured API key)
  if (effectiveEngine === 'gemini' && aiSettings.geminiApiKey) {
    try {
      const stickers = [];
      const presetsToRun = emotionMatrix
        ? EMOTION_MATRIX_PRESETS
        : Array.from({ length: count }, (_, i) => ({ id: `var-${i + 1}`, label: `Var ${i + 1}`, promptModifier: '' }));

      for (let i = 0; i < presetsToRun.length; i++) {
        const item = presetsToRun[i];
        const fullPrompt = buildAnimePrompt({
          prompt: `${prompt}${item.promptModifier ? `, ${item.promptModifier}` : ''}`,
          stylePreset,
          emotion: item.id || extraOptions.emotion || 'happy',
          hairColor: extraOptions.hairColor || 'natural',
          glasses: extraOptions.glasses || 'glasses',
          aura: extraOptions.aura || 'none',
          background: extraOptions.background || 'white',
          referencePhoto: reference,
        });

        const rawImageUrl = await generateGeminiAnime({
          apiKey: aiSettings.geminiApiKey,
          promptText: fullPrompt,
          referenceImage: reference,
        });

        const suffix = emotionMatrix ? ` (${item.label})` : count > 1 ? ` (Var ${i + 1})` : '';
        stickers.push(
          await finishSticker(
            rawImageUrl,
            {
              name: `${baseName}${suffix}`,
              prompt: fullPrompt,
              stylePreset,
              colorHarmony,
              emotion: item.id || null,
              emotionLabel: item.label || null,
              emotionIcon: item.icon || null,
              source: 'gemini',
            },
            { borderWidth: extraOptions.dieCutBorder ? 14 : 0 }
          )
        );
      }

      return {
        stickers,
        engine: 'gemini',
        usage: null,
        notice: 'Generated with Google Gemini 2.0 & Imagen 3.',
      };
    } catch (err) {
      console.warn('Direct Gemini API call failed, falling back to Turbo Anime AI:', err?.message);
    }
  }

  // Option 3: Turbo Anime Web AI (Fast, studio-grade neural generation)
  if (effectiveEngine === 'turbo' || effectiveEngine === 'ai' || effectiveEngine === 'gemini') {
    try {
      const stickers = [];
      const presetsToRun = emotionMatrix
        ? EMOTION_MATRIX_PRESETS
        : Array.from({ length: count }, (_, i) => ({ id: `var-${i + 1}`, label: `Var ${i + 1}`, promptModifier: '' }));

      for (let i = 0; i < presetsToRun.length; i++) {
        const item = presetsToRun[i];
        const fullPrompt = buildAnimePrompt({
          prompt: `${prompt}${item.promptModifier ? `, ${item.promptModifier}` : ''}`,
          stylePreset,
          emotion: item.id || extraOptions.emotion || 'happy',
          hairColor: extraOptions.hairColor || 'natural',
          glasses: extraOptions.glasses || 'glasses',
          aura: extraOptions.aura || 'none',
          background: extraOptions.background || 'white',
          referencePhoto: reference,
        });

        const rawImageUrl = await generateTurboAnime({
          promptText: fullPrompt,
          seed: Math.floor(Math.random() * 9999999) + i * 17,
        });

        const suffix = emotionMatrix ? ` (${item.label})` : count > 1 ? ` (Var ${i + 1})` : '';
        stickers.push(
          await finishSticker(
            rawImageUrl,
            {
              name: `${baseName}${suffix}`,
              prompt: fullPrompt,
              stylePreset,
              colorHarmony,
              emotion: item.id || null,
              emotionLabel: item.label || null,
              emotionIcon: item.icon || null,
              source: 'turbo',
            },
            { borderWidth: extraOptions.dieCutBorder ? 14 : 0 }
          )
        );
      }

      return {
        stickers,
        engine: 'turbo',
        usage: null,
        notice: 'Rendered with Turbo Anime Neural AI engine.',
      };
    } catch (err) {
      console.warn('Turbo Anime AI unavailable, falling back to on-device Neural Shader:', err?.message);
    }
  }

  // Option 4: On-Device Neural Canvas Shader (100% offline, guaranteed)
  if (reference) {
    const rawShaderUrl = await generateNeuralCanvasShader({
      sourceImage: reference,
      stylePreset,
      emotion: extraOptions.emotion || 'happy',
      hairColor: extraOptions.hairColor || 'natural',
      glasses: extraOptions.glasses || 'glasses',
    });

    const sticker = await finishSticker(
      rawShaderUrl,
      {
        name: `${baseName} (Anime Shader)`,
        prompt: prompt || 'On-device neural anime transformation',
        stylePreset,
        colorHarmony,
        emotion: null,
        source: 'shader',
      },
      { borderWidth: extraOptions.dieCutBorder ? 14 : 0 }
    );

    return {
      stickers: [sticker],
      engine: 'shader',
      usage: null,
      notice: 'Stylized locally with AmiBuzz Neural Canvas Shader (Zero network used).',
    };
  }

  throw new Error('AI generation service was unreachable. Please upload a photo to generate an anime character or check your connection.');
}

/** Single-sticker convenience wrapper. */
export async function generateImage(prompt, stylePreset, referenceImage = null, colorHarmony = 'vibrant') {
  const { stickers, usage } = await generateStickerBatch({ prompt, stylePreset, referenceImage, colorHarmony });
  return { imageUrl: stickers[0].img, sticker: stickers[0], ...(usage || {}) };
}

/**
 * Rewrites a short idea into a richer anime sticker prompt.
 */
export async function enhancePrompt(prompt, stylePreset = 'modern-shonen', colorHarmony = 'vibrant') {
  const harmony = COLOR_HARMONIES.find((h) => h.id === colorHarmony);
  const clean = prompt.trim().replace(/[.]+$/, '');
  const flourishes = [
    'with sparkling expressive anime eyes, dynamic hair highlights, and charismatic smile',
    'striking an iconic anime hero pose with subtle aura embers and determined gaze',
    'mid-action with flowing hair strands, sharp cel-shaded shadows, and vivid anime colors',
    'glowing ethereal rim lighting, warm anime aesthetic, clean manga ink contours',
  ];
  const flourish = flourishes[Math.floor(Math.random() * flourishes.length)];
  return `${clean}, ${flourish}${harmony ? `, ${harmony.promptClause}` : ''}`;
}
