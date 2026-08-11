# Auto Review v0.16

## Objetivo

Auto Review ya no se limita a enumerar detecciones. La v0.16 convierte los eventos revisados y las secuencias temporales en una evaluación accionable de la partida.

## Marcador de ejecución

El scorecard calcula cuatro dimensiones entre 0 y 100:

- **Posicionamiento:** rotaciones, cambios de línea, matchups, sobreextensiones y entradas castigadas.
- **Recursos:** supers e hipercargas decisivas, desperdiciadas o sin conversión.
- **Objetivo:** progreso ganado o perdido, presión convertida y muertes con coste.
- **Tempo:** eliminaciones, muertes, rotaciones y cadenas de reentrada.

Las puntuaciones parten de una base neutral y se regularizan según la cantidad de evidencia. Una única detección no puede transformar por sí sola la evaluación completa.

## Calidad del análisis

- Los eventos manuales y las detecciones confirmadas tienen peso completo.
- Las detecciones pendientes se ponderan por confianza.
- Los falsos positivos rechazados se excluyen.
- La cobertura de revisión muestra qué porcentaje de eventos automáticos ya ha sido evaluado por el usuario.

## Momento clave

El sistema ordena los eventos por impacto táctico y confianza. Prioriza muertes con coste de objetivo, cadenas de muertes, supers sin conversión, objetivos ganados y recursos decisivos.

## Secuencias nuevas

- **Presión convertida:** una interacción intensa seguida de un cambio de objetivo sin muerte propia cercana.
- **Matchup corregido:** un cambio de línea poco después de registrar un matchup desfavorable.

## Auditoría

`scripts/audit-auto-review-v16.mjs` valida:

- separación suficiente entre una sesión favorable y una crítica;
- selección correcta del momento clave;
- exclusión de falsos positivos rechazados;
- cobertura de revisión;
- detección de las dos secuencias nuevas;
- estabilidad del estado sin datos.
