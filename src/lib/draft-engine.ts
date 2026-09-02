import { personalAdjustment } from "./performance";
import { evaluateFirstPick } from "./first-pick-model";
import { update69DraftAdjustment } from "./update69-live";
import type {
  BanRecommendation,
  Brawler,
  DraftAnalysis,
  DraftInput,
  DraftChecklistItem,
  DraftConfidence,
  DraftPosition,
  DraftRecommendation,
  EnemyPickPrediction,
  LanePlan,
  TacticalBuild,
  TeamAssignment,
  WinEstimate,
} from "./types";

const tierScore: Record<string, number> = {
  "S+": 68,
  S: 64,
  "A+": 59,
  A: 56,
  "B+": 51,
  B: 48,
  C: 43,
  D: 38,
  F: 32,
  "Sin evaluar": 40,
};

const tierMetric: Record<string, number> = {
  "S+": 92,
  S: 88,
  "A+": 82,
  A: 76,
  "B+": 69,
  B: 63,
  C: 53,
  D: 43,
  F: 32,
  "Sin evaluar": 48,
};

const norm = (value: string) => value.trim().toLowerCase();
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const includesName = (list: string[], name: string) => list.some((item) => norm(item) === norm(name));
const hasTag = (brawler: Brawler, ...tags: string[]) => tags.some((tag) => brawler.tags.includes(tag));
const isLongRange = (brawler: Brawler) =>
  brawler.range === "Muy largo" || brawler.range === "Largo" || hasTag(brawler, "sniper", "tirador", "open");
const isShortRange = (brawler: Brawler) =>
  brawler.range === "Corto" || brawler.role === "Tanque" || brawler.role === "Asesino" || hasTag(brawler, "tank", "assassin");
const isControl = (brawler: Brawler) => brawler.role === "Control" || hasTag(brawler, "control", "zone");
const isFrontline = (brawler: Brawler) =>
  brawler.role === "Tanque" || brawler.role === "Asesino" || hasTag(brawler, "tank", "mobile", "assassin");
const isAntitank = (brawler: Brawler) => brawler.role === "Antitanque" || hasTag(brawler, "antitank", "antitanque");
const isAntidive = (brawler: Brawler) => brawler.role === "Antidive" || hasTag(brawler, "antidive") || ["Gale", "Shelly", "R-T", "Surge", "Otis", "Cordelius"].includes(brawler.name);
const isObjective = (brawler: Brawler) => hasTag(brawler, "objective", "damage", "carry") || ["Colt", "Colette", "Chuck", "Melodie", "Nita", "Jessie", "8-Bit", "Brock"].includes(brawler.name);
const isSupport = (brawler: Brawler) => brawler.role === "Apoyo" || hasTag(brawler, "support", "apoyo");
const isThrower = (brawler: Brawler) => brawler.role === "Artillero" || hasTag(brawler, "thrower", "artillero");
const hasWallbreak = (brawler: Brawler) => hasTag(brawler, "wallbreak") || ["Brock", "Colt", "Griff", "Shelly", "Frank", "Ruffs", "Gray", "Piper"].includes(brawler.name);
const hasVision = (brawler: Brawler) => ["Tara", "Gene", "Bo", "Janet", "Crow", "Sandy", "Mr. P"].includes(brawler.name) || hasTag(brawler, "vision");

