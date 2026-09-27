import type { MapProfile } from "./types";

export const MAP_META_2509_VERSION = "v0.36.2-map-meta-2509";
export const MAP_META_DEFAULT_REVIEW_DATE = "25/09/2026";

type MapMetaEvidence = {
  core: [string, string, string, string, string];
  sample?: number;
  reviewedAt?: string;
  confidence?: "Media" | "Alta";
  source: string;
};

/**
 * Ranked-only map evidence. The statistical core is deliberately not copied
 * into the final first-pick order: it acts as a map prior and the Draft Engine
 * still resolves blind safety, geometry, mode utility, counters and draft order.
 */
export const mapMeta2509: Record<string, MapMetaEvidence> = {
  "Dry Season": { core: ["Wendy", "Amber", "Shade", "Gus", "Bolt"], source: "https://seemeta.com/es/brawl-stars/maps/bounty/dry-season" },
  "Hideout": { core: ["Wendy", "Amber", "Gus", "Janet", "Ollie"], source: "https://seemeta.com/es/brawl-stars/maps/bounty/hideout" },
  "Layer Cake": { core: ["Amber", "Shade", "Wendy", "Brock", "Gus"], source: "https://seemeta.com/es/brawl-stars/maps/bounty/layer-cake" },
  "Shooting Star": { core: ["Wendy", "Gus", "Amber", "Ollie", "Brock"], source: "https://seemeta.com/es/brawl-stars/maps/bounty/shooting-star" },

  "Center Stage": { core: ["Amber", "Shade", "El Primo", "Gus", "Jacky"], source: "https://seemeta.com/es/brawl-stars/maps/brawl-ball/center-stage" },
  "Pinball Dreams": { core: ["Shade", "Amber", "Wendy", "El Primo", "Gus"], source: "https://seemeta.com/es/brawl-stars/maps/brawl-ball/pinball-dreams" },
  "Sneaky Fields": { core: ["El Primo", "Amber", "Shade", "Rico", "Gus"], source: "https://seemeta.com/es/brawl-stars/maps/brawl-ball/sneaky-fields" },
  "Triple Dribble": { core: ["Shade", "Amber", "El Primo", "Wendy", "Gus"], source: "https://seemeta.com/es/brawl-stars/maps/brawl-ball/triple-dribble" },
  "Spiraling Out": { core: ["Wendy", "Shade", "Amber", "Gus", "El Primo"], confidence: "Media", source: "https://seemeta.com/es/brawl-stars/maps/brawl-ball/spiraling-out" },
  "Beach Ball": { core: ["Amber", "Shade", "El Primo", "Wendy", "Gus"], confidence: "Media", source: "https://seemeta.com/es/brawl-stars/maps/brawl-ball/beach-ball" },

  "Double Swoosh": { core: ["Amber", "Wendy", "El Primo", "Tara", "Emz"], source: "https://seemeta.com/es/brawl-stars/maps/gem-grab/double-swoosh" },
  "Gem Fort": { core: ["Wendy", "Shade", "Gus", "El Primo", "Amber"], source: "https://seemeta.com/es/brawl-stars/maps/gem-grab/gem-fort" },
  "Hard Rock Mine": { core: ["Shade", "Wendy", "Gus", "Rico", "Amber"], source: "https://seemeta.com/es/brawl-stars/maps/gem-grab/hard-rock-mine" },
  "Undermine": { core: ["Wendy", "Amber", "Shade", "Gus", "Ollie"], source: "https://seemeta.com/es/brawl-stars/maps/gem-grab/undermine" },

  "Bridge Too Far": { core: ["Shade", "Wendy", "Nori", "Colt", "8-Bit"], sample: 27596, source: "https://seemeta.com/es/brawl-stars/maps/heist/bridge-too-far" },
  "Hot Potato": { core: ["Shade", "Nori", "Colette", "Bibi", "Rico"], source: "https://seemeta.com/es/brawl-stars/maps/heist/hot-potato" },
  "Kaboom Canyon": { core: ["Nori", "Shade", "Colette", "Wendy", "Amber"], source: "https://seemeta.com/es/brawl-stars/maps/heist/kaboom-canyon" },
  "Safe Zone": { core: ["Shade", "Nori", "Amber", "Wendy", "Colette"], source: "https://seemeta.com/es/brawl-stars/maps/heist/safe-zone" },

  "Dueling Beetles": { core: ["Amber", "Wendy", "Gus", "Shade", "Bo"], source: "https://seemeta.com/es/brawl-stars/maps/hot-zone/dueling-beetles" },
  "Open Business": { core: ["Wendy", "Gus", "Amber", "Shade", "Emz"], source: "https://seemeta.com/es/brawl-stars/maps/hot-zone/open-business" },
  "Parallel Plays": { core: ["Shade", "Gus", "El Primo", "Bibi", "Wendy"], source: "https://seemeta.com/es/brawl-stars/maps/hot-zone/parallel-plays" },
  "Ring of Fire": { core: ["Wendy", "Amber", "Gus", "Bo", "Buster"], source: "https://seemeta.com/es/brawl-stars/maps/hot-zone/ring-of-fire" },
  "In the Liminal": { core: ["Amber", "Wendy", "Bo", "Pam", "Finx"], sample: 1421, reviewedAt: "17/09/2026", confidence: "Media", source: "https://seemeta.com/es/brawl-stars/maps/hot-zone/in-the-liminal" },
  "Quick Travel": { core: ["Nita", "Shade", "Ash", "Bibi", "Emz"], sample: 13384, confidence: "Media", source: "https://seemeta.com/es/brawl-stars/maps/hot-zone/quick-travel" },

  "New Horizons": { core: ["Wendy", "Sprout", "Brock", "Shade", "Gus"], sample: 29206, source: "https://seemeta.com/es/brawl-stars/maps/knockout/new-horizons" },
  "Out in the Open": { core: ["Wendy", "Brock", "Pearl", "Gus", "Amber"], sample: 28973, source: "https://seemeta.com/es/brawl-stars/maps/knockout/out-in-the-open" },
  "Belle's Rock": { core: ["Wendy", "Brock", "Gus", "Shade", "Sprout"], sample: 28606, source: "https://seemeta.com/es/brawl-stars/maps/knockout/belles-rock" },
  "Flaring Phoenix": { core: ["Brock", "Wendy", "Pearl", "Gus", "Shade"], sample: 28648, source: "https://seemeta.com/es/brawl-stars/maps/knockout/flaring-phoenix" },
};

