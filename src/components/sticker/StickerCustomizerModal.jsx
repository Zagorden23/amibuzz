import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Sliders,
  Type,
  Sparkles,
  Copy,
  Download,
  Check,
  Wand2,
  Shield,
  Eye,
  FileCode2,
} from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { playPop, playSuccess } from '../../lib/audio.js';
import { fireConfetti } from '../../lib/confetti.js';
import { downloadStickerSvg } from '../../lib/vectorSvgExporter.js';
import { extractSubject, renderDieCut, createCanvas, canvasToStickerDataUrl, downscale, toPngBlob } from '../../lib/stickerFx.js';

export const StickerCustomizerModal = ({ open, onClose, sticker, onSave, onAnimate }) => {
  const canvasRef = useRef(null);

  // Customizer Controls State
  const [borderEnabled, setBorderEnabled] = useState(true);
  const [borderWidth, setBorderWidth] = useState(14);
  const [borderGlow, setBorderGlow] = useState('white'); // key of BORDER_STYLES
  const [shape, setShape] = useState('contour'); // 'contour' | 'circle' | 'rounded'
  const [subjectState, setSubjectState] = useState({ key: '', canvas: null, cut: '', error: '' });

  const [textEnabled, setTextEnabled] = useState(false);
  const [textContent, setTextContent] = useState('SUGOI!');
  const [textPosition, setTextPosition] = useState('bottom'); // 'bottom' | 'top' | 'badge'
  const [textStyle, setTextStyle] = useState('red'); // 'red' | 'cyan' | 'pink' | 'dark'

  const [decal, setDecal] = useState('none'); // 'none' | 'sparkles' | 'anger' | 'sweat' | 'hearts' | 'menacing' | 'rumble'

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(105);
  const [saturation, setSaturation] = useState(115);

  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const textPresets = [
    'SUGOI!',
    'BAKA!',
    'NANI?!',
    'GAMBARE!',
    'SENPAI!',
    'DOKI DOKI',
    'ドドド',
    'ゴゴゴ',
    'MISSION COMPLETE',
    'GG EZ',
  ];

  // Cut the artwork out once per sticker + shape; borders are redrawn live.
  useEffect(() => {
    if (!open || !sticker) return undefined;
    let cancelled = false;
    const key = `${sticker.id}|${sticker.img?.length}|${shape}`;
    (async () => {
      try {
        // Stickers made by the studio carry a border-less cut-out; older ones
        // are cut out of their image here.
        const src = shape === 'contour' && sticker.cutout ? sticker.cutout : sticker.img;
        const { subject, cut } = await extractSubject(src, { cut: shape === 'contour' ? 'auto' : shape, workSize: 768 });
        if (!cancelled) setSubjectState({ key, canvas: subject, cut, error: '' });
      } catch (err) {
        if (!cancelled) setSubjectState({ key, canvas: null, cut: '', error: err?.message || 'Could not load this sticker.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sticker, shape]);

  // Redraw whenever a setting changes.
  useEffect(() => {
    if (!open || !sticker) return;
    drawStickerCanvas();
  }, [
    open,
    sticker,
    subjectState,
    borderEnabled,
    borderWidth,
    borderGlow,
    textEnabled,
    textContent,
    textPosition,
    textStyle,
    decal,
    brightness,
    contrast,
    saturation,
  ]);

  const drawStickerCanvas = () => {
    const canvas = canvasRef.current;
    const subject = subjectState.canvas;
    if (!canvas || !subject) return;
    const size = 600;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // Colour adjustments are baked into the artwork before the border is
    // built, so the border itself stays clean.
    let art = subject;
    if (brightness !== 100 || contrast !== 100 || saturation !== 100) {
      art = createCanvas(subject.width, subject.height);
      const actx = art.getContext('2d');
      actx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      actx.drawImage(subject, 0, 0);
    }

    const scaledBorder = Math.round(borderWidth * (size / 512));
    const dieCut = renderDieCut(art, {
      size,
      borderWidth: borderEnabled ? scaledBorder : 0,
      borderStyle: borderGlow,
      shadow: borderEnabled,
    });
    ctx.drawImage(dieCut, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.4;

    // Decal overlays (anime expressions)
    ctx.save();
    if (decal === 'sparkles') {
      drawDecalText(ctx, '✨', cx + radius * 0.65, cy - radius * 0.65, 42);
      drawDecalText(ctx, '✦', cx - radius * 0.7, cy - radius * 0.4, 32, '#fde047');
      drawDecalText(ctx, '★', cx + radius * 0.6, cy + radius * 0.5, 30, '#f472b6');
    } else if (decal === 'anger') {
      drawDecalText(ctx, '💢', cx + radius * 0.6, cy - radius * 0.6, 48);
    } else if (decal === 'sweat') {
      drawDecalText(ctx, '💧', cx + radius * 0.65, cy - radius * 0.4, 46);
    } else if (decal === 'hearts') {
      drawDecalText(ctx, '💖', cx + radius * 0.65, cy - radius * 0.6, 42);
      drawDecalText(ctx, '💕', cx - radius * 0.65, cy - radius * 0.5, 36);
    } else if (decal === 'menacing') {
      drawDecalText(ctx, 'ゴ', cx - radius * 0.75, cy - radius * 0.2, 48, '#a855f7');
      drawDecalText(ctx, 'ゴ', cx - radius * 0.6, cy + radius * 0.3, 40, '#a855f7');
      drawDecalText(ctx, 'ゴ', cx + radius * 0.65, cy - radius * 0.3, 44, '#ec4899');
    } else if (decal === 'rumble') {
      drawDecalText(ctx, 'ド', cx - radius * 0.75, cy - radius * 0.2, 48, '#ef4444');
      drawDecalText(ctx, 'ド', cx - radius * 0.6, cy + radius * 0.3, 40, '#ef4444');
      drawDecalText(ctx, 'ド', cx + radius * 0.65, cy - radius * 0.3, 44, '#f59e0b');
    }
    ctx.restore();

    // Text ribbon
    if (textEnabled && textContent.trim()) {
      ctx.save();
      const bannerHeight = 52;
      let by = cy + radius * 0.85;
      let bx = cx;
      if (textPosition === 'top') by = cy - radius * 0.85;
      if (textPosition === 'badge') {
        bx = cx + radius * 0.5;
        by = cy - radius * 0.62;
      }

      const styles = {
        red: { bg: '#ef4444', text: '#ffffff', border: '#ffffff' },
        cyan: { bg: '#06b6d4', text: '#082f49', border: '#ffffff' },
        pink: { bg: '#ec4899', text: '#ffffff', border: '#ffffff' },
        dark: { bg: '#0f172a', text: '#f8fafc', border: '#ef4444' },
      };
      const curStyle = styles[textStyle] || styles.red;

      let fontSize = 26;
      ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
      while (ctx.measureText(textContent).width > size * 0.78 && fontSize > 12) {
        fontSize -= 1;
        ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const bannerWidth = Math.max(140, ctx.measureText(textContent).width + 48);
      bx = Math.min(size - bannerWidth / 2 - 8, Math.max(bannerWidth / 2 + 8, bx));

      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = curStyle.bg;
      ctx.strokeStyle = curStyle.border;
      ctx.lineWidth = 4;
      roundRect(ctx, bx - bannerWidth / 2, by - bannerHeight / 2, bannerWidth, bannerHeight, 26);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.fillStyle = curStyle.text;
      ctx.fillText(textContent, bx, by + 1);
      ctx.restore();
    }
  };

  const drawDecalText = (ctx, char, x, y, size, fill = null) => {
    ctx.save();
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillText(char, x, y);
    } else {
      ctx.fillText(char, x, y);
    }
    ctx.restore();
  };

  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // Copy PNG to Clipboard
  const handleCopyClipboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await toPngBlob(canvas);
      if (blob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        playSuccess();
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.warn('Clipboard copy fallback:', err);
    }
  };

  // Download Transparent PNG
  const handleDownloadPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    playPop();
    const blob = await toPngBlob(canvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = (sticker?.name || 'custom-sticker').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    link.download = `${safeName || 'custom-sticker'}-diecut.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    playSuccess();
  };

  // Escape closes the customizer.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Download Scalable Vector SVG (Recraft style)
  const handleDownloadSvg = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    playPop();
    downloadStickerSvg({
      imgUrl: canvas.toDataURL('image/png'),
      name: sticker?.name,
      mode: 'diecut',
    });
    playSuccess();
  };

  // Save to user storage
  const handleSaveToLibrary = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    playPop();
    const updatedSticker = {
      ...sticker,
      img: canvasToStickerDataUrl(canvas),
      // Keep the clean artwork so the sticker can be re-bordered later.
      cutout:
        sticker.cutout ||
        (subjectState.cut === 'contour' && subjectState.canvas
          ? canvasToStickerDataUrl(downscale(subjectState.canvas, 512), 0.9)
          : null),
      customized: true,
      lastModified: Date.now(),
    };
    onSave?.(updatedSticker);
    playSuccess();
    fireConfetti();
    onClose();
  };

  const handleGoToGifLab = () => {
    const canvas = canvasRef.current;
    const currentImg = canvas ? canvas.toDataURL('image/png') : sticker.img;
    onAnimate?.({
      ...sticker,
      img: currentImg,
    });
    onClose();
  };

  if (!open || !sticker) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-5xl h-[92vh] max-h-[860px] bg-[#140e1b] border border-white/10 rounded-3xl shadow-2xl flex flex-col lg:flex-row overflow-hidden text-slate-100"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 size-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Left Canvas Preview Stage */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#0a060d] relative overflow-hidden">
            <div className="relative w-full max-w-[420px] aspect-square rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex items-center justify-center bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgfQEhD/o+OQZIMxG4c1EAaGEY1gDAg0xQ+OqMawDAg0xQ+OqMaQBgA+zQ+O2/1h6gAAAAASUVORK5CYII=')]">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain drop-shadow-2xl transition-all duration-200"
              />
            </div>

            {/* Quick Action Pills Under Canvas */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyClipboard}
                className="gap-2 text-xs font-bold"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                {copied ? 'Copied PNG!' : 'Copy PNG'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSvg}
                className="gap-2 text-xs font-bold text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10"
                title="Download Scalable Vector SVG (Recraft Style)"
              >
                <FileCode2 size={16} /> Vector SVG
              </Button>

              <Button
                size="sm"
                onClick={handleDownloadPng}
                className="gap-2 text-xs font-bold"
              >
                <Download size={16} /> Download PNG
              </Button>
            </div>
          </div>

          {/* Right Customizer Studio Controls */}
          <div className="w-full lg:w-[420px] border-l border-white/10 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar bg-[#140e1b]">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <Sliders size={20} className="text-red-400" />
              <h3 className="text-base font-black text-white">Sticker Studio Customizer</h3>
            </div>

            {/* 0. Cut shape */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Cut Shape</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'contour', label: 'Follow outline' },
                  { id: 'circle', label: 'Circle' },
                  { id: 'rounded', label: 'Rounded card' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      playPop();
                      setShape(opt.id);
                    }}
                    className={`text-[11px] font-bold py-2 rounded-lg border transition-all ${
                      shape === opt.id
                        ? 'bg-red-500/20 border-red-500 text-white'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {shape === 'contour' && subjectState.canvas && subjectState.cut !== 'contour' && (
                <p className="text-[10px] text-yellow-300">
                  This image has a busy background, so it was cut as a rounded card. Generate on a plain background
                  for an outline cut.
                </p>
              )}
              {subjectState.error && <p className="text-[10px] text-red-300">{subjectState.error}</p>}
            </div>

            {/* 1. Die-Cut Contour Border */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield size={14} className="text-red-400" /> Die-Cut Contour Border
                </label>
                <button
                  onClick={() => {
                    playPop();
                    setBorderEnabled(!borderEnabled);
                  }}
                  className={`text-[11px] font-black px-2.5 py-0.5 rounded-full transition-colors ${
                    borderEnabled ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {borderEnabled ? 'ACTIVE' : 'OFF'}
                </button>
              </div>

              {borderEnabled && (
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Contour Thickness</span>
                    <span className="text-white font-bold">{borderWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="36"
                    value={borderWidth}
                    onChange={(e) => setBorderWidth(Number(e.target.value))}
                    className="w-full accent-red-500 cursor-pointer"
                  />

                  {/* Border Style Presets */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Contour Finish</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'white', label: 'Classic White' },
                        { id: 'holo', label: 'Holo Rainbow' },
                        { id: 'cyan', label: 'Cyber Neon' },
                        { id: 'pink', label: 'Kawaii Pink' },
                        { id: 'gold', label: 'Gold Aura' },
                        { id: 'black', label: 'Ink Black' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            playPop();
                            setBorderGlow(preset.id);
                          }}
                          className={`text-[10px] font-bold py-1.5 rounded-lg border transition-all ${
                            borderGlow === preset.id
                              ? 'bg-red-500/20 border-red-500 text-white'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Text Banner Ribbon */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Type size={14} className="text-yellow-400" /> Anime Speech Ribbon
                </label>
                <button
                  onClick={() => {
                    playPop();
                    setTextEnabled(!textEnabled);
                  }}
                  className={`text-[11px] font-black px-2.5 py-0.5 rounded-full transition-colors ${
                    textEnabled ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {textEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {textEnabled && (
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <input
                    type="text"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Enter sticker caption..."
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-black tracking-wide outline-none focus:border-red-500/50"
                  />

                  {/* Preset chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {textPresets.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          playPop();
                          setTextContent(preset);
                        }}
                        className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <select
                      value={textPosition}
                      onChange={(e) => setTextPosition(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white outline-none"
                    >
                      <option value="bottom">Bottom Ribbon</option>
                      <option value="top">Top Banner</option>
                      <option value="badge">Corner Badge</option>
                    </select>

                    <select
                      value={textStyle}
                      onChange={(e) => setTextStyle(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white outline-none"
                    >
                      <option value="red">Manga Red</option>
                      <option value="cyan">Cyber Cyan</option>
                      <option value="pink">Kawaii Pink</option>
                      <option value="dark">Dark Carbon</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Anime Decal Overlays */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-400" /> Expression Decals & Manga SFX
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'none', label: 'None' },
                  { id: 'sparkles', label: '✨ Sparkles' },
                  { id: 'anger', label: '💢 Anger Mark' },
                  { id: 'sweat', label: '💧 Sweatdrop' },
                  { id: 'hearts', label: '💖 Doki Doki' },
                  { id: 'menacing', label: 'ゴ Menacing' },
                  { id: 'rumble', label: 'ド Rumble' },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      playPop();
                      setDecal(d.id);
                    }}
                    className={`py-2 px-2 text-xs font-bold rounded-xl transition-all ${
                      decal === d.id
                        ? 'bg-purple-600/30 border border-purple-500 text-purple-200 shadow-md'
                        : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Filter Enhancements */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Eye size={14} className="text-green-400" /> Anime Vibrance & Contrast
              </label>
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Vibrance / Saturation</span>
                  <span className="text-white font-bold">{saturation}%</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="160"
                  value={saturation}
                  onChange={(e) => setSaturation(Number(e.target.value))}
                  className="w-full accent-green-500 cursor-pointer"
                />

                <div className="flex justify-between text-xs text-slate-400 pt-1">
                  <span>Contrast</span>
                  <span className="text-white font-bold">{contrast}%</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="140"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-green-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="mt-auto pt-4 border-t border-white/10 flex flex-col gap-2">
              <Button onClick={handleSaveToLibrary} className="w-full gap-2">
                <Check size={18} /> Save Customized Sticker
              </Button>
              <Button
                variant="outline"
                onClick={handleGoToGifLab}
                className="w-full gap-2 text-slate-300 hover:text-white"
              >
                <Wand2 size={16} /> Animate in GIF Lab
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
