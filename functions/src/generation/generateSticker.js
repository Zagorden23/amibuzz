const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../lib/firestore');
const { getDailyQuota, getEffectivePlan } = require('../lib/plans');
const { generateStickerImage, enhanceStickerPrompt } = require('../lib/gemini');
const { STYLE_CLAUSES, COLOR_CLAUSES, EMOTIONS } = require('../lib/stickerStyles');

const MAX_PROMPT_LENGTH = 1000;
const MAX_BATCH = 4;

/**
 * Sticker generation runs on the server so that:
 *  1. the Gemini API key never reaches the browser, and
 *  2. quota is claimed and the image generated in one place, so nobody can
 *     call Gemini directly and skip the quota.
 *
 * Quota is claimed BEFORE the slow, billable model call and refunded for
 * every image that fails, so a provider outage doesn't burn the allowance.
 */

function readRequest(data) {
  const prompt = String(data?.prompt || '').trim();
  const referenceImage = data?.referenceImage ? String(data.referenceImage) : null;
  if (!prompt && !referenceImage) {
    throw new HttpsError('invalid-argument', 'Describe your sticker or upload a photo.');
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new HttpsError('invalid-argument', `Prompt must be under ${MAX_PROMPT_LENGTH} characters.`);
  }
  // Only known style / colour ids are turned into prompt text.
  return {
    prompt,
    referenceImage,
    stylePreset: STYLE_CLAUSES[data?.stylePreset] ? data.stylePreset : 'Kawaii Chibi',
    colorHarmony: COLOR_CLAUSES[data?.colorHarmony] ? data.colorHarmony : 'vibrant',
  };
}

/** Atomically claims `count` generations; throws when the quota can't cover them. */
async function claimQuota(auth, count) {
  const userRef = db().collection('users').doc(auth.uid);
  const today = new Date().toISOString().slice(0, 10);

  const claim = await db().runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    let data;
    if (!snap.exists) {
      // OAuth users never pass through the OTP functions that create profiles.
      data = { email: auth.token?.email || null, displayName: auth.token?.name || null, createdVia: 'oauth', plan: 'free' };
      tx.set(userRef, data, { merge: true });
    } else {
      data = snap.data();
    }
    const plan = getEffectivePlan(data);
    const quota = getDailyQuota(plan);
    const usedToday = data.usageDate === today ? data.usageCount || 0 : 0;
    const remaining = quota - usedToday;

    if (remaining <= 0) {
      throw new HttpsError(
        'resource-exhausted',
        `Daily limit reached (${quota} generations on the ${plan} plan). Upgrade for more.`
      );
    }
    if (remaining < count) {
      throw new HttpsError(
        'resource-exhausted',
        `Only ${remaining} generation${remaining === 1 ? '' : 's'} left today — this needs ${count}. Switch to Single mode or upgrade.`
      );
    }

    tx.set(
      userRef,
      { usageDate: today, usageCount: usedToday + count, lastGenerationAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return { plan, quota, used: usedToday + count };
  });

  return { ...claim, userRef, today };
}

async function refundQuota(userRef, today, count) {
  if (count <= 0) return;
  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.data() || {};
      if (data.usageDate === today && (data.usageCount || 0) > 0) {
        tx.update(userRef, { usageCount: Math.max(0, data.usageCount - count) });
      }
    });
  } catch (err) {
    console.error('Failed to refund quota:', err);
  }
}

/** Maps provider errors to actionable client messages (never leaks the key). */
function toHttpsError(err) {
  if (err instanceof HttpsError) return err;
  const raw = err?.message || '';
  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return new HttpsError('failed-precondition', 'AI generation is not set up on this server yet.');
  }
  if (raw === 'REFERENCE_TOO_LARGE') {
    return new HttpsError('invalid-argument', 'The reference photo is too large. Use one under 7 MB.');
  }
  if (raw === 'REFERENCE_INVALID') {
    return new HttpsError('invalid-argument', 'The reference photo must be a PNG, JPEG or WebP image.');
  }
  if (raw === 'CONTENT_BLOCKED' || /SAFETY|blocked/i.test(raw)) {
    return new HttpsError('invalid-argument', "The AI declined that request. Try rewording the prompt or using a different photo.");
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('"code":429')) {
    return new HttpsError('resource-exhausted', 'The image service is busy right now. Please try again in a minute.');
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
    return new HttpsError('failed-precondition', 'The image service credentials are invalid. Please contact support.');
  }
  console.error('Gemini error:', err);
  return new HttpsError('internal', 'Image generation failed. Please try again.');
}

