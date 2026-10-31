const Razorpay = require('razorpay');
const crypto = require('crypto');
const { config } = require('../config');

let instance = null;
function getRazorpayInstance() {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured — see functions/.env.example.');
  }
  if (!instance) {
    instance = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return instance;
}

/** Verifies the client-returned checkout signature: HMAC_SHA256(order_id|payment_id, key_secret). */
function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return timingSafeEqualHex(expected, signature);
}

/** Verifies a webhook payload signature against RAZORPAY_WEBHOOK_SECRET. */
function verifyWebhookSignature({ rawBody, signature }) {
  const expected = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

module.exports = { getRazorpayInstance, verifyCheckoutSignature, verifyWebhookSignature };
