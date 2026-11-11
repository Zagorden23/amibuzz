import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sidebar } from '../components/layout/Sidebar.jsx';
import {
  Play,
  Pause,
  Settings,
  Download,
  Layers,
  Check,
  Loader2,
  Copy,
  Flame,
  Upload,
  Film,
  Image as ImageIcon,
  Scissors,
  Type,
  Palette,
  X,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { PlanBadge } from '../components/ui/PlanBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { planFor } from '../lib/plans.js';
import { createAnimatedGif } from '../lib/gifEncoder.js';
import { createAnimatedWebp, canEncodeWebp } from '../lib/webpAnimEncoder.js';
import { createZipBlob } from '../lib/zipExporter.js';
import { loadMedia, loadSlideshow, extractVideoFrames, MAX_CLIP_FRAMES } from '../lib/mediaFrames.js';
import { animeFilter, TOON_STYLES, createCanvas, loadImage, toCanvas } from '../lib/stickerFx.js';
import {
  MOTION_PRESETS,
  CAPTION_COLORS,
  drawMotionFrame,
  drawClipFrame,
  drawCaption,
  drawWatermark,
  buildSequence,
} from '../lib/motionPresets.js';
import { getStoredStickers, updateStickerInStorage } from '../services/stickerStorage.js';
import { playPop, playSuccess } from '../lib/audio.js';
import { fireConfetti } from '../lib/confetti.js';

const CHECKER =
  "bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgfQEhD/o+OQZIMxG4c1EAaGEY1gDAg0xQ+OqMawDAg0xQ+OqMaQBgA+zQ+O2/1h6gAAAAASUVORK5CYII=')]";

const EXPORT_FORMATS = [
  { id: 'gif', label: 'Animated GIF', sub: 'Works everywhere', ext: 'gif' },
  { id: 'whatsapp', label: 'WhatsApp Sticker', sub: '512px WebP · ≤ 500 KB', ext: 'webp', fixedSize: 512, maxBytes: 500 * 1024 },
  { id: 'discord', label: 'Discord Emoji', sub: '128px GIF · ≤ 256 KB', ext: 'gif', fixedSize: 128, maxBytes: 256 * 1024 },
  { id: 'webp', label: 'Animated WebP', sub: 'Smaller, full colour', ext: 'webp' },
  { id: 'frames', label: 'PNG Frames', sub: 'ZIP image sequence', ext: 'zip' },
];

const BACKGROUNDS = [
  { id: 'transparent', label: 'Clear' },
  { id: '#ffffff', label: 'White' },
  { id: '#000000', label: 'Black' },
  { id: '#00b140', label: 'Green' },
];

const formatBytes = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const safeFileName = (name) => (name || 'amibuzz').toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'amibuzz';

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

const Section = ({ icon: Icon, title, aside, children }) => (
  <div className="space-y-2.5">
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon size={13} className="text-red-400" />} {title}
      </label>
      {aside}
    </div>
    {children}
  </div>
);

const Choice = ({ active, onClick, children, className = '', disabled = false, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`rounded-xl border text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
      active
        ? 'bg-red-500/20 border-red-500 text-white shadow-md'
        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
    } ${className}`}
  >
    {children}
  </button>
);

