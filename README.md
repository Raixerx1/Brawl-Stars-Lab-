# Brawl Draft Lab v0.8

Aplicación web competitiva para Brawl Stars Ranked.

## Novedades v0.8

- Nueva sección **Live Review**.
- Captura local de una pantalla, ventana o pestaña mediante el selector del navegador.
- La aplicación no graba ni sube automáticamente el vídeo.
- Cronómetro sincronizado con la sesión.
- Marcadores rápidos con atajos de teclado:
  - eliminaciones y muertes;
  - rotaciones y sobreextensiones;
  - cambios de línea y matchups;
  - supers e hipercargas;
  - objetivo ganado o perdido.
- Cronología editable con el segundo exacto de cada evento.
- Captura manual de fotogramas como imagen.
- Resumen postpartida determinista con fortalezas, errores y próximo foco.
- Guardado local de hasta 50 Live Reviews.
- Exportación de la revisión en JSON.
- Envío directo del resultado al sistema de Aprendizaje personal.
- Nueva fuente de historial: **Live Review**.

### Límites de Live Review

La v0.8 no interpreta automáticamente todos los píxeles ni reconoce por sí sola cada acción del juego. La pantalla compartida se utiliza como referencia visual local y el análisis se construye con los marcadores que registras durante la partida. Esto evita grabar o enviar el vídeo y mantiene la sesión ligera.

## Novedades v0.7

- Aprendizaje personal basado en resultados reales.
- Guardado del resultado directamente desde un draft 3v3 completo.
- Ajuste moderado de recomendaciones según:
  - rendimiento con cada brawler;
  - rendimiento específico del brawler en el mapa;
  - tamaño de la muestra.
- Interruptor para activar o desactivar el aprendizaje.
- Historial personal visible en las tarjetas de recomendación.
- Entrenador renovado con mejores brawlers, rendimiento por rol y mapas débiles.
- Importación, exportación y eliminación de partidas.
- Migración automática del historial antiguo.
- Los datos permanecen en el navegador y no salen del dispositivo.

## Novedades v0.6

- Simulador **“¿Qué pasa si el rival elige…?”**.
- Predicción de los siguientes picks enemigos según:
  - mapa;
  - composición actual;
  - counters a tus aliados;
  - necesidades de control, antitanque y antidive.
- Simulación mediante los picks previstos o cualquier brawler del roster.
- La recomendación, la build, las líneas y el porcentaje se recalculan con el escenario hipotético.
- Comparación del porcentaje estimado frente al draft actual.
- Confirmación directa del pick simulado cuando realmente es el turno rival.
- Posibilidad de convertir una amenaza simulada en ban.
- Bans sugeridos automáticamente según mapa y picks aliados.
- El pick simulado aparece como una ficha diferenciada en la barra cronológica.
- Los enlaces compartidos pueden conservar el escenario activo.

## Novedades v0.5.2

- Interruptor **Agrupar por rol** dentro de Mi pool.
- Agrupación activada por defecto y preferencia guardada en el navegador.
- Vista alternativa única, sin secciones.
- Secciones plegables para Tiradores, Control, Asesinos, Tanques, Apoyo y el resto de roles.
- Cada grupo muestra brawlers disponibles y total de integrantes.
- Los filtros y el buscador funcionan en ambas vistas.

## Novedades v0.5.1

- Recuperado el panel de bans dentro del Draft Assistant.
- Hasta seis brawlers bloqueados.
- Los bans desaparecen del buscador de picks y de todas las recomendaciones.
- El motor de draft recibe los bans y no propone brawlers bloqueados.
- Los bans se conservan al compartir un draft mediante enlace.
- Al reiniciar o cambiar de mapa se limpian junto con los picks.

## Novedades v0.5

- Tres políticas de pool:
  - no usar;
  - priorizar brawlers preparados;
  - limitarse estrictamente al pool disponible.
- Favoritos dentro del pool con bonificación específica.
- Acciones masivas, importación y exportación del pool.
- Build contextual del pick principal:
  - gadget;
  - habilidad estelar;
  - engranajes;
  - uso de hipercarga;
  - motivo táctico.
- Modo ultrarrápido para drafts con temporizador.
- Estado del pool visible en cada recomendación.
- El motor pondera Fuerza 11, hipercarga, favoritos y dominio personal.

## Novedades v0.4.5

- Eliminados los bloques separados de aliados, rivales y mi pick.
- Una sola barra cronológica de seis picks.
- Un único buscador que coloca automáticamente cada brawler en el siguiente slot.
- Azul para aliados y rojo para rivales; la secuencia se invierte cuando el first pick es rival.
- Recomendaciones inmediatamente debajo:
  - first pick: mejor brawler sólido del mapa;
  - picks intermedios: counters directos y equilibrio;
  - last pick: máximo castigo contra la composición rival.
- Porcentaje estimado para el equipo aliado sin necesitar identificar un pick propio.
- Consejos rápidos, matchups que buscar y distribución de líneas.
- Corrección sencilla: al pulsar un pick se eliminan ese slot y los posteriores.

## Novedades v0.4.4

- Orden competitivo real: **1 first pick → 2 picks → 2 picks → last pick**.
- Selector para indicar si el first pick pertenece a tu equipo o al rival.
- El asistente detecta automáticamente el turno y la posición de tu siguiente selección.
- First pick: prioriza solidez, tier del mapa, flexibilidad y baja exposición.
- Picks intermedios: priorizan counters y equilibrio de composición.
- Last pick: maximiza el castigo contra los tres picks rivales.
- Durante el turno rival anticipa la siguiente respuesta sin fingir que te toca seleccionar.
- Nueva línea temporal visual con las cuatro fases del draft.

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
