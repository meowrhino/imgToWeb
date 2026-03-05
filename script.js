// Estado global
let _idCounter = 0;
const EXT_REGEX = /\.(jpg|jpeg|png|gif|bmp|avif|heic|heif|tif|tiff)$/i;
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/avif'];

const state = {
  images: [],
  quality: 0.85,
  maxDimension: 2000
};

// Elementos del DOM
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const selectBtn = document.getElementById('selectBtn');
const imagesContainer = document.getElementById('imagesContainer');
const imagesList = document.getElementById('imagesList');
const imageCount = document.getElementById('imageCount');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const qualitySelect = document.getElementById('qualitySelect');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressCount = document.getElementById('progressCount');
const progressBar = document.getElementById('progressBar');

// Event listeners
selectBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
uploadArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => { processFiles(Array.from(e.target.files)); fileInput.value = ''; });
uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); uploadArea.classList.remove('drag-over'); });
uploadArea.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.classList.remove('drag-over'); processFiles(Array.from(e.dataTransfer.files)); });
downloadAllBtn.addEventListener('click', downloadAll);
qualitySelect.addEventListener('change', (e) => { state.quality = Number(e.target.value); });

// Utilidades
function nextId() { return ++_idCounter; }

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function calculateSavings(original, compressed) {
  return ((original - compressed) / original * 100).toFixed(1);
}

function getWebpName(name) {
  return name.replace(EXT_REGEX, '.webp');
}

function buildUniqueFilename(originalName, nameCounts) {
  const base = originalName.replace(/\.(jpg|jpeg|png|gif|bmp|avif|heic|heif|tif|tiff|webp)$/i, '');
  const count = (nameCounts[base] || 0) + 1;
  nameCounts[base] = count;
  return count === 1 ? `${base}.webp` : `${base}-${count}.webp`;
}

// Notificaciones (reemplaza alert)
function showNotification(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `notification notification-${type}`;
  el.textContent = message;
  document.body.appendChild(el);

  const all = document.querySelectorAll('.notification');
  for (let i = all.length - 1; i >= 0; i--) {
    all[i].style.bottom = `${1.5 + (all.length - 1 - i) * 3.5}rem`;
  }

  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => {
      el.remove();
      const remaining = document.querySelectorAll('.notification');
      remaining.forEach((n, i) => {
        n.style.bottom = `${1.5 + (remaining.length - 1 - i) * 3.5}rem`;
      });
    }, 300);
  }, 3000);
}

// Detección de tipos
function isHeic(file) {
  if (file.type === 'image/heic' || file.type === 'image/heif') return true;
  return /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);
}

function isTiff(file) {
  if (file.type === 'image/tiff') return true;
  return /\.tiff?$/i.test(file.name);
}

function isSupportedFile(file) {
  return SUPPORTED_TYPES.includes(file.type) || isHeic(file) || isTiff(file);
}

// Convertir HEIC a JPEG
async function convertHeicToJpeg(file) {
  if (typeof heic2any === 'undefined') {
    showNotification('no se pudo cargar la librería heic', 'error');
    return null;
  }
  try {
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
    const result = Array.isArray(blob) ? blob[0] : blob;
    return new File([result], file.name, { type: 'image/jpeg' });
  } catch {
    showNotification(`no se pudo convertir "${file.name}"`, 'error');
    return null;
  }
}

// Calcular dimensiones manteniendo proporción
function calculateDimensions(width, height) {
  const max = state.maxDimension;
  if (width <= max && height <= max) return { width, height };
  const scale = width > height ? max / width : max / height;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// Canvas a resultado WebP
function canvasToResult(canvas, file, origW, origH, dimensions) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve({
          id: nextId(),
          originalName: file.name,
          originalSize: file.size,
          originalDimensions: { width: origW, height: origH },
          webpBlob: blob,
          webpSize: blob.size,
          quality: Math.round(state.quality * 100),
          newDimensions: dimensions,
          previewUrl: URL.createObjectURL(blob)
        });
      } else {
        resolve(null);
      }
    }, 'image/webp', state.quality);
  });
}

// Convertir TIFF
async function convertTiff(file) {
  if (typeof UTIF === 'undefined') {
    showNotification('no se pudo cargar la librería tiff', 'error');
    return null;
  }
  try {
    const buffer = await file.arrayBuffer();
    const ifds = UTIF.decode(buffer);
    UTIF.decodeImage(buffer, ifds[0]);
    const page = ifds[0];
    const rgba = UTIF.toRGBA8(page);
    const { width, height } = page;
    const dimensions = calculateDimensions(width, height);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    imgData.data.set(new Uint8Array(rgba));
    ctx.putImageData(imgData, 0, 0);

    if (dimensions.width !== width || dimensions.height !== height) {
      const resized = document.createElement('canvas');
      resized.width = dimensions.width;
      resized.height = dimensions.height;
      resized.getContext('2d').drawImage(canvas, 0, 0, dimensions.width, dimensions.height);
      return await canvasToResult(resized, file, width, height, dimensions);
    }

    return await canvasToResult(canvas, file, width, height, dimensions);
  } catch {
    showNotification(`no se pudo convertir "${file.name}"`, 'error');
    return null;
  }
}

// Convertir imagen (usa createObjectURL en vez de readAsDataURL)
function convertImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(url);
      const dimensions = calculateDimensions(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      canvas.getContext('2d').drawImage(img, 0, 0, dimensions.width, dimensions.height);
      const result = await canvasToResult(canvas, file, img.width, img.height, dimensions);
      resolve(result);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      showNotification(`no se pudo cargar "${file.name}"`, 'error');
      resolve(null);
    };

    img.src = url;
  });
}

