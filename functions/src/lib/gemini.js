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

/**
 * Generates an anime sticker using Imagen 3 or Gemini multimodal models.
 */
async function generateStickerImage(prompt, stylePreset, referenceImage = null) {
  const client = getAi();
  const animeModifier = stylePreset
    ? `Anime sticker style: ${stylePreset}. Clean solid white background, bold clean outlines, vibrant cel shading, high resolution character sticker.`
    : `Anime sticker style. Clean solid white background, bold clean outlines, vibrant cel shading, high resolution character sticker.`;

  const fullPrompt = `Masterpiece anime sticker design: ${prompt}. ${animeModifier} Isolated subject, sticker die-cut white border, no messy background artifacts.`;

  // Try 1: Imagen 3.0 generation (Google's premier image generator)
  try {
    if (typeof client.models?.generateImages === 'function') {
      const response = await client.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: fullPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: '1:1',
        },
      });
      const imgBytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (imgBytes) {
        return `data:image/png;base64,${imgBytes}`;
      }
    }
  } catch (err) {
    console.warn('Imagen 3 generateImages attempt failed, falling back to generateContent:', err.message);
  }

  // Try 2: Gemini multimodal generation (gemini-2.5-flash-image)
  try {
    const parts = [{ text: fullPrompt }];
    if (referenceImage && typeof referenceImage === 'string') {
      const base64Match = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        parts.unshift({
          inlineData: {
            mimeType: base64Match[1],
            data: base64Match[2],
          },
        });
      }
    }

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: { aspectRatio: '1:1', imageSize: '1K' },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch (err) {
    console.error('Gemini generateContent error:', err);
    throw err;
  }

  return null;
}

/**
 * Enhances a basic prompt into an elite, descriptive anime sticker prompt.
 */
async function enhanceStickerPrompt(prompt) {
  const client = getAi();
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert anime character designer and sticker art prompt engineer.
Take the following basic idea and rewrite it into a punchy, ultra-vivid anime sticker description with clean cel shading, expressive pose, and die-cut aesthetic.
Keep it under 2 sentences. Return only the enhanced prompt without markdown or quotes.

Original prompt: "${prompt}"`,
    });
    return response.text?.trim() || prompt;
  } catch (err) {
    console.warn('Enhance prompt fallback:', err.message);
    return prompt;
  }
}

module.exports = { generateStickerImage, enhanceStickerPrompt };
