// Scheduled maintenance: deletes expired OTP docs so emailOtps/smsOtps
// never accumulate. This is the code-enforced equivalent of a Firestore TTL
// policy on `expiresAt` (TTL must otherwise be clicked through in the
// console: Firestore -> each collection -> ... -> "Manage TTL policy") —
// running both is harmless, the query below simply finds nothing.

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { db } = require('../lib/firestore');

async function deleteExpiredDocs(collectionName) {
  const now = new Date();
  let total = 0;
  for (;;) {
    // Single-field inequality needs no composite index.
    const snap = await db().collection(collectionName).where('expiresAt', '<', now).limit(400).get();
    if (snap.empty) break;
    const batch = db().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  return total;
}

exports.cleanupExpiredOtps = onSchedule(
  { schedule: 'every 60 minutes', timeZone: 'Etc/UTC' },
  async () => {
    const email = await deleteExpiredDocs('emailOtps');
    const sms = await deleteExpiredDocs('smsOtps');
    console.log(`cleanupExpiredOtps: deleted ${email} email + ${sms} sms OTP docs`);
  }
);
