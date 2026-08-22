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

export type VideoTeamBalance = {
  ownDeaths: number;
  allyDeaths: number;
  enemyDeaths: number;
  classifiedDeaths: number;
  netTeamKills: number;
};

export type VideoReviewReport = {
  events: VideoReviewEvent[];
  moments: VideoReviewMoment[];
  sequences: VideoReviewSequence[];
  phases: VideoReviewPhase[];
  teamBalance: VideoTeamBalance;
  averageConfidence: number;
  signalQuality: "Alta" | "Media" | "Baja";
  headline: string;
};

const EVENT_WEIGHT: Record<string, number> = {
  death: 96,
  "ally-death": 84,
  "enemy-death": 86,
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
const isFriendlyDeath = (event: VideoReviewEvent) => event.key === "death" || event.key === "ally-death";
const isAnyDeath = (event: VideoReviewEvent) => isFriendlyDeath(event) || event.key === "enemy-death";

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
  const hasOwnDeath = events.some((event) => event.key === "death");
  const hasAllyDeath = events.some((event) => event.key === "ally-death");
  const hasEnemyDeath = events.some((event) => event.key === "enemy-death");
  const hasObjective = events.some((event) => event.key === "objective");
  const hasSuper = events.some((event) => event.key === "super");
  const hasCombat = events.some((event) => event.key === "combat");

  if (hasCombat && hasOwnDeath && hasObjective) return "Combate, tu muerte y cambio de objetivo aparecen encadenados. Empieza antes del combate para identificar la decisión que abrió la ventana rival.";
  if (hasOwnDeath && hasObjective) return "Tu muerte y el cambio de objetivo aparecen en la misma ventana. Revisa si tu baja abrió la conversión o si el objetivo ya estaba perdido.";
  if (hasAllyDeath && hasObjective) return "Una muerte aliada precede al cambio de objetivo. Revisa cómo gestionasteis la desventaja numérica y si era necesario ceder espacio.";
  if (hasEnemyDeath && hasObjective) return "Una eliminación rival precede al cambio de objetivo. Revisa si la ventaja numérica se convirtió con rapidez y sin sobreextensión.";
  if (hasSuper && hasEnemyDeath) return "Uso de super seguido de una baja rival. Comprueba si el recurso generó directamente la eliminación y la siguiente ventana de presión.";
  if (hasSuper && (hasObjective || hasCombat || hasAllyDeath || hasOwnDeath)) return "Uso de super junto a una interacción relevante. Comprueba si produjo valor suficiente o dejó al equipo sin respuesta.";
  if (hasOwnDeath) return "La señal dominante es tu muerte. La revisión empieza antes para valorar posición, munición, apoyo y ruta de salida.";
  if (hasAllyDeath) return "La señal dominante es una muerte aliada. Evalúa si debías cubrir, intercambiar, retroceder o simplemente conservar tu vida hasta reagrupar.";
  if (hasEnemyDeath) return "La señal dominante es una baja rival. Evalúa si aprovechaste la superioridad numérica en objetivo, mapa o presión.";
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
      startSecond: Math.max(0, cluster[0].second - 2.8),
      endSecond: cluster[cluster.length - 1].second + 1.8,
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
      startSecond: Math.max(0, sorted[0].second - 3.2),
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
      const combat = [...ordered].slice(0, index).reverse()
        .find((candidate) => candidate.key === "combat" && event.second - candidate.second <= 5.5);
      const objective = ordered.slice(index + 1)
        .find((candidate) => candidate.key === "objective" && candidate.second - event.second <= 6.5);
      if (combat && objective) {
        add("combat-own-death-objective", [combat, event, objective], "Combate → tu muerte → objetivo", "Cadena personal de alta prioridad. Revisa desde antes del combate: posición, recursos y si tu muerte permitió el cambio de objetivo.", 16);
      } else if (objective) {
        add("own-death-objective", [event, objective], "Tu muerte → objetivo", "La proximidad temporal sugiere que tu baja pudo abrir una ventana de conversión rival. Revisa si podías ceder espacio sin morir.", 12);
      } else if (combat) {
        add("combat-own-death", [combat, event], "Combate → tu muerte", "Revisa el inicio de la interacción para distinguir una entrada forzada de una muerte evitable tras perder posición.", 8);
      }

      const nextOwnDeath = ordered.slice(index + 1)
        .find((candidate) => candidate.key === "death" && candidate.second - event.second <= 22);
      if (nextOwnDeath) {
        add("repeat-own-death", [event, nextOwnDeath], "Muertes propias próximas", "Dos muertes tuyas aparecen en una ventana corta. Comprueba si hubo una reentrada demasiado rápida o desincronizada.", 11);
      }
    }

    if (event.key === "ally-death") {
      const combat = [...ordered].slice(0, index).reverse()
        .find((candidate) => candidate.key === "combat" && event.second - candidate.second <= 5.5);
      const objective = ordered.slice(index + 1)
        .find((candidate) => candidate.key === "objective" && candidate.second - event.second <= 6.5);
      if (combat && objective) {
        add("combat-ally-death-objective", [combat, event, objective], "Combate → aliado cae → objetivo", "El equipo entró en desventaja numérica y poco después cambió el objetivo. Revisa si debíais cortar la pelea y ceder espacio temporalmente.", 13);
      } else if (objective) {
        add("ally-death-objective", [event, objective], "Muerte aliada → objetivo", "Una baja aliada precede al cambio de objetivo. Revisa si el rival convirtió el 3v2 y si tú podías preservar recursos o retrasar la jugada.", 10);
      } else if (combat) {
        add("combat-ally-death", [combat, event], "Combate → muerte aliada", "Un aliado cayó durante el intercambio. Revisa si había posibilidad de trade o si la mejor respuesta era retroceder y reagrupar.", 6);
      }

      const nextAllyDeath = ordered.slice(index + 1)
        .find((candidate) => candidate.key === "ally-death" && candidate.second - event.second <= 12);
      if (nextAllyDeath) {
        add("double-ally-death", [event, nextAllyDeath], "Doble baja aliada", "Dos aliados caen en pocos segundos. La prioridad pasa a ser no regalar la tercera baja y ganar tiempo hasta el respawn.", 12);
      }
    }

    if (event.key === "enemy-death") {
      const combat = [...ordered].slice(0, index).reverse()
        .find((candidate) => candidate.key === "combat" && event.second - candidate.second <= 5.5);
      const objective = ordered.slice(index + 1)
        .find((candidate) => candidate.key === "objective" && candidate.second - event.second <= 6.5);
      const superUse = [...ordered].slice(0, index).reverse()
        .find((candidate) => candidate.key === "super" && event.second - candidate.second <= 6.5);

      if (combat && objective) {
        add("combat-enemy-death-objective", [combat, event, objective], "Combate → baja rival → objetivo", "La superioridad numérica parece convertirse en objetivo. Revisa la velocidad de conversión y si el equipo evitó perseguir de más.", 15);
      } else if (objective) {
        add("enemy-death-objective", [event, objective], "Baja rival → objetivo", "Una eliminación rival precede al cambio de objetivo. Buena ventana potencial de conversión; revisa si exprimisteis toda la ventaja numérica.", 12);
      } else if (combat) {
        add("combat-enemy-death", [combat, event], "Combate → baja rival", "El intercambio termina con una baja enemiga probable. Revisa qué decisión creó la ventaja y qué debías hacer inmediatamente después.", 7);
      }

      if (superUse) {
        add("super-enemy-death", [superUse, event], "Super → baja rival", "Una super aparece poco antes de una eliminación rival. Revisa si el recurso aseguró la baja y si quedaba una conversión mejor que perseguir otra eliminación.", 9);
      }

      const nextEnemyDeath = ordered.slice(index + 1)
        .find((candidate) => candidate.key === "enemy-death" && candidate.second - event.second <= 12);
      if (nextEnemyDeath) {
        add("double-enemy-death", [event, nextEnemyDeath], "Doble ventaja numérica", "Dos rivales caen en pocos segundos. La prioridad es convertir la superioridad en objetivo, mapa o una posición segura avanzada.", 12);
      }
    }

    if (event.key === "super") {
      const conversion = ordered.slice(index + 1)
        .find((candidate) => ["combat", "objective", "death", "ally-death", "enemy-death"].includes(candidate.key) && candidate.second - event.second <= 7);
      if (conversion && conversion.key !== "enemy-death") {
        const explanation = conversion.key === "ally-death" || conversion.key === "death"
          ? "La super precede a una baja de vuestro equipo. Revisa si el recurso se gastó tarde, sin apoyo o sin una ruta de salida."
          : "El recurso aparece seguido de una señal relevante. Revisa si realmente generó control, objetivo o una ventaja sostenible.";
        add("super-followup", [event, conversion], "Super → interacción", explanation, 7);
      } else if (!conversion) {
        const nextRelevant = ordered.slice(index + 1)
          .find((candidate) => ["combat", "objective", "death", "ally-death", "enemy-death"].includes(candidate.key) && candidate.second - event.second <= 10);
        if (nextRelevant) add("isolated-super", [event, nextRelevant], "Super con conversión tardía", "La conversión no es inmediata. Revisa si el recurso creó espacio de forma indirecta o si se gastó sin una ganancia clara.", 2);
      }
    }
  }

  return sequences
    .filter((sequence) => sequence.confidence >= 55)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.startSecond - b.startSecond)
    .slice(0, 12);
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

  const ownDeaths = cleanEvents.filter((event) => event.key === "death").length;
  const allyDeaths = cleanEvents.filter((event) => event.key === "ally-death").length;
  const enemyDeaths = cleanEvents.filter((event) => event.key === "enemy-death").length;
  const teamBalance: VideoTeamBalance = {
    ownDeaths,
    allyDeaths,
    enemyDeaths,
    classifiedDeaths: ownDeaths + allyDeaths + enemyDeaths,
    netTeamKills: enemyDeaths - ownDeaths - allyDeaths,
  };

  const averageConfidence = cleanEvents.length
    ? clamp(cleanEvents.reduce((sum, event) => sum + event.confidence, 0) / cleanEvents.length)
    : 0;
  const moments = clusterVideoMoments(cleanEvents).slice(0, 8);
  const sequences = detectVideoSequences(cleanEvents);
  const usefulEvents = cleanEvents.filter((event) => event.key !== "scene").length;
  const classifiedDeaths = cleanEvents.filter(isAnyDeath).length;
  const classifiedHighConfidence = cleanEvents.filter((event) => isAnyDeath(event) && event.confidence >= 68).length;
  const sceneShare = cleanEvents.length ? cleanEvents.filter((event) => event.key === "scene").length / cleanEvents.length : 1;
  const teamReliabilityBonus = classifiedDeaths ? classifiedHighConfidence / classifiedDeaths : 0;
  const signalQuality: VideoReviewReport["signalQuality"] =
    usefulEvents >= 6 && averageConfidence >= 70 && sceneShare <= .35 && (classifiedDeaths === 0 || teamReliabilityBonus >= .5) ? "Alta" :
    usefulEvents >= 3 && averageConfidence >= 60 && sceneShare <= .5 ? "Media" : "Baja";

  const strongestSequence = sequences[0];
  const strongestMoment = moments[0];
  const headline = strongestSequence
    ? `${strongestSequence.label} es la secuencia prioritaria (${Math.round(strongestSequence.startSecond)}–${Math.round(strongestSequence.endSecond)} s)`
    : strongestMoment
      ? `${strongestMoment.label} destaca como principal punto de revisión (${Math.round(strongestMoment.startSecond)} s)`
      : "No se detectó una secuencia suficientemente consistente";

  return {
    events: cleanEvents,
    moments,
    sequences,
    phases,
    teamBalance,
    averageConfidence,
    signalQuality,
    headline,
  };
}
