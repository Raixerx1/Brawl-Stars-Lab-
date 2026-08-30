import type { MapGeometryProfile, MapProfile } from "./types";

const REVIEWED_AT = "30/08/2026";
const UPDATE_LABEL = "Update 69 · rotación anunciada 29/08/2026";

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const neutralGeometry: MapGeometryProfile = {
  openness: 50,
  bushDensity: 40,
  wallDensity: 50,
  destructibility: 55,
  chokeDensity: 52,
  laneWidth: 50,
  waterInfluence: 0,
  afterBreakOpenness: 68,
  afterBreakWalls: 32,
  visionImportance: "Media",
  wallBreakImpact: "Media",
};

function provisionalMap(input: {
  name: string;
  mode: string;
  creator?: string;
  layout?: string;
  traits?: string[];
  tierS: string[];
  tierA: string[];
  firstPicks: string[];
  lastPicks: string[];
  bans: string[];
  plan: string;
  geometry?: MapGeometryProfile;
  confidence?: "Baja" | "Media" | "Alta";
}): MapProfile {
  const creatorNote = input.creator ? ` · creador: ${input.creator}` : "";
  const confidence = input.confidence || "Baja";
  return {
    slug: normalize(input.name),
    name: input.name,
    mode: input.mode,
    layout: input.layout || "Mixto",
    traits: input.traits || ["mapa Update 69", "perfil estructural provisional", "tres carriles"],
    tierS: input.tierS,
    tierA: input.tierA,
    firstPicks: input.firstPicks,
    lastPicks: input.lastPicks,
    bans: input.bans,
    plan: input.plan,
    featuredOfficialJune2026: false,
    status: `${UPDATE_LABEL}${creatorNote} · perfil de draft provisional hasta disponer de muestra Ranked post-lanzamiento.`,
    rotationStatus: "Actual",
    poolCheckedAt: REVIEWED_AT,
    aliases: [],
    firstPickReviewedAt: REVIEWED_AT,
    firstPickConfidence: confidence,
    firstPickNotes: "Perfil provisional de Update 69. Prioriza meta vivo, función del modo y geometría conocida; se recalibrará con datos Ranked del mapa.",
    geometry: input.geometry || neutralGeometry,
    geometryReviewedAt: REVIEWED_AT,
    firstPickModelVersion: "v0.22",
  };
}

