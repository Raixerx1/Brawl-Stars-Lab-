import type { LiveMatchEvent, LiveReviewSession, PersonalMatch } from "./types";

export type LearningPattern = {
  label: string;
  count: number;
  sessions: number;
  contexts: string[];
};

export type LearningWeakContext = {
  key: string;
  label: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
};

export type ContextLearningProfile = {
  matches: number;
  wins: number;
  winRate: number;
  recentGames: number;
  recentWinRate?: number;
  previousWinRate?: number;
  trend?: number;
  reviews: number;
  averageExecution?: number;
  topMistakes: LearningPattern[];
  topStrengths: LearningPattern[];
  weakBrawlers: LearningWeakContext[];
  weakMaps: LearningWeakContext[];
  weakBrawlerMaps: LearningWeakContext[];
  focus: string[];
};

const NEGATIVE_LABELS = new Set([
  "Muerte con coste de objetivo",
  "Entrada castigada",
  "Muerte encadenada",
  "Cadena de muertes",
  "Super sin conversión",
  "Super desperdiciada",
  "Hipercarga desperdiciada",
  "Sobreextensión",
  "Objetivo perdido",
  "Matchup desfavorable",
  "Muerte",
]);

const POSITIVE_LABELS = new Set([
  "Presión convertida",
  "Matchup corregido",
  "Super con impacto",
  "Super decisiva",
  "Hipercarga decisiva",
  "Buena rotación",
  "Objetivo ganado",
  "Matchup favorable",
  "Eliminación",
]);

const normalize = (value: string) => value.trim().toLowerCase();

function winRate(matches: PersonalMatch[]) {
  if (!matches.length) return undefined;
  return Math.round(matches.filter((match) => match.result === "Victoria").length / matches.length * 100);
}

function buildWeakContexts(
  matches: PersonalMatch[],
  keyFor: (match: PersonalMatch) => string,
  labelFor: (match: PersonalMatch) => string,
  minimumGames: number,
) {
  const groups = new Map<string, { label: string; games: number; wins: number; losses: number }>();
  for (const match of matches) {
    const key = keyFor(match);
    const current = groups.get(key) || { label: labelFor(match), games: 0, wins: 0, losses: 0 };
    current.games += 1;
    if (match.result === "Victoria") current.wins += 1;
    else current.losses += 1;
    groups.set(key, current);
  }

  return [...groups.entries()]
    .flatMap(([key, value]): LearningWeakContext[] => value.games >= minimumGames ? [{
      key,
      label: value.label,
      games: value.games,
      wins: value.wins,
      losses: value.losses,
      winRate: Math.round(value.wins / value.games * 100),
    }] : [])
    .filter((item) => item.winRate < 50)
    .sort((a, b) => a.winRate - b.winRate || b.games - a.games)
    .slice(0, 5);
}

function usableEvents(session: LiveReviewSession) {
  return session.events.filter((event) => event.feedback !== "rejected");
}

function patternList(
  sessions: LiveReviewSession[],
  acceptedLabels: Set<string>,
): LearningPattern[] {
  const patternMap = new Map<string, { count: number; sessionIds: Set<string>; contexts: Set<string> }>();

  for (const session of sessions) {
    for (const event of usableEvents(session)) {
      if (!acceptedLabels.has(event.label)) continue;
      const current = patternMap.get(event.label) || { count: 0, sessionIds: new Set<string>(), contexts: new Set<string>() };
      current.count += event.source === "Auto" && event.feedback !== "accepted" ? .7 : 1;
      current.sessionIds.add(session.id);
      current.contexts.add(`${session.brawler} · ${session.mapName}`);
      patternMap.set(event.label, current);
    }
  }

  return [...patternMap.entries()]
    .map(([label, value]) => ({
      label,
      count: Math.round(value.count * 10) / 10,
      sessions: value.sessionIds.size,
      contexts: [...value.contexts].slice(0, 3),
    }))
    .filter((item) => item.count >= 1)
    .sort((a, b) => b.sessions - a.sessions || b.count - a.count)
    .slice(0, 5);
}

