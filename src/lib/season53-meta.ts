import type { Brawler } from "./types";

/**
 * Live competitive overlay — August 4 balance state, reviewed 30/08/2026.
 *
 * Supercell has not published a newer live balance patch as of this review.
 * Update 69 was announced on 29/08, but exact balance changes are intentionally
 * NOT applied until official release notes exist.
 *
 * Current tier overrides use post-patch Ranked evidence sampled through
 * 26/08/2026. Map geometry, pick order and direct matchup evidence still have
 * priority over this global viability layer in the Draft Engine.
 */
export const season53TierByName: Record<string, string> = {
  "Bolt": "S+", "Griff": "S+",
  "Surge": "S", "Damian": "S", "8-Bit": "S", "Edgar": "S", "Starr Nova": "S", "Brock": "S", "Nori": "S", "Wendy": "S",
  "Meg": "A", "Chuck": "A", "Mico": "A", "Bo": "A", "Crow": "A", "Bibi": "A", "Max": "A", "Mortis": "A", "Doug": "A", "Carl": "A", "Piper": "A", "Rico": "A", "Jessie": "A", "Tick": "A", "Stu": "A",
  "Tara": "B", "Kaze": "B", "Meeple": "B", "Gray": "B", "Colt": "B", "Angelo": "B", "Bull": "B", "Penny": "B", "Shade": "B", "Sprout": "B", "Kenji": "B", "R-T": "B", "Pierce": "B", "Byron": "B", "Emz": "B", "Juju": "B", "Mandy": "B", "Mina": "B", "Otis": "B", "Nita": "B", "Chester": "B", "Melodie": "B", "Leon": "B", "Lily": "B", "Najia": "B", "Trunk": "B", "Pearl": "B", "Nani": "B",
  "Sirius": "C", "Lumi": "C", "Fang": "C", "Kit": "C", "Ruffs": "C", "Eve": "C", "Clancy": "C", "Belle": "C", "Finx": "C", "Gus": "C", "Janet": "C", "Dynamike": "C", "Berry": "C", "Hank": "C", "Cordelius": "C", "Gigi": "C", "Spike": "C", "Gene": "C", "Willow": "C", "Alli": "C", "Darryl": "C", "Moe": "C", "Ash": "C", "Lou": "C", "Lola": "C", "Colette": "C", "Draco": "C", "Grom": "C", "Bea": "C", "Mr. P": "C", "Amber": "C", "Gale": "C",
  "Poco": "D", "Glowy": "D", "Charlie": "D", "Jacky": "D", "Squeak": "D", "Buster": "D", "Ziggy": "D", "Frank": "D", "Barley": "D", "Sam": "D", "Buzz": "D", "Jae-Yong": "D", "Maisie": "D", "Sandy": "D", "Shelly": "D", "El Primo": "D", "Larry & Lawrie": "D", "Bonnie": "D", "Rosa": "D", "Pam": "D", "Ollie": "D",
};

/**
 * Overrides respaldados por la muestra Ranked posterior al parche del 04/08.
 * Se mantienen separados de la fotografía histórica de Season 53 para que el
 * cambio sea auditable y fácil de sustituir cuando lleguen las notas de U69.
 */
export const currentAug30TierOverrides: Record<string, string> = {
  Kaze: "S",
  Wendy: "S",
  Max: "S",
  Surge: "S",
  Bolt: "S",
  Gigi: "S",
  Griff: "S",
  Ruffs: "S",
  Jessie: "S",
  Colt: "S",
  Stu: "S",
  Carl: "A",
  "8-Bit": "A",
  Nori: "A",
  Brock: "A",
  Damian: "A",
  "Starr Nova": "A",
  Edgar: "B",
  Crow: "B",
  Kit: "B",
};

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
  matchupReviewedAt: "30/08/2026",
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
  firstPickProfileReviewedAt: "22/08/2026",
  firstPickProfileVersion: "v0.20",
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
      return { ...brawler, tier, matchupReviewedAt: "30/08/2026" };
    }

    return {
      ...brawler,
      ...wendySeason53,
      range: brawler.range || wendySeason53.range,
      tier,
      counters: [],
      counteredBy: [],
      matchupReviewedAt: "30/08/2026",
      firstPickProfileReviewedAt: "22/08/2026",
      firstPickProfileVersion: "v0.20",
    };
  });
}
