const { getFirestore, FieldValue } = require('firebase-admin/firestore');

function db() {
  return getFirestore();
}

/** Upserts users/{uid} with subscription fields after a successful payment. */
async function activateSubscription({ uid, planId, billingCycle, provider, periodEndMs, stripeCustomerId }) {
  const ref = db().collection('users').doc(uid);
  const update = {
    plan: planId,
    billingCycle,
    subscriptionStatus: 'active',
    subscriptionProvider: provider,
    currentPeriodEnd: periodEndMs || null,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (stripeCustomerId) update.stripeCustomerId = stripeCustomerId;
  await ref.set(update, { merge: true });
}

async function markSubscriptionCanceled({ uid }) {
  await db().collection('users').doc(uid).set(
    {
      subscriptionStatus: 'canceled',
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/** Records a payment for auditing/idempotency. Returns false if this paymentId was already recorded. */
async function recordPaymentOnce({ paymentId, uid, provider, amount, currency, status, raw }) {
  const ref = db().collection('payments').doc(paymentId);
  const existing = await ref.get();
  if (existing.exists) return false;
  await ref.set({
    uid: uid || null,
    provider,
    amount,
    currency,
    status,
    raw: raw || null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return true;
}

async function findUidByStripeCustomerId(stripeCustomerId) {
  const snap = await db().collection('users').where('stripeCustomerId', '==', stripeCustomerId).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

module.exports = {
  db,
  activateSubscription,
  markSubscriptionCanceled,
  recordPaymentOnce,
  findUidByStripeCustomerId,
};
