const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../lib/firestore');
const { hashOtp, MAX_ATTEMPTS } = require('../lib/otp');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.verifyEmailOtp = onCall({ cors: true }, async (request) => {
  const email = String(request.data?.email || '').trim().toLowerCase();
  const code = String(request.data?.code || '').trim();

  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
    throw new HttpsError('invalid-argument', 'A valid email and 6-digit code are required.');
  }

  const otpRef = db().collection('emailOtps').doc(email);
  const snap = await otpRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No verification code was requested for this email, or it already expired.');
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

  // Find or create the Firebase Auth user for this email.
  const auth = getAuth();
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      userRecord = await auth.createUser({ email, emailVerified: true });
    } else {
      throw err;
    }
  }

  if (!userRecord.emailVerified) {
    await auth.updateUser(userRecord.uid, { emailVerified: true });
  }

  // Ensure a Firestore profile exists, without clobbering an existing plan.
  const userRef = db().collection('users').doc(userRecord.uid);
  const userSnap = await userRef.get();
  await userRef.set(
    {
      email,
      createdVia: userSnap.exists ? (userSnap.data().createdVia ?? 'email-otp') : 'email-otp',
      plan: userSnap.exists ? (userSnap.data().plan ?? 'free') : 'free',
      lastSignInAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const token = await auth.createCustomToken(userRecord.uid);
  return { token };
});
