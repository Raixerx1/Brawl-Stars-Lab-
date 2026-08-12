import { brawlers, maps } from "./data";
import { rankCountersAgainst } from "./counter-engine";
import type { Brawler, MapProfile } from "./types";

export type VoiceMapTopPick = {
  name: string;
  tier: "S" | "A";
  rank: number;
};

export type VoiceCounterPick = {
  name: string;
  score: number;
  confidence: "Alta" | "Media" | "Baja";
  explicit: boolean;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function findMap(query: string): MapProfile | undefined {
  const wanted = normalize(query);
  return maps.find((map) => {
    if (normalize(map.slug) === wanted || normalize(map.name) === wanted) return true;
    return (map.aliases || []).some((alias) => normalize(alias) === wanted);
  });
}

function findBrawler(query: string): Brawler | undefined {
  const wanted = normalize(query);
  return brawlers.find(
    (brawler) => normalize(brawler.name) === wanted || normalize(brawler.slug) === wanted,
  );
}

/**
 * Canonical 10-brawler map pool used by the voice coach.
 *
 * The map data already stores five Tier S and five Tier A candidates. Keeping
 * the index derived from those fields means it follows the same curated/meta
 * input used by Draft Engine 2.0 instead of duplicating a static list.
 */
export function getVoiceMapTop10(mapQuery: string): VoiceMapTopPick[] {
  const map = findMap(mapQuery);
  if (!map) return [];

  const ordered = [
    ...map.tierS.map((name) => ({ name, tier: "S" as const })),
    ...map.tierA.map((name) => ({ name, tier: "A" as const })),
  ];

  const seen = new Set<string>();
  return ordered
    .filter(({ name }) => {
      const key = normalize(name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/**
 * Canonical 5-counter lookup used by the voice coach.
 *
 * This deliberately calls rankCountersAgainst() rather than copying the
 * counteredBy arrays. The result therefore preserves the current counter
 * engine: explicit matchup relations + reviewed notes + mechanics + meta-tier
 * viability, with the same score/confidence ordering used by the app.
 */
export function getVoiceTop5Counters(brawlerQuery: string): VoiceCounterPick[] {
  const target = findBrawler(brawlerQuery);
  if (!target) return [];

  return rankCountersAgainst(target, brawlers, 5).map((result) => ({
    name: result.candidate.name,
    score: result.score,
    confidence: result.confidence,
    explicit: result.explicit,
  }));
}

/** Precomputed-at-module-load lookup for instant UI/voice access. */
export const voiceMapTop10Index = Object.fromEntries(
  maps.map((map) => [map.slug, getVoiceMapTop10(map.slug)]),
) as Record<string, VoiceMapTopPick[]>;

/** Precomputed-at-module-load counter lookup for all brawlers. */
export const voiceCounterIndex = Object.fromEntries(
  brawlers.map((brawler) => [brawler.name, getVoiceTop5Counters(brawler.name)]),
) as Record<string, VoiceCounterPick[]>;
