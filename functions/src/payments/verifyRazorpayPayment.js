const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getRazorpayInstance, verifyCheckoutSignature } = require('../lib/razorpay');
const { activateSubscription, recordPaymentOnce } = require('../lib/firestore');

/**
 * Called by the client right after Razorpay Checkout succeeds, so the user
 * sees their plan activate immediately. This is a convenience/UX path only —
 * razorpayWebhook.js is the authoritative source of truth (a client could in
 * theory skip calling this, or lie about the payload) and will (re)activate
 * the subscription server-to-server regardless.
 */
exports.verifyRazorpayPayment = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before upgrading your plan.');
  }

  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = request.data || {};
  if (!orderId || !paymentId || !signature) {
    throw new HttpsError('invalid-argument', 'Missing Razorpay payment fields.');
  }

  const valid = verifyCheckoutSignature({ orderId, paymentId, signature });
  if (!valid) {
    throw new HttpsError('permission-denied', 'Payment signature verification failed.');
  }

  const razorpay = getRazorpayInstance();
  const order = await razorpay.orders.fetch(orderId);
  const { uid, planId, billingCycle } = order.notes || {};

  if (!uid || uid !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'This order does not belong to the signed-in user.');
  }

  const isNew = await recordPaymentOnce({
    paymentId,
    uid,
    provider: 'razorpay',
    amount: order.amount,
    currency: order.currency,
    status: 'captured',
    raw: { orderId, planId, billingCycle },
  });

  if (isNew) {
    const periodEndMs = computePeriodEnd(billingCycle);
    await activateSubscription({ uid, planId, billingCycle, provider: 'razorpay', periodEndMs });
  }

  return { success: true, planId, billingCycle };
});

function computePeriodEnd(billingCycle) {
  const now = Date.now();
  const days = billingCycle === 'yearly' ? 365 : billingCycle === 'half-yearly' ? 182 : 31;
  return now + days * 24 * 60 * 60 * 1000;
}
