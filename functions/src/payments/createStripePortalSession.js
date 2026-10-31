const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getStripeInstance } = require('../lib/stripe');
const { db } = require('../lib/firestore');
const { config } = require('../config');

exports.createStripePortalSession = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }

  const userSnap = await db().collection('users').doc(request.auth.uid).get();
  const stripeCustomerId = userSnap.data()?.stripeCustomerId;
  if (!stripeCustomerId) {
    throw new HttpsError('failed-precondition', 'No Stripe subscription found for this account.');
  }

  // A plain Error would reach the client as an opaque "INTERNAL"; HttpsError
  // messages are passed through, so a misconfigured deployment says so.
  let stripe;
  try {
    stripe = getStripeInstance();
  } catch (err) {
    throw new HttpsError('failed-precondition', err.message);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${config.appUrl}/`,
  });

  return { url: session.url };
});
