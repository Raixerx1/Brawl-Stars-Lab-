import type { Brawler, DraftPosition, MapProfile } from "./types";

/**
 * Update 69 / 69.230 — early post-patch competitive calibration.
 *
 * The 02/09 layer combines Supercell's final kit changes, NOFF's first
 * post-patch top-200 sample and the pre-patch 30 d view as a stability brake.
 * A global tier never overrides map geometry, pick order or a direct matchup.
 */
export const UPDATE69_LIVE_DATE = "01/09/2026";
export const UPDATE69_META_REVIEW_DATE = "02/09/2026";
export const UPDATE69_CLIENT_VERSION = "69.230";
export const UPDATE69_MODEL_VERSION = "v0.32.0-u69-observed";

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
 * Calibrated engine tiers. This is intentionally not a verbatim copy of the
 * volatile 24 h list: role and pick-rate distortions are moderated by the
 * 30 d baseline and by the official direction of each kit change.
 */
export const update69ObservedTierByName: Record<string, string> = {
  Shade: "S",
  Wendy: "S",
  Melodie: "S",

  "El Primo": "A",
  Edgar: "A",
  Bibi: "A",
  Nori: "A",
  Brock: "A",
  Amber: "A",
  Mortis: "A",
  Gus: "A",
  "8-Bit": "A",
  Griff: "A",

  Shelly: "B",
  Gray: "B",
  Surge: "B",
  Rico: "B",
  Lumi: "B",
  Bo: "B",
  Max: "B",
  Rosa: "B",
  Bull: "B",
  Moe: "B",
  "Starr Nova": "B",
  Belle: "B",
  Bea: "B",
  Jessie: "B",
  Leon: "B",

  Hank: "C",
  Eve: "C",
  Poco: "C",
  Ash: "C",

  Bolt: "D",
  Meg: "D",
  Buster: "D",
  Colette: "D",
  Lola: "D",
  Maisie: "D",
  Tara: "D",
  "Jae-Yong": "D",
  Janet: "D",
  Ziggy: "D",
  Jacky: "D",
  Clancy: "D",

  Ruffs: "F",
};

// Alias kept for modules and audits created during the patch-day release.
export const update69PatchDayTierByName = update69ObservedTierByName;

