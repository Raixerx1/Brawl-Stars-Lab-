import type {
  Brawler,
  BrawlerFirstPickProfile,
  FirstPickEvaluation,
  MapGeometryProfile,
  MapProfile,
} from "./types";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const DEFAULT_PROFILE: BrawlerFirstPickProfile = {
  blindSafety: 50,
  openFit: 50,
  closedFit: 50,
  bushFit: 50,
  wallReliance: 50,
  postBreakFit: 50,
  vision: 30,
  wallBreak: 25,
  antiDive: 45,
  mobility: 50,
  objective: 55,
  control: 55,
  chokeControl: 55,
  teamDependence: 50,
  counterRisk: 50,
};

const DEFAULT_GEOMETRY: MapGeometryProfile = {
  openness: 50,
  bushDensity: 35,
  wallDensity: 45,
  destructibility: 45,
  chokeDensity: 45,
  laneWidth: 50,
  waterInfluence: 0,
  afterBreakOpenness: 62,
  afterBreakWalls: 31,
  visionImportance: "Media",
  wallBreakImpact: "Media",
};

const tierAdjustment: Record<string, number> = {
  "S+": 6,
  S: 5,
  "A+": 4,
  A: 3,
  "B+": 2,
  B: 1,
  C: 0,
  D: -2,
  F: -5,
  "Sin evaluar": -4,
};

function modeUtility(
  brawler: Brawler,
  map: MapProfile,
  profile: BrawlerFirstPickProfile,
  geometry: MapGeometryProfile,
) {
  const visionNeed = geometry.bushDensity / 100;
  const wallBreakNeed = geometry.destructibility / 100;
  const mobilityNeed = Math.max(geometry.waterInfluence, geometry.laneWidth) / 100;

  switch (map.mode) {
    case "Atraco":
      return clamp(
        profile.objective * .48 +
        profile.wallBreak * wallBreakNeed * .22 +
        profile.postBreakFit * .16 +
        profile.mobility * .14
      );
    case "Balón Brawl":
      return clamp(
        profile.mobility * .27 +
        profile.control * .22 +
        profile.antiDive * .20 +
        profile.objective * .16 +
        profile.bushFit * visionNeed * .15
      );
    case "Atrapagemas":
      return clamp(
        profile.blindSafety * .24 +
        profile.control * .25 +
        profile.objective * .18 +
        profile.vision * visionNeed * .18 +
        profile.mobility * mobilityNeed * .15
      );
    case "Zona Restringida":
      return clamp(
        profile.control * .34 +
        profile.objective * .27 +
        profile.antiDive * .18 +
        profile.chokeControl * geometry.chokeDensity / 100 * .13 +
        profile.postBreakFit * .08
      );
    case "Noqueo":
      return clamp(
        profile.blindSafety * .29 +
        profile.openFit * geometry.openness / 100 * .22 +
        profile.antiDive * .18 +
        profile.mobility * .13 +
        (100 - profile.counterRisk) * .18
      );
    case "Caza Estelar":
      return clamp(
        profile.blindSafety * .27 +
        profile.openFit * geometry.openness / 100 * .24 +
        profile.control * .16 +
        profile.vision * visionNeed * .15 +
        (100 - profile.counterRisk) * .18
      );
    default:
      return clamp(
        profile.blindSafety * .30 +
        profile.control * .22 +
        profile.mobility * .18 +
        profile.objective * .15 +
        (100 - profile.counterRisk) * .15
      );
  }
}

function firstPickStrengths(
  profile: BrawlerFirstPickProfile,
  geometry: MapGeometryProfile,
  map: MapProfile,
  initialFit: number,
  afterBreakFit: number,
  blindQuality: number,
  modeFit: number,
) {
  const strengths: string[] = [];

  if (blindQuality >= 76) strengths.push("Seguridad alta como pick ciego");
  if (geometry.openness >= 68 && profile.openFit >= 76) strengths.push("Rango y presión adaptados a líneas abiertas");
  if (geometry.openness <= 35 && profile.closedFit >= 76) strengths.push("Rinde en pasillos y distancias cortas");
  if (geometry.bushDensity >= 62 && profile.vision >= 72) strengths.push("Aporta visión en un mapa de arbustos");
  else if (geometry.bushDensity >= 62 && profile.bushFit >= 78) strengths.push("Aprovecha la cobertura de arbustos");
  if (geometry.wallDensity >= 68 && geometry.destructibility < 65 && profile.wallReliance >= 75) {
    strengths.push("Aprovecha muros que suelen permanecer");
  }
  if (geometry.destructibility >= 70 && profile.wallBreak >= 72) strengths.push("Puede abrir el mapa a su favor");
  if (geometry.destructibility >= 65 && afterBreakFit >= 76) strengths.push("Mantiene valor después del wallbreak");
  if (geometry.chokeDensity >= 68 && profile.chokeControl >= 76) strengths.push("Controla pasillos y accesos");
  if (geometry.waterInfluence >= 55 && profile.mobility >= 75) strengths.push("Movilidad útil alrededor del agua");
  if (profile.antiDive >= 80) strengths.push("Difícil de castigar con dive");
  if (modeFit >= 78) strengths.push(`Buen historial editorial para ${map.mode}`);
  if (initialFit >= 80 && !strengths.length) strengths.push("Encaje estructural alto con el mapa");

  return [...new Set(strengths)].slice(0, 5);
}

