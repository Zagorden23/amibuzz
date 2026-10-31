import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from '../components/layout/Sidebar.jsx';
import {
  Zap,
  Image as ImageIcon,
  Wand2,
  Mic,
  MicOff,
  Grid,
  Filter,
  Download,
  Check,
  Sparkles,
  AlertTriangle,
  Shuffle,
  Sliders,
  Copy,
  Trash2,
  X,
  Upload,
  Palette,
  FileCode2,
  Layers,
  Flame,
  ChevronRight,
  Maximize2,
  Eye,
} from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { TiltCard } from '../components/ui/TiltCard.jsx';
import { PlanBadge } from '../components/ui/PlanBadge.jsx';
import { generateImage, generateStickerBatch, enhancePrompt } from '../services/geminiService.js';
import { getUsage } from '../services/usageService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { planFor } from '../lib/plans.js';
import {
  ANIME_STYLES,
  INSPIRATION_PROMPTS,
  QUICK_TAG_CATEGORIES,
  COLOR_HARMONIES,
  EMOTION_MATRIX_PRESETS,
} from '../lib/animeStyles.js';
import { getStoredStickers, saveStickerToStorage } from '../services/stickerStorage.js';
import { StickerCustomizerModal } from '../components/sticker/StickerCustomizerModal.jsx';
import { StickerPlaygroundModal } from '../components/sticker/StickerPlaygroundModal.jsx';
import { downloadStickerSvg } from '../lib/vectorSvgExporter.js';
import { playPop, playSparkle, playSuccess } from '../lib/audio.js';
import { fireConfetti } from '../lib/confetti.js';
import { createSpeechListener, isSpeechRecognitionSupported } from '../lib/speechRecognition.js';

