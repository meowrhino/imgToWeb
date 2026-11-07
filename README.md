# imgToWeb

Conversor rápido de imágenes a WebP que funciona 100% en el navegador (sin subir archivos a servidor).

## Qué hace
- Convierte JPG/PNG/GIF/BMP/AVIF/WebP/HEIC/TIFF a WebP con control de calidad (70–100%, 85% por defecto).
- **GIF animados → WebP animados** (conserva fotogramas, tiempos, bucle y transparencia).
- Redimensiona manteniendo proporción hasta 2000px máximo.
- Acepta carpetas enteras (arrastrándolas o con "elegir carpeta"). Cada lote se ordena por nombre en orden natural (2 antes que 10), también los archivos sueltos.
- El mismo archivo dos veces (mismo nombre, tamaño y fecha) se ignora con un aviso.
- Las que no se pueden convertir quedan apuntadas bajo la barra de progreso ("5 de 6 convertidas; falló: roto.jpg") hasta el próximo lote o "vaciar".
- Permite descargar cada imagen o todas en un ZIP.
- **Reordena las imágenes arrastrándolas**: con el renombrado secuencial activado (1, 2, 3...), los números se ajustan solos al nuevo orden.
- Modo "solo renombrar" para renumerar cualquier archivo sin convertir (extensión en minúsculas, conserva la fecha de modificación en el ZIP).
- Pegar desde el portapapeles (Ctrl+V / Cmd+V) añade a la vista activa.
- Procesa todo de forma local en el navegador.

## Uso
1) Sirve la carpeta con cualquier servidor estático (el código usa ES modules, que no funcionan abriendo `index.html` con `file://`):
   ```bash
   python3 -m http.server 5502
   ```
   y abre http://localhost:5502. En producción está en GitHub Pages.
2) Elige la calidad (se aplica a las imágenes que conviertas a partir de ese momento).
3) Arrastra o selecciona imágenes o carpetas.
4) **Arrastra las cards** para cambiar el orden antes de exportar. La numeración se actualiza al vuelo.
5) Descarga individualmente o pulsa "descargar todo (zip)" (se activa cuando acaba la cola). "vaciar" limpia la lista (pide confirmación).

En "solo renombrar" funciona igual: arrastra las filas para fijar el orden (1, 2, 3...) que tendrá el ZIP. Puedes quitar archivos sueltos y se renumera todo.

## Compatibilidad
- Chrome, Edge y Firefox de escritorio: todo funciona.
- Safari (Mac) y **cualquier** navegador de iPhone/iPad (todos usan WebKit) no saben generar WebP: la app lo detecta, muestra un aviso y la zona de convertir lleva a "solo renombrar", que sí funciona.
- GIF animados necesitan `ImageDecoder` (WebCodecs); si no está, se convierte el primer fotograma y la tarjeta lo dice.
- Calidad 100% es sin pérdida en Chrome; en Firefox es con pérdida a máxima calidad.

## Estructura
```
index.html          markup de las dos vistas
styles.css
js/main.js          entrada: cambio de vista, pegar, soltar fuera de la zona, aviso de navegador
js/convert-view.js  vista convertir: cola, tarjetas, nombres, ZIP
js/rename-view.js   vista solo renombrar
js/converter.js     decodificar (HEIC/TIFF/GIF/resto) → reescalar → WebP
js/webp.js          detección de soporte, canvas→WebP, montaje de WebP animado
js/files.js         leer archivos/carpetas del drop, filtrar .DS_Store y similares
js/dropzone.js      zona de subida (clic, selector, drag & drop)
js/sortable.js      reordenado con SortableJS
js/zip.js           ZIP con fechas conservadas
js/loaders.js       carga bajo demanda de heic2any, UTIF y pako
js/notify.js        notificaciones
js/utils.js         utilidades
```

## Notas
- Con el renombrado secuencial desactivado, los nombres repetidos se desambiguan (`nombre.webp`, `nombre-2.webp`, ...) igual en la tarjeta, la descarga individual y el ZIP.
- Los números van sin ceros a la izquierda (1, 2, ... 10) a propósito.
- Dependencias desde CDN con SRI: JSZip y SortableJS al cargar; heic2any y UTIF (+ pako, para los TIFF con compresión ZIP) sólo cuando hace falta un HEIC o un TIFF.
- Un `.heic` que en realidad es JPEG se carga como imagen normal.
- Inknut Antiqua servida desde `fonts/` (woff2); nada de Google Fonts.
