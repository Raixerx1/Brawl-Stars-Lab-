import type { AutoDetection } from "./auto-vision";
import type { LiveEventTone } from "./types";

export type VideoReviewEvent = {
  id: string;
  second: number;
  key: string;
  label: string;
  category: string;
  tone: LiveEventTone;
  confidence: number;
  comment: string;
};

export type VideoReviewMoment = {
  startSecond: number;
  endSecond: number;
  label: string;
  tone: LiveEventTone;
  score: number;
  confidence: number;
  events: VideoReviewEvent[];
  reason: string;
};

export type VideoReviewPhase = {
  label: "Inicio" | "Medio" | "Final";
  startSecond: number;
  endSecond: number;
  activity: number;
  events: number;
  dominant: string;
};

export type VideoReviewReport = {
  events: VideoReviewEvent[];
  moments: VideoReviewMoment[];
  phases: VideoReviewPhase[];
  averageConfidence: number;
  signalQuality: "Alta" | "Media" | "Baja";
  headline: string;
};

const EVENT_WEIGHT: Record<string, number> = {
  death: 96,
  objective: 88,
  super: 72,
  combat: 62,
  respawn: 46,
  scene: 34,
};

const TONE_WEIGHT: Record<LiveEventTone, number> = {
  bad: 1.16,
  objective: 1.12,
  good: 1.08,
  neutral: 1,
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

export function detectionToVideoEvent(detection: AutoDetection, second: number, index: number): VideoReviewEvent {
  return {
    id: `${detection.key}-${second.toFixed(2)}-${index}`,
    second,
    key: detection.key,
    label: detection.eventLabel || detection.category.replace(/^Auto · /, ""),
    category: detection.category,
    tone: detection.tone,
    confidence: clamp(detection.confidence * 100),
    comment: detection.comment,
  };
}

function eventImpact(event: VideoReviewEvent) {
  const base = EVENT_WEIGHT[event.key] || 52;
  return base * (event.confidence / 100) * TONE_WEIGHT[event.tone];
}

function momentReason(events: VideoReviewEvent[]) {
  const labels = [...new Set(events.map((event) => event.label))];
  const hasDeath = events.some((event) => event.key === "death");
  const hasObjective = events.some((event) => event.key === "objective");
  const hasSuper = events.some((event) => event.key === "super");
  const hasCombat = events.some((event) => event.key === "combat");

  if (hasDeath && hasObjective) return "Muerte y cambio de objetivo aparecen en la misma ventana: revisa si la baja permitió conversión rival.";
  if (hasSuper && (hasObjective || hasCombat)) return "Uso de super junto a una interacción relevante: comprueba si el recurso produjo conversión real.";
  if (hasDeath) return "La señal de muerte domina esta ventana. Revisa los segundos previos para identificar posición, munición y salida.";
  if (hasObjective) return "Cambio del objetivo/HUD con señal temporal coherente. Revisa la decisión inmediatamente anterior.";
  if (hasCombat) return "Interacción intensa sostenida. Evalúa si ganaste espacio o solo intercambiaste recursos.";
  return labels.length > 1 ? `Secuencia agrupada: ${labels.join(" → ")}.` : events[0]?.comment || "Momento relevante del vídeo.";
}

export function clusterVideoMoments(events: VideoReviewEvent[], windowSeconds = 4): VideoReviewMoment[] {
  const ordered = [...events].sort((a, b) => a.second - b.second);
  const clusters: VideoReviewEvent[][] = [];

  for (const event of ordered) {
    const current = clusters[clusters.length - 1];
    if (!current || event.second - current[current.length - 1].second > windowSeconds) {
      clusters.push([event]);
    } else {
      current.push(event);
    }
  }

  return clusters.map((cluster) => {
    const strongest = [...cluster].sort((a, b) => eventImpact(b) - eventImpact(a))[0];
    const rawScore = cluster.reduce((sum, event) => sum + eventImpact(event), 0);
    const densityBonus = Math.min(14, Math.max(0, cluster.length - 1) * 4);
    const confidence = clamp(cluster.reduce((sum, event) => sum + event.confidence, 0) / cluster.length);
    return {
      startSecond: cluster[0].second,
      endSecond: cluster[cluster.length - 1].second,
      label: strongest.label,
      tone: strongest.tone,
      score: clamp(rawScore / Math.max(1, Math.sqrt(cluster.length)) + densityBonus),
      confidence,
      events: cluster,
      reason: momentReason(cluster),
    };
  }).sort((a, b) => b.score - a.score || a.startSecond - b.startSecond);
}

function phaseIndex(second: number, duration: number) {
  const ratio = second / Math.max(1, duration);
  if (ratio < 1 / 3) return 0;
  if (ratio < 2 / 3) return 1;
  return 2;
}

export function buildVideoReviewReport(events: VideoReviewEvent[], duration: number): VideoReviewReport {
  const safeDuration = Math.max(1, duration);
  const phaseBounds = [0, safeDuration / 3, safeDuration * 2 / 3, safeDuration];
  const phaseLabels = ["Inicio", "Medio", "Final"] as const;

  const phases: VideoReviewPhase[] = phaseLabels.map((label, index) => {
    const phaseEvents = events.filter((event) => phaseIndex(event.second, safeDuration) === index);
    const byKey = new Map<string, number>();
    for (const event of phaseEvents) byKey.set(event.label, (byKey.get(event.label) || 0) + eventImpact(event));
    const dominant = [...byKey.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Sin señal dominante";
    return {
      label,
      startSecond: phaseBounds[index],
      endSecond: phaseBounds[index + 1],
      activity: clamp(phaseEvents.reduce((sum, event) => sum + eventImpact(event), 0) / 3.2),
      events: phaseEvents.length,
      dominant,
    };
  });

  const averageConfidence = events.length
    ? clamp(events.reduce((sum, event) => sum + event.confidence, 0) / events.length)
    : 0;
  const moments = clusterVideoMoments(events).slice(0, 8);
  const signalQuality: VideoReviewReport["signalQuality"] =
    events.length >= 6 && averageConfidence >= 72 ? "Alta" :
    events.length >= 3 && averageConfidence >= 62 ? "Media" : "Baja";

  const strongest = moments[0];
  const headline = strongest
    ? `${strongest.label} destaca como principal punto de revisión (${Math.round(strongest.startSecond)} s)`
    : "No se detectó una secuencia suficientemente consistente";

  return { events, moments, phases, averageConfidence, signalQuality, headline };
}