export const GifLab = ({ onNavigate, pageState }) => {
  const { user, profile } = useAuth();
  const plan = planFor(profile);
  const isPaid = plan.id !== 'free';
  const maxExportSize = isPaid ? 1024 : 512;
  const maxClipSeconds = isPaid ? 30 : 10;

  // ---- Source -------------------------------------------------------------
  // { id, name, kind: 'still', canvas, stickerId? }
  // { id, name, kind: 'clip', origin, frames: [{canvas, delay}], truncated }
  const [source, setSource] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null); // { duration, width, height } for video sources
  const [videoTrim, setVideoTrim] = useState({ start: 0, end: 0, fps: 12 });
  const videoHandleRef = useRef(null); // { video, url }
  const [busy, setBusy] = useState(null); // { label, progress } while loading / filtering
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [library] = useState(() => getStoredStickers());
  const fileInputRef = useRef(null);
  const jobRef = useRef(0);

  // ---- Edit state -----------------------------------------------------------
  const [motion, setMotion] = useState('bounce');
  const [loopSeconds, setLoopSeconds] = useState(1.6);
  const [fps, setFps] = useState(15);
  const [trim, setTrim] = useState({ start: 0, end: 0 });
  const [speed, setSpeed] = useState(1);
  const [direction, setDirection] = useState('forward');
  const [framing, setFraming] = useState('original'); // 'original' | 'square' | 'fit'
  const [filterStyle, setFilterStyle] = useState('none');
  const [adjust, setAdjust] = useState({ brightness: 100, contrast: 100, saturation: 100 });
  const [caption, setCaption] = useState({ text: '', position: 'bottom', color: 'white', size: 1 });
  const [background, setBackground] = useState('transparent');
  const [isLooping, setIsLooping] = useState(true);

  // ---- Export state ---------------------------------------------------------
  const [exportFormat, setExportFormat] = useState('gif');
  const [size, setSize] = useState(480);
  const [gifColors, setGifColors] = useState(256);
  const [gifDither, setGifDither] = useState('none');
  const [exporting, setExporting] = useState(null); // { progress, label }
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // ---- Playback ---------------------------------------------------------------
  const previewCanvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const playheadRef = useRef({ index: 0, elapsed: 0 });
  const liveRef = useRef(null);

  // Toon-filtered copy of the source artwork, built off the main render path.
  const [styled, setStyled] = useState(null); // { key, canvas | frames }

  const releaseVideo = useCallback(() => {
    const handle = videoHandleRef.current;
    if (handle) {
      handle.video.removeAttribute('src');
      handle.video.load();
      URL.revokeObjectURL(handle.url);
      videoHandleRef.current = null;
    }
  }, []);

  const adoptSource = useCallback((next) => {
    setStyled(null);
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    playheadRef.current = { index: 0, elapsed: 0 };
    setFrameIndex(0);
    setIsPlaying(true);
    if (next.kind === 'clip') {
      setTrim({ start: 0, end: next.frames.length - 1 });
    }
    // Timing edits belong to the old clip; looks (style, caption…) carry over.
    setDirection('forward');
    setSpeed(1);
    setSource(next);
  }, []);

  const pullVideoFrames = useCallback(
    async (range, name) => {
      const handle = videoHandleRef.current;
      if (!handle) return;
      const job = ++jobRef.current;
      setError('');
      setBusy({ label: 'Reading video frames…', progress: 0 });
      try {
        const frames = await extractVideoFrames(handle.video, {
          ...range,
          onProgress: (p) => job === jobRef.current && setBusy({ label: 'Reading video frames…', progress: p }),
          isCancelled: () => job !== jobRef.current,
        });
        if (job !== jobRef.current) return;
        adoptSource({ id: `video-${Date.now()}`, name, kind: 'clip', origin: 'video', frames, truncated: false });
      } catch (err) {
        if (err?.name !== 'AbortError') setError(err?.message || 'Could not read that video.');
      } finally {
        if (job === jobRef.current) setBusy(null);
      }
    },
    [adoptSource]
  );

  const openFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).filter(Boolean);
      if (files.length === 0) return;
      const job = ++jobRef.current;
      setError('');
      setBusy({ label: 'Opening…', progress: null });
      try {
        const allImages = files.every((f) => (f.type || '').startsWith('image/'));
        if (files.length > 1 && allImages) {
          const clip = await loadSlideshow(files, { delay: 500 });
          if (job !== jobRef.current) return;
          releaseVideo();
          setVideoInfo(null);
          adoptSource({ id: `slides-${Date.now()}`, name: `${files.length}-image slideshow`, ...clip });
          return;
        }

        const file = files[0];
        const media = await loadMedia(file);
        if (job !== jobRef.current) {
          if (media.kind === 'video') URL.revokeObjectURL(media.url);
          return;
        }
        releaseVideo();

        if (media.kind === 'video') {
          videoHandleRef.current = { video: media.video, url: media.url };
          const end = Math.min(media.duration, 5, maxClipSeconds);
          const range = { start: 0, end, fps: 12 };
          setVideoInfo({ duration: media.duration, width: media.width, height: media.height, name: file.name });
          setVideoTrim(range);
          await pullVideoFrames(range, file.name);
          return;
        }

        setVideoInfo(null);
        if (media.kind === 'clip') {
          adoptSource({ id: `clip-${Date.now()}`, name: file.name, ...media });
        } else {
          adoptSource({ id: `still-${Date.now()}`, name: file.name, kind: 'still', canvas: media.canvas });
        }
      } catch (err) {
        if (job === jobRef.current) setError(err?.message || 'Could not open that file.');
      } finally {
        if (job === jobRef.current) setBusy((b) => (b?.label === 'Opening…' ? null : b));
      }
    },
    [adoptSource, pullVideoFrames, releaseVideo, maxClipSeconds]
  );

  const openSticker = useCallback(
    async (sticker) => {
      if (!sticker?.img) return;
      const job = ++jobRef.current;
      setError('');
      setBusy({ label: 'Opening…', progress: null });
      try {
        const image = await loadImage(sticker.img);
        const canvas = toCanvas(image, 1024);
        // Reading a pixel proves the canvas is usable for export (not CORS-tainted).
        canvas.getContext('2d').getImageData(0, 0, 1, 1);
        if (job !== jobRef.current) return;
        releaseVideo();
        setVideoInfo(null);
        adoptSource({
          id: `sticker-${sticker.id || Date.now()}`,
          name: sticker.name || 'Sticker',
          kind: 'still',
          canvas,
          stickerId: sticker.id,
        });
      } catch {
        if (job === jobRef.current) setError('That sticker image could not be loaded for animation.');
      } finally {
        if (job === jobRef.current) setBusy(null);
      }
    },
    [adoptSource, releaseVideo]
  );

  // Open the sticker we were sent here with.
  useEffect(() => {
    if (pageState?.sticker) openSticker(pageState.sticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Paste an image or video straight from the clipboard.
  useEffect(() => {
    const onPaste = (e) => {
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) {
        e.preventDefault();
        openFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [openFiles]);

  useEffect(
    () => () => {
      jobRef.current++;
      releaseVideo();
    },
    [releaseVideo]
  );
  useEffect(() => () => result && URL.revokeObjectURL(result.url), [result]);

  // ---- Anime style filter ------------------------------------------------------
  useEffect(() => {
    if (!source || filterStyle === 'none') {
      setStyled(null);
      return undefined;
    }
    let cancelled = false;
    const key = `${source.id}|${filterStyle}`;
    const stylise = (canvas) => {
      const copy = createCanvas(canvas.width, canvas.height);
      const ctx = copy.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(canvas, 0, 0);
      const pixels = ctx.getImageData(0, 0, copy.width, copy.height);
      animeFilter(pixels, filterStyle);
      ctx.putImageData(pixels, 0, 0);
      return copy;
    };
    (async () => {
      const label = `Drawing ${filterStyle} style…`;
      setBusy({ label, progress: 0 });
      await nextTick();
      try {
        if (source.kind === 'still') {
          const canvas = stylise(source.canvas);
          if (!cancelled) setStyled({ key, canvas });
        } else {
          const frames = [];
          for (let i = 0; i < source.frames.length; i++) {
            if (cancelled) return;
            frames.push({ canvas: stylise(source.frames[i].canvas), delay: source.frames[i].delay });
            setBusy({ label, progress: (i + 1) / source.frames.length });
            await nextTick();
          }
          if (!cancelled) setStyled({ key, frames });
        }
      } catch {
        if (!cancelled) setError('The style filter could not be applied to this source.');
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, filterStyle]);

  const styledReady = styled && source && styled.key === `${source.id}|${filterStyle}`;
  const stillCanvas = source?.kind === 'still' ? (styledReady ? styled.canvas : source.canvas) : null;
  const clipFrames = source?.kind === 'clip' ? (styledReady ? styled.frames : source.frames) : null;

  // ---- Timeline ------------------------------------------------------------------
  const sequence = useMemo(
    () =>
      clipFrames
        ? buildSequence(clipFrames, { trimStart: trim.start, trimEnd: trim.end, direction, speed, maxFps: 50 })
        : [],
    [clipFrames, trim.start, trim.end, direction, speed]
  );

  const timeline = useMemo(() => {
    if (source?.kind === 'clip') {
      const delays = sequence.map((f) => f.delay);
      return { count: delays.length, delays, total: delays.reduce((a, b) => a + b, 0) };
    }
    const count = motion === 'none' ? 1 : Math.max(2, Math.min(120, Math.round(loopSeconds * fps)));
    const delays = new Array(count).fill(1000 / fps);
    return { count, delays, total: count * (1000 / fps) };
  }, [source, sequence, motion, loopSeconds, fps]);

  const format = EXPORT_FORMATS.find((f) => f.id === exportFormat) || EXPORT_FORMATS[0];

  // Final pixel size of the export, and how clip frames are fitted into it.
  const output = useMemo(() => {
    const edge = format.fixedSize || Math.min(size, maxExportSize);
    if (!source || source.kind === 'still' || format.fixedSize) {
      return { width: edge, height: edge, fit: format.id === 'discord' && framing !== 'fit' ? 'cover' : 'contain' };
    }
    if (framing !== 'original') {
      return { width: edge, height: edge, fit: framing === 'square' ? 'cover' : 'contain' };
    }
    const first = source.frames[0].canvas;
    const scale = edge / Math.max(first.width, first.height);
    return {
      width: Math.max(1, Math.round(first.width * scale)),
      height: Math.max(1, Math.round(first.height * scale)),
      fit: 'cover',
    };
  }, [source, format, size, maxExportSize, framing]);

  const cssFilter =
    adjust.brightness === 100 && adjust.contrast === 100 && adjust.saturation === 100
      ? 'none'
      : `brightness(${adjust.brightness}%) contrast(${adjust.contrast}%) saturate(${adjust.saturation}%)`;

  /** Draws frame `index` of the current edit — used by both preview and export. */
  const renderFrame = (ctx, width, height, index, fit = output.fit) => {
    ctx.clearRect(0, 0, width, height);
    if (background !== 'transparent') {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    if (stillCanvas) {
      drawMotionFrame(ctx, stillCanvas, timeline.count > 1 ? index / timeline.count : 0, motion, {
        width,
        height,
        frameIndex: index,
        filter: cssFilter,
      });
    } else if (sequence[index]) {
      drawClipFrame(ctx, sequence[index].canvas, { width, height, fit, filter: cssFilter });
    }
    drawCaption(ctx, width, height, caption);
    if (!isPaid) drawWatermark(ctx, width, height);
  };

  // The preview loop reads the latest edit through this ref, so it never
  // needs to be torn down and restarted while sliders move.
  liveRef.current = { renderFrame, timeline, output, isPlaying, ready: Boolean(stillCanvas || sequence.length) };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      const live = liveRef.current;
      const dt = Math.min(250, now - last);
      last = now;
      const canvas = previewCanvasRef.current;
      if (live?.ready && canvas) {
        const head = playheadRef.current;
        const { count, delays } = live.timeline;
        if (head.index >= count) head.index = 0;
        if (live.isPlaying && count > 1) {
          head.elapsed += dt;
          let guard = 0;
          while (head.elapsed >= delays[head.index] && guard++ < count) {
            head.elapsed -= delays[head.index];
            head.index = (head.index + 1) % count;
          }
          setFrameIndex((prev) => (prev === head.index ? prev : head.index));
        }
        const scale = Math.min(1, 512 / Math.max(live.output.width, live.output.height));
        const w = Math.max(1, Math.round(live.output.width * scale));
        const h = Math.max(1, Math.round(live.output.height * scale));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        live.renderFrame(canvas.getContext('2d'), w, h, head.index);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const scrubTo = (index) => {
    setIsPlaying(false);
    playheadRef.current = { index, elapsed: 0 };
    setFrameIndex(index);
  };

  // ---- Export ----------------------------------------------------------------------
  const handleExport = async () => {
    if (exporting || !liveRef.current?.ready) return;
    setError('');
    playPop();

    const { width, height } = output;
    let delays = timeline.delays.slice();
    const count = timeline.count;

    if (format.id === 'whatsapp') {
      if (timeline.total > 10000) {
        setError('WhatsApp stickers can be at most 10 seconds long — trim the clip or speed it up.');
        return;
      }
      delays = delays.map((d) => Math.max(8, d));
    }
    if ((format.ext === 'webp') && !canEncodeWebp()) {
      setError("This browser can't encode WebP. Choose Animated GIF, or use Chrome, Edge or Firefox.");
      return;
    }
    if (width * height * count > 90_000_000) {
      setError('That export is too large to build in the browser. Pick a smaller size or a shorter clip.');
      return;
    }

    setExporting({ progress: 0, label: 'Rendering frames…' });
    await nextTick();

    try {
      const canvases = [];
      for (let i = 0; i < count; i++) {
        const canvas = createCanvas(width, height);
        renderFrame(canvas.getContext('2d', { willReadFrequently: true }), width, height, i);
        canvases.push(canvas);
        if (i % 4 === 3) {
          setExporting({ progress: ((i + 1) / count) * 0.3, label: 'Rendering frames…' });
          await nextTick();
        }
      }

      const encodeProgress = (label) => (p) => setExporting({ progress: 0.3 + p * 0.7, label });
      let blob;
      let note = '';
      let frameCount = count;

      if (format.id === 'gif' || format.id === 'discord') {
        // Try the chosen quality first; for size-capped targets step down
        // colours, then frames, until the file fits.
        const colourSteps = [gifColors, 128, 64, 32].filter((c, i) => i === 0 || c < gifColors);
        let frames = canvases.map((canvas, i) => ({ canvas, delay: delays[i] }));
        const cap = format.maxBytes || Infinity;
        outer: for (let pass = 0; pass < 4; pass++) {
          for (const colours of colourSteps) {
            blob = await createAnimatedGif(
              frames.map((f) => f.canvas),
              {
                delay: frames.map((f) => f.delay),
                repeat: isLooping ? 0 : -1,
                maxColors: colours,
                dither: gifDither,
                onProgress: encodeProgress(pass || colours !== gifColors ? 'Shrinking to fit…' : 'Encoding GIF…'),
              }
            );
            frameCount = frames.length;
            if (blob.size <= cap) {
              if (colours !== gifColors || pass > 0) {
                note = `Reduced to ${colours} colours${pass > 0 ? ` and ${frames.length} frames` : ''} to fit the limit.`;
              }
              break outer;
            }
            if (!Number.isFinite(cap)) break outer;
          }
          if (frames.length <= 4) break;
          const thinned = [];
          for (let i = 0; i < frames.length; i += 2) {
            thinned.push({ canvas: frames[i].canvas, delay: frames[i].delay + (frames[i + 1]?.delay ?? 0) });
          }
          frames = thinned;
        }
      } else if (format.ext === 'webp') {
        const encoded = await createAnimatedWebp(canvases, {
          delay: delays,
          loop: isLooping ? 0 : 1,
          quality: 0.9,
          maxBytes: format.maxBytes,
          onProgress: encodeProgress('Encoding WebP…'),
        });
        blob = encoded.blob;
        frameCount = encoded.frameCount;
        if (encoded.quality < 0.9 || encoded.frameCount !== count) {
          note = `Compressed to quality ${Math.round(encoded.quality * 100)}${
            encoded.frameCount !== count ? ` and ${encoded.frameCount} frames` : ''
          } to fit the limit.`;
        }
      } else {
        const files = [];
        for (let i = 0; i < count; i++) {
          const png = await new Promise((resolve) => canvases[i].toBlob(resolve, 'image/png'));
          files.push({
            name: `frame_${String(i + 1).padStart(3, '0')}.png`,
            content: new Uint8Array(await png.arrayBuffer()),
          });
          encodeProgress('Packing frames…')((i + 1) / count);
        }
        blob = createZipBlob(files);
      }

      const fileName = `${safeFileName(source.name)}-${source.kind === 'still' ? motion : 'clip'}.${format.ext}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return {
          url,
          fileName,
          format,
          width,
          height,
          frames: frameCount,
          bytes: blob.size,
          seconds: timeline.total / 1000,
          note,
          withinLimit: format.maxBytes ? blob.size <= format.maxBytes : null,
          previewable: format.ext !== 'zip',
        };
      });

      // Remember that this library sticker now has an animated version.
      if (source.stickerId && frameCount > 1) {
        const preset = MOTION_PRESETS.find((p) => p.id === motion);
        updateStickerInStorage(source.stickerId, { animated: true, animationStyle: preset?.name || motion }, user);
      }

      playSuccess();
      fireConfetti();
    } catch (err) {
      console.error('Export error:', err);
      setError(err?.message || 'The export failed. Try a smaller size or fewer frames.');
    } finally {
      setExporting(null);
    }
  };

  const handleCopyFrame = async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !liveRef.current?.ready) return;
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        playSuccess();
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      setError('Copying needs clipboard permission in this browser.');
    }
  };

  const downloadResult = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result.url;
    link.download = result.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    openFiles(e.dataTransfer.files);
  };

  const clipLength = videoTrim.end - videoTrim.start;
  const exportLabel = exporting
    ? `${Math.round(exporting.progress * 100)}%`
    : `Export ${format.label}`;

  return (
    <div className="flex h-screen bg-[#0f0913] text-slate-100 overflow-hidden">
      <Sidebar currentPath="giflab" onNavigate={onNavigate} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.gif,.webp,.apng,.mp4,.webm,.mov,.m4v,.mkv"
        multiple
        className="hidden"
        data-testid="giflab-file-input"
        onChange={(e) => {
          openFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 shrink-0 flex items-center justify-between px-4 lg:px-8 border-b border-white/10 bg-[#0f0913]/80 backdrop-blur-md z-30">
          <div className="pl-14 lg:pl-0 min-w-0">
            <h1 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2">
              Anime GIF Lab
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30 hidden sm:inline">
                Image · GIF · Video
              </span>
            </h1>
            <p className="text-slate-400 text-xs lg:text-sm hidden sm:block truncate">
              {source ? (
                <>
                  {source.kind === 'still' ? 'Animating' : 'Editing'}:{' '}
                  <span className="text-slate-200 font-bold">{source.name}</span>
                </>
              ) : (
                'Turn any picture, GIF or video into an animated sticker'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 lg:gap-3 ml-auto">
            <PlanBadge onNavigate={onNavigate} />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs font-bold"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              <span className="hidden md:inline">{source ? 'New source' : 'Open file'}</span>
            </Button>
            {source && (
              <Button variant="outline" size="sm" className="gap-2 text-xs font-bold hidden sm:inline-flex" onClick={handleCopyFrame}>
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                <span className="hidden lg:inline">{copied ? 'Copied!' : 'Copy frame'}</span>
              </Button>
            )}
            <Button
              className="gap-2 text-sm px-4 py-2 font-bold shadow-lg"
              onClick={handleExport}
              disabled={!source || Boolean(exporting) || Boolean(busy)}
              data-testid="giflab-export"
            >
              {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              <span>{exportLabel}</span>
            </Button>
          </div>
        </header>

        {error && (
          <div className="shrink-0 bg-red-500/15 border-b border-red-500/30 text-red-200 px-6 py-2.5 text-xs font-semibold flex items-center gap-2" role="alert">
            <AlertTriangle size={15} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="p-1 rounded hover:bg-white/10" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-[1920px] mx-auto w-full">
          {/* Stage */}
          <section
            className={`flex-1 flex flex-col p-4 lg:p-6 bg-[#0a060d] relative overflow-y-auto min-h-[340px] ${
              isDragging ? 'ring-2 ring-inset ring-red-500' : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            {!source ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-xl rounded-3xl border-2 border-dashed border-white/15 hover:border-red-500/60 bg-white/5 hover:bg-white/10 transition-all p-8 lg:p-12 flex flex-col items-center text-center gap-4"
                >
                  {busy ? (
                    <Loader2 size={40} className="text-red-400 animate-spin" />
                  ) : (
                    <div className="flex items-center gap-3 text-red-400">
                      <ImageIcon size={34} />
                      <Film size={34} />
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-black text-white">
                      {busy ? busy.label : 'Drop an image, GIF or video here'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5 max-w-sm">
                      PNG, JPG, WebP, SVG, animated GIF, MP4, WebM, MOV… or select several images to build a
                      slideshow. You can also paste from the clipboard. Everything is processed on your device.
                    </p>
                  </div>
                  <span className="rgb-gradient text-white text-sm font-bold px-5 py-2 rounded-xl shadow-lg">
                    Browse files
                  </span>
                </button>

                {library.length > 0 && (
                  <div className="w-full max-w-xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Or animate one of your stickers
                    </p>
                    <div className="grid grid-cols-6 gap-2">
                      {library.slice(0, 12).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => openSticker(s)}
                          title={s.name}
                          className="aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-red-500 bg-black/50 transition-all hover:scale-105"
                        >
                          <img src={s.img} alt={s.name} className="w-full h-full object-contain p-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex-1 flex items-center justify-center relative min-h-[260px]">
                  <div
                    className={`relative rounded-3xl border border-white/10 overflow-hidden shadow-2xl ${CHECKER}`}
                    style={{
                      aspectRatio: `${output.width} / ${output.height}`,
                      width: `min(100%, ${output.width >= output.height ? 460 : Math.round((460 * output.width) / output.height)}px)`,
                    }}
                  >
                    <canvas ref={previewCanvasRef} className="w-full h-full block" data-testid="giflab-preview" />
                    {busy && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-center px-6">
                        <Loader2 size={30} className="text-red-400 animate-spin" />
                        <p className="text-sm font-bold text-white">{busy.label}</p>
                        {busy.progress != null && (
                          <div className="w-40 h-1.5 rounded-full bg-white/15 overflow-hidden">
                            <div className="h-full rgb-gradient" style={{ width: `${Math.round(busy.progress * 100)}%` }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/75 backdrop-blur-md px-4 py-2 rounded-full border border-white/15 shadow-2xl">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="size-11 rgb-gradient text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <div className="text-[11px] font-bold text-slate-300 pr-2 leading-tight">
                      <div>
                        {output.width}×{output.height}px
                      </div>
                      <div className="text-slate-500">
                        {timeline.count} frame{timeline.count === 1 ? '' : 's'} · {(timeline.total / 1000).toFixed(1)}s
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline scrubber */}
                <div className="shrink-0 mt-4 bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1.5 text-red-400">
                      <Flame size={14} /> Frame {Math.min(frameIndex + 1, timeline.count)} / {timeline.count}
                    </span>
                    <span>
                      {timeline.count > 1 ? `${(1000 / (timeline.total / timeline.count)).toFixed(1)} FPS average` : 'Single frame'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, timeline.count - 1)}
                    value={Math.min(frameIndex, Math.max(0, timeline.count - 1))}
                    onChange={(e) => scrubTo(Number(e.target.value))}
                    disabled={timeline.count < 2}
                    className="w-full accent-red-500 cursor-pointer"
                    aria-label="Scrub through frames"
                  />
                </div>

                {/* Export result */}
                {result && (
                  <div className="shrink-0 mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 flex flex-col sm:flex-row gap-4" data-testid="giflab-result">
                    {result.previewable && (
                      <div className={`size-28 shrink-0 rounded-xl overflow-hidden border border-white/10 ${CHECKER}`}>
                        <img src={result.url} alt="Exported animation" className="w-full h-full object-contain" data-testid="giflab-result-image" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-green-300 flex items-center gap-1.5">
                        <Check size={16} /> Exported — this is the actual file
                      </p>
                      <p className="text-xs text-slate-300 mt-1 truncate font-mono">{result.fileName}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {result.width}×{result.height}px · {result.frames} frame{result.frames === 1 ? '' : 's'} ·{' '}
                        {result.seconds.toFixed(1)}s · <span className="text-white font-bold">{formatBytes(result.bytes)}</span>
                      </p>
                      {result.withinLimit != null && (
                        <p className={`text-xs mt-1 font-bold ${result.withinLimit ? 'text-green-300' : 'text-yellow-300'}`}>
                          {result.withinLimit
                            ? `Fits the ${result.format.label} limit (${formatBytes(result.format.maxBytes)}).`
                            : `Still over the ${formatBytes(result.format.maxBytes)} limit — shorten the clip or simplify it.`}
                        </p>
                      )}
                      {result.note && <p className="text-[11px] text-slate-400 mt-1">{result.note}</p>}
                      <div className="flex gap-2 mt-2.5">
                        <Button size="sm" className="gap-1.5 text-xs" onClick={downloadResult}>
                          <Download size={14} /> Download again
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() =>
                            setResult((prev) => {
                              if (prev) URL.revokeObjectURL(prev.url);
                              return null;
                            })
                          }
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Controls */}
          <aside className="w-full lg:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0f0913]/60 p-4 lg:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <Settings size={20} className="text-red-400" />
              <h3 className="text-base font-black text-white">Motion & Export Engine</h3>
            </div>

            {!source && (
              <p className="text-xs text-slate-400 leading-relaxed">
                Open a file to start. <span className="text-slate-200 font-bold">Pictures</span> get anime motion
                presets; <span className="text-slate-200 font-bold">GIFs and videos</span> can be trimmed, sped up,
                reversed, captioned and restyled before export.
              </p>
            )}

            {/* Video trim */}
            {source && videoInfo && (
              <Section
                icon={Scissors}
                title="Video range"
                aside={<span className="text-[11px] text-slate-500">{videoInfo.duration.toFixed(1)}s source</span>}
              >
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Start</span>
                      <span className="text-white font-bold">{videoTrim.start.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0, videoInfo.duration - 0.2)}
                      step="0.1"
                      value={videoTrim.start}
                      onChange={(e) => {
                        const start = Number(e.target.value);
                        setVideoTrim((v) => ({
                          ...v,
                          start,
                          end: Math.min(videoInfo.duration, Math.max(start + 0.2, Math.min(v.end, start + maxClipSeconds))),
                        }));
                      }}
                      className="w-full accent-red-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>End</span>
                      <span className="text-white font-bold">{videoTrim.end.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max={videoInfo.duration}
                      step="0.1"
                      value={videoTrim.end}
                      onChange={(e) => {
                        const end = Number(e.target.value);
                        setVideoTrim((v) => ({
                          ...v,
                          end,
                          start: Math.max(0, Math.min(v.start, end - 0.2), end - maxClipSeconds),
                        }));
                      }}
                      className="w-full accent-red-500 cursor-pointer"
                    />
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[8, 10, 12, 15, 24].map((v) => (
                      <Choice key={v} active={videoTrim.fps === v} onClick={() => setVideoTrim((t) => ({ ...t, fps: v }))} className="py-1.5">
                        {v} fps
                      </Choice>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="w-full gap-2 text-xs"
                    disabled={Boolean(busy)}
                    onClick={() => pullVideoFrames(videoTrim, videoInfo.name)}
                  >
                    <RefreshCw size={14} /> Use {clipLength.toFixed(1)}s ·{' '}
                    {Math.min(MAX_CLIP_FRAMES, Math.round(clipLength * videoTrim.fps))} frames
                  </Button>
                  <p className="text-[10px] text-slate-500">
                    Up to {maxClipSeconds}s per clip on the {plan.label} plan.
                  </p>
                </div>
              </Section>
            )}

            {/* Still: motion presets */}
            {source?.kind === 'still' && (
              <>
                <Section icon={Sparkles} title="Anime motion">
                  <div className="grid grid-cols-2 gap-2">
                    {MOTION_PRESETS.map((p) => (
                      <Choice
                        key={p.id}
                        active={motion === p.id}
                        onClick={() => {
                          playPop();
                          setMotion(p.id);
                        }}
                        className="p-2.5 text-left"
                      >
                        <p className="font-bold text-xs">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{p.desc}</p>
                      </Choice>
                    ))}
                  </div>
                </Section>

                <Section title="Loop length" aside={<span className="text-xs font-bold text-white">{loopSeconds.toFixed(1)}s</span>}>
                  <input
                    type="range"
                    min="0.5"
                    max="4"
                    step="0.1"
                    value={loopSeconds}
                    onChange={(e) => setLoopSeconds(Number(e.target.value))}
                    className="w-full accent-red-500 cursor-pointer"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 15, 20, 30].map((v) => (
                      <Choice key={v} active={fps === v} onClick={() => setFps(v)} className="py-2">
                        {v} FPS
                      </Choice>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {/* Clip: trim / speed / direction / framing */}
            {source?.kind === 'clip' && (
              <>
                <Section
                  icon={Scissors}
                  title="Trim frames"
                  aside={
                    <span className="text-[11px] text-slate-500">
                      {trim.start + 1}–{trim.end + 1} of {source.frames.length}
                    </span>
                  }
                >
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <input
                      type="range"
                      min="0"
                      max={source.frames.length - 1}
                      value={trim.start}
                      onChange={(e) => {
                        const start = Number(e.target.value);
                        setTrim((t) => ({ start, end: Math.max(start, t.end) }));
                      }}
                      className="w-full accent-red-500 cursor-pointer"
                      aria-label="First frame"
                    />
                    <input
                      type="range"
                      min="0"
                      max={source.frames.length - 1}
                      value={trim.end}
                      onChange={(e) => {
                        const end = Number(e.target.value);
                        setTrim((t) => ({ start: Math.min(t.start, end), end }));
                      }}
                      className="w-full accent-red-500 cursor-pointer"
                      aria-label="Last frame"
                    />
                    {source.truncated && (
                      <p className="text-[10px] text-yellow-300">Only the first {MAX_CLIP_FRAMES} frames were loaded.</p>
                    )}
                  </div>
                </Section>

                <Section title="Speed">
                  <div className="grid grid-cols-5 gap-1.5">
                    {[0.5, 0.75, 1, 1.5, 2].map((v) => (
                      <Choice key={v} active={speed === v} onClick={() => setSpeed(v)} className="py-2">
                        {v}×
                      </Choice>
                    ))}
                  </div>
                </Section>

                <Section title="Playback">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'forward', label: 'Forward' },
                      { id: 'reverse', label: 'Reverse' },
                      { id: 'boomerang', label: 'Boomerang' },
                    ].map((d) => (
                      <Choice key={d.id} active={direction === d.id} onClick={() => setDirection(d.id)} className="py-2">
                        {d.label}
                      </Choice>
                    ))}
                  </div>
                </Section>

                {!format.fixedSize && (
                  <Section title="Framing">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'original', label: 'Original' },
                        { id: 'square', label: 'Square crop' },
                        { id: 'fit', label: 'Square fit' },
                      ].map((f) => (
                        <Choice key={f.id} active={framing === f.id} onClick={() => setFraming(f.id)} className="py-2">
                          {f.label}
                        </Choice>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            )}

            {source && (
              <>
                {/* Anime style */}
                <Section icon={Palette} title="Anime style filter">
                  <div className="flex flex-wrap gap-1.5">
                    {['none', ...Object.keys(TOON_STYLES)].map((style) => (
                      <Choice
                        key={style}
                        active={filterStyle === style}
                        onClick={() => {
                          playPop();
                          setFilterStyle(style);
                        }}
                        className="px-2.5 py-1.5"
                      >
                        {style === 'none' ? 'Original' : style}
                      </Choice>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Cel-shades every frame on your device. No AI credits are used.
                  </p>
                </Section>

                {/* Caption */}
                <Section icon={Type} title="Caption">
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <input
                      type="text"
                      value={caption.text}
                      maxLength={80}
                      onChange={(e) => setCaption((c) => ({ ...c, text: e.target.value }))}
                      placeholder="Add text… (SUGOI!, NANI?!)"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-bold outline-none focus:border-red-500/50"
                    />
                    <div className="flex items-center gap-2">
                      <div className="grid grid-cols-2 gap-1.5 flex-1">
                        {['top', 'bottom'].map((pos) => (
                          <Choice
                            key={pos}
                            active={caption.position === pos}
                            onClick={() => setCaption((c) => ({ ...c, position: pos }))}
                            className="py-1.5 capitalize"
                          >
                            {pos}
                          </Choice>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        {Object.entries(CAPTION_COLORS).map(([id, c]) => (
                          <button
                            key={id}
                            onClick={() => setCaption((prev) => ({ ...prev, color: id }))}
                            title={id}
                            aria-label={`${id} caption`}
                            className={`size-6 rounded-full border-2 transition-transform ${
                              caption.color === id ? 'border-red-500 scale-110' : 'border-white/20'
                            }`}
                            style={{ backgroundColor: c.fill }}
                          />
                        ))}
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.8"
                      step="0.05"
                      value={caption.size}
                      onChange={(e) => setCaption((c) => ({ ...c, size: Number(e.target.value) }))}
                      className="w-full accent-red-500 cursor-pointer"
                      aria-label="Caption size"
                    />
                  </div>
                </Section>

                {/* Adjust */}
                <Section
                  title="Colour"
                  aside={
                    cssFilter !== 'none' && (
                      <button
                        onClick={() => setAdjust({ brightness: 100, contrast: 100, saturation: 100 })}
                        className="text-[11px] font-bold text-red-400 hover:underline"
                      >
                        Reset
                      </button>
                    )
                  }
                >
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    {[
                      { key: 'brightness', label: 'Brightness' },
                      { key: 'contrast', label: 'Contrast' },
                      { key: 'saturation', label: 'Saturation' },
                    ].map((row) => (
                      <div key={row.key}>
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>{row.label}</span>
                          <span className="text-white font-bold">{adjust[row.key]}%</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="170"
                          value={adjust[row.key]}
                          onChange={(e) => setAdjust((a) => ({ ...a, [row.key]: Number(e.target.value) }))}
                          className="w-full accent-red-500 cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Export target */}
                <Section icon={Download} title="Export as">
                  <div className="grid grid-cols-2 gap-2">
                    {EXPORT_FORMATS.map((f) => (
                      <Choice
                        key={f.id}
                        active={exportFormat === f.id}
                        onClick={() => {
                          playPop();
                          setExportFormat(f.id);
                        }}
                        className="p-2.5 text-left"
                      >
                        <p className="font-bold text-xs">{f.label}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{f.sub}</p>
                      </Choice>
                    ))}
                  </div>
                </Section>

                {!format.fixedSize && (
                  <Section title="Size (longest edge)">
                    <select
                      value={Math.min(size, maxExportSize)}
                      onChange={(e) => setSize(Number(e.target.value))}
                      className="w-full bg-[#1b1422] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-red-500/50"
                    >
                      <option value="128">128 px — emoji</option>
                      <option value="256">256 px — small</option>
                      <option value="360">360 px — chat friendly</option>
                      <option value="480">480 px — standard</option>
                      <option value="512">512 px — sticker</option>
                      <option value="720" disabled={!isPaid}>
                        720 px — HD{!isPaid ? ' (Pro)' : ''}
                      </option>
                      <option value="1024" disabled={!isPaid}>
                        1024 px — Full HD{!isPaid ? ' (Pro)' : ''}
                      </option>
                    </select>
                  </Section>
                )}

                {(format.id === 'gif' || format.id === 'discord') && (
                  <Section title="GIF quality">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { v: 256, label: 'Best' },
                        { v: 128, label: 'Balanced' },
                        { v: 64, label: 'Smallest' },
                      ].map((q) => (
                        <Choice key={q.v} active={gifColors === q.v} onClick={() => setGifColors(q.v)} className="py-2">
                          {q.label}
                          <span className="block text-[10px] text-slate-500 font-medium">{q.v} colours</span>
                        </Choice>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { v: 'none', label: 'Flat', hint: 'Crisp art' },
                        { v: 'ordered', label: 'Pattern', hint: 'Gradients' },
                        { v: 'fs', label: 'Smooth', hint: 'Photos' },
                      ].map((d) => (
                        <Choice key={d.v} active={gifDither === d.v} onClick={() => setGifDither(d.v)} className="py-2">
                          {d.label}
                          <span className="block text-[10px] text-slate-500 font-medium">{d.hint}</span>
                        </Choice>
                      ))}
                    </div>
                  </Section>
                )}

                <Section title="Background">
                  <div className="flex items-center gap-2">
                    <div className="grid grid-cols-4 gap-1.5 flex-1">
                      {BACKGROUNDS.map((b) => (
                        <Choice key={b.id} active={background === b.id} onClick={() => setBackground(b.id)} className="py-1.5">
                          {b.label}
                        </Choice>
                      ))}
                    </div>
                    <input
                      type="color"
                      value={background === 'transparent' ? '#ffffff' : background}
                      onChange={(e) => setBackground(e.target.value)}
                      className="size-8 rounded-lg bg-transparent border border-white/10 cursor-pointer"
                      title="Custom background colour"
                      aria-label="Custom background colour"
                    />
                  </div>
                </Section>

                <button
                  onClick={() => {
                    playPop();
                    setIsLooping(!isLooping);
                  }}
                  role="switch"
                  aria-checked={isLooping}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 w-full text-left"
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-white">
                    <Layers size={16} className="text-red-400" /> Loop forever
                  </span>
                  <span className={`w-11 h-6 rounded-full relative transition-colors ${isLooping ? 'bg-red-500' : 'bg-white/20'}`}>
                    <span className={`absolute top-1 size-4 bg-white rounded-full shadow-sm transition-all ${isLooping ? 'right-1' : 'left-1'}`} />
                  </span>
                </button>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Watermark</span>
                    <span className={`font-black ${isPaid ? 'text-green-400' : 'text-yellow-400'}`}>
                      {isPaid ? 'REMOVED' : 'APPLIED'}
                    </span>
                  </div>
                  {!isPaid && (
                    <p className="text-slate-500 text-[11px] mt-1">
                      Free exports carry a small AmiBuzz mark.{' '}
                      <button onClick={() => onNavigate('pricing')} className="text-red-400 font-bold hover:underline">
                        Upgrade to remove
                      </button>
                    </p>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};