const unique = (values: string[]) => [...new Set(values)];

export function applyMapMeta2509(maps: MapProfile[]): MapProfile[] {
  return maps.map((map) => {
    const evidence = mapMeta2509[map.name];
    if (!evidence || map.rotationStatus !== "Actual") return map;

    const reviewedAt = evidence.reviewedAt || MAP_META_DEFAULT_REVIEW_DATE;
    const confidence = evidence.confidence || "Alta";
    const legacySpecialists = unique([...map.tierS, ...map.tierA])
      .filter((name) => !evidence.core.includes(name))
      .slice(0, 10);
    const sampleNote = evidence.sample ? ` · muestra ${evidence.sample.toLocaleString("es-ES")}` : "";

    return {
      ...map,
      tierS: [...evidence.core],
      tierA: legacySpecialists,
      bans: evidence.core.slice(0, 3),
      firstPickConfidence: confidence,
      status: `${map.status.replace(/\s*$/, "")} · Meta Ranked por mapa revisado ${reviewedAt}${sampleNote}.`,
      firstPickNotes: `Prior estadístico Ranked ${reviewedAt}: ${evidence.core.join(", ")}. Se usa como evidencia del mapa, no como orden literal de first pick; el motor sigue ponderando seguridad a ciegas, geometría, counters, composición y orden del draft. Fuente: ${evidence.source}`,
    };
  });
}