const newUpdate69Maps: MapProfile[] = [
  provisionalMap({
    name: "Dungeon Train",
    mode: "Atrapagemas",
    creator: "LynxRoh",
    tierS: ["Jessie", "Wendy", "Max", "Gigi", "Surge"],
    tierA: ["Gene", "Bo", "Ruffs", "Nori", "Rico"],
    firstPicks: ["Jessie", "Max", "Gene"],
    lastPicks: ["Gigi", "Surge", "Nori"],
    bans: ["Jessie", "Gigi", "Surge"],
    plan: "Asegura primero el control de la mina y conserva una respuesta al dive. Al ser un mapa nuevo, evita picks demasiado dependientes de una geometría aún no validada en Ranked.",
  }),
  provisionalMap({
    name: "Alchemy",
    mode: "Caza Estelar",
    creator: "Tevolozza",
    tierS: ["Colt", "Griff", "Max", "Stu", "Wendy"],
    tierA: ["Brock", "Gene", "8-Bit", "Bo", "Rico"],
    firstPicks: ["Gene", "Max", "Brock"],
    lastPicks: ["Colt", "Stu", "Griff"],
    bans: ["Colt", "Griff", "Stu"],
    plan: "Prioriza rango seguro, control de líneas y supervivencia. No conviertas una ventaja de estrellas en intercambios innecesarios mientras el mapa todavía carezca de muestra competitiva estable.",
  }),
  provisionalMap({
    name: "In Demand",
    mode: "Balón Brawl",
    creator: "AppleSaucing",
    tierS: ["Max", "Surge", "Stu", "Gigi", "Kaze"],
    tierA: ["Rico", "Bull", "Nori", "Griff", "Wendy"],
    firstPicks: ["Max", "Surge", "Stu"],
    lastPicks: ["Kaze", "Gigi", "Bull"],
    bans: ["Kaze", "Surge", "Gigi"],
    plan: "Gana carriles antes de avanzar el balón. Conserva movilidad y una herramienta antidive hasta conocer qué rutas y muros dominan el mapa en juego competitivo.",
  }),
  provisionalMap({
    name: "Pump It Up",
    mode: "Balón Brawl",
    creator: "unverable",
    tierS: ["Max", "Surge", "Stu", "Gigi", "Kaze"],
    tierA: ["Rico", "Bull", "Nori", "Griff", "Wendy"],
    firstPicks: ["Max", "Surge", "Stu"],
    lastPicks: ["Kaze", "Gigi", "Bull"],
    bans: ["Kaze", "Surge", "Gigi"],
    plan: "Juega primero por tempo y control de carriles. El perfil específico de wallbreak y arbustos se ajustará cuando exista evidencia Ranked suficiente del mapa.",
  }),
  provisionalMap({
    name: "Tread Carefully",
    mode: "Zona Restringida",
    creator: "IAmNumberFour",
    tierS: ["Jessie", "Wendy", "Max", "Gigi", "Surge"],
    tierA: ["Bo", "Ruffs", "Rico", "Bull", "Nori"],
    firstPicks: ["Jessie", "Max", "Bo"],
    lastPicks: ["Gigi", "Surge", "Bull"],
    bans: ["Jessie", "Gigi", "Surge"],
    plan: "Prioriza control sostenido de zona, capacidad de retake y recursos para negar entradas. Recalibra la importancia de throwers y wallbreak cuando el layout tenga datos suficientes.",
  }),
  provisionalMap({
    name: "Stroke of Luck",
    mode: "Noqueo",
    creator: "PhotonWinz",
    tierS: ["Surge", "Stu", "Griff", "Kaze", "Wendy"],
    tierA: ["Brock", "Gene", "8-Bit", "Nori", "Rico"],
    firstPicks: ["Gene", "Brock", "Stu"],
    lastPicks: ["Kaze", "Surge", "Griff"],
    bans: ["Kaze", "Surge", "Griff"],
    plan: "Valora supervivencia y control de espacio por encima del daño bruto. En un mapa nuevo de Noqueo, reserva los picks de alto riesgo para cuando el rival haya mostrado su rango y capacidad de dive.",
  }),
];

const returningFallbacks: MapProfile[] = [
  provisionalMap({
    name: "Lilygear Lake",
    mode: "Atrapagemas",
    layout: "Cerrado",
    traits: ["mina central", "pasillos estrechos", "agua", "muros indestructibles", "control de choke"],
    tierS: ["Bolt", "Wendy", "Nori", "Surge", "Jessie"],
    tierA: ["8-Bit", "Starr Nova", "Bo", "Eve", "Lou"],
    firstPicks: ["Jessie", "Bo", "Wendy"],
    lastPicks: ["Nori", "Surge", "Eve"],
    bans: ["Bolt", "Wendy", "Nori"],
    plan: "Controla los accesos a la mina central y usa los obstáculos para negar líneas. Los muros indestructibles limitan el valor de abrir el mapa por completo.",
    confidence: "Media",
    geometry: {
      openness: 34,
      bushDensity: 50,
      wallDensity: 68,
      destructibility: 36,
      chokeDensity: 78,
      laneWidth: 34,
      waterInfluence: 44,
      afterBreakOpenness: 48,
      afterBreakWalls: 52,
      visionImportance: "Alta",
      wallBreakImpact: "Media",
    },
  }),
  provisionalMap({
    name: "Kaboom Canyon",
    mode: "Atraco",
    layout: "Mixto",
    traits: ["tres carriles", "presión a caja", "control de líneas", "wallbreak"],
    tierS: ["Nori", "Jessie", "Gigi", "Bolt", "Griff"],
    tierA: ["Nita", "Chuck", "Mico", "8-Bit", "Colt"],
    firstPicks: ["Jessie", "Nori", "Griff"],
    lastPicks: ["Chuck", "Mico", "Gigi"],
    bans: ["Nori", "Jessie", "Gigi"],
    plan: "Separa presión de caja y control de carril. Abre únicamente las líneas que mejoren tu daño seguro a la caja sin regalar una autopista al rival.",
    confidence: "Alta",
  }),
  provisionalMap({
    name: "Call of the Water",
    mode: "Noqueo",
    layout: "Mixto",
    traits: ["líneas de rango", "cobertura", "juego de vida", "control de ángulos"],
    tierS: ["Bolt", "Pierce", "Stu", "Griff", "Lily"],
    tierA: ["Buster", "Pearl", "Eve", "Brock", "Gene"],
    firstPicks: ["Gene", "Brock", "Bolt"],
    lastPicks: ["Lily", "Stu", "Buster"],
    bans: ["Bolt", "Stu", "Griff"],
    plan: "No regales la primera baja: gana ángulos y obliga al rival a entrar. Conserva una respuesta al dive si abres demasiado el mapa.",
    confidence: "Media",
    geometry: {
      openness: 60,
      bushDensity: 22,
      wallDensity: 48,
      destructibility: 60,
      chokeDensity: 50,
      laneWidth: 58,
      waterInfluence: 20,
      afterBreakOpenness: 78,
      afterBreakWalls: 26,
      visionImportance: "Media",
      wallBreakImpact: "Media",
    },
  }),
];

