const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../lib/firestore');
const { getDailyQuota, getEffectivePlan } = require('../lib/plans');

/**
 * Lazily creates a free users/{uid} profile for accounts that don't have one
 * yet (e.g. Google/Apple/Microsoft OAuth sign-ins, which never pass through
 * the OTP verify functions). Runs inside the caller's transaction.
 */
function ensureProfileData(tx, userRef, snap, token) {
  if (snap.exists) return snap.data();
  const fresh = {
    email: token?.email || null,
    displayName: token?.name || null,
    createdVia: 'oauth',
    plan: 'free',
    usageDate: new Date().toISOString().slice(0, 10),
    usageCount: 0,
  };
  tx.set(userRef, fresh, { merge: true });
  return fresh;
}

/**
 * Atomically claims one generation against the caller's daily quota.
 *
 * This is the ENFORCED limit. The Generator page also tracks a count for the
 * UI, but that's cosmetic — a user can edit client state freely, so the quota
 * has to be decided here, against the plan stored in Firestore (which only
 * the payment webhooks can change).
 *
 * Runs in a transaction so parallel requests can't race past the limit.
 */
exports.consumeGeneration = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to generate stickers.');
  }

  const uid = request.auth.uid;
  const userRef = db().collection('users').doc(uid);
  // UTC day key, so the window is unambiguous regardless of client timezone.
  const today = new Date().toISOString().slice(0, 10);

  return db().runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const data = ensureProfileData(tx, userRef, snap, request.auth.token);

    const plan = getEffectivePlan(data);
    const quota = getDailyQuota(plan);

    // Reset the counter when the stored day key isn't today.
    const usedToday = data.usageDate === today ? data.usageCount || 0 : 0;

    if (usedToday >= quota) {
      throw new HttpsError(
        'resource-exhausted',
        `Daily limit reached (${quota} generations on the ${plan} plan). Upgrade for more.`
      );
    }

    tx.set(
      userRef,
      {
        usageDate: today,
        usageCount: usedToday + 1,
        lastGenerationAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      allowed: true,
      plan,
      quota,
      used: usedToday + 1,
      remaining: quota - (usedToday + 1),
    };
  });
});

/** Read-only view of the caller's quota, for rendering the UI on page load. */
exports.getUsage = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }

  const snap = await db().collection('users').doc(request.auth.uid).get();
  const data = snap.exists ? snap.data() : {};
  const plan = getEffectivePlan(data);
  const quota = getDailyQuota(plan);
  const today = new Date().toISOString().slice(0, 10);
  const used = data.usageDate === today ? data.usageCount || 0 : 0;

  return { plan, quota, used, remaining: Math.max(0, quota - used) };
});
