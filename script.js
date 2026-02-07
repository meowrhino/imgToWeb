// Estado global
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
const qualitySlider = document.getElementById('qualitySlider');
const qualityValue = document.getElementById('qualityValue');

// Event Listeners
selectBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
downloadAllBtn.addEventListener('click', downloadAll);
qualitySlider.addEventListener('input', handleQualityChange);

// Prevenir clicks en el área cuando se hace clic en el botón
selectBtn.addEventListener('click', (e) => e.stopPropagation());

// Inicializar controles
initControls();

// Funciones de manejo de archivos
function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  processFiles(files);
  fileInput.value = ''; // Reset input
}

function handleDragOver(e) {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files);
  processFiles(files);
}

// Tipos MIME soportados
const SUPPORTED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/avif'
];

function isHeic(file) {
  if (file.type === 'image/heic' || file.type === 'image/heif') return true;
  return /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);
}

function isSupportedFile(file) {
  return SUPPORTED_TYPES.includes(file.type) || isHeic(file);
}

// Convertir HEIC a JPEG blob usando heic2any
async function convertHeicToJpeg(file) {
  if (typeof heic2any === 'undefined') {
    alert('No se pudo cargar la librería HEIC. Revisa tu conexión y vuelve a intentarlo.');
    return null;
  }
  try {
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
    const result = Array.isArray(blob) ? blob[0] : blob;
    return new File([result], file.name, { type: 'image/jpeg' });
  } catch {
    alert(`No se pudo convertir "${file.name}". El archivo HEIC puede estar dañado.`);
    return null;
  }
}

// Procesar archivos
async function processFiles(files) {
  const validFiles = files.filter(isSupportedFile);

  if (validFiles.length === 0) {
    alert('Formato no soportado. Usa JPG, PNG, GIF, BMP, AVIF o HEIC');
    return;
  }

  for (let file of validFiles) {
    if (isHeic(file)) {
      file = await convertHeicToJpeg(file);
      if (!file) continue;
    }
    await convertImage(file);
  }

  updateUI();
}

// Convertir imagen
async function convertImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calcular nuevas dimensiones
        const dimensions = calculateDimensions(img.width, img.height);
        
        // Crear canvas
        const canvas = document.createElement('canvas');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);
        
        // Convertir a WebP
        canvas.toBlob((blob) => {
          if (blob) {
            const imageData = {
              id: Date.now() + Math.random(),
              originalName: file.name,
              originalSize: file.size,
              originalDimensions: { width: img.width, height: img.height },
              webpBlob: blob,
              webpSize: blob.size,
              quality: Math.round(state.quality * 100),
              newDimensions: dimensions,
              previewUrl: URL.createObjectURL(blob)
            };
            
            state.images.push(imageData);
            resolve();
          }
        }, 'image/webp', state.quality);
      };
      
      img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
  });
}

// Calcular dimensiones manteniendo proporción
function calculateDimensions(width, height) {
  const maxDim = state.maxDimension;
  
  // Si ambas dimensiones son menores al máximo, mantener original
  if (width <= maxDim && height <= maxDim) {
    return { width, height };
  }
  
  // Calcular escala basándose en la dimensión más grande
  let scale;
  if (width > height) {
    scale = maxDim / width;
  } else {
    scale = maxDim / height;
  }
  
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
}

// Actualizar UI
function updateUI() {
  if (state.images.length === 0) {
    imagesContainer.style.display = 'none';
    return;
  }
  
  imagesContainer.style.display = 'block';
  imageCount.textContent = `${state.images.length} ${state.images.length === 1 ? 'imagen convertida' : 'imágenes convertidas'}`;
  
  imagesList.innerHTML = '';
  state.images.forEach(img => {
    imagesList.appendChild(createImageCard(img));
  });
}

// Crear tarjeta de imagen
function createImageCard(imageData) {
  const card = document.createElement('div');
  card.className = 'image-card';
  
  const savings = calculateSavings(imageData.originalSize, imageData.webpSize);
  const newName = imageData.originalName.replace(/\.(jpg|jpeg|png|gif|bmp|avif|heic|heif)$/i, '.webp');
  
  const dimensionsChanged = 
    imageData.originalDimensions.width !== imageData.newDimensions.width ||
    imageData.originalDimensions.height !== imageData.newDimensions.height;
  
  card.innerHTML = `
    <div class="image-preview">
      <img src="${imageData.previewUrl}" alt="${imageData.originalName}">
    </div>
    <div class="image-info">
      <div class="image-name" title="${newName}">${newName}</div>
      <div class="image-stats">
        ${dimensionsChanged ? `
          <div class="stat-row">
            <span class="stat-label">dimensiones:</span>
            <span class="stat-value">${imageData.originalDimensions.width}×${imageData.originalDimensions.height} → ${imageData.newDimensions.width}×${imageData.newDimensions.height}</span>
          </div>
        ` : `
          <div class="stat-row">
            <span class="stat-label">dimensiones:</span>
            <span class="stat-value">${imageData.newDimensions.width}×${imageData.newDimensions.height}</span>
          </div>
        `}
        <div class="stat-row">
          <span class="stat-label">original:</span>
          <span class="stat-value">${formatSize(imageData.originalSize)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">webp:</span>
          <span class="stat-value">${formatSize(imageData.webpSize)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">calidad:</span>
          <span class="stat-value">${imageData.quality}%</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">ahorro:</span>
          <span class="stat-value stat-savings">${savings}%</span>
        </div>
      </div>
      <button class="btn-download" onclick="downloadImage(${imageData.id})">
        descargar
      </button>
    </div>
  `;
  
  return card;
}

// Descargar imagen individual
function downloadImage(id) {
  const imageData = state.images.find(img => img.id === id);
  if (!imageData) return;
  
  const url = URL.createObjectURL(imageData.webpBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = imageData.originalName.replace(/\.(jpg|jpeg|png|gif|bmp|avif|heic|heif)$/i, '.webp');
  a.click();
  URL.revokeObjectURL(url);
}

// Descargar todas en ZIP
async function downloadAll() {
  if (state.images.length === 0) return;

  if (typeof JSZip === 'undefined') {
    alert('No se pudo cargar la librería de ZIP. Revisa tu conexión y vuelve a intentarlo.');
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

// Utilidades
function initControls() {
  updateQualityUI(Math.round(state.quality * 100));
}

function handleQualityChange(e) {
  const value = Number(e.target.value);
  const clamped = Math.min(Math.max(value, 70), 100);
  state.quality = clamped / 100;
  updateQualityUI(clamped);
}

function updateQualityUI(value) {
  const rounded = Math.round(value);
  qualityValue.textContent = `${rounded}%`;
  qualitySlider.value = rounded;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function calculateSavings(original, compressed) {
  const savings = ((original - compressed) / original) * 100;
  return savings.toFixed(1);
}

function buildUniqueFilename(originalName, nameCounts) {
  const base = originalName.replace(/\.(jpg|jpeg|png|gif|bmp|avif|heic|heif|webp)$/i, '');
  const count = (nameCounts[base] || 0) + 1;
  nameCounts[base] = count;
  if (count === 1) return `${base}.webp`;
  return `${base}-${count}.webp`;
}
