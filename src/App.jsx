/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Landing } from './pages/Landing.jsx';
import { Auth } from './pages/Auth.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Generator } from './pages/Generator.jsx';
import { GifLab } from './pages/GifLab.jsx';
import { Settings } from './pages/Settings.jsx';
import { Support } from './pages/Support.jsx';
import { Pricing } from './pages/Pricing.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

const PROTECTED_PATHS = new Set(['dashboard', 'generator', 'giflab', 'settings']);

function AppShell() {
  const [currentPath, setCurrentPath] = useState('landing');
  const [pageState, setPageState] = useState({});
  const { user, loading } = useAuth();

  const handleNavigate = (path, state = {}) => {
    setCurrentPath(path);
    setPageState(state || {});
    window.scrollTo(0, 0);
  };

  // Route guard: once we know the auth state, bounce signed-out users away
  // from protected pages, and signed-in users away from the auth page.
  useEffect(() => {
    if (loading) return;
    if (!user && PROTECTED_PATHS.has(currentPath)) {
      setCurrentPath('auth');
    } else if (user && currentPath === 'auth') {
      setCurrentPath('dashboard');
    }
  }, [user, loading, currentPath]);

  const renderPage = () => {
    switch (currentPath) {
      case 'landing':
        return <Landing onNavigate={handleNavigate} pageState={pageState} />;
      case 'auth':
        return <Auth onNavigate={handleNavigate} pageState={pageState} />;
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} pageState={pageState} />;
      case 'generator':
        return <Generator onNavigate={handleNavigate} pageState={pageState} />;
      case 'giflab':
        return <GifLab onNavigate={handleNavigate} pageState={pageState} />;
      case 'settings':
        return <Settings onNavigate={handleNavigate} pageState={pageState} />;
      case 'support':
        return <Support onNavigate={handleNavigate} pageState={pageState} />;
      case 'pricing':
        return <Pricing onNavigate={handleNavigate} pageState={pageState} />;
      default:
        return <Landing onNavigate={handleNavigate} pageState={pageState} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0913]">
      {renderPage()}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
