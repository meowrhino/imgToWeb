// Carga bajo demanda de librerías pesadas que sólo hacen falta para algunos
// formatos (heic2any pesa ~1.3 MB). Con SRI para no ejecutar nada alterado.

const LIBS = {
  heic2any: {
    src: 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
    integrity: 'sha384-OTofQ0MEeiSgh62havBcemCIK0gqj809wX6UA0uPISNMRnR6NZyCdGzX3SbLrgwL',
  },
  UTIF: {
    src: 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js',
    integrity: 'sha384-RyBmXHdfZ/Uon+ud+/AqSyWpUWnKYt2tkRG/P4gWoRUGDU+qIAV3tGBPNlYTBZEF',
  },
};

const pending = new Map();

// Resuelve con el global de la librería (window[name]).
export function loadLib(name) {
  if (window[name]) return Promise.resolve(window[name]);
  if (!pending.has(name)) {
    const { src, integrity } = LIBS[name];
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.integrity = integrity;
      script.crossOrigin = 'anonymous';
      script.onload = () => (window[name] ? resolve(window[name]) : reject(new Error(name)));
      script.onerror = () => {
        pending.delete(name); // permitir reintentar
        script.remove();
        reject(new Error(`no se pudo cargar la librería ${name}`));
      };
      document.head.appendChild(script);
    });
    pending.set(name, promise);
  }
  return pending.get(name);
}
