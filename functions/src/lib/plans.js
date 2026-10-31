// Server-side source of truth for plan pricing. The client (src/pages/Pricing.jsx)
// mirrors this for display, but the CHARGE AMOUNT always comes from here —
// never trust a price sent by the client.

const BASE_MONTHLY_INR = {
  pro: 200,
  proPlus: 350,
};

// Daily generation quota per plan. This is the ENFORCED limit — the client
// mirror in src/lib/plans.js is for display only.
const DAILY_GENERATIONS = {
  free: 5,
  pro: 30,
  proPlus: 50,
};

function getDailyQuota(planId) {
  return DAILY_GENERATIONS[planId] ?? DAILY_GENERATIONS.free;
}

// Keep in sync with the Pricing page's discount logic.
const CYCLE_MULTIPLIER = {
  monthly: 1,
  'half-yearly': 6,
  yearly: 12,
};
const CYCLE_DISCOUNT = {
  monthly: 0,
  'half-yearly': 0.25,
  yearly: 0.35,
};

// Rough USD equivalent for Stripe (international cards). Adjust to your
// actual pricing strategy / use Stripe's multi-currency Prices instead of
// computing this by hand once you're past the prototype stage.
const INR_TO_USD_CENTS_PER_RUPEE = 1.2; // ~ $0.012 per ₹1, i.e. divide by ~83 and *100

function assertValidPlan(planId) {
  if (!BASE_MONTHLY_INR[planId]) {
    throw new Error(`Unknown planId: ${planId}`);
  }
}

function assertValidCycle(billingCycle) {
  if (!(billingCycle in CYCLE_MULTIPLIER)) {
    throw new Error(`Unknown billingCycle: ${billingCycle}`);
  }
}

/** Returns the amount in whole INR rupees for a plan + billing cycle. */
function getPriceInInr(planId, billingCycle) {
  assertValidPlan(planId);
  assertValidCycle(billingCycle);
  const base = BASE_MONTHLY_INR[planId] * CYCLE_MULTIPLIER[billingCycle];
  const discount = CYCLE_DISCOUNT[billingCycle];
  return Math.round(base * (1 - discount));
}

/** Returns the amount in paise (INR's smallest unit) for Razorpay. */
function getPriceInPaise(planId, billingCycle) {
  return getPriceInInr(planId, billingCycle) * 100;
}

/** Returns the amount in USD cents for Stripe. */
function getPriceInUsdCents(planId, billingCycle) {
  const inr = getPriceInInr(planId, billingCycle);
  return Math.round(inr * INR_TO_USD_CENTS_PER_RUPEE);
}

function getPlanLabel(planId) {
  return planId === 'proPlus' ? 'Pro Plus' : 'Pro';
}

/**
 * Resolves the ENFORCED plan for a users/{uid} profile snapshot.
 * A paid plan only counts while its subscription is active and unexpired —
 * otherwise it falls back to free so canceled/expired users lose paid quota.
 * Profiles with no period info (legacy) keep their stored plan.
 */
function getEffectivePlan(data, nowMs = Date.now()) {
  const plan = data?.plan || 'free';
  if (plan === 'free') return 'free';
  if (data?.subscriptionStatus && data.subscriptionStatus !== 'active') return 'free';
  if (data?.currentPeriodEnd && nowMs > data.currentPeriodEnd) return 'free';
  return plan;
}

module.exports = {
  BASE_MONTHLY_INR,
  DAILY_GENERATIONS,
  getDailyQuota,
  assertValidPlan,
  assertValidCycle,
  getPriceInInr,
  getPriceInPaise,
  getPriceInUsdCents,
  getPlanLabel,
  getEffectivePlan,
};
