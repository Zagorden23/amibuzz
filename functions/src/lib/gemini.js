const { GoogleGenAI } = require('@google/genai');

// The Gemini key lives ONLY on the server.
let ai = null;
function getAi() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured — see functions/.env.example.');
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

// Overridable so a model can be swapped without a code change.
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash';
const IMAGEN_MODEL = process.env.IMAGEN_MODEL || 'imagen-3.0-generate-002';
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash';

const MAX_REFERENCE_BYTES = 7 * 1024 * 1024;

/**
 * Builds the sticker prompt. The background instruction matters: the client
 * cuts the subject out of a flat background to make the die-cut, so the model
 * must not paint scenery behind the character.
 */
function buildStickerPrompt({ prompt, styleClause, colorClause, emotionClause, hasReference }) {
  const subject = hasReference
    ? `Redraw the person, pet or object in the attached photo as an anime character sticker. Keep their recognisable features (hair, face shape, clothing colours, accessories).${
        prompt ? ` Extra direction: ${prompt}.` : ''
      }`
    : `Anime character sticker of: ${prompt}.`;

  return [
    subject,
    styleClause ? `Art style: ${styleClause}.` : 'Art style: clean modern anime, cel shading.',
    emotionClause ? `Expression and pose: ${emotionClause}.` : '',
    colorClause ? `Colour palette: ${colorClause}.` : '',
    'One single character, whole subject in frame and centred, nothing cropped at the edges.',
    'Bold clean outlines, flat cel shading, crisp edges.',
    'Plain pure white (#FFFFFF) background with no scenery, no floor, no shadow and no border.',
    'No text, no letters, no watermark, no signature.',
  ]
    .filter(Boolean)
    .join(' ');
}

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|heic|heif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  if ((match[2].length * 3) / 4 > MAX_REFERENCE_BYTES) {
    throw new Error('REFERENCE_TOO_LARGE');
  }
  return { mimeType: match[1] === 'image/jpg' ? 'image/jpeg' : match[1], data: match[2] };
}

async function generateWithGeminiImage(client, fullPrompt, reference) {
  const parts = [];
  if (reference) parts.push({ inlineData: reference });
  parts.push({ text: fullPrompt });

  const response = await client.models.generateContent({
    model: IMAGE_MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: { aspectRatio: '1:1' },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  const reason = response.candidates?.[0]?.finishReason || response.promptFeedback?.blockReason;
  if (reason && /SAFETY|PROHIBITED|BLOCK/i.test(String(reason))) {
    throw new Error('CONTENT_BLOCKED');
  }
  return null;
}

async function generateWithImagen(client, fullPrompt) {
  if (typeof client.models?.generateImages !== 'function') return null;
  const response = await client.models.generateImages({
    model: IMAGEN_MODEL,
    prompt: fullPrompt,
    config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: '1:1' },
  });
  const bytes = response.generatedImages?.[0]?.image?.imageBytes;
  return bytes ? `data:image/png;base64,${bytes}` : null;
}

/**
 * Generates one anime sticker image.
 *
 * With a reference photo only the Gemini image model is used — Imagen is
 * text-only and would silently ignore the photo. Without one, Gemini is tried
 * first and Imagen is the fallback.
 *
 * @param {Object} params
 * @param {string} [params.prompt]
 * @param {string} [params.styleClause] art-style description
 * @param {string} [params.colorClause]
 * @param {string} [params.emotionClause]
 * @param {string|null} [params.referenceImage] data URL
 * @returns {Promise<string|null>} image data URL
 */
async function generateStickerImage({ prompt = '', styleClause, colorClause, emotionClause, referenceImage = null }) {
  const client = getAi();
  const reference = referenceImage ? parseDataUrl(referenceImage) : null;
  if (referenceImage && !reference) throw new Error('REFERENCE_INVALID');

  const fullPrompt = buildStickerPrompt({
    prompt,
    styleClause,
    colorClause,
    emotionClause,
    hasReference: Boolean(reference),
  });

  let firstError = null;
  try {
    const image = await generateWithGeminiImage(client, fullPrompt, reference);
    if (image) return image;
  } catch (err) {
    if (err.message === 'CONTENT_BLOCKED' || reference) throw err;
    firstError = err;
    console.warn('Gemini image generation failed, trying Imagen:', err.message);
  }

  if (reference) return null;

  try {
    return await generateWithImagen(client, fullPrompt);
  } catch (err) {
    console.warn('Imagen generation failed:', err.message);
    throw firstError || err;
  }
}

/**
 * Rewrites a short idea into a vivid anime sticker description.
 */
async function enhanceStickerPrompt(prompt, { styleClause, colorClause } = {}) {
  const client = getAi();
  try {
    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: `You are an anime character designer writing prompts for sticker art.
Rewrite the idea below into one or two punchy sentences describing a single anime character sticker: who they are, their expression, pose, outfit and one or two props.
${styleClause ? `The art style will be: ${styleClause}.\n` : ''}${colorClause ? `The palette will be: ${colorClause}.\n` : ''}Do not describe a background, borders or text. Return only the prompt, with no quotes or markdown.

Idea: "${prompt}"`,
    });
    const text = response.text?.trim().replace(/^["'`]+|["'`]+$/g, '');
    return text || prompt;
  } catch (err) {
    console.warn('Enhance prompt fallback:', err.message);
    return prompt;
  }
}

module.exports = { generateStickerImage, enhanceStickerPrompt, buildStickerPrompt };
