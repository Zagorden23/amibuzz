import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sidebar } from '../components/layout/Sidebar.jsx';
import { Check, Zap, Star, Shield, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { TiltCard } from '../components/ui/TiltCard.jsx';
import { CheckoutModal } from '../components/payment/CheckoutModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { playPop } from '../lib/audio.js';

// Server-side source of truth for base monthly INR prices
const basePrices = {
  free: 0,
  pro: 200,
  proPlus: 350,
};

export const Pricing = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [checkout, setCheckout] = useState(null);

  const calculatePrice = (basePrice) => {
    if (basePrice === 0) return 0;
    let multiplier = 1;
    if (billingCycle === 'half-yearly') multiplier = 6;
    if (billingCycle === 'yearly') multiplier = 12;

    const totalBasePrice = basePrice * multiplier;
    if (billingCycle === 'half-yearly') return (totalBasePrice * 0.75).toFixed(0);
    if (billingCycle === 'yearly') return (totalBasePrice * 0.65).toFixed(0);
    return totalBasePrice.toFixed(0);
  };

  const getDiscountBadge = () => {
    if (billingCycle === 'half-yearly') return '25% OFF';
    if (billingCycle === 'yearly') return '35% OFF';
    return null;
  };

  const currentPlan = profile?.plan || 'free';

  const openCheckout = (planId, planName) => {
    playPop();
    if (!user) {
      onNavigate('auth');
      return;
    }
    setCheckout({ planId, planName });
  };

  const handleCycleChange = (cycle) => {
    playPop();
    setBillingCycle(cycle);
  };

  return (
    <div className="flex h-screen bg-[#0f0913] text-slate-100 overflow-hidden">
      <Sidebar currentPath="pricing" onNavigate={onNavigate} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1920px] mx-auto px-4 lg:px-8 py-8 lg:py-12 pt-20 lg:pt-12">
          <div className="text-center mb-12">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-black mb-4"
            >
              Upgrade Your <span className="rgb-text">Anime Creativity</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base"
            >
              Choose the tier to unlock 30 to 50 daily generations, transparent die-cut contours, and watermark-free exports.
            </motion.p>

            {!user && (
              <div className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-4 py-2">
                <AlertCircle size={15} /> Sign in before upgrading your plan.
              </div>
            )}

            {/* Billing Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 inline-flex items-center p-1 bg-white/5 border border-white/10 rounded-full shadow-lg"
            >
              <button
                onClick={() => handleCycleChange('monthly')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                  billingCycle === 'monthly' ? 'bg-red-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => handleCycleChange('half-yearly')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                  billingCycle === 'half-yearly' ? 'bg-red-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                6 Months (25% Off)
              </button>
              <button
                onClick={() => handleCycleChange('yearly')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                  billingCycle === 'yearly' ? 'bg-red-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Yearly (35% Off)
              </button>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Free Tier */}
            <TiltCard>
              <div className="h-full bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col relative">
                <h3 className="text-2xl font-bold mb-2">Base Free</h3>
                <p className="text-slate-400 text-xs mb-6">Perfect for discovering anime sticker creation.</p>
                <div className="mb-8">
                  <span className="text-4xl font-black">₹0</span>
                  <span className="text-slate-500 text-sm">/forever</span>
                </div>
                <ul className="space-y-3.5 mb-8 flex-1">
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300">Max <strong className="text-white">5 stickers/GIFs</strong> daily</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300">Standard anime generation</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300">Access to all 8 art styles</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300">Watermarked exports</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full text-xs font-bold" onClick={() => onNavigate('generator')}>
                  {currentPlan === 'free' ? 'Current Plan' : 'Downgrade'}
                </Button>
              </div>
            </TiltCard>

            {/* Pro Tier */}
            <TiltCard>
              <div className="h-full bg-gradient-to-b from-red-500/20 to-black/40 border border-red-500/50 rounded-3xl p-8 flex flex-col relative transform md:-translate-y-4 shadow-2xl shadow-red-500/10">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-black uppercase tracking-wider py-1 px-3.5 rounded-full flex items-center gap-1 shadow-lg">
                  <Zap size={13} fill="currentColor" /> Most Popular
                </div>
                {getDiscountBadge() && (
                  <div className="absolute top-4 right-4 bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-bold py-0.5 px-2 rounded-md">
                    {getDiscountBadge()}
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-1 text-white">Pro Creator</h3>
                <p className="text-red-200/70 text-xs mb-6">For anime artists & Discord server admins.</p>
                <div className="mb-8 flex flex-wrap items-baseline gap-1">
                  <span className="text-4xl font-black text-white">₹{calculatePrice(basePrices.pro)}</span>
                  <span className="text-slate-400 text-xs">/{billingCycle === 'monthly' ? 'mo' : billingCycle === 'half-yearly' ? '6mo' : 'yr'}</span>
                  {billingCycle !== 'monthly' && (
                    <div className="w-full text-[11px] text-slate-500 line-through mt-0.5">
                      Was ₹{(basePrices.pro * (billingCycle === 'half-yearly' ? 6 : 12)).toFixed(0)}
                    </div>
                  )}
                </div>
                <ul className="space-y-3.5 mb-8 flex-1">
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-white">Max <strong className="text-red-400">30 stickers/GIFs</strong> daily</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-white">Fast generation speed</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-white">Die-Cut customizer & text ribbon</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-white">No watermarks</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-white">Full commercial usage rights</span>
                  </li>
                </ul>
                <Button
                  className="w-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25 text-xs font-bold"
                  onClick={() => openCheckout('pro', 'Pro')}
                  disabled={currentPlan === 'pro'}
                >
                  {currentPlan === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
                </Button>
              </div>
            </TiltCard>

            {/* Pro Plus Tier */}
            <TiltCard>
              <div className="h-full bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col relative">
                {getDiscountBadge() && (
                  <div className="absolute top-4 right-4 bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-bold py-0.5 px-2 rounded-md">
                    {getDiscountBadge()}
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">Pro Plus <Star size={18} className="text-yellow-400" fill="currentColor" /></h3>
                <p className="text-slate-400 text-xs mb-6">For commercial brands and creators.</p>
                <div className="mb-8 flex flex-wrap items-baseline gap-1">
                  <span className="text-4xl font-black">₹{calculatePrice(basePrices.proPlus)}</span>
                  <span className="text-slate-500 text-xs">/{billingCycle === 'monthly' ? 'mo' : billingCycle === 'half-yearly' ? '6mo' : 'yr'}</span>
                  {billingCycle !== 'monthly' && (
                    <div className="w-full text-[11px] text-slate-500 line-through mt-0.5">
                      Was ₹{(basePrices.proPlus * (billingCycle === 'half-yearly' ? 6 : 12)).toFixed(0)}
                    </div>
                  )}
                </div>
                <ul className="space-y-3.5 mb-8 flex-1">
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300">Max <strong className="text-white">50 stickers/GIFs</strong> daily</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300">Priority AI queue</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300">High-Resolution 1024x1024 export</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300">Unlimited Printable Sticker Sheets</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300">Bulk pack downloads</span>
                  </li>
                </ul>
                <Button
                  variant="outline"
                  className="w-full hover:bg-white/10 text-xs font-bold"
                  onClick={() => openCheckout('proPlus', 'Pro Plus')}
                  disabled={currentPlan === 'proPlus'}
                >
                  {currentPlan === 'proPlus' ? 'Current Plan' : 'Upgrade to Pro Plus'}
                </Button>
              </div>
            </TiltCard>
          </div>

          {/* Security Notice */}
          <div className="mt-16 max-w-3xl mx-auto bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex items-start gap-4">
            <Shield className="text-blue-400 shrink-0 mt-1" size={22} />
            <div>
              <h4 className="text-sm font-bold text-blue-100 mb-1">Encrypted Payment Processing</h4>
              <p className="text-xs text-blue-200/70 leading-relaxed">
                Transactions are securely processed through Razorpay (UPI, Netbanking, Cards) and Stripe (International cards).
                AmiBuzz never stores raw card or financial credentials.
              </p>
            </div>
          </div>
        </div>
      </main>

      <CheckoutModal
        open={Boolean(checkout)}
        onClose={() => setCheckout(null)}
        planId={checkout?.planId}
        planName={checkout?.planName}
        billingCycle={billingCycle}
      />
    </div>
  );
};
