import type {
  AutoReviewScorecard,
  LiveMatchEvent,
  LiveReviewSession,
  LiveReviewSummary,
} from "./types";

export const LIVE_REVIEW_KEY = "brawl-lab:live-reviews";

const count = (events: LiveMatchEvent[], label: string) =>
  events.filter((event) => event.label === label).length;

const countAny = (events: LiveMatchEvent[], labels: string[]) =>
  events.filter((event) => labels.includes(event.label)).length;

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const eventWeight = (event: LiveMatchEvent) => {
  if (event.source !== "Auto" || event.feedback === "accepted") return 1;
  return Math.max(.45, Math.min(.88, (event.confidence || 65) / 100));
};

const weightedCount = (events: LiveMatchEvent[], labels: string[]) => events
  .filter((event) => labels.includes(event.label))
  .reduce((total, event) => total + eventWeight(event), 0);

function dimensionScore(delta: number, evidence: number) {
  const reliability = Math.min(1, evidence / 6);
  return clampScore(50 + delta * reliability);
}

function keyMomentFor(events: LiveMatchEvent[]): AutoReviewScorecard["keyMoment"] {
  const negativePriority: Record<string, [number, string]> = {
    "Muerte con coste de objetivo": [10, "La muerte abrió una ventana directa sobre la condición de victoria."],
    "Muerte encadenada": [9, "La reentrada rápida terminó en otra pérdida de tempo."],
    "Cadena de muertes": [9, "Dos muertes cercanas condicionaron la siguiente fase."],
    "Super sin conversión": [8, "Se gastó el recurso sin una conversión clara."],
    "Entrada castigada": [8, "La interacción intensa terminó en una muerte evitable."],
    "Objetivo perdido": [8, "El rival convirtió la presión en progreso de objetivo."],
    "Hipercarga desperdiciada": [7, "La hipercarga no produjo una ventaja suficiente."],
    "Super desperdiciada": [7, "La super no produjo una ventaja suficiente."],
    "Sobreextensión": [6, "La posición dejó pocas opciones de retirada."],
    "Muerte": [5, "La baja alteró el tempo de la partida."],
  };
  const positivePriority: Record<string, [number, string]> = {
    "Objetivo ganado": [9, "La presión se convirtió en progreso real sobre el objetivo."],
    "Super con impacto": [8, "La super generó espacio o progreso de objetivo."],
    "Hipercarga decisiva": [8, "La hipercarga ganó una interacción importante."],
    "Super decisiva": [7, "La super produjo una ventaja clara."],
    "Presión convertida": [7, "La interacción intensa terminó en control del objetivo."],
    "Buena rotación": [6, "La rotación corrigió la presión o el matchup."],
    "Eliminación": [5, "La eliminación creó una ventana de ventaja."],
  };

  const candidates = events
    .filter((event) => event.feedback !== "rejected")
    .flatMap((event) => {
      const negative = negativePriority[event.label];
      const positive = positivePriority[event.label];
      const match = negative || positive;
      if (!match) return [];
      return [{
        event,
        priority: match[0] * eventWeight(event),
        reason: match[1],
        impact: negative ? "Negativo" as const : "Positivo" as const,
      }];
    })
    .sort((a, b) => b.priority - a.priority || b.event.second - a.event.second);

  const best = candidates[0];
  return best ? {
    second: best.event.second,
    label: best.event.label,
    impact: best.impact,
    reason: best.reason,
  } : undefined;
}

