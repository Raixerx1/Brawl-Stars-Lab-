import type { Brawler } from "./types";

export type BrokenMatchupReference = {
  source: string;
  field: "counters" | "counteredBy";
  target: string;
};

export type RosterAudit = {
  total: number;
  uniqueNames: number;
  uniqueSlugs: number;
  withCounters: number;
  withThreats: number;
  completeMatchups: number;
  duplicateNames: string[];
  duplicateSlugs: string[];
  brokenReferences: BrokenMatchupReference[];
};

function duplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

export function auditRoster(brawlers: Brawler[]): RosterAudit {
  const names = brawlers.map((brawler) => brawler.name);
  const slugs = brawlers.map((brawler) => brawler.slug);
  const nameSet = new Set(names);
  const brokenReferences: BrokenMatchupReference[] = [];

  for (const brawler of brawlers) {
    for (const target of brawler.counters || []) {
      if (!nameSet.has(target)) brokenReferences.push({ source: brawler.name, field: "counters", target });
    }
    for (const target of brawler.counteredBy || []) {
      if (!nameSet.has(target)) brokenReferences.push({ source: brawler.name, field: "counteredBy", target });
    }
  }

  const withCounters = brawlers.filter((brawler) => (brawler.counters || []).length > 0).length;
  const withThreats = brawlers.filter((brawler) => (brawler.counteredBy || []).length > 0).length;

  return {
    total: brawlers.length,
    uniqueNames: new Set(names).size,
    uniqueSlugs: new Set(slugs).size,
    withCounters,
    withThreats,
    completeMatchups: brawlers.filter(
      (brawler) => (brawler.counters || []).length > 0 && (brawler.counteredBy || []).length > 0,
    ).length,
    duplicateNames: duplicates(names),
    duplicateSlugs: duplicates(slugs),
    brokenReferences,
  };
}
