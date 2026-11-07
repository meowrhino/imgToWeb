// Vista "convertir a webp": cola de conversión, tarjetas, reordenado y descargas.

import { convertToWebp, isConvertible } from './converter.js';
import { setupDropzone } from './dropzone.js';
import { fileKey } from './files.js';
import { notify } from './notify.js';
import { makeSortable, reorderById } from './sortable.js';
import { supportsWebpEncoding } from './webp.js';
import { downloadZip } from './zip.js';
import { downloadUrl, escapeHtml, formatSize, plural, stripExtension } from './utils.js';

const MAX_DIMENSION = 2000;

const $ = (id) => document.getElementById(id);
const dom = {
  view: $('viewConvert'),
  uploadArea: $('uploadArea'),
  fileInput: $('fileInput'),
  selectBtn: $('selectBtn'),
  folderInput: $('folderInput'),
  folderBtn: $('folderBtn'),
  uploadHint: $('uploadHint'),
  quality: $('qualitySelect'),
  container: $('imagesContainer'),
  list: $('imagesList'),
  count: $('imageCount'),
  sequential: $('sequentialRename'),
  downloadAll: $('downloadAllBtn'),
  clear: $('clearImagesBtn'),
  progress: $('progressContainer'),
  progressBar: $('progressBar'),
  progressFill: $('progressFill'),
  progressText: $('progressText'),
  progressCount: $('progressCount'),
  progressFailed: $('progressFailed'),
  progressClose: $('progressClose'),
};

const state = {
  images: [], // en el orden que se ve y se exporta
  quality: Number(dom.quality.value),
  sequentialNames: dom.sequential.checked,
};

let nextId = 1;

// ---------------------------------------------------------------------------
// Nombres de salida (una sola fuente de verdad para tarjetas, descarga y ZIP)
// ---------------------------------------------------------------------------