export function buildAutoReviewScorecard(events: LiveMatchEvent[]): AutoReviewScorecard {
  const usable = events.filter((event) => event.feedback !== "rejected");
  if (!usable.length) {
    return { overall: 0, positioning: 0, resources: 0, objective: 0, tempo: 0, reviewCoverage: 0, verdict: "Sin datos" };
  }

  const positioningDelta =
    weightedCount(usable, ["Buena rotación"]) * 11 +
    weightedCount(usable, ["Matchup favorable"]) * 8 +
    weightedCount(usable, ["Cambio de línea"]) * 4 -
    weightedCount(usable, ["Sobreextensión"]) * 14 -
    weightedCount(usable, ["Matchup desfavorable"]) * 9 -
    weightedCount(usable, ["Entrada castigada"]) * 11 -
    weightedCount(usable, ["Muerte encadenada", "Cadena de muertes"]) * 9;
  const resourcesDelta =
    weightedCount(usable, ["Super decisiva", "Hipercarga decisiva"]) * 14 +
    weightedCount(usable, ["Super con impacto"]) * 10 -
    weightedCount(usable, ["Super desperdiciada", "Hipercarga desperdiciada"]) * 15 -
    weightedCount(usable, ["Super sin conversión"]) * 11;
  const objectiveDelta =
    weightedCount(usable, ["Objetivo ganado", "Presión convertida"]) * 14 +
    weightedCount(usable, ["Super con impacto"]) * 7 -
    weightedCount(usable, ["Objetivo perdido"]) * 16 -
    weightedCount(usable, ["Muerte con coste de objetivo"]) * 13;
  const tempoDelta =
    weightedCount(usable, ["Eliminación"]) * 6 +
    weightedCount(usable, ["Buena rotación"]) * 5 -
    weightedCount(usable, ["Muerte"]) * 6 -
    weightedCount(usable, ["Entrada castigada"]) * 7 -
    weightedCount(usable, ["Muerte encadenada", "Cadena de muertes"]) * 12;

  const positioning = dimensionScore(positioningDelta, usable.length);
  const resources = dimensionScore(resourcesDelta, usable.length);
  const objective = dimensionScore(objectiveDelta, usable.length);
  const tempo = dimensionScore(tempoDelta, usable.length);
  const overall = clampScore(positioning * .28 + resources * .23 + objective * .28 + tempo * .21);
  const autoEvents = events.filter((event) => event.source === "Auto");
  const reviewed = autoEvents.filter((event) => Boolean(event.feedback)).length;
  const reviewCoverage = autoEvents.length ? clampScore(reviewed / autoEvents.length * 100) : 100;
  const verdict: AutoReviewScorecard["verdict"] =
    overall >= 78 ? "Excelente" :
    overall >= 63 ? "Sólida" :
    overall >= 45 ? "Mejorable" : "Crítica";

  return {
    overall,
    positioning,
    resources,
    objective,
    tempo,
    reviewCoverage,
    verdict,
    keyMoment: keyMomentFor(usable),
  };
}

