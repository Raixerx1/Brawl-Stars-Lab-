import type { Brawler, DraftPosition, MapProfile } from "./types";

/**
 * Update 69 — competitive calibration after the September 16 maintenance.
 *
 * The balance numbers are official. The tier layer is deliberately provisional:
 * same-day statistics still contain pre-maintenance games, so the engine applies
 * the mechanical direction of the patch immediately but limits statistical
 * overreaction. Map geometry, pick order and direct matchup remain dominant.
 */
export const UPDATE69_LIVE_DATE = "16/09/2026";
export const UPDATE69_META_REVIEW_DATE = "16/09/2026";
export const UPDATE69_CLIENT_VERSION = "69.230";
export const UPDATE69_MODEL_VERSION = "v0.33.2-u69-balance-1609";

export type Update69SignalTrend = "up" | "stable" | "down" | "volatile";
export type Update69SignalConfidence = "Alta" | "Media" | "Baja";

export type Update69ObservedSignal = {
  trend: Update69SignalTrend;
  confidence: Update69SignalConfidence;
  scoreAdjustment: number;
  metaAdjustment: number;
  summary: string;
};

/**
 * Operational tier after the 16/09 balance. This mirrors the first snapshot in
 * meta-tierlist.json so Draft, Counter Explorer and the visible Meta Center use
 * the same viability baseline. It is a provisional patch-day model, not a claim
 * that the new meta has fully settled.
 */
export const update69ObservedTierByName: Record<string, string> = {
  "Wendy": "S+",
  "Amber": "S",
  "Shade": "S",
  "Gus": "S",
  "El Primo": "S",
  "Ash": "S",
  "Emz": "A",
  "Rico": "A",
  "Stu": "A",
  "Brock": "A",
  "Bibi": "A",
  "Griff": "A",
  "8-Bit": "A",
  "Pearl": "A",
  "Sprout": "A",
  "Max": "A",
  "Gray": "A",
  "Surge": "A",
  "Melodie": "A",
  "Carl": "A",
  "Bolt": "A",
  "Kaze": "A",
  "Poco": "A",
  "R-T": "A",
  "Edgar": "B",
  "Mortis": "B",
  "Bull": "B",
  "Nita": "B",
  "Piper": "B",
  "Colt": "B",
  "Mina": "B",
  "Kenji": "B",
  "Starr Nova": "B",
  "Doug": "B",
  "Pierce": "B",
  "Angelo": "B",
  "Gene": "B",
  "Barley": "B",
  "Meeple": "B",
  "Bo": "B",
  "Sirius": "B",
  "Nori": "B",
  "Rosa": "B",
  "Leon": "B",
  "Frank": "B",
  "Spike": "B",
  "Tara": "B",
  "Otis": "B",
  "Damian": "B",
  "Trunk": "B",
  "Buster": "B",
  "Maisie": "B",
  "Chester": "B",
  "Meg": "B",
  "Belle": "B",
  "Willow": "B",
  "Juju": "B",
  "Ollie": "B",
  "Najia": "C",
  "Penny": "C",
  "Larry & Lawrie": "C",
  "Mandy": "C",
  "Charlie": "C",
  "Cordelius": "C",
  "Buzz": "C",
  "Sandy": "C",
  "Lou": "C",
  "Bea": "C",
  "Byron": "C",
  "Mico": "C",
  "Ruffs": "C",
  "Moe": "C",
  "Finx": "C",
  "Colette": "C",
  "Fang": "C",
  "Alli": "C",
  "Draco": "C",
  "Lumi": "C",
  "Jessie": "C",
  "Shelly": "C",
  "Nani": "C",
  "Darryl": "C",
  "Glowy": "C",
  "Mr. P": "C",
  "Crow": "C",
  "Chuck": "C",
  "Pam": "C",
  "Bonnie": "D",
  "Janet": "D",
  "Clancy": "D",
  "Jacky": "D",
  "Eve": "D",
  "Lily": "D",
  "Tick": "D",
  "Grom": "D",
  "Squeak": "D",
  "Gale": "D",
  "Hank": "D",
  "Sam": "D",
  "Gigi": "D",
  "Kit": "D",
  "Berry": "D",
  "Lola": "D",
  "Jae-Yong": "D",
  "Dynamike": "D",
  "Ziggy": "D",
};

