# imgToWeb

Conversor rápido de imágenes a WebP que funciona 100% en el navegador (sin subir archivos a servidor).

## Qué hace
- Convierte JPG/PNG a WebP con control de calidad (70–100%, 85% por defecto).
- Redimensiona manteniendo proporción hasta 2000px máximo.
- Permite descargar cada imagen o todas en un ZIP.
- Procesa todo de forma local en el navegador.

## Uso
1) Abre `index.html` en tu navegador.
2) Arrastra o selecciona imágenes JPG/PNG.
3) Ajusta el slider de calidad si necesitas más o menos compresión.
4) Descarga individualmente o pulsa “descargar todo (zip)”.

## Notas
- Si subes varias veces el mismo archivo con distintas calidades, el ZIP renombra automáticamente (`nombre.webp`, `nombre-2.webp`, ...).
- Se requiere que cargue la librería JSZip desde el CDN para generar el ZIP. Si falla, revisa conexión (el resto del conversor sigue funcionando).
