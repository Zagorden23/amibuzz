const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../lib/firestore');
const { getDailyQuota, getEffectivePlan } = require('../lib/plans');
const { generateStickerImage, enhanceStickerPrompt } = require('../lib/gemini');

const MAX_PROMPT_LENGTH = 1000;

/**
 * Generates a sticker server-side.
 *
 * Why this runs on the server rather than in the browser:
 *  1. The Gemini API key stays secret. A key shipped to the client can be
 *     lifted from the JS bundle by anyone and billed to us.
 *  2. Quota is claimed and the image generated in one place, so a client
 *     can't call Gemini directly and skip the quota entirely.
 *
 * Quota is claimed BEFORE the (slow, billable) Gemini call, and refunded if
 * generation fails — so a provider outage doesn't burn the user's allowance.
 */
exports.generateSticker = onCall({ cors: true, timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to generate stickers.');
  }

  const prompt = String(request.data?.prompt || '').trim();
  const stylePreset = request.data?.stylePreset ? String(request.data.stylePreset) : undefined;
  const referenceImage = request.data?.referenceImage ? String(request.data.referenceImage) : null;

  if (!prompt) {
    throw new HttpsError('invalid-argument', 'A prompt is required.');
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new HttpsError('invalid-argument', `Prompt must be under ${MAX_PROMPT_LENGTH} characters.`);
  }

  const uid = request.auth.uid;
  const userRef = db().collection('users').doc(uid);
  const today = new Date().toISOString().slice(0, 10);

  // 1. Claim quota atomically (auto-provisioning a free profile for OAuth
  // users who have never passed through the OTP verify functions).
  const claim = await db().runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    let data;
    if (!snap.exists) {
      data = {
        email: request.auth.token?.email || null,
        displayName: request.auth.token?.name || null,
        createdVia: 'oauth',
        plan: 'free',
      };
      tx.set(userRef, data, { merge: true });
    } else {
      data = snap.data();
    }
    const plan = getEffectivePlan(data);
    const quota = getDailyQuota(plan);
    const usedToday = data.usageDate === today ? data.usageCount || 0 : 0;

    if (usedToday >= quota) {
      throw new HttpsError(
        'resource-exhausted',
        `Daily limit reached (${quota} generations on the ${plan} plan). Upgrade for more.`
      );
    }

    tx.set(
      userRef,
      { usageDate: today, usageCount: usedToday + 1, lastGenerationAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return { plan, quota, used: usedToday + 1 };
  });

  // 2. Generate. If this fails, give the quota back — the user got nothing.
  let imageUrl;
  try {
    imageUrl = await generateStickerImage(prompt, stylePreset, referenceImage);
  } catch (err) {
    await refundQuota(userRef, today);
    throw toHttpsError(err);
  }

  if (!imageUrl) {
    await refundQuota(userRef, today);
    throw new HttpsError('internal', 'The image provider returned no image. Please try again.');
  }

  return {
    imageUrl,
    plan: claim.plan,
    quota: claim.quota,
    used: claim.used,
    remaining: claim.quota - claim.used,
  };
});

/** Server-side prompt enhancement — also keeps the API key off the client. */
exports.enhancePrompt = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }
  const prompt = String(request.data?.prompt || '').trim();
  if (!prompt) {
    throw new HttpsError('invalid-argument', 'A prompt is required.');
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new HttpsError('invalid-argument', `Prompt must be under ${MAX_PROMPT_LENGTH} characters.`);
  }

  try {
    return { prompt: await enhanceStickerPrompt(prompt) };
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function refundQuota(userRef, today) {
  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.data() || {};
      if (data.usageDate === today && (data.usageCount || 0) > 0) {
        tx.update(userRef, { usageCount: data.usageCount - 1 });
      }
    });
  } catch (err) {
    console.error('Failed to refund quota:', err);
  }
}

/** Maps provider errors to actionable client messages (never leaks the key). */
function toHttpsError(err) {
  const raw = err?.message || '';
  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return new HttpsError('failed-precondition', raw);
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('"code":429')) {
    return new HttpsError('resource-exhausted', 'The image service is rate limited right now. Please try again in a minute.');
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
    return new HttpsError('failed-precondition', 'The image service credentials are invalid. Please contact support.');
  }
  console.error('Gemini error:', err);
  return new HttpsError('internal', 'Image generation failed. Please try again.');
}
