import type { LiveMatchEvent, LiveReviewSession } from "./types";

export type CoachPriority = "Crítica" | "Alta" | "Media";
export type CoachEvidence = "Alta" | "Media" | "Baja";

export type CoachDecision = {
  label: string;
  category: string;
  priority: CoachPriority;
  score: number;
  currentSignals: number;
  priorSessions: number;
  sameBrawlerSessions: number;
  sameMapSessions: number;
  cause: string;
  correction: string;
  drill: string;
  evidence: string;
};

export type CoachStrength = {
  label: string;
  currentSignals: number;
  priorSessions: number;
  instruction: string;
};

export type CoachPhase = {
  label: "Inicio" | "Medio" | "Final";
  negative: number;
  positive: number;
  score: number;
  evidence: CoachEvidence;
  verdict: string;
};

export type CoachTurningPoint = {
  second: number;
  label: string;
  category: string;
  impact: "Negativo" | "Positivo";
  score: number;
  evidence: CoachEvidence;
  reason: string;
};

export type CoachChain = {
  startSecond: number;
  endSecond: number;
  from: string;
  to: string;
  impact: "Negativo" | "Positivo";
  confidence: number;
  interpretation: string;
};

export type CoachDebrief = {
  headline: string;
  confidence: number;
  confidenceLabel: CoachEvidence;
  priorities: CoachDecision[];
  strengths: CoachStrength[];
  nextGames: string[];
  phases: CoachPhase[];
  turningPoints: CoachTurningPoint[];
  chains: CoachChain[];
  recurringProblem?: string;
  sampleNote: string;
};

type Rule = {
  category: string;
  base: number;
  cause: string;
  correction: string;
  drill: string;
};

const NEGATIVE_RULES: Record<string, Rule> = {
  "Muerte con coste de objetivo": { category: "Objetivo", base: 100, cause: "Asumiste una interacción cuando tu supervivencia valía más que el posible intercambio.", correction: "Antes de entrar, comprueba si tu muerte abre gol, zona, gemas, estrellas o daño directo a caja fuerte.", drill: "Durante 3 partidas, si eres el último recurso defensivo, prioriza vivir sobre perseguir la eliminación." },
  "Objetivo perdido": { category: "Objetivo", base: 94, cause: "La presión rival se convirtió en progreso porque la respuesta llegó tarde o fuera de la zona útil.", correction: "Corta persecuciones y vuelve al objetivo un ciclo de munición antes de que el rival pueda convertir.", drill: "Durante 3 partidas, verbaliza mentalmente «objetivo primero» cada vez que un rival salga de tu alcance." },
  "Entrada castigada": { category: "Posicionamiento", base: 90, cause: "La entrada se hizo sin suficiente ventaja de munición, vida, apoyo o ruta de salida.", correction: "No profundices después del primer intercambio salvo que tengas una segunda ventaja clara para sostener la entrada.", drill: "Durante 3 partidas, tras gastar dos municiones en una entrada, reevalúa antes de avanzar otro tile." },
  "Muerte encadenada": { category: "Tempo", base: 88, cause: "La reentrada intentó recuperar demasiado terreno antes de reagrupar recursos o compañeros.", correction: "Tras reaparecer, recupera primero una posición defendible y sincroniza la siguiente entrada.", drill: "Durante 3 partidas, después de morir espera a tener una referencia de tus dos aliados antes de forzar." },
  "Cadena de muertes": { category: "Tempo", base: 88, cause: "Varias bajas seguidas impidieron estabilizar el mapa y regalaron tempo adicional.", correction: "Rompe la cadena con una reentrada defensiva: vida completa, munición y línea segura antes de pelear.", drill: "Durante 3 partidas, tras una muerte juega la primera interacción de vuelta con prioridad absoluta a no morir." },
  "Super sin conversión": { category: "Recursos", base: 84, cause: "La super se utilizó sin una conversión definida en eliminación, espacio, objetivo o supervivencia.", correction: "Antes de pulsarla, identifica explícitamente qué ventaja concreta debe producir en los siguientes segundos.", drill: "Durante 3 partidas, no uses la primera super hasta poder nombrar su conversión: kill, control, objetivo o escape." },
  "Super desperdiciada": { category: "Recursos", base: 82, cause: "El recurso se gastó con bajo valor marginal o cuando la interacción ya estaba perdida o ganada.", correction: "Reserva la super para la siguiente interacción si no cambia el resultado de la actual.", drill: "Durante 3 partidas, pregúntate «¿cambia esta pelea?» antes de cada super." },
  "Hipercarga desperdiciada": { category: "Recursos", base: 86, cause: "La hipercarga se activó sin suficiente tiempo, posición o recursos para explotar su ventana.", correction: "Actívala antes del intercambio decisivo y con munición y vida suficientes para encadenar acciones.", drill: "Durante 3 partidas, evita activar hipercarga con menos de dos municiones salvo emergencia defensiva." },
  "Sobreextensión": { category: "Posicionamiento", base: 78, cause: "La posición avanzada dejó de estar respaldada por alcance aliado, cobertura o una retirada realista.", correction: "Mantén una salida limpia y no cruces la línea de presión de tus aliados sin una ventaja material.", drill: "Durante 3 partidas, usa a tu aliado más adelantado como límite visual salvo que tengas superioridad clara." },
  "Matchup desfavorable": { category: "Líneas", base: 72, cause: "Permaneciste demasiado tiempo en una línea donde el rival tenía ventaja estructural.", correction: "Busca el cambio de línea en la primera pausa segura en vez de intentar resolver repetidamente el mismo matchup.", drill: "Durante 3 partidas, si pierdes dos interacciones seguidas contra el mismo rival, rota en la siguiente ventana." },
  "Muerte": { category: "Tempo", base: 56, cause: "La baja cedió presencia de mapa; necesita contexto para saber si fue intercambio aceptable.", correction: "Revisa qué recurso faltaba antes de morir: vida, munición, cobertura, super o apoyo.", drill: "Durante 3 partidas, tras cada muerte identifica una sola causa antes de reaparecer." },
};

