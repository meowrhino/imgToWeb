// Vista "convertir a webp": cola de conversión, tarjetas, reordenado y descargas.

import { convertToWebp, isConvertible } from './converter.js';
import { setupDropzone } from './dropzone.js';
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

function showProgress(done, total) {
  clearTimeout(hideProgressTimer);
  const pct = total ? Math.round((done / total) * 100) : 0;
  dom.progress.hidden = false;
  dom.progressFill.style.width = `${pct}%`;
  dom.progressCount.textContent = `${done}/${total}`;
  dom.progressText.textContent = done < total ? 'convirtiendo...' : 'completado';
  dom.progressBar.setAttribute('aria-valuenow', pct);
}

function hideProgress() {
  clearTimeout(hideProgressTimer);
  dom.progress.hidden = true;
  dom.progressFill.style.width = '0%';
  dom.progressBar.setAttribute('aria-valuenow', 0);
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
  done: 0,
  total: 0,
  running: false,
  generation: 0, // se incrementa al vaciar: descarta lo que estaba en vuelo
};

function addFiles(files) {
  if (!supportsWebpEncoding()) {
    notify('tu navegador no sabe exportar a WebP (Safari / iPhone). usa Chrome, Firefox o Edge.', 'error');
    return;
  }
  const valid = files.filter(isConvertible);
  const skipped = files.length - valid.length;
  if (!valid.length) {
    notify('formato no soportado. usa jpg, png, gif, bmp, avif, heic o tiff', 'error');
    return;
  }
  if (skipped) notify(`${plural(skipped, 'archivo ignorado', 'archivos ignorados')} (formato no soportado)`, 'info');

  for (const file of valid) {
    queue.pending.push({ file, quality: state.quality, generation: queue.generation });
  }
  queue.total += valid.length;
  showProgress(queue.done, queue.total);
  if (!queue.running) runQueue();
}

async function runQueue() {
  queue.running = true;
  while (queue.pending.length) {
    const job = queue.pending.shift();
    let result = null;
    try {
      result = await convertToWebp(job.file, { quality: job.quality, maxDimension: MAX_DIMENSION });
    } catch (err) {
      if (job.generation === queue.generation) {
        notify(`no se pudo convertir "${job.file.name}": ${err.message}`, 'error');
      }
    }
    if (job.generation !== queue.generation) continue; // se vació mientras tanto
    if (result) addImage(job, result);
    queue.done++;
    showProgress(queue.done, queue.total);
  }
  queue.running = false;
  hideProgressTimer = setTimeout(() => {
    hideProgress();
    queue.done = queue.total = 0;
  }, 1500);
}

function addImage({ file, quality }, result) {
  const image = {
    id: nextId++,
    originalName: file.name,
    originalSize: file.size,
    lastModified: file.lastModified,
    originalDimensions: result.originalDimensions,
    dimensions: result.dimensions,
    frames: result.frames,
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
      <img src="${image.previewUrl}" alt="">
    </div>
    <div class="image-info">
      <div class="image-name"></div>
      <div class="image-stats">
        ${statRow('dimensiones', resized ? `${from.width}×${from.height} → ${to.width}×${to.height}` : `${to.width}×${to.height}`)}
        ${image.frames > 1 ? statRow('animación', `${image.frames} fotogramas`) : ''}
        ${statRow('original', formatSize(image.originalSize))}
        ${statRow('webp', formatSize(image.blob.size))}
        ${statRow('calidad', `${image.quality}%`)}
        ${statRow('ahorro', `${savings < 0 ? '+' : ''}${Math.abs(savings).toFixed(1)}%`, savings >= 0 ? 'stat-savings' : 'stat-negative')}
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
  for (const img of state.images) URL.revokeObjectURL(img.previewUrl);
  state.images = [];
  dom.list.replaceChildren();
  queue.pending = [];
  queue.generation++;
  queue.done = queue.total = 0;
  hideProgress();
  refresh();
}

function downloadAll() {
  const names = computeNames();
  const entries = state.images.map((img) => ({
    name: names.get(img.id),
    data: img.blob,
    lastModified: img.lastModified,
  }));
  downloadZip(entries, 'imagenes-webp.zip', dom.downloadAll);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initConvertView() {
  setupDropzone({ area: dom.uploadArea, input: dom.fileInput, button: dom.selectBtn, onFiles: addFiles });

  dom.quality.addEventListener('change', () => {
    state.quality = Number(dom.quality.value);
  });
  dom.sequential.addEventListener('change', () => {
    state.sequentialNames = dom.sequential.checked;
    refresh();
  });
  dom.downloadAll.addEventListener('click', downloadAll);
  dom.clear.addEventListener('click', clearAll);

  makeSortable(dom.list, (ids) => {
    state.images = reorderById(state.images, ids);
    refresh();
  });

  return { el: dom.view, addFiles };
}
