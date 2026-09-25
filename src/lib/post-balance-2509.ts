import type { Brawler } from "./types";

/**
 * v0.34.0 — consolidation of the post-16/09 meta review completed on 25/09.
 *
 * This layer sits on top of the official 16/09 mechanics and the 17/09
 * post-maintenance calibration. It only changes decisions that were explicitly
 * re-reviewed later in the cycle; the rest of the roster keeps the 17/09 model.
 */
export const POST_BALANCE_2509_REVIEW_DATE = "25/09/2026";
export const POST_BALANCE_2509_MODEL_VERSION = "v0.34.0-u69-postbalance-2509";

/** Final general tiers retained by the v0.34.0 review. */
export const postBalance2509TierByName: Record<string, string> = {
  Wendy: "A",
  Brock: "A",
  Nori: "B",
  Rico: "A",
  Belle: "B",
  Trunk: "B",
  Pam: "C",
};

export const postBalance2509Summary = {
  status: "Meta v0.34.0 · revisión 25/09 sobre el balance oficial del 16/09",
  stable: ["Brock", "Trunk"],
  contextual: ["Rico", "Nori", "Belle", "Pam"],
  downgraded: ["Wendy", "Pam"],
  notes: [
    "Wendy queda A general: sigue siendo útil, pero el recorte de escudos y torreta ya no justifica tratarla como prioridad S global.",
    "Nori queda B general con ventanas A cuando mapa, modo y draft permiten explotar su movilidad.",
    "Rico queda A general y puede rendir como S contextual en mapas de rebotes y muros favorables.",
    "Belle queda B general con valor A contextual en mapas abiertos y líneas largas.",
    "Trunk se mantiene B general; no se fuerza una promoción por una señal puntual.",
    "Pam baja a C general. Conserva valor B/A contextual en Zona Restringida y escenarios estáticos que protegen la torreta, pero deja de considerarse first pick seguro.",
  ],
} as const;

function max(value: number | undefined, minimum: number) {
  return Math.max(value ?? minimum, minimum);
}

function min(value: number | undefined, maximum: number) {
  return Math.min(value ?? maximum, maximum);
}

export function applyPostBalance2509(roster: Brawler[]): Brawler[] {
  return roster.map((brawler) => {
    const reviewedTier = postBalance2509TierByName[brawler.name];
    if (!reviewedTier) return brawler;

    let modes = brawler.modes;
    let firstPickProfile = brawler.firstPickProfile;

    if (brawler.name === "Pam") {
      // The 16/09 sustain buffs remain real, but they are intentionally scoped to
      // static control environments instead of inflating Pam's global tier.
      modes = {
        ...modes,
        "Zona Restringida": max(modes["Zona Restringida"], 8),
      };

      // Equivalent to the Work review's safeFirstPick=false decision without
      // introducing a second boolean scoring path: lower blind safety and raise
      // counter risk so the existing first-pick model penalizes blind openings.
      if (firstPickProfile) {
        firstPickProfile = {
          ...firstPickProfile,
          blindSafety: min(firstPickProfile.blindSafety, 45),
          counterRisk: max(firstPickProfile.counterRisk, 62),
        };
      }
    }

    return {
      ...brawler,
      tier: reviewedTier,
      modes,
      matchupReviewedAt: POST_BALANCE_2509_REVIEW_DATE,
      firstPickProfileReviewedAt: firstPickProfile ? POST_BALANCE_2509_REVIEW_DATE : brawler.firstPickProfileReviewedAt,
      firstPickProfileVersion: firstPickProfile ? POST_BALANCE_2509_MODEL_VERSION : brawler.firstPickProfileVersion,
      firstPickProfile,
    };
  });
}
