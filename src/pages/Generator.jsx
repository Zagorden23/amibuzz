// Canva-Inspired Animeify Studio for AmiBuzz
// Full-Featured Graphic Design Canvas + AI Anime Transformation Engine

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  Wand2,
  Image as ImageIcon,
  Sparkles,
  Download,
  Copy,
  Trash2,
  X,
  Upload,
  Palette,
  Layers,
  RotateCw,
  Maximize2,
  Minimize2,
  Eye,
  Sliders,
  Type,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  Lock,
  Unlock,
  FlipHorizontal,
  FlipVertical,
  Scissors,
  Share2,
  ArrowLeft,
  ChevronDown,
  Plus,
  Play,
  Pause,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  FolderOpen,
  Settings as SettingsIcon,
  HelpCircle,
  FileCode2,
  Package,
} from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { planFor } from '../lib/plans.js';
import {
  ANIME_STYLES,
  MANGA_SFX_STAMPS,
  CANVA_BACKGROUNDS,
  ANIME_GLASSES_PRESETS,
  ANIME_HAIR_COLORS,
  ANIME_AURAS,
  SAMPLE_PORTRAITS,
  EMOTION_MATRIX_PRESETS,
} from '../lib/animeStyles.js';
import {
  generateStickerBatch,
  finishSticker,
} from '../services/geminiService.js';
import {
  getAiSettings,
  saveAiSettings,
  AI_ENGINES,
} from '../lib/animeAiEngine.js';
import { saveStickerToStorage, getStoredStickers } from '../services/stickerStorage.js';
import { downloadWhatsAppStickerPackZip } from '../lib/zipExporter.js';
import { downloadStickerSvg } from '../lib/vectorSvgExporter.js';
import { playPop, playSparkle, playSuccess } from '../lib/audio.js';
import { fireConfetti } from '../lib/confetti.js';
import { AiSettingsModal } from '../components/ui/AiSettingsModal.jsx';
import { removeBackground, renderDieCut, toPngBlob } from '../lib/stickerFx.js';