function computeNames() {
  const names = new Map();
  const used = new Set();
  state.images.forEach((img, i) => {
    if (state.sequentialNames) {
      names.set(img.id, `${i + 1}.webp`);
      return;
    }
    const base = stripExtension(img.originalName) || 'imagen';
    let name = `${base}.webp`;
    // Comparación sin mayúsculas: en macOS/Windows "A.webp" y "a.webp" chocan.
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}-${n}.webp`;
    used.add(name.toLowerCase());
    names.set(img.id, name);
  });
  return names;
}

function refresh() {
  const n = state.images.length;
  dom.container.hidden = n === 0;
  dom.count.textContent = plural(n, 'imagen convertida', 'imágenes convertidas');
  const names = computeNames();
  for (const card of dom.list.children) {
    const nameEl = card.querySelector('.image-name');
    const name = names.get(Number(card.dataset.id));
    nameEl.textContent = name;
    nameEl.title = name;
  }
}

// ---------------------------------------------------------------------------
// Progreso
// ---------------------------------------------------------------------------

let hideProgressTimer;

// Las que fallan se quedan apuntadas abajo, fijas, hasta el próximo lote o
// vaciar (o la ×): el aviso de esquina dura 3 s y la numeración se corre sin ellas.
function showProgress() {
  clearTimeout(hideProgressTimer);
  const { done, total, failed } = queue;
  const pct = total ? Math.round((done / total) * 100) : 0;
  dom.progress.hidden = false;
  dom.progressFill.style.width = `${pct}%`;
  dom.progressCount.textContent = `${done}/${total}`;
  if (done < total) dom.progressText.textContent = 'convirtiendo...';
  else dom.progressText.textContent = failed.length ? `${done - failed.length} de ${total} convertidas` : 'completado';
  dom.progressFailed.hidden = !failed.length;
  // Agrupadas por motivo: 40 rotas con el mismo error no repiten 40 veces el texto.
  const byReason = new Map();
  for (const { name, reason } of failed) byReason.set(reason, [...(byReason.get(reason) || []), name]);
  const list = [...byReason].map(([reason, names]) => `${names.join(', ')} (${reason})`).join('; ');
  dom.progressFailed.textContent = `${failed.length === 1 ? 'falló' : 'fallaron'}: ${list}`;
  // Si fallan todas no hay rejilla ni "vaciar": sin esto el resumen no se cierra.
  dom.progressClose.hidden = done < total;
  dom.progressBar.setAttribute('aria-valuenow', pct);
  syncDownloadAll();
}

function hideProgress() {
  clearTimeout(hideProgressTimer);
  dom.progress.hidden = true;
  dom.progressFill.style.width = '0%';
  dom.progressBar.setAttribute('aria-valuenow', 0);
}

// Mientras la cola trabaja, el ZIP saldría incompleto.
function syncDownloadAll() {
  const left = queue.total - queue.done;
  dom.downloadAll.disabled = left > 0;
  dom.downloadAll.textContent = left > 0 ? `descargar todo (faltan ${left})` : 'descargar todo (zip)';
}

// ---------------------------------------------------------------------------
// Cola de conversión
// ---------------------------------------------------------------------------
// Todos los lotes (selector, drop, pegar) pasan por una única cola que procesa
// de uno en uno. Cada imagen se añade en cuanto termina, así el DOM y
// state.images nunca se desincronizan aunque lleguen lotes a la vez o el
// usuario borre/reordene mientras se convierte.

const queue = {
  pending: [], // [{ file, quality, generation }]
  current: null, // el que se está convirtiendo
  done: 0,
  total: 0,
  failed: [], // [{ name, reason }] de las que fallaron en este lote
  running: false,
  generation: 0, // se incrementa al vaciar: descarta lo que estaba en vuelo
};

function addFiles(files) {
  if (!supportsWebpEncoding()) {
    notify('tu navegador no sabe exportar a WebP (Safari / iPhone). usa Chrome, Firefox o Edge.', 'error');
    return 0;
  }
  const valid = files.filter(isConvertible);
  const skipped = files.length - valid.length;
  if (!valid.length) {
    notify('formato no soportado. usa jpg, png, gif, bmp, avif, webp, heic o tiff', 'error');
    return 0;
  }
  if (skipped) notify(`${plural(skipped, 'archivo ignorado', 'archivos ignorados')} (formato no soportado)`, 'info');

  const seen = new Set([...state.images.map((img) => img.key), ...queue.pending.map((job) => fileKey(job.file))]);
  // La que está en vuelo de un lote ya vaciado no cuenta: se va a descartar.
  if (queue.current?.generation === queue.generation) seen.add(fileKey(queue.current.file));
  const fresh = [];
  for (const file of valid) {
    if (seen.has(fileKey(file))) continue;
    seen.add(fileKey(file));
    fresh.push(file);
  }
  const repeated = valid.length - fresh.length;
  if (repeated) notify(`${plural(repeated, 'imagen repetida ignorada', 'imágenes repetidas ignoradas')} (ya estaba en la lista)`, 'info');
  if (!fresh.length) return 0;

  // Lote nuevo tras uno terminado: el resumen anterior se va.
  if (!queue.running) {
    queue.done = queue.total = 0;
    queue.failed = [];
  }
  for (const file of fresh) {
    queue.pending.push({ file, quality: state.quality, generation: queue.generation });
  }
  queue.total += fresh.length;
  showProgress();
  if (!queue.running) runQueue();
  return fresh.length;
}

async function runQueue() {
  queue.running = true;
  while (queue.pending.length) {
    const job = (queue.current = queue.pending.shift());
    let result = null;
    try {
      result = await convertToWebp(job.file, { quality: job.quality, maxDimension: MAX_DIMENSION });
    } catch (err) {
      // Sin aviso por archivo (40 rotas = 40 avisos): el motivo va en la lista fija.
      if (job.generation === queue.generation) queue.failed.push({ name: job.file.name, reason: err?.message || String(err) });
    }
    queue.current = null;
    if (job.generation !== queue.generation) continue; // se vació mientras tanto
    if (result) addImage(job, result);
    queue.done++;
    showProgress();
  }
  queue.running = false;
  if (!queue.failed.length) hideProgressTimer = setTimeout(hideProgress, 1500);
  else notify(`${plural(queue.failed.length, 'imagen no se pudo convertir', 'imágenes no se pudieron convertir')}: mira la lista de arriba`, 'error');
}

function addImage({ file, quality }, result) {
  const image = {
    id: nextId++,
    key: fileKey(file),
    originalName: file.name,
    originalSize: file.size,
    lastModified: file.lastModified,
    originalDimensions: result.originalDimensions,
    dimensions: result.dimensions,
    frames: result.frames,
    stillFallback: result.stillFallback,
    untouched: result.untouched,
    blob: result.blob,
    quality: Math.round(quality * 100),
    previewUrl: URL.createObjectURL(result.blob),
  };
  state.images.push(image);
  dom.list.appendChild(createCard(image));
  refresh();
}

// ---------------------------------------------------------------------------
// Tarjetas
// ---------------------------------------------------------------------------

function statRow(label, value, valueClass = '') {
  return `<div class="stat-row">
      <span class="stat-label">${label}</span>
      <span class="stat-value ${valueClass}">${value}</span>
    </div>`;
}

function createCard(image) {
  const { originalDimensions: from, dimensions: to } = image;
  const resized = from.width !== to.width || from.height !== to.height;
  const savings = image.originalSize ? (1 - image.blob.size / image.originalSize) * 100 : 0;

  const card = document.createElement('div');
  card.className = 'image-card';
  card.dataset.id = image.id;
  card.innerHTML = `
    <div class="image-preview">
      <img src="${image.previewUrl}" alt="" loading="lazy" decoding="async">
    </div>
    <div class="image-info">
      <div class="image-name"></div>
      <div class="image-stats">
        ${statRow('dimensiones', resized ? `${from.width}×${from.height} → ${to.width}×${to.height}` : `${to.width}×${to.height}`)}
        ${image.frames > 1 ? statRow('animación', `${image.frames} fotogramas`) : ''}
        ${image.stillFallback ? statRow('animación', 'convertido como imagen fija', 'stat-negative') : ''}
        ${statRow('original', formatSize(image.originalSize))}
        ${image.untouched
          ? statRow('webp', 'ya estaba bien: sin tocar')
          : statRow('webp', formatSize(image.blob.size)) + statRow('calidad', `${image.quality}%`) + (savings >= 0
            ? statRow('ahorro', `${savings.toFixed(1)} %`, 'stat-savings')
            : statRow('tamaño', `${Math.abs(savings).toFixed(1)} % más grande`, 'stat-negative'))}
      </div>
      <div class="card-actions">
        <button type="button" class="btn-download">descargar</button>
        <button type="button" class="btn-remove" title="eliminar" aria-label="eliminar ${escapeHtml(image.originalName)}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  card.querySelector('.btn-download').addEventListener('click', () => {
    downloadUrl(image.previewUrl, computeNames().get(image.id));
  });
  card.querySelector('.btn-remove').addEventListener('click', () => removeImage(image.id));
  return card;
}

