import type { Brawler } from "./types";

/**
 * First full-day calibration after the September 16 balance.
 *
 * The 16/09 mechanical adjustments remain owned by update69-live.ts. This layer
 * only updates the observed competitive baseline once a cleaner post-maintenance
 * sample is available. It is intentionally conservative: cross-source agreement
 * can move a brawler a full tier, while single-source spikes are capped.
 */
export const POST_BALANCE_REVIEW_DATE = "17/09/2026";
export const POST_BALANCE_MODEL_VERSION = "v0.33.3-u69-postbalance-1709";

export const postBalanceTierByName: Record<string, string> = {
  Gus: "S+",
  Wendy: "S",
  Poco: "S",
  Lou: "A",
  Sandy: "A",
  "Larry & Lawrie": "A",
  Gale: "A",
  Maisie: "A",
  "R-T": "B",
};

export const postBalance1709Summary = {
  status: "Meta post-balance 17/09 · ajustes oficiales del 16/09 + primera jornada Ranked posterior al mantenimiento",
  method: "Supercell fija la dirección mecánica del parche; BrawlBetter patch-aware pesa más para Ranked, con Brawl Time Ninja y NOFF como contraste. Los saltos sin consenso se limitan para evitar sobreajuste.",
  leaders: ["Gus", "Amber", "Shade", "Wendy", "El Primo", "Ash", "Poco"],
  promotedWatch: ["Lou", "Sandy", "Larry & Lawrie", "Gale", "Maisie"],
  caution: ["Wendy", "Nori", "R-T", "Ollie", "Chuck", "Meg"],
} as const;

function max(value: number | undefined, minimum: number) {
  return Math.max(value ?? minimum, minimum);
}

export function applyPostBalance1709(roster: Brawler[]): Brawler[] {
  return roster.map((brawler) => {
    const tier = postBalanceTierByName[brawler.name] || brawler.tier;
    let firstPickProfile = brawler.firstPickProfile;

    // Wendy remains strong, but the shield/turret nerfs make a blind opening more
    // punishable than the patch-day sample suggested.
    if (brawler.name === "Wendy" && firstPickProfile) {
      firstPickProfile = {
        ...firstPickProfile,
        blindSafety: 58,
        antiDive: 66,
        objective: 76,
        control: 76,
        counterRisk: 64,
      };
    }

    // Gus is the clearest high-rank leader on the first clean post-balance day.
    // Preserve the 16/09 nerf to his peel cycle, but stop underrating his blind
    // safety and lane reliability merely because the old generic support profile
    // was conservative.
    if (brawler.name === "Gus" && firstPickProfile) {
      firstPickProfile = {
        ...firstPickProfile,
        blindSafety: max(firstPickProfile.blindSafety, 70),
        openFit: max(firstPickProfile.openFit, 72),
        objective: max(firstPickProfile.objective, 62),
        counterRisk: Math.min(firstPickProfile.counterRisk ?? 43, 40),
      };
    }

    return {
      ...brawler,
      tier,
      matchupReviewedAt: POST_BALANCE_REVIEW_DATE,
      firstPickProfileReviewedAt: firstPickProfile ? POST_BALANCE_REVIEW_DATE : brawler.firstPickProfileReviewedAt,
      firstPickProfileVersion: firstPickProfile ? POST_BALANCE_MODEL_VERSION : brawler.firstPickProfileVersion,
      firstPickProfile,
    };
  });
}
