// Notificaciones apiladas en la esquina (reemplazan a alert).

const VISIBLE_MS = 3000;
const FADE_MS = 300;

function restack() {
  const all = document.querySelectorAll('.notification');
  all.forEach((n, i) => {
    n.style.bottom = `${1.5 + (all.length - 1 - i) * 3.5}rem`;
  });
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
