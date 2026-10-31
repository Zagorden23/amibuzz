import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Trash2,
  RotateCw,
  Maximize2,
  FlipHorizontal,
  Download,
  Copy,
  Layers,
  Sparkles,
  Type,
  Check,
  Move,
  Palette,
} from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { MANGA_SFX_STAMPS } from '../../lib/animeStyles.js';
import { playPop, playSuccess } from '../../lib/audio.js';
import { fireConfetti } from '../../lib/confetti.js';

export const StickerPlaygroundModal = ({ open, onClose, initialSticker, libraryStickers = [] }) => {
  const canvasRef = useRef(null);

  // Playground items on board: { id, img, text, isText, x, y, size, rotation, flipX, zIndex }
  const [boardItems, setBoardItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [backdrop, setBackdrop] = useState('checker'); // 'checker' | 'dark' | 'neon' | 'pink' | 'paper'
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [customText, setCustomText] = useState('SUGOI!');

  // Initialize with initialSticker
  useEffect(() => {
    if (!open) return;
    if (initialSticker) {
      setBoardItems([
        {
          id: `item-${Date.now()}-0`,
          img: initialSticker.img,
          name: initialSticker.name,
          isText: false,
          x: 250,
          y: 250,
          size: 260,
          rotation: 0,
          flipX: false,
        },
      ]);
      setSelectedItemId(`item-${Date.now()}-0`);
    } else if (libraryStickers.length > 0) {
      setBoardItems([
        {
          id: `item-${Date.now()}-0`,
          img: libraryStickers[0].img,
          name: libraryStickers[0].name,
          isText: false,
          x: 250,
          y: 250,
          size: 260,
          rotation: 0,
          flipX: false,
        },
      ]);
      setSelectedItemId(`item-${Date.now()}-0`);
    }
  }, [open, initialSticker]);

  // Redraw canvas
  useEffect(() => {
    if (!open) return;
    drawBoard();
  }, [boardItems, backdrop, open]);

  const drawBoard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = 800;
    const height = 800;
    canvas.width = width;
    canvas.height = height;

    // Draw background
    ctx.clearRect(0, 0, width, height);

    if (backdrop === 'dark') {
      ctx.fillStyle = '#0f0913';
      ctx.fillRect(0, 0, width, height);
    } else if (backdrop === 'pink') {
      ctx.fillStyle = '#fce7f3';
      ctx.fillRect(0, 0, width, height);
      // subtle dots
      ctx.fillStyle = 'rgba(244, 114, 182, 0.2)';
      for (let x = 20; x < width; x += 40) {
        for (let y = 20; y < height; y += 40) {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (backdrop === 'neon') {
      ctx.fillStyle = '#05030a';
      ctx.fillRect(0, 0, width, height);
      // cyber grid
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (backdrop === 'paper') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);
    }

    // Load and render all board items in order
    for (const item of boardItems) {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate((item.rotation * Math.PI) / 180);
      if (item.flipX) ctx.scale(-1, 1);

      if (item.isText) {
        // Draw Manga SFX Callout
        const text = item.text;
        ctx.font = `900 ${Math.round(item.size * 0.24)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Outer white die-cut stroke
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#ffffff';
        ctx.lineJoin = 'round';
        ctx.strokeText(text, 0, 0);

        // Vibrant Red/Magenta fill
        ctx.fillStyle = item.color || '#ef4444';
        ctx.fillText(text, 0, 0);
      } else {
        // Draw Image Sticker with die-cut shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 8;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          img.src = item.img;
        });

        const half = item.size / 2;
        ctx.drawImage(img, -half, -half, item.size, item.size);
      }

      ctx.restore();
    }
  };

  const handleAddStickerToBoard = (sticker) => {
    playPop();
    const newItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      img: sticker.img,
      name: sticker.name,
      isText: false,
      x: 350 + (Math.random() - 0.5) * 80,
      y: 350 + (Math.random() - 0.5) * 80,
      size: 220,
      rotation: Math.round((Math.random() - 0.5) * 20),
      flipX: false,
    };
    setBoardItems((prev) => [...prev, newItem]);
    setSelectedItemId(newItem.id);
  };

  const handleAddSfxStamp = (stamp) => {
    playPop();
    const newItem = {
      id: `sfx-${Date.now()}-${Math.random()}`,
      text: stamp.text,
      isText: true,
      color: stamp.category === 'badge' ? '#ef4444' : '#ec4899',
      x: 350 + (Math.random() - 0.5) * 80,
      y: 350 + (Math.random() - 0.5) * 80,
      size: 200,
      rotation: Math.round((Math.random() - 0.5) * 30),
      flipX: false,
    };
    setBoardItems((prev) => [...prev, newItem]);
    setSelectedItemId(newItem.id);
  };

  const handleAddCustomText = () => {
    if (!customText.trim()) return;
    playPop();
    const newItem = {
      id: `txt-${Date.now()}`,
      text: customText.trim(),
      isText: true,
      color: '#ef4444',
      x: 400,
      y: 400,
      size: 190,
      rotation: 0,
      flipX: false,
    };
    setBoardItems((prev) => [...prev, newItem]);
    setSelectedItemId(newItem.id);
  };

  const handleUpdateSelectedItem = (updates) => {
    setBoardItems((prev) =>
      prev.map((item) => (item.id === selectedItemId ? { ...item, ...updates } : item))
    );
  };

  const handleDeleteSelectedItem = () => {
    playPop();
    setBoardItems((prev) => prev.filter((item) => item.id !== selectedItemId));
    setSelectedItemId(null);
  };

  const handleSendBackward = () => {
    playPop();
    const index = boardItems.findIndex((it) => it.id === selectedItemId);
    if (index > 0) {
      const copy = [...boardItems];
      const item = copy.splice(index, 1)[0];
      copy.splice(index - 1, 0, item);
      setBoardItems(copy);
    }
  };

  const handleBringForward = () => {
    playPop();
    const index = boardItems.findIndex((it) => it.id === selectedItemId);
    if (index < boardItems.length - 1) {
      const copy = [...boardItems];
      const item = copy.splice(index, 1)[0];
      copy.splice(index + 1, 0, item);
      setBoardItems(copy);
    }
  };

  const handleExportCollage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsExporting(true);
    playPop();

    try {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `amibuzz-sticker-collage-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      playSuccess();
      fireConfetti();
    } catch (err) {
      console.error('Collage export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyCollage = async () => {
    const canvas = canvasRef.current;
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

  const selectedItem = boardItems.find((it) => it.id === selectedItemId);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-6xl h-[92vh] max-h-[920px] bg-[#140e1b] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                <Palette size={20} />
              </div>
              <div>
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  Sticker Board & Collage Playground
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30 uppercase">
                    Interactive
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Compose, resize, rotate & stamp manga SFX onto a custom sticker board
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs font-bold"
                onClick={handleCopyCollage}
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                {copied ? 'Copied Collage!' : 'Copy PNG'}
              </Button>

              <Button
                size="sm"
                className="gap-2 text-xs font-bold"
                onClick={handleExportCollage}
                disabled={isExporting}
              >
                <Download size={16} /> Export Collage (PNG)
              </Button>

              <button
                onClick={onClose}
                className="size-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Main Studio Area */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Tools & Library Deck */}
            <aside className="w-full lg:w-80 border-r border-white/10 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-5 bg-black/20">
              {/* Backdrops */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Board Canvas Backdrop
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'checker', label: 'Transparent' },
                    { id: 'dark', label: 'Dark Carbon' },
                    { id: 'neon', label: 'Cyber Grid' },
                    { id: 'pink', label: 'Kawaii Pink' },
                    { id: 'paper', label: 'Clean Paper' },
                  ].map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        playPop();
                        setBackdrop(b.id);
                      }}
                      className={`text-[11px] font-bold py-1.5 px-2 rounded-lg border transition-all ${
                        backdrop === b.id
                          ? 'bg-red-500/20 border-red-500 text-white'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Japanese SFX Stamps */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} className="text-yellow-400" /> Manga SFX Stamps
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {MANGA_SFX_STAMPS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleAddSfxStamp(s)}
                      className="text-left p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 transition-all group"
                    >
                      <p className="font-black text-sm text-white group-hover:text-red-400">{s.text}</p>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{s.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Speech Bubble */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Type size={13} className="text-red-400" /> Anime Speech Callout
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="e.g. SUGOI!"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-red-500"
                  />
                  <Button size="sm" onClick={handleAddCustomText} className="px-3 text-xs font-bold">
                    <Plus size={14} /> Add
                  </Button>
                </div>
              </div>

              {/* Add from Sticker Library */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Add From Library
                  </label>
                  <span className="text-[10px] text-slate-500">{libraryStickers.length} Available</span>
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                  {libraryStickers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleAddStickerToBoard(s)}
                      className="aspect-square rounded-xl bg-black/40 border border-white/10 hover:border-red-500/50 p-1.5 overflow-hidden transition-transform hover:scale-105"
                      title={s.name}
                    >
                      <img src={s.img} alt={s.name} className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* Central Board Stage */}
            <main className="flex-1 flex flex-col items-center justify-center p-4 lg:p-6 bg-[#0a060d] relative overflow-hidden">
              <div
                className={`relative w-full max-w-[560px] aspect-square rounded-3xl border border-white/15 overflow-hidden shadow-2xl flex items-center justify-center ${
                  backdrop === 'checker'
                    ? "bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgfQEhD/o+OQZIMxG4c1EAaGEY1gDAg0xQ+OqMawDAg0xQ+OqMaQBgA+zQ+O2/1h6gAAAAASUVORK5CYII=')]"
                    : ''
                }`}
              >
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={800}
                  className="w-full h-full object-contain pointer-events-none"
                />

                {/* Interactive Drag Handles / Selection layer */}
                <div className="absolute inset-0">
                  {boardItems.map((item) => {
                    const isSelected = item.id === selectedItemId;
                    return (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          playPop();
                          setSelectedItemId(item.id);
                        }}
                        style={{
                          left: `${(item.x / 800) * 100}%`,
                          top: `${(item.y / 800) * 100}%`,
                          transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scaleX(${
                            item.flipX ? -1 : 1
                          })`,
                          width: `${(item.size / 800) * 100}%`,
                          height: `${(item.size / 800) * 100}%`,
                        }}
                        className={`absolute cursor-move select-none flex items-center justify-center transition-all ${
                          isSelected ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-transparent' : 'hover:ring-1 hover:ring-white/40'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute -top-3 -right-3 size-6 bg-red-500 rounded-full text-white flex items-center justify-center shadow-lg">
                            <Move size={12} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Floating Bottom Toolbar for Selected Item */}
              {selectedItem && (
                <div className="mt-4 flex items-center gap-3 bg-black/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/15 shadow-2xl">
                  {/* Position D-Pad */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleUpdateSelectedItem({ x: Math.max(50, selectedItem.x - 20) })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs font-bold"
                      title="Nudge Left"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => handleUpdateSelectedItem({ x: Math.min(750, selectedItem.x + 20) })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs font-bold"
                      title="Nudge Right"
                    >
                      →
                    </button>
                    <button
                      onClick={() => handleUpdateSelectedItem({ y: Math.max(50, selectedItem.y - 20) })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs font-bold"
                      title="Nudge Up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleUpdateSelectedItem({ y: Math.min(750, selectedItem.y + 20) })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs font-bold"
                      title="Nudge Down"
                    >
                      ↓
                    </button>
                  </div>

                  <div className="h-4 w-px bg-white/20" />

                  {/* Size slider */}
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Maximize2 size={14} />
                    <input
                      type="range"
                      min="80"
                      max="480"
                      value={selectedItem.size}
                      onChange={(e) => handleUpdateSelectedItem({ size: Number(e.target.value) })}
                      className="w-20 accent-red-500 cursor-pointer"
                    />
                  </div>

                  {/* Rotate */}
                  <button
                    onClick={() => handleUpdateSelectedItem({ rotation: (selectedItem.rotation + 15) % 360 })}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                    title="Rotate 15°"
                  >
                    <RotateCw size={15} />
                  </button>

                  {/* Flip Horizontal */}
                  <button
                    onClick={() => handleUpdateSelectedItem({ flipX: !selectedItem.flipX })}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                    title="Flip Horizontal"
                  >
                    <FlipHorizontal size={15} />
                  </button>

                  <div className="h-4 w-px bg-white/20" />

                  {/* Layer reorder */}
                  <button
                    onClick={handleBringForward}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                    title="Bring Forward"
                  >
                    <Layers size={15} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={handleDeleteSelectedItem}
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/20"
                    title="Delete Item"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </main>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
