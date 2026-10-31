const crypto = require('crypto');

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const MAX_ATTEMPTS = 5;

function generateOtp() {
  // Cryptographically-random 6-digit code (zero-padded).
  const n = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return String(n).padStart(OTP_LENGTH, '0');
}

function hashOtp(otp, salt) {
  return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  OTP_TTL_SECONDS,
  MAX_ATTEMPTS,
  generateOtp,
  hashOtp,
  generateSalt,
};