function eventFrequency(session: LiveReviewSession, labels: Set<string>) {
  return usableEvents(session).filter((event: LiveMatchEvent) => labels.has(event.label)).length;
}

export function buildContextLearningProfile(
  matches: PersonalMatch[],
  sessions: LiveReviewSession[],
): ContextLearningProfile {
  const orderedMatches = [...matches].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const recent = orderedMatches.slice(0, 10);
  const previous = orderedMatches.slice(10, 20);
  const recentRate = winRate(recent);
  const previousRate = winRate(previous);
  const completedReviews = sessions.filter((session) => session.duration >= 30 || session.events.length >= 2);
  const executionScores = completedReviews
    .map((session) => session.summary?.scorecard)
    .filter((scorecard) => scorecard && scorecard.verdict !== "Sin datos")
    .map((scorecard) => scorecard.overall);

  const topMistakes = patternList(completedReviews, NEGATIVE_LABELS);
  const topStrengths = patternList(completedReviews, POSITIVE_LABELS);
  const weakBrawlers = buildWeakContexts(
    orderedMatches,
    (match) => normalize(match.brawlerSlug || match.brawler),
    (match) => match.brawler,
    4,
  );
  const weakMaps = buildWeakContexts(
    orderedMatches,
    (match) => normalize(match.mapSlug || match.mapName),
    (match) => match.mapName,
    4,
  );
  const weakBrawlerMaps = buildWeakContexts(
    orderedMatches,
    (match) => `${normalize(match.brawlerSlug || match.brawler)}::${normalize(match.mapSlug || match.mapName)}`,
    (match) => `${match.brawler} · ${match.mapName}`,
    3,
  );

  const focus: string[] = [];
  const primaryMistake = topMistakes[0];
  if (primaryMistake) {
    focus.push(`Prioridad: reducir «${primaryMistake.label}»; aparece en ${primaryMistake.sessions} revisiones.`);
  }
  const weakPair = weakBrawlerMaps[0];
  if (weakPair) {
    focus.push(`Contexto a revisar: ${weakPair.label}, ${weakPair.winRate}% en ${weakPair.games} partidas.`);
  } else if (weakBrawlers[0]) {
    focus.push(`Brawler a revisar: ${weakBrawlers[0].label}, ${weakBrawlers[0].winRate}% en ${weakBrawlers[0].games} partidas.`);
  }
  if (typeof recentRate === "number" && typeof previousRate === "number") {
    const delta = recentRate - previousRate;
    if (delta <= -10) focus.push(`Tendencia reciente negativa (${delta} pp): reduce experimentación y prioriza picks de mayor dominio personal.`);
    else if (delta >= 10) focus.push(`Tendencia reciente positiva (+${delta} pp): mantén los patrones que están funcionando antes de ampliar el pool.`);
  }

  const costlySessions = completedReviews
    .map((session) => ({ session, bad: eventFrequency(session, NEGATIVE_LABELS) }))
    .filter((item) => item.bad >= 2)
    .sort((a, b) => b.bad - a.bad);
  if (costlySessions[0]) {
    focus.push(`Revisa primero ${costlySessions[0].session.brawler} en ${costlySessions[0].session.mapName}: concentra ${costlySessions[0].bad} señales negativas.`);
  }

  if (!focus.length) {
    focus.push("Todavía falta muestra: registra resultados y revisiones completas para generar focos de entrenamiento fiables.");
  }

  const wins = orderedMatches.filter((match) => match.result === "Victoria").length;
  return {
    matches: orderedMatches.length,
    wins,
    winRate: orderedMatches.length ? Math.round(wins / orderedMatches.length * 100) : 0,
    recentGames: recent.length,
    recentWinRate: recentRate,
    previousWinRate: previousRate,
    trend: typeof recentRate === "number" && typeof previousRate === "number" ? recentRate - previousRate : undefined,
    reviews: completedReviews.length,
    averageExecution: executionScores.length ? Math.round(executionScores.reduce((sum, value) => sum + value, 0) / executionScores.length) : undefined,
    topMistakes,
    topStrengths,
    weakBrawlers,
    weakMaps,
    weakBrawlerMaps,
    focus: focus.slice(0, 4),
  };
}
