import type {
  BanRecommendation,
  Brawler,
  DraftAnalysis,
  DraftInput,
  DraftPosition,
  DraftRecommendation,
  EnemyPickPrediction,
  LanePlan,
  TacticalBuild,
  TeamAssignment,
  WinEstimate,
} from "./types";

const tierScore: Record<string, number> = {
  S: 64,
  "A+": 59,
  A: 54,
  "B+": 49,
  B: 44,
  "Sin evaluar": 41,
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
  rawScore: number,
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
      metrics.mapFit * .34 +
      metrics.safety * .28 +
      metrics.composition * .14 +
      metrics.synergy * .10 +
      metrics.personal * .06 +
      metrics.counter * .03 -
      metrics.risk * .14 +
      rawScore * .08
    );
  }

  if (!enemies.length) {
    return clamp(
      metrics.mapFit * .30 +
      metrics.safety * .23 +
      metrics.composition * .18 +
      metrics.synergy * .14 +
      metrics.personal * .07 +
      metrics.counter * .05 -
      metrics.risk * .11 +
      rawScore * .07
    );
  }

  const priority = input.priority || "Counter";
  const isLastPick = input.position === "Last pick";
  const weights = isLastPick
    ? { counter: .59, map: .10, composition: .11, synergy: .06, safety: .05, personal: .03, risk: .17, raw: .04 }
    : priority === "Seguro"
      ? { counter: .31, map: .18, composition: .17, synergy: .10, safety: .20, personal: .04, risk: .13, raw: .06 }
      : priority === "Equilibrado"
        ? { counter: .40, map: .17, composition: .17, synergy: .11, safety: .10, personal: .04, risk: .12, raw: .06 }
        : { counter: .46, map: .14, composition: .16, synergy: .09, safety: .08, personal: .04, risk: .14, raw: .05 };

  const coverageBonus = isLastPick
    ? directCount >= 3 ? 18 : directCount === 2 ? 13 : directCount === 1 ? 7 : softCount >= 2 ? 4 : 0
    : directCount >= 3 ? 14 : directCount === 2 ? 10 : directCount === 1 ? 5 : softCount >= 2 ? 3 : 0;
  const exposurePenalty = exposedCount * (isLastPick ? 10 : priority === "Counter" ? 8 : 6);
  const noAnswerPenalty = directCount === 0 && softCount === 0 && enemies.length >= 2
    ? isLastPick ? 15 : 9
    : 0;

  return clamp(
    metrics.counter * weights.counter +
    metrics.mapFit * weights.map +
    metrics.composition * weights.composition +
    metrics.synergy * weights.synergy +
    metrics.safety * weights.safety +
    metrics.personal * weights.personal -
    metrics.risk * weights.risk +
    rawScore * weights.raw +
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

  const sIndex = input.map.tierS.indexOf(brawler.name);
  const aIndex = input.map.tierA.indexOf(brawler.name);
  if (sIndex >= 0) {
    score += 17 - sIndex * 1.4;
    mapFit += 24 - sIndex * 2;
    reasons.push("Tier S editorial del mapa");
  } else if (aIndex >= 0) {
    score += 10 - aIndex;
    mapFit += 14 - aIndex;
    reasons.push("Tier A editorial del mapa");
  }

  if (input.position === "First pick") {
    if (hasTag(brawler, "safe") || isControl(brawler) || isLongRange(brawler)) {
      score += 10;
      safety += 22;
      reasons.push("Pick sólido y difícil de castigar");
    }
    if (sIndex >= 0) {
      score += 6;
      mapFit += 8;
      reasons.push("Prioridad alta como first pick del mapa");
    }
    if (hasTag(brawler, "lastpick", "assassin") || brawler.role === "Asesino") {
      score -= 8;
      safety -= 16;
      risk += 18;
      warnings.push("Expone demasiado el draft como primera selección");
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
      score += Math.round(24 * matchupMultiplier);
      counter += Math.round(32 * matchupMultiplier);
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
    score += 15; counter += 21; composition += 10; reasons.push("Cubre antitanque");
  }
  if (enemyHasDive && isAntidive(brawler)) {
    score += 17; counter += 23; composition += 12; reasons.push("Protege frente a dive");
  }
  if (enemyHasThrower && (brawler.role === "Asesino" || hasTag(brawler, "mobile"))) {
    score += 13; counter += 18; reasons.push("Acceso contra artilleros");
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

  for (const need of needs) {
    if (coversNeed(brawler, need)) {
      score += 7; composition += 15; reasons.push(`Cubre: ${need}`);
    }
  }

  const poolEntry = input.personalPool?.[brawler.slug];
  if (input.usePersonalPool && poolEntry) {
    if (poolEntry.power11) { score += 4; personal += 12; reasons.push("Fuerza 11 en tu pool"); }
    if (poolEntry.hypercharge) { score += 3; personal += 8; reasons.push("Hipercarga disponible"); }
    if (poolEntry.mastery > 3) { score += (poolEntry.mastery - 3) * 3; personal += (poolEntry.mastery - 3) * 12; reasons.push(`Dominio personal ${poolEntry.mastery}/5`); }
    if (poolEntry.mastery <= 2) { score -= 5; personal -= 15; warnings.push("Dominio personal bajo"); }
    if (poolEntry.avoid) { score -= 30; personal = 0; warnings.push("Marcado para evitar en tu pool"); }
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
    mapFit: clamp(mapFit),
    counter: clamp(counter),
    synergy: clamp(synergy),
    safety: clamp(safety),
    composition: clamp(composition),
    personal: clamp(personal),
    risk: clamp(risk),
  };
  const finalScore = finalCounterWeightedScore(score, input, metrics, enemies, direct.length, soft.length, exposed.length);
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
    counterLabel,
    suggestedLine: lineFor(brawler, input),
    plan: planFor(brawler, direct.length ? direct : soft, exposed, input),
    build: tacticalBuild(brawler, input, enemies),
    lanePlan: lanePlanFor(brawler, direct.length ? direct : soft, exposed, input),
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
  return roster
    .filter((brawler) => !excluded.has(norm(brawler.name)))
    .map((brawler) => {
      let score = tierScore[brawler.tier] ?? 40;
      const tierIndex = input.map.tierS.indexOf(brawler.name);
      const aIndex = input.map.tierA.indexOf(brawler.name);
      if (tierIndex >= 0) score += 18 - tierIndex * 2;
      else if (aIndex >= 0) score += 9 - aIndex;
      const targets = allies.filter((ally) => includesName(brawler.counters, ally.name) || includesName(ally.counteredBy, brawler.name));
      score += targets.length * 15;
      if (input.map.layout === "Abierto" && isLongRange(brawler)) score += 7;
      if (input.map.layout === "Cerrado" && (isFrontline(brawler) || isThrower(brawler))) score += 6;
      if (enemies.some(isSupport) && isFrontline(brawler)) score += 5;
      const target = targets[0]?.name;
      const response = brawler.counteredBy.find((name) => !excluded.has(norm(name))) || "Reserva un pick seguro que cubra su arquetipo";
      return {
        brawler,
        score: clamp(score),
        target,
        reason: target ? `Puede castigar a ${target}` : tierIndex >= 0 ? "Es una prioridad natural del mapa" : "Completa el draft rival con flexibilidad",
        response,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
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
  if (!input.myPick || allies.length === 0 || enemies.length === 0) return undefined;

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
  if (input.usePersonalPool && poolEntry) {
    if (poolEntry.power11) alliedScore += 1.5;
    if (poolEntry.hypercharge) alliedScore += 1.2;
    alliedScore += (poolEntry.mastery - 3) * 1.1;
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
      if (!input.usePersonalPool) return true;
      const entry = input.personalPool?.[brawler.slug];
      if (!entry) return false;
      return entry.available && !entry.avoid;
    })
    .map((brawler) => scoreCandidate(brawler, input, otherAllies, enemies, recommendationNeeds))
    .sort((a, b) => {
      const priority = input.priority || "Counter";
      if (input.position === "First pick") {
        const aFirst = a.metrics.mapFit * .52 + a.metrics.safety * .38 - a.metrics.risk * .18 + a.score * .16;
        const bFirst = b.metrics.mapFit * .52 + b.metrics.safety * .38 - b.metrics.risk * .18 + b.score * .16;
        return bFirst - aFirst || b.score - a.score;
      }
      if (input.position === "Last pick" && enemies.length) {
        const aCoverage = a.countersHit.length * 4 + a.softCounters.length * 1.4 - a.exposedTo.length * 3;
        const bCoverage = b.countersHit.length * 4 + b.softCounters.length * 1.4 - b.exposedTo.length * 3;
        return bCoverage - aCoverage || b.metrics.counter - a.metrics.counter || a.metrics.risk - b.metrics.risk || b.score - a.score;
      }
      if (enemies.length && priority === "Counter") {
        const aCoverage = a.countersHit.length * 2.5 + a.softCounters.length - a.exposedTo.length * 1.5;
        const bCoverage = b.countersHit.length * 2.5 + b.softCounters.length - b.exposedTo.length * 1.5;
        return bCoverage - aCoverage || b.metrics.counter - a.metrics.counter || b.metrics.composition - a.metrics.composition || b.score - a.score;
      }
      if (priority === "Seguro") return b.metrics.safety - a.metrics.safety || b.metrics.mapFit - a.metrics.mapFit || b.score - a.score;
      return b.score - a.score || b.metrics.counter - a.metrics.counter || b.metrics.safety - a.metrics.safety;
    })
    .slice(0, 16);

  const selectedPick = selectedProfile
    ? scoreCandidate(selectedProfile, input, otherAllies, enemies, recommendationNeeds)
    : undefined;
  const coachCandidate = selectedProfile || recommendations[0]?.brawler;
  const visiblePicks = fullAllies.length + enemies.length;
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
    winEstimate: selectedProfile ? estimateWinProbability(input, fullAllies, enemies) : undefined,
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
  };
}

export function recommendDraft(input: DraftInput, roster: Brawler[]): DraftRecommendation[] {
  return analyzeDraft(input, roster).recommendations;
}