function usageOf(claim, refunded = 0) {
  const used = claim.used - refunded;
  return { plan: claim.plan, quota: claim.quota, used, remaining: Math.max(0, claim.quota - used) };
}

/** Generates a single sticker. */
exports.generateSticker = onCall({ cors: true, timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to generate stickers.');
  const req = readRequest(request.data);
  const claim = await claimQuota(request.auth, 1);

  let imageUrl = null;
  try {
    imageUrl = await generateStickerImage({
      prompt: req.prompt,
      referenceImage: req.referenceImage,
      styleClause: STYLE_CLAUSES[req.stylePreset],
      colorClause: COLOR_CLAUSES[req.colorHarmony],
    });
  } catch (err) {
    await refundQuota(claim.userRef, claim.today, 1);
    throw toHttpsError(err);
  }
  if (!imageUrl) {
    await refundQuota(claim.userRef, claim.today, 1);
    throw new HttpsError('internal', 'The image service returned no image. Please try again.');
  }
  return { imageUrl, ...usageOf(claim) };
});

/**
 * Generates 1–4 variants in parallel: plain variations, or the 4-expression
 * emotion matrix. Each image costs one generation; failures are refunded.
 */
exports.generateStickerBatch = onCall({ cors: true, timeoutSeconds: 180, memory: '1GiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to generate stickers.');
  const req = readRequest(request.data);
  const emotionMatrix = Boolean(request.data?.emotionMatrix);
  const count = emotionMatrix ? EMOTIONS.length : Math.max(1, Math.min(MAX_BATCH, Number(request.data?.count) || 1));

  const claim = await claimQuota(request.auth, count);

  const variantHints = ['', 'a different pose and camera angle', 'a different pose, outfit details and prop', 'a playful alternate pose'];
  const jobs = Array.from({ length: count }, (_, i) => {
    const emotion = emotionMatrix ? EMOTIONS[i] : null;
    return generateStickerImage({
      prompt: req.prompt,
      referenceImage: req.referenceImage,
      styleClause: STYLE_CLAUSES[req.stylePreset],
      colorClause: COLOR_CLAUSES[req.colorHarmony],
      emotionClause: emotion ? emotion.clause : variantHints[i] || '',
    }).then(
      (imageUrl) => ({ imageUrl, emotion }),
      (error) => ({ error, emotion })
    );
  });
  const results = await Promise.all(jobs);

  const stickers = results.filter((r) => r.imageUrl);
  const failed = count - stickers.length;
  await refundQuota(claim.userRef, claim.today, failed);

  if (stickers.length === 0) {
    throw toHttpsError(results.find((r) => r.error)?.error || new Error('No image returned'));
  }

  const usage = usageOf(claim, failed);
  return {
    stickers: stickers.map((s) => ({ imageUrl: s.imageUrl, emotion: s.emotion?.id || null })),
    failed,
    ...usage,
  };
});

/** Server-side prompt enhancement — keeps the API key off the client too. */
exports.enhancePrompt = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const prompt = String(request.data?.prompt || '').trim();
  if (!prompt) throw new HttpsError('invalid-argument', 'A prompt is required.');
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new HttpsError('invalid-argument', `Prompt must be under ${MAX_PROMPT_LENGTH} characters.`);
  }
  try {
    const enhanced = await enhanceStickerPrompt(prompt, {
      styleClause: STYLE_CLAUSES[request.data?.stylePreset],
      colorClause: COLOR_CLAUSES[request.data?.colorHarmony],
    });
    return { prompt: enhanced };
  } catch (err) {
    throw toHttpsError(err);
  }
});
