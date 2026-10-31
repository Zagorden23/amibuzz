// Pure JavaScript PKZIP (Stored/Method 0) Archive Generator for AmiBuzz
// Supports 1-Click WhatsApp & Telegram Sticker Pack ZIP exports with zero external dependencies.

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
 * Converts an image dataURL / URL into a 512x512 transparent PNG/WebP Uint8Array.
 * @param {string} src
 * @param {number} size
 * @returns {Promise<Uint8Array>}
 */
export async function rasterizeStickerBytes(src, size = 512) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);

      // Fit with padding
      const pad = size * 0.05;
      const drawSize = size - pad * 2;
      ctx.drawImage(img, pad, pad, drawSize, drawSize);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Canvas blob conversion failed'));
            return;
          }
          const buf = await blob.arrayBuffer();
          resolve(new Uint8Array(buf));
        },
        'image/png'
      );
    };
    img.onerror = () => {
      // Return 1x1 fallback
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.toBlob(async (b) => {
        const buf = await b.arrayBuffer();
        resolve(new Uint8Array(buf));
      });
    };
    img.src = src;
  });
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

  for (let i = 0; i < stickers.length; i++) {
    const s = stickers[i];
    const fileName = `sticker_${String(i + 1).padStart(2, '0')}.png`;
    const stickerBytes = await rasterizeStickerBytes(s.img, 512);

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
1. Transfer these .png files or import via the "Sticker Maker" app for WhatsApp
   (Android: Sticker Maker by Viko & Co / iOS: Sticker.ly or Top Stickers).
2. Use 'tray_icon.png' as the pack tray thumbnail.
3. Tap "Add to WhatsApp" to chat with your custom stickers!

HOW TO USE IN TELEGRAM:
1. Open Telegram and search for the official '@Stickers' bot.
2. Send /newpack, give your pack a name (e.g. "${packName}").
3. Send 'tray_icon.png' for the pack icon.
4. Send each sticker image (sticker_01.png, sticker_02.png...) as uncompressed files.
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
  URL.revokeObjectURL(url);

  return { success: true, count: stickers.length };
}
