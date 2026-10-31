// Firebase Client SDK Initialization (Plain JavaScript / React 19)
//
// Automatically reads VITE_FIREBASE_* variables with safe client fallbacks so
// Firebase Auth, Firestore, and Functions are always properly instantiated.

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  connectAuthEmulator,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAmiBuzzProdClientKey2026',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'amibuzz-app.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'amibuzz-app',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'amibuzz-app.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '103948572910',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:103948572910:web:83940294819203948',
};

// Check if a real user-supplied Firebase project credentials are provided
export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-api-key' &&
    import.meta.env.VITE_FIREBASE_API_KEY !== 'AIzaSyAmiBuzzProdClientKey2026'
);

// Always initialize Firebase App cleanly
export const firebaseApp = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp);

// Local development against Firebase Emulators only when explicitly enabled
if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    console.info('[firebase] Connected to local emulator suite (Auth:9099, Firestore:8080, Functions:5001).');
  } catch (err) {
    console.warn('[firebase] Emulator connection skipped or already active:', err.message);
  }
}

// 1. Google OAuth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// 2. Apple OAuth Provider
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

// 3. Microsoft OAuth Provider
export const microsoftProvider = new OAuthProvider('microsoft.com');
microsoftProvider.setCustomParameters({ prompt: 'select_account' });
microsoftProvider.addScope('user.read');
microsoftProvider.addScope('email');
