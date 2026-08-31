export type PatchImpact = { direction: "down" | "up"; label: string; summary: string };

export const latestPatchInfo = {
  liveBalanceDate: "04/08/2026",
  reviewedAt: "31/08/2026",
  rankedEvidenceThrough: "30/08/2026",
  update69AnnouncedAt: "29/08/2026",
  update69BalanceStatus: "No live todavía; ventana prevista 01–02/09/2026 y pendiente de notas oficiales definitivas",
  upcomingBalanceActivation: "NO ACTIVAR hasta publicación oficial de Supercell",
} as const;

const impacts: Record<string, PatchImpact> = {
  Crow: { direction: "down", label: "Nerf 04/08", summary: "Menos daño de ataque y menor presión con Slowing Toxin." },
  Griff: { direction: "down", label: "Nerf 04/08", summary: "Menos radio de Piggy Bank y disparo más disperso; pese al nerf, la evidencia reciente todavía lo mantiene entre los picks globales de mayor prioridad." },
  "Starr Nova": { direction: "down", label: "Nerf fuerte 04/08", summary: "Menos vida, peor recarga, menor duración de Floaty Time y menor escalado." },
  Damian: { direction: "down", label: "Nerf fuerte 04/08", summary: "Menos burst, daño de súper y vida del altavoz." },
  Max: { direction: "down", label: "Nerf 04/08", summary: "Pierde parte del ciclo de tempo, aunque conserva rendimiento alto en la fotografía competitiva más reciente." },
  Bolt: { direction: "down", label: "Nerf 04/08", summary: "Menor escudo y carga más lenta al moverse; su prioridad actual es más sensible al mapa y a la muestra que a comienzos de agosto." },
  "8-Bit": { direction: "down", label: "Nerf 04/08", summary: "Menor frecuencia de súper y menos utilidad de apoyo; el meta 24 h lo vuelve a situar entre los picks fuertes, pero sigue dependiendo mucho del mapa." },
  Surge: { direction: "down", label: "Nerf 04/08", summary: "Peor descarga y menor devolución de munición; continúa siendo competitivo, aunque ya no encabeza la fotografía 24 h." },
};

export const patchImpactFor = (name: string) => impacts[name];
