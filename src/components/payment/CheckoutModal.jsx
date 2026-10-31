// Checkout provider picker (plain JavaScript/JSX) — lets the user choose
// Razorpay (cards, netbanking/e-banking, UPI — India) or Stripe (international
// cards), then kicks off the real payment flow from paymentService.js.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, Landmark, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { startRazorpayCheckout, startStripeCheckout } from '../../services/paymentService.js';

export const CheckoutModal = ({ open, onClose, planId, planName, billingCycle }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | processing | success | error
  const [errorMessage, setErrorMessage] = useState('');

  if (!open) return null;

  const requireAuth = () => {
    if (!user) {
      setStatus('error');
      setErrorMessage('Please sign in before upgrading your plan.');
      return false;
    }
    return true;
  };

  const handleRazorpay = async () => {
    if (!requireAuth()) return;
    setStatus('processing');
    setErrorMessage('');
    try {
      await startRazorpayCheckout(
        { planId, billingCycle, user },
        {
          onSuccess: () => setStatus('success'),
          onFailure: (err) => {
            setStatus('error');
            setErrorMessage(err.message || 'Payment failed.');
          },
        }
      );
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Could not start Razorpay checkout.');
    }
  };

  const handleStripe = async () => {
    if (!requireAuth()) return;
    setStatus('processing');
    setErrorMessage('');
    try {
      // Redirects the browser to Stripe's hosted page — no further UI needed here.
      await startStripeCheckout({ planId, billingCycle });
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Could not start Stripe checkout.');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-[#140c1a] border border-white/10 rounded-3xl p-6 md:p-8 relative shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {status === 'success' ? (
            <div className="text-center py-6">
              <CheckCircle2 className="mx-auto text-green-400 mb-4" size={48} />
              <h3 className="text-xl font-bold text-white mb-2">Payment successful!</h3>
              <p className="text-slate-400 text-sm mb-6">
                Your {planName} plan is now active. It may take a few seconds to reflect.
              </p>
              <Button className="w-full" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <>
              <h3 className="text-xl font-bold text-white mb-1">Upgrade to {planName}</h3>
              <p className="text-slate-400 text-sm mb-6">
                Billing: <span className="text-slate-200 font-semibold">{billingCycle}</span>. Choose a payment method.
              </p>

              {status === 'error' && (
                <div className="mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl p-3">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleRazorpay}
                  disabled={status === 'processing'}
                  className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-left disabled:opacity-50"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                    <Landmark size={20} className="text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white">Razorpay</div>
                    <div className="text-xs text-slate-400">Cards, Netbanking (e-banking), UPI, wallets — India</div>
                  </div>
                  {status === 'processing' && <Loader2 className="animate-spin text-slate-400" size={18} />}
                </button>

                <button
                  onClick={handleStripe}
                  disabled={status === 'processing'}
                  className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-left disabled:opacity-50"
                >
                  <div className="w-11 h-11 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                    <CreditCard size={20} className="text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white">Card via Stripe</div>
                    <div className="text-xs text-slate-400">International credit/debit cards</div>
                  </div>
                  {status === 'processing' && <Loader2 className="animate-spin text-slate-400" size={18} />}
                </button>
              </div>

              <p className="text-xs text-slate-600 mt-6 text-center">
                Payments are processed securely by Razorpay/Stripe. We never see or store your card details.
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
