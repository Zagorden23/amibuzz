const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getRazorpayInstance } = require('../lib/razorpay');
const { assertValidPlan, assertValidCycle, getPriceInPaise } = require('../lib/plans');
const { config } = require('../config');

exports.createRazorpayOrder = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before upgrading your plan.');
  }
  const planId = String(request.data?.planId || '');
  const billingCycle = String(request.data?.billingCycle || 'monthly');

  try {
    assertValidPlan(planId);
    assertValidCycle(billingCycle);
  } catch (err) {
    throw new HttpsError('invalid-argument', err.message);
  }

  const amount = getPriceInPaise(planId, billingCycle); // server-computed, never client-supplied

  // A plain Error would reach the client as an opaque "INTERNAL"; HttpsError
  // messages are passed through, so a misconfigured deployment says so.
  let razorpay;
  try {
    razorpay = getRazorpayInstance();
  } catch (err) {
    throw new HttpsError('failed-precondition', err.message);
  }

  const order = await razorpay.orders.create({
    amount,
    currency: 'INR',
    receipt: `${request.auth.uid}_${planId}_${Date.now()}`,
    notes: {
      uid: request.auth.uid,
      planId,
      billingCycle,
    },
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: config.razorpay.keyId,
  };
});
