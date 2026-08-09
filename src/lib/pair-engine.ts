import { analyzeDraft } from "./draft-engine";
import type {
  Brawler,
  DraftInput,
  DraftRecommendation,
  PairRecommendation,
  QueueMode,
} from "./types";

const norm = (value: string) => value.trim().toLowerCase();
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const hasTag = (brawler: Brawler, ...tags: string[]) =>
  tags.some((tag) => brawler.tags.includes(tag));

const isLongRange = (brawler: Brawler) =>
  ["Muy largo", "Largo", "Medio-largo"].includes(brawler.range) ||
  hasTag(brawler, "sniper", "open");

const isFrontline = (brawler: Brawler) =>
  brawler.role === "Tanque" ||
  brawler.role === "Asesino" ||
  hasTag(brawler, "tank", "assassin", "mobile");

const isSupport = (brawler: Brawler) =>
  brawler.role === "Apoyo" || hasTag(brawler, "support", "apoyo");

const isControl = (brawler: Brawler) =>
  brawler.role === "Control" || hasTag(brawler, "control", "zone");

const isThrower = (brawler: Brawler) =>
  brawler.role === "Artillero" || hasTag(brawler, "thrower", "artillero");

const isAntidive = (brawler: Brawler) =>
  brawler.role === "Antidive" ||
  hasTag(brawler, "antidive") ||
  ["Gale", "Shelly", "R-T", "Surge", "Otis", "Cordelius"].includes(brawler.name);

const hasVision = (brawler: Brawler) =>
  hasTag(brawler, "vision") ||
  ["Bo", "Tara", "Gene", "Crow", "Sandy", "Janet", "Mr. P"].includes(brawler.name);

const hasWallbreak = (brawler: Brawler) =>
  hasTag(brawler, "wallbreak") ||
  ["Brock", "Colt", "Griff", "Shelly", "Frank", "Ruffs", "Gray", "Piper"].includes(brawler.name);

function autonomy(brawler: Brawler) {
  return 100 - (
    brawler.firstPickProfile?.teamDependence
    ?? (isSupport(brawler) ? 72 : hasTag(brawler, "carry", "safe") ? 30 : 48)
  );
}

function pairLanes(first: DraftRecommendation, second: DraftRecommendation) {
  if (first.suggestedLine !== second.suggestedLine) {
    return `${first.brawler.name}: ${first.suggestedLine} · ${second.brawler.name}: ${second.suggestedLine}`;
  }
  if (isLongRange(first.brawler) && !isLongRange(second.brawler)) {
    return `${first.brawler.name}: mid/línea larga · ${second.brawler.name}: lateral de presión`;
  }
  if (!isLongRange(first.brawler) && isLongRange(second.brawler)) {
    return `${second.brawler.name}: mid/línea larga · ${first.brawler.name}: lateral de presión`;
  }
  return `${first.brawler.name}: izquierda · ${second.brawler.name}: derecha; ajustad según matchups`;
}

