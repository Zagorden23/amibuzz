// Usage/quota service — talks to the server-side quota enforcer.
// The server decides whether a generation is allowed; the client only renders
// the result.

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';

/**
 * Claims one generation against the daily quota.
 * Throws (code 'functions/resource-exhausted') when the limit is reached.
 * @returns {Promise<{allowed: boolean, plan: string, quota: number, used: number, remaining: number}>}
 */
export async function consumeGeneration() {
  if (!functions) throw new Error('Firebase is not configured.');
  const callable = httpsCallable(functions, 'consumeGeneration');
  const res = await callable({});
  return res.data;
}

/** Reads the caller's current quota state without consuming anything. */
export async function getUsage() {
  if (!functions) throw new Error('Firebase is not configured.');
  const callable = httpsCallable(functions, 'getUsage');
  const res = await callable({});
  return res.data;
}
