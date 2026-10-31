const { onRequest } = require('firebase-functions/v2/https');
const { getStripeInstance } = require('../lib/stripe');
const { activateSubscription, recordPaymentOnce, markSubscriptionCanceled, findUidByStripeCustomerId } = require('../lib/firestore');
const { config } = require('../config');

/**
 * Server-to-server Stripe webhook — authoritative source of truth for
 * subscription activation. Configure in Stripe Dashboard -> Developers ->
 * Webhooks, pointing at this function's URL, subscribed to at least:
 * checkout.session.completed, customer.subscription.deleted.
 */
exports.stripeWebhook = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  let stripe;
  try {
    stripe = getStripeInstance();
  } catch (err) {
    console.error('Stripe is not configured:', err.message);
    res.status(500).send('Webhook not configured');
    return;
  }
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, config.stripe.webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { uid, planId, billingCycle } = session.metadata || {};

      if (uid && planId) {
        const isNew = await recordPaymentOnce({
          paymentId: session.payment_intent || session.id,
          uid,
          provider: 'stripe',
          amount: session.amount_total,
          currency: session.currency,
          status: 'paid',
          raw: { sessionId: session.id },
        });
        if (isNew) {
          const days = billingCycle === 'yearly' ? 365 : billingCycle === 'half-yearly' ? 182 : 31;
          await activateSubscription({
            uid,
            planId,
            billingCycle,
            provider: 'stripe',
            periodEndMs: Date.now() + days * 24 * 60 * 60 * 1000,
            stripeCustomerId: session.customer,
          });
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      // Authoritative downgrade: drop paid quota as soon as Stripe ends it.
      const subscription = event.data.object;
      const uid = subscription.metadata?.uid
        || await findUidByStripeCustomerId(subscription.customer);
      if (uid) {
        await markSubscriptionCanceled({ uid });
      } else {
        console.warn('stripeWebhook: could not map deleted subscription to a uid:', subscription.id);
      }
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('stripeWebhook error:', err);
    res.status(200).send('logged');
  }
});
