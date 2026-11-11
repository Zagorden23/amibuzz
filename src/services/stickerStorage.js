// Persistent Sticker & Pack Storage for AmiBuzz
// Supports LocalStorage with transparent Cloud Firestore synchronization for signed-in accounts.

import { db } from '../firebase.js';
import { collection, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

const STORAGE_KEY = 'amibuzz_stickers_v2';
const PACKS_KEY = 'amibuzz_packs_v2';

export const INITIAL_STICKERS = [
  {
    id: 'sample-1',
    name: 'Winking Chibi Fox',
    prompt: 'Chibi kitsune girl with fluffy orange fox ears winking happily, rosy blush, thick white sticker border',
    stylePreset: 'Kawaii Chibi',
    time: '1 hour ago',
    animated: true,
    animationStyle: 'Kawaii Bounce',
    img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
    tags: ['Chibi', 'Fox', 'Wink', 'Kawaii'],
    isFavorite: true,
    packId: 'pack-chibi',
    createdAt: Date.now() - 3600000,
  },
  {
    id: 'sample-2',
    name: 'Neon Cyber Samurai',
    prompt: 'Cyberpunk male anime samurai in neon battle armor with glowing cyan katana blade and visor',
    stylePreset: 'Cyberpunk Neon',
    time: '3 hours ago',
    animated: false,
    animationStyle: 'Neon Glitch',
    img: 'https://images.unsplash.com/photo-1580477667995-2b94f01c9516?auto=format&fit=crop&w=600&q=80',
    tags: ['Cyberpunk', 'Samurai', 'Neon'],
    isFavorite: true,
    packId: 'pack-cyber',
    createdAt: Date.now() - 10800000,
  },
  {
    id: 'sample-3',
    name: 'Steaming Ramen Cat',
    prompt: 'Cute calico cat in chef hat slurping a giant steaming bowl of tonkotsu ramen with chopsticks',
    stylePreset: 'Kawaii Chibi',
    time: 'Yesterday',
    animated: true,
    animationStyle: 'Floating Magic',
    img: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80',
    tags: ['Cat', 'Ramen', 'Food', 'Cute'],
    isFavorite: false,
    packId: 'pack-gaming',
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'sample-4',
    name: 'Shonen Power Surge',
    prompt: 'Anime hero surrounded by fiery golden aura screaming in battle mode, dynamic manga speed lines',
    stylePreset: 'Shonen Battle',
    time: '2 days ago',
    animated: true,
    animationStyle: 'Rage Shake',
    img: 'https://images.unsplash.com/photo-1541562232579-512a21360020?auto=format&fit=crop&w=600&q=80',
    tags: ['Shonen', 'Battle', 'Fire', 'Power'],
    isFavorite: true,
    packId: 'pack-reactions',
    createdAt: Date.now() - 172800000,
  },
  {
    id: 'sample-5',
    name: 'Pastel Dream Bunny',
    prompt: 'Soft watercolor bunny girl wearing lavender beret holding a star wand with floating cherry blossoms',
    stylePreset: 'Studio Watercolor',
    time: '3 days ago',
    animated: false,
    animationStyle: 'Floating Magic',
    img: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?auto=format&fit=crop&w=600&q=80',
    tags: ['Bunny', 'Pastel', 'Watercolor'],
    isFavorite: false,
    packId: 'pack-chibi',
    createdAt: Date.now() - 259200000,
  },
  {
    id: 'sample-6',
    name: 'Gamer Girl Neko',
    prompt: 'Anime girl with cat ear RGB headset drinking bubble tea with gaming controller badge',
    stylePreset: 'Retro 90s Cel',
    time: '4 days ago',
    animated: true,
    animationStyle: 'Heartbeat Pulse',
    img: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?auto=format&fit=crop&w=600&q=80',
    tags: ['Gamer', 'Neko', 'RGB', '90s'],
    isFavorite: true,
    packId: 'pack-gaming',
    createdAt: Date.now() - 345600000,
  },
];

export const INITIAL_PACKS = [
  { id: 'pack-chibi', name: 'Chibi Reactions', count: 2, icon: 'Smile' },
  { id: 'pack-cyber', name: 'Cyber Squad', count: 1, icon: 'Zap' },
  { id: 'pack-gaming', name: 'Gaming & Boba', count: 2, icon: 'Gamepad2' },
  { id: 'pack-reactions', name: 'Shonen Energy', count: 1, icon: 'Flame' },
];

export function getStoredStickers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STICKERS));
      return INITIAL_STICKERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_STICKERS;
  } catch {
    return INITIAL_STICKERS;
  }
}

