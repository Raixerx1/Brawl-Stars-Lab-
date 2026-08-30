export type PatchImpact = { direction: "down" | "up"; label: string; summary: string };

export const latestPatchInfo = {
  liveBalanceDate: "04/08/2026",
  reviewedAt: "30/08/2026",
  rankedEvidenceThrough: "26/08/2026",
  update69AnnouncedAt: "29/08/2026",
  update69BalanceStatus: "Pendiente de notas oficiales",
} as const;

const impacts: Record<string, PatchImpact> = {
  Crow: { direction: "down", label: "Nerf 04/08", summary: "Menos daño de ataque y menor presión con Slowing Toxin." },
  Griff: { direction: "down", label: "Nerf 04/08", summary: "Menos radio de Piggy Bank y disparo más disperso; pese al nerf, la evidencia Ranked posterior lo mantiene en el núcleo alto del meta." },
  "Starr Nova": { direction: "down", label: "Nerf fuerte 04/08", summary: "Menos vida, peor recarga, menor duración de Floaty Time y menor escalado." },
  Damian: { direction: "down", label: "Nerf fuerte 04/08", summary: "Menos burst, daño de súper y vida del altavoz." },
  Max: { direction: "down", label: "Nerf 04/08", summary: "Pierde ciclo de súper y parte del tempo, aunque los datos posteriores la mantienen entre los picks globales más fuertes." },
  Bolt: { direction: "down", label: "Nerf 04/08", summary: "Menor escudo y carga más lenta al moverse; sigue mostrando rendimiento alto tras el parche." },
  "8-Bit": { direction: "down", label: "Nerf 04/08", summary: "Menor frecuencia de súper y menos utilidad de apoyo; ahora depende más del mapa y del orden del draft." },
  Surge: { direction: "down", label: "Nerf 04/08", summary: "Peor descarga y menor devolución de munición; se mantiene en el núcleo S observado post-parche." },
};

export const patchImpactFor = (name: string) => impacts[name];