const POSITIVE_RULES: Record<string, string> = {
  "Presión convertida": "Mantén la disciplina de transformar daño y espacio en progreso real de objetivo.",
  "Matchup corregido": "Repite el cambio de línea temprano cuando detectes una desventaja estructural.",
  "Super con impacto": "Conserva el criterio de usar la super cuando produce una ventaja medible.",
  "Super decisiva": "Sigue reservando el recurso para interacciones que cambian el estado de la partida.",
  "Hipercarga decisiva": "Mantén la activación con recursos y posición suficientes para explotar toda la ventana.",
  "Buena rotación": "Conserva la lectura de mapa y rota antes de que el problema llegue al objetivo.",
  "Objetivo ganado": "Sigue priorizando conversión sobre persecuciones de bajo valor.",
  "Matchup favorable": "Protege este emparejamiento y evita rotaciones que regalen tu ventaja de línea.",
  "Eliminación": "Mantén la eliminación solo cuando abra espacio, tempo u objetivo.",
};

const TURNING_POINT_WEIGHT: Record<string, number> = {
  "Muerte con coste de objetivo": 100,
  "Objetivo perdido": 94,
  "Cadena de muertes": 90,
  "Muerte encadenada": 88,
  "Entrada castigada": 84,
  "Hipercarga desperdiciada": 82,
  "Super sin conversión": 78,
  "Objetivo ganado": 92,
  "Presión convertida": 86,
  "Super con impacto": 82,
  "Hipercarga decisiva": 84,
  "Super decisiva": 80,
  "Matchup corregido": 72,
};

const reliability = (event: LiveMatchEvent) => {
  if (event.feedback === "rejected") return 0;
  if (event.source !== "Auto" || event.feedback === "accepted") return 1;
  const confidence = Math.max(0, Math.min(100, event.confidence || 60)) / 100;
  return Math.max(.32, Math.min(.72, confidence * .78));
};

const usable = (session: LiveReviewSession) => session.events.filter((event) => event.feedback !== "rejected");
const round1 = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const evidenceLabel = (value: number): CoachEvidence => value >= .82 ? "Alta" : value >= .58 ? "Media" : "Baja";

function eventPolarity(event: LiveMatchEvent) {
  if (NEGATIVE_RULES[event.label]) return -1;
  if (POSITIVE_RULES[event.label]) return 1;
  return 0;
}

function contradictionPairs(events: LiveMatchEvent[]) {
  const ordered = [...events].sort((a, b) => a.second - b.second);
  let contradictions = 0;
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const polarity = eventPolarity(current);
    if (!polarity) continue;
    for (let nextIndex = index + 1; nextIndex < ordered.length; nextIndex += 1) {
      const next = ordered[nextIndex];
      if (next.second - current.second > 8) break;
      const nextPolarity = eventPolarity(next);
      if (nextPolarity && nextPolarity !== polarity) {
        contradictions += Math.min(reliability(current), reliability(next));
      }
    }
  }
  return contradictions;
}

