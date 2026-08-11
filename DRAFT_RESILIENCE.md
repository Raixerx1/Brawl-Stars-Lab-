# Auditoría de resiliencia del draft v0.14

## Objetivo

Evitar que una recomendación parezca óptima solo con la información visible, pero pierda demasiado valor frente a una respuesta rival previsible.

## Proceso

Para cada estado del draft:

1. Se toman los cinco candidatos principales del motor.
2. Cada candidato se incorpora provisionalmente al equipo aliado.
3. El predictor rival recalcula sus respuestas teniendo en cuenta ese candidato.
4. Se simulan las cuatro respuestas con mayor puntuación.
5. El candidato se vuelve a evaluar contra cada respuesta.

La resiliencia combina:

- 24 % de la puntuación actual;
- 38 % de la media ponderada tras las respuestas;
- 28 % del peor escenario;
- 10 % de la seguridad del candidato;
- penalización por counters directos detectados.

## Regla de estabilidad

La opción más resistente no sustituye automáticamente a la recomendación principal. Si la diferencia de resiliencia es inferior a cinco puntos, se mantiene el pick principal para evitar cambios contradictorios por ruido heurístico.

## Resultado de la auditoría

```text
39 mapas
780 respuestas simuladas
Gale: pick robusto más frecuente, 10/39 mapas
R-T: pick robusto, 5/39 mapas
0 errores
```

R-T conserva valor en Gem Fort, Last Stop, Goldarm Gulch, New Horizons y Layer Cake, pero no domina el sistema. La auditoría falla si supera el 15 % de los mapas o si cualquier brawler supera el 36 %.

## Protecciones

La auditoría falla si:

- falta un pick robusto;
- un candidato se duplica;
- la resiliencia queda fuera de 0–100;
- el peor escenario supera por error a la media;
- no existen respuestas simuladas;
- una misma respuesta se duplica para un candidato;
- un brawler concentra más del 36 % de los mapas;
- R-T supera el 15 %.

## Comando

```bash
npm run audit:resilience
```
