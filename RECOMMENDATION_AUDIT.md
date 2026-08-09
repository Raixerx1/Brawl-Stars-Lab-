# Auditoría de recomendaciones — v0.12.1

## Problema corregido

R-T acumulaba demasiadas bonificaciones por la misma función táctica:

- counter directo de asesinos;
- antidive;
- control;
- mid estable;
- rango;
- Tier S/A editorial del mapa.

Estas bonificaciones se sumaban aunque describieran parcialmente la misma ventaja. En una simulación determinista de 1.443 escenarios, R-T aparecía como recomendación principal en **281 casos (19,5%)**.

## Correcciones del motor

- Bonus de Tier S/A reducido cuando el draft ya contiene información rival.
- Los first picks mantienen la prioridad estructural del mapa.
- Los counters con listas muy amplias reciben una ponderación de especificidad.
- Antidive, antitanque y acceso a artilleros aplican rendimiento decreciente si ya existe un counter directo.
- Las necesidades de composición usan rendimiento decreciente:
  - primera necesidad: bonus completo;
  - segunda: bonus reducido;
  - tercera: bonus pequeño;
  - siguientes: sin apilamiento adicional.
- La alternativa segura incorpora el tier actual y el riesgo, no solo la etiqueta `safe`.
- R-T se retira de ocho Tier A/S de mapa donde no figuraba entre las ocho mejores opciones estructurales.

## Resultado

Auditoría sobre 1.443 escenarios de picks intermedios y last picks:

- R-T como recomendación principal: **44 casos (3,0%)**.
- R-T como alternativa segura: **45 casos (3,1%)**.
- Brawler principal más frecuente: Gale, **18,9%**.
- R-T continúa apareciendo cuando realmente cubre dos amenazas compatibles, por lo que no se ha aplicado una prohibición artificial.

## Control automático

```bash
npm run audit:recommendations
```

La auditoría falla cuando:

- R-T supera el 6% como recomendación principal;
- R-T supera el 8% como alternativa segura;
- R-T desaparece por completo;
- cualquier brawler domina más del 25% de los escenarios.