// Progreso
function showProgress(current, total) {
  progressContainer.style.display = 'block';
  const pct = Math.round((current / total) * 100);
  progressFill.style.width = `${pct}%`;
  progressCount.textContent = `${current}/${total}`;
  progressText.textContent = current < total ? 'convirtiendo...' : 'completado';
  progressBar.setAttribute('aria-valuenow', pct);
}

function hideProgress() {
  progressContainer.style.display = 'none';
  progressFill.style.width = '0%';
  progressBar.setAttribute('aria-valuenow', 0);
}

// Procesar archivos
async function processFiles(files) {
  const validFiles = files.filter(isSupportedFile);

  if (validFiles.length === 0) {
    showNotification('formato no soportado. usa jpg, png, gif, bmp, avif, heic o tiff', 'error');
    return;
  }

  const total = validFiles.length;
  let processed = 0;
  const startIndex = state.images.length;
  showProgress(0, total);

  for (let file of validFiles) {
    let result = null;

    if (isTiff(file)) {
      result = await convertTiff(file);
    } else {
      if (isHeic(file)) {
        file = await convertHeicToJpeg(file);
        if (!file) { processed++; showProgress(processed, total); continue; }
      }
      result = await convertImage(file);
    }

    if (result) state.images.push(result);
    processed++;
    showProgress(processed, total);
  }

  setTimeout(hideProgress, 1500);
  updateUI(startIndex);
}

// Actualizar UI (solo añade tarjetas nuevas)
function updateUI(startIndex = 0) {
  if (state.images.length === 0) {
    imagesContainer.style.display = 'none';
    return;
  }

  imagesContainer.style.display = 'block';
  imageCount.textContent = `${state.images.length} ${state.images.length === 1 ? 'imagen convertida' : 'imágenes convertidas'}`;

  for (let i = startIndex; i < state.images.length; i++) {
    imagesList.appendChild(createImageCard(state.images[i]));
  }
}

// Crear tarjeta (XSS-safe, sin onclick inline)
function createImageCard(imageData) {
  const card = document.createElement('div');
  card.className = 'image-card';
  card.dataset.id = imageData.id;

  const savings = calculateSavings(imageData.originalSize, imageData.webpSize);
  const savingsNum = parseFloat(savings);
  const newName = getWebpName(imageData.originalName);
  const dimChanged = imageData.originalDimensions.width !== imageData.newDimensions.width ||
                     imageData.originalDimensions.height !== imageData.newDimensions.height;

  card.innerHTML = `
    <div class="image-preview">
      <img src="${imageData.previewUrl}" alt="">
    </div>
    <div class="image-info">
      <div class="image-name" title="${escapeHtml(newName)}">${escapeHtml(newName)}</div>
      <div class="image-stats">
        <div class="stat-row">
          <span class="stat-label">dimensiones</span>
          <span class="stat-value">${dimChanged
            ? `${imageData.originalDimensions.width}\u00d7${imageData.originalDimensions.height} \u2192 ${imageData.newDimensions.width}\u00d7${imageData.newDimensions.height}`
            : `${imageData.newDimensions.width}\u00d7${imageData.newDimensions.height}`}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">original</span>
          <span class="stat-value">${formatSize(imageData.originalSize)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">webp</span>
          <span class="stat-value">${formatSize(imageData.webpSize)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">calidad</span>
          <span class="stat-value">${imageData.quality}%</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">ahorro</span>
          <span class="stat-value ${savingsNum >= 0 ? 'stat-savings' : 'stat-negative'}">${savingsNum < 0 ? '+' : ''}${Math.abs(savingsNum).toFixed(1)}%</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-download">descargar</button>
        <button class="btn-remove" title="eliminar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  card.querySelector('.btn-download').addEventListener('click', () => downloadImage(imageData.id));
  card.querySelector('.btn-remove').addEventListener('click', () => removeImage(imageData.id));

  return card;
}

// Eliminar imagen
function removeImage(id) {
  const index = state.images.findIndex(img => img.id === id);
  if (index === -1) return;

  URL.revokeObjectURL(state.images[index].previewUrl);
  state.images.splice(index, 1);

  const card = document.querySelector(`.image-card[data-id="${id}"]`);
  if (card) card.remove();

  if (state.images.length === 0) {
    imagesContainer.style.display = 'none';
  } else {
    imageCount.textContent = `${state.images.length} ${state.images.length === 1 ? 'imagen convertida' : 'imágenes convertidas'}`;
  }
}

// Descargar imagen individual
function downloadImage(id) {
  const imageData = state.images.find(img => img.id === id);
  if (!imageData) return;

  const url = URL.createObjectURL(imageData.webpBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getWebpName(imageData.originalName);
  a.click();
  URL.revokeObjectURL(url);
}

// Descargar todas en ZIP
async function downloadAll() {
  if (state.images.length === 0) return;

  if (typeof JSZip === 'undefined') {
    showNotification('no se pudo cargar la librería zip', 'error');
    return;
  }

  const zip = new JSZip();
  const nameCounts = {};

  state.images.forEach(imageData => {
    const filename = buildUniqueFilename(imageData.originalName, nameCounts);
    zip.file(filename, imageData.webpBlob);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'imagenes-webp.zip';
  a.click();
  URL.revokeObjectURL(url);
}
