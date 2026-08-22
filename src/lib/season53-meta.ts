import type { Brawler } from "./types";

/**
 * Windstock / Season 53 competitive overlay — reviewed 22/08/2026.
 *
 * Existing Ranked placements use the BrawlMetrics Ranked snapshot (13/08/2026,
 * 4.19M appearances). Nori and Wendy are kept as explicit current-season
 * additions because that Ranked snapshot does not rank them; their placement
 * is conservative and uses current cross-mode evidence plus their official kit.
 *
 * This is a viability layer, not a matchup oracle: map geometry and one-to-one
 * mechanics still decide counters and draft fit.
 */
export const season53TierByName: Record<string, string> = {
  "Bolt": "S+", "Griff": "S+",
  "Surge": "S", "Damian": "S", "8-Bit": "S", "Edgar": "S", "Starr Nova": "S", "Brock": "S", "Nori": "S", "Wendy": "S",
  "Meg": "A", "Chuck": "A", "Mico": "A", "Bo": "A", "Crow": "A", "Bibi": "A", "Max": "A", "Mortis": "A", "Doug": "A", "Carl": "A", "Piper": "A", "Rico": "A", "Jessie": "A", "Tick": "A", "Stu": "A",
  "Tara": "B", "Kaze": "B", "Meeple": "B", "Gray": "B", "Colt": "B", "Angelo": "B", "Bull": "B", "Penny": "B", "Shade": "B", "Sprout": "B", "Kenji": "B", "R-T": "B", "Pierce": "B", "Byron": "B", "Emz": "B", "Juju": "B", "Mandy": "B", "Mina": "B", "Otis": "B", "Nita": "B", "Chester": "B", "Melodie": "B", "Leon": "B", "Lily": "B", "Najia": "B", "Trunk": "B", "Pearl": "B", "Nani": "B",
  "Sirius": "C", "Lumi": "C", "Fang": "C", "Kit": "C", "Ruffs": "C", "Eve": "C", "Clancy": "C", "Belle": "C", "Finx": "C", "Gus": "C", "Janet": "C", "Dynamike": "C", "Berry": "C", "Hank": "C", "Cordelius": "C", "Gigi": "C", "Spike": "C", "Gene": "C", "Willow": "C", "Alli": "C", "Darryl": "C", "Moe": "C", "Ash": "C", "Lou": "C", "Lola": "C", "Colette": "C", "Draco": "C", "Grom": "C", "Bea": "C", "Mr. P": "C", "Amber": "C", "Gale": "C",
  "Poco": "D", "Glowy": "D", "Charlie": "D", "Jacky": "D", "Squeak": "D", "Buster": "D", "Ziggy": "D", "Frank": "D", "Barley": "D", "Sam": "D", "Buzz": "D", "Jae-Yong": "D", "Maisie": "D", "Sandy": "D", "Shelly": "D", "El Primo": "D", "Larry & Lawrie": "D", "Bonnie": "D", "Rosa": "D", "Pam": "D", "Ollie": "D",
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
  matchupReviewedAt: "22/08/2026",
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
    const tier = season53TierByName[brawler.name] || brawler.tier;
    if (brawler.name !== "Wendy") {
      return { ...brawler, tier, matchupReviewedAt: "22/08/2026" };
    }

    // Wendy existed in an earlier internal roster draft as Control. Supercell now
    // classifies her as Mythic Support; replace stale matchup relations rather than
    // letting them leak into the reciprocal counter engine.
    return {
      ...brawler,
      ...wendySeason53,
      range: brawler.range || wendySeason53.range,
      tier,
      counters: [],
      counteredBy: [],
      matchupReviewedAt: "22/08/2026",
      firstPickProfileReviewedAt: "22/08/2026",
      firstPickProfileVersion: "v0.20",
    };
  });
}
