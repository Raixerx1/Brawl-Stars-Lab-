import type {
  Brawler,
  DraftAnalysis,
  DraftInput,
  DraftPosition,
  DraftRecommendation,
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
  brawler.range === "Muy largo" ||
  brawler.range === "Largo" ||
  hasTag(brawler, "sniper", "tirador", "open");
const isControl = (brawler: Brawler) =>
  brawler.role === "Control" || hasTag(brawler, "control", "zone");
const isFrontline = (brawler: Brawler) =>
  brawler.role === "Tanque" || brawler.role === "Asesino" || hasTag(brawler, "tank", "mobile", "assassin");
const isAntitank = (brawler: Brawler) =>
  brawler.role === "Antitanque" || hasTag(brawler, "antitank", "antitanque");
const isAntidive = (brawler: Brawler) =>
  brawler.role === "Antidive" || hasTag(brawler, "antidive");
const isObjective = (brawler: Brawler) => hasTag(brawler, "objective", "damage", "carry");
const isSupport = (brawler: Brawler) => brawler.role === "Apoyo" || hasTag(brawler, "support", "apoyo");

function findProfiles(names: string[], roster: Brawler[]) {
  return names
    .map((name) => roster.find((brawler) => norm(brawler.name) === norm(name)))
    .filter(Boolean) as Brawler[];
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
  const enemyHasThrower = enemies.some((enemy) => enemy.role === "Artillero" || hasTag(enemy, "thrower", "artillero"));

  if (enemyHasTank && !allies.some(isAntitank)) needs.push("Antitanque");
  if (enemyHasDive && !allies.some(isAntidive)) needs.push("Antidive / peel");
  if (enemyHasThrower && !allies.some((ally) => ally.role === "Asesino" || hasTag(ally, "mobile"))) {
    needs.push("Acceso contra artilleros");
  }
  if (input.map.layout === "Abierto" && !allies.some(isLongRange)) needs.push("Rango largo");
  if (input.map.layout === "Cerrado" && allies.length > 0 && allies.every(isLongRange)) needs.push("Presencia de primera línea");
  if (!allies.some(isControl) && ["Zona Restringida", "Atrapagemas", "Balón Brawl"].includes(input.map.mode)) {
    needs.push("Control de espacio");
  }
  if (input.map.mode === "Atraco" && !allies.some(isObjective)) needs.push("Daño al objetivo");
  if (input.map.mode === "Atrapagemas" && !allies.some((ally) => hasTag(ally, "mid", "safe") || isSupport(ally))) {
    needs.push("Mid / portador estable");
  }
  if (input.map.mode === "Balón Brawl" && !allies.some(isFrontline)) needs.push("Presión y movilidad");
  if (input.map.mode === "Zona Restringida" && !allies.some(isControl)) needs.push("Negación de zona");
  if (["Noqueo", "Caza Estelar"].includes(input.map.mode) && !allies.some((ally) => isLongRange(ally) || hasTag(ally, "safe"))) {
    needs.push("Daño seguro a distancia");
  }
  return unique(needs).slice(0, 5);
}

function draftStrengths(input: DraftInput, allies: Brawler[], enemies: Brawler[]) {
  const strengths: string[] = [];
  const roles = new Set(allies.map((ally) => ally.role));
  if (allies.length >= 2 && roles.size === allies.length) strengths.push("Roles aliados complementarios");
  if (allies.some(isControl)) strengths.push("Control de espacio cubierto");
  if (allies.some(isAntidive)) strengths.push("Defensa frente a dive");
  if (allies.some(isAntitank)) strengths.push("Respuesta contra tanques");
  if (input.map.layout === "Abierto" && allies.some(isLongRange)) strengths.push("Rango adaptado al mapa");
  if (input.map.mode === "Atraco" && allies.some(isObjective)) strengths.push("Presión directa sobre la caja");
  if (enemies.some((enemy) => allies.some((ally) => includesName(ally.counters, enemy.name)))) {
    strengths.push("Ya existe al menos un matchup favorable");
  }
  return unique(strengths).slice(0, 4);
}

function draftThreats(allies: Brawler[], enemies: Brawler[]) {
  const threats: string[] = [];
  for (const enemy of enemies) {
    const exposedAllies = allies.filter((ally) => includesName(ally.counteredBy, enemy.name));
    if (exposedAllies.length) threats.push(`${enemy.name} amenaza a ${exposedAllies.map((ally) => ally.name).join(" y ")}`);
  }
  if (enemies.some((enemy) => enemy.role === "Tanque") && !allies.some(isAntitank)) threats.push("Falta daño consistente contra tanques");
  if (enemies.some((enemy) => enemy.role === "Asesino") && !allies.some(isAntidive)) threats.push("El backline está expuesto al dive");
  if (enemies.some((enemy) => enemy.role === "Artillero") && !allies.some(isFrontline)) threats.push("Falta acceso contra artilleros");
  return unique(threats).slice(0, 5);
}

function lineFor(brawler: Brawler, input: DraftInput) {
  if (hasTag(brawler, "mid") || (input.map.mode === "Atrapagemas" && (isSupport(brawler) || hasTag(brawler, "safe")))) {
    return "Centro / portador";
  }
  if (brawler.role === "Artillero") return "Línea con muros";
  if (brawler.role === "Asesino" || brawler.role === "Tanque") return "Lateral de presión";
  if (isLongRange(brawler)) return input.map.layout === "Abierto" ? "Línea larga" : "Lateral con ángulo";
  if (isControl(brawler)) return "Centro o línea de control";
  return "Línea flexible";
}

function planFor(brawler: Brawler, countersHit: string[], exposedTo: string[], input: DraftInput) {
  if (countersHit.length) {
    return `Busca la línea de ${countersHit[0]} y fuerza ese matchup. ${input.map.plan}`;
  }
  if (exposedTo.length) {
    return `Evita emparejarte directamente con ${exposedTo[0]}; rota de línea y juega con cobertura aliada. ${input.map.plan}`;
  }
  if (input.position === "First pick") return `Juega de forma estable y evita revelar una condición de victoria frágil. ${input.map.plan}`;
  if (input.position === "Last pick") return `Usa la información completa del rival para imponer la línea favorable. ${input.map.plan}`;
  return input.map.plan;
}

function scoreCandidate(
  brawler: Brawler,
  input: DraftInput,
  allies: Brawler[],
  enemies: Brawler[],
  needs: string[],
): DraftRecommendation {
  let score = tierScore[brawler.tier] ?? 41;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const countersHit: string[] = [];
  const exposedTo: string[] = [];

  let mapFit = 45;
  let counter = 50;
  let synergy = 50;
  let safety = 50;
  let composition = 50;
  let risk = 35;

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
    if (hasTag(brawler, "safe")) {
      score += 9;
      safety += 22;
      reasons.push("Pick estable a ciegas");
    }
    if (hasTag(brawler, "lastpick", "assassin") || brawler.role === "Asesino") {
      score -= 8;
      safety -= 16;
      risk += 18;
      warnings.push("Expone demasiado el draft como primera selección");
    }
  }
  if (input.position === "Pick intermedio" && hasTag(brawler, "safe", "control")) {
    score += 4;
    safety += 8;
  }
  if (input.position === "Last pick" && (hasTag(brawler, "lastpick", "assassin") || brawler.role === "Asesino")) {
    score += 10;
    counter += 8;
    reasons.push("Escala como counterpick");
  }

  for (const enemy of enemies) {
    if (includesName(brawler.counters, enemy.name)) {
      score += 13;
      counter += 20;
      countersHit.push(enemy.name);
      reasons.push(`Counter directo de ${enemy.name}`);
    }
    if (includesName(brawler.counteredBy, enemy.name)) {
      score -= 15;
      counter -= 24;
      safety -= 12;
      risk += 24;
      exposedTo.push(enemy.name);
      warnings.push(`${enemy.name} lo frena`);
    }
    if (includesName(enemy.counteredBy, brawler.name)) {
      score += 5;
      counter += 7;
    }
    if (includesName(enemy.counters, brawler.name)) {
      score -= 6;
      counter -= 8;
      risk += 8;
    }
  }

  const enemyHasTank = enemies.some((enemy) => enemy.role === "Tanque" || hasTag(enemy, "tank", "tanque"));
  const enemyHasDive = enemies.some((enemy) => enemy.role === "Asesino" || hasTag(enemy, "assassin", "asesino", "mobile"));
  const enemyHasThrower = enemies.some((enemy) => enemy.role === "Artillero" || hasTag(enemy, "thrower", "artillero"));

  if (enemyHasTank && isAntitank(brawler)) {
    score += 10;
    counter += 15;
    composition += 10;
    reasons.push("Cubre antitanque");
  }
  if (enemyHasDive && isAntidive(brawler)) {
    score += 11;
    counter += 15;
    composition += 12;
    reasons.push("Protege frente a dive");
  }
  if (enemyHasThrower && (brawler.role === "Asesino" || hasTag(brawler, "mobile"))) {
    score += 8;
    counter += 12;
    reasons.push("Acceso contra artilleros");
  }

  if (input.map.layout === "Abierto" && isLongRange(brawler)) {
    score += 8;
    mapFit += 15;
    reasons.push("Aprovecha el mapa abierto");
  }
  if (input.map.layout === "Abierto" && (brawler.role === "Tanque" || brawler.role === "Artillero") && !hasTag(brawler, "safe")) {
    score -= 7;
    mapFit -= 12;
    risk += 9;
  }
  if (input.map.layout === "Cerrado" && (isFrontline(brawler) || brawler.role === "Artillero" || hasTag(brawler, "walls"))) {
    score += 7;
    mapFit += 13;
    reasons.push("Aprovecha cobertura y pasillos");
  }

  const allyRoles = allies.map((ally) => ally.role);
  const duplicateRoleCount = allyRoles.filter((role) => role === brawler.role).length;
  if (!allyRoles.includes(brawler.role)) {
    score += 3;
    synergy += 8;
  } else if (duplicateRoleCount >= 1) {
    score -= 3 * duplicateRoleCount;
    synergy -= 7 * duplicateRoleCount;
  }

  if (allies.length && allies.every(isLongRange) && (isControl(brawler) || isFrontline(brawler))) {
    score += 7;
    synergy += 13;
    composition += 12;
    reasons.push("Equilibra un backline de rango");
  }
  if (allies.some(isSupport) && (brawler.role === "Tanque" || brawler.role === "Asesino" || hasTag(brawler, "carry"))) {
    score += 4;
    synergy += 9;
    reasons.push("Aprovecha el soporte aliado");
  }
  if (allies.some((ally) => ally.role === "Artillero") && isAntidive(brawler)) {
    score += 6;
    synergy += 11;
    reasons.push("Protege al artillero aliado");
  }

  for (const need of needs) {
    const covers =
      (need === "Antitanque" && isAntitank(brawler)) ||
      (need === "Antidive / peel" && isAntidive(brawler)) ||
      (need === "Acceso contra artilleros" && (brawler.role === "Asesino" || hasTag(brawler, "mobile"))) ||
      (need === "Rango largo" && isLongRange(brawler)) ||
      (need === "Presencia de primera línea" && isFrontline(brawler)) ||
      (need === "Control de espacio" && isControl(brawler)) ||
      (need === "Daño al objetivo" && isObjective(brawler)) ||
      (need === "Mid / portador estable" && (hasTag(brawler, "mid", "safe") || isSupport(brawler))) ||
      (need === "Presión y movilidad" && isFrontline(brawler)) ||
      (need === "Negación de zona" && isControl(brawler)) ||
      (need === "Daño seguro a distancia" && (isLongRange(brawler) || hasTag(brawler, "safe")));
    if (covers) {
      score += 7;
      composition += 15;
      reasons.push(`Cubre: ${need}`);
    }
  }

  if (hasTag(brawler, "safe")) safety += 13;
  if (hasTag(brawler, "carry")) synergy += 5;
  if (brawler.profileComplete) safety += 4;
  if (!brawler.profileComplete) {
    score -= 6;
    safety -= 8;
    risk += 8;
  }

  const warning = warnings.length
    ? unique(warnings).slice(0, 2).join(" · ")
    : !brawler.profileComplete
      ? "Build pendiente de validación táctica completa"
      : undefined;

  return {
    brawler,
    score: clamp(score),
    reasons: unique(reasons).slice(0, 6),
    warning,
    metrics: {
      mapFit: clamp(mapFit),
      counter: clamp(counter),
      synergy: clamp(synergy),
      safety: clamp(safety),
      composition: clamp(composition),
      risk: clamp(risk),
    },
    countersHit: unique(countersHit),
    exposedTo: unique(exposedTo),
    suggestedLine: lineFor(brawler, input),
    plan: planFor(brawler, countersHit, exposedTo, input),
  };
}

