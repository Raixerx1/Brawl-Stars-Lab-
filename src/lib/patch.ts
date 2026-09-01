export type PatchImpact = { direction: "down" | "up"; label: string; summary: string };

export const latestPatchInfo = {
  liveBalanceDate: "01/09/2026",
  clientVersion: "69.230",
  reviewedAt: "01/09/2026",
  rankedEvidenceThrough: "30/08/2026",
  update69AnnouncedAt: "29/08/2026",
  update69BalanceStatus: "Update 69 live; prior competitivo de día 1 activo mientras entra muestra Ranked post-parche",
  upcomingBalanceActivation: "ACTIVO desde 01/09/2026 como prior provisional; sustituir por evidencia post-parche cuando sea suficiente",
  postPatchEvidenceStatus: "Todavía insuficiente para llamar tier observado al modelo 01/09",
} as const;

/**
 * Impactos visibles de Update 69. No son porcentajes de victoria observados:
 * funcionan como señal de dirección para la interfaz mientras el motor acumula
 * evidencia Ranked posterior a 69.230.
 */
const impacts: Record<string, PatchImpact> = {
  Bea: { direction: "up", label: "Buff U69", summary: "Ajustes favorables de kit; prior competitivo al alza hasta disponer de muestra post-parche." },
  Buster: { direction: "up", label: "Buff U69", summary: "Mejoras de utilidad/daño condicionado; sube un escalón de forma prudente en el modelo de día 1." },
  Clancy: { direction: "up", label: "Buff U69", summary: "Mejoras de tempo con contrapesos de fase; lectura provisional ligeramente favorable." },
  Colette: { direction: "up", label: "Buff U69", summary: "Recupera parte de su ciclo de súper y gana valor contextual, especialmente contra objetivos de mucha vida." },
  Eve: { direction: "up", label: "Buff U69", summary: "Más presión del súper y mejor capacidad de ciclo; prior competitivo al alza." },
  Hank: { direction: "up", label: "Buff U69", summary: "Mejora de supervivencia; promoción conservadora pendiente de datos por mapa." },
  Jacky: { direction: "up", label: "Buff U69", summary: "Mejora defensiva; sigue dependiendo mucho de mapas cerrados y del matchup." },
  "Jae-Yong": { direction: "up", label: "Buff U69", summary: "Mejoras de sustain/tempo; prior al alza sin asumir todavía un tier alto observado." },
  Janet: { direction: "up", label: "Buff U69", summary: "Mejor presión de ataque; sube de forma prudente en la capa de día 1." },
  Jessie: { direction: "up", label: "Buff U69", summary: "Mejora de la torreta y mejor presión sostenida; gana prioridad en control y objetivos." },
  Leon: { direction: "up", label: "Buff U69", summary: "Mejoras de utilidades ofensivas; gana valor como respuesta de draft y presión lateral." },
  Lola: { direction: "up", label: "Buff U69", summary: "Ajustes favorables de control del Ego; prior competitivo moderadamente al alza." },
  Maisie: { direction: "up", label: "Buff U69", summary: "Mejor daño/amenaza a rango medio; promoción conservadora hasta ver consistencia post-parche." },
  Melodie: { direction: "up", label: "Buff U69", summary: "Mejoras de supervivencia y movilidad/tempo; pasa a ser una de las subidas prioritarias a vigilar." },
  Tara: { direction: "up", label: "Buff U69", summary: "Mejoras de sombras y sustain; mayor presión de control y teamfight." },
  Ziggy: { direction: "up", label: "Buff U69", summary: "Mejor ciclo de súper; lectura provisional al alza." },

  Ash: { direction: "down", label: "Nerf U69", summary: "Pierde parte del ciclo de súper; prior competitivo ligeramente a la baja." },
  Bolt: { direction: "down", label: "Nerf U69", summary: "Menor aceleración/tempo; cae un escalón en el modelo de día 1." },
  Griff: { direction: "down", label: "Nerf U69", summary: "Nuevo recorte de ciclo/utilidad; deja de tratarse como S global automático." },
  Lumi: { direction: "down", label: "Nerf U69", summary: "Menos presión de daño de retorno; prior competitivo a la baja." },
  Max: { direction: "down", label: "Nerf U69", summary: "Más castigo a su ciclo de gadgets/tempo; baja de S global provisionalmente." },
  Meg: { direction: "down", label: "Nerf U69", summary: "Menos valor de utilidad/escudo; prior competitivo ligeramente a la baja." },
  Nori: { direction: "down", label: "Nerf U69", summary: "Menos supervivencia y peor frecuencia de recursos; su futura hipercarga se monitoriza por separado." },
  Rico: { direction: "down", label: "Nerf U69", summary: "Recortes a recursos defensivos/ciclo; baja un escalón de forma provisional." },
  Ruffs: { direction: "down", label: "Nerf U69", summary: "Peor ciclo de súper; fuerte caída del prior global hasta ver el comportamiento por mapa." },
  Wendy: { direction: "down", label: "Nerf U69", summary: "Generador/escudo y ciclo más contenidos; pierde seguridad de first pick aunque sigue siendo competitiva." },

  Poco: { direction: "up", label: "Buffie U69", summary: "Nuevo paquete Buffie. Se vigila sin promocionarlo automáticamente hasta confirmar disponibilidad/rendimiento Ranked." },
  "El Primo": { direction: "up", label: "Buffie U69", summary: "Nuevo paquete Buffie. Potencial de subida alto en mapas cerrados, todavía sin muestra estable." },
  Amber: { direction: "up", label: "Buffie U69", summary: "Nuevo paquete Buffie y cambios de aceite; watchlist de Update 69." },
  Gus: { direction: "up", label: "Buffie U69", summary: "Nuevo paquete Buffie con potencial competitivo; no se fuerza tier alto sin evidencia post-parche." },
  Shade: { direction: "up", label: "Buffie U69", summary: "Nuevo paquete Buffie y ajustes favorables; prioridad de vigilancia inmediata." },
};

export const patchImpactFor = (name: string) => impacts[name];