function findProfiles(names: string[], roster: Brawler[]) {
  return names.map((name) => roster.find((brawler) => norm(brawler.name) === norm(name))).filter(Boolean) as Brawler[];
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function inferDraftPosition(allies: number, enemies: number): DraftPosition {
  const visiblePicks = allies + enemies;
  if (visiblePicks === 0) return "First pick";
  if (allies >= 2 && enemies >= 2) return "Last pick";
  if (visiblePicks >= 4) return "Last pick";
  return "Pick intermedio";
}

function teamNeeds(input: DraftInput, allies: Brawler[], enemies: Brawler[]) {
  const needs: string[] = [];
  const enemyHasTank = enemies.some((enemy) => enemy.role === "Tanque" || hasTag(enemy, "tank", "tanque"));
  const enemyHasDive = enemies.some((enemy) => enemy.role === "Asesino" || hasTag(enemy, "assassin", "asesino", "mobile"));
  const enemyHasThrower = enemies.some(isThrower);

  if (enemyHasTank && !allies.some(isAntitank)) needs.push("Antitanque");
  if (enemyHasDive && !allies.some(isAntidive)) needs.push("Antidive / peel");
  if (enemyHasThrower && !allies.some((ally) => ally.role === "Asesino" || hasTag(ally, "mobile"))) needs.push("Acceso contra artilleros");
  if (input.map.layout === "Abierto" && !allies.some(isLongRange)) needs.push("Rango largo");
  if (input.map.layout === "Cerrado" && allies.length > 0 && allies.every(isLongRange)) needs.push("Presencia de primera línea");
  if (!allies.some(isControl) && ["Zona Restringida", "Atrapagemas", "Balón Brawl"].includes(input.map.mode)) needs.push("Control de espacio");
  if (input.map.mode === "Atraco" && !allies.some(isObjective)) needs.push("Daño al objetivo");
  if (input.map.mode === "Atrapagemas" && !allies.some((ally) => hasTag(ally, "mid", "safe") || isSupport(ally) || isLongRange(ally))) needs.push("Mid / portador estable");
  if (input.map.mode === "Balón Brawl" && !allies.some(isFrontline)) needs.push("Presión y movilidad");
  if (input.map.mode === "Zona Restringida" && !allies.some(isControl)) needs.push("Negación de zona");
  if (["Noqueo", "Caza Estelar"].includes(input.map.mode) && !allies.some((ally) => isLongRange(ally) || hasTag(ally, "safe"))) needs.push("Daño seguro a distancia");
  if (input.map.traits.some((trait) => trait.includes("arbust")) && !allies.some(hasVision)) needs.push("Visión de arbustos");
  if (input.map.traits.some((trait) => trait.includes("muro")) && !allies.some(hasWallbreak) && enemies.some(isThrower)) needs.push("Ruptura de muros");
  if (allies.filter(isSupport).length >= 2) needs.push("Carry con daño propio");
  if (allies.filter(isLongRange).length >= 2 && enemies.some(isFrontline)) needs.push("Protección del backline");
  return unique(needs).slice(0, 7);
}

function draftStrengths(input: DraftInput, allies: Brawler[], enemies: Brawler[]) {
  const strengths: string[] = [];
  const roles = new Set(allies.map((ally) => ally.role));
  if (allies.length >= 2 && roles.size === allies.length) strengths.push("Roles aliados complementarios");
  if (allies.some(isControl)) strengths.push("Control de espacio cubierto");
  if (allies.some(isAntidive)) strengths.push("Defensa frente a dive");
  if (allies.some(isAntitank)) strengths.push("Respuesta contra tanques");
  if (allies.some(hasWallbreak)) strengths.push("Capacidad de modificar el mapa");
  if (input.map.layout === "Abierto" && allies.some(isLongRange)) strengths.push("Rango adaptado al mapa");
  if (input.map.mode === "Atraco" && allies.some(isObjective)) strengths.push("Presión directa sobre la caja");
  if (enemies.some((enemy) => allies.some((ally) => includesName(ally.counters, enemy.name)))) strengths.push("Ya existe al menos un matchup favorable");
  return unique(strengths).slice(0, 6);
}

function draftThreats(allies: Brawler[], enemies: Brawler[]) {
  const threats: string[] = [];
  for (const enemy of enemies) {
    const exposedAllies = allies.filter((ally) => includesName(ally.counteredBy, enemy.name));
    if (exposedAllies.length) threats.push(`${enemy.name} amenaza a ${exposedAllies.map((ally) => ally.name).join(" y ")}`);
  }
  if (enemies.some((enemy) => enemy.role === "Tanque") && !allies.some(isAntitank)) threats.push("Falta daño consistente contra tanques");
  if (enemies.some((enemy) => enemy.role === "Asesino") && !allies.some(isAntidive)) threats.push("El backline está expuesto al dive");
  if (enemies.some(isThrower) && !allies.some(isFrontline)) threats.push("Falta acceso contra artilleros");
  if (allies.filter(isLongRange).length >= 2 && enemies.filter(isFrontline).length >= 2) threats.push("Doble rango expuesto a entradas simultáneas");
  return unique(threats).slice(0, 6);
}

function enemyWeaknesses(input: DraftInput, enemies: Brawler[]) {
  const weaknesses: string[] = [];
  if (enemies.length < 2) return weaknesses;
  if (enemies.filter(isShortRange).length >= 2) weaknesses.push("Mucho corto alcance: castígalo con control y antitanque");
  if (enemies.filter(isLongRange).length >= 2) weaknesses.push("Backline frágil: presión móvil y cierre de distancia");
  if (enemies.filter(isThrower).length >= 2) weaknesses.push("Doble artillero: vulnerable a movilidad y ruptura de muros");
  if (enemies.filter(isSupport).length >= 2) weaknesses.push("Daño propio limitado: fuerza intercambios rápidos");
  if (!enemies.some(isAntitank)) weaknesses.push("Sin antitanque claro: un tanque de último pick puede castigar");
  if (!enemies.some(isAntidive) && enemies.some(isLongRange)) weaknesses.push("Sin antidive: los asesinos móviles ganan valor");
  if (input.map.mode === "Atraco" && !enemies.some(isObjective)) weaknesses.push("Poca presión directa sobre la caja");
  if (input.map.layout === "Abierto" && !enemies.some(isLongRange)) weaknesses.push("Rango insuficiente para el mapa abierto");
  return unique(weaknesses).slice(0, 5);
}

function lineFor(brawler: Brawler, input: DraftInput) {
  if (hasTag(brawler, "mid") || (input.map.mode === "Atrapagemas" && (isSupport(brawler) || hasTag(brawler, "safe") || isLongRange(brawler)))) return "Centro / portador";
  if (isThrower(brawler)) return "Línea con muros";
  if (brawler.role === "Asesino" || brawler.role === "Tanque") return "Lateral de presión";
  if (isLongRange(brawler)) return input.map.layout === "Abierto" ? "Línea larga" : "Lateral con ángulo";
  if (isControl(brawler)) return "Centro o línea de control";
  return "Línea flexible";
}

function tacticalBuild(brawler: Brawler, input: DraftInput, enemies: Brawler[]): TacticalBuild {
  const enemyDive = enemies.some((enemy) => enemy.role === "Asesino" || isFrontline(enemy));
  const enemyTank = enemies.some((enemy) => enemy.role === "Tanque");
  const bushes = input.map.traits.some((trait) => trait.includes("arbust"));
  const walls = input.map.traits.some((trait) => trait.includes("muro") || trait.includes("rebote") || trait.includes("choke"));
  const open = input.map.layout === "Abierto";

  let gadget = "Gadget de tempo o utilidad";
  if (enemyDive || brawler.role === "Tirador" || brawler.role === "Artillero") gadget = "Gadget defensivo, escape o interrupción";
  else if (walls && hasWallbreak(brawler)) gadget = "Gadget de apertura de mapa / wallbreak";
  else if (brawler.role === "Asesino" || brawler.role === "Tanque") gadget = "Gadget de entrada o supervivencia";

  let starPower = "Habilidad estelar más consistente";
  if (enemyTank) starPower = "Habilidad estelar orientada a daño sostenido";
  else if (enemyDive) starPower = "Habilidad estelar de supervivencia o control";
  else if (open && isLongRange(brawler)) starPower = "Habilidad estelar de alcance, precisión o poke";
  else if (input.map.mode === "Zona Restringida") starPower = "Habilidad estelar de control persistente";

  const gears: string[] = [];
  if (bushes) gears.push("Velocidad");
  if (open && !bushes) gears.push("Escudo");
  if (brawler.role === "Tanque" || enemyDive) gears.push("Salud");
  if (isLongRange(brawler) || isObjective(brawler) || enemyTank) gears.push("Daño");
  if (isControl(brawler) || isThrower(brawler)) gears.push("Recarga");
  if (gears.length < 2) gears.push("Daño");

  const hypercharge = brawler.profileComplete
    ? "Úsala para ganar la interacción decisiva u objetivo, no solo por daño"
    : "Priorízala si está disponible y el brawler forma parte de tu pool preparado";

  return {
    gadget,
    starPower,
    gears: unique(gears).slice(0, 2),
    hypercharge,
    reason: enemyDive
      ? "El rival tiene acceso al backline: prima supervivencia y control de entrada."
      : enemyTank
        ? "El rival acumula vida: prima daño sostenido y recarga."
        : walls
          ? "El valor depende de pasillos, muros y control angular."
          : "Build equilibrada para conservar flexibilidad durante el draft.",
  };
}

function lanePlanFor(brawler: Brawler, countersHit: string[], exposedTo: string[], input: DraftInput): LanePlan {
  const lane = lineFor(brawler, input);
  const target = countersHit[0];
  const avoid = exposedTo[0];
  if (target) return { lane, target, avoid, instruction: `Busca a ${target}; si cambia de carril, rota para conservar el matchup favorable.` };
  if (avoid) return { lane, avoid, instruction: `Evita a ${avoid}. Juega con cobertura aliada y cambia de línea en la primera pausa segura.` };
  return { lane, instruction: input.position === "First pick" ? "No fuerces una línea extrema: conserva flexibilidad hasta ver el counter rival." : "Ocupa la línea que mejor complete el emparejamiento del equipo." };
}

function planFor(brawler: Brawler, countersHit: string[], exposedTo: string[], input: DraftInput) {
  if (countersHit.length) return `Busca la línea de ${countersHit[0]} y fuerza ese matchup. ${input.map.plan}`;
  if (exposedTo.length) return `Evita emparejarte directamente con ${exposedTo[0]}; rota de línea y juega con cobertura aliada. ${input.map.plan}`;
  if (input.position === "First pick") return `Juega de forma estable y evita revelar una condición de victoria frágil. ${input.map.plan}`;
  if (input.position === "Last pick") return `Usa la información completa del rival para imponer la línea favorable. ${input.map.plan}`;
  return input.map.plan;
}

function coversNeed(brawler: Brawler, need: string) {
  return (
    (need === "Antitanque" && isAntitank(brawler)) ||
    (need === "Antidive / peel" && isAntidive(brawler)) ||
    (need === "Acceso contra artilleros" && (brawler.role === "Asesino" || hasTag(brawler, "mobile"))) ||
    (need === "Rango largo" && isLongRange(brawler)) ||
    (need === "Presencia de primera línea" && isFrontline(brawler)) ||
    (need === "Control de espacio" && isControl(brawler)) ||
    (need === "Daño al objetivo" && isObjective(brawler)) ||
    (need === "Mid / portador estable" && (hasTag(brawler, "mid", "safe") || isSupport(brawler) || isLongRange(brawler))) ||
    (need === "Presión y movilidad" && isFrontline(brawler)) ||
    (need === "Negación de zona" && isControl(brawler)) ||
    (need === "Daño seguro a distancia" && (isLongRange(brawler) || hasTag(brawler, "safe"))) ||
    (need === "Visión de arbustos" && hasVision(brawler)) ||
    (need === "Ruptura de muros" && hasWallbreak(brawler)) ||
    (need === "Carry con daño propio" && (hasTag(brawler, "carry") || isObjective(brawler))) ||
    (need === "Protección del backline" && isAntidive(brawler))
  );
}


function softCounterReason(candidate: Brawler, enemy: Brawler, input: DraftInput) {
  if (isAntitank(candidate) && (enemy.role === "Tanque" || hasTag(enemy, "tank", "tanque"))) return "antitanque";
  if (isAntidive(candidate) && (enemy.role === "Asesino" || hasTag(enemy, "assassin", "asesino", "mobile"))) return "antidive";
  if ((candidate.role === "Asesino" || hasTag(candidate, "mobile")) && isThrower(enemy)) return "acceso contra artillero";
  if (hasWallbreak(candidate) && isThrower(enemy) && input.map.traits.some((trait) => trait.includes("muro") || trait.includes("cobertura"))) return "rompe su cobertura";
  if (input.map.layout === "Abierto" && isLongRange(candidate) && isShortRange(enemy)) return "ventaja de rango";
  if (["Zona Restringida", "Balón Brawl"].includes(input.map.mode) && isControl(candidate) && isShortRange(enemy)) return "controla su entrada";
  return undefined;
}

function finalCounterWeightedScore(
  input: DraftInput,
  metrics: DraftRecommendation["metrics"],
  enemies: Brawler[],
  directCount: number,
  softCount: number,
  exposedCount: number,
) {
  // First pick: mapa, seguridad y flexibilidad. No buscamos un counter a ciegas.
  if (input.position === "First pick") {
    return clamp(
      metrics.meta * .15 +
      metrics.mapFit * .34 +
      metrics.safety * .27 +
      metrics.composition * .12 +
      metrics.synergy * .06 +
      metrics.personal * .05 +
      metrics.counter * .01 -
      Math.max(0, metrics.risk - 35) * .20
    );
  }

  if (!enemies.length) {
    return clamp(
      metrics.meta * .16 +
      metrics.mapFit * .26 +
      metrics.safety * .20 +
      metrics.composition * .18 +
      metrics.synergy * .10 +
      metrics.personal * .07 +
      metrics.counter * .03 -
      Math.max(0, metrics.risk - 35) * .16
    );
  }

  const priority = input.priority || "Counter";
  const isLastPick = input.position === "Last pick";
  const weights = isLastPick
    ? { meta: .12, counter: .44, map: .10, composition: .15, synergy: .06, safety: .06, personal: .07, risk: .26 }
    : priority === "Seguro"
      ? { meta: .15, counter: .24, map: .18, composition: .17, synergy: .08, safety: .14, personal: .04, risk: .16 }
      : priority === "Equilibrado"
        ? { meta: .14, counter: .30, map: .17, composition: .17, synergy: .08, safety: .09, personal: .05, risk: .18 }
        : { meta: .14, counter: .34, map: .16, composition: .18, synergy: .06, safety: .07, personal: .05, risk: .20 };

  const coverageBonus = isLastPick
    ? directCount >= 3 ? 11 : directCount === 2 ? 7 : directCount === 1 ? 3 : softCount >= 2 ? 2 : 0
    : directCount >= 3 ? 8 : directCount === 2 ? 5 : directCount === 1 ? 2 : softCount >= 2 ? 1 : 0;
  const exposurePenalty = exposedCount * (isLastPick ? 5 : 3);
  const noAnswerPenalty = directCount === 0 && softCount === 0 && enemies.length >= 2
    ? isLastPick ? 10 : 6
    : 0;

  return clamp(
    metrics.meta * weights.meta +
    metrics.counter * weights.counter +
    metrics.mapFit * weights.map +
    metrics.composition * weights.composition +
    metrics.synergy * weights.synergy +
    metrics.safety * weights.safety +
    metrics.personal * weights.personal -
    Math.max(0, metrics.risk - 35) * weights.risk +
    coverageBonus -
    exposurePenalty -
    noAnswerPenalty
  );
}

function scoreCandidate(brawler: Brawler, input: DraftInput, allies: Brawler[], enemies: Brawler[], needs: string[]): DraftRecommendation {
  let score = tierScore[brawler.tier] ?? 41;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const countersHit: string[] = [];
  const softCounters: string[] = [];
  const exposedTo: string[] = [];

  let mapFit = 45;
  let meta = tierMetric[brawler.tier] ?? 48;
  let counter = 50;
  let synergy = 50;
  let safety = 50;
  let composition = 50;
  let personal = 50;
  let risk = 35;

  const matchupMultiplier =
    input.position === "Last pick" ? 1.28 :
    input.position === "Pick intermedio" ? 1 :
    .62;
  const exposureMultiplier =
    input.position === "Last pick" ? 1.22 :
    input.position === "Pick intermedio" ? 1 :
    .72;

  const modeScore = brawler.modes[input.map.mode] ?? 0;
  score += modeScore * 1.55;
  mapFit += modeScore * 4;
  if (modeScore >= 8) reasons.push(`Afinidad alta con ${input.map.mode}`);

  const postPatch = update69DraftAdjustment(brawler, input.map, input.position);
  score += postPatch.score;
  meta += postPatch.meta;
  reasons.push(...postPatch.reasons);
  warnings.push(...postPatch.warnings);

  const sIndex = input.map.tierS.indexOf(brawler.name);
  const aIndex = input.map.tierA.indexOf(brawler.name);
  const firstPickIndex = input.map.firstPicks.indexOf(brawler.name);
  const firstPickEvaluation = input.position === "First pick"
    ? evaluateFirstPick(brawler, input.map)
    : undefined;
  if (sIndex >= 0) {
    const mapBonus =
      input.position === "First pick" ? 17 - sIndex * 1.4 :
      input.position === "Pick intermedio" ? 8 - sIndex * .7 :
      4 - sIndex * .35;
    score += Math.max(1, mapBonus);
    mapFit += input.position === "First pick"
      ? 24 - sIndex * 2
      : input.position === "Pick intermedio"
        ? 13 - sIndex
        : 8 - sIndex * .6;
    reasons.push("Tier S editorial del mapa");
  } else if (aIndex >= 0) {
    const mapBonus =
      input.position === "First pick" ? 10 - aIndex :
      input.position === "Pick intermedio" ? 4 - aIndex * .35 :
      2 - aIndex * .18;
    score += Math.max(.5, mapBonus);
    mapFit += input.position === "First pick"
      ? 14 - aIndex
      : input.position === "Pick intermedio"
        ? 7 - aIndex * .5
        : 4 - aIndex * .25;
    reasons.push("Tier A editorial del mapa");
  }

  if (firstPickEvaluation) {
    const modelBonus = (firstPickEvaluation.score - 50) * .72;
    score += modelBonus;
    const editorialFitBonus = firstPickIndex >= 0
      ? Math.max(6, 12 - firstPickIndex * 2)
      : sIndex >= 0
        ? Math.max(3, 8 - sIndex)
        : aIndex >= 0
          ? Math.max(1, 4 - aIndex * .5)
          : 0;
    mapFit = clamp(firstPickEvaluation.expectedMapFit + editorialFitBonus);
    safety = Math.round(firstPickEvaluation.blindQuality * .82 + safety * .18);
    risk = clamp(
      100 - firstPickEvaluation.blindQuality +
      (brawler.firstPickProfile?.counterRisk || 50) * .18
    );

    reasons.push(...firstPickEvaluation.strengths);
    warnings.push(...firstPickEvaluation.risks);

    if (firstPickIndex >= 0) {
      score += Math.max(0, 4 - firstPickIndex);
      safety += Math.max(1, 4 - firstPickIndex);
      reasons.push(`Top estructural ${firstPickIndex + 1} del mapa`);
    }

    if (firstPickEvaluation.afterBreakFit >= 76 && firstPickEvaluation.openingProbability >= 45) {
      reasons.push("Conserva valor si la partida abre el mapa");
    }
    if (firstPickEvaluation.afterBreakFit >= firstPickEvaluation.initialFit + 18 && firstPickEvaluation.openingProbability < 30) {
      mapFit -= 5;
      risk += 8;
      warnings.push("Depende de una apertura del mapa que no está garantizada");
    }
  }
  if (input.position === "Pick intermedio" && (hasTag(brawler, "safe", "control") || isControl(brawler))) {
    score += 4;
    safety += 8;
  }
  if (input.position === "Last pick" && (hasTag(brawler, "lastpick", "assassin") || brawler.role === "Asesino" || isFrontline(brawler))) {
    score += 9;
    counter += 8;
    reasons.push("Escala como counterpick");
  }

  for (const enemy of enemies) {
    const directCounter = includesName(brawler.counters, enemy.name);
    const reciprocalCounter = includesName(enemy.counteredBy, brawler.name);
    const directlyExposed = includesName(brawler.counteredBy, enemy.name);
    const enemyClaimsCounter = includesName(enemy.counters, brawler.name);

    if (directCounter) {
      const counterBreadth = brawler.counters.length;
      const specificity =
        counterBreadth >= 8 ? .70 :
        counterBreadth >= 6 ? .82 :
        counterBreadth >= 4 ? .92 :
        1;
      score += Math.round(24 * matchupMultiplier * specificity);
      counter += Math.round(32 * matchupMultiplier * specificity);
      countersHit.push(enemy.name);
      reasons.push(`Counter directo de ${enemy.name}`);
    } else if (reciprocalCounter) {
      score += Math.round(11 * matchupMultiplier);
      counter += Math.round(16 * matchupMultiplier);
      countersHit.push(enemy.name);
      reasons.push(`Matchup favorable contra ${enemy.name}`);
    } else {
      const softReason = softCounterReason(brawler, enemy, input);
      if (softReason) {
        score += Math.round(8 * matchupMultiplier);
        counter += Math.round(12 * matchupMultiplier);
        softCounters.push(enemy.name);
        reasons.push(`${softReason} frente a ${enemy.name}`);
      }
    }

    if (directlyExposed) {
      score -= Math.round(27 * exposureMultiplier);
      counter -= Math.round(38 * exposureMultiplier);
      safety -= Math.round(18 * exposureMultiplier);
      risk += Math.round(34 * exposureMultiplier);
      exposedTo.push(enemy.name);
      warnings.push(`${enemy.name} lo frena claramente`);
    } else if (enemyClaimsCounter) {
      score -= Math.round(13 * exposureMultiplier);
      counter -= Math.round(19 * exposureMultiplier);
      safety -= Math.round(8 * exposureMultiplier);
      risk += Math.round(16 * exposureMultiplier);
      exposedTo.push(enemy.name);
      warnings.push(`${enemy.name} tiene ventaja`);
    }
  }

  const directCoverage = unique(countersHit).length;
  const softCoverage = unique(softCounters).filter((name) => !includesName(countersHit, name)).length;
  if (directCoverage >= 2) {
    const stageBonus = input.position === "Last pick" ? 1.35 : 1;
    score += Math.round((directCoverage === 3 ? 22 : 14) * stageBonus);
    counter += Math.round((directCoverage === 3 ? 24 : 16) * stageBonus);
    reasons.push(`Counterea ${directCoverage} picks rivales`);
  }
  if (input.position === "Last pick" && directCoverage >= 1) {
    score += 8;
    counter += 10;
    reasons.push("Aprovecha la información completa del last pick");
  }
  if (directCoverage === 0 && softCoverage === 0 && enemies.length >= 2) {
    const penalty = input.position === "Last pick" ? 16 : 9;
    score -= penalty;
    counter -= input.position === "Last pick" ? 20 : 12;
    warnings.push(input.position === "Last pick" ? "Desaprovecha el last pick: no castiga al rival" : "No castiga directamente la composición rival");
  }

  const enemyHasTank = enemies.some((enemy) => enemy.role === "Tanque" || hasTag(enemy, "tank", "tanque"));
  const enemyHasDive = enemies.some((enemy) => enemy.role === "Asesino" || hasTag(enemy, "assassin", "asesino", "mobile"));
  const enemyHasThrower = enemies.some(isThrower);

  if (enemyHasTank && isAntitank(brawler)) {
    const alreadyCountersTank = countersHit.some((name) => {
      const enemy = enemies.find((item) => item.name === name);
      return enemy?.role === "Tanque" || Boolean(enemy && hasTag(enemy, "tank", "tanque"));
    });
    score += alreadyCountersTank ? 5 : 12;
    counter += alreadyCountersTank ? 7 : 17;
    composition += 8;
    reasons.push("Cubre antitanque");
  }
  if (enemyHasDive && isAntidive(brawler)) {
    const alreadyCountersDive = countersHit.some((name) => {
      const enemy = enemies.find((item) => item.name === name);
      return enemy?.role === "Asesino" || Boolean(enemy && hasTag(enemy, "assassin", "asesino", "mobile"));
    });
    score += alreadyCountersDive ? 5 : 13;
    counter += alreadyCountersDive ? 7 : 18;
    composition += 9;
    reasons.push("Protege frente a dive");
  }
  if (enemyHasThrower && (brawler.role === "Asesino" || hasTag(brawler, "mobile"))) {
    const alreadyCountersThrower = countersHit.some((name) => {
      const enemy = enemies.find((item) => item.name === name);
      return Boolean(enemy && isThrower(enemy));
    });
    score += alreadyCountersThrower ? 4 : 10;
    counter += alreadyCountersThrower ? 6 : 14;
    reasons.push("Acceso contra artilleros");
  }

  if (input.map.layout === "Abierto" && isLongRange(brawler)) {
    score += 8; mapFit += 15; reasons.push("Aprovecha el mapa abierto");
  }
  if (input.map.layout === "Abierto" && (brawler.role === "Tanque" || isThrower(brawler)) && !hasTag(brawler, "safe")) {
    score -= 7; mapFit -= 12; risk += 9;
  }
  if (input.map.layout === "Cerrado" && (isFrontline(brawler) || isThrower(brawler) || hasTag(brawler, "walls"))) {
    score += 7; mapFit += 13; reasons.push("Aprovecha cobertura y pasillos");
  }

  const allyRoles = allies.map((ally) => ally.role);
  const duplicateRoleCount = allyRoles.filter((role) => role === brawler.role).length;
  if (!allyRoles.includes(brawler.role)) {
    score += 3; synergy += 8;
  } else if (duplicateRoleCount >= 1) {
    score -= 3 * duplicateRoleCount; synergy -= 7 * duplicateRoleCount;
  }

  if (allies.length && allies.every(isLongRange) && (isControl(brawler) || isFrontline(brawler))) {
    score += 7; synergy += 13; composition += 12; reasons.push("Equilibra un backline de rango");
  }
  if (allies.some(isSupport) && (brawler.role === "Tanque" || brawler.role === "Asesino" || hasTag(brawler, "carry"))) {
    score += 4; synergy += 9; reasons.push("Aprovecha el soporte aliado");
  }
  if (allies.some(isThrower) && isAntidive(brawler)) {
    score += 6; synergy += 11; reasons.push("Protege al artillero aliado");
  }

  const coveredNeeds = needs.filter((need) => coversNeed(brawler, need));
  coveredNeeds.forEach((need, index) => {
    const scoreBonus = index === 0 ? 7 : index === 1 ? 4 : index === 2 ? 2 : 0;
    const compositionBonus = index === 0 ? 15 : index === 1 ? 9 : index === 2 ? 4 : 0;
    score += scoreBonus;
    composition += compositionBonus;
    if (index < 3) reasons.push(`Cubre: ${need}`);
  });
  if (coveredNeeds.length >= 4) {
    warnings.push("Cubre muchas funciones, pero no debe desplazar un counter más específico");
  }

  const queueMode = input.queueMode || "SoloQ";
  const teamDependence = brawler.firstPickProfile?.teamDependence
    ?? (isSupport(brawler) ? 72 : hasTag(brawler, "carry", "safe") ? 30 : 48);
  const autonomy = 100 - teamDependence;

  if (queueMode === "SoloQ") {
    const autonomyAdjustment = Math.round((autonomy - 50) * .12);
    score += autonomyAdjustment;
    safety += Math.round((autonomy - 50) * .16);
    risk += Math.round((teamDependence - 50) * .14);

    if (isSupport(brawler) && !hasTag(brawler, "carry", "damage")) {
      score -= allies.length ? 5 : 9;
      composition -= allies.length ? 2 : 7;
      warnings.push("En SoloQ depende de que los aliados conviertan su utilidad");
    }
    if (hasTag(brawler, "carry", "safe") || brawler.firstPickProfile?.blindSafety && brawler.firstPickProfile.blindSafety >= 76) {
      score += 4;
      safety += 6;
      reasons.push("Autosuficiente para SoloQ");
    }
  } else if (queueMode === "Dúo") {
    score += Math.round((autonomy - 50) * .04);
    if (allies.length && isSupport(brawler)) {
      score += 3;
      synergy += 6;
      reasons.push("Puede coordinarse con tu compañero de dúo");
    }
  } else {
    if (isSupport(brawler)) {
      score += allies.length ? 8 : 4;
      synergy += allies.length ? 14 : 8;
      composition += 7;
      reasons.push("La coordinación de trío aumenta su valor");
    }
    if (teamDependence >= 65) {
      score += 4;
      synergy += 7;
      risk -= 6;
      reasons.push("La premade reduce su dependencia de coordinación");
    }
    if (allies.some(isSupport) && (isFrontline(brawler) || hasTag(brawler, "carry", "damage"))) {
      score += 5;
      synergy += 10;
      reasons.push("Convierte la utilidad del soporte coordinado");
    }
  }

  const poolEntry = input.personalPool?.[brawler.slug];
  const poolPolicy = input.poolPolicy || (input.usePersonalPool ? "Solo pool" : "Off");
  if (poolPolicy !== "Off" && poolEntry) {
    if (poolEntry.available) { score += 2; personal += 7; }
    else { score -= poolPolicy === "Solo pool" ? 45 : 13; personal -= 20; warnings.push("No disponible en tu pool"); }
    if (poolEntry.power11) { score += 5; personal += 13; reasons.push("Fuerza 11 en tu pool"); }
    if (poolEntry.hypercharge) { score += 4; personal += 9; reasons.push("Hipercarga disponible"); }
    if (poolEntry.favorite) { score += 5; personal += 12; reasons.push("Brawler prioritario de tu pool"); }
    if (poolEntry.mastery > 3) { score += (poolEntry.mastery - 3) * 4; personal += (poolEntry.mastery - 3) * 13; reasons.push(`Dominio personal ${poolEntry.mastery}/5`); }
    if (poolEntry.mastery <= 2) { score -= 6; personal -= 16; warnings.push("Dominio personal bajo"); }
    if (poolEntry.avoid) { score -= poolPolicy === "Solo pool" ? 55 : 28; personal = 0; warnings.push("Marcado para evitar en tu pool"); }
  }

  const learned = input.learnFromHistory
    ? personalAdjustment(brawler.slug, input.map.slug, input.personalPerformance)
    : { adjustment: 0, brawler: undefined, map: undefined };
  if (learned.adjustment) {
    score += learned.adjustment;
    personal += learned.adjustment * 2.8;
    if (learned.adjustment >= 2) reasons.push(`Buen rendimiento personal: +${Math.round(learned.adjustment)} puntos`);
    if (learned.adjustment <= -2) warnings.push(`Tu historial personal penaliza este pick: ${Math.round(learned.adjustment)} puntos`);
  }
  if (learned.map && learned.map.games >= 3) {
    reasons.push(`${learned.map.winRate}% en ${input.map.name} con ${brawler.name} (${learned.map.games} partidas)`);
  } else if (learned.brawler && learned.brawler.games >= 3) {
    reasons.push(`${learned.brawler.winRate}% personal con ${brawler.name} (${learned.brawler.games} partidas)`);
  }

  if (hasTag(brawler, "safe")) safety += 13;
  if (hasTag(brawler, "carry")) synergy += 5;
  if (brawler.profileComplete) safety += 4;
  if (!brawler.profileComplete) { score -= 4; safety -= 6; risk += 6; }

  const direct = unique(countersHit);
  const soft = unique(softCounters).filter((name) => !includesName(direct, name));
  const exposed = unique(exposedTo);
  const covered = new Set([...direct, ...soft].map(norm));
  const uncoveredEnemies = enemies
    .map((enemy) => enemy.name)
    .filter((name) => !covered.has(norm(name)) && !includesName(exposed, name));

  const metrics = {
    meta: clamp(meta),
    mapFit: clamp(mapFit),
    counter: clamp(counter),
    synergy: clamp(synergy),
    safety: clamp(safety),
    composition: clamp(composition),
    personal: clamp(personal),
    risk: clamp(risk),
  };
  const finalScore = finalCounterWeightedScore(input, metrics, enemies, direct.length, soft.length, exposed.length);
  const counterLabel =
    direct.length >= 2 ? `Counter múltiple · ${direct.length}/${enemies.length}` :
    direct.length === 1 ? "Counter directo" :
    soft.length >= 2 ? "Respuesta favorable múltiple" :
    soft.length === 1 ? "Respuesta de arquetipo" :
    exposed.length ? "Matchup arriesgado" :
    enemies.length ? "Neutral frente al rival" : "Pick flexible";

  const warning = warnings.length
    ? unique(warnings).slice(0, 2).join(" · ")
    : !brawler.profileComplete
      ? "Build exacta pendiente de validación; se muestra una recomendación táctica"
      : undefined;
  const brief = direct.length
    ? `Frena a ${direct.slice(0, 2).join(" y ")}${direct.length > 2 ? ` y ${direct.length - 2} más` : ""}. ${exposed.length ? `Evita a ${exposed[0]}.` : "Busca su línea."}`
    : soft.length
      ? `Respuesta favorable contra ${soft.slice(0, 2).join(" y ")}. ${exposed.length ? `${exposed[0]} puede frenarlo.` : "Gana valor por arquetipo."}`
      : exposed.length
        ? `No es un counter limpio: ${exposed[0]} lo frena.`
        : `${reasons[0] || "Pick flexible"}. ${enemies.length ? "No obtiene ventaja directa de matchup." : reasons[1] || "Mantiene opciones abiertas."}`;

  const matchups = enemies.map((enemy) => {
    const hasDirect = includesName(direct, enemy.name);
    const hasSoft = includesName(soft, enemy.name);
    const isExposed = includesName(exposed, enemy.name);
    if (hasDirect && isExposed) return { enemy: enemy.name, verdict: "Riesgo" as const, score: 42, reason: "Datos cruzados: puede castigarlo, pero también queda expuesto" };
    if (hasDirect) return { enemy: enemy.name, verdict: "Ventaja clara" as const, score: 85, reason: "Counter directo o matchup favorable validado" };
    if (hasSoft) return { enemy: enemy.name, verdict: "Ventaja" as const, score: 68, reason: "Ventaja por rango, función o arquetipo" };
    if (isExposed) return { enemy: enemy.name, verdict: "Desventaja" as const, score: 25, reason: `${enemy.name} dispone de una respuesta clara` };
    return { enemy: enemy.name, verdict: "Neutral" as const, score: 50, reason: "Sin ventaja directa confirmada" };
  });

  return {
    brawler,
    score: finalScore,
    reasons: unique(reasons).slice(0, 8),
    brief,
    warning,
    metrics,
    countersHit: direct,
    softCounters: soft,
    exposedTo: exposed,
    uncoveredEnemies,
    matchups,
    counterLabel,
    suggestedLine: lineFor(brawler, input),
    plan: planFor(brawler, direct.length ? direct : soft, exposed, input),
    personalHistory: learned.brawler,
    personalMapHistory: learned.map,
    personalAdjustment: Math.round(learned.adjustment * 10) / 10,
    build: tacticalBuild(brawler, input, enemies),
    lanePlan: lanePlanFor(brawler, direct.length ? direct : soft, exposed, input),
    firstPickEvaluation,
  };
}

function banRecommendations(input: DraftInput, roster: Brawler[], allies: Brawler[]): BanRecommendation[] {
  const excluded = new Set([...input.allies, ...input.enemies, ...input.bans, input.myPick || ""].filter(Boolean).map(norm));
  return roster
    .filter((brawler) => !excluded.has(norm(brawler.name)))
    .map((brawler) => {
      let score = 25;
      const reasons: string[] = [];
      const mapBanIndex = input.map.bans.indexOf(brawler.name);
      const tierIndex = input.map.tierS.indexOf(brawler.name);
      if (mapBanIndex >= 0) { score += 35 - mapBanIndex * 5; reasons.push("Ban prioritario del mapa"); }
      if (tierIndex >= 0) { score += 18 - tierIndex * 2; reasons.push("Tier S del mapa"); }
      const threatened = allies.filter((ally) => includesName(ally.counteredBy, brawler.name));
      if (threatened.length) { score += threatened.length * 17; reasons.push(`Protege a ${threatened.map((ally) => ally.name).join(" y ")}`); }
      if (input.position === "First pick" && (isLongRange(brawler) || isControl(brawler))) score += 4;
      return { brawler, score: clamp(score), reasons: unique(reasons).slice(0, 3) };
    })
    .filter((item) => item.score >= 42)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function predictEnemyPicks(input: DraftInput, roster: Brawler[], allies: Brawler[], enemies: Brawler[]): EnemyPickPrediction[] {
  const excluded = new Set([...input.allies, ...input.enemies, ...input.bans, input.myPick || ""].filter(Boolean).map(norm));
  const enemyRoles = enemies.map((enemy) => enemy.role);
  const alliedTank = allies.some((ally) => ally.role === "Tanque" || hasTag(ally, "tank", "tanque"));
  const alliedDive = allies.some((ally) => ally.role === "Asesino" || hasTag(ally, "assassin", "asesino", "mobile"));
  const enemyNeedsControl = !enemies.some(isControl);
  const enemyNeedsAntitank = alliedTank && !enemies.some(isAntitank);
  const enemyNeedsAntidive = alliedDive && !enemies.some(isAntidive);

  return roster
    .filter((brawler) => !excluded.has(norm(brawler.name)))
    .map((brawler) => {
      let score = tierScore[brawler.tier] ?? 40;
      const reasons: string[] = [];
      const tierIndex = input.map.tierS.indexOf(brawler.name);
      const aIndex = input.map.tierA.indexOf(brawler.name);

      if (tierIndex >= 0) {
        score += 18 - tierIndex * 2;
        reasons.push("Prioridad natural del mapa");
      } else if (aIndex >= 0) {
        score += 9 - aIndex;
        reasons.push("Buen encaje con el mapa");
      }

      const targets = allies.filter((ally) =>
        includesName(brawler.counters, ally.name) ||
        includesName(ally.counteredBy, brawler.name)
      );
      if (targets.length) {
        score += targets.length * 16;
        reasons.unshift(`Puede castigar a ${targets.map((ally) => ally.name).slice(0, 2).join(" y ")}`);
      }

      if (enemyNeedsAntitank && isAntitank(brawler)) {
        score += 12;
        reasons.push("Completa el antitanque rival");
      }
      if (enemyNeedsAntidive && isAntidive(brawler)) {
        score += 11;
        reasons.push("Protege su backline");
      }
      if (enemyNeedsControl && isControl(brawler) && ["Zona Restringida", "Atrapagemas", "Balón Brawl"].includes(input.map.mode)) {
        score += 8;
        reasons.push("Añade control de espacio");
      }
      if (input.map.mode === "Atraco" && isObjective(brawler)) {
        score += 8;
        reasons.push("Aporta presión a la caja");
      }
      if (input.map.layout === "Abierto" && isLongRange(brawler)) score += 7;
      if (input.map.layout === "Cerrado" && (isFrontline(brawler) || isThrower(brawler))) score += 6;
      if (enemies.some(isSupport) && isFrontline(brawler)) score += 5;

      const repeatedRole = enemyRoles.filter((role) => role === brawler.role).length;
      if (repeatedRole >= 2) score -= 10;
      else if (repeatedRole === 1 && ["Apoyo", "Artillero"].includes(brawler.role)) score -= 5;

      const target = targets[0]?.name;
      const response = brawler.counteredBy.find((name) => !excluded.has(norm(name)))
        || "Reserva un pick seguro que cubra su arquetipo";

      return {
        brawler,
        score: clamp(score),
        target,
        reason: unique(reasons)[0] || "Completa el draft rival con flexibilidad",
        response,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function laneAssignments(candidate: Brawler | undefined, allies: Brawler[], enemies: Brawler[], input: DraftInput): TeamAssignment[] {
  const team = candidate ? [...allies, candidate].slice(0, 3) : allies.slice(0, 3);
  if (!team.length) return [];
  const remaining = [...enemies];
  const mids = team.filter((ally) => isSupport(ally) || isControl(ally) || (input.map.mode === "Atrapagemas" && isLongRange(ally)));
  const preferredMid = mids[0];
  const laneByName = new Map<string, string>();
  if (preferredMid) laneByName.set(preferredMid.name, "Centro");
  const sidePlayers = team.filter((ally) => ally.name !== preferredMid?.name);
  sidePlayers.forEach((ally, index) => laneByName.set(ally.name, index === 0 ? "Izquierda" : "Derecha"));
  if (!preferredMid && team.length === 3) laneByName.set(team[1].name, "Centro");

  return team.map((ally) => {
    let bestEnemy: Brawler | undefined;
    let bestScore = -999;
    remaining.forEach((enemy) => {
      let matchup = 0;
      if (includesName(ally.counters, enemy.name)) matchup += 5;
      if (includesName(ally.counteredBy, enemy.name)) matchup -= 6;
      if (isAntitank(ally) && enemy.role === "Tanque") matchup += 4;
      if (isAntidive(ally) && enemy.role === "Asesino") matchup += 4;
      if (matchup > bestScore) { bestScore = matchup; bestEnemy = enemy; }
    });
    if (bestEnemy) remaining.splice(remaining.indexOf(bestEnemy), 1);
    const lane = laneByName.get(ally.name) || "Línea flexible";
    const instruction = bestEnemy
      ? bestScore >= 3
        ? `Busca a ${bestEnemy.name} y conserva esa línea.`
        : bestScore <= -3
          ? `Evita a ${bestEnemy.name}; cambia con un compañero.`
          : `Matchup equilibrado contra ${bestEnemy.name}; gana por munición y posición.`
      : lineFor(ally, input);
    return { ally: ally.name, enemy: bestEnemy?.name, lane, instruction };
  });
}

function compositionScore(allies: Brawler[], candidate: Brawler | undefined, needs: string[]) {
  const team = candidate ? [...allies, candidate] : allies;
  if (!team.length) return 50;
  let score = 60;
  const roles = new Set(team.map((item) => item.role));
  score += roles.size * 6;
  score -= needs.length * 5;
  if (team.some(isControl)) score += 5;
  if (team.some(isAntidive)) score += 5;
  if (team.some(isAntitank)) score += 5;
  if (team.filter(isSupport).length >= 2) score -= 12;
  if (team.filter(isLongRange).length === 3) score -= 10;
  return clamp(score);
}


function brawlerMapStrength(brawler: Brawler, input: DraftInput) {
  let score = tierScore[brawler.tier] ?? 41;
  score += (brawler.modes[input.map.mode] ?? 0) * 2;

  const sIndex = input.map.tierS.indexOf(brawler.name);
  const aIndex = input.map.tierA.indexOf(brawler.name);
  if (sIndex >= 0) score += 18 - sIndex * 1.8;
  else if (aIndex >= 0) score += 10 - aIndex * 1.2;

  if (input.map.layout === "Abierto") {
    if (isLongRange(brawler)) score += 7;
    if (isShortRange(brawler) && !hasTag(brawler, "mobile", "safe")) score -= 5;
  }
  if (input.map.layout === "Cerrado") {
    if (isFrontline(brawler) || isThrower(brawler) || hasTag(brawler, "walls")) score += 6;
    if (isLongRange(brawler) && !hasTag(brawler, "safe")) score -= 2;
  }
  if (input.map.mode === "Atraco" && isObjective(brawler)) score += 6;
  if (input.map.mode === "Zona Restringida" && isControl(brawler)) score += 5;
  if (input.map.mode === "Balón Brawl" && isFrontline(brawler)) score += 4;
  return clamp(score);
}

function paddedAverage(values: number[], totalSlots = 3) {
  const filled = values.slice(0, totalSlots);
  const total = filled.reduce((sum, value) => sum + value, 0) + Math.max(0, totalSlots - filled.length) * 50;
  return total / totalSlots;
}

function teamCompositionQuality(team: Brawler[], input: DraftInput) {
  if (!team.length) return 50;
  let score = 48;
  score += new Set(team.map((brawler) => brawler.role)).size * 5;
  if (team.some(isControl)) score += 6;
  if (team.some(isAntidive)) score += 6;
  if (team.some(isAntitank)) score += 6;
  if (team.some(hasWallbreak) && input.map.traits.some((trait) => trait.includes("muro"))) score += 4;
  if (input.map.layout === "Abierto" && team.some(isLongRange)) score += 5;
  if (input.map.layout === "Cerrado" && team.some(isFrontline)) score += 5;
  if (input.map.mode === "Atraco" && team.some(isObjective)) score += 7;
  if (input.map.mode === "Zona Restringida" && team.some(isControl)) score += 6;
  if (input.map.mode === "Atrapagemas" && team.some((brawler) => isSupport(brawler) || isControl(brawler) || isLongRange(brawler))) score += 4;
  if (team.filter(isSupport).length >= 2) score -= 12;
  if (team.filter(isLongRange).length === 3) score -= 9;
  if (team.filter(isShortRange).length === 3 && input.map.layout === "Abierto") score -= 12;
  if (team.filter(isThrower).length >= 2) score -= 7;
  return clamp(score);
}

function matchupQuality(team: Brawler[], opponents: Brawler[]) {
  if (!team.length || !opponents.length) return 50;
  let edge = 0;
  for (const ally of team) {
    for (const enemy of opponents) {
      if (includesName(ally.counters, enemy.name)) edge += 6;
      if (includesName(ally.counteredBy, enemy.name)) edge -= 7;
      if (includesName(enemy.counteredBy, ally.name)) edge += 3;
      if (includesName(enemy.counters, ally.name)) edge -= 3;
      if (isAntitank(ally) && enemy.role === "Tanque") edge += 2;
      if (isAntidive(ally) && enemy.role === "Asesino") edge += 2;
    }
  }
  return clamp(50 + edge);
}

function estimateWinProbability(input: DraftInput, allies: Brawler[], enemies: Brawler[]): WinEstimate | undefined {
  if (allies.length === 0 || enemies.length === 0) return undefined;

  const allyBase = paddedAverage(allies.map((brawler) => brawlerMapStrength(brawler, input)));
  const enemyBase = paddedAverage(enemies.map((brawler) => brawlerMapStrength(brawler, input)));
  const allyComposition = teamCompositionQuality(allies, input);
  const enemyComposition = teamCompositionQuality(enemies, input);
  const allyMatchups = matchupQuality(allies, enemies);
  const enemyMatchups = matchupQuality(enemies, allies);

  let alliedScore = allyBase * 0.34 + allyComposition * 0.24 + allyMatchups * 0.42;
  let enemyScore = enemyBase * 0.34 + enemyComposition * 0.24 + enemyMatchups * 0.42;

  const selected = allies.find((brawler) => norm(brawler.name) === norm(input.myPick || ""));
  const poolEntry = selected ? input.personalPool?.[selected.slug] : undefined;
  const poolPolicy = input.poolPolicy || (input.usePersonalPool ? "Solo pool" : "Off");
  if (poolPolicy !== "Off" && poolEntry) {
    if (poolEntry.power11) alliedScore += 1.5;
    if (poolEntry.hypercharge) alliedScore += 1.2;
    if (poolEntry.favorite) alliedScore += .8;
    alliedScore += (poolEntry.mastery - 3) * 1.1;
    if (!poolEntry.available) alliedScore -= 2.5;
    if (poolEntry.avoid) alliedScore -= 5;
  }

  alliedScore = Math.max(0, Math.min(100, alliedScore));
  enemyScore = Math.max(0, Math.min(100, enemyScore));

  const delta = alliedScore - enemyScore;
  const rawProbability = 100 / (1 + Math.exp(-delta / 13));
  const visiblePicks = Math.min(6, allies.length + enemies.length);
  const completeness = Math.round((visiblePicks / 6) * 100);
  const shrinkFactor = 0.32 + 0.68 * (visiblePicks / 6);
  const percentage = Math.max(18, Math.min(82, Math.round(50 + (rawProbability - 50) * shrinkFactor)));

  const allComplete = [...allies, ...enemies].every((brawler) => brawler.profileComplete);
  const confidence: WinEstimate["confidence"] =
    visiblePicks === 6 && allComplete ? "Alta" :
    visiblePicks >= 5 ? "Media" : "Baja";
  const margin = confidence === "Alta" ? 5 : confidence === "Media" ? 9 : 14;

  const favorablePairs: string[] = [];
  const unfavorablePairs: string[] = [];
  for (const ally of allies) {
    for (const enemy of enemies) {
      if (includesName(ally.counters, enemy.name)) favorablePairs.push(`${ally.name} frena a ${enemy.name}`);
      if (includesName(ally.counteredBy, enemy.name)) unfavorablePairs.push(`${enemy.name} frena a ${ally.name}`);
    }
  }

  const advantages: string[] = [];
  const risks: string[] = [];
  if (allyBase >= enemyBase + 3) advantages.push("Mejor encaje medio con el mapa y el modo");
  if (allyComposition >= enemyComposition + 4) advantages.push("Composición aliada más equilibrada");
  if (allyMatchups >= enemyMatchups + 4) advantages.push("Ventaja global de matchups");
  advantages.push(...unique(favorablePairs).slice(0, 2));

  if (enemyBase >= allyBase + 3) risks.push("El rival tiene mejor adaptación media al mapa");
  if (enemyComposition >= allyComposition + 4) risks.push("La composición rival está más completa");
  if (enemyMatchups >= allyMatchups + 4) risks.push("El rival domina más emparejamientos directos");
  risks.push(...unique(unfavorablePairs).slice(0, 2));
  if (visiblePicks < 6) risks.push(`Estimación provisional: faltan ${6 - visiblePicks} picks por introducir`);

  const title = percentage >= 57 ? "Ventaja aliada" : percentage <= 43 ? "Ventaja rival" : "Draft equilibrado";

  return {
    percentage,
    lower: Math.max(10, percentage - margin),
    upper: Math.min(90, percentage + margin),
    confidence,
    completeness,
    alliedScore: Math.round(alliedScore),
    enemyScore: Math.round(enemyScore),
    title,
    advantages: unique(advantages).slice(0, 4),
    risks: unique(risks).slice(0, 4),
    disclaimer: "Estimación heurística del draft; no es un win rate observado ni garantiza el resultado de la partida.",
  };
}

function recommendationConfidence(
  input: DraftInput,
  recommendations: DraftRecommendation[],
  visiblePicks: number,
): DraftConfidence {
  const best = recommendations[0];
  const second = recommendations[1];
  const gap = best && second ? Math.max(0, best.score - second.score) : 0;
  const profileQuality = recommendations.slice(0, 3).filter((item) => item.brawler.profileComplete).length;
  const mapConfidence = input.map.firstPickConfidence === "Alta" ? 7 : input.map.firstPickConfidence === "Baja" ? -6 : 0;
  const information = input.position === "First pick" ? 2 : Math.min(15, visiblePicks * 3);
  const exposurePenalty = best ? best.exposedTo.length * 7 : 10;
  const score = clamp(48 + gap * 4 + profileQuality * 3 + mapConfidence + information - exposurePenalty);
  const label: DraftConfidence["label"] = score >= 75 ? "Alta" : score >= 58 ? "Media" : "Baja";
  const reasons: string[] = [];
  const cautions: string[] = [];

  if (gap >= 7) reasons.push(`Ventaja clara de ${gap} puntos sobre la segunda opción`);
  else if (gap >= 3) reasons.push(`Margen de ${gap} puntos sobre la alternativa`);
  else cautions.push("Las primeras opciones están muy igualadas");
  if (visiblePicks >= 5) reasons.push("El draft aporta casi toda la información de matchups");
  if (profileQuality === 3) reasons.push("Los tres candidatos principales tienen perfil completo");
  if (input.position === "First pick") cautions.push("Aún no se conocen los counters rivales");
  if (best?.exposedTo.length) cautions.push(`El pick principal queda expuesto a ${best.exposedTo.join(" y ")}`);
  if (
    best?.firstPickEvaluation &&
    best.firstPickEvaluation.afterBreakFit >= best.firstPickEvaluation.initialFit + 15 &&
    best.firstPickEvaluation.openingProbability < 30
  ) {
    cautions.push("Parte de su valor depende de que el campo se abra");
  }

  return { score, label, gap, reasons: unique(reasons).slice(0, 3), cautions: unique(cautions).slice(0, 3) };
}

function draftChecklist(input: DraftInput, allies: Brawler[], enemies: Brawler[]): DraftChecklistItem[] {
  const items: DraftChecklistItem[] = [];
  const add = (label: string, covered: boolean, partial: boolean, detail: string) => items.push({
    label,
    status: covered ? "Cubierto" : partial ? "Parcial" : "Falta",
    detail,
  });

  const roles = new Set(allies.map((ally) => ally.role));
  add("Diversidad de roles", roles.size >= Math.min(3, allies.length), roles.size >= 2, roles.size >= 2 ? `${roles.size} funciones distintas` : "Demasiados picks con la misma función");

  if (input.map.layout === "Abierto" || (input.map.geometry?.openness || 0) >= 60) {
    const ranged = allies.filter(isLongRange).length;
    add("Rango estable", ranged >= 1, ranged === 0 && allies.some(isControl), ranged ? `${ranged} opción${ranged > 1 ? "es" : ""} de rango largo` : "Falta alcance para las líneas iniciales");
  }
  if (["Zona Restringida", "Atrapagemas", "Balón Brawl"].includes(input.map.mode)) {
    add("Control de espacio", allies.some(isControl), allies.some(isSupport), allies.some(isControl) ? "Hay una herramienta clara de control" : "El modo exige disputar zonas y accesos");
  }
  if (enemies.some((enemy) => enemy.role === "Tanque" || hasTag(enemy, "tank", "tanque"))) {
    add("Respuesta antitanque", allies.some(isAntitank), allies.some(isControl), allies.some(isAntitank) ? "Daño sostenido contra primera línea" : "El rival puede avanzar sin castigo específico");
  }
  if (enemies.some((enemy) => enemy.role === "Asesino" || hasTag(enemy, "assassin", "asesino", "mobile"))) {
    add("Protección antidive", allies.some(isAntidive), allies.some(isFrontline), allies.some(isAntidive) ? "El backline dispone de peel" : "Falta una respuesta fiable a la entrada rival");
  }
  if (input.map.mode === "Atraco") {
    add("Daño al objetivo", allies.some(isObjective), allies.some((ally) => hasTag(ally, "damage")), allies.some(isObjective) ? "La composición amenaza la caja" : "Poca conversión sobre el objetivo");
  }

  const geometry = input.map.geometry;
  if (geometry && geometry.wallDensity >= 55 && geometry.destructibility >= 55) {
    const breakers = allies.filter(hasWallbreak).length;
    add(
      "Apertura del campo",
      breakers >= 1,
      geometry.destructibility >= 75,
      breakers >= 1
        ? `${breakers} herramienta${breakers > 1 ? "s" : ""} propia${breakers > 1 ? "s" : ""} para abrir muros`
        : "El mapa es rompible, pero tu composición no garantiza abrirlo",
    );
  }

  return items.slice(0, 6);
}

export function analyzeDraft(input: DraftInput, roster: Brawler[]): DraftAnalysis {
  const unavailable = new Set([...input.allies, ...input.enemies, ...input.bans, input.myPick || ""].filter(Boolean).map(norm));
  const enemies = findProfiles(input.enemies, roster);
  const otherAllies = findProfiles(input.allies, roster);
  const selectedProfile = input.myPick
    ? roster.find((brawler) => norm(brawler.name) === norm(input.myPick || ""))
    : undefined;
  const fullAllies = selectedProfile ? [...otherAllies, selectedProfile] : otherAllies;

  const recommendationNeeds = teamNeeds(input, otherAllies, enemies);
  const finalNeeds = teamNeeds(input, fullAllies, enemies);
  const threats = draftThreats(fullAllies, enemies);
  const strengths = draftStrengths(input, fullAllies, enemies);

  const recommendations = roster
    .filter((brawler) => !unavailable.has(norm(brawler.name)))
    .filter((brawler) => {
      const poolPolicy = input.poolPolicy || (input.usePersonalPool ? "Solo pool" : "Off");
      if (poolPolicy !== "Solo pool") return true;
      const entry = input.personalPool?.[brawler.slug];
      if (!entry) return false;
      return entry.available && !entry.avoid;
    })
    .map((brawler) => scoreCandidate(brawler, input, otherAllies, enemies, recommendationNeeds))
    .sort((a, b) => {
      if (input.position === "First pick") {
        const aCurated = input.map.firstPicks.indexOf(a.brawler.name);
        const bCurated = input.map.firstPicks.indexOf(b.brawler.name);
        return b.score - a.score ||
          (b.firstPickEvaluation?.expectedMapFit || 0) - (a.firstPickEvaluation?.expectedMapFit || 0) ||
          (aCurated < 0 ? 99 : aCurated) - (bCurated < 0 ? 99 : bCurated);
      }
      if (input.position === "Last pick" && enemies.length) {
        const aCoverage = a.countersHit.length * 4 + a.softCounters.length * 1.4 - a.exposedTo.length * 3;
        const bCoverage = b.countersHit.length * 4 + b.softCounters.length * 1.4 - b.exposedTo.length * 3;
        return b.score - a.score || bCoverage - aCoverage || b.metrics.counter - a.metrics.counter || a.metrics.risk - b.metrics.risk;
      }
      if (enemies.length) {
        const aCoverage = a.countersHit.length * 2.5 + a.softCounters.length - a.exposedTo.length * 1.5;
        const bCoverage = b.countersHit.length * 2.5 + b.softCounters.length - b.exposedTo.length * 1.5;
        return b.score - a.score || bCoverage - aCoverage || b.metrics.counter - a.metrics.counter || b.metrics.composition - a.metrics.composition;
      }
      return b.score - a.score || b.metrics.counter - a.metrics.counter || b.metrics.safety - a.metrics.safety;
    })
    .slice(0, 16);

  const selectedPick = selectedProfile
    ? scoreCandidate(selectedProfile, input, otherAllies, enemies, recommendationNeeds)
    : undefined;
  const coachCandidate = selectedProfile || (fullAllies.length < 3 ? recommendations[0]?.brawler : undefined);
  const visiblePicks = fullAllies.length + enemies.length;
  const projectedAllies = selectedProfile
    ? fullAllies
    : recommendations[0]
      ? [...fullAllies, recommendations[0].brawler]
      : fullAllies;
  const draftStage = selectedProfile
    ? visiblePicks >= 6
      ? "Draft completo: evaluando los dos equipos"
      : "Tu pick está seleccionado: evaluación provisional"
    : input.position === "First pick"
      ? "First pick: priorizando solidez, meta del mapa y baja exposición"
      : input.position === "Last pick"
        ? "Last pick: buscando el máximo castigo contra la composición completa"
        : input.enemies.length
          ? "Picks intermedios: counterear al rival sin romper la composición"
          : "Picks intermedios: esperando información rival y manteniendo flexibilidad";

  return {
    recommendations,
    selectedPick,
    winEstimate: fullAllies.length && enemies.length ? estimateWinProbability(input, fullAllies, enemies) : undefined,
    needs: finalNeeds,
    threats,
    strengths,
    enemyWeaknesses: enemyWeaknesses(input, enemies),
    banRecommendations: banRecommendations(input, roster, fullAllies),
    predictedEnemyPicks: predictEnemyPicks(input, roster, fullAllies, enemies),
    teamAssignments: laneAssignments(coachCandidate, selectedProfile ? otherAllies : fullAllies, enemies, input),
    compositionScore: compositionScore(selectedProfile ? otherAllies : fullAllies, coachCandidate, finalNeeds),
    draftStage,
    availableCount: roster.length - unavailable.size,
    confidence: recommendationConfidence(input, recommendations, visiblePicks),
    checklist: draftChecklist(input, projectedAllies, enemies),
  };
}

export function recommendDraft(input: DraftInput, roster: Brawler[]): DraftRecommendation[] {
  return analyzeDraft(input, roster).recommendations;
}
