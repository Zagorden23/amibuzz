// Scheduled maintenance: marks paid subscriptions whose currentPeriodEnd has
// passed as `expired`. This is defense-in-depth — quota enforcement already
// falls back to the free plan via getEffectivePlan() — but it keeps the stored
// status truthful so the UI ("Status: expired") and any future logic agree.
//
// Runs daily; Stripe/Razorpay webhooks still handle the real-time paths
// (activation on payment, cancellation on subscription.deleted).

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../lib/firestore');

exports.expireSubscriptions = onSchedule(
  { schedule: 'every 24 hours', timeZone: 'Etc/UTC' },
  async () => {
    const now = Date.now();
    const snap = await db().collection('users').where('subscriptionStatus', '==', 'active').get();
    const due = snap.docs.filter((d) => {
      const end = d.data()?.currentPeriodEnd;
      return typeof end === 'number' && end < now;
    });
    for (let i = 0; i < due.length; i += 400) {
      const batch = db().batch();
      due.slice(i, i + 400).forEach((d) => {
        batch.set(
          d.ref,
          { subscriptionStatus: 'expired', updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      });
      await batch.commit();
    }
    console.log(`expireSubscriptions: marked ${due.length} subscriptions expired (of ${snap.size} active)`);
  }
);
