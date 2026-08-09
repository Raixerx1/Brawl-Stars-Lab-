import type {
  Brawler,
  MapProfile,
  PersonalMatch,
  PersonalPerformance,
  PersonalStat,
} from "./types";

export const MATCH_HISTORY_KEY = "brawl-lab:matches";

const emptyStat = (): PersonalStat => ({ games: 0, wins: 0, losses: 0, winRate: 0 });

const finishStat = (stat: PersonalStat): PersonalStat => ({
  ...stat,
  winRate: stat.games ? Math.round((stat.wins / stat.games) * 100) : 0,
});

const addResult = (stat: PersonalStat, victory: boolean) => {
  stat.games += 1;
  if (victory) stat.wins += 1;
  else stat.losses += 1;
};

export function normalizeMatchHistory(
  raw: unknown,
  maps: MapProfile[] = [],
  brawlers: Brawler[] = [],
): PersonalMatch[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item): PersonalMatch[] => {
    if (!item || typeof item !== "object") return [];
    const value = item as Partial<PersonalMatch> & { map?: string };
    if (!value.brawler || !value.result) return [];

    const mapProfile = maps.find((map) =>
      map.slug === value.mapSlug || map.name === value.mapName || map.name === value.map,
    );
    const brawler = brawlers.find((entry) => entry.name === value.brawler || entry.slug === value.brawlerSlug);
    const result = value.result === "Derrota" ? "Derrota" : "Victoria";

    return [{
      id: value.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: value.date || new Date().toISOString(),
      mapSlug: value.mapSlug || mapProfile?.slug || "unknown-map",
      mapName: value.mapName || value.map || mapProfile?.name || "Mapa desconocido",
      mode: value.mode || mapProfile?.mode || "Modo desconocido",
      brawler: value.brawler,
      brawlerSlug: value.brawlerSlug || brawler?.slug,
      role: value.role || brawler?.role,
      result,
      draftPosition: value.draftPosition,
      allies: Array.isArray(value.allies) ? value.allies : [],
      enemies: Array.isArray(value.enemies) ? value.enemies : [],
      note: value.note || "",
      source: value.source === "Draft Coach" ? "Draft Coach" : "Manual",
    }];
  });
}

export function readMatchHistory(maps: MapProfile[] = [], brawlers: Brawler[] = []): PersonalMatch[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizeMatchHistory(
      JSON.parse(window.localStorage.getItem(MATCH_HISTORY_KEY) || "[]"),
      maps,
      brawlers,
    );
  } catch {
    return [];
  }
}

export function saveMatchHistory(matches: PersonalMatch[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(matches));
}

export function buildPersonalPerformance(matches: PersonalMatch[]): PersonalPerformance {
  const overall = emptyStat();
  const brawlers: Record<string, PersonalStat> = {};
  const maps: Record<string, PersonalStat> = {};
  const roles: Record<string, PersonalStat> = {};
  const brawlerMaps: Record<string, PersonalStat> = {};

  for (const match of matches) {
    const victory = match.result === "Victoria";
    const brawlerKey = match.brawlerSlug || match.brawler.toLowerCase();
    const mapKey = match.mapSlug || match.mapName.toLowerCase();
    const roleKey = match.role || "Sin rol";
    const brawlerMapKey = `${brawlerKey}::${mapKey}`;

    brawlers[brawlerKey] ||= emptyStat();
    maps[mapKey] ||= emptyStat();
    roles[roleKey] ||= emptyStat();
    brawlerMaps[brawlerMapKey] ||= emptyStat();

    addResult(overall, victory);
    addResult(brawlers[brawlerKey], victory);
    addResult(maps[mapKey], victory);
    addResult(roles[roleKey], victory);
    addResult(brawlerMaps[brawlerMapKey], victory);
  }

  return {
    overall: finishStat(overall),
    brawlers: Object.fromEntries(Object.entries(brawlers).map(([key, stat]) => [key, finishStat(stat)])),
    maps: Object.fromEntries(Object.entries(maps).map(([key, stat]) => [key, finishStat(stat)])),
    roles: Object.fromEntries(Object.entries(roles).map(([key, stat]) => [key, finishStat(stat)])),
    brawlerMaps: Object.fromEntries(Object.entries(brawlerMaps).map(([key, stat]) => [key, finishStat(stat)])),
  };
}

export function personalAdjustment(
  brawlerSlug: string,
  mapSlug: string,
  performance?: PersonalPerformance,
) {
  if (!performance) return { adjustment: 0, brawler: undefined, map: undefined };
  const brawler = performance.brawlers[brawlerSlug];
  const map = performance.brawlerMaps[`${brawlerSlug}::${mapSlug}`];

  const weightedEdge = (stat: PersonalStat | undefined, maxWeight: number, sampleTarget: number) => {
    if (!stat || stat.games < 2) return 0;
    const sample = Math.min(1, stat.games / sampleTarget);
    return ((stat.winRate - 50) / 50) * maxWeight * sample;
  };

  const adjustment = Math.max(-9, Math.min(9,
    weightedEdge(brawler, 5.5, 10) + weightedEdge(map, 5, 6),
  ));

  return { adjustment, brawler, map };
}
