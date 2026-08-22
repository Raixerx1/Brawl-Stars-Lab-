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

export type VideoReviewSequence = {
  id: string;
  startSecond: number;
  endSecond: number;
  label: string;
  score: number;
  confidence: number;
  priority: "Crítica" | "Alta" | "Media";
  events: VideoReviewEvent[];
  explanation: string;
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
  sequences: VideoReviewSequence[];
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
  scene: 30,
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

export function dedupeVideoEvents(events: VideoReviewEvent[]) {
  const ordered = [...events].sort((a, b) => a.second - b.second || b.confidence - a.confidence);
  const kept: VideoReviewEvent[] = [];
  for (const event of ordered) {
    const duplicateIndex = kept.findIndex((previous) =>
      previous.key === event.key && Math.abs(previous.second - event.second) <= (event.key === "scene" ? 4 : 2.2)
    );
    if (duplicateIndex < 0) {
      kept.push(event);
      continue;
    }
    if (event.confidence > kept[duplicateIndex].confidence) kept[duplicateIndex] = event;
  }
  return kept.sort((a, b) => a.second - b.second);
}

function momentReason(events: VideoReviewEvent[]) {
  const labels = [...new Set(events.map((event) => event.label))];
  const orderedKeys = events.map((event) => event.key);
  const hasDeath = orderedKeys.includes("death");
  const hasObjective = orderedKeys.includes("objective");
  const hasSuper = orderedKeys.includes("super");
  const hasCombat = orderedKeys.includes("combat");

  if (hasCombat && hasDeath && hasObjective) return "Combate, muerte y cambio de objetivo aparecen encadenados. Empieza la revisión antes del combate para identificar la decisión que abrió la secuencia.";
  if (hasDeath && hasObjective) return "Muerte y cambio de objetivo aparecen en la misma ventana: revisa si la baja abrió una conversión o si el objetivo ya estaba perdido.";
  if (hasSuper && (hasObjective || hasCombat)) return "Uso de super junto a una interacción relevante: comprueba de qué equipo fue el recurso y si produjo conversión real.";
  if (hasDeath) return "La señal de muerte domina esta ventana. La revisión empieza unos segundos antes para valorar posición, munición y ruta de salida.";
  if (hasObjective) return "Cambio del objetivo/HUD con señal temporal coherente. Revisa la decisión inmediatamente anterior.";
  if (hasCombat) return "Interacción intensa sostenida. Evalúa si generó espacio, objetivo o únicamente consumo de recursos.";
  return labels.length > 1 ? `Secuencia agrupada: ${labels.join(" → ")}.` : events[0]?.comment || "Momento relevante del vídeo.";
}

export function clusterVideoMoments(events: VideoReviewEvent[], windowSeconds = 4.8): VideoReviewMoment[] {
  const ordered = dedupeVideoEvents(events);
  const clusters: VideoReviewEvent[][] = [];

  for (const event of ordered) {
    const current = clusters[clusters.length - 1];
    if (!current || event.second - current[current.length - 1].second > windowSeconds) clusters.push([event]);
    else current.push(event);
  }

  return clusters.map((cluster) => {
    const strongest = [...cluster].sort((a, b) => eventImpact(b) - eventImpact(a))[0];
    const rawScore = cluster.reduce((sum, event) => sum + eventImpact(event), 0);
    const densityBonus = Math.min(16, Math.max(0, cluster.length - 1) * 4);
    const confidence = clamp(cluster.reduce((sum, event) => sum + event.confidence, 0) / cluster.length);
    return {
      startSecond: Math.max(0, cluster[0].second - 2.5),
      endSecond: cluster[cluster.length - 1].second + 1.5,
      label: strongest.label,
      tone: strongest.tone,
      score: clamp(rawScore / Math.max(1, Math.sqrt(cluster.length)) + densityBonus),
      confidence,
      events: cluster,
      reason: momentReason(cluster),
    };
  }).sort((a, b) => b.score - a.score || a.startSecond - b.startSecond);
}

function sequenceConfidence(events: VideoReviewEvent[], temporalSpan: number) {
  const mean = events.reduce((sum, event) => sum + event.confidence, 0) / Math.max(1, events.length);
  return clamp(mean - Math.max(0, temporalSpan - 3) * 1.4);
}

function sequenceScore(events: VideoReviewEvent[], bonus = 0) {
  return clamp(events.reduce((sum, event) => sum + eventImpact(event), 0) / Math.max(1, Math.sqrt(events.length)) + bonus);
}

function priorityFor(score: number): VideoReviewSequence["priority"] {
  if (score >= 86) return "Crítica";
  if (score >= 70) return "Alta";
  return "Media";
}

export function detectVideoSequences(events: VideoReviewEvent[]): VideoReviewSequence[] {
  const ordered = dedupeVideoEvents(events);
  const sequences: VideoReviewSequence[] = [];
  const used = new Set<string>();

  const add = (kind: string, selected: VideoReviewEvent[], label: string, explanation: string, bonus = 0) => {
    if (selected.length < 2) return;
    const sorted = [...selected].sort((a, b) => a.second - b.second);
    const id = `${kind}-${sorted.map((event) => event.id).join("-")}`;
    if (used.has(id)) return;
    used.add(id);
    const span = sorted[sorted.length - 1].second - sorted[0].second;
    const score = sequenceScore(sorted, bonus);
    sequences.push({
      id,
      startSecond: Math.max(0, sorted[0].second - 3),
      endSecond: sorted[sorted.length - 1].second + 2,
      label,
      score,
      confidence: sequenceConfidence(sorted, span),
      priority: priorityFor(score),
      events: sorted,
      explanation,
    });
  };

  for (let index = 0; index < ordered.length; index += 1) {
    const event = ordered[index];

    if (event.key === "death") {
      const combat = [...ordered]
        .slice(0, index)
        .reverse()
        .find((candidate) => candidate.key === "combat" && event.second - candidate.second <= 5.5);
      const objective = ordered.slice(index + 1)
        .find((candidate) => candidate.key === "objective" && candidate.second - event.second <= 6.5);
      if (combat && objective) {
        add("combat-death-objective", [combat, event, objective], "Combate → muerte → objetivo", "Cadena de alta prioridad. Revisa desde antes del combate: posición, recursos y si la muerte permitió el cambio de objetivo.", 16);
      } else if (objective) {
        add("death-objective", [event, objective], "Muerte cerca de cambio de objetivo", "La proximidad temporal sugiere una ventana de conversión. El vídeo no identifica por sí solo qué equipo obtuvo el objetivo; valida el contexto visual.", 12);
      } else if (combat) {
        add("combat-death", [combat, event], "Combate → muerte", "Revisa el inicio de la interacción para distinguir una entrada forzada de una muerte inevitable tras perder posición.", 8);
      }

      const nextDeath = ordered.slice(index + 1)
        .find((candidate) => candidate.key === "death" && candidate.second - event.second <= 18);
      if (nextDeath) {
        add("repeat-death", [event, nextDeath], "Muertes próximas", "Dos señales de muerte aparecen en una ventana corta. Comprueba si hubo reentrada desincronizada, wipe parcial o detecciones de equipos distintos.", 10);
      }
    }

    if (event.key === "super") {
      const conversion = ordered.slice(index + 1)
        .find((candidate) => ["combat", "objective", "death"].includes(candidate.key) && candidate.second - event.second <= 7);
      if (conversion) {
        add("super-followup", [event, conversion], "Super → interacción", "El recurso aparece seguido de una señal relevante. Valida si la super fue propia o rival y si realmente cambió la interacción.", 7);
      } else {
        const nextRelevant = ordered.slice(index + 1)
          .find((candidate) => ["combat", "objective", "death"].includes(candidate.key) && candidate.second - event.second <= 10);
        if (nextRelevant) add("isolated-super", [event, nextRelevant], "Super con conversión tardía", "La conversión no es inmediata. Revisa si el recurso creó espacio de forma indirecta o si se gastó sin una ganancia clara.", 2);
      }
    }
  }

  return sequences
    .filter((sequence) => sequence.confidence >= 55)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.startSecond - b.startSecond)
    .slice(0, 10);
}

