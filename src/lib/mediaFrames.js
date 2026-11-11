// Media loading for the GIF Lab: turns "any image or video" into frames.
//
//   still image (PNG/JPG/WebP/SVG/AVIF/BMP…)  -> one canvas
//   animated GIF                              -> frames via our own decoder
//   animated WebP / APNG                      -> frames via ImageDecoder when
//                                                the browser has it
//   video (MP4/WebM/MOV… whatever plays)      -> frames grabbed by seeking
//   several images                            -> a slideshow clip

import { decodeGif, isGif } from './gifDecoder.js';
import { createCanvas, loadImage } from './stickerFx.js';

export const MAX_CLIP_FRAMES = 240;
export const WORK_SIZE = 640; // longest edge kept in memory per frame

const fitScale = (w, h, maxSize) => Math.min(1, maxSize / Math.max(w, h));

function sniffKind(file, head) {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (isGif(head)) return 'gif';
  if (type.startsWith('video/') || /\.(mp4|m4v|mov|webm|mkv|ogv|avi|3gp)$/.test(name)) return 'video';
  if (type === 'image/webp' || type === 'image/apng' || type === 'image/png' || type === 'image/avif') return 'maybe-animated';
  return 'image';
}

/** Draws a frame-like source into a fresh canvas no larger than `maxSize`. */
function snapshot(source, sw, sh, maxSize) {
  const scale = fitScale(sw, sh, maxSize);
  const canvas = createCanvas(sw * scale, sh * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function decodeGifFrames(bytes, maxSize) {
  const frames = [];
  let stage = null;
  let image = null;
  let truncated = false;
  const info = decodeGif(bytes, {
    maxFrames: MAX_CLIP_FRAMES + 1,
    onFrame: ({ data, delay, index, width, height }) => {
      if (index >= MAX_CLIP_FRAMES) {
        truncated = true;
        return;
      }
      if (!stage) {
        stage = createCanvas(width, height);
        image = new ImageData(width, height);
      }
      image.data.set(data);
      stage.getContext('2d').putImageData(image, 0, 0);
      frames.push({ canvas: snapshot(stage, width, height, maxSize), delay });
    },
  });
  return { frames, width: info.width, height: info.height, truncated };
}

/** Animated WebP / APNG / AVIF through the WebCodecs ImageDecoder, if present. */
async function decodeWithImageDecoder(file, maxSize) {
  if (typeof ImageDecoder === 'undefined' || !file.type) return null;
  try {
    if (!(await ImageDecoder.isTypeSupported(file.type))) return null;
    const decoder = new ImageDecoder({ data: await file.arrayBuffer(), type: file.type });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    if (!track || !track.animated || track.frameCount < 2) {
      decoder.close();
      return null;
    }
    const count = Math.min(track.frameCount, MAX_CLIP_FRAMES);
    const frames = [];
    let width = 0;
    let height = 0;
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      width = image.displayWidth;
      height = image.displayHeight;
      frames.push({
        canvas: snapshot(image, width, height, maxSize),
        delay: Math.max(20, Math.round((image.duration || 100000) / 1000)),
      });
      image.close();
    }
    decoder.close();
    return { frames, width, height, truncated: track.frameCount > count };
  } catch {
    return null;
  }
}

/**
 * Opens a video file for frame extraction.
 * @returns {Promise<{video: HTMLVideoElement, url: string, duration: number, width: number, height: number}>}
 */
export function openVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This browser can't play that video format. Try MP4 (H.264) or WebM."));
    };
    video.onerror = fail;
    video.onloadedmetadata = async () => {
      try {
        // Some WebM recordings report an infinite duration until seeked to the end.
        if (!Number.isFinite(video.duration)) {
          await new Promise((done) => {
            video.ontimeupdate = () => {
              video.ontimeupdate = null;
              done();
            };
            video.currentTime = 1e7;
          });
          video.currentTime = 0;
        }
        if (!video.videoWidth || !Number.isFinite(video.duration) || video.duration <= 0) return fail();
        resolve({ video, url, duration: video.duration, width: video.videoWidth, height: video.videoHeight });
      } catch {
        fail();
      }
    };
    video.src = url;
  });
}

const seekTo = (video, time) =>
  new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      clearTimeout(timer);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('The video could not be read at that position.'));
    };
    // A seek to the current position never fires "seeked"; don't hang on it.
    const timer = setTimeout(onSeeked, 4000);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });

