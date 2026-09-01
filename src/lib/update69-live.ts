import type { Brawler } from "./types";

/**
 * Update 69 / 69.230 — patch-day competitive prior, activated 01/09/2026.
 *
 * IMPORTANT:
 * - The statistical baseline is still the complete NOFF 24 h snapshot from 30/08.
 * - These overrides are intentionally conservative and represent the expected
 *   direction of the FINAL Update 69 balance package, not observed post-patch
 *   win rates. Map, mode, geometry and direct matchup remain more important.
 * - Buffies and the Nori/Wendy Hypercharges are tracked separately; they do not
 *   automatically promote a Brawler here until their Ranked availability and
 *   real post-patch performance are clear.
 */
export const UPDATE69_LIVE_DATE = "01/09/2026";
export const UPDATE69_CLIENT_VERSION = "69.230";

export const update69PatchDayTierByName: Record<string, string> = {
  // Strong pre-patch picks hit by the final balance package.
  Wendy: "A",
  Griff: "A",
  Max: "A",
  Nori: "A",
  Rico: "B",
  Meg: "B",
  Lumi: "B",
  Ash: "C",
  Bolt: "D",
  Ruffs: "F",

  // Brawlers whose base-kit changes justify a cautious one-step promotion.
  Melodie: "A",
  Bea: "B",
  Jessie: "B",
  Leon: "B",
  Eve: "B",
  Buster: "D",
  Hank: "D",
  Colette: "D",
  Lola: "D",
  Maisie: "D",
  Tara: "D",
  "Jae-Yong": "D",
  Janet: "D",
  Ziggy: "D",
  Jacky: "D",
  Clancy: "D",
};

export const update69BuffieWatchlist = [
  "Poco",
  "El Primo",
  "Amber",
  "Gus",
  "Chuck",
  "Shade",
] as const;

export const update69HyperchargeWatchlist = ["Nori", "Wendy"] as const;

export const update69MixedWatchlist = [
  "Bo",
  "Chuck",
] as const;

export function applyUpdate69Live(roster: Brawler[]): Brawler[] {
  return roster.map((brawler) => {
    const tier = update69PatchDayTierByName[brawler.name] || brawler.tier;
    return {
      ...brawler,
      tier,
      matchupReviewedAt: UPDATE69_LIVE_DATE,
      firstPickProfileReviewedAt: brawler.firstPickProfile
        ? UPDATE69_LIVE_DATE
        : brawler.firstPickProfileReviewedAt,
      firstPickProfileVersion: brawler.firstPickProfile
        ? "v0.24.0-u69"
        : brawler.firstPickProfileVersion,
      // Wendy loses blind-pick resilience after the generator/shield package is
      // toned down. We deliberately adjust structure rather than inventing a
      // post-patch win rate on day one.
      firstPickProfile: brawler.name === "Wendy" && brawler.firstPickProfile
        ? {
            ...brawler.firstPickProfile,
            blindSafety: 74,
            objective: 82,
            control: 82,
            chokeControl: 80,
            counterRisk: 42,
          }
        : brawler.firstPickProfile,
    };
  });
}
