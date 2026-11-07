// Notificaciones apiladas en la esquina (reemplazan a alert).

const VISIBLE_MS = 3000;
const FADE_MS = 300;

// Apila de abajo arriba según la altura real (un aviso largo ocupa dos líneas).
function restack() {
  let bottom = 24;
  for (const n of [...document.querySelectorAll('.notification')].reverse()) {
    n.style.bottom = `${bottom}px`;
    bottom += n.offsetHeight + 8;
  }
}

export function notify(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `notification notification-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  document.body.appendChild(el);
  restack();

  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => {
      el.remove();
      restack();
    }, FADE_MS);
  }, VISIBLE_MS);
}
