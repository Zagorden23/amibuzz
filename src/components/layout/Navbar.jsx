import React, { useState } from 'react';
import { Zap, Volume2, VolumeX } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { isSoundEnabled, toggleSound, playPop } from '../../lib/audio.js';

export const Navbar = ({ onNavigate }) => {
  const { user } = useAuth();
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundOn(next);
    if (next) playPop();
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 glass-panel">
      <div className="max-w-[1920px] mx-auto px-4 lg:px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('landing')}>
          <div className="size-10 rgb-gradient rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <Zap size={24} className="text-white" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-white">AmiBuzz</h1>
        </div>

        <nav className="hidden lg:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Features</a>
          <a href="#gallery" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Showcase</a>
          <button
            onClick={() => onNavigate('pricing')}
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Pricing
          </button>
        </nav>

        <div className="flex items-center gap-3 lg:gap-4">
          {/* Sound Toggle Button */}
          <button
            onClick={handleToggleSound}
            className={`p-2.5 rounded-xl border transition-colors ${
              soundOn ? 'bg-white/5 border-white/10 text-red-400' : 'bg-white/5 border-white/10 text-slate-500'
            }`}
            title={soundOn ? 'Sound FX On (click to mute)' : 'Sound FX Muted (click to enable)'}
          >
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {user ? (
            <Button onClick={() => onNavigate('dashboard')} className="font-bold">Dashboard</Button>
          ) : (
            <>
              <Button variant="ghost" className="hidden sm:flex font-bold" onClick={() => onNavigate('auth')}>Sign In</Button>
              <Button onClick={() => onNavigate('generator')} className="font-bold">Create Sticker</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
