import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Navbar } from '../components/layout/Navbar.jsx';
import { Button } from '../components/ui/Button.jsx';
import { TiltCard } from '../components/ui/TiltCard.jsx';
import {
  Image as ImageIcon,
  Edit3,
  Film,
  Palette,
  ArrowRight,
  Sparkles,
  Zap,
  Play,
  Sliders,
  CheckCircle2,
  Wand2,
} from 'lucide-react';
import { ANIME_STYLES } from '../lib/animeStyles.js';
import { playPop, playSparkle } from '../lib/audio.js';

export const Landing = ({ onNavigate }) => {
  const [activeStyleIdx, setActiveStyleIdx] = useState(0);

  const showcaseStickers = [
    {
      name: 'Cyberpunk Shiba Inu',
      style: 'Cyberpunk Neon',
      prompt: 'Cyberpunk Shiba Inu in neon samurai armor with glowing visor',
      img: 'https://images.unsplash.com/photo-1580477667995-2b94f01c9516?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Winking Chibi Kitsune',
      style: 'Kawaii Chibi',
      prompt: 'Chibi nine-tailed fox girl winking with rosy blush and white sticker border',
      img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Steaming Ramen Cat',
      style: 'Kawaii Chibi',
      prompt: 'Cute calico cat chef slurping giant steaming bowl of ramen with chopsticks',
      img: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Retro 90s Mecha Pilot',
      style: 'Retro 90s Cel',
      prompt: 'Vintage 90s anime mecha pilot with golden victory sign and warm cel grain',
      img: 'https://images.unsplash.com/photo-1541562232579-512a21360020?auto=format&fit=crop&w=400&q=80',
    },
  ];

  const handleRemix = (item) => {
    playSparkle();
    onNavigate('generator', { remixPrompt: item.prompt });
  };

  return (
    <div className="min-h-screen bg-[#0f0913] text-slate-100 selection:bg-red-500 selection:text-white">
      <Navbar onNavigate={onNavigate} />

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32 overflow-hidden">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[450px] h-[450px] bg-red-600/20 rounded-full blur-[140px]" />
            <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-yellow-500/20 rounded-full blur-[140px]" />
          </div>

          <div className="max-w-[1920px] mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-red-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-lg shadow-red-500/5"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                AmiBuzz AI 2.5: Anime Sticker & Animated GIF Studio
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl md:text-7xl font-black leading-[1.1] mb-6 tracking-tight"
              >
                Create High-Res <br />
                <span className="rgb-text">Anime Stickers & GIFs</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg text-slate-400 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed"
              >
                Transform text, photos, or voice descriptions into vibrant anime stickers, WhatsApp packs, and animated Discord GIFs with die-cut white borders.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
              >
                <Button size="lg" onClick={() => onNavigate('generator')} className="gap-2 font-bold shadow-xl">
                  <Sparkles size={18} /> Start Creating Free
                </Button>
                <Button variant="outline" size="lg" onClick={() => onNavigate('dashboard')} className="gap-2 font-bold">
                  View Community Gallery <ArrowRight size={18} />
                </Button>
              </motion.div>

              {/* Trust Badges */}
              <div className="mt-10 flex items-center justify-center lg:justify-start gap-6 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-red-400" /> Transparent Die-Cut</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-red-400" /> Multi-Frame GIFs</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-red-400" /> WhatsApp & Discord Ready</span>
              </div>
            </div>

            {/* Interactive Hero Showcase */}
            <div className="flex-1 relative w-full max-w-lg mx-auto">
              <TiltCard>
                <div className="p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Style Switcher</span>
                    <span className="text-xs font-bold text-red-400">{ANIME_STYLES[activeStyleIdx].japanese}</span>
                  </div>

                  {/* Active Interactive Preview */}
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center p-4">
                    <motion.img
                      key={activeStyleIdx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      src={ANIME_STYLES[activeStyleIdx].img}
                      alt={ANIME_STYLES[activeStyleIdx].name}
                      className="w-full h-full object-contain drop-shadow-2xl"
                    />

                    {/* Sticker badge */}
                    <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">{ANIME_STYLES[activeStyleIdx].name}</p>
                        <p className="text-[10px] text-slate-400">{ANIME_STYLES[activeStyleIdx].desc}</p>
                      </div>
                      <Button
                        size="sm"
                        className="text-xs px-3 py-1 font-bold"
                        onClick={() => onNavigate('generator', { remixPrompt: ANIME_STYLES[activeStyleIdx].promptSuffix })}
                      >
                        Try Style
                      </Button>
                    </div>
                  </div>

                  {/* Style Pills Selector */}
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {ANIME_STYLES.slice(0, 4).map((s, idx) => (
                      <button
                        key={s.id}
                        onClick={() => { playPop(); setActiveStyleIdx(idx); }}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl transition-all ${
                          activeStyleIdx === idx
                            ? 'bg-red-500 text-white shadow'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {s.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </TiltCard>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 bg-white/[0.02] border-y border-white/5">
          <div className="max-w-[1920px] mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black mb-4">Elite AI Anime Capabilities</h2>
              <p className="text-slate-400 max-w-lg mx-auto">Everything you need to craft high-impact anime reaction stickers and viral GIF packs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: ImageIcon,
                  title: 'Image-to-Sticker & Vectors',
                  desc: 'Transform photos or prompts into cel-shaded anime avatars with SVG vector die-cuts and classic white contours.',
                },
                {
                  icon: Edit3,
                  title: '4x Emotion Matrix & Voice',
                  desc: 'Type or speak your prompt. Generate 4 expression variations (Sugoi Happy, Tsundere Pout, Shock, Victory Peace) at once.',
                },
                {
                  icon: Film,
                  title: 'Real Multi-Frame GIFs',
                  desc: 'Produce real animated .gif and .webp files with Kawaii Bounce, Floating Magic, Rage Shake, and Sakura Drift motion.',
                },
                {
                  icon: Sliders,
                  title: 'WhatsApp & Telegram Packs',
                  desc: '1-click export of complete 512x512 transparent sticker pack ZIPs with tray icon and manifest, plus printable A4 sheets.',
                },
              ].map((feature, i) => (
                <TiltCard key={i}>
                  <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-red-500/50 transition-all h-full flex flex-col justify-between">
                    <div>
                      <feature.icon size={32} className="text-red-400 mb-6" />
                      <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                </TiltCard>
              ))}
            </div>
          </div>
        </section>

        {/* Trending Showcase & Remix */}
        <section id="gallery" className="py-24 bg-[#0a060d]">
          <div className="max-w-[1920px] mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
              <div>
                <h2 className="text-3xl md:text-5xl font-black mb-3">Trending Anime Stickers</h2>
                <p className="text-slate-400">Discover popular community creations and remix them into your own style.</p>
              </div>
              <Button onClick={() => onNavigate('generator')} className="gap-2 self-start md:self-auto font-bold">
                <Wand2 size={16} /> Open Studio
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {showcaseStickers.map((item, idx) => (
                <TiltCard key={idx}>
                  <div className="bg-white/5 rounded-3xl p-4 border border-white/10 hover:border-red-500/40 transition-all flex flex-col justify-between h-full">
                    <div className="aspect-square rounded-2xl overflow-hidden bg-black/50 relative border border-white/5 mb-4">
                      <img src={item.img} alt={item.name} className="w-full h-full object-contain p-2" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">
                        {item.style}
                      </span>
                      <h4 className="font-bold text-white text-base mt-2">{item.name}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 mb-4">{item.prompt}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs font-bold gap-1.5"
                        onClick={() => handleRemix(item)}
                      >
                        <Sparkles size={14} /> Remix this Sticker
                      </Button>
                    </div>
                  </div>
                </TiltCard>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
