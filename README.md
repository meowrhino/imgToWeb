# imgToWeb

Conversor rápido de imágenes a WebP que funciona 100% en el navegador (sin subir archivos a servidor).

## Qué hace
- Convierte JPG/PNG/GIF/BMP/AVIF/HEIC/TIFF a WebP con control de calidad (70–100%, 85% por defecto).
- Redimensiona manteniendo proporción hasta 2000px máximo.
- Permite descargar cada imagen o todas en un ZIP.
- **Reordena las imágenes arrastrándolas**: si tienes el renombrado secuencial activado (1, 2, 3...), los números se ajustan solos al nuevo orden.
- Modo "solo renombrar" para renumerar archivos sin convertir.
- Procesa todo de forma local en el navegador.

## Uso
1) Abre `index.html` en tu navegador.
2) Arrastra o selecciona imágenes JPG/PNG/etc.
3) Ajusta el slider de calidad si necesitas más o menos compresión.
4) **Arrastra las cards** para cambiar el orden antes de exportar. La numeración se actualiza al vuelo.
5) Descarga individualmente o pulsa "descargar todo (zip)".

En la sección "solo renombrar" funciona igual: arrastra las filas para fijar el orden (1, 2, 3...) que tendrá el ZIP.

## Notas
- Si subes varias veces el mismo archivo con distintas calidades, el ZIP renombra automáticamente (`nombre.webp`, `nombre-2.webp`, ...).
- El reordenamiento por drag & drop funciona también en touch (móvil y tablet).
- Dependencias cargadas desde CDN: JSZip (generar ZIPs), heic2any (decodificar HEIC), UTIF (decodificar TIFF), SortableJS (reordenamiento). Si alguna falla, revisa la conexión; el resto del conversor sigue funcionando.
