import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from '../components/layout/Sidebar.jsx';
import {
  Search,
  PlusCircle,
  Play,
  Edit2,
  Share2,
  Zap,
  Check,
  Heart,
  Download,
  Copy,
  Printer,
  Trash2,
  FolderPlus,
  Sliders,
  Wand2,
  Sparkles,
  Palette,
  Package,
  FileCode2,
  Loader2,
} from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { TiltCard } from '../components/ui/TiltCard.jsx';
import { PlanBadge } from '../components/ui/PlanBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { planFor } from '../lib/plans.js';
import {
  getStoredStickers,
  getStoredPacks,
  updateStickerInStorage,
  deleteStickerFromStorage,
  createStickerPack,
} from '../services/stickerStorage.js';
import { StickerSheetModal } from '../components/sticker/StickerSheetModal.jsx';
import { StickerCustomizerModal } from '../components/sticker/StickerCustomizerModal.jsx';
import { StickerPlaygroundModal } from '../components/sticker/StickerPlaygroundModal.jsx';
import { downloadWhatsAppStickerPackZip } from '../lib/zipExporter.js';
import { downloadStickerSvg } from '../lib/vectorSvgExporter.js';
import { playPop, playSuccess } from '../lib/audio.js';
import { fireConfetti } from '../lib/confetti.js';

