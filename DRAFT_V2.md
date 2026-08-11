# Motor de Draft 2.0 — v0.15

## Objetivo

La v0.15 elimina dos fuentes de recomendaciones engañosas: los ordenamientos rígidos aplicados después del score y la suposición de que un mapa rompible terminará necesariamente abierto.

## Score normalizado

Cada candidato recibe métricas 0–100 de meta, mapa, counter, composición, sinergia, seguridad, preparación personal y riesgo. La fase modifica los pesos:

- first pick: mapa y seguridad;
- pick intermedio: counter, composición, mapa y meta;
- last pick: counter confirmado, composición y riesgo, sin ignorar el meta actual.

El score resultante es la primera clave de ordenación. La cobertura, el riesgo y el orden editorial solo resuelven empates.

## Estado real del campo

`destructibility` representa lo fácil que es romper los muros, no la probabilidad de que ocurra. El modelo calcula:

1. `initialFit`: rendimiento con el mapa intacto;
2. `afterBreakFit`: rendimiento si el campo se abre;
3. `openingProbability`: probabilidad condicionada por destructibilidad, modo y capacidad propia de wallbreak;
4. `expectedMapFit`: media ponderada de ambos estados.

La fórmula de apertura limita la contribución del rival y solo sube de forma clara cuando el propio pick puede forzar el cambio. Si el escenario abierto es mucho mejor pero tiene menos de un 30% de probabilidad, se añade riesgo y una advertencia visible.

## Diagnóstico visible

- Desglose de seis señales por recomendación.
- Matriz contra cada enemigo: ventaja clara, ventaja, neutral, riesgo o desventaja.
- Confianza 0–100 con margen sobre la segunda opción y cautelas.
- Checklist proyectado de las funciones que quedan cubiertas, parciales o ausentes.

## Validación

`scripts/audit-draft-v2.mjs` compila el motor y comprueba:

- 4.134 combinaciones de mapa y brawler para el modelo de apertura;
- que una apertura improbable no domine el valor esperado;
- métricas y scores dentro de 0–100;
- ranking ordenado por el score final;
- matrices completas para los picks rivales;
- confianza y checklist presentes;
- concentración máxima de first picks.

La batería completa conserva además las auditorías de roster, matchups, first picks editoriales, diversidad, colas, parejas y resiliencia.
