const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getStripeInstance } = require('../lib/stripe');
const { assertValidPlan, assertValidCycle, getPriceInUsdCents, getPlanLabel } = require('../lib/plans');
const { db } = require('../lib/firestore');
const { config } = require('../config');

exports.createStripeCheckoutSession = onCall({ cors: true }, async (request) => {
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

  // A plain Error would reach the client as an opaque "INTERNAL"; HttpsError
  // messages are passed through, so a misconfigured deployment says so.
  let stripe;
  try {
    stripe = getStripeInstance();
  } catch (err) {
    throw new HttpsError('failed-precondition', err.message);
  }
  const amount = getPriceInUsdCents(planId, billingCycle); // server-computed

  // Reuse an existing Stripe customer for this user if we have one on file.
  const userRef = db().collection('users').doc(request.auth.uid);
  const userSnap = await userRef.get();
  let stripeCustomerId = userSnap.data()?.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: request.auth.token.email || undefined,
      metadata: { uid: request.auth.uid },
    });
    stripeCustomerId = customer.id;
    await userRef.set({ stripeCustomerId }, { merge: true });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          product_data: {
            name: `AmiBuzz ${getPlanLabel(planId)} — ${billingCycle}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      uid: request.auth.uid,
      planId,
      billingCycle,
    },
    success_url: `${config.appUrl}/?checkout=success`,
    cancel_url: `${config.appUrl}/?checkout=cancelled`,
  });

  return { url: session.url };
});
