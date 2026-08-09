# Cola Ranked y doble pick — v0.13

## Objetivo

Adaptar el Draft Coach al nivel real de coordinación del equipo y aprovechar correctamente las fases de dos picks consecutivos.

## Modos de cola

### SoloQ

- Prioriza autonomía.
- Aumenta el peso de seguridad, carry propio y bajo riesgo.
- Penaliza soportes puros sin daño o conversión propia.
- Penaliza parejas demasiado dependientes de coordinación.

### Dúo

- Mantiene autonomía, pero permite sinergias entre dos jugadores.
- Aumenta el valor de soporte + carry y de roles complementarios.
- Favorece parejas fáciles de coordinar.

### Trío

- Reduce la penalización por dependencia del equipo.
- Aumenta el valor de soportes, control y composiciones planificadas.
- Premia la coordinación entre frontline, backline y soporte.

## Motor de doble pick

Cuando las dos siguientes selecciones pertenecen al equipo aliado, el sistema evalúa parejas completas:

- calidad individual de ambos picks;
- cobertura contra rivales;
- complementariedad de roles;
- rango + frontline;
- artillero + antidive;
- soporte + carry;
- visión en mapas de arbustos;
- wallbreak en mapas destructibles;
- control del objetivo;
- plan de líneas;
- riesgo compartido frente a un mismo counter.

Cada pareja muestra:

- puntuación total;
- sinergia;
- cobertura;
- coordinación;
- plan de líneas;
- razones y riesgos.

## Control de calidad

La auditoría prueba 468 escenarios por cada tipo de cola.

Resultados de referencia:

- SoloQ: soporte 8,8% · coordinación 58,7 · R-T 7,2%.
- Dúo: soporte 19,0% · coordinación 74,2 · R-T 2,6%.
- Trío: soporte 29,0% · coordinación 95,9 · R-T 1,1%.

La auditoría falla si:

- aparecen parejas con el mismo brawler;
- una pareja duplica un rol frágil;
- R-T supera el 10% de los puestos de pareja;
- Dúo no aumenta la coordinación frente a SoloQ;
- Trío no aumenta la coordinación frente a Dúo;
- los soportes no ganan valor progresivamente con más coordinación.

## Comando

```bash
npm run audit:queue-pairs
```
