const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../lib/firestore');
const { generateOtp, hashOtp, generateSalt, OTP_TTL_SECONDS } = require('../lib/otp');
const { sendSmsOtp: sendSmsOtpText } = require('../lib/msg91');

const E164_RE = /^\+[1-9]\d{7,14}$/;

// Simple per-number rate limit: don't allow a new OTP request within 30s of the last one.
const MIN_RESEND_INTERVAL_MS = 30 * 1000;

exports.sendSmsOtp = onCall({ cors: true }, async (request) => {
  const phoneNumber = String(request.data?.phoneNumber || '').trim();
  if (!E164_RE.test(phoneNumber)) {
    throw new HttpsError('invalid-argument', 'A valid phone number in international format is required, e.g. +919876543210.');
  }

  const otpRef = db().collection('smsOtps').doc(phoneNumber);
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
    await sendSmsOtpText(phoneNumber, otp);
  } catch (err) {
    await otpRef.delete().catch(() => {});
    throw err;
  }

  return { success: true, expiresInSeconds: OTP_TTL_SECONDS };
});
