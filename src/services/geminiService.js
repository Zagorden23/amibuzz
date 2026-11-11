// Anime sticker generation client.
//
// AI path:   the generateSticker / generateStickerBatch Cloud Functions draw
//            the art (the Gemini key and the quota live on the server), then
//            the result is cut out of its white background on this device and
//            given a die-cut border.
// On-device: when the AI backend can't be reached and a photo was supplied,
//            the photo is cel-shaded into an anime sticker locally instead.
//            Text-only requests need the AI — there is no fake fallback.

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';
import { EMOTION_MATRIX_PRESETS, COLOR_HARMONIES } from '../lib/animeStyles.js';
import { makeSticker, canvasToStickerDataUrl, downscale, prepareReferencePhoto } from '../lib/stickerFx.js';

// Errors the user has to act on; everything else means "the AI is unavailable".
const USER_FACING = new Set(['functions/resource-exhausted', 'functions/invalid-argument']);

const describeBackendFailure = (err) => {
  switch (err?.code) {
    case 'functions/unauthenticated':
      return 'AI generation needs a signed-in account (demo sessions run on-device only).';
    case 'functions/failed-precondition':
      return err.message || 'AI generation is not configured on the server yet.';
    case 'functions/deadline-exceeded':
      return 'The AI took too long to respond.';
    default:
      return 'The AI service could not be reached.';
  }
};

function titleFrom(prompt, fallback) {
  const words = (prompt || '').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 4);
  if (!words.length) return fallback;
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** Turns raw artwork into a stored sticker record (die-cut + reusable cut-out). */
async function finishSticker(art, meta, options) {
  const result = await makeSticker(art, {
    toonStyle: options.toonStyle || null,
    borderWidth: 14,
    borderStyle: 'white',
    cut: 'auto',
    workSize: 768,
  });
  return {
    id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...meta,
    img: result.dataUrl,
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
 * @param {'ai'|'device'} [params.engine='ai'] 'device' skips the AI entirely
 *        (photo required) and costs no quota
 * @returns {Promise<{stickers: Object[], usage: Object|null, engine: 'ai'|'device', notice: string}>}
 */
export async function generateStickerBatch({
  prompt = '',
  stylePreset = 'Kawaii Chibi',
  referenceImage = null,
  variantCount = 1,
  emotionMatrix = false,
  colorHarmony = 'vibrant',
  engine = 'ai',
}) {
  const count = emotionMatrix ? EMOTION_MATRIX_PRESETS.length : Math.min(4, Math.max(1, variantCount));
  const reference = referenceImage ? await prepareReferencePhoto(referenceImage) : null;
  const baseName = titleFrom(prompt, reference ? 'Photo Sticker' : 'Anime Sticker');

  let fallbackReason = '';
  if (engine === 'ai' && functions) {
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
                source: 'ai',
              },
              {}
            )
          );
        }
        return {
          stickers,
          engine: 'ai',
          usage: { plan: data.plan, quota: data.quota, used: data.used, remaining: data.remaining },
          notice: data.failed ? `${data.failed} of ${count} variants failed and were not charged.` : '',
        };
      }
      fallbackReason = 'The AI returned no image.';
    } catch (err) {
      if (USER_FACING.has(err?.code)) throw err;
      console.warn('AI sticker generation unavailable:', err?.code, err?.message);
      fallbackReason = describeBackendFailure(err);
    }
  } else if (engine === 'ai') {
    fallbackReason = 'The AI service is not configured.';
  }

  if (!reference) {
    const error = new Error(
      `${fallbackReason || 'AI generation is unavailable.'} Upload a photo to make an instant on-device anime sticker instead.`
    );
    error.code = 'amibuzz/ai-unavailable';
    throw error;
  }

  // On-device: cel-shade the photo itself. Expressions can't be redrawn
  // without the AI, so this always makes one sticker.
  const sticker = await finishSticker(
    reference,
    {
      name: baseName,
      prompt: prompt || 'On-device anime sticker from photo',
      stylePreset,
      colorHarmony,
      emotion: null,
      emotionLabel: null,
      emotionIcon: null,
      source: 'device',
    },
    { toonStyle: stylePreset }
  );
  const extra = count > 1 ? ' Variants and expressions need the AI, so one sticker was made.' : '';
  return {
    stickers: [sticker],
    engine: 'device',
    usage: null,
    notice:
      engine === 'device'
        ? `Made on your device with the ${stylePreset} filter — no generation credits used.${extra}`
        : `${fallbackReason} Made an on-device ${stylePreset} sticker from your photo instead.${extra}`,
  };
}

/** Single-sticker convenience wrapper. */
export async function generateImage(prompt, stylePreset, referenceImage = null, colorHarmony = 'vibrant') {
  const { stickers, usage } = await generateStickerBatch({ prompt, stylePreset, referenceImage, colorHarmony });
  return { imageUrl: stickers[0].img, sticker: stickers[0], ...(usage || {}) };
}

/**
 * Rewrites a short idea into a richer anime sticker prompt. Falls back to a
 * local template when the server is unavailable.
 */
export async function enhancePrompt(prompt, stylePreset = 'Kawaii Chibi', colorHarmony = 'vibrant') {
  if (functions) {
    try {
      const callable = httpsCallable(functions, 'enhancePrompt', { timeout: 30000 });
      const res = await callable({ prompt, stylePreset, colorHarmony });
      if (res?.data?.prompt) return res.data.prompt;
    } catch (err) {
      console.warn('Server prompt enhancement unavailable, using local enhancer:', err?.message);
    }
  }

  const harmony = COLOR_HARMONIES.find((h) => h.id === colorHarmony);
  const clean = prompt.trim().replace(/[.]+$/, '');
  const flourishes = [
    'with a big expressive grin, sparkling anime eyes and a confident pose',
    'striking a playful pose with blush marks and a tiny sparkle beside them',
    'mid-action with a dynamic pose, flowing hair and a determined look',
  ];
  const flourish = flourishes[Math.floor(Math.random() * flourishes.length)];
  return `${clean}, ${flourish}${harmony ? `, ${harmony.promptClause}` : ''}`;
}
