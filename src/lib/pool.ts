import type { Brawler, PlayerPool, PlayerPoolEntry } from "./types";

export const PLAYER_POOL_KEY = "brawl-player-pool-v1";

export const defaultPoolEntry = (): PlayerPoolEntry => ({
  available: true,
  power11: false,
  hypercharge: false,
  mastery: 3,
  avoid: false,
  favorite: false,
});

export function createDefaultPool(roster: Brawler[]): PlayerPool {
  return Object.fromEntries(roster.map((brawler) => [brawler.slug, defaultPoolEntry()]));
}

export function mergePool(roster: Brawler[], stored?: PlayerPool | null): PlayerPool {
  const defaults = createDefaultPool(roster);
  if (!stored) return defaults;
  for (const brawler of roster) {
    defaults[brawler.slug] = { ...defaults[brawler.slug], ...(stored[brawler.slug] || {}) };
  }
  return defaults;
}

export function loadPool(roster: Brawler[]): PlayerPool {
  if (typeof window === "undefined") return createDefaultPool(roster);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PLAYER_POOL_KEY) || "null") as PlayerPool | null;
    return mergePool(roster, parsed);
  } catch {
    return createDefaultPool(roster);
  }
}

export function savePool(pool: PlayerPool) {
  if (typeof window !== "undefined") window.localStorage.setItem(PLAYER_POOL_KEY, JSON.stringify(pool));
}
