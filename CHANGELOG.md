# Changelog

## v0.33.2 — Cabecera vegetal responsive

- Sustituido el wordmark JPG con fondo blanco por una composición nativa sin fondo claro.
- Crow conserva el icono oficial de la app dentro de una superficie oscura integrada.
- “Kanna Draft” usa degradados, brillo y detalles de hoja en tonos verdes.
- La marca ocupa más ancho útil tanto en móvil como en escritorio.
- Añadidos ajustes específicos para 320–430 px sin solapar el menú ni el estado del meta.
- Animación ornamental desactivada automáticamente cuando el sistema solicita reducir movimiento.
- Caché PWA renovada para servir la nueva cabecera al reabrir la app.

## v0.17 — Jerarquía única de picks

- Pick principal grande justo debajo de los seis huecos del draft.
- Cuatro alternativas visibles y numeradas por prioridad del #2 al #5.
- Mayor contraste, retrato, nombre, score y botón de selección para la prioridad #1.
- Eliminado el bloque antiguo de tres tarjetas que duplicaba y confundía las recomendaciones.
- La sección inferior queda reservada al análisis y a la build del pick principal.
- Caché de la aplicación renovada para evitar que el navegador conserve la interfaz anterior.

## v0.16 — Decisión de pick y Auto Review Scorecard

- Jerarquía visual nueva para que el pick #1 sea inequívoco.
- Botón de confirmación dominante y cuatro alternativas compactas al lado.
- Cada alternativa mantiene score, categoría y acceso directo para seleccionarla.
- Marcador Auto Review 0–100 con posicionamiento, recursos, objetivo y tempo.
- Regularización por cantidad de evidencia para no exagerar muestras pequeñas.
- Las detecciones rechazadas se excluyen del cálculo.
- Cobertura de revisión y momento clave visibles.
- Detección temporal de presión convertida y matchup corregido.
- Auditoría determinista de escenarios favorables, críticos, feedback y secuencias.

## v0.15 — Motor de Draft 2.0

- Ranking gobernado por el score normalizado, sin ordenamientos rígidos posteriores.
- Métrica de meta explícita y pesos adaptados a cada fase del draft.
- Mayor peso del meta actual en picks intermedios y last pick para evitar falsos counters fuera de parche.
- Dos estados del mapa: inicial y posterior al wallbreak.
- Probabilidad de apertura condicionada al modo y a las herramientas propias, no solo a la destructibilidad.
- Valor esperado de mapa que penaliza recomendaciones dependientes de una apertura improbable.
- Matriz de matchups, confianza y checklist de composición visibles.
- Meta de 24 h y 30 d actualizado al 11/08/2026.
- R-T reducido al 1,3% como recomendación principal en 1.443 escenarios de balance.
- Diversidad de first picks: siete ganadores distintos en los 39 mapas; máximo 11 mapas para un mismo brawler.
- Resiliencia recalibrada: el pick más frecuente queda en 14 de 39 mapas.
- Auditoría específica del Motor de Draft 2.0.

## v0.14 — Resiliencia frente a counters

- Prueba de estrés de los cinco candidatos principales.
- Cuatro respuestas rivales condicionadas a cada candidato.
- Puntuación de resiliencia, media y peor escenario.
- Detección de counters directos y pérdida de puntuación.
- Veredictos Blindado, Estable, Vigilable y Frágil.
- Umbral de mejora para evitar recomendaciones contradictorias por diferencias pequeñas.
- Acción rápida para usar el pick robusto.
- Dos alternativas resistentes comparables.
- Auditoría de 780 respuestas en los 39 mapas.
- Control específico de concentración de R-T.
- Corrección del tipado de las métricas estructurales de mapa.
- Compilación de producción validada: 159 páginas estáticas.

## v0.13 — Cola Ranked y doble pick

- Modos SoloQ, Dúo y Trío.
- Ajustes de autonomía y coordinación en el motor.
- Recomendaciones de pareja para fases de dos picks.
- Métricas de sinergia, cobertura y coordinación.
- Plan de líneas para cada pareja.
- Aplicación o simulación automática de ambos picks.
- Auditoría de diversidad y progresión de soportes por cola.

