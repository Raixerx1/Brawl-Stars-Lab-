import type { Brawler } from "./types";

export const DRAFT_CALIBRATION_2709_DATE = "27/09/2026";
export const DRAFT_CALIBRATION_2709_VERSION = "v0.36.1-draft-calibration-2709";

/**
 * R-T remains a strong anti-dive/counterpick after the 16/09 buff, but the old
 * first-pick profile still carried an inherited `safe` label and excessive
 * blind safety. That made the generic first-pick model over-recommend him on
 * unrelated maps. Keep the mechanical strengths and narrow only the blind-pick
 * assumptions.
 */
export function applyDraftCalibration2709(roster: Brawler[]): Brawler[] {
  return roster.map((brawler) => {
    if (brawler.name !== "R-T") return brawler;

    const profile = brawler.firstPickProfile;
    return {
      ...brawler,
      tags: brawler.tags.filter((tag) => tag !== "safe"),
      firstPickProfile: profile
        ? {
            ...profile,
            blindSafety: Math.min(profile.blindSafety, 48),
            counterRisk: Math.max(profile.counterRisk, 62),
            teamDependence: Math.max(profile.teamDependence, 34),
          }
        : profile,
      firstPickProfileReviewedAt: profile ? DRAFT_CALIBRATION_2709_DATE : brawler.firstPickProfileReviewedAt,
      firstPickProfileVersion: profile ? DRAFT_CALIBRATION_2709_VERSION : brawler.firstPickProfileVersion,
      matchupReviewedAt: DRAFT_CALIBRATION_2709_DATE,
    };
  });
}