export const update69ObservedSignals: Record<string, Update69ObservedSignal> = {
  Shade: {
    trend: "up", confidence: "Alta", scoreAdjustment: 5, metaAdjustment: 6,
    summary: "La subida del kit y la primera muestra top-200 coinciden; gana prioridad en mapas con cobertura.",
  },
  Wendy: {
    trend: "volatile", confidence: "Media", scoreAdjustment: 1, metaAdjustment: 1,
    summary: "Sigue rindiendo arriba, pero los nerfs al generador reducen mucho su margen como pick ciego.",
  },
  "El Primo": {
    trend: "up", confidence: "Media", scoreAdjustment: 3, metaAdjustment: 4,
    summary: "El paquete Buffie ya deja señal fuerte; se limita a mapas y modos donde puede cerrar distancia.",
  },
  Edgar: {
    trend: "volatile", confidence: "Baja", scoreAdjustment: 0, metaAdjustment: 0,
    summary: "La presencia temprana es alta, pero sigue siendo un counterpick y no una apertura segura.",
  },
  Melodie: {
    trend: "up", confidence: "Alta", scoreAdjustment: 4, metaAdjustment: 5,
    summary: "Vida, movilidad y disponibilidad del gadget mejoran su tempo en objetivos y último pick.",
  },
  Bibi: {
    trend: "stable", confidence: "Media", scoreAdjustment: 1, metaAdjustment: 1,
    summary: "Mantiene una señal competitiva estable como frontline móvil en mapas cerrados.",
  },
  Nori: {
    trend: "volatile", confidence: "Media", scoreAdjustment: 0, metaAdjustment: 0,
    summary: "Permanece fuerte, aunque el recorte de vida, daño y gadget aumenta el riesgo de entrada.",
  },
  Brock: {
    trend: "stable", confidence: "Media", scoreAdjustment: -1, metaAdjustment: -1,
    summary: "Conserva alcance y wallbreak, pero el recorte de su Buffie impide mantenerlo como S automático.",
  },
  Amber: {
    trend: "up", confidence: "Media", scoreAdjustment: 3, metaAdjustment: 4,
    summary: "El nuevo control del aceite y la movilidad se traducen en una subida temprana coherente.",
  },
  Mortis: {
    trend: "volatile", confidence: "Baja", scoreAdjustment: 0, metaAdjustment: 0,
    summary: "Sigue apareciendo arriba, pero su valor depende del rival y se reserva para picks tardíos.",
  },
  Gus: {
    trend: "up", confidence: "Media", scoreAdjustment: 3, metaAdjustment: 3,
    summary: "El control de munición, knockback y soporte móvil mejoran su respuesta contra dive.",
  },
  "8-Bit": {
    trend: "stable", confidence: "Media", scoreAdjustment: 1, metaAdjustment: 1,
    summary: "La muestra temprana confirma su presión estable sin alterar sus límites de movilidad.",
  },
  Griff: {
    trend: "volatile", confidence: "Media", scoreAdjustment: -1, metaAdjustment: -1,
    summary: "Sigue presente, pero el peor ciclo de súper y gadget reduce su dominio global.",
  },
  Max: {
    trend: "down", confidence: "Alta", scoreAdjustment: -3, metaAdjustment: -3,
    summary: "Los recortes acumulados a súper y gadgets ya justifican sacarla del núcleo S.",
  },
  Rico: {
    trend: "down", confidence: "Alta", scoreAdjustment: -2, metaAdjustment: -2,
    summary: "Pierde defensa y velocidad; conserva valor donde los rebotes son estructurales.",
  },
  Lumi: {
    trend: "down", confidence: "Media", scoreAdjustment: -2, metaAdjustment: -2,
    summary: "El menor daño de retorno reduce su presión, aunque sigue siendo un control contextual.",
  },
  Ash: {
    trend: "down", confidence: "Media", scoreAdjustment: -2, metaAdjustment: -2,
    summary: "El peor ciclo al recibir daño limita su capacidad de encadenar presión.",
  },
  Bolt: {
    trend: "down", confidence: "Media", scoreAdjustment: -3, metaAdjustment: -3,
    summary: "La pérdida de aceleración rebaja su tempo pese a resultados puntuales de escalera.",
  },
  Ruffs: {
    trend: "down", confidence: "Alta", scoreAdjustment: -3, metaAdjustment: -3,
    summary: "La caída del ciclo de súper reduce su valor de soporte y primera rotación.",
  },
  Poco: {
    trend: "up", confidence: "Baja", scoreAdjustment: 1, metaAdjustment: 1,
    summary: "El Buffie amplía su utilidad, pero necesita composición y coordinación para convertirla.",
  },
  Hank: {
    trend: "up", confidence: "Baja", scoreAdjustment: 1, metaAdjustment: 1,
    summary: "La vida adicional mejora su margen sin eliminar su dependencia de mapa.",
  },
  Eve: {
    trend: "up", confidence: "Baja", scoreAdjustment: 1, metaAdjustment: 1,
    summary: "Más hatchlings y mejor ciclo aumentan la presión contra disparos únicos.",
  },
  Colette: {
    trend: "up", confidence: "Baja", scoreAdjustment: 1, metaAdjustment: 1,
    summary: "El mejor ciclo refuerza su función antitanque, no su valor como pick universal.",
  },
};

export const update69BuffieWatchlist = ["Poco", "El Primo", "Amber", "Gus", "Chuck", "Shade"] as const;
export const update69HyperchargeWatchlist = ["Nori", "Wendy"] as const;
export const update69MixedWatchlist = ["Bo", "Chuck"] as const;

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

  if (signal && signal.scoreAdjustment >= 2) reasons.push(`Tendencia post-U69: ${signal.summary}`);
  if (signal && signal.scoreAdjustment <= -2) warnings.push(`Ajuste post-U69: ${signal.summary}`);

  if (brawler.name === "Shade" && map.layout === "Cerrado") score += 3;
  if (brawler.name === "El Primo") {
    if (map.layout === "Cerrado") score += 3;
    if (["Balón Brawl", "Zona Restringida"].includes(map.mode)) score += 2;
    if (map.layout === "Abierto") score -= 4;
  }
  if (brawler.name === "Melodie" && ["Atraco", "Balón Brawl"].includes(map.mode)) score += 2;
  if (brawler.name === "Amber" && ["Atraco", "Zona Restringida", "Atrapagemas"].includes(map.mode)) score += 2;
  if (brawler.name === "Gus" && ["Noqueo", "Caza Estelar"].includes(map.mode)) score += 2;

  if (["Edgar", "Mortis"].includes(brawler.name)) {
    if (position === "First pick") score -= 7;
    if (position === "Last pick") score += 2;
  }
  if (brawler.name === "Wendy" && position === "First pick") score -= 4;
  if (brawler.name === "Nori" && position === "First pick") score -= 2;

  return { score, meta, reasons, warnings, signal };
}

export type Update69MatchupAdjustment = { score: number; reasons: string[] };

