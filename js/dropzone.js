// Zona de subida: clic, botón, selector de archivos y drag & drop.

import { cleanFileList, getFilesFromDataTransfer, hasFiles } from './files.js';

export function setupDropzone({ area, input, button, folderInput, folderButton, onFiles }) {
  for (const [btn, inp] of [[button, input], [folderButton, folderInput]]) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      inp.click();
    });
    inp.addEventListener('change', () => {
      const files = cleanFileList(inp.files);
      inp.value = '';
      if (files.length) onFiles(files);
    });
  }
  // Los clic de los input (input.click()) también suben hasta aquí: ignorarlos,
  // o el de carpeta abriría además el selector de archivos.
  area.addEventListener('click', (e) => {
    if (!(e.target instanceof HTMLInputElement)) input.click();
  });
  // Elegir carpeta (webkitdirectory) no existe en todos los navegadores.
  if (!('webkitdirectory' in folderInput)) folderButton.hidden = true;

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
