// Punto de entrada: monta las dos vistas y los comportamientos globales
// (cambio de vista, pegar, soltar fuera de la zona, aviso de navegador).

import { initConvertView } from './convert-view.js';
import { initRenameView } from './rename-view.js';
import { getFilesFromDataTransfer, hasFiles, isJunkFile } from './files.js';
import { notify } from './notify.js';
import { plural } from './utils.js';
import { supportsWebpEncoding } from './webp.js';

const views = {
  convert: initConvertView(),
  rename: initRenameView(),
};
let active = views.convert;

function showView(name) {
  active = views[name];
  for (const view of Object.values(views)) view.el.hidden = view !== active;
}

document.getElementById('switchToRename').addEventListener('click', () => showView('rename'));
document.getElementById('switchToConvert').addEventListener('click', () => showView('convert'));

// Soltar archivos fuera de la zona de subida: sin esto el navegador abre el
// archivo y se pierde todo lo convertido. Lo mandamos a la vista activa.
document.addEventListener('dragover', (e) => {
  if (hasFiles(e.dataTransfer)) e.preventDefault();
});
document.addEventListener('drop', async (e) => {
  if (!hasFiles(e.dataTransfer)) return;
  e.preventDefault();
  const files = await getFilesFromDataTransfer(e.dataTransfer);
  if (files.length) active.addFiles(files);
});

// Pegar (Ctrl+V / Cmd+V) va a la vista activa.
document.addEventListener('paste', (e) => {
  const files = Array.from(e.clipboardData?.files || []).filter((f) => !isJunkFile(f));
  if (!files.length) return;
  e.preventDefault();
  active.addFiles(files);
  notify(`${plural(files.length, 'archivo pegado', 'archivos pegados')} desde el portapapeles`, 'info');
});

// Aviso si el navegador no puede generar WebP (Safari en Mac y cualquier
// navegador de iPhone/iPad). Se detecta de verdad, no por ancho de pantalla.
if (!supportsWebpEncoding()) {
  const notice = document.getElementById('browserNotice');
  notice.hidden = false;
  document.getElementById('browserNoticeClose').addEventListener('click', () => notice.remove());
}
