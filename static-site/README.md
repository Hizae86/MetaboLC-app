# Sitio estático de MetaboLC (páginas indexables)

Genera una página HTML por método a partir de `metabolc.db`, con URL legible
(`/metodos/cortisol-and-cortisone-in-human-urine-dilute-and-shoot/`) y datos
estructurados para buscadores. No necesita servidor ni dependencias.

## Uso (desde la carpeta MetaboLC-app)

    python3 static-site/build_static.py --db metabolc.db --out static-site/dist --site-url https://metabolc.io

Salida:
- `dist/metodos/<slug>/index.html`: una página por método (pending + verified).
- `dist/metodos/index.html`: índice de todos los métodos.
- `dist/method/<id>/index.html`: redirección desde la URL antigua `/method/<id>`.
- `dist/sitemap.xml` y `dist/robots.txt`.
- `dist/build_report.json`: número de métodos y tabla slug → id.

## Antes de publicar

1. Abre algunas páginas en el navegador y revisa que los datos son correctos.
2. Valida el JSON-LD en https://validator.schema.org (pega la URL o el HTML).
3. Revisa la licencia del contenido. Muchos métodos proceden de notas de
   fabricantes (p. ej. el compendio de SCIEX citado en el campo `reference`).
   Las páginas muestran la fuente y un enlace, pero conviene confirmar qué
   puedes publicar literalmente.

## Hosting

Como es HTML estático, cualquier hosting gratuito sirve: Vercel, Netlify,
GitHub Pages o Cloudflare Pages. Sube la carpeta `dist/`. Para desplegarlo
conviene hacerlo con alguien que te acompañe la primera vez, o pedirme que
prepare la configuración para el servicio que elijas.

## Pendiente (fuera de esta fase)

- Buscador y asistente: siguen en la aplicación completa (FastAPI + React).
- Regenerar el sitio cada vez que cambien los métodos (ejecutar el script).