// Alias kept for modules and audits created during the patch-day release.
export const update69PatchDayTierByName = update69ObservedTierByName;

export const update69ObservedSignals: Record<string, Update69ObservedSignal> = {
  Wendy: {
    trend: "volatile", confidence: "Media", scoreAdjustment: -1, metaAdjustment: 0,
    summary: "Más vida base compensa parte del golpe, pero pierde mucho escudo y vida de torreta; sigue arriba en la señal live sin ser una apertura gratuita.",
  },
  Amber: {
    trend: "stable", confidence: "Media", scoreAdjustment: -1, metaAdjustment: -1,
    summary: "Pierde persistencia del aceite y daño del Buffie; conserva presión sostenida suficiente para seguir en la zona alta.",
  },
  Shade: {
    trend: "down", confidence: "Media", scoreAdjustment: -2, metaAdjustment: -2,
    summary: "Menos carga de súper, peor control del gadget y un recorte fuerte del Buffie reducen su margen sin borrar la fortaleza del kit base.",
  },
  Gus: {
    trend: "stable", confidence: "Media", scoreAdjustment: -1, metaAdjustment: -1,
    summary: "Pierde frecuencia de peel y sustain, pero mantiene alcance, utilidad y una señal competitiva fuerte.",
  },
  "El Primo": {
    trend: "down", confidence: "Media", scoreAdjustment: -2, metaAdjustment: -1,
    summary: "El peor ciclo de Asteroid Belt y Meteor Rush recorta su entrada; continúa siendo peligroso en mapas cerrados.",
  },
  Nori: {
    trend: "down", confidence: "Alta", scoreAdjustment: -3, metaAdjustment: -3,
    summary: "El ataque tarda más en alcanzar carga máxima y la hipercarga llega mucho menos; baja su seguridad global.",
  },
  Meg: {
    trend: "down", confidence: "Media", scoreAdjustment: -2, metaAdjustment: -2,
    summary: "Repurpose ya no empuja con el proyectil y pierde consistencia defensiva a distancia.",
  },
  Colette: {
    trend: "down", confidence: "Baja", scoreAdjustment: -1, metaAdjustment: -1,
    summary: "El nerf se concentra en el segundo proyectil del Buffie; conserva su identidad antitanque.",
  },
  Brock: {
    trend: "down", confidence: "Media", scoreAdjustment: -2, metaAdjustment: -2,
    summary: "Menos Rocket Laces y peor recarga del súper reducen tempo, aunque rango y wallbreak siguen siendo estructurales.",
  },
  Poco: {
    trend: "up", confidence: "Alta", scoreAdjustment: 4, metaAdjustment: 5,
    summary: "El doble buff de curación refuerza de forma directa su sustain y su valor en composiciones agrupadas.",
  },
  Chuck: {
    trend: "up", confidence: "Baja", scoreAdjustment: 2, metaAdjustment: 2,
    summary: "Pit Stop ralentiza más, dura el doble y el Buffie cuadruplica su daño de área; sigue siendo muy dependiente del mapa.",
  },
  Ollie: {
    trend: "up", confidence: "Media", scoreAdjustment: 2, metaAdjustment: 3,
    summary: "El aumento de daño mejora presión de línea y cierre de bajas; la muestra de uso aún es pequeña.",
  },
  Trunk: {
    trend: "up", confidence: "Media", scoreAdjustment: 2, metaAdjustment: 2,
    summary: "Más velocidad sobre hormigas y mejor carga de súper elevan su consistencia de frontline.",
  },
  Willow: {
    trend: "up", confidence: "Alta", scoreAdjustment: 3, metaAdjustment: 4,
    summary: "Recarga más rápida y más vida atacan dos de sus límites principales; sube en mapas de control con cobertura.",
  },
  Juju: {
    trend: "up", confidence: "Media", scoreAdjustment: 3, metaAdjustment: 3,
    summary: "El aumento de vida y carga de súper da más tiempo de línea y más presión persistente.",
  },
  Pam: {
    trend: "up", confidence: "Baja", scoreAdjustment: 2, metaAdjustment: 2,
    summary: "La torreta cura más y aguanta más, incluida la versión hipercargada; todavía exige un mapa que permita explotar sustain.",
  },
  Belle: {
    trend: "up", confidence: "Alta", scoreAdjustment: 3, metaAdjustment: 3,
    summary: "Más daño por ataque aumenta el castigo en líneas abiertas sin cambiar sus condiciones de ejecución.",
  },
  "R-T": {
    trend: "up", confidence: "Alta", scoreAdjustment: 3, metaAdjustment: 4,
    summary: "Recording sube a 25 % de reducción de daño y mejora su margen contra dive y en duelos largos.",
  },
};

