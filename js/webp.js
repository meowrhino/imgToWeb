// Codificación WebP con canvas y montaje de WebP animados.

let encodingSupported;

// WebKit (Safari en Mac, y TODOS los navegadores de iPhone/iPad) no sabe
// codificar WebP en canvas: ignora 'image/webp' y devuelve PNG en silencio.
export function supportsWebpEncoding() {
  if (encodingSupported === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    encodingSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return encodingSupported;
}

export function canvasToWebp(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('el navegador no pudo codificar la imagen'));
      // Nunca descargar un PNG disfrazado de .webp.
      else if (blob.type !== 'image/webp') reject(new Error('tu navegador no sabe exportar a WebP'));
      else resolve(blob);
    }, 'image/webp', quality);
  });
}

// ---------------------------------------------------------------------------
// WebP animado
// ---------------------------------------------------------------------------
// canvas sólo produce WebP estáticos, así que cada fotograma se codifica por
// separado y luego se empaquetan en un contenedor RIFF animado a mano
// (VP8X + ANIM + un ANMF por fotograma). Formato:
// https://developers.google.com/speed/webp/docs/riff_container

const FLAG_ALPHA = 0x10;
const FLAG_ANIMATION = 0x02;
const ANMF_NO_BLEND = 0x02; // cada fotograma es completo y sustituye al anterior

const fourcc = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));

function writeU24(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function makeChunk(id, payload) {
  const padded = payload.length + (payload.length & 1);
  const chunk = new Uint8Array(8 + padded);
  chunk.set(fourcc(id), 0);
  new DataView(chunk.buffer).setUint32(4, payload.length, true);
  chunk.set(payload, 8);
  return chunk;
}

// Extrae de un WebP estático los chunks de imagen (ALPH + VP8, o VP8L),
// con cabecera y relleno incluidos, que es lo que va dentro de un ANMF.
async function readImageChunks(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const chunks = [];
  let hasAlpha = false;
  let offset = 12; // 'RIFF' + tamaño + 'WEBP'
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    const end = Math.min(offset + 8 + size + (size & 1), bytes.length);
    if (id === 'ALPH' || id === 'VP8 ' || id === 'VP8L') {
      chunks.push(bytes.subarray(offset, end));
      if (id !== 'VP8 ') hasAlpha = true;
    }
    offset = end;
  }
  if (!chunks.length) throw new Error('fotograma WebP inválido');
  return { data: concat(chunks), hasAlpha };
}

// frames: [{ blob: WebP estático, duration: ms }], todos de width×height.
// loopCount: 0 = infinito.
export async function muxAnimatedWebp(frames, { width, height, loopCount = 0 }) {
  let hasAlpha = false;
  const anmfChunks = [];
  for (const { blob, duration } of frames) {
    const frame = await readImageChunks(blob);
    hasAlpha ||= frame.hasAlpha;
    const header = new Uint8Array(16); // offset X/Y = 0
    writeU24(header, 6, width - 1);
    writeU24(header, 9, height - 1);
    writeU24(header, 12, Math.min(duration, 0xffffff));
    header[15] = ANMF_NO_BLEND;
    anmfChunks.push(makeChunk('ANMF', concat([header, frame.data])));
  }

  const vp8x = new Uint8Array(10);
  vp8x[0] = FLAG_ANIMATION | (hasAlpha ? FLAG_ALPHA : 0);
  writeU24(vp8x, 4, width - 1);
  writeU24(vp8x, 7, height - 1);

  const anim = new Uint8Array(6); // fondo transparente (BGRA 0,0,0,0)
  new DataView(anim.buffer).setUint16(4, Math.min(loopCount, 0xffff), true);

  const body = concat([fourcc('WEBP'), makeChunk('VP8X', vp8x), makeChunk('ANIM', anim), ...anmfChunks]);
  const riffHeader = new Uint8Array(8);
  riffHeader.set(fourcc('RIFF'), 0);
  new DataView(riffHeader.buffer).setUint32(4, body.length, true);
  return new Blob([riffHeader, body], { type: 'image/webp' });
}
