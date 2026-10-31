// Shared plan configuration for the client UI.
//
// IMPORTANT: this file is for DISPLAY and optimistic UI only. The server is
// the authority for both pricing (functions/src/lib/plans.js) and quota
// enforcement (functions/src/usage/consumeGeneration.js). Never trust these
// numbers for anything that must not be bypassed — a user can edit them in
// the browser.

export const PLANS = {
  free: {
    id: 'free',
    label: 'Base',
    badge: 'Free Plan',
    sidebarLabel: 'Free Plan',
    dailyGenerations: 5,
    monthlyInr: 0,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    badge: 'Pro Member',
    sidebarLabel: 'Pro Creator',
    dailyGenerations: 30,
    monthlyInr: 200,
  },
  proPlus: {
    id: 'proPlus',
    label: 'Pro Plus',
    badge: 'Pro Plus Member',
    sidebarLabel: 'Pro Plus Creator',
    dailyGenerations: 50,
    monthlyInr: 350,
  },
};

/** Resolves a Firestore profile to its plan config, defaulting to free. */
export function planFor(profile) {
  return PLANS[profile?.plan] || PLANS.free;
}