export function saveStickerToStorage(sticker, user = null) {
  const current = getStoredStickers();
  const normalized = {
    ...sticker,
    id: sticker.id || `sticker-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    createdAt: sticker.createdAt || Date.now(),
    time: 'Just now',
    isFavorite: Boolean(sticker.isFavorite),
  };

  const updated = persistStickers([normalized, ...current.filter((s) => s.id !== normalized.id)]);

  // Sync to Firestore if authenticated (documents are capped at 1 MiB).
  if (canSync(user)) {
    try {
      const record = JSON.stringify(normalized).length > 900_000 ? { ...normalized, cutout: null } : normalized;
      const stickerRef = doc(db, 'users', user.uid, 'stickers', String(normalized.id));
      setDoc(stickerRef, record, { merge: true }).catch(() => {});
    } catch {}
  }

  return updated;
}

// Local creator sessions (demo / fallback OAuth) have no Firestore access.
const canSync = (user) => Boolean(user?.uid && db && !/^(demo|google|ms|apple|email|sms)-/.test(user.uid));

/**
 * Writes the sticker list, making room when the browser's storage is full:
 * first the re-editable cut-outs of the oldest stickers are dropped, then the
 * oldest stickers themselves. The newest sticker is always kept.
 * @returns {Array} the list that was actually stored
 */
function persistStickers(list) {
  let working = list.slice();
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(working));
      return working;
    } catch (err) {
      const withCutout = working.map((s, i) => (s.cutout ? i : -1)).filter((i) => i > 0);
      if (withCutout.length) {
        const i = withCutout[withCutout.length - 1];
        working[i] = { ...working[i], cutout: null };
      } else if (working.length > 1) {
        working = working.slice(0, -1);
      } else {
        console.warn('Sticker could not be saved locally:', err);
        return working;
      }
    }
  }
  return working;
}

export function updateStickerInStorage(id, updates, user = null) {
  const current = getStoredStickers();
  const updated = persistStickers(current.map((s) => (s.id === id ? { ...s, ...updates } : s)));

  if (canSync(user)) {
    try {
      const stickerRef = doc(db, 'users', user.uid, 'stickers', String(id));
      updateDoc(stickerRef, updates).catch(() => {});
    } catch {}
  }

  return updated;
}

export function deleteStickerFromStorage(id, user = null) {
  const current = getStoredStickers();
  const updated = persistStickers(current.filter((s) => s.id !== id));

  if (canSync(user)) {
    try {
      const stickerRef = doc(db, 'users', user.uid, 'stickers', String(id));
      deleteDoc(stickerRef).catch(() => {});
    } catch {}
  }

  return updated;
}

export function getStoredPacks() {
  try {
    const raw = localStorage.getItem(PACKS_KEY);
    if (!raw) {
      localStorage.setItem(PACKS_KEY, JSON.stringify(INITIAL_PACKS));
      return INITIAL_PACKS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_PACKS;
  } catch {
    return INITIAL_PACKS;
  }
}

export function createStickerPack(name, icon = 'Layers') {
  const current = getStoredPacks();
  const newPack = {
    id: `pack-${Date.now()}`,
    name: name.trim(),
    icon,
    count: 0,
  };
  const updated = [...current, newPack];
  try {
    localStorage.setItem(PACKS_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

/**
 * Creates a high-resolution printable sticker sheet (A4 proportion, 2480x3508 pixels)
 * with a grid of die-cut anime stickers ready to print on sticker paper!
 */
export async function createPrintableStickerSheet(stickers, title = 'AmiBuzz Anime Sticker Collection') {
  const canvas = document.createElement('canvas');
  // High-res printable sheet (A4 aspect ~ 1 : 1.414)
  const width = 1800;
  const height = 2400;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Decorative border
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 12;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 12]);
  ctx.strokeRect(55, 55, width - 110, height - 110);
  ctx.setLineDash([]);

  // Header Banner
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(40, 40, width - 80, 160);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AmiBuzz ★ Anime Sticker Sheet', width / 2, 115);

  ctx.fillStyle = '#fef2f2';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`${title} • Peel & Stick Print Edition`, width / 2, 165);

  // Footer instructions
  ctx.fillStyle = '#94a3b8';
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Print on glossy sticker paper at 100% scale • Cut along dashed contours • Created on AmiBuzz.app', width / 2, height - 60);

  // Layout grid of stickers (up to 9 stickers: 3 cols x 3 rows)
  const items = stickers.slice(0, 9);
  const cols = 3;
  const rows = Math.ceil(items.length / cols) || 1;
  const startX = 100;
  const startY = 250;
  const gridWidth = width - 200;
  const gridHeight = height - 360;
  const colWidth = gridWidth / cols;
  const rowHeight = gridHeight / 3;

  for (let i = 0; i < items.length; i++) {
    const s = items[i];
    const c = i % cols;
    const r = Math.floor(i / cols);
    const cellX = startX + c * colWidth;
    const cellY = startY + r * rowHeight;
    const boxSize = Math.min(colWidth, rowHeight) - 40;
    const centerX = cellX + colWidth / 2;
    const centerY = cellY + rowHeight / 2 - 20;

    // Load sticker image
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => {
          const fb = new Image();
          fb.onload = res;
          fb.onerror = rej;
          fb.src = s.img;
        };
        img.src = s.img;
      });

      // Die-cut stickers already carry their cut border; just fit them in.
      const scale = Math.min(boxSize / img.naturalWidth, boxSize / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;
      ctx.drawImage(img, centerX - w / 2, centerY - h / 2, w, h);
      ctx.restore();

      // Label below
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.name || `Sticker #${i + 1}`, centerX, centerY + boxSize / 2 + 35);
    } catch (e) {
      console.warn('Failed to load image for sheet:', s.img);
    }
  }

  return canvas.toDataURL('image/png');
}
