// React auth context (plain JavaScript/JSX) — tracks the signed-in Firebase
// user plus their Firestore profile (plan, subscription status), and exposes
// sign-out. Wrap the app in <AuthProvider> once, then call useAuth() anywhere.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase.js';
import { subscribeToAuthChanges, signOutUser } from '../services/authService.js';

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  isFirebaseConfigured: false,
  signOutUser: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = subscribeToAuthChanges((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setProfile(null);
      return;
    }
    // users/{uid} is created/updated by the backend on first sign-in and on
    // every subscription change (via Razorpay/Stripe webhooks).
    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
    });
    return () => unsubscribeProfile();
  }, [user]);

  const value = {
    user,
    profile,
    loading,
    isFirebaseConfigured,
    signOutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