/**
 * Grabs evenly spaced frames from an opened video.
 *
 * @param {HTMLVideoElement} video from `openVideo`
 * @param {Object} options
 * @param {number} options.start seconds
 * @param {number} options.end seconds
 * @param {number} options.fps frames per second to sample
 * @param {number} [options.maxSize=WORK_SIZE]
 * @param {(progress: number) => void} [options.onProgress]
 * @param {() => boolean} [options.isCancelled]
 * @returns {Promise<Array<{canvas: HTMLCanvasElement, delay: number}>>}
 */
export async function extractVideoFrames(video, options) {
  const { fps } = options;
  const maxSize = options.maxSize ?? WORK_SIZE;
  const start = Math.max(0, options.start);
  const end = Math.min(video.duration, Math.max(start + 1 / fps, options.end));
  const count = Math.max(1, Math.min(MAX_CLIP_FRAMES, Math.round((end - start) * fps)));
  const delay = 1000 / fps;
  const frames = [];

  for (let i = 0; i < count; i++) {
    if (options.isCancelled?.()) throw new DOMException('Cancelled', 'AbortError');
    // Sample mid-frame and stay clear of the very end, where some decoders
    // hand back nothing.
    const time = Math.min(start + (i + 0.5) / fps, Math.max(0, video.duration - 0.04));
    await seekTo(video, time);
    frames.push({ canvas: snapshot(video, video.videoWidth, video.videoHeight, maxSize), delay });
    options.onProgress?.((i + 1) / count);
  }
  return frames;
}

/**
 * Loads one file into something the GIF Lab can work with.
 *
 * @param {File|Blob} file
 * @param {Object} [options]
 * @param {number} [options.maxSize=WORK_SIZE]
 * @returns {Promise<
 *   {kind: 'still', canvas: HTMLCanvasElement, width: number, height: number} |
 *   {kind: 'clip', origin: 'gif'|'animated-image', frames: Array<{canvas: HTMLCanvasElement, delay: number}>, width: number, height: number, truncated: boolean} |
 *   {kind: 'video', video: HTMLVideoElement, url: string, duration: number, width: number, height: number}
 * >}
 */
export async function loadMedia(file, options = {}) {
  const maxSize = options.maxSize ?? WORK_SIZE;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const kind = sniffKind(file, head);

  if (kind === 'video') {
    return { kind: 'video', ...(await openVideo(file)) };
  }

  if (kind === 'gif') {
    const decoded = decodeGifFrames(new Uint8Array(await file.arrayBuffer()), maxSize);
    if (decoded.frames.length > 1) return { kind: 'clip', origin: 'gif', ...decoded };
    return { kind: 'still', canvas: decoded.frames[0].canvas, width: decoded.width, height: decoded.height };
  }

  if (kind === 'maybe-animated') {
    const decoded = await decodeWithImageDecoder(file, maxSize);
    if (decoded) return { kind: 'clip', origin: 'animated-image', ...decoded };
  }

  let image;
  try {
    image = await loadImage(file);
  } catch {
    throw new Error("That file isn't an image or video this browser can open.");
  }
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error('That image has no size (SVGs need a width and height).');
  // Stills keep more resolution than clip frames: there is only one of them.
  return { kind: 'still', canvas: snapshot(image, width, height, Math.max(maxSize, 1024)), width, height };
}

/**
 * Builds a slideshow clip from several still images. Every slide is fitted
 * (letterboxed on transparency) into the first image's proportions.
 *
 * @param {Array<File|Blob>} files
 * @param {Object} [options]
 * @param {number} [options.delay=500] ms per slide
 * @param {number} [options.maxSize=WORK_SIZE]
 */
export async function loadSlideshow(files, options = {}) {
  const maxSize = options.maxSize ?? WORK_SIZE;
  const delay = options.delay ?? 500;
  const images = [];
  for (const file of files.slice(0, MAX_CLIP_FRAMES)) {
    try {
      images.push(await loadImage(file));
    } catch {
      // Skip anything that isn't a readable image.
    }
  }
  if (images.length === 0) throw new Error('None of those files could be opened as images.');

  const scale = fitScale(images[0].naturalWidth, images[0].naturalHeight, maxSize);
  const width = Math.max(1, Math.round(images[0].naturalWidth * scale));
  const height = Math.max(1, Math.round(images[0].naturalHeight * scale));

  const frames = images.map((img) => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    const s = Math.min(width / img.naturalWidth, height / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
    return { canvas, delay };
  });
  return { kind: 'clip', origin: 'slideshow', frames, width, height, truncated: files.length > frames.length };
}
