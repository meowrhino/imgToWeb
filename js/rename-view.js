// Vista "solo renombrar": renumera archivos cualquiera (1, 2, 3...) sin convertir.

import { setupDropzone } from './dropzone.js';
import { makeSortable, reorderById } from './sortable.js';
import { downloadZip } from './zip.js';
import { escapeHtml, getExtension, naturalCompare, plural } from './utils.js';

const $ = (id) => document.getElementById(id);
const dom = {
  view: $('viewRename'),
  uploadArea: $('renameUploadArea'),
  fileInput: $('renameFileInput'),
  selectBtn: $('renameSelectBtn'),
  container: $('renameContainer'),
  list: $('renameList'),
  count: $('renameCount'),
  download: $('renameDownloadBtn'),
  clear: $('clearRenameBtn'),
  orderRadios: document.querySelectorAll('input[name="renameOrder"]'),
};

const state = {
  items: [], // [{ id, file }] en orden manual
  order: 'manual', // 'manual' | 'alpha'
};

let nextId = 1;

function orderedItems() {
  if (state.order !== 'alpha') return state.items;
  return [...state.items].sort((a, b) => naturalCompare(a.file.name, b.file.name));
}

// Sin ceros a la izquierda a propósito; extensión en minúsculas.
const newName = (file, index) => `${index + 1}${getExtension(file.name).toLowerCase()}`;

function setOrder(order) {
  state.order = order;
  for (const radio of dom.orderRadios) radio.checked = radio.value === order;
}

function render() {
  const n = state.items.length;
  dom.container.hidden = n === 0;
  dom.count.textContent = plural(n, 'archivo', 'archivos');

  const rows = orderedItems().map(({ id, file }, i) => {
    const row = document.createElement('div');
    row.className = 'rename-row';
    row.dataset.id = id;
    row.innerHTML = `
      <span class="rename-original" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
      <span class="rename-arrow">→</span>
      <span class="rename-new">${escapeHtml(newName(file, i))}</span>
      <button type="button" class="btn-remove btn-remove-small" title="quitar" aria-label="quitar ${escapeHtml(file.name)}">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    `;
    row.querySelector('.btn-remove').addEventListener('click', () => removeItem(id));
    return row;
  });
  dom.list.replaceChildren(...rows);
}

function addFiles(files) {
  state.items.push(...files.map((file) => ({ id: nextId++, file })));
  render();
}

function removeItem(id) {
  state.items = state.items.filter((item) => item.id !== id);
  render();
}

function clearAll() {
  state.items = [];
  render();
}

function download() {
  const entries = orderedItems().map(({ file }, i) => ({
    name: newName(file, i),
    data: file,
    lastModified: file.lastModified,
  }));
  downloadZip(entries, 'archivos-renombrados.zip', dom.download);
}

export function initRenameView() {
  setupDropzone({ area: dom.uploadArea, input: dom.fileInput, button: dom.selectBtn, onFiles: addFiles });

  for (const radio of dom.orderRadios) {
    radio.addEventListener('change', () => {
      setOrder(radio.value);
      render();
    });
  }
  dom.download.addEventListener('click', download);
  dom.clear.addEventListener('click', clearAll);

  // Arrastrar fija el orden que se ve: si estaba en alfabético, pasa a manual.
  makeSortable(dom.list, (ids) => {
    state.items = reorderById(state.items, ids);
    setOrder('manual');
    render();
  });

  return { el: dom.view, addFiles };
}
