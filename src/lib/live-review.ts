import type {
  LiveMatchEvent,
  LiveReviewSession,
  LiveReviewSummary,
} from "./types";

export const LIVE_REVIEW_KEY = "brawl-lab:live-reviews";

const count = (events: LiveMatchEvent[], label: string) =>
  events.filter((event) => event.label === label).length;

const countAny = (events: LiveMatchEvent[], labels: string[]) =>
  events.filter((event) => labels.includes(event.label)).length;

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
  const favorableMatchups = count(events, "Matchup favorable");
  const badMatchups = count(events, "Matchup desfavorable");
  const laneChanges = count(events, "Cambio de línea");

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

  if (deaths > eliminations) mistakes.push(`Balance negativo de interacciones: ${deaths} muertes frente a ${eliminations} eliminaciones.`);
  if (overextensions) mistakes.push(`${overextensions} sobreextensiones marcadas.`);
  if (wastedSupers) mistakes.push(`${wastedSupers} supers con poco valor.`);
  if (wastedHypercharges) mistakes.push(`${wastedHypercharges} hipercargas mal aprovechadas.`);
  if (lostObjectives) mistakes.push(`${lostObjectives} momentos de objetivo perdidos.`);
  if (badMatchups) mistakes.push(`Quedaste ${badMatchups} veces en un matchup desfavorable.`);

  if (overextensions || deaths >= 3) recommendations.push("Reduce la profundidad de la entrada cuando no tengas munición, super o apoyo cercano.");
  if (wastedSupers) recommendations.push("Retrasa la super hasta tener confirmación de objetivo, control de zona o posibilidad real de eliminación.");
  if (wastedHypercharges) recommendations.push("Activa la hipercarga antes del intercambio decisivo, no después de haber perdido posición o recursos.");
  if (lostObjectives > objectives) recommendations.push("Prioriza control del objetivo sobre perseguir eliminaciones fuera de la zona útil.");
  if (badMatchups > favorableMatchups) recommendations.push("Solicita o ejecuta el cambio de línea en la primera pausa segura.");
  if (!laneChanges && badMatchups) recommendations.push("Usa más cambios de línea para corregir emparejamientos desfavorables.");
  if (detectedSupers && !goodSupers && !wastedSupers) recommendations.push(`Revisa el valor de los ${detectedSupers} usos de super detectados automáticamente.`);
  if (phaseChanges) recommendations.push("Compara tu posición y recursos antes y después de cada cambio de fase detectado.");
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
  if (autoEvents) recommendations.push(`${autoEvents} eventos fueron detectados automáticamente; elimina los falsos positivos antes de guardar.`);

  return {
    headline,
    strengths: strengths.slice(0, 5),
    mistakes: mistakes.slice(0, 5),
    recommendations: recommendations.slice(0, 5),
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