export const update69BuffieWatchlist = ["Poco", "El Primo", "Amber", "Gus", "Chuck", "Shade"] as const;
export const update69HyperchargeWatchlist = ["Nori", "Wendy"] as const;
export const update69MixedWatchlist = ["Wendy", "Chuck"] as const;

export function update69ObservedSignalFor(name: string) {
  return update69ObservedSignals[name];
}

export function update69DraftAdjustment(
  brawler: Brawler,
  map: Pick<MapProfile, "mode" | "layout">,
  position: DraftPosition,
) {
  const signal = update69ObservedSignalFor(brawler.name);
  let score = signal?.scoreAdjustment || 0;
  const meta = signal?.metaAdjustment || 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (signal && signal.scoreAdjustment >= 2) reasons.push(`Balance 16/09: ${signal.summary}`);
  if (signal && signal.scoreAdjustment <= -2) warnings.push(`Balance 16/09: ${signal.summary}`);

  if (brawler.name === "Shade" && map.layout === "Cerrado") score += 2;
  if (brawler.name === "El Primo") {
    if (map.layout === "Cerrado") score += 2;
    if (["Balón Brawl", "Zona Restringida"].includes(map.mode)) score += 1;
    if (map.layout === "Abierto") score -= 4;
  }
  if (brawler.name === "Amber" && ["Atraco", "Zona Restringida", "Atrapagemas"].includes(map.mode)) score += 1;
  if (brawler.name === "Gus" && ["Noqueo", "Caza Estelar"].includes(map.mode)) score += 1;
  if (brawler.name === "Poco" && ["Balón Brawl", "Zona Restringida", "Atrapagemas"].includes(map.mode)) score += 2;
  if (brawler.name === "R-T" && ["Noqueo", "Caza Estelar"].includes(map.mode)) score += 2;
  if (brawler.name === "Willow" && map.layout === "Cerrado") score += 2;

  if (["Edgar", "Mortis"].includes(brawler.name)) {
    if (position === "First pick") score -= 7;
    if (position === "Last pick") score += 2;
  }
  if (brawler.name === "Wendy" && position === "First pick") score -= 5;
  if (brawler.name === "Nori" && position === "First pick") score -= 3;
  if (brawler.name === "Chuck" && position === "First pick") score -= 4;

  return { score, meta, reasons, warnings, signal };
}

export type Update69MatchupAdjustment = { score: number; reasons: string[] };

const hasTag = (brawler: Brawler, ...tags: string[]) => tags.some((tag) => brawler.tags.includes(tag));
const isMobile = (brawler: Brawler) => brawler.role === "Asesino" || hasTag(brawler, "mobile", "assassin", "asesino");
const isThrower = (brawler: Brawler) => brawler.role === "Artillero" || hasTag(brawler, "thrower", "artillero");
const isAntidive = (brawler: Brawler) => brawler.role === "Antidive" || hasTag(brawler, "antidive") || (brawler.firstPickProfile?.antiDive || 0) >= 78;
const hasWallbreak = (brawler: Brawler) => hasTag(brawler, "wallbreak") || (brawler.firstPickProfile?.wallBreak || 0) >= 72;