function countLabel(session: LiveReviewSession, label: string) {
  return usable(session).filter((event) => event.label === label).reduce((sum, event) => sum + reliability(event), 0);
}

function phaseFor(second: number, duration: number) {
  const safeDuration = Math.max(30, duration);
  const ratio = second / safeDuration;
  if (ratio < .34) return 0;
  if (ratio < .68) return 1;
  return 2;
}

function buildChains(events: LiveMatchEvent[]): CoachChain[] {
  const ordered = [...events].sort((a, b) => a.second - b.second);
  const chains: CoachChain[] = [];
  const add = (from: LiveMatchEvent, to: LiveMatchEvent, impact: "Negativo" | "Positivo", interpretation: string, bonus = 0) => {
    const base = (reliability(from) + reliability(to)) / 2;
    const gapPenalty = Math.min(.18, Math.max(0, to.second - from.second - 4) * .015);
    const conflicting = ordered.some((event) =>
      event.id !== from.id &&
      event.id !== to.id &&
      event.second >= from.second &&
      event.second <= to.second &&
      eventPolarity(event) === (impact === "Negativo" ? 1 : -1)
    );
    const conflictPenalty = conflicting ? .08 : 0;
    const confidence = clamp((base - gapPenalty - conflictPenalty + bonus) * 100);
    if (confidence < 42) return;
    if (chains.some((item) => `${item.startSecond}:${item.endSecond}:${item.interpretation}` === `${from.second}:${to.second}:${interpretation}`)) return;
    chains.push({ startSecond: from.second, endSecond: to.second, from: from.label, to: to.label, impact, confidence, interpretation });
  };

  for (let i = 0; i < ordered.length; i += 1) {
    const from = ordered[i];
    for (let j = i + 1; j < ordered.length; j += 1) {
      const to = ordered[j];
      const gap = to.second - from.second;
      if (gap > 12) break;
      if (["Super utilizada", "Super decisiva", "Super con impacto"].includes(from.label) && ["Muerte", "Super sin conversión"].includes(to.label)) {
        add(from, to, "Negativo", "Recurso ofensivo → pérdida de tempo: revisa si la super se usó sin salida o sin ventaja suficiente.", .02);
      }
      if (from.label === "Muerte" && ["Cambio de objetivo", "Objetivo perdido", "Muerte con coste de objetivo"].includes(to.label)) {
        add(from, to, "Negativo", "Muerte → conversión rival: tu supervivencia tenía valor directo sobre la condición de victoria.", .06);
      }
      if (["Interacción intensa", "Entrada castigada"].includes(from.label) && ["Muerte", "Muerte con coste de objetivo"].includes(to.label)) {
        add(from, to, "Negativo", "Entrada → castigo: la secuencia sugiere profundidad excesiva o retirada tardía.", .04);
      }
      if (from.label === "Reaparición" && ["Muerte", "Muerte encadenada"].includes(to.label)) {
        add(from, to, "Negativo", "Reaparición → nueva muerte: la reentrada probablemente fue demasiado rápida o descoordinada.", .04);
      }
      if (["Super utilizada", "Super decisiva", "Super con impacto"].includes(from.label) && ["Cambio de objetivo", "Objetivo ganado", "Presión convertida"].includes(to.label)) {
        add(from, to, "Positivo", "Recurso → conversión: la super generó una ventaja medible en los segundos siguientes.", .04);
      }
      if (from.label === "Matchup desfavorable" && ["Cambio de línea", "Matchup corregido"].includes(to.label)) {
        add(from, to, "Positivo", "Lectura de matchup → rotación: corregiste la línea antes de seguir cediendo presión.", .06);
      }
      if (["Interacción intensa", "Eliminación"].includes(from.label) && ["Objetivo ganado", "Presión convertida", "Cambio de objetivo"].includes(to.label)) {
        add(from, to, "Positivo", "Presión → objetivo: la ventaja mecánica se convirtió en progreso real.", .04);
      }
    }
  }

  return chains.sort((a, b) => b.confidence - a.confidence || a.startSecond - b.startSecond).slice(0, 6);
}

