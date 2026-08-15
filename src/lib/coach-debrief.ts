import type { LiveMatchEvent, LiveReviewSession } from "./types";

export type CoachPriority = "Crítica" | "Alta" | "Media";

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
  verdict: string;
};

export type CoachDebrief = {
  headline: string;
  confidence: number;
  confidenceLabel: "Baja" | "Media" | "Alta";
  priorities: CoachDecision[];
  strengths: CoachStrength[];
  nextGames: string[];
  phases: CoachPhase[];
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
  "Muerte con coste de objetivo": {
    category: "Objetivo",
    base: 100,
    cause: "Asumiste una interacción cuando tu supervivencia valía más que el posible intercambio.",
    correction: "Antes de entrar, comprueba si tu muerte abre gol, zona, gemas, estrellas o daño directo a caja fuerte.",
    drill: "Durante 3 partidas, si eres el último recurso defensivo, prioriza vivir sobre perseguir la eliminación.",
  },
  "Objetivo perdido": {
    category: "Objetivo",
    base: 94,
    cause: "La presión rival se convirtió en progreso porque la respuesta llegó tarde o fuera de la zona útil.",
    correction: "Corta persecuciones y vuelve al objetivo un ciclo de munición antes de que el rival pueda convertir.",
    drill: "Durante 3 partidas, verbaliza mentalmente «objetivo primero» cada vez que un rival salga de tu alcance.",
  },
  "Entrada castigada": {
    category: "Posicionamiento",
    base: 90,
    cause: "La entrada se hizo sin suficiente ventaja de munición, vida, apoyo o ruta de salida.",
    correction: "No profundices después del primer intercambio salvo que tengas una segunda ventaja clara para sostener la entrada.",
    drill: "Durante 3 partidas, tras gastar dos municiones en una entrada, reevalúa antes de avanzar otro tile.",
  },
  "Muerte encadenada": {
    category: "Tempo",
    base: 88,
    cause: "La reentrada intentó recuperar demasiado terreno antes de reagrupar recursos o compañeros.",
    correction: "Tras reaparecer, recupera primero una posición defendible y sincroniza la siguiente entrada.",
    drill: "Durante 3 partidas, después de morir espera a tener una referencia de tus dos aliados antes de forzar.",
  },
  "Cadena de muertes": {
    category: "Tempo",
    base: 88,
    cause: "Varias bajas seguidas impidieron estabilizar el mapa y regalaron tempo adicional.",
    correction: "Rompe la cadena con una reentrada defensiva: vida completa, munición y línea segura antes de pelear.",
    drill: "Durante 3 partidas, tras una muerte juega la primera interacción de vuelta con prioridad absoluta a no morir.",
  },
  "Super sin conversión": {
    category: "Recursos",
    base: 84,
    cause: "La super se utilizó sin una conversión definida en eliminación, espacio, objetivo o supervivencia.",
    correction: "Antes de pulsarla, identifica explícitamente qué ventaja concreta debe producir en los siguientes segundos.",
    drill: "Durante 3 partidas, no uses la primera super hasta poder nombrar su conversión: kill, control, objetivo o escape.",
  },
  "Super desperdiciada": {
    category: "Recursos",
    base: 82,
    cause: "El recurso se gastó con bajo valor marginal o cuando la interacción ya estaba perdida/ganada.",
    correction: "Reserva la super para la siguiente interacción si no cambia el resultado de la actual.",
    drill: "Durante 3 partidas, pregúntate «¿cambia esta pelea?» antes de cada super.",
  },
  "Hipercarga desperdiciada": {
    category: "Recursos",
    base: 86,
    cause: "La hipercarga se activó sin suficiente tiempo, posición o recursos para explotar su ventana.",
    correction: "Actívala antes del intercambio decisivo y con munición/vida suficientes para encadenar acciones.",
    drill: "Durante 3 partidas, evita activar hipercarga con menos de dos municiones salvo emergencia defensiva.",
  },
  "Sobreextensión": {
    category: "Posicionamiento",
    base: 78,
    cause: "La posición avanzada dejó de estar respaldada por alcance aliado, cobertura o una retirada realista.",
    correction: "Mantén una salida limpia y no cruces la línea de presión de tus aliados sin una ventaja material.",
    drill: "Durante 3 partidas, usa a tu aliado más adelantado como límite visual salvo que tengas superioridad clara.",
  },
  "Matchup desfavorable": {
    category: "Líneas",
    base: 72,
    cause: "Permaneciste demasiado tiempo en una línea donde el rival tenía ventaja estructural.",
    correction: "Busca el cambio de línea en la primera pausa segura en vez de intentar resolver repetidamente el mismo matchup.",
    drill: "Durante 3 partidas, si pierdes dos interacciones seguidas contra el mismo rival, rota en la siguiente ventana.",
  },
  "Muerte": {
    category: "Tempo",
    base: 56,
    cause: "La baja cedió presencia de mapa; necesita contexto para saber si fue intercambio aceptable.",
    correction: "Revisa qué recurso faltaba antes de morir: vida, munición, cobertura, super o apoyo.",
    drill: "Durante 3 partidas, tras cada muerte identifica una sola causa antes de reaparecer.",
  },
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

const reliability = (event: LiveMatchEvent) => {
  if (event.feedback === "rejected") return 0;
  if (event.source !== "Auto" || event.feedback === "accepted") return 1;
  const confidence = Math.max(0, Math.min(100, event.confidence || 60)) / 100;
  return Math.max(.35, Math.min(.78, confidence * .82));
};

const usable = (session: LiveReviewSession) => session.events.filter((event) => event.feedback !== "rejected");

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

export function buildCoachDebrief(
  session: LiveReviewSession | undefined,
  history: LiveReviewSession[],
): CoachDebrief | undefined {
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

    return {
      label,
      category: rule.category,
      priority,
      score,
      currentSignals: counts.raw,
      priorSessions,
      sameBrawlerSessions,
      sameMapSessions,
      cause: rule.cause,
      correction: rule.correction,
      drill: rule.drill,
      evidence: `${counts.raw} señal${counts.raw === 1 ? "" : "es"} en esta partida. ${recurrenceText}`,
    };
  }).sort((a, b) => b.score - a.score || b.currentSignals - a.currentSignals).slice(0, 3);

  const strengths = Object.entries(POSITIVE_RULES).flatMap(([label, instruction]): CoachStrength[] => {
    const currentSignals = currentEvents.filter((event) => event.label === label).reduce((sum, event) => sum + reliability(event), 0);
    if (currentSignals < .55) return [];
    const priorSessions = previous.filter((item) => countLabel(item, label) >= .55).length;
    return [{
      label,
      currentSignals: Math.max(1, Math.round(currentSignals)),
      priorSessions,
      instruction,
    }];
  }).sort((a, b) => b.currentSignals - a.currentSignals || b.priorSessions - a.priorSessions).slice(0, 3);

  const phaseStats = [
    { label: "Inicio" as const, negative: 0, positive: 0 },
    { label: "Medio" as const, negative: 0, positive: 0 },
    { label: "Final" as const, negative: 0, positive: 0 },
  ];
  for (const event of currentEvents) {
    const phase = phaseStats[phaseFor(event.second, session.duration)];
    const weight = reliability(event);
    if (NEGATIVE_RULES[event.label]) phase.negative += weight;
    if (POSITIVE_RULES[event.label]) phase.positive += weight;
  }
  const phases: CoachPhase[] = phaseStats.map((phase) => {
    const diff = phase.positive - phase.negative;
    return {
      ...phase,
      negative: Math.round(phase.negative * 10) / 10,
      positive: Math.round(phase.positive * 10) / 10,
      verdict: diff >= 1 ? "Fase favorable" : diff <= -1 ? "Fase a revisar" : "Fase equilibrada",
    };
  });

  const reviewedAuto = currentEvents.filter((event) => event.source === "Auto" && Boolean(event.feedback)).length;
  const pendingAuto = currentEvents.filter((event) => event.source === "Auto" && !event.feedback).length;
  const manualOrAccepted = currentEvents.filter((event) => event.source !== "Auto" || event.feedback === "accepted").length;
  const confidence = Math.max(20, Math.min(100, Math.round(
    35 + Math.min(32, currentEvents.length * 4) + Math.min(22, manualOrAccepted * 5) + Math.min(11, reviewedAuto * 3) - Math.min(18, pendingAuto * 2),
  )));
  const confidenceLabel = confidence >= 75 ? "Alta" : confidence >= 52 ? "Media" : "Baja";

  const primary = priorities[0];
  const recurringProblem = priorities.find((item) => item.priorSessions >= 2);
  const headline = primary
    ? `${primary.label}: principal foco de esta partida`
    : strengths[0]
      ? `Ejecución estable: consolida ${strengths[0].label.toLowerCase()}`
      : "Muestra insuficiente para señalar un error dominante";

  const nextGames = priorities.length
    ? priorities.map((item) => item.drill)
    : strengths.length
      ? strengths.slice(0, 2).map((item) => item.instruction)
      : ["Registra o confirma más eventos de la partida para que el entrenador pueda aislar decisiones repetidas."];

  return {
    headline,
    confidence,
    confidenceLabel,
    priorities,
    strengths,
    nextGames: nextGames.slice(0, 3),
    phases,
    recurringProblem: recurringProblem
      ? `Patrón recurrente: «${recurringProblem.label}» aparece en ${recurringProblem.priorSessions} revisiones anteriores.`
      : undefined,
    sampleNote: pendingAuto
      ? `${pendingAuto} detecciones automáticas siguen sin validar; su peso se reduce para no sobreentrenar falsos positivos.`
      : "Las señales automáticas pendientes no están dominando este informe.",
  };
}
