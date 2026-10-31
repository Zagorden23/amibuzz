// Payment service (plain JavaScript) — Razorpay (cards, netbanking/e-banking,
// UPI, wallets — all bundled in Razorpay Checkout) and Stripe (international
// cards via hosted Stripe Checkout).
//
// Security note: the actual charge amount is ALWAYS computed server-side
// (see functions/src/lib/plans.js) from planId + billingCycle. The client
// never sends a price — that would let anyone pay whatever they want.

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';

const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

/**
 * Starts a Razorpay Checkout flow for the given plan.
 * Covers: credit/debit cards, netbanking (e-banking), UPI, wallets.
 *
 * @param {{ planId: string, billingCycle: string, user: { uid: string, email?: string, displayName?: string } }} params
 * @param {{ onSuccess?: (data: any) => void, onFailure?: (err: Error) => void }} handlers
 */
export async function startRazorpayCheckout({ planId, billingCycle, user }, handlers = {}) {
  const createOrder = httpsCallable(functions, 'createRazorpayOrder');
  const { data: order } = await createOrder({ planId, billingCycle });

  await loadScriptOnce(RAZORPAY_CHECKOUT_SRC);

  const options = {
    key: order.keyId,
    amount: order.amount, // paise, from server
    currency: order.currency,
    name: 'AmiBuzz',
    description: `${planId} plan — ${billingCycle}`,
    order_id: order.orderId,
    prefill: {
      name: user?.displayName || '',
      email: user?.email || '',
    },
    theme: { color: '#ef4444' },
    handler: async (response) => {
      try {
        const verify = httpsCallable(functions, 'verifyRazorpayPayment');
        const { data } = await verify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        handlers.onSuccess?.(data);
      } catch (err) {
        handlers.onFailure?.(err);
      }
    },
    modal: {
      ondismiss: () => {
        handlers.onFailure?.(new Error('Checkout closed before completing payment.'));
      },
    },
  };

  // eslint-disable-next-line no-undef -- injected by the Razorpay script
  const rzp = new Razorpay(options);
  rzp.on('payment.failed', (response) => {
    handlers.onFailure?.(new Error(response?.error?.description || 'Payment failed.'));
  });
  rzp.open();
}

/**
 * Starts a Stripe Checkout flow (hosted page) for the given plan.
 * Covers: international credit/debit cards.
 *
 * Redirects the browser to Stripe's hosted checkout page — no card details
 * ever touch our frontend or backend (PCI scope stays with Stripe).
 */
export async function startStripeCheckout({ planId, billingCycle }) {
  const createSession = httpsCallable(functions, 'createStripeCheckoutSession');
  const { data } = await createSession({ planId, billingCycle });
  window.location.assign(data.url);
}

/** Opens the Stripe customer billing portal (manage/cancel subscription, invoices). */
export async function openStripeBillingPortal() {
  const createPortal = httpsCallable(functions, 'createStripePortalSession');
  const { data } = await createPortal({});
  window.location.assign(data.url);
}