/** Small pair-specific deltas; a balance trend cannot manufacture a hard counter. */
export function update69MatchupAdjustment(candidate: Brawler, target: Brawler): Update69MatchupAdjustment {
  let score = 0;
  const reasons: string[] = [];

  if (candidate.name === "Shade" && isThrower(target)) {
    score += 5;
    reasons.push("Shade conserva acceso contra artilleros, aunque el balance 16/09 reduce su ciclo y burst");
  }
  if (target.name === "Shade" && isAntidive(candidate)) {
    score += 4;
    reasons.push(`${candidate.name} puede castigar mejor las entradas de Shade tras el recorte del 16/09`);
  }
  if (candidate.name === "El Primo" && target.role === "Tirador") {
    score += 2;
    reasons.push("El Primo mantiene acceso contra tiradores, pero Asteroid Belt carga menos súper tras el 16/09");
  }
  if (candidate.name === "Amber" && (target.role === "Tanque" || isMobile(target))) {
    score += 3;
    reasons.push("Amber conserva daño sostenido contra rutas de entrada, aunque su control de aceite es menos persistente");
  }
  if (candidate.name === "Gus" && isMobile(target)) {
    score += 4;
    reasons.push("Gus conserva knockback y soporte contra dive, pero con menor frecuencia tras el 16/09");
  }
  if (candidate.name === "Colette" && target.role === "Tanque") {
    score += 4;
    reasons.push("Colette mantiene el matchup antitanque pese al nerf localizado de su Buffie");
  }
  if (candidate.name === "R-T" && isMobile(target)) {
    score += 5;
    reasons.push("El 25 % de reducción de daño de Recording mejora el margen de R-T frente a dive");
  }
  if (candidate.name === "Wendy" && isMobile(target)) {
    score -= 5;
    reasons.push("Los escudos y la torreta más débiles de Wendy abren más ventanas a entradas rápidas");
  }
  if (target.name === "Wendy" && (hasWallbreak(candidate) || (candidate.firstPickProfile?.objective || 0) >= 82)) {
    score += 4;
    reasons.push(`${candidate.name} puede castigar mejor la torreta de Wendy tras el balance 16/09`);
  }
  if (target.name === "Nori" && isAntidive(candidate)) {
    score += 5;
    reasons.push(`El menor tempo de Nori aumenta el valor del antidive de ${candidate.name}`);
  }
  if (candidate.name === "Nori" && target.role === "Tirador") {
    score -= 2;
    reasons.push("La carga más lenta del ataque de Nori da más margen a tiradores para mantener distancia");
  }

  return { score: Math.max(-8, Math.min(8, score)), reasons: reasons.slice(0, 2) };
}

export function applyUpdate69Live(roster: Brawler[]): Brawler[] {
  return roster.map((brawler) => {
    const tier = update69ObservedTierByName[brawler.name] || brawler.tier;
    const adjustedProfile = (() => {
      if (!brawler.firstPickProfile) return brawler.firstPickProfile;
      if (brawler.name === "Wendy") {
        return { ...brawler.firstPickProfile, blindSafety: 64, objective: 78, control: 78, chokeControl: 76, antiDive: 72, counterRisk: 57 };
      }
      if (brawler.name === "Amber") {
        return { ...brawler.firstPickProfile, blindSafety: 72, control: 91, mobility: 50, counterRisk: 46 };
      }
      return brawler.firstPickProfile;
    })();

    return {
      ...brawler,
      tier,
      matchupReviewedAt: UPDATE69_META_REVIEW_DATE,
      firstPickProfileReviewedAt: adjustedProfile ? UPDATE69_META_REVIEW_DATE : brawler.firstPickProfileReviewedAt,
      firstPickProfileVersion: adjustedProfile ? UPDATE69_MODEL_VERSION : brawler.firstPickProfileVersion,
      firstPickProfile: adjustedProfile,
    };
  });
}