function phaseIndex(second: number, duration: number) {
  const ratio = second / Math.max(1, duration);
  if (ratio < 1 / 3) return 0;
  if (ratio < 2 / 3) return 1;
  return 2;
}

export function buildVideoReviewReport(events: VideoReviewEvent[], duration: number): VideoReviewReport {
  const cleanEvents = dedupeVideoEvents(events);
  const safeDuration = Math.max(1, duration);
  const phaseBounds = [0, safeDuration / 3, safeDuration * 2 / 3, safeDuration];
  const phaseLabels = ["Inicio", "Medio", "Final"] as const;

  const rawPhases = phaseLabels.map((label, index) => {
    const phaseEvents = cleanEvents.filter((event) => phaseIndex(event.second, safeDuration) === index);
    const byKey = new Map<string, number>();
    for (const event of phaseEvents) byKey.set(event.label, (byKey.get(event.label) || 0) + eventImpact(event));
    const dominant = [...byKey.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Sin señal dominante";
    const phaseDurationMinutes = Math.max(.2, (phaseBounds[index + 1] - phaseBounds[index]) / 60);
    return {
      label,
      startSecond: phaseBounds[index],
      endSecond: phaseBounds[index + 1],
      rawActivity: phaseEvents.reduce((sum, event) => sum + eventImpact(event), 0) / phaseDurationMinutes,
      events: phaseEvents.length,
      dominant,
    };
  });

  const maxActivity = Math.max(1, ...rawPhases.map((phase) => phase.rawActivity));
  const phases: VideoReviewPhase[] = rawPhases.map(({ rawActivity, ...phase }) => ({
    ...phase,
    activity: clamp((rawActivity / maxActivity) * 100),
  }));

  const averageConfidence = cleanEvents.length
    ? clamp(cleanEvents.reduce((sum, event) => sum + event.confidence, 0) / cleanEvents.length)
    : 0;
  const moments = clusterVideoMoments(cleanEvents).slice(0, 8);
  const sequences = detectVideoSequences(cleanEvents);
  const usefulEvents = cleanEvents.filter((event) => event.key !== "scene").length;
  const sceneShare = cleanEvents.length ? cleanEvents.filter((event) => event.key === "scene").length / cleanEvents.length : 1;
  const signalQuality: VideoReviewReport["signalQuality"] =
    usefulEvents >= 6 && averageConfidence >= 70 && sceneShare <= .35 ? "Alta" :
    usefulEvents >= 3 && averageConfidence >= 60 && sceneShare <= .5 ? "Media" : "Baja";

  const strongestSequence = sequences[0];
  const strongestMoment = moments[0];
  const headline = strongestSequence
    ? `${strongestSequence.label} es la secuencia prioritaria (${Math.round(strongestSequence.startSecond)}–${Math.round(strongestSequence.endSecond)} s)`
    : strongestMoment
      ? `${strongestMoment.label} destaca como principal punto de revisión (${Math.round(strongestMoment.startSecond)} s)`
      : "No se detectó una secuencia suficientemente consistente";

  return { events: cleanEvents, moments, sequences, phases, averageConfidence, signalQuality, headline };
}