const hasTag = (brawler: Brawler, ...tags: string[]) => tags.some((tag) => brawler.tags.includes(tag));
const isMobile = (brawler: Brawler) => brawler.role === "Asesino" || hasTag(brawler, "mobile", "assassin", "asesino");
const isThrower = (brawler: Brawler) => brawler.role === "Artillero" || hasTag(brawler, "thrower", "artillero");
const isAntidive = (brawler: Brawler) => brawler.role === "Antidive" || hasTag(brawler, "antidive") || (brawler.firstPickProfile?.antiDive || 0) >= 78;
const hasWallbreak = (brawler: Brawler) => hasTag(brawler, "wallbreak") || (brawler.firstPickProfile?.wallBreak || 0) >= 72;

/** Small pair-specific deltas; an observed trend cannot manufacture a hard counter. */
export function update69MatchupAdjustment(candidate: Brawler, target: Brawler): Update69MatchupAdjustment {
  let score = 0;
  const reasons: string[] = [];

  if (candidate.name === "Shade" && isThrower(target)) {
    score += 8;
    reasons.push("El kit U69 de Shade mejora su acceso contra artilleros protegidos por muros");
  }
  if (target.name === "Shade" && isAntidive(candidate)) {
    score += 4;
    reasons.push(`${candidate.name} conserva control de entrada para cortar el nuevo tempo de Shade`);
  }
  if (candidate.name === "El Primo" && target.role === "Tirador") {
    score += 4;
    reasons.push("El gadget U69 de El Primo puede negar proyectiles durante su aproximación");
  }
  if (candidate.name === "Amber" && (target.role === "Tanque" || isMobile(target))) {
    score += 5;
    reasons.push("El aceite persistente y la movilidad U69 de Amber castigan rutas de entrada previsibles");
  }
  if (candidate.name === "Gus" && isMobile(target)) {
    score += 6;
    reasons.push("La pérdida de munición y el knockback U69 de Gus refuerzan su respuesta contra dive");
  }
  if (candidate.name === "Melodie" && (isThrower(target) || target.role === "Tirador")) {
    score += 4;
    reasons.push("La mejora de vida y movilidad U69 da a Melodie más margen para cerrar distancia");
  }
  if (candidate.name === "Colette" && target.role === "Tanque") {
    score += 5;
    reasons.push("El mejor ciclo de súper U69 refuerza el matchup antitanque de Colette");
  }
  if (candidate.name === "Eve" && target.role === "Tirador") {
    score += 4;
    reasons.push("Los hatchlings adicionales de U69 fuerzan más munición a tiradores de disparo único");
  }
  if (candidate.name === "Wendy" && isMobile(target)) {
    score -= 4;
    reasons.push("El generador U69 más frágil reduce el margen de Wendy frente a entradas rápidas");
  }
  if (target.name === "Wendy" && (hasWallbreak(candidate) || (candidate.firstPickProfile?.objective || 0) >= 82)) {
    score += 4;
    reasons.push(`${candidate.name} puede castigar el generador de Wendy, ahora menos resistente`);
  }
  if (target.name === "Nori" && isAntidive(candidate)) {
    score += 4;
    reasons.push(`El menor aguante de Nori en U69 aumenta el valor del antidive de ${candidate.name}`);
  }
  if (candidate.name === "Griff" && target.role === "Tanque") {
    score -= 4;
    reasons.push("El peor ciclo de súper U69 reduce la repetición del castigo antitanque de Griff");
  }
  if (target.name === "Max" && (candidate.role === "Control" || hasTag(candidate, "control", "zone"))) {
    score += 3;
    reasons.push(`El menor tempo de Max en U69 da más ventanas al control de ${candidate.name}`);
  }
  if (candidate.name === "Rico" && isMobile(target)) {
    score -= 5;
    reasons.push("Los recortes defensivos de U69 dejan a Rico más expuesto al cierre de distancia");
  }
  if (target.name === "Rico" && (isMobile(candidate) || hasWallbreak(candidate))) {
    score += 3;
    reasons.push(`${candidate.name} explota mejor la menor defensa de Rico tras U69`);
  }

  return { score: Math.max(-8, Math.min(8, score)), reasons: reasons.slice(0, 2) };
}

export function applyUpdate69Live(roster: Brawler[]): Brawler[] {
  return roster.map((brawler) => {
    const tier = update69ObservedTierByName[brawler.name] || brawler.tier;
    const adjustedProfile = (() => {
      if (!brawler.firstPickProfile) return brawler.firstPickProfile;
      if (brawler.name === "Wendy") {
        return { ...brawler.firstPickProfile, blindSafety: 70, objective: 80, control: 80, chokeControl: 78, antiDive: 78, counterRisk: 50 };
      }
      if (brawler.name === "Amber") {
        return { ...brawler.firstPickProfile, blindSafety: 76, control: 96, mobility: 52, counterRisk: 40 };
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
