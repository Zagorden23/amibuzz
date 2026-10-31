// React Auth Context (Plain JavaScript/JSX)
// Real-time tracking for Firebase Authentication + Local Creator Sessions + Firestore Profile

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase.js';
import {
  subscribeToAuthChanges,
  signOutUser,
  getSessionUser,
} from '../services/authService.js';

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  isFirebaseConfigured: false,
  signOutUser: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSessionUser());
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Subscribe to Firebase Auth and session changes
    const unsubscribeAuth = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // 2. Custom event listener for instant UI updates on sign in / out
    const handleCustomAuth = (e) => {
      setUser(e.detail);
      setLoading(false);
    };
    window.addEventListener('amibuzz_auth_change', handleCustomAuth);

    return () => {
      unsubscribeAuth();
      window.removeEventListener('amibuzz_auth_change', handleCustomAuth);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    // Default optimistic profile
    const defaultProfile = {
      displayName: user.displayName || 'Anime Creator',
      email: user.email,
      plan: 'free',
      usageCount: 0,
      usageDate: new Date().toISOString().slice(0, 10),
      subscriptionStatus: 'active',
    };
    setProfile(defaultProfile);

    // Sync from Firestore if available
    if (db && user.uid && !user.uid.startsWith('demo-') && !user.uid.startsWith('google-') && !user.uid.startsWith('ms-') && !user.uid.startsWith('apple-')) {
      try {
        const unsubscribeProfile = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            if (snap.exists()) {
              setProfile(snap.data());
            }
          },
          (err) => {
            console.warn('Firestore profile sync error:', err.message);
          }
        );
        return () => unsubscribeProfile();
      } catch {}
    }
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
