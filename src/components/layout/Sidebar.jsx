import React, { useState, useEffect } from 'react';
import {
  Zap,
  Home,
  Image as ImageIcon,
  Settings,
  HelpCircle,
  PlusCircle,
  LogOut,
  Menu,
  X,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { isSoundEnabled, toggleSound, playPop } from '../../lib/audio.js';

export const Sidebar = ({ currentPath, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const { user, profile, signOutUser } = useAuth();

  useEffect(() => {
    setIsOpen(false);
  }, [currentPath]);

  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundOn(next);
    if (next) playPop();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard & Packs', icon: Home },
    { id: 'generator', label: 'Sticker Studio', icon: PlusCircle },
    { id: 'giflab', label: 'GIF Animation Lab', icon: ImageIcon },
  ];

  const handleLogout = async () => {
    await signOutUser();
    onNavigate('landing');
  };

  const displayName =
    user?.displayName || user?.email?.split('@')[0] || user?.phoneNumber || 'Creator';
  const planLabel =
    profile?.plan === 'proPlus'
      ? 'Pro Plus Creator'
      : profile?.plan === 'pro'
      ? 'Pro Creator'
      : 'Free Plan';
  const avatarUrl =
    user?.photoURL ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80';

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-[#1a1025] border border-white/10 rounded-xl text-white shadow-xl"
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`
        fixed lg:sticky top-0 left-0 z-40 h-screen w-72 flex-shrink-0
        border-r border-white/10 bg-[#0f0913] flex flex-col
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      >
        {/* Brand */}
        <div
          className="p-6 flex items-center justify-between cursor-pointer lg:pl-6 pl-16 border-b border-white/5"
          onClick={() => onNavigate('landing')}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl rgb-gradient text-white shadow-lg shadow-red-500/20">
              <Zap size={22} fill="currentColor" />
            </div>
            <div>
              <h2 className="text-white text-xl font-black tracking-tight leading-none">AmiBuzz</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Anime Studio</p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSound();
            }}
            className={`p-1.5 rounded-lg border transition-colors ${
              soundOn ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-white/10 text-slate-500'
            }`}
            title={soundOn ? 'Sound On' : 'Sound Muted'}
          >
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5 custom-scrollbar">
          <div className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const isActive = currentPath === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 w-full text-left font-bold text-sm ${
                    isActive
                      ? 'rgb-gradient text-white shadow-lg shadow-red-500/20'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon size={19} className={isActive ? 'text-white' : ''} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 pt-5 border-t border-white/10 space-y-1">
            <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Account & More</p>
            <button
              onClick={() => onNavigate('settings')}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all w-full text-left text-sm font-semibold ${
                currentPath === 'settings' ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
            <button
              onClick={() => onNavigate('support')}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all w-full text-left text-sm font-semibold ${
                currentPath === 'support' ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <HelpCircle size={18} />
              <span>Support</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all w-full text-left text-sm font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </nav>

        {/* User Card Profile Footer */}
        <div className="p-4 border-t border-white/10 bg-[#0c0710]">
          <div
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div
              className="size-9 rounded-full bg-cover bg-center border border-red-500"
              style={{ backgroundImage: `url('${avatarUrl}')` }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{displayName}</p>
              <p
                className="text-[11px] text-red-400 font-semibold hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('pricing');
                }}
              >
                {planLabel}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
