import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sidebar } from '../components/layout/Sidebar.jsx';
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Save,
  Zap,
  LogOut,
  Loader2,
  Check,
  Volume2,
  VolumeX,
  Download,
  Trash2,
} from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { auth, db } from '../firebase.js';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { openStripeBillingPortal } from '../services/paymentService.js';
import { CheckoutModal } from '../components/payment/CheckoutModal.jsx';
import { isSoundEnabled, toggleSound, playPop, playSuccess } from '../lib/audio.js';
import { getStoredStickers } from '../services/stickerStorage.js';

export const Settings = ({ onNavigate }) => {
  const { user, profile, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [notifications, setNotifications] = useState({
    marketing: true,
    security: true,
    updates: false,
  });
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState('');
  const [checkout, setCheckout] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (user?.displayName || profile?.displayName) {
      setDisplayName(user?.displayName || profile?.displayName || '');
    }
  }, [user?.displayName, profile?.displayName]);

  const handleLogout = async () => {
    await signOutUser();
    onNavigate('landing');
  };

  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundOn(next);
    if (next) playPop();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');
    setIsSaving(true);
    playPop();
    try {
      if (auth?.currentUser && displayName.trim()) {
        await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      }
      if (db && user?.uid && displayName.trim()) {
        await setDoc(doc(db, 'users', user.uid), { displayName: displayName.trim() }, { merge: true });
      }
      setSavedSuccess(true);
      playSuccess();
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setSaveError(err.message || 'Could not update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleNotification = (key) => {
    playPop();
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportAllStickers = () => {
    playPop();
    const stored = getStoredStickers();
    const blob = new Blob([JSON.stringify(stored, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `amibuzz-sticker-backup-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    playSuccess();
  };

  const handleManageSubscription = async () => {
    setPortalError('');
    if (profile?.stripeCustomerId) {
      setPortalBusy(true);
      try {
        await openStripeBillingPortal();
      } catch (err) {
        setPortalError(err?.message || 'Could not open the billing portal.');
      } finally {
        setPortalBusy(false);
      }
      return;
    }
    onNavigate('pricing');
  };

  const plan = profile?.plan || 'free';
  const planName = plan === 'proPlus' ? 'Pro Plus' : plan === 'pro' ? 'Pro' : 'Base (Free)';
  const status = profile?.subscriptionStatus || 'active';

  return (
    <div className="flex h-screen bg-[#0f0913] text-slate-100 overflow-hidden">
      <Sidebar currentPath="settings" onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-4 lg:px-8 border-b border-white/10 bg-[#0f0913]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="pl-14 lg:pl-0">
            <h1 className="text-xl lg:text-2xl font-black text-white">Settings</h1>
            <p className="text-slate-400 text-xs lg:text-sm hidden sm:block">Manage your profile, sound & preferences</p>
          </div>
          <div className="flex items-center gap-2 lg:gap-4 ml-auto">
            <button
              onClick={() => setActiveTab('billing')}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              <Zap size={16} fill="currentColor" />
              <span>{planName}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row gap-8">
            {/* Settings Navigation */}
            <aside className="w-full md:w-64 flex-shrink-0 space-y-2">
              <button
                onClick={() => { playPop(); setActiveTab('profile'); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left text-sm font-bold ${
                  activeTab === 'profile' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <User size={18} /> Public Profile
              </button>
              <button
                onClick={() => { playPop(); setActiveTab('notifications'); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left text-sm font-bold ${
                  activeTab === 'notifications' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Bell size={18} /> Sound & Alerts
              </button>
              <button
                onClick={() => { playPop(); setActiveTab('security'); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left text-sm font-bold ${
                  activeTab === 'security' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Shield size={18} /> Data & Security
              </button>
              <button
                onClick={() => { playPop(); setActiveTab('billing'); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left text-sm font-bold ${
                  activeTab === 'billing' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <CreditCard size={18} /> Membership & Billing
              </button>
            </aside>

            {/* Settings Content */}
            <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-6 lg:p-8">
              {activeTab === 'profile' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Public Profile</h2>
                    <p className="text-sm text-slate-400">This will be attached to your AmiBuzz creation watermarks.</p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div
                      className="size-20 rounded-full bg-cover bg-center border-2 border-red-500 shadow-xl"
                      style={{
                        backgroundImage: `url('${
                          user?.photoURL ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
                        }')`,
                      }}
                    />
                    <p className="text-xs text-slate-400 max-w-xs">
                      Avatar and authentication profile synced with Firebase Authentication.
                    </p>
                  </div>

                  <form onSubmit={handleSave} className="space-y-5 max-w-md">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter your creator name"
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl outline-none text-white focus:border-red-500/50 transition-colors text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Email Address</label>
                      <input
                        type="email"
                        value={user?.email || 'guest@amibuzz.local'}
                        readOnly
                        className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl outline-none text-white/60 cursor-not-allowed text-sm"
                      />
                    </div>

                    {saveError && <p className="text-xs text-red-400 font-semibold">{saveError}</p>}

                    <div className="flex items-center gap-4 pt-3">
                      <Button type="submit" disabled={isSaving} className="gap-2">
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : savedSuccess ? <Check size={18} className="text-green-300" /> : <Save size={18} />}
                        {savedSuccess ? 'Saved!' : 'Save Changes'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 text-red-400 border-red-500/20 hover:bg-red-500/10"
                        onClick={handleLogout}
                      >
                        <LogOut size={18} /> Sign Out
                      </Button>
                    </div>
                  </form>
                </motion.div>
              )}

              {activeTab === 'notifications' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Sound & Alerts</h2>
                    <p className="text-sm text-slate-400">Configure tactile audio and notification feedback.</p>
                  </div>

                  <div className="space-y-4 max-w-lg">
                    {/* Audio Synthesizer Toggle */}
                    <div className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${soundOn ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-slate-500'}`}>
                          {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">Anime Sound Effects</p>
                          <p className="text-xs text-slate-400">Synthesized chimes on generation, export & pops.</p>
                        </div>
                      </div>
                      <div
                        onClick={handleToggleSound}
                        className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${
                          soundOn ? 'bg-red-500' : 'bg-white/20'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${soundOn ? 'right-1' : 'left-1'}`} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div>
                        <p className="font-bold text-white text-sm">Security Alerts</p>
                        <p className="text-xs text-slate-400">Notify on login from new devices.</p>
                      </div>
                      <div
                        onClick={() => toggleNotification('security')}
                        className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${
                          notifications.security ? 'bg-red-500' : 'bg-white/20'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${notifications.security ? 'right-1' : 'left-1'}`} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'security' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Data & Privacy</h2>
                    <p className="text-sm text-slate-400">Backup your creations and review authentication credentials.</p>
                  </div>

                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10 space-y-4 max-w-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white text-sm">Export Library Backup</p>
                        <p className="text-xs text-slate-400">Download all your saved stickers and packs as JSON.</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleExportAllStickers} className="gap-2 text-xs">
                        <Download size={15} /> Export
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'billing' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Membership & Quota</h2>
                    <p className="text-sm text-slate-400">Manage plan limits and payment gateways.</p>
                  </div>

                  <div className="p-6 rounded-3xl rgb-gradient text-white relative overflow-hidden shadow-2xl">
                    <div className="relative z-10">
                      <h3 className="text-2xl font-black mb-1">{planName} Plan</h3>
                      <p className="text-white/80 text-sm mb-4 capitalize">Status: {status}</p>
                      {portalError && <p className="text-sm bg-black/20 rounded-lg px-3 py-2 mb-4">{portalError}</p>}
                      <div className="flex gap-3 flex-wrap">
                        <Button
                          variant="secondary"
                          className="text-red-600 gap-2 font-bold"
                          disabled={portalBusy}
                          onClick={handleManageSubscription}
                        >
                          {portalBusy && <Loader2 size={16} className="animate-spin" />}
                          {plan === 'free' ? 'Upgrade Plan' : 'Manage Subscription'}
                        </Button>
                        {plan === 'free' && (
                          <Button
                            variant="outline"
                            className="border-white/30 hover:bg-white/10 text-white font-bold"
                            onClick={() => setCheckout({ planId: 'pro', planName: 'Pro' })}
                          >
                            Quick Upgrade to Pro
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </main>

      <CheckoutModal
        open={Boolean(checkout)}
        onClose={() => setCheckout(null)}
        planId={checkout?.planId}
        planName={checkout?.planName}
        billingCycle="monthly"
      />
    </div>
  );
};
