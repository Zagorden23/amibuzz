// Pure JavaScript PKZIP (Stored/Method 0) Archive Generator for AmiBuzz
// Supports 1-Click WhatsApp & Telegram Sticker Pack ZIP exports with zero external dependencies.

import { loadImage } from './stickerFx.js';
import { canEncodeWebp } from './webpAnimEncoder.js';

// Precomputed CRC32 Table
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c;
}

function calculateCRC32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Creates a valid ZIP archive Blob from an array of files.
 * @param {Array<{name: string, content: string|Uint8Array}>} files
 * @returns {Blob}
 */
export function createZipBlob(files) {
  const encoder = new TextEncoder();
  const fileRecords = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes =
      file.content instanceof Uint8Array
        ? file.content
        : typeof file.content === 'string'
        ? encoder.encode(file.content)
        : new Uint8Array(file.content);

    const crc = calculateCRC32(dataBytes);
    const size = dataBytes.length;

    // Local file header: 30 bytes + filename
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true); // Local header signature
    view.setUint16(4, 20, true);         // Version needed
    view.setUint16(6, 0, true);          // General flags
    view.setUint16(8, 0, true);          // Compression: 0 (Stored)
    view.setUint16(10, 0, true);         // Last mod time
    view.setUint16(12, 0, true);         // Last mod date
    view.setUint32(14, crc, true);        // CRC-32
    view.setUint32(18, size, true);       // Compressed size
    view.setUint32(22, size, true);       // Uncompressed size
    view.setUint16(26, nameBytes.length, true); // Filename length
    view.setUint16(28, 0, true);         // Extra field length
    localHeader.set(nameBytes, 30);

    fileRecords.push({
      nameBytes,
      dataBytes,
      crc,
      size,
      offset,
      localHeader,
    });

    offset += localHeader.length + dataBytes.length;
  }

  // Central Directory
  let centralDirSize = 0;
  const centralRecords = [];

  for (const rec of fileRecords) {
    const cdHeader = new Uint8Array(46 + rec.nameBytes.length);
    const view = new DataView(cdHeader.buffer);
    view.setUint32(0, 0x02014b50, true); // Central directory signature
    view.setUint16(4, 20, true);         // Version made by
    view.setUint16(6, 20, true);         // Version needed
    view.setUint16(8, 0, true);          // Flags
    view.setUint16(10, 0, true);         // Compression: 0
    view.setUint16(12, 0, true);         // Mod time
    view.setUint16(14, 0, true);         // Mod date
    view.setUint32(16, rec.crc, true);    // CRC-32
    view.setUint32(20, rec.size, true);   // Compressed size
    view.setUint32(24, rec.size, true);   // Uncompressed size
    view.setUint16(28, rec.nameBytes.length, true); // Filename len
    view.setUint16(30, 0, true);         // Extra field len
    view.setUint16(32, 0, true);         // Comment len
    view.setUint16(34, 0, true);         // Disk start
    view.setUint16(36, 0, true);         // Internal attrs
    view.setUint32(38, 0, true);         // External attrs
    view.setUint32(42, rec.offset, true); // Local header offset
    cdHeader.set(rec.nameBytes, 46);

    centralRecords.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  // End of Central Directory (EOCD): 22 bytes
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true);          // Disk number
  eocdView.setUint16(6, 0, true);          // Central dir disk
  eocdView.setUint16(8, fileRecords.length, true);  // Entries this disk
  eocdView.setUint16(10, fileRecords.length, true); // Total entries
  eocdView.setUint32(12, centralDirSize, true);     // Central dir size
  eocdView.setUint32(16, offset, true);             // Central dir offset
  eocdView.setUint16(20, 0, true);                  // Comment length

  const totalLength = offset + centralDirSize + eocd.length;
  const zipBytes = new Uint8Array(totalLength);
  let pos = 0;

  for (const rec of fileRecords) {
    zipBytes.set(rec.localHeader, pos);
    pos += rec.localHeader.length;
    zipBytes.set(rec.dataBytes, pos);
    pos += rec.dataBytes.length;
  }

  for (const cd of centralRecords) {
    zipBytes.set(cd, pos);
    pos += cd.length;
  }

  zipBytes.set(eocd, pos);

  return new Blob([zipBytes], { type: 'application/zip' });
}

/**
 * Renders a sticker into a square canvas (fitted, never stretched, with a
 * small margin as WhatsApp's guidelines ask) and encodes it.
 *
 * @param {string} src image URL or data URL
 * @param {number} size output edge in px
 * @param {Object} [options]
 * @param {'png'|'webp'} [options.format='png']
 * @param {number} [options.maxBytes] for WebP, lower the quality until it fits
 * @returns {Promise<Uint8Array>}
 */
