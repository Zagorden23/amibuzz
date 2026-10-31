const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../lib/firestore');
const { generateOtp, hashOtp, generateSalt, OTP_TTL_SECONDS } = require('../lib/otp');
const { sendEmailOtp: sendEmailOtpMail } = require('../lib/sendgrid');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple per-email rate limit: don't allow a new OTP request within 30s of the last one.
const MIN_RESEND_INTERVAL_MS = 30 * 1000;

exports.sendEmailOtp = onCall({ cors: true }, async (request) => {
  const email = String(request.data?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new HttpsError('invalid-argument', 'A valid email address is required.');
  }

  const otpRef = db().collection('emailOtps').doc(email);
  const existing = await otpRef.get();
  if (existing.exists) {
    const data = existing.data();
    const createdAtMs = data.createdAt?.toMillis?.() ?? 0;
    if (Date.now() - createdAtMs < MIN_RESEND_INTERVAL_MS) {
      throw new HttpsError('resource-exhausted', 'Please wait a few seconds before requesting another code.');
    }
  }

  const otp = generateOtp();
  const salt = generateSalt();
  const hash = hashOtp(otp, salt);

  await otpRef.set({
    hash,
    salt,
    attempts: 0,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
  });

  // If delivery fails, drop the code so the user can retry immediately
  // instead of sitting behind the 30s resend throttle with a dead code.
  try {
    await sendEmailOtpMail(email, otp);
  } catch (err) {
    await otpRef.delete().catch(() => {});
    throw err;
  }

  return { success: true, expiresInSeconds: OTP_TTL_SECONDS };
});
