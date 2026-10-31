import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sidebar } from '../components/layout/Sidebar.jsx';
import { HelpCircle, Mail, MessageCircle, FileText, Send, Check, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { TiltCard } from '../components/ui/TiltCard.jsx';
import { PlanBadge } from '../components/ui/PlanBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { db } from '../firebase.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { playPop, playSuccess } from '../lib/audio.js';

export const Support = ({ onNavigate }) => {
  const { user } = useAuth();
  const [subject, setSubject] = useState('general');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSending(true);
    setSendError('');
    playPop();

    const ticketData = {
      uid: user?.uid || null,
      email: user?.email || 'guest@amibuzz.local',
      subject,
      message: message.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    try {
      if (db) {
        await addDoc(collection(db, 'supportTickets'), {
          ...ticketData,
          createdAt: serverTimestamp(),
        });
      } else {
        // Fallback local support ticket logging
        const saved = JSON.parse(localStorage.getItem('amibuzz_support_tickets') || '[]');
        saved.push(ticketData);
        localStorage.setItem('amibuzz_support_tickets', JSON.stringify(saved));
      }

      setSent(true);
      setMessage('');
      playSuccess();
      setTimeout(() => setSent(false), 4000);
    } catch (err) {
      console.warn('Support ticket submission error, logged locally:', err);
      // Still log locally so user request is not discarded
      try {
        const saved = JSON.parse(localStorage.getItem('amibuzz_support_tickets') || '[]');
        saved.push(ticketData);
        localStorage.setItem('amibuzz_support_tickets', JSON.stringify(saved));
        setSent(true);
        setMessage('');
        playSuccess();
        setTimeout(() => setSent(false), 4000);
      } catch {
        setSendError(err?.message || 'Could not send message. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const faqs = [
    {
      q: 'How do I create an animated GIF sticker?',
      a: "Generate your sticker in the Sticker Studio, click 'Animate in GIF Lab', pick an anime motion dynamic (like Kawaii Bounce or Rage Shake), and hit 'Export Animated GIF'!",
    },
    {
      q: 'How do I use my stickers on WhatsApp & Discord?',
      a: 'In GIF Lab, choose "WhatsApp Sticker" (512x512 transparent WebP) or "Discord Emote" (256px), or click "Copy to Clipboard" to paste directly into Discord, Slack, or WhatsApp Web.',
    },
    {
      q: 'Can I print these on physical sticker paper?',
      a: 'Yes! From the Dashboard, click "Print Sticker Sheet". It renders a high-res A4 printable layout with dashed cut-contours, ready for sticker sheets or vinyl paper.',
    },
    {
      q: 'Can I use my generated stickers commercially?',
      a: 'Pro and Pro Plus members have full commercial rights to all generated stickers and GIFs for merch, branding, and streaming. Free users are restricted to personal use.',
    },
    {
      q: 'How do I cancel or modify my subscription?',
      a: "Go to Settings > Membership & Billing, and click 'Manage Subscription' to pause or cancel anytime.",
    },
  ];

  return (
    <div className="flex h-screen bg-[#0f0913] text-slate-100 overflow-hidden">
      <Sidebar currentPath="support" onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-4 lg:px-8 border-b border-white/10 bg-[#0f0913]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="pl-14 lg:pl-0">
            <h1 className="text-xl lg:text-2xl font-black text-white">Support & Community</h1>
            <p className="text-slate-400 text-xs lg:text-sm hidden sm:block">Guides, documentation & creator assistance</p>
          </div>
          <div className="flex items-center gap-2 lg:gap-4 ml-auto">
            <PlanBadge onNavigate={onNavigate} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          <div className="max-w-[1920px] mx-auto space-y-8 lg:space-y-12">
            {/* Quick Support Channels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <TiltCard>
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center text-center gap-4 cursor-pointer hover:border-red-500/50 transition-colors h-full">
                  <div className="size-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Creator Guide</h3>
                    <p className="text-xs text-slate-400 mt-1">Master prompt engineering, die-cut contours & GIF animation.</p>
                  </div>
                </div>
              </TiltCard>
              <TiltCard>
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center text-center gap-4 cursor-pointer hover:border-blue-500/50 transition-colors h-full">
                  <div className="size-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <MessageCircle size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Discord Community</h3>
                    <p className="text-xs text-slate-400 mt-1">Join over 10,000 anime sticker makers sharing prompts and packs.</p>
                  </div>
                </div>
              </TiltCard>
              <TiltCard>
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center text-center gap-4 cursor-pointer hover:border-green-500/50 transition-colors h-full">
                  <div className="size-12 rounded-2xl bg-green-500/20 text-green-400 flex items-center justify-center">
                    <Mail size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Priority Support</h3>
                    <p className="text-xs text-slate-400 mt-1">Direct assistance for billing, commercial licensing & API queries.</p>
                  </div>
                </div>
              </TiltCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Frequently Asked Questions */}
              <div>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <HelpCircle className="text-red-400" size={20} /> Frequently Asked Questions
                </h2>
                <div className="space-y-3.5">
                  {faqs.map((faq, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <h4 className="font-bold text-sm text-white mb-1.5">{faq.q}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Form */}
              <div>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Mail className="text-red-400" size={20} /> Send Us a Message
                </h2>
                <form onSubmit={handleSend} className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Subject</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#18101e] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/50 outline-none text-xs text-white"
                    >
                      <option value="general">General Question</option>
                      <option value="feature">Feature Suggestion</option>
                      <option value="billing">Billing & Subscriptions</option>
                      <option value="bug">Report an Issue</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Message</label>
                    <textarea
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us what you'd love to see or ask any question..."
                      className="w-full px-4 py-3 bg-[#18101e] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/50 outline-none text-xs text-white min-h-[140px] resize-none"
                    ></textarea>
                  </div>

                  <Button type="submit" className="w-full gap-2 text-xs font-bold" disabled={isSending || sent}>
                    {isSending ? 'Sending...' : sent ? 'Message Received!' : 'Submit Inquiry'}
                    {!isSending && !sent && <Send size={15} />}
                    {sent && <Check size={15} className="text-green-300" />}
                  </Button>

                  {sendError && (
                    <div className="flex items-start gap-2 text-xs rounded-xl p-3 border bg-red-500/10 border-red-500/20 text-red-300">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      <span>{sendError}</span>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