export const Dashboard = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const plan = planFor(profile);

  const [stickers, setStickers] = useState([]);
  const [packs, setPacks] = useState([]);
  const [activePackId, setActivePackId] = useState('all');
  const [filter, setFilter] = useState('all'); // 'all' | 'static' | 'animated' | 'favorites'
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Modals state
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [playgroundModalOpen, setPlaygroundModalOpen] = useState(false);
  const [customizingSticker, setCustomizingSticker] = useState(null);
  const [newPackName, setNewPackName] = useState('');
  const [showNewPackInput, setShowNewPackInput] = useState(false);

  // Export ZIP State
  const [isExportingPackZip, setIsExportingPackZip] = useState(false);
  const [packZipSuccess, setPackZipSuccess] = useState(false);

  useEffect(() => {
    setStickers(getStoredStickers());
    setPacks(getStoredPacks());
  }, []);

  const handleToggleFavorite = (sticker, e) => {
    e.stopPropagation();
    playPop();
    const updated = updateStickerInStorage(sticker.id, { isFavorite: !sticker.isFavorite }, user);
    setStickers(updated);
  };

  const handleDeleteSticker = (id, e) => {
    e.stopPropagation();
    playPop();
    const updated = deleteStickerFromStorage(id, user);
    setStickers(updated);
  };

  const handleCopySticker = async (sticker, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(sticker.img);
      const blob = await res.blob();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
        setCopiedId(sticker.id);
        playSuccess();
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(sticker.img);
        setCopiedId(sticker.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    }
  };

  const handleDownloadSvg = (sticker, e) => {
    e.stopPropagation();
    playPop();
    downloadStickerSvg({
      imgUrl: sticker.img,
      name: sticker.name,
      borderType: 'white',
      borderWidth: 14,
    });
    playSuccess();
  };

  const handleCreatePack = (e) => {
    e.preventDefault();
    if (!newPackName.trim()) return;
    playPop();
    const updatedPacks = createStickerPack(newPackName.trim());
    setPacks(updatedPacks);
    setNewPackName('');
    setShowNewPackInput(false);
  };

  const filteredStickers = stickers.filter((s) => {
    if (activePackId !== 'all' && s.packId !== activePackId) return false;
    if (filter === 'animated' && !s.animated) return false;
    if (filter === 'static' && s.animated) return false;
    if (filter === 'favorites' && !s.isFavorite) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (s.name || '').toLowerCase().includes(q);
      const styleMatch = (s.stylePreset || '').toLowerCase().includes(q);
      const tagMatch = Array.isArray(s.tags) && s.tags.some((t) => t.toLowerCase().includes(q));
      return nameMatch || styleMatch || tagMatch;
    }

    return true;
  });

  const activePackName =
    activePackId !== 'all'
      ? packs.find((p) => p.id === activePackId)?.name || 'Anime Pack'
      : 'All Anime Stickers';

  const handleExportWhatsAppZip = async () => {
    if (filteredStickers.length === 0 || isExportingPackZip) return;
    setIsExportingPackZip(true);
    setPackZipSuccess(false);
    playPop();

    try {
      await downloadWhatsAppStickerPackZip(activePackName, filteredStickers);
      setPackZipSuccess(true);
      playSuccess();
      fireConfetti();
      setTimeout(() => setPackZipSuccess(false), 4000);
    } catch (err) {
      console.error('WhatsApp zip export error:', err);
    } finally {
      setIsExportingPackZip(false);
    }
  };

  const usedToday =
    profile?.usageDate === new Date().toISOString().slice(0, 10) ? profile?.usageCount || 0 : 0;

  const stats = [
    { label: 'Total Stickers', value: stickers.length, color: 'text-white' },
    { label: 'Favorites', value: stickers.filter((s) => s.isFavorite).length, color: 'text-red-400' },
    { label: 'Today’s Generations', value: `${usedToday} / ${plan.dailyGenerations}`, color: 'text-yellow-400' },
    { label: 'Current Plan', value: plan.label, color: 'text-green-400' },
  ];

  return (
    <div className="flex h-screen bg-[#0f0913] text-slate-100 overflow-hidden">
      <Sidebar currentPath="dashboard" onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-4 lg:px-8 border-b border-white/10 bg-[#0f0913]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="pl-14 lg:pl-0">
            <h1 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2">
              Creator Dashboard{' '}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                {stickers.length} Designs
              </span>
            </h1>
            <p className="text-slate-400 text-xs lg:text-sm hidden sm:block">
              Manage your collections, export WhatsApp/Telegram ZIP packs, or arrange in Playground
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
              variant="outline"
              size="sm"
              onClick={() => {
                playPop();
                setSheetModalOpen(true);
              }}
              className="gap-2 text-xs font-bold border-white/15 text-slate-200 hover:text-white"
            >
              <Printer size={16} /> <span className="hidden sm:inline">Print Sheet</span>
            </Button>

            <Button
              onClick={() => onNavigate('generator')}
              className="gap-2 text-sm px-4 py-2 font-black shadow-lg bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30"
            >
              <Wand2 size={18} /> <span className="hidden sm:inline">Animeify Studio</span>
            </Button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          <div className="max-w-[1920px] mx-auto w-full space-y-8">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between"
                >
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {stat.label}
                  </p>
                  <p className={`text-2xl lg:text-3xl font-black ${stat.color}`}>{stat.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Animeify Canva Studio Highlight Banner */}
            <div className="relative overflow-hidden rounded-3xl p-6 lg:p-8 border border-purple-500/30 bg-gradient-to-r from-[#200f38] via-[#160c29] to-[#0c0714] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-black uppercase tracking-wider">
                  <Sparkles size={13} className="text-purple-400" />
                  <span>Canva-Grade Animeify Studio</span>
                </div>
                <h3 className="text-xl lg:text-2xl font-black text-white">
                  Turn Photos into High-End Anime Characters in Seconds
                </h3>
                <p className="text-xs lg:text-sm text-slate-300 leading-relaxed">
                  Inspired by modern Canva workflows: Select or upload your photo, customize Shonen, Makoto Shinkai, or Ghibli aesthetics, and arrange on an interactive canvas with manga speech balloons, background removers, and die-cut borders.
                </p>
              </div>

              <Button
                onClick={() => onNavigate('generator')}
                className="shrink-0 font-extrabold px-6 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-xl shadow-purple-600/30 text-sm gap-2"
              >
                <Wand2 size={18} />
                <span>Launch Animeify Studio</span>
              </Button>
            </div>

            {/* Sticker Pack Tabs Bar & WhatsApp Export */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                <button
                  onClick={() => {
                    playPop();
                    setActivePackId('all');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    activePackId === 'all'
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  All Packs
                </button>
                {packs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      playPop();
                      setActivePackId(p.id);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      activePackId === p.id
                        ? 'bg-red-500 text-white shadow-md'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}

                {/* Add Pack button */}
                {showNewPackInput ? (
                  <form onSubmit={handleCreatePack} className="flex items-center gap-2 ml-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Pack name..."
                      value={newPackName}
                      onChange={(e) => setNewPackName(e.target.value)}
                      className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-xl text-xs text-white outline-none"
                    />
                    <Button size="sm" type="submit" className="text-xs px-2.5 py-1">
                      Save
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowNewPackInput(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowNewPackInput(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors whitespace-nowrap ml-1"
                  >
                    <FolderPlus size={15} /> New Pack
                  </button>
                )}
              </div>

              {/* WhatsApp & Telegram Pack ZIP Exporter */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleExportWhatsAppZip}
                  disabled={isExportingPackZip || filteredStickers.length === 0}
                  className="gap-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                  title="Export WhatsApp & Telegram sticker pack ZIP (512x512 WebP + Tray Icon + Manifest)"
                >
                  {isExportingPackZip ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Building Pack ZIP...</span>
                    </>
                  ) : packZipSuccess ? (
                    <>
                      <Check size={16} className="text-emerald-200" />
                      <span>ZIP Exported!</span>
                    </>
                  ) : (
                    <>
                      <Package size={16} />
                      <span>Export WhatsApp / Telegram Pack (.zip)</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Search and Type Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 max-w-md relative group">
                <Search
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-red-400 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Search stickers by name, tag, or anime style..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/50 outline-none text-xs placeholder:text-slate-500 text-white transition-all"
                />
              </div>

              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 self-start md:self-auto">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'static', label: 'Static' },
                  { id: 'animated', label: 'Animated' },
                  { id: 'favorites', label: '★ Favorites' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      playPop();
                      setFilter(t.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      filter === t.id ? 'bg-red-500 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sticker Gallery Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 lg:gap-6">
              {filteredStickers.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="group flex flex-col justify-between bg-white/5 rounded-2xl p-3 border border-white/10 hover:border-red-500/40 transition-all hover:shadow-xl hover:shadow-red-500/10"
                >
                  <TiltCard>
                    <div className="aspect-square rounded-xl bg-black/60 overflow-hidden relative border border-white/5 group-hover:border-red-500/50 transition-all cursor-pointer">
                      <img
                        src={s.img}
                        alt={s.name}
                        className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
                      />

                      {/* Animated badge */}
                      {s.animated && (
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md text-[9px] font-black text-white flex items-center gap-1 border border-white/10">
                          <Play size={8} fill="currentColor" /> GIF
                        </div>
                      )}

                      {/* Favorite Heart Pin */}
                      <button
                        onClick={(e) => handleToggleFavorite(s, e)}
                        className={`absolute top-2 left-2 size-7 rounded-full flex items-center justify-center transition-all ${
                          s.isFavorite
                            ? 'bg-red-500 text-white shadow'
                            : 'bg-black/60 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100'
                        }`}
                        title="Toggle Favorite"
                      >
                        <Heart size={14} fill={s.isFavorite ? 'currentColor' : 'none'} />
                      </button>

                      {/* Hover Action Overlay */}
                      <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 backdrop-blur-[2px]">
                        {/* Customize Studio */}
                        <button
                          onClick={() => {
                            playPop();
                            setCustomizingSticker(s);
                          }}
                          className="size-8 bg-white text-slate-900 rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform"
                          title="Open Sticker Studio Customizer"
                        >
                          <Sliders size={15} />
                        </button>

                        {/* Animate in GIF Lab */}
                        <button
                          onClick={() => onNavigate('giflab', { sticker: s })}
                          className="size-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform"
                          title="Animate in GIF Lab"
                        >
                          <Wand2 size={15} />
                        </button>

                        {/* Vector SVG */}
                        <button
                          onClick={(e) => handleDownloadSvg(s, e)}
                          className="size-8 bg-cyan-500/20 text-cyan-300 rounded-full flex items-center justify-center hover:scale-110 hover:bg-cyan-500/40 shadow-lg transition-transform"
                          title="Download Scalable Vector SVG"
                        >
                          <FileCode2 size={15} />
                        </button>

                        {/* Copy image */}
                        <button
                          onClick={(e) => handleCopySticker(s, e)}
                          className="size-8 bg-white/20 text-white rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform"
                          title="Copy PNG to Clipboard"
                        >
                          {copiedId === s.id ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={(e) => handleDeleteSticker(s.id, e)}
                          className="size-8 bg-red-500/20 text-red-300 rounded-full flex items-center justify-center hover:scale-110 hover:bg-red-500/40 shadow-lg transition-transform"
                          title="Delete Sticker"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </TiltCard>

                  <div className="mt-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs text-white truncate max-w-[130px]">{s.name}</h3>
                      <span className="text-[10px] text-slate-500">{s.time || 'Saved'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold text-red-400">
                        {s.stylePreset || 'Anime'}
                      </span>
                      <button
                        onClick={() => {
                          playPop();
                          setCustomizingSticker(s);
                        }}
                        className="text-[10px] text-slate-400 hover:text-white font-medium hover:underline"
                      >
                        Customize
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Upsell Banner if not top tier */}
            {plan.id !== 'proPlus' && (
              <div className="mt-12 p-8 rounded-3xl rgb-gradient text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-red-500/20 relative overflow-hidden">
                <div className="relative z-10 text-center md:text-left">
                  <h4 className="text-2xl font-black mb-2">Upgrade to Pro Creator</h4>
                  <p className="text-white/80 text-sm max-w-md">
                    Unlock 50 daily generations, export WhatsApp & Telegram sticker packs with zero watermarks, and get scalable SVG die-cut vector rights.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  className="relative z-10 text-red-600 font-bold whitespace-nowrap"
                  onClick={() => onNavigate('pricing')}
                >
                  Upgrade Now
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Printable Sheet Modal */}
      <StickerSheetModal
        open={sheetModalOpen}
        stickers={filteredStickers}
        title={activePackName}
        onClose={() => setSheetModalOpen(false)}
      />

      {/* Interactive Sticker Board / Playground Modal */}
      <StickerPlaygroundModal
        open={playgroundModalOpen}
        libraryStickers={stickers}
        onClose={() => setPlaygroundModalOpen(false)}
      />

      {/* In-Studio Customizer Modal */}
      {customizingSticker && (
        <StickerCustomizerModal
          open={Boolean(customizingSticker)}
          sticker={customizingSticker}
          onClose={() => setCustomizingSticker(null)}
          onSave={(updated) => {
            const list = updateStickerInStorage(updated.id, updated, user);
            setStickers(list);
          }}
          onAnimate={(sticker) => {
            onNavigate('giflab', { sticker });
          }}
        />
      )}
    </div>
  );
};