## v0.12.1 — Recomendación inmediata y equilibrio

- Recomendación principal colocada justo debajo de los picks.
- Acción rápida para confirmar el brawler recomendado.
- Alternativas y línea visibles sin desplazarse por la página.
- Bonificaciones de counter y composición con rendimiento decreciente.
- Tier editorial ponderado según la fase del draft.
- Corrección del exceso de recomendaciones de R-T.
- Auditoría automática de diversidad de recomendaciones.

## v0.12 — Modelo estructural de first picks

- Perfiles físicos para los 39 mapas.
- Perfiles de first pick para los 106 brawlers.
- Cálculo de estado inicial y posterior al wallbreak.
- Modelo de seguridad ciega, rango, visión, antidive y dependencia del equipo.
- Tres picks auditados y cinco alternativas por mapa.
- Razones y riesgos visibles en Draft Assistant y fichas de mapa.
- Revisión de picks frágiles frente a wallbreak.
- Nuevas auditorías de geometría y cobertura universal.

## v0.11 — Tier list, counters y first picks

- Tier list visual actual con vistas 24 h y 30 d.
- Nerfs oficiales conservados debajo de la tier list.
- Matchups de Bolt corregidos y explicaciones específicas.
- Doce perfiles recientes revisados manualmente.
- Auditoría de los 39 mapas y de sus first picks.
- Rustic Arcade reclasificado como abierto: Piper, 8-Bit y Brock.
- El motor prioriza los first picks auditados y penaliza picks ciegos vulnerables.
- Auditorías automatizadas y dos informes técnicos nuevos.

## v0.10 — Auto Review adaptativo

- Feedback correcto/falso por detección.
- Ajuste local de confianza por tipo de evento.
- Supresión de falsos positivos recurrentes.
- Indicadores de precisión revisada.
- Restauración del aprendizaje visual.
- Salud de la captura y recalibración manual.
- Motor de inferencia temporal por secuencias.
- Nuevos comentarios sobre muertes costosas, reentradas y supers sin conversión.
- Resumen y sesiones ampliados con métricas de secuencia.

## v0.9 — Auto Review Beta

- Motor local de análisis de fotogramas.
- Calibración adaptativa y tres niveles de sensibilidad.
- Detección probable de muerte, reaparición, super, objetivo, fase y combate.
- Comentarios automáticos con confianza.
- Síntesis de voz opcional.
- Eventos automáticos integrados en cronología y resumen.
- Eliminación conjunta de comentarios y falsos positivos.
- Metadatos de análisis guardados en cada Live Review.
- Sin transmisión automática del vídeo.

## v0.8.1 — Roster completo en Counters

- Sustituido el selector nativo por buscador y listado completo.
- Añadido filtro por rol.
- Los 106 brawlers internos aparecen aunque tengan un perfil base.
- Bolt verificado con counters y amenazas.
- Auditoría automática de duplicados, perfiles vacíos y referencias rotas.
- Añadidos contador de cobertura, URL directa e informe técnico.

## v0.8 — Live Review

- Captura local de pantalla o ventana.
- Vista de vídeo en directo sin subida automática.
- Cronómetro y marcadores temporales.
- Atajos de teclado para eventos frecuentes.
- Captura manual de fotogramas.
- Resumen postpartida automático basado en eventos.
- Historial local de revisiones.
- Exportación JSON.
- Integración con Aprendizaje personal.
- Navegación y portada actualizadas.

## v0.7 — Aprendizaje personal

- Historial de partidas tipado y compatible con registros anteriores.
- Ajuste del motor mediante rendimiento personal con regularización por muestra.
- Guardado de resultados desde el Draft Coach.
- Dashboard por brawler, rol y mapa.
- Importación, exportación y borrado de partidas.
- Indicadores personales dentro de las recomendaciones.

## v0.6 — Simulación del rival

