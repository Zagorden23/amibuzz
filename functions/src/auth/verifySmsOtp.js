const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../lib/firestore');
const { hashOtp, MAX_ATTEMPTS } = require('../lib/otp');

const E164_RE = /^\+[1-9]\d{7,14}$/;

exports.verifySmsOtp = onCall({ cors: true }, async (request) => {
  const phoneNumber = String(request.data?.phoneNumber || '').trim();
  const code = String(request.data?.code || '').trim();

  if (!E164_RE.test(phoneNumber) || !/^\d{6}$/.test(code)) {
    throw new HttpsError('invalid-argument', 'A valid phone number and 6-digit code are required.');
  }

  const otpRef = db().collection('smsOtps').doc(phoneNumber);
  const snap = await otpRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No verification code was requested for this number, or it already expired.');
  }

  const data = snap.data();
  const expiresAtMs = data.expiresAt?.toMillis?.() ?? 0;

  if (Date.now() > expiresAtMs) {
    await otpRef.delete();
    throw new HttpsError('deadline-exceeded', 'This code has expired. Please request a new one.');
  }

  if ((data.attempts || 0) >= MAX_ATTEMPTS) {
    await otpRef.delete();
    throw new HttpsError('resource-exhausted', 'Too many incorrect attempts. Please request a new code.');
  }

  const candidateHash = hashOtp(code, data.salt);
  if (candidateHash !== data.hash) {
    await otpRef.update({ attempts: FieldValue.increment(1) });
    throw new HttpsError('invalid-argument', 'Incorrect code. Please try again.');
  }

  // Correct code — consume it so it can't be replayed.
  await otpRef.delete();

  // Find or create the Firebase Auth user for this phone number.
  const auth = getAuth();
  let userRecord;
  try {
    userRecord = await auth.getUserByPhoneNumber(phoneNumber);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      userRecord = await auth.createUser({ phoneNumber });
    } else {
      throw err;
    }
  }

  // Ensure a Firestore profile exists, without clobbering an existing plan.
  const userRef = db().collection('users').doc(userRecord.uid);
  const userSnap = await userRef.get();
  await userRef.set(
    {
      phoneNumber,
      createdVia: userSnap.exists ? (userSnap.data().createdVia ?? 'sms-otp') : 'sms-otp',
      plan: userSnap.exists ? (userSnap.data().plan ?? 'free') : 'free',
      lastSignInAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const token = await auth.createCustomToken(userRecord.uid);
  return { token };
});
