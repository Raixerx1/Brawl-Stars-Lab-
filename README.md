# Brawl Draft Lab

Aplicación web estática, instalable y optimizada para móvil para ayudar con drafts de Brawl Stars Ranked.

## Incluye
- 106 brawlers registrados.
- 28 mapas de referencia, incluidos los cuatro mapas destacados en las notas oficiales de junio de 2026.
- Fichas de mapas y brawlers.
- Draft Assistant con puntuación heurística explicable.
- Favoritos y entrenador personal guardados en el navegador.
- PWA y funcionamiento offline básico.
- Exportación estática compatible con Vercel.

## Ejecutar en local
Necesita Node.js 20.9 o superior.

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Publicar en Vercel
1. Sube el contenido de esta carpeta a GitHub.
2. Entra en Vercel con tu cuenta de GitHub.
3. Pulsa **Add New → Project**.
4. Elige `Brawl-Stars-Lab-`.
5. Pulsa **Deploy** sin cambiar la configuración.

## Principio de datos
La app no presenta los tiers editoriales como tasas de victoria. Cualquier estadística futura debe incluir fuente, fecha, rango y tamaño muestral.

## Fuentes iniciales
- Supercell: Release Notes June 2026.
- Brawlify: roster de 106 brawlers.
- Brawl Time Ninja: estadísticas de terceros, con sus limitaciones metodológicas.