function buildTurningPoints(events: LiveMatchEvent[], duration: number): CoachTurningPoint[] {
  const candidates = events.flatMap((event): CoachTurningPoint[] => {
    const base = TURNING_POINT_WEIGHT[event.label];
    if (!base) return [];
    const rel = reliability(event);
    if (!rel) return [];
    const polarity = eventPolarity(event);
    const nearby = events.filter((other) => other.id !== event.id && Math.abs(other.second - event.second) <= 10);
    const supporting = nearby.reduce((sum, other) => {
      const otherPolarity = eventPolarity(other);
      if (otherPolarity === polarity) return sum + reliability(other);
      if (otherPolarity === 0) return sum + reliability(other) * .35;
      return sum;
    }, 0);
    const contradicting = nearby.reduce((sum, other) =>
      eventPolarity(other) === -polarity ? sum + reliability(other) : sum, 0);
    const clusterBoost = Math.min(12, supporting * 2.4);
    const contradictionPenalty = Math.min(14, contradicting * 4.5);
    const lateBoost = phaseFor(event.second, duration) === 2 ? 7 : 0;
    const negative = Boolean(NEGATIVE_RULES[event.label]);
    const score = clamp(base * (.55 + rel * .45) + clusterBoost + lateBoost - contradictionPenalty);
    const ambiguity = contradictionPenalty >= 5 ? " Hay señales opuestas en la misma ventana, por lo que el impacto se modera." : "";
    const reason = negative
      ? `${event.label} concentró una secuencia de alto coste${lateBoost ? " en el tramo final" : ""}. Revisa los 10 s anteriores, no solo el evento aislado.${ambiguity}`
      : `${event.label} produjo una ventaja clara${lateBoost ? " en el cierre" : ""}. Identifica qué recursos y posición permitieron convertirla.${ambiguity}`;
    return [{ second: event.second, label: event.label, category: NEGATIVE_RULES[event.label]?.category || "Conversión", impact: negative ? "Negativo" : "Positivo", score, evidence: evidenceLabel(Math.max(0, rel - contradicting * .08)), reason }];
  });

  const selected: CoachTurningPoint[] = [];
  for (const item of candidates.sort((a, b) => b.score - a.score)) {
    if (selected.some((existing) => Math.abs(existing.second - item.second) <= 8 && existing.impact === item.impact)) continue;
    selected.push(item);
    if (selected.length >= 4) break;
  }
  return selected;
}

