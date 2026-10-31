// One-shot script: registers (or verifies) the Stripe webhook endpoint for
// `stripeWebhook` so `checkout.session.completed` + `customer.subscription.deleted`
// events reach the backend. Run after deploying the function:
//
//   set STRIPE_SECRET_KEY=sk_live_...        (PowerShell: $env:STRIPE_SECRET_KEY="sk_live_...")
//   set STRIPE_WEBHOOK_URL=https://<region>-<project>.cloudfunctions.net/stripeWebhook
//   node scripts/ensureStripeWebhook.js
//
// from the functions/ directory. Idempotent: if an enabled endpoint with the
// same URL already exists, it only ensures the required events are enabled.

const Stripe = require('stripe');

const REQUIRED_EVENTS = ['checkout.session.completed', 'customer.subscription.deleted'];

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const url = process.env.STRIPE_WEBHOOK_URL;
  if (!secretKey || !url) {
    console.error('Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_URL before running.');
    process.exit(1);
  }
  const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });

  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = existing.data.find((ep) => ep.url === url && ep.status === 'enabled');

  if (match) {
    const missing = REQUIRED_EVENTS.filter((e) => !(match.enabled_events || []).includes(e) && !(match.enabled_events || []).includes('*'));
    if (missing.length === 0) {
      console.log(`OK: webhook endpoint already configured (${match.id}). Secret: use STRIPE_WEBHOOK_SECRET from the Stripe dashboard for this endpoint.`);
      return;
    }
    const updated = await stripe.webhookEndpoints.update(match.id, {
      enabled_events: Array.from(new Set([...(match.enabled_events || []), ...missing])),
    });
    console.log(`Updated ${updated.id}: now subscribed to ${updated.enabled_events.join(', ')}`);
    return;
  }

  const created = await stripe.webhookEndpoints.create({
    url,
    enabled_events: REQUIRED_EVENTS,
    description: 'AmiBuzz subscription activation + cancellation',
  });
  console.log(`Created webhook endpoint ${created.id} for ${url}.`);
  console.log(`IMPORTANT: copy its Signing secret (whsec_...) into STRIPE_WEBHOOK_SECRET (functions/.env + deployed secrets). Secret is shown ONCE in the dashboard.`);
}

main().catch((err) => {
  console.error('ensureStripeWebhook failed:', err.message);
  process.exit(1);
});
