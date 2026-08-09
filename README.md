# Brawl Draft Lab v0.13

Aplicación web competitiva para Brawl Stars Ranked.

## Novedades v0.13

- Selector de cola Ranked:
  - SoloQ;
  - Dúo;
  - Trío premade.
- La selección se conserva localmente y también se comparte mediante la URL.
- El motor adapta el valor de cada brawler al nivel de coordinación.
- SoloQ prioriza picks autosuficientes y penaliza soportes puros.
- Dúo valora sinergias coordinables entre dos jugadores.
- Trío aumenta el valor de soporte, frontline y composiciones planificadas.
- Nueva recomendación de **doble pick** cuando el equipo tiene dos selecciones consecutivas.
- Cada pareja muestra:
  - dos brawlers;
  - puntuación;
  - sinergia;
  - cobertura;
  - coordinación;
  - plan de líneas;
  - razones;
  - riesgos.
- Botones:
  - Usar primero;
  - Simular pareja en SoloQ;
  - Aplicar pareja en Dúo/Trío.
- Tres parejas alternativas para comparar.
- Penalización de roles frágiles duplicados.
- Penalización de parejas sin ancla estable.
- Control de R-T dentro de las parejas para evitar un nuevo sesgo.
- Nueva auditoría:
  - `npm run audit:queue-pairs`
- Informe técnico:
  - `QUEUE_AND_PAIRS.md`

## Novedades v0.12.1

- La recomendación principal aparece **inmediatamente debajo de la barra cronológica de picks**.
- El panel muestra:
  - retrato y nombre;
  - puntuación;
  - explicación breve;
  - dos razones principales;
  - línea recomendada;
  - alternativa segura;
  - alternativa de counter.
- Cuando es tu turno aparece el botón **Usar pick**.
- Durante el turno rival se muestra como recomendación provisional para tu siguiente selección.
- Recalibración del motor para evitar que un brawler generalista acumule varias veces la misma ventaja.
- R-T pasa de aparecer como principal en el 19,5% de los escenarios auditados al 3,0%.
- R-T pasa del 15,8% al 3,1% como alternativa segura en la auditoría completa.
- El motor mantiene R-T cuando realmente counterea dos amenazas compatibles.
- Tier S/A de mapa dependiente de la fase:
  - fuerte en first pick;
  - moderado en picks intermedios;
  - secundario en last pick.
- Rendimiento decreciente para antidive, antitanque y necesidades de composición superpuestas.
- Se retira R-T de ocho Tier S/A antiguos donde no estaba entre los ocho mejores candidatos estructurales.
- Nueva auditoría:
  - `npm run audit:recommendations`
- Informe:
  - `RECOMMENDATION_AUDIT.md`

## Novedades v0.12

- Modelo estructural universal para first picks.
- Los **39 mapas** tienen perfil numérico de:
  - apertura;
  - arbustos;
  - muros;
  - destructibilidad;
  - pasillos;
  - anchura de líneas;
  - agua.
- Se calcula cómo cambia cada mapa después del wallbreak.
- Los **106 brawlers** tienen perfil propio de first pick:
  - seguridad ciega;
  - abierto/cerrado;
  - arbustos;
  - dependencia de muros;
  - rendimiento tras ruptura;
  - visión;
  - wallbreak;
  - antidive;
  - movilidad;
  - objetivo;
  - control;
  - dependencia del equipo;
  - riesgo de counter.
- Cada mapa guarda:
  - tres first picks auditados;
  - cinco alternativas estructurales;
  - puntuación editorial 0–100;
  - fortalezas y riesgos.
- El top 3 auditado prevalece cuando no está baneado.
- `Solo pool` sigue excluyendo brawlers no disponibles.
- Cuando el draft avanza, counters y composición vuelven a tener prioridad.
- La ficha del mapa muestra estado inicial y estado estimado tras romper muros.
- El Draft Assistant muestra apertura, arbustos, muros, ruptura y pasillos.
- Las recomendaciones muestran encaje inicial, robustez tras wallbreak, seguridad ciega y utilidad del modo.
- Revisión específica de first picks que dependían demasiado de muros:
  - Rico deja de ser prioridad ciega en Pinball Dreams, Penalty Kick, Gem Fort, Hot Potato y Pit Stop.
  - Sprout deja de ser first pick en Layer Cake por su pérdida de valor tras wallbreak.
- Rustic Arcade mantiene **Piper, 8-Bit y Brock**; Sandy continúa como opción situacional.
- Nueva auditoría:
  - `npm run audit:first-pick-model`
- Informe técnico:
  - `FIRST_PICK_MODEL.md`

## Novedades v0.11

- Nueva **tier list visual** en la parte superior de Meta.
- Dos vistas:
  - Meta de las últimas 24 horas.
  - General de los últimos 30 días.
