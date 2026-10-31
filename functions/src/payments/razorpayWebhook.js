const { onRequest } = require('firebase-functions/v2/https');
const { verifyWebhookSignature } = require('../lib/razorpay');
const { activateSubscription, recordPaymentOnce } = require('../lib/firestore');
const { config } = require('../config');

/**
 * Server-to-server Razorpay webhook — the authoritative source of truth for
 * subscription activation (can't be spoofed or skipped by the client, unlike
 * verifyRazorpayPayment.js which is a UX convenience path).
 *
 * Configure in Razorpay Dashboard -> Settings -> Webhooks, pointing at this
 * function's URL, subscribed to at least: payment.captured, payment.failed.
 */
exports.razorpayWebhook = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody; // Buffer — Firebase Functions v2 preserves this automatically

  if (!config.razorpay.webhookSecret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not configured.');
    res.status(500).send('Webhook not configured');
    return;
  }

  if (!signature || !verifyWebhookSignature({ rawBody, signature: String(signature) })) {
    res.status(400).send('Invalid signature');
    return;
  }

  const event = req.body;

  try {
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const payment = event.payload?.payment?.entity;
      const order = event.payload?.order?.entity;
      const notes = payment?.notes || order?.notes || {};
      const { uid, planId, billingCycle } = notes;

      if (uid && planId) {
        const isNew = await recordPaymentOnce({
          paymentId: payment?.id || `${event.event}_${Date.now()}`,
          uid,
          provider: 'razorpay',
          amount: payment?.amount,
          currency: payment?.currency,
          status: 'captured',
          raw: { event: event.event },
        });
        if (isNew) {
          const days = billingCycle === 'yearly' ? 365 : billingCycle === 'half-yearly' ? 182 : 31;
          await activateSubscription({
            uid,
            planId,
            billingCycle,
            provider: 'razorpay',
            periodEndMs: Date.now() + days * 24 * 60 * 60 * 1000,
          });
        }
      }
    }
    // payment.failed and other events: nothing to activate; logging is enough for now.

    res.status(200).send('ok');
  } catch (err) {
    console.error('razorpayWebhook error:', err);
    // Still 200 so Razorpay doesn't retry-storm on a bug in our own handling
    // of an already-verified event; the error is logged for investigation.
    res.status(200).send('logged');
  }
});