- Predicción de hasta seis picks rivales probables.
- Simulación de cualquier brawler enemigo.
- Respuesta recomendada y alternativas.
- Comparación del impacto sobre la probabilidad estimada.
- Confirmación del escenario como pick real.
- Conversión rápida de una amenaza en ban.
- Bans sugeridos por mapa y protección de aliados.
- Mejorada la predicción para cubrir necesidades de composición rival.

## v0.5.2 — Pool agrupado por rol

- Opción para agrupar o desagrupar el pool.
- Secciones plegables por rol.
- Contador de disponibles por categoría.
- Preferencia de visualización persistente.

## v0.5.1 — Panel de bans

- Panel compacto de hasta seis bans.
- Exclusión automática en buscador y recomendaciones.
- Bans incluidos en el enlace compartido.
- Limpieza conjunta al reiniciar o cambiar de mapa.

## v0.5 — Draft personalizado

- Pool desactivado, preferente o estricto.
- Favoritos y ponderación de dominio.
- Builds contextuales.
- Modo ultrarrápido.
- Importación, exportación y acciones masivas en Mi pool.
- Estado de preparación visible en las recomendaciones.

## v0.4.5 — Barra única de picks

- Flujo cronológico único para los seis picks.
- Entrada común para añadir cada brawler en orden.
- Colores aliados y rivales adaptados al first pick.
- Recomendaciones justo debajo del draft.
- Estimación de victoria por equipos.
- Consejos, líneas y matchups simplificados.
- Eliminados los cuatro paneles de entrada independientes.

## v0.4.4 — Orden competitivo real

- Secuencia 1–2–2–1 del draft competitivo.
- First pick aliado o rival configurable.
- Detección automática de turno y posición.
- First pick orientado a solidez del mapa.
- Picks intermedios orientados a counter y composición.
- Last pick orientado al máximo castigo.
- Timeline visual de las cuatro fases.

## v0.4.3 — Counter primero

- Reponderación completa del motor hacia counters directos.
- Bonus por counterear dos o tres picks rivales.
- Penalizaciones mayores por matchups desfavorables.
- Selector Counter / Equilibrado / Seguro.
- Matriz visual de matchup contra cada rival.
- Respuestas de arquetipo y etiquetas de cobertura.
- Estimación de victoria más sensible a counters.
- Nueva caché PWA con navegación network-first.

## v0.4.2 — Mi pick y estimación de victoria

- Cuarto bloque para introducir el pick propio.
- Evaluación táctica del pick seleccionado.
- Estimador dinámico del resultado del draft.
- Intervalo, confianza, completitud y puntuación de ambos equipos.
- Factores favorables y riesgos explicados.
- El modelo evita presentar la estimación como dato estadístico real.

## v0.4.1 — Pool Ranked completo

- Añadidos 11 mapas que faltaban.
- New Horizons incorporado a Noqueo.
- 33 mapas marcados como pool Ranked actual.
- 6 mapas anteriores marcados como históricos.
- Filtros por estado de rotación y alias españoles.
- Draft Coach prioriza mapas actuales.

## 0.2.0 — 06/08/2026

- Actualización al mantenimiento y balance del 04/08/2026.
- Separación entre balance general y cambios de NanoPowers.
- 1.060 relaciones de matchup nominales.
- Nueva ruta de counters.
- Imágenes de brawlers y mapas mediante BrawlAPI/Brawlify.
- Mejoras visuales en inicio, cartas, fichas y Draft Assistant.
- Motor de draft con bonificaciones y penalizaciones por counter directo.
- Actualización PWA y caché v0.2.

## v0.3.0 — Draft Assistant adaptativo
- Recomendaciones recalculadas en tiempo real al añadir o quitar aliados, rivales y bans.
- Selector visual de brawlers con búsqueda, retratos y slots de draft.
- Detección automática de first pick, pick intermedio y last pick.
- Tres salidas diferenciadas: mejor pick, pick seguro y counter/cierre.
- Diagnóstico de necesidades, amenazas y fortalezas de la composición.
- Métricas separadas de mapa, counters, sinergia, composición, seguridad y riesgo.
- Línea y plan de partida específicos para la recomendación principal.
- Ranking adaptativo de ocho alternativas.
