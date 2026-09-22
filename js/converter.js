// Conversión de un archivo a WebP: decodificar → reescalar → codificar.
// No toca la UI: devuelve un resultado o lanza un Error con mensaje legible.

import { loadLib } from './loaders.js';
import { canvasToWebp, muxAnimatedWebp } from './webp.js';

const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/avif', 'image/heic', 'image/heif', 'image/tiff']);
// Por extensión también: al soltar carpetas, algunos sistemas dejan file.type vacío.
const EXT_REGEX = /\.(jpe?g|png|gif|bmp|avif|heic|heif|tiff?)$/i;

export const isConvertible = (file) => MIME_TYPES.has(file.type) || EXT_REGEX.test(file.name);
const isHeic = (file) => /^image\/hei[cf]$/.test(file.type) || /\.hei[cf]$/i.test(file.name);
const isTiff = (file) => file.type === 'image/tiff' || /\.tiff?$/i.test(file.name);
const isGif = (file) => file.type === 'image/gif' || /\.gif$/i.test(file.name);

// Reduce para caber en max×max manteniendo proporción (nunca amplía).
function fitWithin(width, height, max) {
  if (!(width >= 1) || !(height >= 1)) {
    throw new Error(`dimensiones inválidas (${width}×${height})`);
  }
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function drawScaled(source, { width, height }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // Con el suavizado por defecto ('low') una reducción grande sale con dientes.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

// HTMLImageElement aplica la orientación EXIF, igual que el navegador al mostrarla.
// onload en vez de img.decode(): decode() no resuelve con la pestaña en segundo
// plano, y la conversión se quedaba parada si el usuario cambiaba de pestaña.
function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('el navegador no pudo leer la imagen'));
    };
    img.src = url;
  });
}

async function decodeHeic(file) {
  const heic2any = await loadLib('heic2any');
  // PNG intermedio (sin pérdida) para no comprimir dos veces.
  const out = await heic2any({ blob: file, toType: 'image/png' });
  return loadImage(Array.isArray(out) ? out[0] : out);
}

async function decodeTiff(file) {
  const UTIF = await loadLib('UTIF');
  const buffer = await file.arrayBuffer();
  const [page] = UTIF.decode(buffer);
  if (!page) throw new Error('tiff sin imágenes');
  UTIF.decodeImage(buffer, page);
  const { width, height } = page;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(page)), width, height), 0, 0);
  return canvas;
}

async function convertStatic(source, srcWidth, srcHeight, { quality, maxDimension }) {
  const size = fitWithin(srcWidth, srcHeight, maxDimension);
  const blob = await canvasToWebp(drawScaled(source, size), quality);
  return { blob, originalDimensions: { width: srcWidth, height: srcHeight }, dimensions: size, frames: 1 };
}

// Retardos de 0–10 ms en GIF se reproducen a 100 ms en todos los navegadores.
function frameDurationMs(microseconds) {
  const ms = Math.round((microseconds ?? 0) / 1000);
  return ms > 10 ? ms : 100;
}

// GIF animado → WebP animado. Necesita ImageDecoder (WebCodecs), que da cada
// fotograma ya compuesto a tamaño completo. Devuelve null si no es animado o
// si el navegador no puede decodificarlo así (se convierte como estático).
async function convertAnimatedGif(file, options) {
  if (typeof ImageDecoder === 'undefined') return null;
  let decoder;
  try {
    if (!(await ImageDecoder.isTypeSupported('image/gif'))) return null;
    decoder = new ImageDecoder({ data: await file.arrayBuffer(), type: 'image/gif' });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    await decoder.completed;
    if (!track || track.frameCount <= 1) return null;

    const frames = [];
    let original;
    let size;
    for (let i = 0; i < track.frameCount; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      try {
        if (!size) {
          original = { width: image.displayWidth, height: image.displayHeight };
          size = fitWithin(original.width, original.height, options.maxDimension);
        }
        const blob = await canvasToWebp(drawScaled(image, size), options.quality);
        frames.push({ blob, duration: frameDurationMs(image.duration) });
      } finally {
        image.close();
      }
    }

    // repetitionCount = repeticiones tras la primera pasada; WebP cuenta pasadas totales.
    const reps = track.repetitionCount;
    const loopCount = reps === Infinity ? 0 : Math.min(reps + 1, 0xffff);
    const blob = await muxAnimatedWebp(frames, { ...size, loopCount });
    return { blob, originalDimensions: original, dimensions: size, frames: frames.length };
  } finally {
    decoder?.close();
  }
}

// options: { quality: 0–1, maxDimension: px }
export async function convertToWebp(file, options) {
  if (isTiff(file)) {
    const canvas = await decodeTiff(file);
    return convertStatic(canvas, canvas.width, canvas.height, options);
  }
  if (isGif(file)) {
    const animated = await convertAnimatedGif(file, options).catch(() => null);
    if (animated) return animated;
  }
  const img = isHeic(file) ? await decodeHeic(file) : await loadImage(file);
  return convertStatic(img, img.naturalWidth, img.naturalHeight, options);
}
