# Brawl Draft Lab v0.4.3

Aplicación web competitiva para Brawl Stars Ranked.

## Novedades v0.4.3

- Motor **Counter primero** activado por defecto.
- Selector de prioridad: Counter primero, Equilibrado o Pick seguro.
- Los counters directos y múltiples pesan mucho más que el tier general del mapa.
- Penalización fuerte cuando un rival counterea al candidato.
- Respuestas por arquetipo: antidive, antitanque, acceso a artilleros, wallbreak y ventaja de rango.
- Matriz visual contra cada pick rival.
- Etiquetas Counter directo, Counter múltiple, Respuesta favorable o Matchup arriesgado.
- El estimador de victoria da más peso a los matchups.
- Service worker actualizado para evitar versiones antiguas en escritorio.

## Novedades v0.4.2

- Nuevo hueco **Mi pick** independiente de los otros dos aliados.
- Evaluación específica del brawler escogido.
- Probabilidad estimada del draft recalculada en tiempo real.
- Intervalo estimado, nivel de confianza y porcentaje de draft completado.
- Comparación de puntuación entre ambos equipos.
- Factores favorables y riesgos de matchup.
- El porcentaje se identifica expresamente como estimación heurística, no como win rate observado.

## Novedades v0.4.1

- Pool Ranked revisado el 08/08/2026.
- 33 mapas vigentes y 6 mapas históricos conservados.
- Añadidos: New Horizons, Flowing Springs, Sneaky Fields, Deathcap Trap, Flooded Mine, Gem Fort, Lilygear Lake, Dry Season, Layer Cake, Pit Stop y Safe(r) Zone.
- Filtro independiente para mapas Ranked actuales, históricos o todos.
- Alias en español para encontrar mapas como “Nuevos horizontes”, “Fénix en llamas”, “Cueva subterránea” o “Tiroteo estelar”.
- Draft Coach ordena los mapas actuales antes que los históricos.

## Metodología

El pool actual se contrasta con Brawl Planet (Ranked Diamond I+) y las rotaciones/notas oficiales de Supercell. Los tiers y planes de partida son editoriales y se revisan tras cada balance.

## Desarrollo

```bash
npm install
npm run dev
```

## Producción

```bash
npm run build
npm start
```

Proyecto independiente no afiliado a Supercell.