export const Generator = ({ onNavigate, pageState }) => {
  const { user, profile } = useAuth();
  const plan = planFor(profile);

  // Active Canva Rail Tab: 'animeify' | 'elements' | 'backgrounds' | 'uploads' | 'layers'
  const [activeRailTab, setActiveRailTab] = useState('animeify');

  // AI & Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [error, setError] = useState('');
  const [feedbackGiven, setFeedbackGiven] = useState(null); // 'like' | 'dislike' | null

  // Animeify Input / Source Image
  const [inputPhoto, setInputPhoto] = useState(
    pageState?.referenceImage || SAMPLE_PORTRAITS[0].avatar
  );
  const [generatedAnimeImage, setGeneratedAnimeImage] = useState(null);
  const [generatedStickerRecord, setGeneratedStickerRecord] = useState(null);

  // Animeify Customization Parameters
  const [selectedStyleId, setSelectedStyleId] = useState('modern-shonen');
  const [selectedEmotion, setSelectedEmotion] = useState('happy');
  const [selectedHairColor, setSelectedHairColor] = useState('natural');
  const [selectedGlasses, setSelectedGlasses] = useState('glasses');
  const [selectedAura, setSelectedAura] = useState('none');
  const [dieCutBorder, setDieCutBorder] = useState(true);
  const [borderWidth, setBorderWidth] = useState(14);
  const [borderColor, setBorderColor] = useState('#ffffff');
  const [customPromptNote, setCustomPromptNote] = useState('');

  // Canvas Workspace States
  const [canvasTitle, setCanvasTitle] = useState('Untitled Animeify Design - 1080px');
  const [zoomLevel, setZoomLevel] = useState(74); // Percent zoom (matching Canva 74%)
  const [aspectRatio, setAspectRatio] = useState('1:1'); // '1:1' | '9:16' | '16:9' | '4:5'
  const [activeBackdrop, setActiveBackdrop] = useState(CANVA_BACKGROUNDS[0]);

  // Canvas Elements: { id, type: 'image'|'text'|'sfx', src, text, x, y, width, height, rotation, flipX, flipY, zIndex, locked, filter: { brightness, contrast, saturation, blur, opacity } }
  const [elements, setElements] = useState([
    {
      id: 'el-initial-photo',
      type: 'image',
      name: 'Original Photo',
      src: SAMPLE_PORTRAITS[0].avatar,
      x: 270,
      y: 120,
      width: 460,
      height: 480,
      rotation: 0,
      flipX: false,
      flipY: false,
      locked: false,
      filter: { brightness: 100, contrast: 100, saturation: 100, blur: 0, opacity: 100 },
      animation: 'none', // 'none' | 'pulse' | 'float' | 'pop' | 'glitch' | 'shake'
    },
  ]);
  const [selectedElementId, setSelectedElementId] = useState('el-initial-photo');

  // History for Undo / Redo
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // Modals & Panels
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState(getAiSettings());
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [filterBarOpen, setFilterBarOpen] = useState(false);

  const fileInputRef = useRef(null);
  const canvasStageRef = useRef(null);

  // Sync AI settings changes
  useEffect(() => {
    const handleSettingsChange = (e) => setAiSettings(e.detail);
    window.addEventListener('amibuzz_ai_settings_change', handleSettingsChange);
    return () => window.removeEventListener('amibuzz_ai_settings_change', handleSettingsChange);
  }, []);

  // Save state to history for undo
  const pushHistory = (newElements) => {
    const updated = history.slice(0, historyStep + 1);
    updated.push(JSON.parse(JSON.stringify(newElements)));
    if (updated.length > 25) updated.shift();
    setHistory(updated);
    setHistoryStep(updated.length - 1);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      playPop();
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      setElements(JSON.parse(JSON.stringify(history[prevStep])));
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      playPop();
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      setElements(JSON.parse(JSON.stringify(history[nextStep])));
    }
  };

  // Selected element helper
  const selectedElement = elements.find((el) => el.id === selectedElementId) || null;

  const updateSelectedElement = (updates) => {
    if (!selectedElementId) return;
    setElements((prev) => {
      const next = prev.map((el) => (el.id === selectedElementId ? { ...el, ...updates } : el));
      pushHistory(next);
      return next;
    });
  };

  // Handle Photo Upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError('Please upload an image under 20 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInputPhoto(reader.result);
      // Also update canvas if an image element is selected
      if (selectedElement && selectedElement.type === 'image') {
        updateSelectedElement({ src: reader.result });
      }
      playPop();
    };
    reader.readAsDataURL(file);
  };

  // Run Animeify AI Generation
  const handleRunAnimeify = async () => {
    if (!inputPhoto) {
      setError('Please select or upload a photo first.');
      return;
    }
    setError('');
    setIsGenerating(true);
    setGenerationProgress('Analyzing character features...');
    playPop();

    try {
      const selectedStyle = ANIME_STYLES.find((s) => s.id === selectedStyleId) || ANIME_STYLES[0];
      setGenerationProgress(`Rendering in ${selectedStyle.name} style...`);

      const result = await generateStickerBatch({
        prompt: customPromptNote,
        stylePreset: selectedStyle.id,
        referenceImage: inputPhoto,
        variantCount: 1,
        colorHarmony: 'vibrant',
        extraOptions: {
          emotion: selectedEmotion,
          hairColor: selectedHairColor,
          glasses: selectedGlasses,
          aura: selectedAura,
          dieCutBorder,
        },
      });

      if (result.stickers && result.stickers.length > 0) {
        const generated = result.stickers[0];
        setGeneratedAnimeImage(generated.rawArt || generated.img);
        setGeneratedStickerRecord(generated);
        saveStickerToStorage(generated, user);
        playSuccess();
        fireConfetti();
      }
    } catch (err) {
      setError(err?.message || 'Animeify failed. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  // CANVA ACTIONS:
  // 1. "Replace image" -> Replaces the selected canvas image with the generated anime art
  const handleReplaceImage = () => {
    if (!generatedAnimeImage) return;
    playPop();
    if (selectedElement && selectedElement.type === 'image') {
      updateSelectedElement({
        src: generatedAnimeImage,
        name: 'Animeified Portrait',
      });
    } else {
      // If no image selected, replace the first image element or add it
      const firstImage = elements.find((el) => el.type === 'image');
      if (firstImage) {
        setElements((prev) =>
          prev.map((el) =>
            el.id === firstImage.id ? { ...el, src: generatedAnimeImage, name: 'Animeified Portrait' } : el
          )
        );
      } else {
        handleAddAnimeToCanvas();
      }
    }
  };

  // 2. "Add to design" -> Adds the anime image as a new element on canvas
  const handleAddAnimeToCanvas = () => {
    if (!generatedAnimeImage) return;
    playPop();
    const newId = `el-anime-${Date.now()}`;
    const newElement = {
      id: newId,
      type: 'image',
      name: 'Anime Character',
      src: generatedAnimeImage,
      x: 320,
      y: 180,
      width: 440,
      height: 440,
      rotation: 0,
      flipX: false,
      flipY: false,
      locked: false,
      filter: { brightness: 100, contrast: 100, saturation: 100, blur: 0, opacity: 100 },
      animation: 'none',
    };
    setElements((prev) => {
      const next = [...prev, newElement];
      pushHistory(next);
      return next;
    });
    setSelectedElementId(newId);
  };

  // 3. "Generate again" -> Re-rolls generation
  const handleGenerateAgain = () => {
    playSparkle();
    handleRunAnimeify();
  };

  // 4. "Start over" -> Clears generation
  const handleStartOver = () => {
    playPop();
    setGeneratedAnimeImage(null);
    setGeneratedStickerRecord(null);
    setFeedbackGiven(null);
  };

  // Background Remover action (Canva BG Remover 👑)
  const handleRemoveBackground = async () => {
    if (!selectedElement || selectedElement.type !== 'image') return;
    playPop();
    try {
      const cutResult = await removeBackground(selectedElement.src, { tolerance: 36 });
      updateSelectedElement({
        src: cutResult.dataUrl,
        name: `${selectedElement.name || 'Image'} (Cutout)`,
      });
      playSuccess();
    } catch (e) {
      setError('Could not remove background from this element.');
    }
  };

  // Die-Cut Sticker Rim on Canvas Element
  const handleToggleStickerBorder = async () => {
    if (!selectedElement || selectedElement.type !== 'image') return;
    playPop();
    try {
      const stickered = await renderDieCut(selectedElement.src, {
        width: borderWidth,
        style: borderColor,
        shadow: true,
      });
      updateSelectedElement({
        src: stickered.dataUrl,
      });
      playSuccess();
    } catch (e) {
      setError('Could not add sticker border.');
    }
  };

  // Duplicate Element
  const handleDuplicateElement = () => {
    if (!selectedElement) return;
    playPop();
    const newId = `el-dup-${Date.now()}`;
    const cloned = {
      ...JSON.parse(JSON.stringify(selectedElement)),
      id: newId,
      x: selectedElement.x + 30,
      y: selectedElement.y + 30,
    };
    setElements((prev) => {
      const next = [...prev, cloned];
      pushHistory(next);
      return next;
    });
    setSelectedElementId(newId);
  };

  // Delete Element
  const handleDeleteElement = () => {
    if (!selectedElement) return;
    playPop();
    setElements((prev) => {
      const next = prev.filter((el) => el.id !== selectedElementId);
      pushHistory(next);
      return next;
    });
    setSelectedElementId(null);
  };

  // Add Speech Bubble / Text
  const handleAddSpeechBubble = (presetText = 'SUGOI!') => {
    playPop();
    const newId = `el-text-${Date.now()}`;
    const newBubble = {
      id: newId,
      type: 'text',
      name: 'Manga Bubble',
      text: presetText,
      font: 'font-black',
      textColor: '#000000',
      bubbleColor: '#ffffff',
      tail: 'bottom-left',
      x: 350,
      y: 120,
      width: 220,
      height: 100,
      rotation: 0,
      flipX: false,
      flipY: false,
      locked: false,
      filter: { brightness: 100, contrast: 100, saturation: 100, blur: 0, opacity: 100 },
      animation: 'pop',
    };
    setElements((prev) => {
      const next = [...prev, newBubble];
      pushHistory(next);
      return next;
    });
    setSelectedElementId(newId);
  };

  // Add Manga SFX Stamp
  const handleAddSfxStamp = (stamp) => {
    playSparkle();
    const newId = `el-sfx-${Date.now()}`;
    const newStamp = {
      id: newId,
      type: 'sfx',
      name: stamp.label,
      text: stamp.text,
      badge: stamp.category === 'badge',
      x: 400,
      y: 200,
      width: 180,
      height: 90,
      rotation: Math.floor(Math.random() * 20) - 10,
      flipX: false,
      flipY: false,
      locked: false,
      filter: { brightness: 100, contrast: 100, saturation: 100, blur: 0, opacity: 100 },
      animation: 'pulse',
    };
    setElements((prev) => {
      const next = [...prev, newStamp];
      pushHistory(next);
      return next;
    });
    setSelectedElementId(newId);
  };

  // Export Combined Canvas to High-Res Image
  const renderCompositeCanvas = async () => {
    const canvas = document.createElement('canvas');
    const width = 1080;
    const height = aspectRatio === '9:16' ? 1920 : aspectRatio === '16:9' ? 608 : aspectRatio === '4:5' ? 1350 : 1080;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Draw Background
    if (activeBackdrop.type === 'solid') {
      ctx.fillStyle = activeBackdrop.color;
      ctx.fillRect(0, 0, width, height);
    } else if (activeBackdrop.type === 'image' && activeBackdrop.url) {
      try {
        const bgImg = await loadImg(activeBackdrop.url);
        ctx.drawImage(bgImg, 0, 0, width, height);
      } catch {
        ctx.fillStyle = '#0f0913';
        ctx.fillRect(0, 0, width, height);
      }
    } else if (activeBackdrop.type === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#180929');
      grad.addColorStop(0.5, '#3b0764');
      grad.addColorStop(1, '#0369a1');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Draw Elements in order of z-index
    for (const el of elements) {
      ctx.save();
      ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
      ctx.rotate((el.rotation * Math.PI) / 180);
      if (el.flipX || el.flipY) {
        ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
      }

      if (el.type === 'image' && el.src) {
        try {
          const img = await loadImg(el.src);
          ctx.drawImage(img, -el.width / 2, -el.height / 2, el.width, el.height);
        } catch {}
      } else if (el.type === 'text') {
        // Draw speech bubble
        ctx.fillStyle = el.bubbleColor || '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        roundRect(ctx, -el.width / 2, -el.height / 2, el.width, el.height, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = el.textColor || '#000000';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.text, 0, 0);
      } else if (el.type === 'sfx') {
        // Draw Manga SFX
        ctx.fillStyle = el.badge ? '#ef4444' : '#fbbf24';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.font = '900 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(el.text, 0, 0);
        ctx.fillText(el.text, 0, 0);
      }

      ctx.restore();
    }

    return canvas;
  };

  const handleExportPng = async () => {
    setIsExporting(true);
    playPop();
    try {
      const canvas = await renderCompositeCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `amibuzz-animeify-${Date.now()}.png`;
      a.click();
      playSuccess();
      fireConfetti();
    } finally {
      setIsExporting(false);
      setExportDropdownOpen(false);
    }
  };

  const handleExportWhatsAppZip = async () => {
    setIsExporting(true);
    playPop();
    try {
      const currentStickers = getStoredStickers();
      const toPack = generatedStickerRecord ? [generatedStickerRecord, ...currentStickers.slice(0, 5)] : currentStickers.slice(0, 6);
      await downloadWhatsAppStickerPackZip(toPack, 'Animeify Pack', 'AmiBuzz');
      playSuccess();
      fireConfetti();
    } catch (e) {
      setError('Could not export WhatsApp sticker pack.');
    } finally {
      setIsExporting(false);
      setExportDropdownOpen(false);
    }
  };

  const handleExportSvg = () => {
    playPop();
    if (selectedElement && selectedElement.type === 'image') {
      downloadStickerSvg(selectedElement.src, `${canvasTitle}.svg`);
      playSuccess();
    } else {
      setError('Select an image element on canvas to export as Vector SVG.');
    }
    setExportDropdownOpen(false);
  };

  const handleCopyToClipboard = async () => {
    playPop();
    try {
      const canvas = await renderCompositeCanvas();
      canvas.toBlob(async (blob) => {
        if (blob && navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopiedNotice(true);
          playSuccess();
          setTimeout(() => setCopiedNotice(false), 2500);
        }
      });
    } catch {
      setError('Clipboard copying requires permission in your browser.');
    }
    setExportDropdownOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0c0714] text-white select-none">
      {/* 1. TOP CANVA BAR */}
      <header className="h-14 border-b border-white/10 bg-[#120a1f] px-4 flex items-center justify-between shrink-0 z-30">
        {/* Left: Brand & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition text-xs font-semibold"
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </button>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg rgb-gradient flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Zap size={16} fill="currentColor" />
            </div>
            <input
              type="text"
              value={canvasTitle}
              onChange={(e) => setCanvasTitle(e.target.value)}
              className="bg-transparent hover:bg-white/5 focus:bg-white/10 text-white font-bold text-sm px-2 py-1 rounded transition focus:outline-none max-w-[280px]"
            />
          </div>
        </div>

        {/* Center: AI Engine Badge & Canvas Dimensions */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => setAiSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 text-xs font-bold transition shadow-sm"
          >
            <Sparkles size={13} className="text-purple-400" />
            <span>AI: {aiSettings.engine === 'gemini' ? 'Gemini 2.0 / Imagen' : aiSettings.engine === 'shader' ? 'Neural Shader' : 'Turbo Anime AI'}</span>
            <ChevronDown size={12} />
          </button>

          {/* Aspect Ratio Picker */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5 text-xs font-semibold">
            {['1:1', '9:16', '16:9', '4:5'].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-2.5 py-1 rounded transition ${
                  aspectRatio === ratio ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Undo/Redo & Export */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1">
            <button
              onClick={handleUndo}
              disabled={historyStep <= 0}
              title="Undo (Ctrl+Z)"
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
            >
              <RotateCw size={14} className="-scale-x-100" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyStep >= history.length - 1}
              title="Redo (Ctrl+Y)"
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
            >
              <RotateCw size={14} />
            </button>
          </div>

          {/* Export Menu Dropdown */}
          <div className="relative">
            <Button
              size="sm"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="shadow-lg shadow-purple-600/30 flex items-center gap-1.5"
            >
              <Download size={14} />
              <span>Export</span>
              <ChevronDown size={12} />
            </Button>

            {exportDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#180e29] border border-white/15 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1">
                <button
                  onClick={handleExportPng}
                  disabled={isExporting}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-left hover:bg-white/10 text-white transition"
                >
                  <Download size={15} className="text-purple-400" />
                  <span>Download Full PNG (1080p)</span>
                </button>
                <button
                  onClick={handleExportWhatsAppZip}
                  disabled={isExporting}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-left hover:bg-white/10 text-white transition"
                >
                  <Package size={15} className="text-emerald-400" />
                  <span>WhatsApp Pack (.ZIP)</span>
                </button>
                <button
                  onClick={handleExportSvg}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-left hover:bg-white/10 text-white transition"
                >
                  <FileCode2 size={15} className="text-cyan-400" />
                  <span>Vector SVG Die-Cut</span>
                </button>
                <div className="h-px bg-white/10 my-1" />
                <button
                  onClick={handleCopyToClipboard}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-left hover:bg-white/10 text-white transition"
                >
                  <Copy size={15} className="text-amber-400" />
                  <span>Copy to Clipboard</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE: CANVA RAIL + DOCKED APP PANEL + CENTRAL CANVAS */}
      <div className="flex flex-1 h-[calc(100vh-56px)] overflow-hidden">
        {/* CANVA LEFT RAIL (Navigation Tabs) */}
        <nav className="w-18 bg-[#0e0719] border-r border-white/10 flex flex-col items-center py-4 gap-4 shrink-0 z-20">
          <button
            onClick={() => {
              setActiveRailTab('animeify');
              playPop();
            }}
            className={`flex flex-col items-center justify-center size-14 rounded-xl transition ${
              activeRailTab === 'animeify'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Wand2 size={22} />
            <span className="text-[10px] font-bold mt-1">Animeify</span>
          </button>

          <button
            onClick={() => {
              setActiveRailTab('elements');
              playPop();
            }}
            className={`flex flex-col items-center justify-center size-14 rounded-xl transition ${
              activeRailTab === 'elements'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers size={22} />
            <span className="text-[10px] font-bold mt-1">Elements</span>
          </button>

          <button
            onClick={() => {
              setActiveRailTab('backgrounds');
              playPop();
            }}
            className={`flex flex-col items-center justify-center size-14 rounded-xl transition ${
              activeRailTab === 'backgrounds'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Palette size={22} />
            <span className="text-[10px] font-bold mt-1">Backdrop</span>
          </button>

          <button
            onClick={() => {
              setActiveRailTab('uploads');
              playPop();
            }}
            className={`flex flex-col items-center justify-center size-14 rounded-xl transition ${
              activeRailTab === 'uploads'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Upload size={22} />
            <span className="text-[10px] font-bold mt-1">Uploads</span>
          </button>

          <div className="mt-auto">
            <button
              onClick={() => setAiSettingsOpen(true)}
              className="flex flex-col items-center justify-center size-14 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
              title="AI & API Settings"
            >
              <SettingsIcon size={20} />
              <span className="text-[10px] font-bold mt-1">Settings</span>
            </button>
          </div>
        </nav>

        {/* DOCKED SIDEBAR PANEL (Width ~360px) */}
        <aside className="w-[360px] bg-[#140b22] border-r border-white/10 flex flex-col h-full overflow-hidden shrink-0 z-10">
          {/* TAB 1: ANIMEIFY APP (EXACTLY MATCHING THE USER'S CANVA SCREENSHOT!) */}
          {activeRailTab === 'animeify' && (
            <div className="flex flex-col h-full overflow-y-auto">
              {/* App Header (matching screenshot) */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#170d27] shrink-0">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => onNavigate('dashboard')}
                    className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                    <span className="text-purple-400">✨</span> Animeify
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    onClick={() => {
                      setFeedbackGiven('like');
                      playSuccess();
                    }}
                    className={`p-1.5 rounded-lg hover:bg-white/10 transition ${
                      feedbackGiven === 'like' ? 'text-purple-400 bg-purple-500/20' : ''
                    }`}
                  >
                    <ThumbsUp size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setFeedbackGiven('dislike');
                      playPop();
                    }}
                    className={`p-1.5 rounded-lg hover:bg-white/10 transition ${
                      feedbackGiven === 'dislike' ? 'text-red-400 bg-red-500/20' : ''
                    }`}
                  >
                    <ThumbsDown size={16} />
                  </button>
                  <button
                    onClick={() => setAiSettingsOpen(true)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>

              {/* Panel Body */}
              <div className="p-4 space-y-5 flex-1">
                {/* 1. If Generated Image Exists -> Render "Generated image" Section (As seen in the Canva Screenshot!) */}
                {generatedAnimeImage ? (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Generated image
                    </h4>

                    {/* Preview Image Card with die-cut / styling */}
                    <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-black/40 shadow-2xl group flex items-center justify-center p-3">
                      <img
                        src={generatedAnimeImage}
                        alt="Generated anime"
                        className="w-full h-auto max-h-[290px] object-contain rounded-xl shadow-lg transition duration-300 group-hover:scale-[1.02]"
                      />
                      <div className="absolute top-4 right-4 bg-purple-600/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow">
                        Anime AI
                      </div>
                    </div>

                    {/* Action Buttons Matching Canva Screenshot */}
                    <div className="space-y-2.5 pt-1">
                      {/* Purple Primary Button: "Replace image" */}
                      <button
                        onClick={handleReplaceImage}
                        className="w-full py-3 px-4 rounded-xl font-black text-sm bg-[#7c3aed] hover:bg-[#6d28d9] text-white shadow-xl shadow-purple-600/30 transition duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <RefreshCw size={16} />
                        <span>Replace image</span>
                      </button>

                      {/* White / Outline Secondary Button: "Add to design" */}
                      <button
                        onClick={handleAddAnimeToCanvas}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 border border-white/20 text-white transition duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        <span>Add to design</span>
                      </button>

                      {/* Tertiary: "Generate again" (with refresh icon) */}
                      <button
                        onClick={handleGenerateAgain}
                        disabled={isGenerating}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-slate-300 hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-2"
                      >
                        <RefreshCw size={15} className={isGenerating ? 'animate-spin' : ''} />
                        <span>Generate again</span>
                      </button>

                      {/* Bottom Text: "Start over" */}
                      <div className="text-center pt-1">
                        <button
                          onClick={handleStartOver}
                          className="text-xs text-slate-400 hover:text-slate-200 transition font-medium underline underline-offset-4"
                        >
                          Start over
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 2. Before Generation: Photo Selector & Anime Customization Matrix */
                  <div className="space-y-4">
                    {/* Source Photo Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Source Photo
                        </label>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-purple-400 hover:text-purple-300 font-bold"
                        >
                          Upload Custom
                        </button>
                      </div>

                      {/* Photo Thumbnail / Dropzone */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="relative h-40 rounded-xl border border-dashed border-white/20 hover:border-purple-500/60 bg-black/30 hover:bg-purple-950/20 cursor-pointer transition flex flex-col items-center justify-center overflow-hidden p-2 group"
                      >
                        {inputPhoto ? (
                          <>
                            <img
                              src={inputPhoto}
                              alt="Source avatar"
                              className="w-full h-full object-cover rounded-lg"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                              <Upload size={18} className="text-white" />
                              <span className="text-xs font-bold text-white">Change Photo</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center text-center p-4">
                            <Upload size={24} className="text-purple-400 mb-2" />
                            <p className="text-xs font-bold text-white">Drop photo here or browse</p>
                            <p className="text-[10px] text-slate-500 mt-1">Supports PNG, JPG, WebP</p>
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoUpload}
                        accept="image/*"
                        className="hidden"
                      />

                      {/* Sample Portraits (Including reference with glasses & tie!) */}
                      <div className="mt-2.5">
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1.5">
                          Or test with sample portraits:
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {SAMPLE_PORTRAITS.map((p) => {
                            const isSelected = inputPhoto === p.avatar;
                            return (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setInputPhoto(p.avatar);
                                  playPop();
                                }}
                                className={`p-1 rounded-lg border text-left transition relative overflow-hidden flex flex-col items-center ${
                                  isSelected
                                    ? 'border-purple-500 bg-purple-500/20 shadow-md shadow-purple-500/20'
                                    : 'border-white/10 bg-white/[0.02] hover:border-white/30'
                                }`}
                              >
                                <img
                                  src={p.avatar}
                                  alt={p.label}
                                  className="size-12 rounded object-cover mb-1"
                                />
                                <span className="text-[9px] font-bold text-slate-300 truncate w-full text-center">
                                  {p.label.split(' ')[0]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Anime Art Style Presets */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2">
                        Anime Art Style
                      </label>
                      <div className="grid grid-cols-2 gap-2 max-h-[170px] overflow-y-auto pr-1">
                        {ANIME_STYLES.slice(0, 8).map((style) => {
                          const isSelected = selectedStyleId === style.id;
                          return (
                            <button
                              key={style.id}
                              onClick={() => {
                                setSelectedStyleId(style.id);
                                playPop();
                              }}
                              className={`p-2 rounded-xl border text-left transition flex items-center gap-2.5 ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-500/20 shadow-md shadow-purple-500/10'
                                  : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                              }`}
                            >
                              <img
                                src={style.img}
                                alt={style.name}
                                className="size-10 rounded-lg object-cover shrink-0"
                              />
                              <div className="min-w-0">
                                <h5 className="text-xs font-bold text-white truncate">{style.name}</h5>
                                <span className="text-[9px] text-purple-400 font-bold block">
                                  {style.badge}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Emotion & Expression Matrix */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2">
                        Facial Expression
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'happy', label: 'Sugoi Happy', icon: '✨' },
                          { id: 'fierce', label: 'Battle Ready', icon: '⚔️' },
                          { id: 'smug', label: 'Smug Wink', icon: '😎' },
                          { id: 'tsundere', label: 'Tsundere Pout', icon: '💢' },
                          { id: 'shock', label: 'Comedic Shock', icon: '💧' },
                          { id: 'stoic', label: 'Stoic Cool', icon: '🕶️' },
                        ].map((em) => {
                          const isSelected = selectedEmotion === em.id;
                          return (
                            <button
                              key={em.id}
                              onClick={() => {
                                setSelectedEmotion(em.id);
                                playPop();
                              }}
                              className={`p-1.5 rounded-lg border text-center transition flex flex-col items-center ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-500/20 text-white'
                                  : 'border-white/10 bg-white/[0.02] text-slate-400 hover:text-white'
                              }`}
                            >
                              <span className="text-sm">{em.icon}</span>
                              <span className="text-[10px] font-bold mt-0.5 truncate w-full">{em.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Glasses & Accessories (Preserve reference glasses!) */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2">
                        Glasses & Eye Accents
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ANIME_GLASSES_PRESETS.map((gl) => {
                          const isSelected = selectedGlasses === gl.id;
                          return (
                            <button
                              key={gl.id}
                              onClick={() => {
                                setSelectedGlasses(gl.id);
                                playPop();
                              }}
                              className={`p-2 rounded-lg border text-left transition flex items-center gap-2 ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-500/20 text-white'
                                  : 'border-white/10 bg-white/[0.02] text-slate-400 hover:text-white'
                              }`}
                            >
                              <span className="text-base">{gl.icon}</span>
                              <span className="text-[11px] font-bold truncate">{gl.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Aura FX & Hair Color */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                          Anime Aura
                        </label>
                        <select
                          value={selectedAura}
                          onChange={(e) => setSelectedAura(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
                        >
                          {ANIME_AURAS.map((a) => (
                            <option key={a.id} value={a.id} className="bg-[#140b22]">
                              {a.icon} {a.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                          Hair Shade
                        </label>
                        <select
                          value={selectedHairColor}
                          onChange={(e) => setSelectedHairColor(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
                        >
                          {ANIME_HAIR_COLORS.map((h) => (
                            <option key={h.id} value={h.id} className="bg-[#140b22]">
                              {h.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Die-Cut Sticker Outline Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/10">
                      <div>
                        <span className="text-xs font-bold text-white block">White Die-Cut Sticker Border</span>
                        <span className="text-[10px] text-slate-400">Crisp outline contour for stickers</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={dieCutBorder}
                        onChange={(e) => setDieCutBorder(e.target.checked)}
                        className="size-4 accent-purple-600 rounded cursor-pointer"
                      />
                    </div>

                    {/* Big Vibrant Animeify Button */}
                    <button
                      onClick={handleRunAnimeify}
                      disabled={isGenerating}
                      className="w-full py-3.5 px-4 rounded-xl font-extrabold text-sm bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl shadow-purple-600/30 transition duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw size={18} className="animate-spin text-white" />
                          <span>{generationProgress || 'Generating Animeify...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          <span>Animeify Photo Now</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Error Banner */}
                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                    <span className="font-bold">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ELEMENTS & STAMPS (Speech Bubbles & Manga SFX) */}
          {activeRailTab === 'elements' && (
            <div className="p-4 space-y-6 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base text-white">Manga Elements</h3>
              </div>

              {/* Manga Speech Bubbles */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                  Anime Speech Balloons
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'SUGOI!', text: 'SUGOI!' },
                    { label: 'NANI?!', text: 'NANI?!' },
                    { label: 'BAKA!', text: 'BAKA!' },
                    { label: 'SENPAI!', text: 'SENPAI!' },
                    { label: 'GAMBARE!', text: 'GAMBARE!' },
                    { label: 'GG EZ', text: 'GG EZ' },
                  ].map((bubble) => (
                    <button
                      key={bubble.label}
                      onClick={() => handleAddSpeechBubble(bubble.text)}
                      className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 text-white font-black text-sm transition text-center shadow"
                    >
                      {bubble.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Japanese Manga Onomatopoeia SFX */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                  Japanese Manga SFX Stamps
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MANGA_SFX_STAMPS.map((sfx) => (
                    <button
                      key={sfx.id}
                      onClick={() => handleAddSfxStamp(sfx)}
                      className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 transition flex flex-col items-center justify-center gap-1 shadow"
                    >
                      <span className="text-xl font-black text-amber-300">{sfx.text}</span>
                      <span className="text-[10px] text-slate-400 font-bold truncate">{sfx.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BACKDROPS & SCENES */}
          {activeRailTab === 'backgrounds' && (
            <div className="p-4 space-y-4 overflow-y-auto">
              <h3 className="font-extrabold text-base text-white">Canvas Backdrops</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {CANVA_BACKGROUNDS.map((bg) => {
                  const isSelected = activeBackdrop.id === bg.id;
                  return (
                    <div
                      key={bg.id}
                      onClick={() => {
                        setActiveBackdrop(bg);
                        playPop();
                      }}
                      className={`relative h-24 rounded-xl border cursor-pointer overflow-hidden transition group ${
                        isSelected ? 'border-purple-500 ring-2 ring-purple-500/40 shadow-lg' : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      {bg.type === 'image' && (
                        <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                      )}
                      {bg.type === 'solid' && (
                        <div className="w-full h-full" style={{ backgroundColor: bg.color }} />
                      )}
                      {bg.type === 'gradient' && (
                        <div className="w-full h-full" style={{ background: bg.gradient }} />
                      )}
                      {bg.type === 'transparent' && (
                        <div className="w-full h-full bg-[linear-gradient(45deg,#1f1230_25%,transparent_25%),linear-gradient(-45deg,#1f1230_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f1230_75%),linear-gradient(-45deg,transparent_75%,#1f1230_75%)] bg-[size:16px_16px] bg-[#0c0714]" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 p-1.5 bg-black/70 backdrop-blur-sm text-[10px] font-bold text-white truncate">
                        {bg.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: UPLOADS & MEDIA */}
          {activeRailTab === 'uploads' && (
            <div className="p-4 space-y-4 overflow-y-auto">
              <h3 className="font-extrabold text-base text-white">Upload Media</h3>
              <Button
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} className="mr-1.5" />
                <span>Upload Images</span>
              </Button>

              <div className="pt-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Sample Characters
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {SAMPLE_PORTRAITS.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setInputPhoto(s.avatar);
                        playPop();
                      }}
                      className="cursor-pointer border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/50 transition group"
                    >
                      <img src={s.avatar} alt={s.label} className="w-full h-24 object-cover" />
                      <div className="p-1.5 bg-black/60 text-[10px] font-bold text-slate-300 truncate">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* 3. CENTRAL CANVA STAGE (Interactive Canvas Workspace) */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0512] relative">
          {/* CONTEXTUAL TOP TOOLBAR (Matching Canva's Selection Bar) */}
          <div className="h-11 border-b border-white/10 bg-[#120a1f]/90 px-4 flex items-center justify-between shrink-0 z-10 text-xs font-semibold">
            {selectedElement ? (
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                <span className="text-slate-400 font-bold px-1">{selectedElement.name || 'Element'}</span>

                <div className="h-4 w-px bg-white/10" />

                {/* Edit / Filters */}
                <button
                  onClick={() => setFilterBarOpen(!filterBarOpen)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition ${
                    filterBarOpen ? 'bg-purple-600 text-white' : 'hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <Sliders size={13} />
                  <span>Edit</span>
                </button>

                {/* Replace (Canva-style) */}
                {selectedElement.type === 'image' && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 text-slate-300 transition"
                  >
                    <RefreshCw size={13} />
                    <span>Replace</span>
                  </button>
                )}

                {/* BG Remover 👑 (Canva-style) */}
                {selectedElement.type === 'image' && (
                  <button
                    onClick={handleRemoveBackground}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition font-bold"
                  >
                    <Scissors size={13} />
                    <span>BG Remover 👑</span>
                  </button>
                )}

                {/* Die-Cut Sticker Rim */}
                {selectedElement.type === 'image' && (
                  <button
                    onClick={handleToggleStickerBorder}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 text-slate-300 transition"
                  >
                    <Sparkles size={13} />
                    <span>Sticker Rim</span>
                  </button>
                )}

                {/* Flip Horizontal / Vertical */}
                <button
                  onClick={() => updateSelectedElement({ flipX: !selectedElement.flipX })}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 text-slate-300 transition"
                  title="Flip Horizontal"
                >
                  <FlipHorizontal size={13} />
                </button>

                {/* Animation Presets */}
                <select
                  value={selectedElement.animation || 'none'}
                  onChange={(e) => updateSelectedElement({ animation: e.target.value })}
                  className="bg-black/30 border border-white/10 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                >
                  <option value="none" className="bg-[#140b22]">No Motion</option>
                  <option value="pulse" className="bg-[#140b22]">Pulse</option>
                  <option value="float" className="bg-[#140b22]">Float</option>
                  <option value="pop" className="bg-[#140b22]">Pop In</option>
                  <option value="glitch" className="bg-[#140b22]">Glitch</option>
                </select>

                <div className="h-4 w-px bg-white/10" />

                {/* Duplicate & Delete */}
                <button
                  onClick={handleDuplicateElement}
                  className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white transition"
                  title="Duplicate"
                >
                  <Copy size={13} />
                </button>
                <button
                  onClick={handleDeleteElement}
                  className="p-1 hover:bg-red-500/20 rounded text-slate-300 hover:text-red-400 transition"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <div className="text-slate-500 text-xs">
                Click any element on canvas to edit or resize
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-mono">1080 × {aspectRatio === '9:16' ? 1920 : 1080}px</span>
            </div>
          </div>

          {/* FILTER ADJUSTMENT SUB-BAR */}
          {filterBarOpen && selectedElement && (
            <div className="h-10 bg-[#160d26] border-b border-white/10 px-4 flex items-center gap-6 text-xs text-slate-300 z-10 overflow-x-auto">
              <div className="flex items-center gap-2">
                <span>Brightness:</span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={selectedElement.filter?.brightness || 100}
                  onChange={(e) =>
                    updateSelectedElement({
                      filter: { ...selectedElement.filter, brightness: Number(e.target.value) },
                    })
                  }
                  className="w-20 accent-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span>Contrast:</span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={selectedElement.filter?.contrast || 100}
                  onChange={(e) =>
                    updateSelectedElement({
                      filter: { ...selectedElement.filter, contrast: Number(e.target.value) },
                    })
                  }
                  className="w-20 accent-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span>Saturation:</span>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={selectedElement.filter?.saturation || 100}
                  onChange={(e) =>
                    updateSelectedElement({
                      filter: { ...selectedElement.filter, saturation: Number(e.target.value) },
                    })
                  }
                  className="w-20 accent-purple-500"
                />
              </div>
            </div>
          )}

          {/* CANVAS STAGE CONTAINER */}
          <div
            ref={canvasStageRef}
            onClick={() => setSelectedElementId(null)}
            className="flex-1 overflow-auto flex items-center justify-center p-8 bg-[radial-gradient(#1c0f30_1px,transparent_1px)] bg-[size:20px_20px]"
          >
            {/* CANVAS BOARD */}
            <div
              style={{
                width: '640px',
                height:
                  aspectRatio === '9:16'
                    ? '1138px'
                    : aspectRatio === '16:9'
                    ? '360px'
                    : aspectRatio === '4:5'
                    ? '800px'
                    : '640px',
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'center center',
              }}
              className="relative shadow-2xl rounded-sm transition-transform duration-150 overflow-hidden border border-white/10 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {/* BACKDROP LAYER */}
              {activeBackdrop.type === 'solid' && (
                <div className="absolute inset-0" style={{ backgroundColor: activeBackdrop.color }} />
              )}
              {activeBackdrop.type === 'image' && activeBackdrop.url && (
                <img
                  src={activeBackdrop.url}
                  alt="Backdrop"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {activeBackdrop.type === 'gradient' && (
                <div className="absolute inset-0" style={{ background: activeBackdrop.gradient }} />
              )}
              {activeBackdrop.type === 'transparent' && (
                <div className="absolute inset-0 bg-[linear-gradient(45deg,#24143a_25%,transparent_25%),linear-gradient(-45deg,#24143a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#24143a_75%),linear-gradient(-45deg,transparent_75%,#24143a_75%)] bg-[size:20px_20px] bg-[#140b22]" />
              )}

              {/* RENDER CANVAS ELEMENTS */}
              {elements.map((el) => {
                const isSelected = selectedElementId === el.id;
                const filterStyle = el.filter
                  ? `brightness(${el.filter.brightness || 100}%) contrast(${el.filter.contrast || 100}%) saturate(${el.filter.saturation || 100}%)`
                  : 'none';

                return (
                  <motion.div
                    key={el.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementId(el.id);
                      playPop();
                    }}
                    drag={!el.locked}
                    dragMomentum={false}
                    onDragEnd={(e, info) => {
                      updateSelectedElement({
                        x: el.x + info.offset.x,
                        y: el.y + info.offset.y,
                      });
                    }}
                    style={{
                      position: 'absolute',
                      left: el.x,
                      top: el.y,
                      width: el.width,
                      height: el.height,
                      transform: `rotate(${el.rotation}deg) scaleX(${el.flipX ? -1 : 1}) scaleY(${el.flipY ? -1 : 1})`,
                    }}
                    className={`cursor-move group ${
                      el.animation === 'pulse' ? 'animate-pulse' : el.animation === 'float' ? 'animate-bounce' : ''
                    }`}
                  >
                    {/* Element Graphic */}
                    {el.type === 'image' && (
                      <img
                        src={el.src}
                        alt={el.name}
                        style={{ filter: filterStyle }}
                        className="w-full h-full object-contain pointer-events-none drop-shadow-xl"
                      />
                    )}

                    {/* Speech Bubble Graphic */}
                    {el.type === 'text' && (
                      <div className="relative w-full h-full flex items-center justify-center bg-white text-black font-black text-xl rounded-3xl p-4 shadow-xl border-4 border-black">
                        <span>{el.text}</span>
                        {/* Bubble pointer tail */}
                        <div className="absolute -bottom-3 left-8 size-6 bg-white border-b-4 border-r-4 border-black rotate-45" />
                      </div>
                    )}

                    {/* Manga SFX Graphic */}
                    {el.type === 'sfx' && (
                      <div className="w-full h-full flex items-center justify-center font-black text-4xl text-amber-300 drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] stroke-black tracking-widest">
                        <span>{el.text}</span>
                      </div>
                    )}

                    {/* CANVA-STYLE SELECTION BOUNDING BOX & HANDLES */}
                    {isSelected && (
                      <div className="absolute inset-0 border-2 border-purple-500 pointer-events-none">
                        {/* 4 Corner Round Handles */}
                        <div className="absolute -top-2 -left-2 size-3.5 bg-white border-2 border-purple-600 rounded-full pointer-events-auto cursor-nwse-resize shadow" />
                        <div className="absolute -top-2 -right-2 size-3.5 bg-white border-2 border-purple-600 rounded-full pointer-events-auto cursor-nesw-resize shadow" />
                        <div className="absolute -bottom-2 -left-2 size-3.5 bg-white border-2 border-purple-600 rounded-full pointer-events-auto cursor-nesw-resize shadow" />
                        <div className="absolute -bottom-2 -right-2 size-3.5 bg-white border-2 border-purple-600 rounded-full pointer-events-auto cursor-nwse-resize shadow" />

                        {/* Rotation Handle */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            updateSelectedElement({ rotation: (el.rotation + 15) % 360 });
                          }}
                          className="absolute -top-9 left-1/2 -translate-x-1/2 size-6 bg-white border-2 border-purple-600 rounded-full pointer-events-auto cursor-grab flex items-center justify-center shadow-lg hover:scale-110 transition"
                        >
                          <RotateCw size={12} className="text-purple-600" />
                        </div>

                        {/* Floating Action Bar (Canva-style) */}
                        <div className="absolute -bottom-11 left-1/2 -translate-x-1/2 bg-[#1b0f2e] border border-white/20 rounded-lg px-2 py-1 shadow-2xl flex items-center gap-2 pointer-events-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddSpeechBubble('SUGOI!');
                            }}
                            className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white"
                            title="Comment / Bubble"
                          >
                            <MessageSquare size={13} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSelectedElement({ locked: !el.locked });
                            }}
                            className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white"
                            title={el.locked ? 'Unlock' : 'Lock'}
                          >
                            {el.locked ? <Lock size={13} /> : <Unlock size={13} />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateElement();
                            }}
                            className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white"
                            title="Duplicate"
                          >
                            <Plus size={13} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteElement();
                            }}
                            className="p-1 hover:bg-red-500/20 rounded text-slate-300 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* CANVAS BOTTOM STATUS BAR (Matching Canva Screenshot: Notes, Timer, Zoom slider 74%, Fullscreen) */}
          <footer className="h-10 border-t border-white/10 bg-[#120a1f] px-4 flex items-center justify-between shrink-0 z-20 text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span className="hover:text-white cursor-pointer transition font-semibold">Notes</span>
              <span className="hover:text-white cursor-pointer transition font-semibold">Timer</span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setZoomLevel((prev) => Math.max(25, prev - 10))}
                className="p-1 hover:text-white transition"
              >
                <ZoomOut size={14} />
              </button>

              <input
                type="range"
                min="25"
                max="150"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                className="w-28 accent-purple-500 h-1"
              />

              <button
                onClick={() => setZoomLevel((prev) => Math.min(150, prev + 10))}
                className="p-1 hover:text-white transition"
              >
                <ZoomIn size={14} />
              </button>

              <span className="w-12 text-center font-mono font-bold text-white">{zoomLevel}%</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-500">Pages 1 / 1</span>
              <button
                onClick={() => setZoomLevel(74)}
                className="hover:text-white text-slate-400 font-semibold transition"
                title="Reset zoom to 74%"
              >
                Fit
              </button>
            </div>
          </footer>
        </main>
      </div>

      {/* AI SETTINGS & GEMINI API KEY MODAL */}
      <AiSettingsModal
        open={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
      />

      {/* COPY TO CLIPBOARD NOTIFICATION */}
      <AnimatePresence>
        {copiedNotice && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-14 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl font-bold text-xs flex items-center gap-2"
          >
            <Check size={16} />
            <span>Design copied to clipboard as PNG!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper to load image as HTMLImageElement
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Helper to draw rounded rectangle on canvas
function roundRect(ctx, x, y, width, height, radius) {
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
}
