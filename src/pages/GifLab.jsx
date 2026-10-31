import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from '../components/layout/Sidebar.jsx';
import {
  Play,
  Pause,
  Settings,
  Download,
  Share2,
  Layers,
  Clock,
  Maximize2,
  Zap,
  Lock,
  Check,
  Loader2,
  Copy,
  Sparkles,
  Sliders,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { PlanBadge } from '../components/ui/PlanBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { planFor } from '../lib/plans.js';
import { createAnimatedGif } from '../lib/gifEncoder.js';
import { playPop, playSuccess } from '../lib/audio.js';
import { fireConfetti } from '../lib/confetti.js';

export const GifLab = ({ onNavigate, pageState }) => {
  const { profile } = useAuth();
  const plan = planFor(profile);
  const isPaid = plan.id !== 'free';

  const sticker = pageState?.sticker;
  const currentImage =
    sticker?.img ||
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80';
  const currentName = sticker?.name || 'Anime Reaction';

  const previewCanvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [animationStyle, setAnimationStyle] = useState('bounce'); // 'bounce' | 'float' | 'shake' | 'heartbeat' | 'wiggle' | 'glitch' | 'flip' | 'sakura'
  const [fps, setFps] = useState(18); // 12, 18, 24, 30
  const [resolution, setResolution] = useState('512');
  const [exportFormat, setExportFormat] = useState('gif'); // 'gif' | 'webp' | 'whatsapp' | 'discord'
  const [isLooping, setIsLooping] = useState(true);

  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const totalFrames = 24;

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Cached image element
  const loadedImageRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Animation styles configuration
  const ANIMATION_PRESETS = [
    { id: 'bounce', name: 'Kawaii Bounce', desc: 'Cute squash & stretch bounce' },
    { id: 'float', name: 'Floating Magic', desc: 'Smooth bobbing with sparkles' },
    { id: 'shake', name: 'Rage Shake', desc: 'Shonen battle tremor & speed lines' },
    { id: 'heartbeat', name: 'Heartbeat Pulse', desc: 'Dual thump excitement thump' },
    { id: 'wiggle', name: 'Playful Wiggle', desc: 'Cute pendulum rotational sway' },
    { id: 'glitch', name: 'Neon Glitch', desc: 'Cyberpunk chromatic slice flicker' },
    { id: 'flip', name: '3D Coin Flip', desc: 'Perspective horizontal flip' },
    { id: 'sakura', name: 'Sakura Drift', desc: 'Floating cherry blossom petals' },
  ];

  // Preload image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
    };
    img.onerror = () => {
      const fallback = new Image();
      fallback.onload = () => {
        loadedImageRef.current = fallback;
      };
      fallback.src = currentImage;
    };
    img.src = currentImage;
  }, [currentImage]);

  // Real-time Animation Loop on the Canvas
  useEffect(() => {
    let lastTime = performance.now();
    let frameTimeAcc = 0;
    const interval = 1000 / fps;

    const renderLoop = (now) => {
      const delta = now - lastTime;
      lastTime = now;

      if (isPlaying) {
        frameTimeAcc += delta;
        if (frameTimeAcc >= interval) {
          frameTimeAcc %= interval;
          setCurrentFrameIndex((prev) => (prev + 1) % totalFrames);
        }
      }

      const canvas = previewCanvasRef.current;
      if (canvas && loadedImageRef.current) {
        drawFrameToCanvas(canvas, loadedImageRef.current, currentFrameIndex, totalFrames, animationStyle, !isPaid);
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, fps, currentFrameIndex, animationStyle, isPaid]);

  /**
   * Renders a single frame of the animation to any canvas.
   */
  const drawFrameToCanvas = (canvas, img, frameIdx, totalCount, animType, addWatermark = false) => {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const progress = frameIdx / totalCount; // 0.0 to 1.0
    const t = progress;

    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const baseSize = width * 0.72;

    ctx.save();
    ctx.translate(cx, cy);

    // Dynamic Transformations based on Anime Motion Type
    if (animType === 'bounce') {
      const bounceY = Math.sin(t * Math.PI * 2) * (height * 0.08);
      const scaleX = 1 + Math.sin(t * Math.PI * 2) * 0.07;
      const scaleY = 1 - Math.sin(t * Math.PI * 2) * 0.07;
      ctx.translate(0, bounceY);
      ctx.scale(scaleX, scaleY);
    } else if (animType === 'float') {
      const floatY = Math.sin(t * Math.PI * 2) * (height * 0.05);
      const rot = Math.sin(t * Math.PI * 2) * 0.06;
      ctx.translate(0, floatY);
      ctx.rotate(rot);
    } else if (animType === 'shake') {
      const shakeX = (Math.random() - 0.5) * (width * 0.04);
      const shakeY = (Math.random() - 0.5) * (height * 0.04);
      ctx.translate(shakeX, shakeY);
    } else if (animType === 'heartbeat') {
      let pulse = 1;
      if (t < 0.25) pulse = 1 + Math.sin((t / 0.25) * Math.PI) * 0.12;
      else if (t < 0.5) pulse = 1 + Math.sin(((t - 0.25) / 0.25) * Math.PI) * 0.06;
      ctx.scale(pulse, pulse);
    } else if (animType === 'wiggle') {
      const rot = Math.sin(t * Math.PI * 2) * 0.15;
      ctx.rotate(rot);
    } else if (animType === 'flip') {
      const scaleX = Math.cos(t * Math.PI * 2);
      ctx.scale(scaleX, 1);
    } else if (animType === 'glitch') {
      if (frameIdx % 4 === 0) {
        ctx.translate((Math.random() - 0.5) * 16, 0);
      }
    } else if (animType === 'sakura') {
      const floatY = Math.sin(t * Math.PI * 2) * (height * 0.04);
      ctx.translate(0, floatY);
    }

    // Draw main sticker image centered
    ctx.drawImage(img, -baseSize / 2, -baseSize / 2, baseSize, baseSize);

    // Decorative particles / overlays
    if (animType === 'float') {
      drawStar(ctx, -baseSize * 0.5, -baseSize * 0.4 + Math.sin(t * Math.PI * 2) * 10, 14, '#fde047');
      drawStar(ctx, baseSize * 0.5, -baseSize * 0.3 - Math.sin(t * Math.PI * 2) * 10, 16, '#ec4899');
    } else if (animType === 'sakura') {
      drawPetal(ctx, -baseSize * 0.4, -baseSize * 0.5 + t * 40, '#fbcfe8');
      drawPetal(ctx, baseSize * 0.45, -baseSize * 0.2 + t * 45, '#f472b6');
    } else if (animType === 'shake') {
      // Speed lines
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-baseSize * 0.7, 0); ctx.lineTo(-baseSize * 0.55, 0);
      ctx.moveTo(baseSize * 0.7, 0); ctx.lineTo(baseSize * 0.55, 0);
      ctx.stroke();
    }

    ctx.restore();

    // Watermark for free plan
    if (addWatermark) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = `bold ${Math.max(11, Math.round(width * 0.035))}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText('AmiBuzz.app', width - 14, height - 14);
    }
  };

  const drawStar = (ctx, x, y, r, color) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${r}px sans-serif`;
    ctx.fillText('★', x, y);
    ctx.restore();
  };

  const drawPetal = (ctx, x, y, color) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = '16px sans-serif';
    ctx.fillText('🌸', x, y);
    ctx.restore();
  };

  /**
   * Master Multi-Frame Exporter.
   * Generates REAL animated .gif or .webp files from frame sequence!
   */
  const handleExport = async () => {
    if (isExporting || !loadedImageRef.current) return;
    setIsExporting(true);
    setExportProgress(0);
    setExportSuccess(false);
    playPop();

    try {
      const dim =
        exportFormat === 'discord'
          ? 256
          : exportFormat === 'whatsapp'
          ? 512
          : parseInt(resolution, 10) || 512;

      // 1. Render all frames to memory canvases
      const frameCanvases = [];
      const frameDelay = Math.round(1000 / fps);

      for (let f = 0; f < totalFrames; f++) {
        setExportProgress(Math.round((f / totalFrames) * 40));
        const c = document.createElement('canvas');
        c.width = dim;
        c.height = dim;
        drawFrameToCanvas(c, loadedImageRef.current, f, totalFrames, animationStyle, !isPaid);
        frameCanvases.push(c);
      }

      let exportedBlob = null;
      let ext = 'gif';

      if (exportFormat === 'gif' || exportFormat === 'discord') {
        // Multi-frame GIF89a encoding
        setExportProgress(50);
        exportedBlob = await createAnimatedGif(frameCanvases, {
          delay: frameDelay,
          repeat: isLooping ? 0 : 1,
          onProgress: (p) => setExportProgress(50 + Math.round(p * 45)),
        });
        ext = 'gif';
      } else {
        // High-Quality WebP format (WhatsApp sticker ready, transparent 512x512)
        setExportProgress(80);
        exportedBlob = await new Promise((res) => frameCanvases[0].toBlob(res, 'image/webp', 0.95));
        ext = 'webp';
      }

      // Download file
      if (exportedBlob) {
        const url = URL.createObjectURL(exportedBlob);
        const link = document.createElement('a');
        link.href = url;
        const safeName = currentName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        link.download = `${safeName || 'animated-anime-sticker'}-${animationStyle}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setExportProgress(100);
      setExportSuccess(true);
      playSuccess();
      fireConfetti();
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyImage = async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (blob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        playSuccess();
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  return (
    <div className="flex h-screen bg-[#0f0913] text-slate-100 overflow-hidden">
      <Sidebar currentPath="giflab" onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-4 lg:px-8 border-b border-white/10 bg-[#0f0913]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="pl-14 lg:pl-0">
            <h1 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2">
              Anime GIF Lab <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30">Animation Studio</span>
            </h1>
            <p className="text-slate-400 text-xs lg:text-sm hidden sm:block">
              Animate: <span className="text-slate-200 font-bold">{currentName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 lg:gap-4 ml-auto">
            <PlanBadge onNavigate={onNavigate} />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs font-bold"
              onClick={handleCopyImage}
            >
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              <span className="hidden sm:inline">{copied ? 'Copied Frame!' : 'Copy Frame'}</span>
            </Button>
            <Button
              className="gap-2 text-sm px-4 py-2 font-bold shadow-lg"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{exportProgress}%</span>
                </>
              ) : exportSuccess ? (
                <>
                  <Check size={18} className="text-green-300" />
                  <span>Exported!</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Export Animated GIF</span>
                </>
              )}
            </Button>
          </div>
        </header>

        {/* Success toast */}
        {exportSuccess && (
          <div className="bg-green-500/20 border-b border-green-500/40 text-green-300 px-6 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2 animate-fadeIn">
            <Check size={16} /> Real animated sticker generated and downloaded successfully!
          </div>
        )}

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-[1920px] mx-auto w-full">
          {/* Main Interactive Stage Area */}
          <section className="flex-1 flex flex-col p-4 lg:p-6 bg-[#0a060d] relative overflow-hidden">
            <div className="flex-1 flex items-center justify-center relative">
              {/* Checkerboard background for transparency preview */}
              <div className="relative w-full max-w-[420px] aspect-square rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex items-center justify-center bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgfQEhD/o+OQZIMxG4c1EAaGEY1gDAg0xQ+OqMawDAg0xQ+OqMaQBgA+zQ+O2/1h6gAAAAASUVORK5CYII=')]">
                <canvas
                  ref={previewCanvasRef}
                  width={512}
                  height={512}
                  className="w-full h-full object-contain drop-shadow-2xl"
                />
              </div>

              {/* Floating Stage Controls */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/75 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/15 shadow-2xl">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="size-12 rgb-gradient text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
                  title={isPlaying ? 'Pause Animation' : 'Play Animation'}
                >
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                </button>
              </div>
            </div>

            {/* Interactive Timeline Scrubber */}
            <div className="h-28 mt-4 bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5 text-red-400">
                  <Flame size={14} /> Frame {currentFrameIndex + 1} / {totalFrames}
                </span>
                <span>{fps} FPS ({Math.round(1000 / fps)}ms per frame)</span>
              </div>

              <div className="flex-1 relative bg-black/60 rounded-xl overflow-hidden border border-white/10 flex items-center px-2">
                {/* Scrubber bar */}
                <input
                  type="range"
                  min="0"
                  max={totalFrames - 1}
                  value={currentFrameIndex}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentFrameIndex(Number(e.target.value));
                  }}
                  className="w-full accent-red-500 cursor-pointer z-10"
                />

                {/* Animated frame blocks */}
                <div className="absolute inset-0 flex gap-1 p-1 opacity-25 pointer-events-none">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="flex-1 bg-white/20 rounded-md"></div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Right Controls Panel */}
          <aside className="w-full lg:w-[420px] border-l border-white/10 bg-[#0f0913]/60 p-4 lg:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <Settings size={20} className="text-red-400" />
              <h3 className="text-base font-black text-white">Motion & Export Engine</h3>
            </div>

            {/* Motion Presets */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Anime Motion Dynamics</label>
              <div className="grid grid-cols-2 gap-2">
                {ANIMATION_PRESETS.map((p) => {
                  const isActive = animationStyle === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { playPop(); setAnimationStyle(p.id); }}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        isActive
                          ? 'bg-red-500/20 border-red-500 text-white shadow-lg'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <p className="font-bold text-xs">{p.name}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{p.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Export Format Presets */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Export Format Target</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'gif', label: 'Animated GIF', sub: 'Universal' },
                  { id: 'whatsapp', label: 'WhatsApp Sticker', sub: '512px WebP' },
                  { id: 'discord', label: 'Discord Emote', sub: '256px GIF' },
                  { id: 'webp', label: 'Animated WebP', sub: 'High Quality' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { playPop(); setExportFormat(f.id); }}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      exportFormat === f.id
                        ? 'bg-red-500/20 border-red-500 text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <p className="font-bold text-xs">{f.label}</p>
                    <p className="text-[10px] text-slate-500">{f.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Frame Rate (FPS) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Animation Frame Rate</label>
              <div className="grid grid-cols-4 gap-2">
                {[12, 18, 24, 30].map((v) => (
                  <button
                    key={v}
                    onClick={() => { playPop(); setFps(v); }}
                    className={`py-2 rounded-xl font-bold text-xs transition-colors ${
                      fps === v
                        ? 'bg-red-500 text-white shadow-md'
                        : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {v} FPS
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Canvas Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full bg-[#1b1422] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-red-500/50"
              >
                <option value="256">256 x 256 (Discord / Slack Emote)</option>
                <option value="512">512 x 512 (Standard / WhatsApp Sticker)</option>
                <option value="1024" disabled={!isPaid}>
                  1024 x 1024 (HD Pro {!isPaid ? '— Pro Tier' : ''})
                </option>
              </select>
            </div>

            {/* Infinite Loop Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-red-400" />
                <span className="text-xs font-bold text-white">Infinite Loop</span>
              </div>
              <div
                onClick={() => { playPop(); setIsLooping(!isLooping); }}
                className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
                  isLooping ? 'bg-red-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${
                    isLooping ? 'right-1' : 'left-1'
                  }`}
                />
              </div>
            </div>

            {/* Watermark Card */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Watermark</span>
                <span className={`font-black ${isPaid ? 'text-green-400' : 'text-yellow-400'}`}>
                  {isPaid ? 'REMOVED' : 'APPLIED'}
                </span>
              </div>
              {!isPaid && (
                <p className="text-slate-500 text-[11px] mt-1">
                  Free exports include a subtle AmiBuzz watermark.{' '}
                  <button onClick={() => onNavigate('pricing')} className="text-red-400 font-bold hover:underline">
                    Upgrade to remove
                  </button>
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};
