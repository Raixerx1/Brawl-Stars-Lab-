import type { Brawler, MapProfile } from "./types";
import { evaluateFirstPick } from "./first-pick-model";

export const RANKED_POOL_2709_REVIEW_DATE = "27/09/2026";
export const RANKED_POOL_2709_MODEL_VERSION = "v0.36.1-ranked-pool-2709";

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

/**
 * Current Ranked pool used by Draft Assist after the September rotation.
 * Featured maps are included in addition to the standard pool.
 */
export const rankedPool2709ByMode = {
  "Caza Estelar": ["Dry Season", "Hideout", "Layer Cake", "Shooting Star"],
  "Balón Brawl": ["Center Stage", "Pinball Dreams", "Sneaky Fields", "Triple Dribble", "Spiraling Out", "Beach Ball"],
  "Atrapagemas": ["Double Swoosh", "Gem Fort", "Hard Rock Mine", "Undermine"],
  "Atraco": ["Bridge Too Far", "Hot Potato", "Kaboom Canyon", "Safe Zone"],
  "Zona Restringida": ["Dueling Beetles", "Open Business", "Parallel Plays", "Ring of Fire", "In the Liminal", "Quick Travel"],
  "Noqueo": ["New Horizons", "Out in the Open", "Call of the Water", "Stroke of Luck"],
} as const;

export const rankedPool2709Names = Object.values(rankedPool2709ByMode).flat();
const rankedKeys = new Set(rankedPool2709Names.map(normalize));

function featuredHotZoneMap(name: "In the Liminal" | "Quick Travel"): MapProfile {
  const quick = name === "Quick Travel";
  return {
    slug: normalize(name),
    name,
    mode: "Zona Restringida",
    layout: "Mixto",
    traits: quick
      ? ["mapa destacado Ranked", "rotaciones rápidas", "control de zona", "perfil provisional"]
      : ["mapa destacado Ranked", "control de zona", "presión por carriles", "perfil provisional"],
    tierS: ["Surge", "Amber", "Sandy", "Max", "Jessie"],
    tierA: ["Poco", "Rico", "Lou", "Colette", "Gene"],
    firstPicks: ["Surge", "Amber", "Sandy"],
    lastPicks: ["Colette", "Lou", "Rico"],
    bans: ["Surge", "Amber", "Sandy"],
    plan: quick
      ? "Prioriza tempo, control sostenido y capacidad de retake. El perfil geométrico se mantiene prudente hasta disponer de más muestra específica del mapa."
      : "Disputa primero las líneas de acceso a la zona y conserva una respuesta al dive. El perfil geométrico se mantiene prudente hasta disponer de más muestra específica del mapa.",
    featuredOfficialJune2026: false,
    status: `Mapa destacado de Ranked · pool confirmado ${RANKED_POOL_2709_REVIEW_DATE}.`,
    rotationStatus: "Actual",
    poolCheckedAt: RANKED_POOL_2709_REVIEW_DATE,
    aliases: name === "In the Liminal" ? ["Al límite"] : ["Viaje rápido"],
    firstPickReviewedAt: RANKED_POOL_2709_REVIEW_DATE,
    firstPickConfidence: "Media",
    firstPickNotes: "Mapa destacado de Ranked. Recomendaciones recalculadas con el meta y perfiles v0.36.1; la geometría específica se trata con confianza media.",
    geometry: {
      openness: quick ? 55 : 48,
      bushDensity: quick ? 32 : 42,
      wallDensity: quick ? 46 : 55,
      destructibility: 55,
      chokeDensity: quick ? 58 : 66,
      laneWidth: quick ? 62 : 50,
      waterInfluence: 0,
      afterBreakOpenness: quick ? 72 : 68,
      afterBreakWalls: quick ? 28 : 34,
      visionImportance: "Media",
      wallBreakImpact: "Media",
    },
    geometryReviewedAt: RANKED_POOL_2709_REVIEW_DATE,
    firstPickModelVersion: RANKED_POOL_2709_MODEL_VERSION,
  };
}

