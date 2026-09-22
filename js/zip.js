// Generación y descarga de ZIPs (JSZip, cargado como global desde CDN).

import { notify } from './notify.js';
import { downloadBlob } from './utils.js';

// JSZip escribe la fecha DOS con los getters UTC, pero los descompresores la
// leen como hora local: sin compensar, las fechas salen desplazadas tantas
// horas como el huso horario. Desplazamos para que la hora local se conserve.
function zipDate(timestamp) {
  const d = new Date(timestamp ?? Date.now());
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
}

// entries: [{ name, data: Blob|File, lastModified? }]
export async function downloadZip(entries, filename, button) {
  if (!entries.length) return;
  if (typeof JSZip === 'undefined') {
    notify('no se pudo cargar la librería zip', 'error');
    return;
  }

  const zip = new JSZip();
  for (const { name, data, lastModified } of entries) {
    zip.file(name, data, { binary: true, date: zipDate(lastModified) });
  }

  const label = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = 'generando zip...';
  }
  try {
    // Sin compresión (STORE, el valor por defecto): imágenes ya comprimidas.
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, filename);
  } catch {
    notify('no se pudo generar el zip', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = label;
    }
  }
}