function scorePair(
  first: DraftRecommendation,
  second: DraftRecommendation,
  input: DraftInput,
): PairRecommendation {
  const queueMode: QueueMode = input.queueMode || "SoloQ";
  const reasons: string[] = [];
  const risks: string[] = [];

  let synergy = 48;
  let coordination = queueMode === "SoloQ" ? 52 : queueMode === "Dúo" ? 66 : 82;

  const differentRoles = first.brawler.role !== second.brawler.role;
  if (differentRoles) {
    synergy += 10;
    reasons.push("Roles complementarios");
  } else {
    const fragileDuplicate = ["Asesino", "Artillero", "Apoyo", "Tanque"].includes(first.brawler.role);
    synergy -= fragileDuplicate ? 18 : 7;
    risks.push(`Duplica el rol ${first.brawler.role}`);
    if (fragileDuplicate) risks.push("La pareja comparte la misma debilidad estructural");
  }

  if (
    (isLongRange(first.brawler) && isFrontline(second.brawler)) ||
    (isFrontline(first.brawler) && isLongRange(second.brawler))
  ) {
    synergy += 12;
    reasons.push("Combina rango y presión frontal");
  }

  if (
    (isThrower(first.brawler) && isAntidive(second.brawler)) ||
    (isThrower(second.brawler) && isAntidive(first.brawler))
  ) {
    synergy += 13;
    reasons.push("El antidive protege al artillero");
  }

  if (
    (isSupport(first.brawler) && hasTag(second.brawler, "carry", "damage")) ||
    (isSupport(second.brawler) && hasTag(first.brawler, "carry", "damage"))
  ) {
    const bonus = queueMode === "Trío" ? 16 : queueMode === "Dúo" ? 11 : 5;
    synergy += bonus;
    coordination += queueMode === "SoloQ" ? -3 : 8;
    reasons.push(queueMode === "SoloQ"
      ? "Soporte + carry, pero exige conversión aliada"
      : "Soporte + carry coordinable");
  }

  if (isControl(first.brawler) !== isControl(second.brawler)) {
    synergy += 7;
    reasons.push("Uno controla espacio y el otro convierte la presión");
  }

  const bushDensity = input.map.geometry?.bushDensity || 0;
  if (bushDensity >= 60 && (hasVision(first.brawler) || hasVision(second.brawler))) {
    synergy += 8;
    reasons.push("La pareja incluye visión para los arbustos");
  }

  const destructibility = input.map.geometry?.destructibility || 0;
  if (destructibility >= 65 && (hasWallbreak(first.brawler) || hasWallbreak(second.brawler))) {
    synergy += 7;
    reasons.push("Puede modificar el mapa sin perder ambos picks");
  }

  if (
    input.map.mode === "Atraco" &&
    [first.brawler, second.brawler].some((brawler) => hasTag(brawler, "objective", "damage", "carry"))
  ) {
    synergy += 7;
    reasons.push("Incluye presión directa sobre la caja");
  }

  if (
    ["Zona Restringida", "Atrapagemas"].includes(input.map.mode) &&
    [first.brawler, second.brawler].some(isControl)
  ) {
    synergy += 6;
    reasons.push("Control suficiente para la condición de victoria");
  }

  const firstBlind = first.brawler.firstPickProfile?.blindSafety || 50;
  const secondBlind = second.brawler.firstPickProfile?.blindSafety || 50;
  const hasStableAnchor =
    firstBlind >= 72 ||
    secondBlind >= 72 ||
    hasTag(first.brawler, "safe", "mid") ||
    hasTag(second.brawler, "safe", "mid");

  if (hasStableAnchor) {
    synergy += 6;
    reasons.push("Incluye un ancla estable para la composición");
  } else {
    synergy -= 10;
    risks.push("No incluye un pick ciego estable");
  }

  const combinedCounterRisk =
    ((first.brawler.firstPickProfile?.counterRisk || 50) +
      (second.brawler.firstPickProfile?.counterRisk || 50)) / 2;
  if (combinedCounterRisk >= 68) {
    synergy -= 9;
    risks.push("Ambos pueden ser castigados por counters claros");
  }

  const pairAutonomy = (autonomy(first.brawler) + autonomy(second.brawler)) / 2;
  if (queueMode === "SoloQ") {
    coordination += Math.round((pairAutonomy - 50) * .34);
    if (pairAutonomy >= 66) reasons.push("Pareja autosuficiente para SoloQ");
    if (pairAutonomy < 42) risks.push("Demasiada dependencia de coordinación para SoloQ");
    if (isSupport(first.brawler) && isSupport(second.brawler)) {
      synergy -= 18;
      coordination -= 16;
      risks.push("Doble soporte con poco daño propio");
    }
  } else if (queueMode === "Dúo") {
    coordination += 6;
    if (differentRoles) reasons.push("Fácil de coordinar entre dos jugadores");
  } else {
    coordination += 12;
    if (isSupport(first.brawler) || isSupport(second.brawler)) {
      synergy += 6;
      reasons.push("El trío puede explotar mejor la utilidad");
    }
  }

  if (
    input.map.layout === "Abierto" &&
    !isLongRange(first.brawler) &&
    !isLongRange(second.brawler)
  ) {
    synergy -= 15;
    risks.push("La pareja carece de rango para un mapa abierto");
  }

  if (
    input.map.layout === "Cerrado" &&
    isLongRange(first.brawler) &&
    isLongRange(second.brawler) &&
    !isAntidive(first.brawler) &&
    !isAntidive(second.brawler)
  ) {
    synergy -= 10;
    risks.push("Doble backline expuesto al dive");
  }

  const coveredEnemies = unique([
    ...first.countersHit,
    ...first.softCounters,
    ...second.countersHit,
    ...second.softCounters,
  ]);
  const directEnemies = unique([...first.countersHit, ...second.countersHit]);
  const sharedExposure = unique(
    first.exposedTo.filter((name) =>
      second.exposedTo.some((other) => norm(other) === norm(name))
    )
  );

  let coverage = 48;
  coverage += directEnemies.length * 15;
  coverage += Math.max(0, coveredEnemies.length - directEnemies.length) * 7;
  coverage -= sharedExposure.length * 16;

  if (directEnemies.length >= 2) reasons.push(`Cubre directamente ${directEnemies.length} picks rivales`);
  if (sharedExposure.length) risks.push(`Ambos sufren contra ${sharedExposure.join(" y ")}`);

  const baseScore = first.score * .51 + second.score * .49;
  const score = clamp(
    baseScore * .70 +
    clamp(synergy) * .14 +
    clamp(coverage) * .10 +
    clamp(coordination) * .06
  );

  return {
    first,
    second,
    score,
    synergy: clamp(synergy),
    coverage: clamp(coverage),
    coordination: clamp(coordination),
    reasons: unique(reasons).slice(0, 5),
    risks: unique(risks).slice(0, 4),
    lanePlan: pairLanes(first, second),
  };
}

export function recommendDoublePick(
  input: DraftInput,
  roster: Brawler[],
  limit = 4,
): PairRecommendation[] {
  const base = analyzeDraft(input, roster);
  const firstCandidates = base.recommendations.slice(0, 8);
  const pairs: PairRecommendation[] = [];
  const seen = new Set<string>();

  for (const first of firstCandidates) {
    const secondInput: DraftInput = {
      ...input,
      allies: [...input.allies, first.brawler.name],
      myPick: undefined,
      position: input.position === "Last pick" ? "Last pick" : "Pick intermedio",
    };
    const secondAnalysis = analyzeDraft(secondInput, roster);

    for (const second of secondAnalysis.recommendations.slice(0, 5)) {
      if (norm(first.brawler.name) === norm(second.brawler.name)) continue;
      const key = [norm(first.brawler.name), norm(second.brawler.name)].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(scorePair(first, second, input));
    }
  }

  return pairs
    .sort((a, b) =>
      b.score - a.score ||
      b.coverage - a.coverage ||
      b.synergy - a.synergy
    )
    .slice(0, limit);
}
