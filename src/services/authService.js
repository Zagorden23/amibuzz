// Auth service (plain JavaScript) — wraps Firebase Auth + our custom
// Cloud Functions for email/SMS OTP sign-in.
//
// All flows below are real, no mocks:
//   - Google sign-in            -> Firebase Auth popup
//   - Apple sign-in             -> Firebase Auth popup (OAuthProvider)
//   - Microsoft sign-in         -> Firebase Auth popup (OAuthProvider)
//   - Email OTP sign-in/sign-up -> sendEmailOtp / verifyEmailOtp Cloud Functions
//   - SMS OTP sign-in/sign-up   -> sendSmsOtp / verifySmsOtp Cloud Functions (MSG91)

import {
  signInWithPopup,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import {
  auth,
  functions,
  googleProvider,
  appleProvider,
  microsoftProvider,
  isFirebaseConfigured,
} from '../firebase.js';

function assertConfigured() {
  if (!isFirebaseConfigured || !auth) {
    throw new Error(
      'Firebase is not configured. Add VITE_FIREBASE_* values to .env.local (see .env.example) and restart the dev server.'
    );
  }
}

/** Normalizes a user-typed phone number to E.164. Defaults to India (+91) for a bare 10-digit number. */
function toE164(phoneNumber) {
  const trimmed = String(phoneNumber || '').trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/[^\d+]/g, '');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

/** Real Google sign-in via Firebase Auth. Returns the Firebase User. */
export async function signInWithGoogle() {
  assertConfigured();
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/** Real Apple sign-in via Firebase Auth. Returns the Firebase User. */
export async function signInWithApple() {
  assertConfigured();
  const result = await signInWithPopup(auth, appleProvider);
  return result.user;
}

/** Real Microsoft sign-in via Firebase Auth. Returns the Firebase User. */
export async function signInWithMicrosoft() {
  assertConfigured();
  const result = await signInWithPopup(auth, microsoftProvider);
  return result.user;
}

/**
 * Sends a 6-digit OTP to the given email via the sendEmailOtp Cloud Function
 * (server generates + hashes + stores the code and emails it through SendGrid).
 */
export async function requestEmailOtp(email) {
  assertConfigured();
  const callable = httpsCallable(functions, 'sendEmailOtp');
  const res = await callable({ email });
  return res.data; // { success: true, expiresInSeconds }
}

/**
 * Verifies the OTP server-side via the verifyEmailOtp Cloud Function, which
 * returns a Firebase custom token on success. We then sign in with it.
 */
export async function confirmEmailOtp(email, code) {
  assertConfigured();
  const callable = httpsCallable(functions, 'verifyEmailOtp');
  const res = await callable({ email, code });
  const { token } = res.data;
  const result = await signInWithCustomToken(auth, token);
  return result.user;
}

/**
 * Sends a 6-digit OTP to the given phone number via the sendSmsOtp Cloud
 * Function (server generates + hashes + stores the code and texts it
 * through MSG91).
 */
export async function requestSmsOtp(phoneNumber) {
  assertConfigured();
  const callable = httpsCallable(functions, 'sendSmsOtp');
  const res = await callable({ phoneNumber: toE164(phoneNumber) });
  return res.data; // { success: true, expiresInSeconds }
}

/**
 * Verifies the OTP server-side via the verifySmsOtp Cloud Function, which
 * returns a Firebase custom token on success. We then sign in with it.
 */
export async function confirmSmsOtp(phoneNumber, code) {
  assertConfigured();
  const callable = httpsCallable(functions, 'verifySmsOtp');
  const res = await callable({ phoneNumber: toE164(phoneNumber), code });
  const { token } = res.data;
  const result = await signInWithCustomToken(auth, token);
  return result.user;
}

export async function signOutUser() {
  if (!auth) return;
  await signOut(auth);
}

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export function subscribeToAuthChanges(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