- Todos los brawlers aparecen agrupados en S, A, B, C, D, F o Sin datos.
- Los nerfs oficiales del 04/08/2026 permanecen debajo de la tier list.
- La tier list global no sustituye la evaluación específica de cada mapa.
- Revisión manual de matchups recientes.
- Bolt corregido:
  - castiga a Piper, Belle, Mandy, Brock y Angelo;
  - es frenado por Gale, Damian, Charlie, Otis y Lou.
- Razones específicas para los matchups revisados, por encima de explicaciones genéricas por rol.
- Auditoría de los **39 mapas** para revisar first picks.
- Rustic Arcade reclasificado como mapa abierto.
- First picks de Rustic Arcade: **Piper, 8-Bit y Brock**.
- Sandy deja de aparecer como prioridad ciega en Rustic Arcade.
- El motor de draft da prioridad explícita a los first picks auditados.
- Penalización de corto alcance, asesinos y tanques expuestos como first pick en mapas abiertos.
- Nuevos comandos:
  - `npm run audit:matchups`
  - `npm run audit:first-picks`
  - `npm run audit:all`
- Informes técnicos:
  - `MATCHUP_AUDIT.md`
  - `FIRST_PICK_AUDIT.md`

## Novedades v0.10

- Aprendizaje local de detecciones automáticas.
- Botones **Correcto** y **Falso** en cada comentario.
- Las correcciones ajustan gradualmente la confianza de futuras detecciones del mismo tipo.
- Priors conservadores para evitar que una única corrección modifique demasiado el sistema.
- Supresión progresiva de detecciones con historial repetidamente negativo.
- Indicador de precisión revisada, pendientes, correctas y falsas.
- Botón para restaurar el aprendizaje visual.
- Detección de salud de la captura:
  - calibrando;
  - buena;
  - estática;
  - inestable.
- Recalibración manual sin reiniciar la partida.
- Nuevo análisis temporal por secuencias:
  - interacción intensa seguida de muerte;
  - super seguida de muerte;
  - muerte seguida de cambio de objetivo;
  - super seguida de cambio de objetivo;
  - muerte poco después de reaparecer;
  - dos muertes en una ventana corta.
- Los comentarios de secuencia se diferencian de los derivados de un solo fotograma.
- El resumen postpartida incorpora entradas castigadas, muertes costosas y supers sin conversión.
- Las sesiones guardan número de secuencias y estadísticas de feedback.

### Cómo entrenar Auto Review

1. Mantén sensibilidad **Media**.
2. Marca como **Correcto** las detecciones útiles.
3. Marca como **Falso** los errores; se eliminan del resumen.
4. Acumula varias correcciones antes de cambiar la sensibilidad.
5. Usa **Restaurar aprendizaje visual** si cambias radicalmente la forma de compartir la pantalla.

## Novedades v0.9

- **Auto Review Beta** dentro de la sección de análisis en directo.
- Muestreo local de la pantalla cada 650 ms.
- Calibración automática inicial de ocho fotogramas.
- Detección heurística de:
  - oscurecimiento central compatible con muerte;
  - recuperación compatible con reaparición;
  - uso probable de super;
  - cambios relevantes en el HUD del objetivo;
  - cambios de fase o ronda;
  - interacciones de combate intensas.
- Eventos automáticos añadidos a la cronología con porcentaje de confianza.
- Comentarios tácticos generados en directo.
- Opción de reproducir comentarios mediante voz del navegador.
- Sensibilidad baja, media o alta.
- Los falsos positivos pueden descartarse y se eliminan también de la cronología.
- El resumen postpartida incorpora los eventos detectados automáticamente.
- Live Reviews guardados con configuración y número de detecciones automáticas.
- Procesamiento completamente local sin subida automática de vídeo o fotogramas.

### Alcance de Auto Review Beta

La v0.9 utiliza diferencias entre fotogramas, luminosidad, saturación y actividad en regiones de la interfaz. No emplea todavía un modelo entrenado para reconocer personajes, texto o posiciones exactas. Por ello, los eventos se presentan como detecciones probables y deben revisarse antes de guardar la sesión.

La precisión mejora cuando:

- se comparte únicamente la ventana del juego;
- la imagen mantiene la misma escala;
- no hay notificaciones superpuestas;
- la calibración comienza con la partida visible;
- se utiliza sensibilidad media como configuración inicial.

## Novedades v0.8.1

- Auditoría completa de la sección Counters.
- Bolt confirmado dentro del roster interno.
- 106 brawlers visibles, sin depender de que el perfil táctico esté completo.
- Buscador por nombre y rol.
- Filtro específico por rol.
- Listado alfabético completo y desplazable.
- Contador visible de brawlers mostrados frente al total.
- Indicadores de cobertura:
  - brawlers con counters;
  - brawlers con amenazas;
  - referencias de matchup rotas.
- Acceso directo mediante `?brawler=slug`.
- Nuevo comando `npm run audit:roster`.
- Informe técnico `ROSTER_AUDIT.md`.

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