export function formatLiveTime(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function buildLiveSummary(events: LiveMatchEvent[], duration: number): LiveReviewSummary {
  const eliminations = count(events, "Eliminación");
  const deaths = count(events, "Muerte");
  const autoEvents = events.filter((event) => event.source === "Auto").length;
  const goodRotations = count(events, "Buena rotación");
  const overextensions = count(events, "Sobreextensión");
  const goodSupers = count(events, "Super decisiva");
  const wastedSupers = count(events, "Super desperdiciada");
  const goodHypercharges = count(events, "Hipercarga decisiva");
  const wastedHypercharges = count(events, "Hipercarga desperdiciada");
  const objectives = count(events, "Objetivo ganado");
  const lostObjectives = count(events, "Objetivo perdido");
  const detectedObjectiveChanges = count(events, "Cambio de objetivo");
  const detectedSupers = countAny(events, ["Super utilizada", "Super decisiva", "Super desperdiciada"]);
  const phaseChanges = count(events, "Cambio de fase");
  const punishedEntries = count(events, "Entrada castigada");
  const supersWithoutConversion = count(events, "Super sin conversión");
  const costlyDeaths = count(events, "Muerte con coste de objetivo");
  const chainedDeaths = countAny(events, ["Muerte encadenada", "Cadena de muertes"]);
  const impactfulSupers = count(events, "Super con impacto");
  const sequenceInsights = events.filter((event) => Boolean(event.sequenceKey)).length;
  const favorableMatchups = count(events, "Matchup favorable");
  const badMatchups = count(events, "Matchup desfavorable");
  const laneChanges = count(events, "Cambio de línea");
  const convertedPressure = count(events, "Presión convertida");
  const correctedMatchups = count(events, "Matchup corregido");

  const strengths: string[] = [];
  const mistakes: string[] = [];
  const recommendations: string[] = [];

  if (eliminations > deaths) strengths.push(`Balance favorable de interacciones: ${eliminations} eliminaciones y ${deaths} muertes.`);
  if (goodRotations) strengths.push(`${goodRotations} rotaciones positivas registradas.`);
  if (goodSupers) strengths.push(`${goodSupers} supers con impacto claro.`);
  if (goodHypercharges) strengths.push(`${goodHypercharges} hipercargas decisivas.`);
  if (objectives) strengths.push(`${objectives} momentos de objetivo ganados.`);
  if (favorableMatchups) strengths.push(`Conservaste ${favorableMatchups} matchups favorables.`);
  if (detectedObjectiveChanges && objectives >= lostObjectives) strengths.push(`${detectedObjectiveChanges} cambios de objetivo detectados y registrados para revisión.`);
  if (impactfulSupers) strengths.push(`${impactfulSupers} secuencias compatibles con una super que generó impacto sobre el objetivo.`);
  if (convertedPressure) strengths.push(`${convertedPressure} interacciones intensas convertidas en progreso de objetivo.`);
  if (correctedMatchups) strengths.push(`${correctedMatchups} cambios de línea corrigieron un matchup desfavorable.`);

  if (deaths > eliminations) mistakes.push(`Balance negativo de interacciones: ${deaths} muertes frente a ${eliminations} eliminaciones.`);
  if (overextensions) mistakes.push(`${overextensions} sobreextensiones marcadas.`);
  if (wastedSupers) mistakes.push(`${wastedSupers} supers con poco valor.`);
  if (wastedHypercharges) mistakes.push(`${wastedHypercharges} hipercargas mal aprovechadas.`);
  if (lostObjectives) mistakes.push(`${lostObjectives} momentos de objetivo perdidos.`);
  if (badMatchups) mistakes.push(`Quedaste ${badMatchups} veces en un matchup desfavorable.`);
  if (punishedEntries) mistakes.push(`${punishedEntries} entradas intensas terminaron en una muerte rápida.`);
  if (supersWithoutConversion) mistakes.push(`${supersWithoutConversion} usos de super pudieron terminar sin conversión.`);
  if (costlyDeaths) mistakes.push(`${costlyDeaths} muertes coincidieron con un cambio de objetivo posterior.`);
  if (chainedDeaths) mistakes.push(`${chainedDeaths} secuencias de muertes o reentradas rápidas detectadas.`);

  if (overextensions || deaths >= 3) recommendations.push("Reduce la profundidad de la entrada cuando no tengas munición, super o apoyo cercano.");
  if (wastedSupers) recommendations.push("Retrasa la super hasta tener confirmación de objetivo, control de zona o posibilidad real de eliminación.");
  if (wastedHypercharges) recommendations.push("Activa la hipercarga antes del intercambio decisivo, no después de haber perdido posición o recursos.");
  if (lostObjectives > objectives) recommendations.push("Prioriza control del objetivo sobre perseguir eliminaciones fuera de la zona útil.");
  if (badMatchups > favorableMatchups) recommendations.push("Solicita o ejecuta el cambio de línea en la primera pausa segura.");
  if (!laneChanges && badMatchups) recommendations.push("Usa más cambios de línea para corregir emparejamientos desfavorables.");
  if (detectedSupers && !goodSupers && !wastedSupers) recommendations.push(`Revisa el valor de los ${detectedSupers} usos de super detectados automáticamente.`);
  if (phaseChanges) recommendations.push("Compara tu posición y recursos antes y después de cada cambio de fase detectado.");
  if (punishedEntries) recommendations.push("Después de una interacción intensa, corta la entrada antes y conserva una ruta de retirada.");
  if (supersWithoutConversion) recommendations.push("Antes de usar la super, define qué obtienes: eliminación, control, objetivo o escape.");
  if (costlyDeaths) recommendations.push("Evita asumir un intercambio si tu muerte abre directamente la condición de victoria rival.");
  if (chainedDeaths) recommendations.push("Tras reaparecer, sincroniza la reentrada y no intentes recuperar solo toda la posición.");
  if (!events.length) recommendations.push("Activa Auto Review o registra eventos durante la partida para generar una revisión específica.");
  if (!recommendations.length) recommendations.push("Mantén el plan actual y revisa especialmente la primera muerte y el último uso de super.");

  const interactions = eliminations + deaths;
  const headline =
    events.length === 0 ? "Sesión sin eventos registrados" :
    mistakes.length > strengths.length ? "Partida con errores corregibles" :
    strengths.length > mistakes.length ? "Partida con ejecución favorable" :
    interactions >= 4 ? "Partida equilibrada en interacciones" :
    "Muestra limitada: revisa los momentos decisivos";

  if (duration < 30 && events.length) recommendations.push("La sesión fue muy breve; confirma que la captura cubrió la partida completa.");
  if (autoEvents) recommendations.push(`${autoEvents} eventos fueron detectados automáticamente; revisa los pendientes antes de guardar.`);
  if (sequenceInsights) recommendations.push(`${sequenceInsights} conclusiones proceden de secuencias temporales, no de un único fotograma.`);

  return {
    headline,
    strengths: strengths.slice(0, 5),
    mistakes: mistakes.slice(0, 5),
    recommendations: recommendations.slice(0, 5),
    scorecard: buildAutoReviewScorecard(events),
  };
}

export function readLiveReviews(): LiveReviewSession[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(LIVE_REVIEW_KEY) || "[]");
    return Array.isArray(value) ? value.slice(0, 50) as LiveReviewSession[] : [];
  } catch {
    return [];
  }
}

export function saveLiveReviews(sessions: LiveReviewSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIVE_REVIEW_KEY, JSON.stringify(sessions.slice(0, 50)));
}
