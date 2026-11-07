// Entrada de archivos: drag & drop (con carpetas), selector y filtrado de
// archivos basura del sistema.

import { naturalCompare } from './utils.js';

const SYSTEM_FILES = new Set(['thumbs.db', 'desktop.ini', 'icon\r']);

// .DS_Store, ._foto.jpg (AppleDouble), Thumbs.db, desktop.ini... y lo que
// venga de carpetas ocultas (.git/) al elegir una carpeta con el selector.
export function isJunkFile(file) {
  return /(^|\/)\./.test(file.webkitRelativePath || file.name) || SYSTEM_FILES.has(file.name.toLowerCase());
}

// Quita la basura y ordena por nombre (orden natural): el selector y el
// portapapeles dan los archivos en el orden del sistema, y aquí el orden es
// la numeración. Con carpeta elegida en el selector, por la ruta.
export function cleanFileList(fileList) {
  const path = (f) => f.webkitRelativePath || f.name;
  return Array.from(fileList || [])
    .filter((f) => !isJunkFile(f))
    .sort((a, b) => naturalCompare(path(a), path(b)));
}

// Extrae los archivos de un DataTransfer recorriendo carpetas.
// - Los elementos soltados se ordenan por nombre (orden natural), porque llegan
//   en el orden que decida el sistema.
// - El contenido de cada carpeta se ordena por nombre (orden natural), porque
//   readEntries no garantiza ningún orden y aquí el orden es la numeración.
// - Se recorre en secuencia (no Promise.all) para que el orden sea determinista.
// IMPORTANTE: los items del DataTransfer sólo son válidos de forma síncrona
// dentro del evento drop, así que las entries se sacan antes del primer await.
export async function getFilesFromDataTransfer(dataTransfer) {
  const items = dataTransfer.items;
  if (!items || !items.length || typeof items[0].webkitGetAsEntry !== 'function') {
    return cleanFileList(dataTransfer.files);
  }
  // Por cada item: su entry (puede ser carpeta) o, si no la hay, el archivo tal cual.
  const sources = [];
  for (const item of items) {
    if (item.kind !== 'file') continue;
    const source = item.webkitGetAsEntry() || item.getAsFile();
    if (source) sources.push(source);
  }
  sources.sort((a, b) => naturalCompare(a.name, b.name));
  const files = [];
  for (const source of sources) {
    if (source instanceof File) files.push(source);
    else await collectFiles(source, files);
  }
  return files.filter((f) => !isJunkFile(f));
}

async function collectFiles(entry, out) {
  if (entry.isFile) {
    const file = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
    if (file) out.push(file);
    return;
  }
  if (!entry.isDirectory || entry.name.startsWith('.')) return; // .git, .Trashes...

  const reader = entry.createReader();
  const children = [];
  // readEntries devuelve lotes parciales: hay que llamarlo hasta que venga vacío.
  let batch;
  do {
    batch = await new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
    children.push(...batch);
  } while (batch.length > 0);

  children.sort((a, b) => naturalCompare(a.name, b.name));
  for (const child of children) await collectFiles(child, out);
}

// Para ignorar el mismo archivo soltado dos veces: mismo nombre, tamaño y fecha.
export const fileKey = (file) => `${file.name}|${file.size}|${file.lastModified}`;

export function hasFiles(dataTransfer) {
  return Array.from(dataTransfer?.types || []).includes('Files');
}
