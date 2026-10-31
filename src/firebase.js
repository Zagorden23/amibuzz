// Firebase client SDK initialization (plain JavaScript).
//
// All values come from Vite env vars (VITE_-prefixed so Vite exposes them to
// the browser). Fill these in your .env.local — see .env.example.
//
// Get these values from: Firebase Console -> Project Settings -> General ->
// "Your apps" -> Web app -> SDK setup and configuration.

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (!isConfigured) {
  // Don't throw at import time — let the UI surface a friendly "not
  // configured yet" state instead of a blank white screen during setup.
  console.warn(
    '[firebase] Missing VITE_FIREBASE_* env vars. Auth and payments will not work until .env.local is filled in (see .env.example).'
  );
}

export const firebaseApp = isConfigured
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const functions = firebaseApp ? getFunctions(firebaseApp) : null;

// Local development against the Firebase Emulator Suite. Set
// VITE_USE_FIREBASE_EMULATORS=true in .env.local to route Auth/Firestore/
// Functions at localhost instead of real Firebase servers.
if (firebaseApp && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  console.info('[firebase] Connected to local emulators (Auth:9099, Firestore:8080, Functions:5001).');
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Apple and Microsoft sign-in both go through Firebase's generic OAuthProvider.
// Enable each provider in Firebase Console -> Authentication -> Sign-in method
// (Apple needs a Services ID + private key from an Apple Developer account;
// Microsoft needs an Azure AD app registration).
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

export const microsoftProvider = new OAuthProvider('microsoft.com');
microsoftProvider.setCustomParameters({ prompt: 'select_account' });

export const isFirebaseConfigured = isConfigured;
