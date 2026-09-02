export type PatchImpact = { direction: "down" | "up"; label: string; summary: string };

export const latestPatchInfo = {
  liveBalanceDate: "01/09/2026",
  clientVersion: "69.230",
  reviewedAt: "02/09/2026",
  rankedEvidenceThrough: "02/09/2026",
  update69AnnouncedAt: "29/08/2026",
  update69BalanceStatus: "Update 69 live; primera calibración observada del 02/09 activa con control de estabilidad",
  upcomingBalanceActivation: "ACTIVO desde 01/09/2026; recalibrado el 02/09 con muestra temprana top-200",
  postPatchEvidenceStatus: "Muestra postparche temprana disponible; todavía volátil para brawlers de poco uso",
} as const;

/**
 * Impactos visibles de Update 69. La dirección procede del parche oficial y
 * la lectura se calibra con la primera muestra del 02/09; no representa un
 * porcentaje de victoria individual ni sustituye el contexto de draft.
 */
const impacts: Record<string, PatchImpact> = {
  Bea: { direction: "up", label: "Buff U69", summary: "Gadget más disponible y más daño de súper; mejora contextual aún con poco volumen postparche." },
  Buster: { direction: "up", label: "Buff U69", summary: "Más curación y daño condicionado; sube con prudencia, sin señal suficiente para un tier alto." },
  Clancy: { direction: "up", label: "Buff U69", summary: "Mejor tempo para alcanzar fase 2, compensado por una fase 3 más lenta; lectura mixta ligeramente favorable." },
  Colette: { direction: "up", label: "Buff U69", summary: "Recupera parte de su ciclo de súper y gana valor contextual, especialmente contra objetivos de mucha vida." },
  Eve: { direction: "up", label: "Buff U69", summary: "Más hatchlings y mejor ciclo; gana presión específica contra rivales de disparo único." },
  Hank: { direction: "up", label: "Buff U69", summary: "Mejora de supervivencia; promoción conservadora pendiente de datos por mapa." },
  Jacky: { direction: "up", label: "Buff U69", summary: "Mejora defensiva; sigue dependiendo mucho de mapas cerrados y del matchup." },
  "Jae-Yong": { direction: "up", label: "Buff U69", summary: "Mejoras de sustain/tempo; prior al alza sin asumir todavía un tier alto observado." },
  Janet: { direction: "up", label: "Buff U69", summary: "El aumento de daño mejora su presión, aunque la primera muestra sigue siendo demasiado pequeña para elevarla más." },
  Jessie: { direction: "up", label: "Buff U69", summary: "Mejora de la torreta y mejor presión sostenida; gana prioridad en control y objetivos." },
  Leon: { direction: "up", label: "Buff U69", summary: "Mejoras de utilidades ofensivas; gana valor como respuesta de draft y presión lateral." },
  Lola: { direction: "up", label: "Buff U69", summary: "El Ego acompaña mejor el movimiento de Lola; gana consistencia sin convertirse en pick universal." },
  Maisie: { direction: "up", label: "Buff U69", summary: "Mejor daño/amenaza a rango medio; promoción conservadora hasta ver consistencia post-parche." },
  Melodie: { direction: "up", label: "Sube U69", summary: "Vida y Perfect Pitch mejoran su tempo; la primera muestra confirma una subida clara, sobre todo en objetivos." },
  Tara: { direction: "up", label: "Buff U69", summary: "Mejoras de sombras y sustain; mayor presión de control y teamfight." },
  Ziggy: { direction: "up", label: "Buff U69", summary: "Mejor ciclo de súper; mantiene ajuste al alza con confianza baja por volumen." },

  Ash: { direction: "down", label: "Nerf U69", summary: "Pierde carga de súper al recibir daño; la muestra temprana respalda una caída moderada." },
  Bolt: { direction: "down", label: "Nerf U69", summary: "La aceleración reducida rebaja su tempo; no se sobreponderan resultados aislados de escalera." },
  Griff: { direction: "down", label: "Nerf U69", summary: "Nuevo recorte de ciclo/utilidad; deja de tratarse como S global automático." },
  Lumi: { direction: "down", label: "Nerf U69", summary: "Menos daño de retorno; baja a valor de control contextual." },
  Max: { direction: "down", label: "Nerf U69", summary: "Súper y gadgets pierden frecuencia; la señal 24 h confirma que sale del núcleo S." },
  Meg: { direction: "down", label: "Nerf U69", summary: "Toolbox y Force Field pierden disponibilidad y escudo; baja con moderación." },
  Nori: { direction: "down", label: "Nerf · aún fuerte", summary: "Menos vida, daño y frecuencia de gadget; sigue arriba en la muestra temprana, pero con más riesgo al entrar." },
  Rico: { direction: "down", label: "Nerf U69", summary: "Menos velocidad y peores gadgets defensivos; baja globalmente, pero conserva mapas de rebote." },
  Ruffs: { direction: "down", label: "Nerf U69", summary: "Peor ciclo de súper; fuerte caída del prior global hasta ver el comportamiento por mapa." },
  Wendy: { direction: "down", label: "Nerf U69 · sigue arriba", summary: "La muestra temprana sigue situándola arriba, pero el generador y el ciclo más débiles reducen claramente su seguridad de first pick." },

  Poco: { direction: "up", label: "Buffie U69", summary: "Nuevo paquete Buffie. Se vigila sin promocionarlo automáticamente hasta confirmar disponibilidad/rendimiento Ranked." },
  "El Primo": { direction: "up", label: "Buffie U69 · señal ↑", summary: "La primera muestra confirma una subida fuerte, limitada en el motor a mapas cerrados y modos de presión." },
  Amber: { direction: "up", label: "Buffie U69 · señal ↑", summary: "El control de aceite y la movilidad ya muestran impacto; gana prioridad en Zona, Gemas y Atraco." },
  Gus: { direction: "up", label: "Buffie U69 · señal ↑", summary: "El control de munición y knockback mejoran su antidive, con especial valor en Noqueo y Caza." },
  Shade: { direction: "up", label: "Buffie U69 · señal fuerte", summary: "El cambio de kit y la muestra temprana coinciden; sube a la primera línea del meta en mapas con cobertura." },
};

export const patchImpactFor = (name: string) => impacts[name];