export function analyzeDraft(input: DraftInput, roster: Brawler[]): DraftAnalysis {
  const unavailable = new Set([...input.allies, ...input.enemies, ...input.bans].map(norm));
  const enemies = findProfiles(input.enemies, roster);
  const allies = findProfiles(input.allies, roster);
  const needs = teamNeeds(input, allies, enemies);
  const threats = draftThreats(allies, enemies);
  const strengths = draftStrengths(input, allies, enemies);

  const recommendations = roster
    .filter((brawler) => !unavailable.has(norm(brawler.name)))
    .map((brawler) => scoreCandidate(brawler, input, allies, enemies, needs))
    .sort((a, b) => b.score - a.score || b.metrics.safety - a.metrics.safety)
    .slice(0, 12);

  const visiblePicks = input.allies.length + input.enemies.length;
  const draftStage = visiblePicks === 0
    ? "Draft vacío: priorizando picks seguros y meta del mapa"
    : input.enemies.length === 0
      ? "Solo hay información aliada: priorizando equilibrio y flexibilidad"
      : input.position === "Last pick"
        ? "Cierre de draft: priorizando counters y castigo de debilidades"
        : "Draft en curso: equilibrando mapa, sinergias y matchups";

  return {
    recommendations,
    needs,
    threats,
    strengths,
    draftStage,
    availableCount: roster.length - unavailable.size,
  };
}

export function recommendDraft(input: DraftInput, roster: Brawler[]): DraftRecommendation[] {
  return analyzeDraft(input, roster).recommendations;
}