export const Generator = ({ onNavigate, pageState }) => {
  const { user, profile } = useAuth();
  const plan = planFor(profile);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const [downloadingId, setDownloadingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [prompt, setPrompt] = useState(pageState?.remixPrompt || '');
  const [error, setError] = useState('');

  // Generation Modes: 'single' | 'duo' | 'quad_emotion'
  const [generationMode, setGenerationMode] = useState('single');

  // Color Harmony Mood Locking (Recraft-style)
  const [colorHarmony, setColorHarmony] = useState('vibrant');

  // Control Deck Section Tab: 'prompt' | 'styles' | 'tags'
  const [controlTab, setControlTab] = useState('prompt');

  // Image-to-Sticker Reference
  const [referenceImage, setReferenceImage] = useState(null);
  const fileInputRef = useRef(null);

  // Voice Dictation
  const [isListening, setIsListening] = useState(false);
  const speechListenerRef = useRef(null);

  // Active Category Tag Tab
  const [activeTagTab, setActiveTagTab] = useState(0);

  // Modals
  const [customizingSticker, setCustomizingSticker] = useState(null);
  const [playgroundModalOpen, setPlaygroundModalOpen] = useState(false);

  // Drafts & Hero Stage Selection
  const [drafts, setDrafts] = useState([]);
  const [activeHeroSticker, setActiveHeroSticker] = useState(null);
  const [latestBatch, setLatestBatch] = useState([]);
  const [stageBackdrop, setStageBackdrop] = useState('checker'); // 'checker' | 'dark' | 'neon' | 'light'

  // Real Usage Quota
  const [usage, setUsage] = useState(null);

  // Initialize drafts from storage
  useEffect(() => {
    const stored = getStoredStickers();
    setDrafts(stored);
    if (stored.length > 0 && !activeHeroSticker) {
      setActiveHeroSticker(stored[0]);
    }
  }, []);

  // Fetch real quota
  useEffect(() => {
    let cancelled = false;
    getUsage()
      .then((u) => !cancelled && setUsage(u))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile?.plan]);

  // Voice Dictation cleanup
  useEffect(() => {
    return () => {
      if (speechListenerRef.current) {
        speechListenerRef.current.stop();
      }
    };
  }, []);

  const handleToggleVoice = () => {
    playPop();
    if (!isSpeechRecognitionSupported()) {
      setError('Voice dictation is not supported in this browser. Please type your prompt.');
      return;
    }

    if (isListening) {
      if (speechListenerRef.current) speechListenerRef.current.stop();
      setIsListening(false);
    } else {
      setError('');
      try {
        const listener = createSpeechListener({
          onStart: () => setIsListening(true),
          onResult: (text) => {
            setPrompt((prev) => (prev ? `${prev} ${text}` : text));
          },
          onError: (err) => {
            console.warn('Speech error:', err);
            setIsListening(false);
          },
          onEnd: () => setIsListening(false),
        });
        speechListenerRef.current = listener;
        listener.start();
      } catch (err) {
        setError(err.message);
        setIsListening(false);
      }
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Reference image must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImage(reader.result);
      playPop();
    };
    reader.readAsDataURL(file);
  };

  const handleClearReferenceImage = () => {
    setReferenceImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    playPop();
  };

  const handleInspireMe = () => {
    playSparkle();
    const random = INSPIRATION_PROMPTS[Math.floor(Math.random() * INSPIRATION_PROMPTS.length)];
    setPrompt(random);
  };

  const handleAddTag = (tag) => {
    playPop();
    setPrompt((prev) => {
      const cleanTag = tag.replace(/^[^\w\s]+/, '').trim();
      return prev ? `${prev}, ${cleanTag}` : cleanTag;
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !referenceImage) return;
    setError('');
    setIsGenerating(true);
    playPop();

    try {
      const selectedStyle = ANIME_STYLES[activePresetIndex]?.name || 'Kawaii Chibi';

      const isQuadEmotion = generationMode === 'quad_emotion';
      const variantCount = generationMode === 'duo' ? 2 : isQuadEmotion ? 4 : 1;

      const results = await generateStickerBatch({
        prompt,
        stylePreset: selectedStyle,
        referenceImage,
        variantCount,
        emotionMatrix: isQuadEmotion,
        colorHarmony,
      });

      if (results && results.length > 0) {
        let updatedList = drafts;
        for (const st of results) {
          updatedList = saveStickerToStorage(st, user);
        }
        setDrafts(updatedList);
        setLatestBatch(results);
        setActiveHeroSticker(results[0]);

        // Update quota usage
        if (results[0]?.used !== undefined) {
          setUsage({
            plan: results[0].plan,
            quota: results[0].quota,
            used: results[0].used,
            remaining: results[0].remaining,
          });
        }
      }

      playSuccess();
      fireConfetti();
    } catch (err) {
      setError(err?.message || 'Failed to generate sticker. Please try again.');
      if (err?.code === 'functions/resource-exhausted' && /Daily limit/i.test(err.message || '')) {
        onNavigate('pricing');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    setIsEnhancing(true);
    playSparkle();
    try {
      const selectedStyle = ANIME_STYLES[activePresetIndex]?.name || 'Kawaii Chibi';
      const enhanced = await enhancePrompt(prompt, selectedStyle, colorHarmony);
      setPrompt(enhanced);
    } catch (err) {
      setError(err?.message || 'Could not enhance prompt.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleCopySticker = async (stickerItem, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(stickerItem.img);
      const blob = await res.blob();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
        setCopiedId(stickerItem.id);
        playSuccess();
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(stickerItem.img);
        setCopiedId(stickerItem.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    }
  };

  const handleDownload = (stickerItem, e) => {
    if (e) e.stopPropagation();
    setDownloadingId(stickerItem.id);
    try {
      const link = document.createElement('a');
      link.href = stickerItem.img;
      const safeName = (stickerItem.name || 'sticker').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      link.download = `${safeName || 'anime-sticker'}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      playSuccess();
    } catch (err) {
      console.error('Download error:', err);
    }
    setTimeout(() => setDownloadingId(null), 2000);
  };

  const handleDownloadSvgHero = (stickerItem) => {
    playPop();
    downloadStickerSvg({
      imgUrl: stickerItem.img,
      name: stickerItem.name,
      borderType: 'white',
      borderWidth: 14,
    });
    playSuccess();
  };

  return (
    <div className="flex h-screen bg-[#0f0913] text-slate-100 overflow-hidden">
      <Sidebar currentPath="generator" onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Studio Top Navbar */}
        <header className="h-20 flex items-center justify-between px-4 lg:px-8 border-b border-white/10 bg-[#0f0913]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="pl-14 lg:pl-0">
            <h1 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2">
              Anime Sticker Studio{' '}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                v2.6 Pro
              </span>
            </h1>
            <p className="text-slate-400 text-xs lg:text-sm hidden sm:block">
              Multi-variant generation, color mood locking & vector die-cuts
            </p>
          </div>
          <div className="flex items-center gap-2 lg:gap-3 ml-auto">
            <PlanBadge onNavigate={onNavigate} />

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                playPop();
                setPlaygroundModalOpen(true);
              }}
              className="gap-2 text-xs font-bold border-white/15 text-slate-200 hover:text-white"
              title="Open Interactive Sticker Playground"
            >
              <Palette size={16} className="text-purple-400" />
              <span className="hidden sm:inline">Playground</span>
            </Button>

            <Button
              className="gap-2 text-sm px-3 py-2 lg:px-4 lg:py-2"
              onClick={() =>
                onNavigate(
                  'giflab',
                  activeHeroSticker ? { sticker: activeHeroSticker } : drafts[0] ? { sticker: drafts[0] } : {}
                )
              }
            >
              <Wand2 size={18} /> <span className="hidden sm:inline">Animate in GIF Lab</span>
            </Button>
          </div>
        </header>

        {/* Master Studio Workspace (Clean 2-Column Split) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-[1920px] mx-auto w-full">
          {/* Left: Creative Control Deck */}
          <aside className="w-full lg:w-[460px] xl:w-[480px] border-r border-white/10 p-4 lg:p-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar bg-[#0f0913]/70">
            {/* Daily Quota Meter */}
            <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={14} className="text-yellow-400" /> Daily Generations
                </span>
                <span className="text-xs font-bold text-white">
                  {usage ? `${usage.used} / ${usage.quota}` : `— / ${plan.dailyGenerations}`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full rgb-gradient transition-all duration-500"
                  style={{
                    width: usage ? `${Math.min(100, (usage.used / usage.quota) * 100)}%` : '20%',
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{plan.label} tier</span>
                <button
                  onClick={() => onNavigate('pricing')}
                  className="text-red-400 font-bold hover:underline cursor-pointer"
                >
                  Upgrade Quota
                </button>
              </div>
            </div>

            {/* Generation Mode Selector (Single / Duo / Quad Emotion Matrix) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Generation Mode
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/5 rounded-xl border border-white/10">
                {[
                  { id: 'single', label: 'Single', sub: '1 Sticker' },
                  { id: 'duo', label: 'Duo Variants', sub: '2 Angles' },
                  { id: 'quad_emotion', label: '4x Emotion Matrix', sub: 'Expressions' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      playPop();
                      setGenerationMode(mode.id);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                      generationMode === mode.id
                        ? 'bg-red-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <p className="text-xs font-black">{mode.label}</p>
                    <p className="text-[9px] opacity-75">{mode.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Segmented Control Deck Tabs */}
            <div className="flex items-center border-b border-white/10 pb-1 gap-1">
              {[
                { id: 'prompt', label: 'Prompt & Mood' },
                { id: 'styles', label: 'Anime Style' },
                { id: 'tags', label: 'Tag Cloud' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    playPop();
                    setControlTab(tab.id);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    controlTab === tab.id
                      ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: Prompt & Mood Deck */}
            {controlTab === 'prompt' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Prompt Description */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">Prompt Description</label>
                    <button
                      onClick={handleInspireMe}
                      className="flex items-center gap-1 text-xs text-yellow-400 font-bold hover:underline cursor-pointer"
                      title="Randomize Anime Idea"
                    >
                      <Shuffle size={13} /> Inspire Me
                    </button>
                  </div>

                  <div className="relative flex flex-col bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:border-red-500/50 focus-within:ring-1 focus-within:ring-red-500/50 transition-all">
                    {/* Reference Image Thumbnail Preview */}
                    {referenceImage && (
                      <div className="p-3 bg-red-500/10 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src={referenceImage}
                            alt="Ref"
                            className="size-10 rounded-lg object-cover border border-white/20"
                          />
                          <div>
                            <p className="text-xs font-bold text-white">Image-to-Sticker Reference</p>
                            <p className="text-[10px] text-slate-400">AI converts this to anime die-cut</p>
                          </div>
                        </div>
                        <button
                          onClick={handleClearReferenceImage}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    <textarea
                      className="w-full p-3.5 bg-transparent border-none focus:ring-0 text-white placeholder:text-slate-500 resize-none min-h-[110px] text-xs lg:text-sm outline-none"
                      placeholder="Describe your anime sticker... (e.g. 'Chibi cat samurai eating ramen with chopsticks, pastel colors, white border')"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    ></textarea>

                    {/* Prompt Toolbar */}
                    <div className="flex items-center justify-between p-2.5 border-t border-white/10 bg-black/30">
                      <div className="flex items-center gap-1">
                        {/* Magic AI Enhance */}
                        <button
                          onClick={handleEnhancePrompt}
                          disabled={isEnhancing || !prompt.trim()}
                          className={`p-2 rounded-xl transition-all flex items-center gap-1.5 ${
                            isEnhancing
                              ? 'text-red-400 animate-pulse bg-red-500/10'
                              : 'text-slate-400 hover:bg-white/10 hover:text-white'
                          }`}
                          title="AI Magic Enhance"
                        >
                          <Sparkles size={16} />
                          <span className="text-xs font-bold hidden sm:inline">Enhance</span>
                        </button>

                        {/* Image-to-Sticker Upload */}
                        <div className="relative">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={handleImageUpload}
                            title="Upload reference photo for Image-to-Sticker"
                          />
                          <button
                            className={`p-2 rounded-xl transition-colors ${
                              referenceImage
                                ? 'bg-red-500/20 text-red-400'
                                : 'text-slate-400 hover:bg-white/10 hover:text-white'
                            }`}
                            title="Upload Reference Photo (Image-to-Sticker)"
                          >
                            <Upload size={16} />
                          </button>
                        </div>

                        {/* Voice Dictation (Web Speech API) */}
                        <button
                          onClick={handleToggleVoice}
                          className={`p-2 rounded-xl transition-all ${
                            isListening
                              ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50'
                              : 'text-slate-400 hover:bg-white/10 hover:text-white'
                          }`}
                          title={isListening ? 'Listening... click to stop' : 'Voice Dictate Prompt'}
                        >
                          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                        </button>
                      </div>

                      <Button
                        size="sm"
                        className="gap-2 px-5 font-bold shadow-lg"
                        onClick={handleGenerate}
                        disabled={isGenerating || (!prompt.trim() && !referenceImage)}
                      >
                        {isGenerating ? 'Synthesizing...' : 'Generate'}{' '}
                        <Zap size={15} fill="currentColor" />
                      </Button>
                    </div>
                  </div>

                  {/* Error Alert */}
                  {error && (
                    <div className="flex items-start gap-2 text-xs rounded-xl p-3 border bg-red-500/10 border-red-500/20 text-red-300">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>

                {/* Color Mood Harmony (Recraft style) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Color Mood Harmony
                    </span>
                    <span className="text-[11px] font-bold text-red-400">
                      {COLOR_HARMONIES.find((h) => h.id === colorHarmony)?.name}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {COLOR_HARMONIES.map((h) => {
                      const isSel = colorHarmony === h.id;
                      return (
                        <button
                          key={h.id}
                          onClick={() => {
                            playPop();
                            setColorHarmony(h.id);
                          }}
                          className={`p-2 rounded-xl border text-left transition-all ${
                            isSel
                              ? 'bg-red-500/20 border-red-500 text-white shadow-md'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            {h.colors.map((c, idx) => (
                              <div
                                key={idx}
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                          <p className="text-[11px] font-bold text-white truncate">{h.name}</p>
                          <p className="text-[9px] text-slate-400 truncate">{h.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: 8 Curated Anime Styles */}
            {controlTab === 'styles' && (
              <div className="space-y-3 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Anime Art Style
                  </h3>
                  <span className="text-[11px] font-bold text-red-400">
                    {ANIME_STYLES[activePresetIndex]?.japanese}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {ANIME_STYLES.map((style, idx) => {
                    const isSelected = activePresetIndex === idx;
                    return (
                      <div
                        key={style.id}
                        onClick={() => {
                          playPop();
                          setActivePresetIndex(idx);
                        }}
                        className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 transition-all p-1 bg-white/5 ${
                          isSelected
                            ? 'border-red-500 ring-4 ring-red-500/20 shadow-xl'
                            : 'border-transparent hover:border-white/20'
                        }`}
                      >
                        <div
                          className="aspect-[4/3] rounded-xl bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                          style={{ backgroundImage: `url('${style.img}')` }}
                        >
                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white border border-white/10">
                            {style.badge}
                          </div>
                        </div>
                        <div className="p-2">
                          <div className="flex items-center justify-between">
                            <span className="text-white text-xs font-black truncate">{style.name}</span>
                            <span className="text-[10px] text-slate-400">{style.japanese}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{style.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: Quick Tag Cloud & Manga SFX */}
            {controlTab === 'tags' && (
              <div className="space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Quick Anime Tags
                  </span>
                  <div className="flex gap-1">
                    {QUICK_TAG_CATEGORIES.map((cat, idx) => (
                      <button
                        key={cat.category}
                        onClick={() => {
                          playPop();
                          setActiveTagTab(idx);
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                          activeTagTab === idx
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {cat.category}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/10 min-h-[220px]">
                  {QUICK_TAG_CATEGORIES[activeTagTab].tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleAddTag(tag)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-all active:scale-95 cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Right: Studio Canvas Stage + Creations Gallery */}
          <section className="flex-1 bg-[#0a060d] p-4 lg:p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            {/* HERO PREVIEW & INSPECTION STAGE */}
            {activeHeroSticker && (
              <div className="relative rounded-3xl bg-white/5 border border-white/10 p-5 lg:p-6 flex flex-col lg:flex-row items-center gap-6 shadow-2xl">
                {/* Stage Backdrop Switcher Pills */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md p-1 rounded-xl border border-white/10">
                  {[
                    { id: 'checker', label: 'Grid' },
                    { id: 'dark', label: 'Dark' },
                    { id: 'neon', label: 'Neon' },
                    { id: 'light', label: 'Light' },
                  ].map((bd) => (
                    <button
                      key={bd.id}
                      onClick={() => {
                        playPop();
                        setStageBackdrop(bd.id);
                      }}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                        stageBackdrop === bd.id
                          ? 'bg-red-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {bd.label}
                    </button>
                  ))}
                </div>

                {/* Main Hero Sticker Frame */}
                <div
                  className={`relative size-56 sm:size-64 lg:size-72 shrink-0 rounded-2xl border border-white/15 overflow-hidden shadow-2xl flex items-center justify-center ${
                    stageBackdrop === 'checker'
                      ? "bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgfQEhD/o+OQZIMxG4c1EAaGEY1gDAg0xQ+OqMawDAg0xQ+OqMaQBgA+zQ+O2/1h6gAAAAASUVORK5CYII=')]"
                      : stageBackdrop === 'neon'
                      ? 'bg-gradient-to-br from-cyan-950 via-black to-pink-950'
                      : stageBackdrop === 'light'
                      ? 'bg-slate-100'
                      : 'bg-[#0f0913]'
                  }`}
                >
                  <img
                    src={activeHeroSticker.img}
                    alt={activeHeroSticker.name}
                    className="w-full h-full object-contain p-3 drop-shadow-2xl transition-transform hover:scale-105"
                  />
                </div>

                {/* Hero Metadata & Action Panel */}
                <div className="flex-1 flex flex-col justify-between w-full h-full gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase font-black tracking-wider text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20">
                        {activeHeroSticker.stylePreset || 'Anime'}
                      </span>
                      {activeHeroSticker.emotionLabel && (
                        <span className="text-[10px] font-bold text-yellow-300 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                          {activeHeroSticker.emotionIcon} {activeHeroSticker.emotionLabel}
                        </span>
                      )}
                      <span className="text-xs text-slate-500 ml-auto">
                        {activeHeroSticker.time || 'Saved'}
                      </span>
                    </div>

                    <h3 className="text-lg lg:text-xl font-black text-white">{activeHeroSticker.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 italic">
                      "{activeHeroSticker.prompt}"
                    </p>

                    {/* Latest Batch Variants Selector if user generated duo or quad */}
                    {latestBatch.length > 1 && (
                      <div className="mt-3.5 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Select Variant / Expression
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {latestBatch.map((varItem, idx) => {
                            const isCur = activeHeroSticker.id === varItem.id;
                            return (
                              <button
                                key={varItem.id}
                                onClick={() => {
                                  playPop();
                                  setActiveHeroSticker(varItem);
                                }}
                                className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                                  isCur
                                    ? 'bg-red-500 text-white border-red-500 shadow-md'
                                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                }`}
                              >
                                {varItem.emotionIcon && <span>{varItem.emotionIcon}</span>}
                                <span>{varItem.emotionLabel || `Variant ${idx + 1}`}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Hero Quick Actions Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                    <Button
                      size="sm"
                      onClick={() => {
                        playPop();
                        setCustomizingSticker(activeHeroSticker);
                      }}
                      className="gap-1.5 text-xs font-bold"
                    >
                      <Sliders size={15} /> Customize Contour
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate('giflab', { sticker: activeHeroSticker })}
                      className="gap-1.5 text-xs font-bold text-red-300 border-red-500/30 hover:bg-red-500/10"
                    >
                      <Wand2 size={15} /> Animate
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadSvgHero(activeHeroSticker)}
                      className="gap-1.5 text-xs font-bold text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10"
                      title="Download Scalable Vector SVG (Recraft Style)"
                    >
                      <FileCode2 size={15} /> Vector SVG
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleCopySticker(activeHeroSticker, e)}
                      className="gap-1.5 text-xs font-bold"
                    >
                      {copiedId === activeHeroSticker.id ? (
                        <Check size={15} className="text-green-400" />
                      ) : (
                        <Copy size={15} />
                      )}
                      {copiedId === activeHeroSticker.id ? 'Copied!' : 'Copy PNG'}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleDownload(activeHeroSticker, e)}
                      className="gap-1.5 text-xs font-bold"
                    >
                      <Download size={15} /> Download
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* CREATIONS LIBRARY HEADER & GRID */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl lg:text-2xl font-black text-white">Your Creations</h2>
                <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-full">
                  {drafts.length} Stickers
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('dashboard')}
                  className="text-xs font-bold gap-1.5"
                >
                  <Grid size={15} /> View Full Library
                </Button>
              </div>
            </div>

            {/* Stickers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-6">
              {drafts.map((draft) => {
                const isSelected = activeHeroSticker?.id === draft.id;
                return (
                  <motion.div
                    key={draft.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      playPop();
                      setActiveHeroSticker(draft);
                    }}
                    className={`group relative bg-white/5 rounded-3xl p-4 border transition-all hover:shadow-2xl hover:shadow-red-500/10 flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-red-500 ring-2 ring-red-500/30'
                        : 'border-white/5 hover:border-red-500/30'
                    }`}
                  >
                    <TiltCard>
                      <div className="aspect-square rounded-2xl overflow-hidden bg-black/60 relative border border-white/10 group-hover:border-red-500/40 transition-all">
                        <img
                          src={draft.img}
                          alt={draft.name}
                          className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
                        />

                        {/* Hover Action Overlay */}
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                          {/* Customize Studio */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playPop();
                              setCustomizingSticker(draft);
                            }}
                            className="size-10 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
                            title="Open Sticker Customizer"
                          >
                            <Sliders size={16} />
                          </button>

                          {/* Animate in GIF Lab */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate('giflab', { sticker: draft });
                            }}
                            className="size-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
                            title="Animate in GIF Lab"
                          >
                            <Wand2 size={16} />
                          </button>

                          {/* Copy Transparent PNG */}
                          <button
                            onClick={(e) => handleCopySticker(draft, e)}
                            className="size-10 bg-white/20 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 hover:bg-white/30 transition-transform"
                            title="Copy PNG to Clipboard"
                          >
                            {copiedId === draft.id ? (
                              <Check size={16} className="text-green-400" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>

                          {/* Download */}
                          <button
                            onClick={(e) => handleDownload(draft, e)}
                            className="size-10 bg-white/20 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 hover:bg-white/30 transition-transform"
                            title="Download Image"
                          >
                            {downloadingId === draft.id ? <Check size={16} /> : <Download size={16} />}
                          </button>
                        </div>
                      </div>
                    </TiltCard>

                    <div className="mt-4 flex flex-col gap-1.5 px-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-white truncate max-w-[170px]">
                          {draft.name}
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400">
                          {draft.time || 'Recent'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-black tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">
                          {draft.stylePreset || 'Anime'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold">
                          {isSelected ? 'Active Preview' : 'Click to View'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Generating Placeholder State */}
              {isGenerating && (
                <div className="relative bg-white/5 rounded-3xl p-6 border border-dashed border-red-500/40 flex flex-col items-center justify-center text-center animate-pulse min-h-[300px]">
                  <div className="size-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mb-4">
                    <Sparkles size={32} className="animate-spin" />
                  </div>
                  <h4 className="text-white font-bold text-base mb-1">Synthesizing Anime Sticker...</h4>
                  <p className="text-xs text-slate-400 max-w-[200px]">
                    Isolating character contours, applying cel shading & die-cut borders
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* In-Studio Sticker Customizer Modal */}
      {customizingSticker && (
        <StickerCustomizerModal
          open={Boolean(customizingSticker)}
          sticker={customizingSticker}
          onClose={() => setCustomizingSticker(null)}
          onSave={(updated) => {
            const list = saveStickerToStorage(updated, user);
            setDrafts(list);
            if (activeHeroSticker?.id === updated.id) {
              setActiveHeroSticker(updated);
            }
          }}
          onAnimate={(sticker) => {
            onNavigate('giflab', { sticker });
          }}
        />
      )}

      {/* Sticker Playground Modal */}
      <StickerPlaygroundModal
        open={playgroundModalOpen}
        initialSticker={activeHeroSticker}
        libraryStickers={drafts}
        onClose={() => setPlaygroundModalOpen(false)}
      />
    </div>
  );
};
