import type { Brawler } from "./types";

/**
 * v0.36.0 — recommendation calibration after reviewing the 25/09 engine output.
 *
 * The objective is not to suppress Gale, Lou or Wendy. It is to stop stale
 * broad-safety/mode profiles from making them default answers in unrelated
 * drafts. Current evidence is mixed across sources, so all three keep viable
 * contextual windows while blind-pick safety and broad mode affinity are
 * tightened.
 */
export const POST_BALANCE_2609_REVIEW_DATE = "26/09/2026";
export const POST_BALANCE_2609_MODEL_VERSION = "v0.36.0-u69-recommendation-calibration-2609";

export const postBalance2609TierByName: Record<string, string> = {
  Wendy: "A",
  Lou: "B",
  Gale: "C",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function without(tags: string[], ...removed: string[]) {
  const blocked = new Set(removed);
  return tags.filter((tag) => !blocked.has(tag));
}

function recalibrateProfile(brawler: Brawler) {
  if (!brawler.firstPickProfile) return brawler.firstPickProfile;
  const profile = brawler.firstPickProfile;

  if (brawler.name === "Gale") {
    return {
      ...profile,
      blindSafety: clamp(profile.blindSafety, 0, 58),
      control: clamp(profile.control, 0, 82),
      chokeControl: clamp(profile.chokeControl, 0, 84),
      antiDive: Math.max(profile.antiDive, 92),
      counterRisk: Math.max(profile.counterRisk, 48),
    };
  }

  if (brawler.name === "Lou") {
    return {
      ...profile,
      blindSafety: clamp(profile.blindSafety, 0, 68),
      control: clamp(profile.control, 0, 88),
      chokeControl: clamp(profile.chokeControl, 0, 88),
      objective: clamp(profile.objective, 0, 84),
      counterRisk: Math.max(profile.counterRisk, 38),
    };
  }

  if (brawler.name === "Wendy") {
    return {
      ...profile,
      blindSafety: clamp(profile.blindSafety, 0, 56),
      control: clamp(profile.control, 0, 86),
      chokeControl: clamp(profile.chokeControl, 0, 84),
      objective: clamp(profile.objective, 0, 72),
      counterRisk: Math.max(profile.counterRisk, 50),
    };
  }

  return profile;
}

export function applyPostBalance2609(roster: Brawler[]): Brawler[] {
  return roster.map((brawler) => {
    if (!["Gale", "Lou", "Wendy"].includes(brawler.name)) return brawler;

    let modes = { ...brawler.modes };
    let tags = [...brawler.tags];

    if (brawler.name === "Gale") {
      // Still a real anti-dive/counterpick, but not a generic safe blind pick.
      modes = {
        ...modes,
        "Balón Brawl": 7,
        "Zona Restringida": 6,
      };
      tags = without(tags, "safe");
    }

    if (brawler.name === "Lou") {
      // Preserve the Hot Zone identity while reducing blanket value elsewhere.
      modes = {
        ...modes,
        "Zona Restringida": 8,
        "Balón Brawl": 5,
      };
    }

    if (brawler.name === "Wendy") {
      // Strong current brawler, but post-16/09 evidence does not support treating
      // her as a universal blind opening. Keep her strongest control modes.
      modes = {
        ...modes,
        "Atrapagemas": 7,
        "Zona Restringida": 7,
        "Noqueo": 6,
      };
      tags = without(tags, "safe");
    }

    const firstPickProfile = recalibrateProfile(brawler);

    return {
      ...brawler,
      tier: postBalance2609TierByName[brawler.name] || brawler.tier,
      tags,
      modes,
      matchupReviewedAt: POST_BALANCE_2609_REVIEW_DATE,
      firstPickProfile,
      firstPickProfileReviewedAt: firstPickProfile ? POST_BALANCE_2609_REVIEW_DATE : brawler.firstPickProfileReviewedAt,
      firstPickProfileVersion: firstPickProfile ? POST_BALANCE_2609_MODEL_VERSION : brawler.firstPickProfileVersion,
    };
  });
}
