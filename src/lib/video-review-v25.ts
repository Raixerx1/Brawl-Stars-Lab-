import type { FrameMetrics } from "./auto-vision";
import type { LiveEventTone, MatchResult } from "./types";
import type { VideoReviewEvent, VideoReviewReport } from "./video-review";

export type VideoReviewContext = {
  mode?: string;
  mapName?: string;
  brawlerName?: string;
  brawlerRole?: string;
  result?: MatchResult;
};

export type VideoRefineCandidate = {
  second: number;
  score: number;
};

export type VideoRefineWindow = {
  startSecond: number;
  endSecond: number;
  score: number;
};

export type VideoEventOverride = "drop" | "death" | "ally-death" | "enemy-death";

export type VideoTacticalReadout = {
  pressureWindows: number;
  pressureConverted: number;
  pressureConversionRate: number;
  friendlyDeaths: number;
  deathsWithObjectiveCost: number;
  deathCostRate: number;
  tradesRecovered: number;
  tradeRecoveryRate: number;
  superUses: number;
  superWithFollowup: number;
  superFollowupRate: number;
  highConfidenceShare: number;
  criticalSequences: number;
  focus: string;
  strengths: string[];
  risks: string[];
  actions: string[];
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const percent = (value: number, total: number) => total ? Math.round(value / total * 100) : 0;

/**
 * Prioridad para el segundo barrido del vídeo. No intenta interpretar la jugada:
 * solo identifica zonas temporales donde el HUD, el combate o los recursos
 * cambian lo suficiente como para justificar un muestreo más denso.
 */
export function frameReviewAttention(metrics: FrameMetrics) {
  const killMotion = Math.max(metrics.killLeftMotion, metrics.killRightMotion);
  const killColor = Math.max(
    metrics.killLeftBlue,
    metrics.killLeftRed,
    metrics.killRightBlue,
    metrics.killRightRed,
  );
  const localizedResource = Math.max(0, metrics.bottomRightMotion - metrics.motion * .72);
  const localizedObjective = Math.max(0, metrics.topMotion - metrics.motion * .82);
  const centerShock = Math.max(0, metrics.centerMotion - metrics.motion * .62);

  return clamp01(
    metrics.motion * .80 +
    killMotion * 1.35 +
    killColor * .72 +
    localizedResource * 1.05 +
    localizedObjective * 1.08 +
    centerShock * .90,
  );
}

/**
 * Convierte candidatos dispersos en pocas ventanas de alta información. El
 * filtrado por distancia evita gastar cientos de seeks sobre la misma pelea.
 */
export function buildVideoRefineWindows(
  candidates: VideoRefineCandidate[],
  duration: number,
  maxWindows = 16,
): VideoRefineWindow[] {
  const safeDuration = Math.max(.1, duration);
  const selected: VideoRefineCandidate[] = [];
  const ordered = [...candidates]
    .filter((candidate) => Number.isFinite(candidate.second) && Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score || a.second - b.second);

  for (const candidate of ordered) {
    if (selected.length >= maxWindows) break;
    if (candidate.score < .105) continue;
    if (selected.some((previous) => Math.abs(previous.second - candidate.second) < 2.25)) continue;
    selected.push(candidate);
  }

  const windows = selected
    .map((candidate) => ({
      startSecond: Math.max(.04, candidate.second - 1.25),
      endSecond: Math.min(Math.max(.05, safeDuration - .04), candidate.second + 1.45),
      score: candidate.score,
    }))
    .sort((a, b) => a.startSecond - b.startSecond);

  const merged: VideoRefineWindow[] = [];
  for (const window of windows) {
    const previous = merged[merged.length - 1];
    if (previous && window.startSecond <= previous.endSecond + .18) {
      previous.endSecond = Math.max(previous.endSecond, window.endSecond);
      previous.score = Math.max(previous.score, window.score);
    } else {
      merged.push({ ...window });
    }
  }
  return merged.slice(0, maxWindows);
}

const DEATH_COPY: Record<Exclude<VideoEventOverride, "drop">, {
  label: string;
  category: string;
  tone: LiveEventTone;
  comment: string;
}> = {
  death: {
    label: "Muerte",
    category: "Manual · Combate",
    tone: "bad",
    comment: "Clasificación corregida manualmente: muerte propia.",
  },
  "ally-death": {
    label: "Muerte aliada",
    category: "Manual · Combate",
    tone: "bad",
    comment: "Clasificación corregida manualmente: muerte aliada.",
  },
  "enemy-death": {
    label: "Eliminación rival",
    category: "Manual · Combate",
    tone: "good",
    comment: "Clasificación corregida manualmente: baja rival.",
  },
};

export function applyVideoEventOverrides(
  events: VideoReviewEvent[],
  overrides: Record<string, VideoEventOverride | undefined>,
) {
  return events.flatMap((event) => {
    const override = overrides[event.id];
    if (!override) return [event];
    if (override === "drop") return [];
    const copy = DEATH_COPY[override];
    return [{
      ...event,
      key: override,
      label: copy.label,
      category: copy.category,
      tone: copy.tone,
      confidence: Math.max(event.confidence, 96),
      comment: copy.comment,
    }];
  });
}

const nextWithin = (
  events: VideoReviewEvent[],
  index: number,
  keys: string[],
  seconds: number,
) => events.slice(index + 1).find((candidate) =>
  candidate.second >= events[index].second &&
  candidate.second - events[index].second <= seconds &&
  keys.includes(candidate.key)
);

function modeAction(mode?: string) {
  if (mode === "Balón Brawl") return "Tras una baja, convierte primero en control del balón y carril central; perseguir una segunda baja solo compensa si no retrasa el avance.";
  if (mode === "Zona Restringida") return "En ventaja numérica, ocupa zona antes de perseguir. En 2v3, cede borde y gana segundos hasta reagrupar.";
  if (mode === "Atrapagemas") return "Separa presión de portador: una baja rival debe traducirse en control de mid o gemas, no en una persecución lejos del conteo.";
  if (mode === "Atraco") return "Después de cada baja decide inmediatamente si el valor marginal está en caja rival o en defender la propia; evita transiciones ambiguas.";
  if (mode === "Caza Estelar") return "Con ventaja de estrellas, reduce trades innecesarios; una superioridad numérica vale más si termina sin devolver la baja.";
  if (mode === "Noqueo") return "Cada baja cambia la condición de la ronda: en 3v2 abre ángulos juntos; en 2v3 no entregues la segunda baja antes de forzar recursos.";
  return "Convierte cada ventaja numérica en objetivo, posición o control de mapa antes del respawn rival.";
}

function roleAction(role?: string, brawlerName?: string) {
  const subject = brawlerName || "tu brawler";
  const normalized = (role || "").toLowerCase();
  if (normalized.includes("tirador")) return `Con ${subject}, revisa especialmente las muertes tras perder distancia: mantén una ruta de kiteo y no cruces el rango de antidive sin información.`;
  if (normalized.includes("asesino")) return `Con ${subject}, separa entrada y conversión: entra después de que el rival gaste control, y corta la persecución cuando ya hayas creado superioridad.`;
  if (normalized.includes("tanque")) return `Con ${subject}, mide si tu entrada absorbe recursos y crea espacio o solo entrega vida; identifica qué control rival debes forzar antes del engage.`;
  if (normalized.includes("artillero")) return `Con ${subject}, revisa cualquier muerte sin muro o ruta de escape: el valor está en negar chokes sin exponerte a la línea abierta.`;
  if (normalized.includes("apoyo")) return `Con ${subject}, prioriza sincronía: una ventaja numérica se pierde si aceleras la jugada antes de que el carry tenga munición o posición.`;
  if (normalized.includes("control")) return `Con ${subject}, comprueba si tus recursos sostienen espacio útil del objetivo; no conviertas control ganado en una persecución que reabra el mapa.`;
  return `Revisa con ${subject} la decisión inmediatamente anterior a cada muerte y cada ventaja numérica; ahí suele estar la mayor ganancia de ejecución.`;
}

export function buildVideoTacticalReadout(
  report: VideoReviewReport,
  context: VideoReviewContext = {},
): VideoTacticalReadout {
  const events = [...report.events].sort((a, b) => a.second - b.second);
  let pressureWindows = 0;
  let pressureConverted = 0;
  let friendlyDeaths = 0;
  let deathsWithObjectiveCost = 0;
  let tradesRecovered = 0;
  let superUses = 0;
  let superWithFollowup = 0;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.key === "enemy-death") {
      pressureWindows += 1;
      if (nextWithin(events, index, ["objective"], 7.5)) pressureConverted += 1;
    }
    if (event.key === "death" || event.key === "ally-death") {
      friendlyDeaths += 1;
      if (nextWithin(events, index, ["objective"], 7.5)) deathsWithObjectiveCost += 1;
      if (nextWithin(events, index, ["enemy-death"], 5.5)) tradesRecovered += 1;
    }
    if (event.key === "super") {
      superUses += 1;
      if (nextWithin(events, index, ["enemy-death", "objective", "combat"], 7)) superWithFollowup += 1;
    }
  }

  const highConfidence = events.filter((event) => event.confidence >= 70).length;
  const criticalSequences = report.sequences.filter((sequence) => sequence.priority === "Crítica" || sequence.priority === "Alta").length;
  const pressureConversionRate = percent(pressureConverted, pressureWindows);
  const deathCostRate = percent(deathsWithObjectiveCost, friendlyDeaths);
  const tradeRecoveryRate = percent(tradesRecovered, friendlyDeaths);
  const superFollowupRate = percent(superWithFollowup, superUses);
  const highConfidenceShare = percent(highConfidence, events.length);

  const strengths: string[] = [];
  const risks: string[] = [];
  const actions: string[] = [modeAction(context.mode), roleAction(context.brawlerRole, context.brawlerName)];

  if (pressureConverted >= 2 || (pressureWindows && pressureConversionRate >= 60)) {
    strengths.push(`Buena conversión temporal de ventajas: ${pressureConverted}/${pressureWindows} bajas rivales fueron seguidas por cambio de objetivo en ≤7,5 s.`);
  }
  if (tradesRecovered >= 2 || (friendlyDeaths && tradeRecoveryRate >= 55)) {
    strengths.push(`Respuesta rápida tras bajas propias/aliadas: ${tradesRecovered} trades aparecen en ≤5,5 s.`);
  }
  if (superUses && superFollowupRate >= 65) {
    strengths.push(`Los usos de super detectados suelen tener continuación: ${superWithFollowup}/${superUses} enlazan con combate, baja u objetivo.`);
  }
  if (report.teamBalance.netTeamKills > 0) strengths.push(`Balance de bajas clasificadas favorable: +${report.teamBalance.netTeamKills}.`);

  const ownDeaths = report.teamBalance.ownDeaths;
  if (ownDeaths >= 2) risks.push(`${ownDeaths} muertes propias clasificadas: revisa especialmente la entrada previa y la reentrada tras respawn.`);
  if (deathsWithObjectiveCost >= 1) risks.push(`${deathsWithObjectiveCost} bajas de vuestro equipo son seguidas por cambio de objetivo en ≤7,5 s; son las ventanas de mayor coste potencial.`);
  if (pressureWindows >= 2 && pressureConversionRate < 45) risks.push(`Solo ${pressureConverted}/${pressureWindows} ventajas numéricas se enlazan rápido con objetivo: posible pérdida de tempo tras la baja.`);
  if (superUses >= 2 && superFollowupRate < 45) risks.push(`Solo ${superWithFollowup}/${superUses} supers detectadas tienen una continuación clara en los 7 s siguientes.`);
  if (criticalSequences >= 2) risks.push(`${criticalSequences} secuencias de prioridad alta/crítica concentran la mayor parte de la revisión.`);
  if (report.signalQuality === "Baja") risks.push("La señal visual global es baja; confirma manualmente las bajas antes de usar el informe para ajustar hábitos.");

  if (deathsWithObjectiveCost > 0) actions.push("Empieza la revisión 3–4 s antes de cada baja con coste de objetivo y busca la primera decisión irreversible, no el último disparo.");
  if (pressureWindows > pressureConverted) actions.push("En cada baja rival no convertida, comprueba si el equipo persiguió, recargó tarde o no ocupó el espacio que acababa de abrirse.");
  if (superUses > superWithFollowup) actions.push("Marca qué debía obtener cada super antes de activarla: baja, control, objetivo o escape. Si no hay una de esas cuatro salidas, retrasa el recurso.");
  if (context.result === "Victoria" && risks.length) actions.push("Aunque el resultado fue victoria, conserva estas secuencias como errores de proceso: ganar la partida no invalida una mala decisión repetible.");
  if (context.result === "Derrota" && strengths.length) actions.push("En derrota, separa las secuencias que sí funcionaron de los errores decisivos para no corregir de más una línea de juego válida.");

  let focus = "Conversión de ventajas y primera muerte";
  if (deathsWithObjectiveCost > 0) focus = "Muertes con coste de objetivo";
  else if (ownDeaths >= 2) focus = "Timing de entrada y reentrada";
  else if (pressureWindows >= 2 && pressureConversionRate < 45) focus = "Conversión tras ventaja numérica";
  else if (superUses >= 2 && superFollowupRate < 45) focus = "Eficiencia de supers";
  else if (criticalSequences > 0) focus = "Secuencias de prioridad alta";

  return {
    pressureWindows,
    pressureConverted,
    pressureConversionRate,
    friendlyDeaths,
    deathsWithObjectiveCost,
    deathCostRate,
    tradesRecovered,
    tradeRecoveryRate,
    superUses,
    superWithFollowup,
    superFollowupRate,
    highConfidenceShare,
    criticalSequences,
    focus,
    strengths: strengths.slice(0, 4),
    risks: risks.slice(0, 5),
    actions: actions.slice(0, 5),
  };
}