const removedByUpdate69 = new Set([
  "Snake Pit",
  "Ancestral Roots",
  "Eating Good!",
  "Watermelons",
  "Deadlock",
  "Nutmeg",
  "Abracadabra",
  "Crab Claws",
  "Leaping Dogs",
].map(normalize));

const returningNames = new Set(returningFallbacks.map((map) => normalize(map.name)));

export function applyUpdate69Maps(base: MapProfile[]): MapProfile[] {
  const result = base.map((map) => {
    const key = normalize(map.name || map.slug);
    if (removedByUpdate69.has(key)) {
      return {
        ...map,
        rotationStatus: "Histórico" as const,
        status: `Sale de la rotación con Update 69 · revisado ${REVIEWED_AT}.`,
        poolCheckedAt: REVIEWED_AT,
      };
    }
    if (returningNames.has(key)) {
      return {
        ...map,
        rotationStatus: "Actual" as const,
        status: `${UPDATE_LABEL} · vuelve a la rotación competitiva. Perfil histórico conservado y marcado para recalibración post-lanzamiento.`,
        poolCheckedAt: REVIEWED_AT,
      };
    }
    return map;
  });

  const known = new Set(result.map((map) => normalize(map.name || map.slug)));
  for (const fallback of returningFallbacks) {
    if (!known.has(normalize(fallback.name))) {
      result.push(fallback);
      known.add(normalize(fallback.name));
    }
  }
  for (const map of newUpdate69Maps) {
    if (!known.has(normalize(map.name))) {
      result.push(map);
      known.add(normalize(map.name));
    }
  }

  return result;
}

export const update69CompetitiveMapChanges = [
  { mode: "Atrapagemas", removed: "Snake Pit", added: "Lilygear Lake", isNew: false },
  { mode: "Atrapagemas", removed: "Ancestral Roots", added: "Dungeon Train", isNew: true, creator: "LynxRoh" },
  { mode: "Atraco", removed: "Eating Good!", added: "Kaboom Canyon", isNew: false },
  { mode: "Caza Estelar", removed: "Watermelons", added: "Alchemy", isNew: true, creator: "Tevolozza" },
  { mode: "Balón Brawl", removed: "Deadlock", added: "In Demand", isNew: true, creator: "AppleSaucing" },
  { mode: "Balón Brawl", removed: "Nutmeg", added: "Pump It Up", isNew: true, creator: "unverable" },
  { mode: "Zona Restringida", removed: "Abracadabra", added: "Tread Carefully", isNew: true, creator: "IAmNumberFour" },
  { mode: "Noqueo", removed: "Crab Claws", added: "Call of the Water", isNew: false },
  { mode: "Noqueo", removed: "Leaping Dogs", added: "Stroke of Luck", isNew: true, creator: "PhotonWinz" },
] as const;
