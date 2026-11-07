// Conversión de un archivo a WebP: decodificar → reescalar → codificar.
// No toca la UI: devuelve un resultado o lanza un Error con mensaje legible.

import { loadLib } from './loaders.js';
import { canvasToWebp, muxAnimatedWebp } from './webp.js';

// webp también: para bajar a 2000 px los que ya vienen en webp.
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/avif', 'image/webp', 'image/heic', 'image/heif', 'image/tiff']);
// Por extensión también: al soltar carpetas, algunos sistemas dejan file.type vacío.
const EXT_REGEX = /\.(jpe?g|png|gif|bmp|avif|webp|heic|heif|tiff?)$/i;

export const isConvertible = (file) => MIME_TYPES.has(file.type) || EXT_REGEX.test(file.name);
const isHeic = (file) => /^image\/hei[cf]$/.test(file.type) || /\.hei[cf]$/i.test(file.name);
const isTiff = (file) => file.type === 'image/tiff' || /\.tiff?$/i.test(file.name);
const isGif = (file) => file.type === 'image/gif' || /\.gif$/i.test(file.name);
const isWebp = (file) => file.type === 'image/webp' || /\.webp$/i.test(file.name);

// Mira la cabecera RIFF: si de verdad es WebP y si es animado (VP8X, bit 0x02).
async function sniffWebp(file) {
  const head = new Uint8Array(await file.slice(0, 21).arrayBuffer());
  const ascii = (from, to) => String.fromCharCode(...head.subarray(from, to));
  const real = head.length === 21 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  return { real, animated: real && ascii(12, 16) === 'VP8X' && (head[20] & 0x02) !== 0 };
}

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
  let out;
  try {
    // PNG intermedio (sin pérdida) para no comprimir dos veces.
    out = await heic2any({ blob: file, toType: 'image/png' });
  } catch {
    // Muchos .heic son JPEG con otra extensión ("already browser readable"),
    // y heic2any a veces rechaza con un string: probamos la carga normal.
    return loadImage(file).catch(() => {
      throw new Error('no se pudo leer el heic');
    });
  }
  return loadImage(Array.isArray(out) ? out[0] : out);
}

// Orientación EXIF/TIFF (tag 274) → transformación del canvas. De 5 a 8 se
// cambian ancho y alto.
const ORIENTATION = {
  2: (w, h) => [-1, 0, 0, 1, w, 0],
  3: (w, h) => [-1, 0, 0, -1, w, h],
  4: (w, h) => [1, 0, 0, -1, 0, h],
  5: () => [0, 1, 1, 0, 0, 0],
  6: (w, h) => [0, 1, -1, 0, h, 0],
  7: (w, h) => [0, -1, -1, 0, h, w],
  8: (w) => [0, -1, 1, 0, 0, w],
};

function orient(canvas, orientation) {
  const transform = ORIENTATION[orientation];
  if (!transform) return canvas;
  const { width: w, height: h } = canvas;
  const out = document.createElement('canvas');
  [out.width, out.height] = orientation >= 5 ? [h, w] : [w, h];
  const ctx = out.getContext('2d');
  ctx.setTransform(...transform(w, h));
  ctx.drawImage(canvas, 0, 0);
  return out;
}

async function decodeTiff(file) {
  const UTIF = await loadLib('UTIF');
  const buffer = await file.arrayBuffer();
  const [page] = UTIF.decode(buffer);
  if (!page) throw new Error('tiff sin imágenes');
  // TIFF con compresión JPEG y fotometría RGB (Photoshop): el decodificador de
  // UTIF lo trata como YCbCr y salen los colores cambiados. B es su
  // colorTransform (nombre minificado de utif@3.1.0, fijada con SRI); 0 = no
  // convertir.
  const jpegRgb = [6, 7].includes(page.t259?.[0]) && page.t262?.[0] === 2;
  const JpegDecoder = UTIF.JpegDecoder;
  if (jpegRgb) {
    UTIF.JpegDecoder = function () {
      const decoder = new JpegDecoder();
      decoder.B = 0;
      return decoder;
    };
  }
  try {
    UTIF.decodeImage(buffer, page);
  } finally {
    UTIF.JpegDecoder = JpegDecoder;
  }
  const { width, height } = page;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(page)), width, height), 0, 0);
  // UTIF no la aplica; el navegador sí la aplica a jpg/heic al mostrarlos.
  return orient(canvas, page.t274?.[0]);
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

// GIF o WebP animado → WebP animado. Necesita ImageDecoder (WebCodecs), que da
// cada fotograma ya compuesto a tamaño completo. Devuelve null si no es animado
// y lanza si el navegador no puede decodificarlo así (se convierte como estático).
async function convertAnimated(file, type, options) {
  if (typeof ImageDecoder === 'undefined') throw new Error('sin ImageDecoder');
  let decoder;
  try {
    if (!(await ImageDecoder.isTypeSupported(type))) throw new Error(`sin ImageDecoder para ${type}`);
    decoder = new ImageDecoder({ data: await file.arrayBuffer(), type });
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
  const webp = isWebp(file) ? await sniffWebp(file) : { real: false };
  const img = isHeic(file) ? await decodeHeic(file) : await loadImage(file);
  const size = { width: img.naturalWidth, height: img.naturalHeight };
  // Un WebP que ya cabe se devuelve tal cual: recomprimirlo sólo pierde calidad
  // (y un animado saldría fijo).
  if (webp.real && Math.max(size.width, size.height) <= options.maxDimension) {
    return { blob: file.slice(0, file.size, 'image/webp'), originalDimensions: size, dimensions: size, frames: 1, untouched: true };
  }
  // stillFallback: no se pudo convertir como animado; sale el primer fotograma.
  let stillFallback = false;
  if (isGif(file) || webp.animated) {
    try {
      const animated = await convertAnimated(file, webp.animated ? 'image/webp' : 'image/gif', options);
      if (animated) return animated;
    } catch {
      stillFallback = true;
    }
  }
  return { ...(await convertStatic(img, size.width, size.height, options)), stillFallback };
}