function removeImage(id) {
  const index = state.images.findIndex((img) => img.id === id);
  if (index === -1) return;
  URL.revokeObjectURL(state.images[index].previewUrl);
  state.images.splice(index, 1);
  dom.list.querySelector(`.image-card[data-id="${id}"]`)?.remove();
  refresh();
}

function clearAll() {
  if ((state.images.length || queue.running) && !confirm('¿vaciar la lista? se quitan todas las imágenes convertidas.')) return;
  for (const img of state.images) URL.revokeObjectURL(img.previewUrl);
  state.images = [];
  dom.list.replaceChildren();
  queue.pending = [];
  queue.generation++;
  queue.done = queue.total = 0;
  queue.failed = [];
  hideProgress();
  syncDownloadAll();
  refresh();
}

async function downloadAll() {
  const names = computeNames();
  const entries = state.images.map((img) => ({
    name: names.get(img.id),
    data: img.blob,
    lastModified: img.lastModified,
  }));
  await downloadZip(entries, 'imagenes-webp.zip', dom.downloadAll);
  syncDownloadAll(); // downloadZip lo reactiva al acabar, aunque haya entrado más cola
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initConvertView() {
  if (supportsWebpEncoding()) {
    setupDropzone({ area: dom.uploadArea, input: dom.fileInput, button: dom.selectBtn, folderInput: dom.folderInput, folderButton: dom.folderBtn, onFiles: addFiles });
  } else {
    // Safari / iPhone: elegir fotos aquí sólo llevaría a errores. La zona
    // lleva a "solo renombrar", que sí funciona.
    dom.uploadArea.classList.add('is-disabled');
    dom.uploadArea.querySelector('h3').textContent = 'este navegador no sabe convertir a webp';
    dom.uploadHint.textContent = 'usa chrome, firefox o edge en ordenador. aquí sí puedes renumerar archivos (1, 2, 3...).';
    dom.selectBtn.textContent = 'ir a solo renombrar';
    dom.folderBtn.hidden = true;
    dom.quality.disabled = true;
    dom.uploadArea.addEventListener('click', () => $('switchToRename').click());
  }

  dom.quality.addEventListener('change', () => {
    state.quality = Number(dom.quality.value);
    if (state.images.length) notify('la calidad nueva vale para las próximas imágenes; las que ya están no cambian', 'info');
  });
  dom.sequential.addEventListener('change', () => {
    state.sequentialNames = dom.sequential.checked;
    refresh();
  });
  dom.downloadAll.addEventListener('click', downloadAll);
  dom.clear.addEventListener('click', clearAll);
  dom.progressClose.addEventListener('click', () => {
    queue.failed = [];
    hideProgress();
  });

  makeSortable(dom.list, (ids) => {
    state.images = reorderById(state.images, ids);
    refresh();
  });

  return { el: dom.view, addFiles };
}