function ensureFeaturedMaps(base: MapProfile[]) {
  const result = [...base];
  const known = new Set(result.map((map) => normalize(map.name || map.slug)));
  for (const map of [featuredHotZoneMap("In the Liminal"), featuredHotZoneMap("Quick Travel")]) {
    if (!known.has(normalize(map.name))) result.push(map);
  }
  return result;
}

export function applyRankedPool2709(base: MapProfile[]): MapProfile[] {
  return ensureFeaturedMaps(base).map((map) => {
    const current = rankedKeys.has(normalize(map.name || map.slug));
    if (current) {
      return {
        ...map,
        rotationStatus: "Actual" as const,
        poolCheckedAt: RANKED_POOL_2709_REVIEW_DATE,
        status: `${map.status.replace(/\s*$/, "")} · Ranked actual confirmado ${RANKED_POOL_2709_REVIEW_DATE}.`,
      };
    }
    return {
      ...map,
      rotationStatus: "Histórico" as const,
      status: `${map.status.replace(/\s*$/, "")} · Fuera del pool Ranked actual a ${RANKED_POOL_2709_REVIEW_DATE}.`,
      poolCheckedAt: RANKED_POOL_2709_REVIEW_DATE,
    };
  });
}

const tierWeight: Record<string, number> = {
  "S+": 8,
  S: 7,
  "A+": 5,
  A: 4,
  "B+": 2,
  B: 1,
  C: 0,
  D: -4,
  F: -8,
  "Sin evaluar": -6,
};

/**
 * Rebuild the map's blind-pick shortlist from the current roster rather than
 * carrying August recommendations forward. This changes only first-pick data;
 * map-specific tier and ban information stays available to the full draft model.
 */
export function recalibrateRankedFirstPicks2709(maps: MapProfile[], roster: Brawler[]): MapProfile[] {
  return maps.map((map) => {
    if (map.rotationStatus !== "Actual") return map;

    const ranked = roster
      .map((brawler) => {
        const evaluation = evaluateFirstPick(brawler, map);
        const sIndex = map.tierS.indexOf(brawler.name);
        const aIndex = map.tierA.indexOf(brawler.name);
        const editorial = sIndex >= 0 ? Math.max(1, 5 - sIndex) : aIndex >= 0 ? Math.max(0, 2 - aIndex * .25) : 0;
        const score = evaluation.score + (tierWeight[brawler.tier] || 0) + editorial;
        return { brawler, evaluation, score };
      })
      .filter(({ brawler, evaluation }) =>
        !["D", "F", "Sin evaluar"].includes(brawler.tier) &&
        evaluation.blindQuality >= 48 &&
        evaluation.expectedMapFit >= 45
      )
      .sort((a, b) =>
        b.score - a.score ||
        b.evaluation.blindQuality - a.evaluation.blindQuality ||
        b.evaluation.expectedMapFit - a.evaluation.expectedMapFit
      );

    const candidates = ranked.slice(0, 8).map(({ brawler, evaluation }) => ({
      name: brawler.name,
      score: evaluation.score,
      reasons: evaluation.strengths,
      risks: evaluation.risks,
    }));

    return {
      ...map,
      firstPicks: candidates.slice(0, 3).map((candidate) => candidate.name),
      firstPickCandidates: candidates,
      firstPickReviewedAt: RANKED_POOL_2709_REVIEW_DATE,
      firstPickModelVersion: RANKED_POOL_2709_MODEL_VERSION,
      firstPickConfidence: map.firstPickConfidence === "Baja" ? "Media" : map.firstPickConfidence || "Media",
      firstPickNotes: "First picks recalculados el 27/09 con meta v0.36.1, seguridad a ciegas, geometría y utilidad del modo. El resto del Draft Assist sigue ponderando counters, composición y orden de picks.",
    };
  });
}
