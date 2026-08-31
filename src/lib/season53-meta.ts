import type { Brawler } from "./types";

/**
 * Live competitive overlay — August 4 balance state, reviewed 31/08/2026.
 *
 * Supercell has not published a newer LIVE balance patch as of this review.
 * The August 29 Brawl Talk announced Update 69, while the September balance
 * changes are still treated as upcoming until the official release notes land.
 *
 * The active tier layer below is the complete NOFF Meta 24h snapshot refreshed
 * on 30/08/2026 from top-player battle data. The Draft Engine still gives map,
 * mode, pick order and direct matchup mechanics priority over this global tier.
 */
export const season53TierByName: Record<string, string> = {
  Wendy: "S",
  Griff: "S",
  Max: "S",
  Mortis: "S",
  Edgar: "S",
  Nori: "S",
  Brock: "S",
  "8-Bit": "S",

  Surge: "A",
  Mandy: "A",
  Emz: "A",
  Fang: "A",
  Rico: "A",
  Meg: "A",
  Bibi: "A",
  Stu: "A",
  Lumi: "A",

  Colt: "B",
  Pierce: "B",
  Piper: "B",
  Carl: "B",
  "Starr Nova": "B",
  Otis: "B",
  Gray: "B",
  Melodie: "B",
  Ash: "B",
  Juju: "B",
  Angelo: "B",
  Belle: "B",
  Gene: "B",
  Mina: "B",

  Lou: "C",
  Bo: "C",
  Bea: "C",
  Tick: "C",
  Moe: "C",
  Bonnie: "C",
  Frank: "C",
  Pearl: "C",
  Gale: "C",
  Bolt: "C",
  Bull: "C",
  Sandy: "C",
  Chester: "C",
  Meeple: "C",
  Glowy: "C",
  Rosa: "C",
  Jessie: "C",
  Leon: "C",
  Eve: "C",
  Sirius: "C",
  "El Primo": "C",

  Shelly: "D",
  Shade: "D",
  Sprout: "D",
  Doug: "D",
  Chuck: "D",
  Nani: "D",
  Damian: "D",
  Spike: "D",
  Ruffs: "D",
  Kaze: "D",
  Crow: "D",
  Buzz: "D",
  Amber: "D",
  Kenji: "D",
  Kit: "D",
  Berry: "D",
  Nita: "D",
  Squeak: "D",
  Gigi: "D",
  Charlie: "D",
  Byron: "D",

  Alli: "F",
  Buster: "F",
  Hank: "F",
  Colette: "F",
  Mico: "F",
  Lily: "F",
  Dynamike: "F",
  Willow: "F",
  Barley: "F",
  Penny: "F",
  Ollie: "F",
  Lola: "F",
  "R-T": "F",
  Trunk: "F",
  Cordelius: "F",
  Maisie: "F",
  Darryl: "F",
  Tara: "F",
  "Jae-Yong": "F",
  Gus: "F",
  "Mr. P": "F",
  Finx: "F",
  Draco: "F",
  Ziggy: "F",
  Poco: "F",
  Jacky: "F",
  Grom: "F",
  Pam: "F",
  Najia: "F",
  Janet: "F",
  Clancy: "F",
  "Larry & Lawrie": "F",
  Sam: "F",
};

/**
 * Export mantenido por compatibilidad con revisiones previas. Ya no usamos un
 * override parcial: el snapshot activo contiene los 106 brawlers y evita que
 * una lista antigua sobreviva accidentalmente en counters o recomendaciones.
 */
export const currentAug30TierOverrides: Record<string, string> = {};

export const wendySeason53: Brawler = {
  slug: "wendy",
  name: "Wendy",
  rarity: "Mythic",
  role: "Apoyo",
  tier: "S",
  range: "Largo",
  difficulty: 3,
  tags: ["support", "apoyo", "shield", "control", "antidive", "water", "safe"],
  modes: {
    "Balón Brawl": 9,
    "Zona Restringida": 9,
    "Atrapagemas": 8,
    "Noqueo": 7,
  },
  counters: [],
  counteredBy: [],
  build: "Prioriza el uptime del generador, el escudo sobre aliados y el control de espacio; conserva el salto como reposicionamiento cuando el rival pueda entrar sobre ti.",
  profileComplete: true,
  matchupReviewedAt: "31/08/2026",
  matchupNotes: { favorable: {}, threats: {} },
  firstPickProfile: {
    blindSafety: 84,
    openFit: 72,
    closedFit: 82,
    bushFit: 68,
    wallReliance: 34,
    postBreakFit: 76,
    vision: 22,
    wallBreak: 10,
    antiDive: 86,
    mobility: 60,
    objective: 90,
    control: 88,
    chokeControl: 86,
    teamDependence: 46,
    counterRisk: 32,
  },
  firstPickProfileReviewedAt: "31/08/2026",
  firstPickProfileVersion: "v0.22.2",
};

export function applySeason53Meta(roster: Brawler[]): Brawler[] {
  const withWendy = roster.some((brawler) => brawler.name === "Wendy")
    ? roster
    : [...roster, wendySeason53];

  return withWendy.map((brawler) => {
    const tier = currentAug30TierOverrides[brawler.name]
      || season53TierByName[brawler.name]
      || brawler.tier;

    if (brawler.name !== "Wendy") {
      return { ...brawler, tier, matchupReviewedAt: "31/08/2026" };
    }

    return {
      ...brawler,
      ...wendySeason53,
      range: brawler.range || wendySeason53.range,
      tier,
      counters: [],
      counteredBy: [],
      matchupReviewedAt: "31/08/2026",
      firstPickProfileReviewedAt: "31/08/2026",
      firstPickProfileVersion: "v0.22.2",
    };
  });
}