export function buildCoachDebrief(session: LiveReviewSession | undefined, history: LiveReviewSession[]): CoachDebrief | undefined {
  if (!session) return undefined;

  const currentEvents = usable(session);
  const previous = history.filter((item) => item.id !== session.id);
  const negativeGroups = new Map<string, { weighted: number; raw: number }>();

  for (const event of currentEvents) {
    if (!NEGATIVE_RULES[event.label]) continue;
    const weight = reliability(event);
    const current = negativeGroups.get(event.label) || { weighted: 0, raw: 0 };
    current.weighted += weight;
    current.raw += 1;
    negativeGroups.set(event.label, current);
  }

  const priorities = [...negativeGroups.entries()].map(([label, counts]): CoachDecision => {
    const rule = NEGATIVE_RULES[label];
    const priorSessions = previous.filter((item) => countLabel(item, label) >= .55).length;
    const sameBrawlerSessions = previous.filter((item) => item.brawler === session.brawler && countLabel(item, label) >= .55).length;
    const sameMapSessions = previous.filter((item) => item.mapSlug === session.mapSlug && countLabel(item, label) >= .55).length;
    const recurrenceBoost = Math.min(24, priorSessions * 3 + sameBrawlerSessions * 4 + sameMapSessions * 3);
    const currentBoost = Math.min(20, Math.max(0, counts.weighted - 1) * 10);
    const lossBoost = session.result === "Derrota" && ["Objetivo", "Tempo"].includes(rule.category) ? 6 : 0;
    const score = Math.round(rule.base * Math.min(1, .68 + counts.weighted * .22) + recurrenceBoost + currentBoost + lossBoost);
    const priority: CoachPriority = score >= 92 ? "Crítica" : score >= 76 ? "Alta" : "Media";
    const recurrenceText = priorSessions
      ? `También aparece en ${priorSessions} revisiones previas${sameBrawlerSessions ? ` (${sameBrawlerSessions} con ${session.brawler})` : ""}${sameMapSessions ? ` y ${sameMapSessions} en ${session.mapName}` : ""}.`
      : "No hay recurrencia histórica suficiente todavía.";
    return { label, category: rule.category, priority, score, currentSignals: counts.raw, priorSessions, sameBrawlerSessions, sameMapSessions, cause: rule.cause, correction: rule.correction, drill: rule.drill, evidence: `${counts.raw} señal${counts.raw === 1 ? "" : "es"} en esta partida. ${recurrenceText}` };
  }).sort((a, b) => b.score - a.score || b.currentSignals - a.currentSignals).slice(0, 3);

  const strengths = Object.entries(POSITIVE_RULES).flatMap(([label, instruction]): CoachStrength[] => {
    const currentSignals = currentEvents.filter((event) => event.label === label).reduce((sum, event) => sum + reliability(event), 0);
    if (currentSignals < .55) return [];
    const priorSessions = previous.filter((item) => countLabel(item, label) >= .55).length;
    return [{ label, currentSignals: Math.max(1, Math.round(currentSignals)), priorSessions, instruction }];
  }).sort((a, b) => b.currentSignals - a.currentSignals || b.priorSessions - a.priorSessions).slice(0, 3);

  const phaseStats = [
    { label: "Inicio" as const, negative: 0, positive: 0, evidence: 0 },
    { label: "Medio" as const, negative: 0, positive: 0, evidence: 0 },
    { label: "Final" as const, negative: 0, positive: 0, evidence: 0 },
  ];
  for (const event of currentEvents) {
    const phase = phaseStats[phaseFor(event.second, session.duration)];
    const weight = reliability(event);
    phase.evidence += weight;
    if (NEGATIVE_RULES[event.label]) phase.negative += weight;
    if (POSITIVE_RULES[event.label]) phase.positive += weight;
  }
  const phases: CoachPhase[] = phaseStats.map((phase) => {
    const score = clamp(52 + phase.positive * 10 - phase.negative * 12);
    const evidenceRatio = Math.min(1, phase.evidence / 4);
    return {
      label: phase.label,
      negative: round1(phase.negative),
      positive: round1(phase.positive),
      score,
      evidence: evidenceLabel(evidenceRatio),
      verdict: score >= 68 ? "Fase favorable" : score <= 42 ? "Fase a revisar" : "Fase equilibrada",
    };
  });

  const reviewedAuto = currentEvents.filter((event) => event.source === "Auto" && Boolean(event.feedback)).length;
  const pendingAuto = currentEvents.filter((event) => event.source === "Auto" && !event.feedback).length;
  const manualOrAccepted = currentEvents.filter((event) => event.source !== "Auto" || event.feedback === "accepted").length;
  const weightedEvidence = currentEvents.reduce((sum, event) => sum + reliability(event), 0);
  const contradictions = contradictionPairs(currentEvents);
  const confidence = Math.max(18, Math.min(100, Math.round(
    22 +
    Math.min(34, weightedEvidence * 5.5) +
    Math.min(30, manualOrAccepted * 6.5) +
    Math.min(10, reviewedAuto * 2.5) -
    Math.min(22, pendingAuto * 2.5) -
    Math.min(18, contradictions * 6)
  )));
  const confidenceLabel = confidence >= 75 ? "Alta" : confidence >= 52 ? "Media" : "Baja";

  const turningPoints = buildTurningPoints(currentEvents, session.duration);
  const chains = buildChains(currentEvents);
  const primary = priorities[0];
  const recurringProblem = priorities.find((item) => item.priorSessions >= 2);
  const decisive = turningPoints[0];
  const headline = decisive && decisive.score >= 82
    ? `${decisive.label}: punto de inflexión de la partida`
    : primary
      ? `${primary.label}: principal foco de esta partida`
      : strengths[0]
        ? `Ejecución estable: consolida ${strengths[0].label.toLowerCase()}`
        : "Muestra insuficiente para señalar un error dominante";

  const nextGames = priorities.length
    ? priorities.map((item) => item.drill)
    : strengths.length
      ? strengths.slice(0, 2).map((item) => item.instruction)
      : ["Registra o confirma más eventos de la partida para que el entrenador pueda aislar decisiones repetidas."];

  const evidenceNotes: string[] = [];
  if (pendingAuto) evidenceNotes.push(`${pendingAuto} detecciones automáticas siguen sin validar y tienen peso reducido`);
  if (contradictions >= .8) evidenceNotes.push("hay señales positivas y negativas muy próximas, por lo que se modera la causalidad");
  if (!evidenceNotes.length) evidenceNotes.push("las señales automáticas pendientes no están dominando este informe");

  return {
    headline,
    confidence,
    confidenceLabel,
    priorities,
    strengths,
    nextGames: nextGames.slice(0, 3),
    phases,
    turningPoints,
    chains,
    recurringProblem: recurringProblem ? `Patrón recurrente: «${recurringProblem.label}» aparece en ${recurringProblem.priorSessions} revisiones anteriores.` : undefined,
    sampleNote: `${evidenceNotes.join("; ")}.`,
  };
}
