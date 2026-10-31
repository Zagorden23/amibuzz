import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sliders, Type, Sparkles, Copy, Download, Check, Wand2, Shield, Eye } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { playPop, playSuccess } from '../../lib/audio.js';
import { fireConfetti } from '../../lib/confetti.js';

export const StickerCustomizerModal = ({ open, onClose, sticker, onSave, onAnimate }) => {
  const canvasRef = useRef(null);

  // Customizer Controls State
  const [borderEnabled, setBorderEnabled] = useState(true);
  const [borderWidth, setBorderWidth] = useState(12);
  const [borderGlow, setBorderGlow] = useState('shadow'); // 'none' | 'shadow' | 'cyan' | 'pink' | 'gold'

  const [textEnabled, setTextEnabled] = useState(false);
  const [textContent, setTextContent] = useState('SUGOI!');
  const [textPosition, setTextPosition] = useState('bottom'); // 'bottom' | 'top' | 'badge'
  const [textStyle, setTextStyle] = useState('red'); // 'red' | 'cyan' | 'pink' | 'dark'

  const [decal, setDecal] = useState('none'); // 'none' | 'sparkles' | 'anger' | 'sweat' | 'hearts' | 'menacing'

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(105);
  const [saturation, setSaturation] = useState(115);

  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const textPresets = ['SUGOI!', 'BAKA!', 'NANI?!', 'GAMBARE!', 'SENPAI!', 'DOKI DOKI', 'MISSION COMPLETE', 'GG EZ'];

  // Redraw canvas whenever settings change
  useEffect(() => {
    if (!open || !sticker) return;
    drawStickerCanvas();
  }, [
    open,
    sticker,
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

  const drawStickerCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !sticker?.img) return;
    const ctx = canvas.getContext('2d');
    const size = 600;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = () => {
        const fallback = new Image();
        fallback.onload = resolve;
        fallback.onerror = resolve;
        fallback.src = sticker.img;
      };
      img.src = sticker.img;
    });

    const pad = borderWidth + 30;
    const drawSize = size - pad * 2;
    const cx = size / 2;
    const cy = size / 2;
    const radius = drawSize / 2;

    // Apply Glow / Drop Shadow for die-cut border
    ctx.save();
    if (borderEnabled) {
      if (borderGlow === 'shadow') {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 10;
      } else if (borderGlow === 'cyan') {
        ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
        ctx.shadowBlur = 24;
      } else if (borderGlow === 'pink') {
        ctx.shadowColor = 'rgba(236, 72, 153, 0.8)';
        ctx.shadowBlur = 24;
      } else if (borderGlow === 'gold') {
        ctx.shadowColor = 'rgba(234, 179, 8, 0.8)';
        ctx.shadowBlur = 24;
      }

      // Die-cut white contour boundary
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, radius + borderWidth, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Draw main image inside circular clip with color adjustments
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();

    // Decal overlays (Anime expressions)
    ctx.save();
    if (decal === 'sparkles') {
      drawDecalText(ctx, '✨', cx + radius * 0.65, cy - radius * 0.65, 42);
      drawDecalText(ctx, '✦', cx - radius * 0.7, cy - radius * 0.4, 32);
      drawDecalText(ctx, '★', cx + radius * 0.6, cy + radius * 0.5, 30);
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
      drawDecalText(ctx, 'ド', cx + radius * 0.65, cy - radius * 0.3, 44, '#ec4899');
    }
    ctx.restore();

    // Text banner / Ribbon caption
    if (textEnabled && textContent.trim()) {
      ctx.save();
      const bannerHeight = 52;
      let by = cy + radius * 0.72;
      let bx = cx;

      if (textPosition === 'top') by = cy - radius * 0.72;
      if (textPosition === 'badge') {
        bx = cx + radius * 0.5;
        by = cy - radius * 0.5;
      }

      const styles = {
        red: { bg: '#ef4444', text: '#ffffff', border: '#ffffff' },
        cyan: { bg: '#06b6d4', text: '#082f49', border: '#ffffff' },
        pink: { bg: '#ec4899', text: '#ffffff', border: '#ffffff' },
        dark: { bg: '#0f172a', text: '#f8fafc', border: '#ef4444' },
      };
      const curStyle = styles[textStyle] || styles.red;

      ctx.font = '900 24px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textMetrics = ctx.measureText(textContent.toUpperCase());
      const bannerWidth = Math.min(size - 60, textMetrics.width + 48);

      // Draw Ribbon background with pill curve
      ctx.fillStyle = curStyle.bg;
      ctx.strokeStyle = curStyle.border;
      ctx.lineWidth = 4;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      roundRect(ctx, bx - bannerWidth / 2, by - bannerHeight / 2, bannerWidth, bannerHeight, 26);
      ctx.fill();
      ctx.stroke();

      // Banner text
      ctx.shadowBlur = 0;
      ctx.fillStyle = curStyle.text;
      ctx.fillText(textContent.toUpperCase(), bx, by + 1);
      ctx.restore();
    }
  };

  const drawDecalText = (ctx, symbol, x, y, size, color = '#ffffff') => {
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillText(symbol, x, y);
  };

  const roundRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const handleCopyClipboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (blob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        playSuccess();
        fireConfetti();
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsExporting(true);
    try {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      const safeName = (sticker.name || 'anime-sticker').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      link.download = `${safeName}-diecut.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      playSuccess();
      fireConfetti();
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToLibrary = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const customizedImg = canvas.toDataURL('image/png');
    onSave?.({
      ...sticker,
      img: customizedImg,
      customized: true,
      borderSettings: { borderEnabled, borderWidth, borderGlow },
      textBanner: textEnabled ? { textContent, textPosition, textStyle } : null,
    });
    playSuccess();
    onClose();
  };

  const handleGoToGifLab = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const customizedImg = canvas.toDataURL('image/png');
    onAnimate?.({
      ...sticker,
      img: customizedImg,
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
        className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl bg-[#130b1b] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[92vh]"
        >
          {/* Left Canvas Preview */}
          <div className="flex-1 bg-[#09050d] p-6 flex flex-col items-center justify-center relative border-b md:border-b-0 md:border-r border-white/10">
            <button
              onClick={onClose}
              className="md:hidden absolute top-4 right-4 p-2 rounded-xl bg-white/10 text-white"
            >
              <X size={18} />
            </button>

            {/* Checkerboard transparency container */}
            <div className="relative w-full max-w-[340px] aspect-square rounded-2xl border border-white/15 overflow-hidden shadow-2xl flex items-center justify-center bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgfQEhD/o+OQZIMxG4c1EAaGEY1gDAg0xQ+OqMawDAg0xQ+OqMaQBgA+zQ+O2/1h6gAAAAASUVORK5CYII=')]">
              <canvas ref={canvasRef} className="w-full h-full object-contain drop-shadow-2xl" />
            </div>

            <div className="flex items-center gap-3 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyClipboard}
                className="gap-2 text-xs font-bold"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                <span>{copied ? 'Copied PNG!' : 'Copy to Clipboard'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-2 text-xs font-bold"
              >
                <Download size={16} /> Download
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Exports with 100% transparent background & die-cut contour</p>
          </div>

          {/* Right Controls Panel */}
          <div className="w-full md:w-[420px] p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6 bg-[#130b1b]">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sliders size={20} className="text-red-400" />
                <h3 className="font-black text-lg text-white">Sticker Studio Customizer</h3>
              </div>
              <button
                onClick={onClose}
                className="hidden md:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* 1. Die-Cut Border Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield size={14} className="text-red-400" /> White Die-Cut Border
                </label>
                <button
                  onClick={() => { playPop(); setBorderEnabled(!borderEnabled); }}
                  className={`text-xs font-bold px-2.5 py-1 rounded-md transition-colors ${borderEnabled ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-slate-400'}`}
                >
                  {borderEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {borderEnabled && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Border Thickness</span>
                    <span className="text-white font-bold">{borderWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="24"
                    value={borderWidth}
                    onChange={(e) => setBorderWidth(Number(e.target.value))}
                    className="w-full accent-red-500 cursor-pointer"
                  />

                  <div className="flex gap-1.5 pt-1">
                    {[
                      { id: 'shadow', label: 'Shadow' },
                      { id: 'cyan', label: 'Neon Cyan' },
                      { id: 'pink', label: 'Pink Glow' },
                      { id: 'gold', label: 'Gold Glow' },
                    ].map((g) => (
                      <button
                        key={g.id}
                        onClick={() => { playPop(); setBorderGlow(g.id); }}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${borderGlow === g.id ? 'bg-red-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Text Caption / Anime Ribbon */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Type size={14} className="text-yellow-400" /> Anime Text Ribbon
                </label>
                <button
                  onClick={() => { playPop(); setTextEnabled(!textEnabled); }}
                  className={`text-xs font-bold px-2.5 py-1 rounded-md transition-colors ${textEnabled ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-slate-400'}`}
                >
                  {textEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {textEnabled && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <input
                    type="text"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Enter sticker caption..."
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white font-black tracking-wide outline-none focus:border-yellow-500/50"
                  />

                  {/* Preset chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {textPresets.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => { playPop(); setTextContent(preset); }}
                        className="text-[10px] font-black px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-300"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <select
                      value={textPosition}
                      onChange={(e) => setTextPosition(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                    >
                      <option value="bottom">Bottom Ribbon</option>
                      <option value="top">Top Banner</option>
                      <option value="badge">Corner Badge</option>
                    </select>

                    <select
                      value={textStyle}
                      onChange={(e) => setTextStyle(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
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
                <Sparkles size={14} className="text-purple-400" /> Expression Decals
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'none', label: 'None' },
                  { id: 'sparkles', label: '✨ Sparkles' },
                  { id: 'anger', label: '💢 Anger Mark' },
                  { id: 'sweat', label: '💧 Sweatdrop' },
                  { id: 'hearts', label: '💖 Doki Doki' },
                  { id: 'menacing', label: 'ゴ Menacing' },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => { playPop(); setDecal(d.id); }}
                    className={`py-2 px-2 text-xs font-bold rounded-xl transition-all ${decal === d.id ? 'bg-purple-600/30 border border-purple-500 text-purple-200' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'}`}
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
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
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