function firstPickRisks(
  profile: BrawlerFirstPickProfile,
  geometry: MapGeometryProfile,
  initialFit: number,
  afterBreakFit: number,
) {
  const risks: string[] = [];

  if (profile.counterRisk >= 68) risks.push("Expone counters claros si se elige demasiado pronto");
  if (profile.teamDependence >= 68) risks.push("Depende demasiado de coordinación aliada");
  if (geometry.openness >= 70 && profile.openFit < 52) risks.push("Alcance insuficiente para las líneas abiertas");
  if (geometry.bushDensity >= 70 && profile.vision < 35 && profile.bushFit < 62) risks.push("Poca información en un mapa de arbustos");
  if (
    geometry.wallDensity >= 65 &&
    geometry.destructibility >= 68 &&
    profile.wallReliance >= 70 &&
    afterBreakFit < 58
  ) {
    risks.push("Pierde mucho valor si el rival rompe los muros");
  }
  if (geometry.chokeDensity >= 70 && profile.chokeControl < 42) risks.push("Control limitado de los pasillos");
  if (initialFit < 48) risks.push("Encaje estructural bajo con el mapa");
  if (profile.blindSafety < 45) risks.push("Mejor como counterpick que como first pick");

  return [...new Set(risks)].slice(0, 4);
}

export function evaluateFirstPick(
  brawler: Brawler,
  map: MapProfile,
): FirstPickEvaluation {
  const profile = brawler.firstPickProfile || DEFAULT_PROFILE;
  const geometry = map.geometry || DEFAULT_GEOMETRY;

  const openWeight = geometry.openness / 100;
  const closedWeight = 1 - openWeight;
  const bushWeight = geometry.bushDensity / 100;
  const wallWeight = geometry.wallDensity / 100;
  const destructibility = geometry.destructibility / 100;
  const chokeWeight = geometry.chokeDensity / 100;
  const laneWeight = geometry.laneWidth / 100;
  const waterWeight = geometry.waterInfluence / 100;

  const baseGeometry =
    profile.openFit * openWeight +
    profile.closedFit * closedWeight;

  const bushScore = profile.bushFit * .64 + profile.vision * .36;
  const denseBushMultiplier = geometry.bushDensity >= 80 ? .62 : geometry.bushDensity >= 60 ? .44 : .30;
  const denseBushVision = geometry.bushDensity >= 75
    ? (profile.vision - 50) * bushWeight * .30
    : 0;
  const breakableWallPenalty =
    profile.wallReliance * wallWeight * destructibility * .12;
  const wallBreakReward =
    profile.wallBreak * wallWeight * destructibility * .10;

  const initialFit = clamp(
    baseGeometry +
    (bushScore - 50) * bushWeight * denseBushMultiplier +
    denseBushVision +
    (profile.wallReliance - 50) * wallWeight * (1 - destructibility * .58) * .24 -
    breakableWallPenalty +
    wallBreakReward +
    (profile.chokeControl - 50) * chokeWeight * .18 +
    (profile.openFit - 50) * laneWeight * .10 +
    (profile.mobility - 50) * waterWeight * .18
  );

  const afterOpenWeight = geometry.afterBreakOpenness / 100;
  const afterBase =
    profile.openFit * afterOpenWeight +
    profile.closedFit * (1 - afterOpenWeight);

  const afterBreakFit = clamp(
    afterBase * .55 +
    profile.postBreakFit * .27 +
    profile.wallBreak * destructibility * .10 +
    profile.mobility * waterWeight * .08 -
    profile.wallReliance * destructibility * .08
  );

  const blindQuality = clamp(
    profile.blindSafety * .50 +
    profile.antiDive * .19 +
    (100 - profile.counterRisk) * .19 +
    (100 - profile.teamDependence) * .12
  );

  const modeRaw = brawler.modes[map.mode];
  const modeFit = clamp(typeof modeRaw === "number" ? modeRaw * 10 : 38);
  const utility = modeUtility(brawler, map, profile, geometry);

  const score = clamp(
    initialFit * .38 +
    afterBreakFit * .15 +
    blindQuality * .20 +
    modeFit * .13 +
    utility * .10 +
    50 * .04 +
    (tierAdjustment[brawler.tier] || 0)
  );

  return {
    score,
    initialFit,
    afterBreakFit,
    blindQuality,
    modeFit,
    modeUtility: utility,
    strengths: firstPickStrengths(
      profile,
      geometry,
      map,
      initialFit,
      afterBreakFit,
      blindQuality,
      modeFit,
    ),
    risks: firstPickRisks(profile, geometry, initialFit, afterBreakFit),
  };
}

export function mapGeometrySummary(map: MapProfile) {
  const geometry = map.geometry || DEFAULT_GEOMETRY;
  const factors: string[] = [];

  if (geometry.openness >= 70) factors.push("muy abierto");
  else if (geometry.openness >= 55) factors.push("semiabierto");
  else if (geometry.openness <= 30) factors.push("muy cerrado");
  else if (geometry.openness <= 45) factors.push("cerrado");
  else factors.push("mixto");

  if (geometry.bushDensity >= 70) factors.push("mucho arbusto");
  else if (geometry.bushDensity >= 45) factors.push("arbustos relevantes");

  if (geometry.wallDensity >= 70) factors.push("muchos muros");
  if (geometry.destructibility >= 70) factors.push("wallbreak decisivo");
  else if (geometry.destructibility <= 25 && geometry.wallDensity >= 35) factors.push("estructura poco modificable");

  if (geometry.chokeDensity >= 70) factors.push("pasillos estrechos");
  if (geometry.waterInfluence >= 55) factors.push("agua condicionante");

  return factors.join(" · ");
}
