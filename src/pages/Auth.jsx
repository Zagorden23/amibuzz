import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, Mail, Lock, Phone, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import {
  signInWithGoogle,
  signInWithApple,
  signInWithMicrosoft,
  requestEmailOtp,
  confirmEmailOtp,
  requestSmsOtp,
  confirmSmsOtp,
} from '../services/authService.js';

// mode: 'signin' | 'signup' (both use the same passwordless OTP flow)
// method: 'email' | 'phone' — which OTP channel is active
export const Auth = ({ onNavigate }) => {
  const [mode, setMode] = useState('signin');
  const [method, setMethod] = useState('email');

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const resetFeedback = () => {
    setError('');
    setInfo('');
  };

  const switchMethod = (next) => {
    setMethod(next);
    setOtp('');
    setOtpSent(false);
    resetFeedback();
  };

  const runSocialSignIn = async (signInFn, label) => {
    resetFeedback();
    setBusy(true);
    try {
      await signInFn();
      onNavigate('dashboard');
    } catch (err) {
      setError(err?.message || `${label} sign-in failed.`);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = () => runSocialSignIn(signInWithGoogle, 'Google');
  const handleApple = () => runSocialSignIn(signInWithApple, 'Apple');
  const handleMicrosoft = () => runSocialSignIn(signInWithMicrosoft, 'Microsoft');

  const handleSendOtp = async () => {
    resetFeedback();
    if (method === 'email') {
      if (!email) {
        setError('Enter your email first.');
        return;
      }
    } else if (!phone) {
      setError('Enter your mobile number first.');
      return;
    }

    setBusy(true);
    try {
      if (method === 'email') {
        await requestEmailOtp(email);
        setInfo(`A verification code was sent to ${email}.`);
      } else {
        await requestSmsOtp(phone);
        setInfo(`A verification code was sent via SMS to ${phone}.`);
      }
      setOtpSent(true);
    } catch (err) {
      setError(err?.message || 'Could not send the OTP. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetFeedback();

    if (!otpSent) {
      setError('Click "Get OTP" first to receive your verification code.');
      return;
    }

    setBusy(true);
    try {
      if (method === 'email') {
        await confirmEmailOtp(email, otp);
      } else {
        await confirmSmsOtp(phone, otp);
      }
      onNavigate('dashboard');
    } catch (err) {
      setError(err?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0f0913] text-slate-100 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-red-600/20 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yellow-500/20 rounded-full blur-[150px]"></div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[1000px] flex flex-col md:flex-row bg-white/5 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl border border-white/10"
        >
          {/* Left Side: Visual */}
          <div className="hidden md:flex flex-col justify-between p-12 w-1/2 relative bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80')" }}>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0913] via-[#0f0913]/50 to-transparent"></div>
            <div className="relative z-10 cursor-pointer" onClick={() => onNavigate('landing')}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rgb-gradient rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
                  <Zap size={24} className="text-white" fill="currentColor" />
                </div>
                <span className="text-2xl font-black tracking-tighter text-white">AmiBuzz</span>
              </div>
            </div>
            <div className="relative z-10 mt-auto">
              <h1 className="text-4xl font-black text-white leading-tight mb-4">Step into your anime world.</h1>
              <p className="text-slate-300 text-lg">Connect with millions of fans, create amazing stickers, and join the ultimate community.</p>
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="flex-1 flex flex-col p-8 md:p-12 bg-[#0f0913]/80 overflow-y-auto custom-scrollbar max-h-[90vh]">
            <div className="flex items-center gap-3 mb-8 md:hidden cursor-pointer" onClick={() => onNavigate('landing')}>
              <div className="w-8 h-8 rgb-gradient rounded-lg flex items-center justify-center">
                <Zap size={18} className="text-white" fill="currentColor" />
              </div>
              <span className="text-xl font-black tracking-tighter text-white">AmiBuzz</span>
            </div>

            <div className="flex flex-col h-full">
                <div className="mb-6">
                  <h2 className="text-3xl font-bold mb-2">{mode === 'signin' ? 'Welcome Back' : 'Create Account'}</h2>
                  <p className="text-slate-400">{mode === 'signin' ? 'Choose your preferred sign in method' : 'Join the ultimate anime community'}</p>
                </div>

                <div className="flex border-b border-white/10 mb-6">
                  <button
                    onClick={() => { setMode('signin'); resetFeedback(); }}
                    className={`flex-1 py-3 text-center border-b-2 font-bold transition-colors ${mode === 'signin' ? 'border-red-500 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { setMode('signup'); resetFeedback(); }}
                    className={`flex-1 py-3 text-center border-b-2 font-bold transition-colors ${mode === 'signup' ? 'border-red-500 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    Sign Up
                  </button>
                </div>

                <div className="flex bg-white/5 p-1 rounded-xl mb-6">
                  <button
                    onClick={() => switchMethod('email')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${method === 'email' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Email
                  </button>
                  <button
                    onClick={() => switchMethod('phone')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${method === 'phone' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Phone
                  </button>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                  {method === 'email' ? (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300 ml-1">Email (Gmail, Outlook, etc.)</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Mail size={18} className="text-slate-500 group-focus-within:text-red-400 transition-colors" />
                        </div>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none transition-all placeholder:text-slate-600 text-white"
                          placeholder="Enter your email"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300 ml-1">Mobile Number</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Phone size={18} className="text-slate-500 group-focus-within:text-red-400 transition-colors" />
                        </div>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none transition-all placeholder:text-slate-600 text-white"
                          placeholder="e.g. 9876543210 or +919876543210"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300 ml-1">Verification Code (OTP)</label>
                    <div className="relative group flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Lock size={18} className="text-slate-500 group-focus-within:text-red-400 transition-colors" />
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                          className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none transition-all placeholder:text-slate-600 text-white"
                          placeholder="Enter 6-digit OTP"
                        />
                      </div>
                      <Button
                        type="button"
                        variant={otpSent ? 'primary' : 'outline'}
                        disabled={busy}
                        className="px-4 whitespace-nowrap"
                        onClick={handleSendOtp}
                      >
                        {busy && !otpSent ? <Loader2 className="animate-spin" size={16} /> : otpSent ? 'Resend OTP' : 'Get OTP'}
                      </Button>
                    </div>
                  </div>

                  <FeedbackBanner error={error} info={info} />

                  <Button type="submit" disabled={busy} className="w-full py-3.5 text-lg mt-2">
                    {busy ? <Loader2 className="animate-spin" size={20} /> : <>{mode === 'signin' ? 'Sign In' : 'Create Account'} <ArrowRight size={20} className="ml-2" /></>}
                  </Button>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-[#140c1a] text-slate-500">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Button variant="outline" disabled={busy} onClick={handleGoogle} className="flex items-center justify-center gap-2 py-2.5 hover:bg-white/5">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    <span className="hidden sm:inline">Google</span>
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={handleMicrosoft} className="flex items-center justify-center gap-2 py-2.5 hover:bg-white/5">
                    <svg className="w-5 h-5" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg"><path d="M10 0H0V10H10V0Z" fill="#F25022"/><path d="M21 0H11V10H21V0Z" fill="#7FBA00"/><path d="M10 11H0V21H10V11Z" fill="#00A4EF"/><path d="M21 11H11V21H21V11Z" fill="#FFB900"/></svg>
                    <span className="hidden sm:inline">Microsoft</span>
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={handleApple} className="flex items-center justify-center gap-2 py-2.5 hover:bg-white/5">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.09-.53-2.09-.53-3.24 0-1.44.68-2.19.51-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                    <span className="hidden sm:inline">Apple</span>
                  </Button>
                </div>
            </div>

            <div className="mt-auto pt-6 text-center">
              <p className="text-xs text-slate-500">
                By continuing, you agree to our <a href="#" onClick={(e) => e.preventDefault()} className="text-red-400 hover:underline">Terms of Service</a> and <a href="#" onClick={(e) => e.preventDefault()} className="text-red-400 hover:underline">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const FeedbackBanner = ({ error, info }) => {
  if (!error && !info) return null;
  return (
    <div
      className={`flex items-start gap-2 text-sm rounded-xl p-3 border ${
        error ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
      }`}
    >
      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
      <span>{error || info}</span>
    </div>
  );
};
