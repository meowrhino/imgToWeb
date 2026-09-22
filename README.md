# imgToWeb

Conversor rápido de imágenes a WebP que funciona 100% en el navegador (sin subir archivos a servidor).

## Qué hace
- Convierte JPG/PNG/GIF/BMP/AVIF/HEIC/TIFF a WebP con control de calidad (70–100%, 85% por defecto).
- **GIF animados → WebP animados** (conserva fotogramas, tiempos, bucle y transparencia).
- Redimensiona manteniendo proporción hasta 2000px máximo.
- Acepta carpetas enteras (se recorren en orden alfabético natural: 2 antes que 10).
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
5) Descarga individualmente o pulsa "descargar todo (zip)". "vaciar" limpia la lista.

En "solo renombrar" funciona igual: arrastra las filas para fijar el orden (1, 2, 3...) que tendrá el ZIP. Puedes quitar archivos sueltos y se renumera todo.

## Compatibilidad
- Chrome, Edge y Firefox de escritorio: todo funciona.
- Safari (Mac) y **cualquier** navegador de iPhone/iPad (todos usan WebKit) no saben generar WebP: la app lo detecta y muestra un aviso. "Solo renombrar" sí funciona.
- GIF animados necesitan `ImageDecoder` (WebCodecs); si no está, se convierte el primer fotograma.
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
js/loaders.js       carga bajo demanda de heic2any y UTIF
js/notify.js        notificaciones
js/utils.js         utilidades
```

## Notas
- Con el renombrado secuencial desactivado, los nombres repetidos se desambiguan (`nombre.webp`, `nombre-2.webp`, ...) igual en la tarjeta, la descarga individual y el ZIP.
- Los números van sin ceros a la izquierda (1, 2, ... 10) a propósito.
- Dependencias desde CDN con SRI: JSZip y SortableJS al cargar; heic2any y UTIF sólo cuando hace falta un HEIC o un TIFF.
