export type PatchImpact = { direction: "down" | "up"; label: string; summary: string };

const impacts: Record<string, PatchImpact> = {
  Crow: { direction: "down", label: "Nerf 04/08", summary: "Menos daño de ataque y menor presión con Slowing Toxin." },
  Griff: { direction: "down", label: "Nerf 04/08", summary: "Menos radio de Piggy Bank y disparo más disperso." },
  "Starr Nova": { direction: "down", label: "Nerf fuerte", summary: "Menos vida, peor recarga, menor duración de Floaty Time y menor escalado." },
  Damian: { direction: "down", label: "Nerf fuerte", summary: "Menos burst, daño de súper y vida del altavoz." },
  Max: { direction: "down", label: "Nerf 04/08", summary: "Pierde ciclo de súper y valor de tempo." },
  Bolt: { direction: "down", label: "Nerf 04/08", summary: "Menor escudo y carga más lenta al moverse." },
  "8-Bit": { direction: "down", label: "Nerf 04/08", summary: "Menor frecuencia de súper y menos utilidad de apoyo." },
  Surge: { direction: "down", label: "Nerf 04/08", summary: "Peor descarga y menor devolución de munición." },
};

export const patchImpactFor = (name: string) => impacts[name];
