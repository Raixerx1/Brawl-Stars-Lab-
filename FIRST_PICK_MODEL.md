# Modelo estructural de first picks — v0.12

## Cobertura

- **39 mapas** con perfil geométrico completo.
- **106 brawlers** con perfil de seguridad como first pick.
- **15 dimensiones por brawler**.
- **7 dimensiones físicas por mapa**, más la transformación estimada tras wallbreak.
- Cada mapa guarda tres first picks principales y cinco alternativas.

## Perfil de mapa

Cada mapa se evalúa de 0 a 100 en:

- Apertura.
- Densidad de arbustos.
- Densidad de muros.
- Destructibilidad.
- Densidad de pasillos.
- Anchura de líneas.
- Influencia del agua.

También se estima cómo queda el mapa tras romper estructuras:

- Apertura posterior.
- Muros restantes.
- Importancia de visión.
- Impacto del wallbreak.

## Perfil de brawler

Cada brawler se evalúa de 0 a 100 en:

- Seguridad a ciegas.
- Encaje en abierto.
- Encaje en cerrado.
- Encaje en arbustos.
- Dependencia de muros.
- Rendimiento tras wallbreak.
- Visión.
- Capacidad de romper muros.
- Antidive.
- Movilidad.
- Presión sobre el objetivo.
- Control.
- Control de pasillos.
- Dependencia del equipo.
- Riesgo de recibir counters.

## Criterio de recomendación

El modelo cruza:

1. Encaje con la geometría inicial.
2. Rendimiento cuando el mapa se abre.
3. Seguridad como elección ciega.
4. Utilidad específica del modo.
5. Afinidad editorial del brawler con el modo.
6. Meta global como ajuste secundario.

La tier global nunca sustituye el análisis del mapa.

## Control editorial

El top 3 de cada mapa se revisa editorialmente. El motor:

- respeta ese top 3 si los brawlers están disponibles;
- elimina automáticamente bans y restricciones de `Solo pool`;
- usa el modelo estructural para ordenar el resto de alternativas;
- sigue aplicando counters y composición cuando ya existen picks rivales.

## Auditorías

```bash
npm run audit:first-picks
npm run audit:first-pick-model
npm run audit:all
```

La auditoría bloquea:

- mapas sin geometría;
- brawlers sin perfil;
- valores fuera de 0–100;
- first picks inexistentes o duplicados;
- picks excesivamente dependientes de muros en mapas con wallbreak decisivo;
- mapas abiertos sin suficiente robustez a distancia;
- mapas de arbustos sin visión o bush fit suficiente.