export async function rasterizeStickerBytes(src, size = 512, options = {}) {
  const format = options.format || 'png';
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  try {
    const img = await loadImage(src);
    const pad = size * 0.03;
    const box = size - pad * 2;
    const scale = Math.min(box / img.naturalWidth, box / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  } catch {
    // Leave the square blank rather than failing the whole pack.
  }

  const encode = (type, quality) =>
    new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));

  if (format === 'webp') {
    for (const quality of [0.92, 0.8, 0.68, 0.55, 0.42, 0.3]) {
      const blob = await encode('image/webp', quality);
      if (!blob || blob.type !== 'image/webp') break; // browser can't encode WebP
      if (!options.maxBytes || blob.size <= options.maxBytes || quality === 0.3) {
        return new Uint8Array(await blob.arrayBuffer());
      }
    }
  }
  const png = await encode('image/png');
  return new Uint8Array(await png.arrayBuffer());
}

/**
 * Builds and triggers download of a full WhatsApp / Telegram sticker pack ZIP.
 * @param {string} packName
 * @param {Array<any>} stickers
 */
export async function downloadWhatsAppStickerPackZip(packName, stickers) {
  if (!stickers || stickers.length === 0) {
    throw new Error('No stickers in pack to export.');
  }

  const safePackId = packName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const files = [];

  // 1. Process each sticker to 512x512
  const stickerManifestList = [];
  const emojis = ['✨', '💖', '🔥', '🌸', '⚡', '🎉', '🐾', '⭐', '🌟', '💢', '💧', '😎'];

  // WhatsApp wants 512x512 WebP stickers of at most 100 KB each.
  const webp = canEncodeWebp();
  const ext = webp ? 'webp' : 'png';
  const list = stickers.slice(0, 30);

  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const fileName = `sticker_${String(i + 1).padStart(2, '0')}.${ext}`;
    const stickerBytes = await rasterizeStickerBytes(s.img, 512, { format: ext, maxBytes: 100 * 1024 });

    files.push({
      name: fileName,
      content: stickerBytes,
    });

    stickerManifestList.push({
      image_file: fileName,
      emojis: [emojis[i % emojis.length], emojis[(i + 1) % emojis.length]],
      title: s.name || `Sticker ${i + 1}`,
      style: s.stylePreset || 'Anime',
    });
  }

  // 2. Process Tray Icon (96x96 for WhatsApp / Telegram)
  const trayIconBytes = await rasterizeStickerBytes(stickers[0]?.img, 96);
  files.push({
    name: 'tray_icon.png',
    content: trayIconBytes,
  });

  // 3. Manifest JSON (WhatsApp Sticker Maker & Telegram format)
  const manifest = {
    android_play_store_url: '',
    ios_app_store_url: '',
    identifier: safePackId,
    name: packName,
    publisher: 'AmiBuzz Anime AI',
    publisher_website: 'https://amibuzz.onrender.com',
    privacy_policy_website: 'https://amibuzz.onrender.com',
    license_agreement_website: 'https://amibuzz.onrender.com',
    tray_image_file: 'tray_icon.png',
    image_data_version: '1',
    avoid_cache: false,
    publisher_email: 'support@amibuzz.app',
    stickers: stickerManifestList,
  };

  files.push({
    name: 'stickers.json',
    content: JSON.stringify(manifest, null, 2),
  });

  // 4. Telegram & WhatsApp quick import README
  const instructions = `================================================================
AMIBAZZ ANIME STICKER PACK: ${packName.toUpperCase()}
Generated with AmiBuzz AI Anime Sticker Maker
Website: https://amibuzz.onrender.com
================================================================

HOW TO USE IN WHATSAPP:
1. Import these sticker files with a "Sticker Maker" app for WhatsApp
   (Android: Sticker Maker by Viko & Co / iOS: Sticker.ly or Top Stickers).
2. Use 'tray_icon.png' as the pack tray thumbnail.
3. Tap "Add to WhatsApp" to chat with your custom stickers!
   WhatsApp packs need between 3 and 30 stickers.

HOW TO USE IN TELEGRAM:
1. Open Telegram and search for the official '@Stickers' bot.
2. Send /newpack, give your pack a name (e.g. "${packName}").
3. Send 'tray_icon.png' for the pack icon.
4. Send each sticker image (sticker_01, sticker_02...) as an uncompressed file.
5. Send /publish to get your permanent t.me/addstickers link!

Enjoy your elite custom anime stickers!
`;

  files.push({
    name: 'README.txt',
    content: instructions,
  });

  // Build ZIP
  const zipBlob = createZipBlob(files);

  // Trigger browser download
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safePackId || 'amibuzz-pack'}-whatsapp-telegram.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return { success: true, count: list.length };
}
