const Stripe = require('stripe');
const { config } = require('../config');

let instance = null;
function getStripeInstance() {
  if (!config.stripe.secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured — see functions/.env.example.');
  }
  if (!instance) {
    instance = new Stripe(config.stripe.secretKey, { apiVersion: '2024-12-18.acacia' });
  }
  return instance;
}

module.exports = { getStripeInstance };
