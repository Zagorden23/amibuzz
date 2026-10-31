import React from 'react';
import { Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { planFor } from '../../lib/plans.js';

/**
 * Header pill showing the signed-in user's ACTUAL plan, and linking to
 * Pricing. Replaces the hardcoded "Pro Member" text that used to be
 * duplicated across Dashboard/Generator/GifLab/Support.
 */
export const PlanBadge = ({ onNavigate, className = '' }) => {
  const { profile } = useAuth();
  const plan = planFor(profile);
  const isPaid = plan.id !== 'free';

  return (
    <button
      onClick={() => onNavigate('pricing')}
      title={isPaid ? 'Manage your plan' : 'Upgrade your plan'}
      className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold transition-colors cursor-pointer ${
        isPaid
          ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
      } ${className}`}
    >
      <Zap size={16} fill={isPaid ? 'currentColor' : 'none'} />
      <span>{isPaid ? plan.badge : 'Upgrade'}</span>
    </button>
  );
};
