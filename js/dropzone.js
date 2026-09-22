// Zona de subida: clic, botón, selector de archivos y drag & drop.

import { cleanFileList, getFilesFromDataTransfer, hasFiles } from './files.js';

export function setupDropzone({ area, input, button, onFiles }) {
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    input.click();
  });
  area.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    const files = cleanFileList(input.files);
    input.value = '';
    if (files.length) onFiles(files);
  });

  area.addEventListener('dragover', (e) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    area.classList.add('drag-over');
  });
  // dragleave también salta al pasar por encima de los hijos: sólo quitamos
  // el estado si el puntero sale de verdad del área.
  area.addEventListener('dragleave', (e) => {
    if (!area.contains(e.relatedTarget)) area.classList.remove('drag-over');
  });
  area.addEventListener('drop', async (e) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation(); // que no lo recoja también el drop global de main.js
    area.classList.remove('drag-over');
    const files = await getFilesFromDataTransfer(e.dataTransfer);
    if (files.length) onFiles(files);
  });
}
