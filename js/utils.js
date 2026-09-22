// Utilidades genéricas sin estado.

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// ".jpg" de "foto.JPG" → ".JPG". Los nombres que empiezan por punto
// (".bashrc") no tienen extensión.
export function getExtension(filename) {
  const dot = filename.lastIndexOf('.');
  return dot <= 0 ? '' : filename.slice(dot);
}

export function stripExtension(filename) {
  const ext = getExtension(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}

// Orden "humano": img2 < img10.
export function naturalCompare(a, b) {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

// Descarga una URL ya existente (no la revoca).
export function downloadUrl(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Descarga un blob. El object URL se revoca con retraso: revocarlo justo
// después de click() cancela la descarga en algunos navegadores (Safari).
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
