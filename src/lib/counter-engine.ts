import type { Brawler } from "./types";

export type CounterConfidence = "Alta" | "Media" | "Baja";

export type SpecificMatchup = {
  candidate: Brawler;
  target: Brawler;
  score: number;
  confidence: CounterConfidence;
  explicit: boolean;
  reasons: string[];
  reason: string;
};

const norm = (value: string) => value.trim().toLowerCase();
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const includesName = (values: string[], name: string) =>
  values.some((value) => norm(value) === norm(name));
const hasTag = (brawler: Brawler, ...tags: string[]) =>
  tags.some((tag) => brawler.tags.includes(tag));

const isLongRange = (brawler: Brawler) =>
  ["Muy largo", "Largo", "Medio-largo"].includes(brawler.range) ||
  hasTag(brawler, "sniper", "tirador", "open");

const isShortRange = (brawler: Brawler) =>
  brawler.range === "Corto" ||
  brawler.role === "Tanque" ||
  brawler.role === "Asesino" ||
  hasTag(brawler, "tank", "tanque", "assassin", "asesino");

const isMobile = (brawler: Brawler) =>
  brawler.role === "Asesino" ||
  hasTag(brawler, "mobile", "assassin", "asesino") ||
  (brawler.firstPickProfile?.mobility || 0) >= 74;

const isThrower = (brawler: Brawler) =>
  brawler.role === "Artillero" || hasTag(brawler, "thrower", "artillero");

const isControl = (brawler: Brawler) =>
  brawler.role === "Control" || hasTag(brawler, "control", "zone");

const isSupport = (brawler: Brawler) =>
  brawler.role === "Apoyo" || hasTag(brawler, "support", "apoyo");

const isAntitank = (brawler: Brawler) =>
  brawler.role === "Antitanque" || hasTag(brawler, "antitank", "antitanque");

const isAntidive = (brawler: Brawler) =>
  brawler.role === "Antidive" ||
  hasTag(brawler, "antidive") ||
  (brawler.firstPickProfile?.antiDive || 0) >= 78;

const hasWallbreak = (brawler: Brawler) =>
  hasTag(brawler, "wallbreak") ||
  (brawler.firstPickProfile?.wallBreak || 0) >= 72 ||
  ["Brock", "Colt", "Griff", "Shelly", "Frank", "Ruffs", "Gray", "Piper"].includes(brawler.name);

const tierBonus: Record<string, number> = {
  "S+": 6,
  S: 5,
  "A+": 4,
  A: 3,
  "B+": 2,
  B: 1,
  C: 0,
  D: -2,
  F: -4,
  "Sin evaluar": -1,
};

function relationIndex(values: string[], name: string) {
  return values.findIndex((value) => norm(value) === norm(name));
}

function pushReason(reasons: string[], reason: string | undefined) {
  if (!reason || reasons.includes(reason)) return;
  reasons.push(reason);
}

function explicitRelation(candidate: Brawler, target: Brawler) {
  const candidateListsTarget = includesName(candidate.counters, target.name);
  const targetListsCandidate = includesName(target.counteredBy, candidate.name);
  const targetListsCandidateAsGood = includesName(target.counters, candidate.name);
  const candidateListsTargetAsThreat = includesName(candidate.counteredBy, target.name);

  const positive = candidateListsTarget || targetListsCandidate;
  const negative = targetListsCandidateAsGood || candidateListsTargetAsThreat;
  let score = 0;
  const reasons: string[] = [];

  if (positive) {
    score += candidateListsTarget && targetListsCandidate ? 32 : 25;
    const targetIndex = relationIndex(target.counteredBy, candidate.name);
    const candidateIndex = relationIndex(candidate.counters, target.name);
    if (targetIndex >= 0) score += Math.max(0, 6 - targetIndex);
    if (candidateIndex >= 0) score += Math.max(0, 4 - candidateIndex);
    pushReason(reasons, `${candidate.name} tiene evidencia explícita favorable contra ${target.name}`);
  }

  if (negative) {
    score -= targetListsCandidateAsGood && candidateListsTargetAsThreat ? 36 : 29;
    pushReason(reasons, `${target.name} también tiene evidencia explícita para responder a ${candidate.name}`);
  }

  const reviewed =
    candidate.matchupNotes?.favorable?.[target.name] ||
    target.matchupNotes?.threats?.[candidate.name];
  if (reviewed) {
    score += 8;
    reasons.unshift(reviewed);
  }

  return {
    score,
    positive,
    negative,
    reviewed: Boolean(reviewed),
    reasons,
  };
}

function mechanicScore(candidate: Brawler, target: Brawler) {
  const candidateProfile = candidate.firstPickProfile;
  const targetProfile = target.firstPickProfile;
  const reasons: string[] = [];
  let score = 0;

  const candidateMobility = candidateProfile?.mobility ?? (isMobile(candidate) ? 78 : 48);
  const candidateControl = candidateProfile?.control ?? (isControl(candidate) ? 76 : 48);
  const candidateAntiDive = candidateProfile?.antiDive ?? (isAntidive(candidate) ? 82 : 45);
  const candidateWallbreak = candidateProfile?.wallBreak ?? (hasWallbreak(candidate) ? 78 : 25);
  const candidateObjective = candidateProfile?.objective ?? 50;
  const targetMobility = targetProfile?.mobility ?? (isMobile(target) ? 78 : 45);
  const targetAntiDive = targetProfile?.antiDive ?? (isAntidive(target) ? 82 : 42);
  const targetWallReliance = targetProfile?.wallReliance ?? (isThrower(target) ? 82 : 38);
  const targetBushFit = targetProfile?.bushFit ?? (isShortRange(target) ? 68 : 42);
  const targetControl = targetProfile?.control ?? (isControl(target) ? 76 : 48);

  if (target.role === "Tanque" || hasTag(target, "tank", "tanque")) {
    if (isAntitank(candidate)) {
      score += 18;
      pushReason(reasons, `${candidate.name} convierte la vida alta de ${target.name} en una desventaja`);
    }
    if (isControl(candidate)) {
      score += 8;
      pushReason(reasons, `El control de ${candidate.name} dificulta que ${target.name} alcance su rango útil`);
    }
    if (isLongRange(candidate)) score += 5;
  }

  if (target.role === "Asesino" || isMobile(target)) {
    const antiDiveEdge = Math.max(-8, Math.min(16, (candidateAntiDive - 50) * .30));
    score += antiDiveEdge;
    if (antiDiveEdge >= 7) {
      pushReason(reasons, `${candidate.name} tiene herramientas concretas para cortar la entrada de ${target.name}`);
    }

    const controlEdge = Math.max(-4, Math.min(8, (candidateControl - 50) * .13));
    score += controlEdge;

    if (isThrower(candidate) && candidateAntiDive < 58) {
      score -= 12;
      pushReason(reasons, `${target.name} puede cerrar distancia contra ${candidate.name} con demasiada facilidad`);
    }
    if (candidate.role === "Tirador" && candidateAntiDive < 52) score -= 7;
  }

  if (target.role === "Tirador" || hasTag(target, "sniper", "tirador", "open")) {
    if (isMobile(candidate)) {
      const diveEdge = Math.max(-6, Math.min(16, candidateMobility * .17 - targetAntiDive * .12));
      score += diveEdge;
      if (diveEdge >= 6) {
        pushReason(reasons, `${candidate.name} puede cerrar la distancia antes de que ${target.name} explote su alcance`);
      }
    }

    if (isLongRange(candidate) && candidate.range === "Muy largo" && target.range !== "Muy largo") {
      score += 7;
      pushReason(reasons, `${candidate.name} puede disputar a ${target.name} incluso desde su zona de confort`);
    }

    if (isThrower(candidate) && (targetProfile?.wallBreak || 0) < 45) {
      score += 5;
      pushReason(reasons, `${candidate.name} puede presionar a ${target.name} desde cobertura sin ofrecer un ángulo limpio`);
    }
  }

  if (isThrower(target)) {
    if (isMobile(candidate)) {
      score += Math.max(7, Math.min(18, (candidateMobility - 45) * .28));
      pushReason(reasons, `La movilidad de ${candidate.name} castiga la dificultad de ${target.name} para defenderse a corta distancia`);
    }
    if (hasWallbreak(candidate)) {
      const wallbreakEdge = Math.max(5, Math.min(16, candidateWallbreak * targetWallReliance / 700));
      score += wallbreakEdge;
      pushReason(reasons, `${candidate.name} puede eliminar la cobertura de la que depende ${target.name}`);
    }
  }

  if (isSupport(target) || target.role === "Control") {
    if (isLongRange(candidate) && !isLongRange(target)) {
      score += 8;
      pushReason(reasons, `${candidate.name} obliga a ${target.name} a trabajar fuera de su rango cómodo`);
    }
    if (isMobile(candidate) && targetAntiDive < 62) {
      score += 7;
      pushReason(reasons, `${target.name} tiene pocas herramientas de peel contra la entrada de ${candidate.name}`);
    }
    if (hasTag(target, "shield") && candidateObjective >= 78) {
      score += 3;
      pushReason(reasons, `${candidate.name} puede mantener presión suficiente para obligar a ${target.name} a gastar su protección`);
    }
  }

  if (target.role === "Antidive" || isAntidive(target)) {
    if (isLongRange(candidate)) score += 7;
    if (isThrower(candidate)) score += 5;
    if (candidate.role === "Asesino" && targetAntiDive >= 78) score -= 10;
  }

  if (target.role === "Antitanque") {
    if (candidate.role === "Tanque") score -= 12;
    if (isLongRange(candidate)) score += 5;
    if (isThrower(candidate)) score += 4;
  }

  if (isShortRange(target) && isLongRange(candidate)) {
    score += 6;
    pushReason(reasons, `${candidate.name} puede desgastar a ${target.name} antes de que entre en su distancia efectiva`);
  }

  if (isLongRange(target) && isShortRange(candidate)) {
    if (candidateMobility >= 72) score += 7;
    else score -= 8;
  }

  if (targetWallReliance >= 65 && hasWallbreak(candidate)) {
    const edge = Math.max(4, Math.min(11, (candidateWallbreak - 45) * targetWallReliance / 520));
    score += edge;
    if (edge >= 6) pushReason(reasons, `${candidate.name} reduce el valor de la cobertura que necesita ${target.name}`);
  }

  if (targetBushFit >= 76 && (candidateProfile?.vision || 0) >= 68) {
    score += 6;
    pushReason(reasons, `${candidate.name} reduce la ventaja de ${target.name} dentro de arbustos`);
  }

  if (isMobile(candidate) && targetAntiDive >= 78) {
    score -= 7;
    pushReason(reasons, `${target.name} tiene suficiente antidive para no conceder una entrada gratuita a ${candidate.name}`);
  }

  if (isControl(candidate) && targetMobility >= 72) {
    score += 6;
    pushReason(reasons, `El control de ${candidate.name} limita las rutas de movilidad de ${target.name}`);
  }

  if (candidateControl >= 78 && targetControl <= 45 && targetMobility < 62) {
    score += 4;
    pushReason(reasons, `${candidate.name} puede imponer el ritmo de la línea antes de que ${target.name} encuentre espacio`);
  }

  return { score, reasons };
}

function viabilityEdge(candidate: Brawler, target: Brawler) {
  const candidateTier = tierBonus[candidate.tier] ?? -1;
  const targetTier = tierBonus[target.tier] ?? -1;
  const candidateRisk = candidate.firstPickProfile?.counterRisk ?? 50;
  const reliability = Math.max(-3, Math.min(2, (55 - candidateRisk) * .05));
  return candidateTier * .85 - targetTier * .18 + reliability;
}

function rawEdge(candidate: Brawler, target: Brawler) {
  const explicit = explicitRelation(candidate, target);
  const mechanics = mechanicScore(candidate, target);
  return {
    explicit,
    mechanics,
    value: explicit.score + mechanics.score + viabilityEdge(candidate, target),
  };
}

export function evaluateSpecificMatchup(candidate: Brawler, target: Brawler): SpecificMatchup {
  if (norm(candidate.name) === norm(target.name)) {
    return {
      candidate,
      target,
      score: 0,
      confidence: "Baja",
      explicit: false,
      reasons: ["Un brawler no puede counterearse a sí mismo"],
      reason: "Un brawler no puede counterearse a sí mismo",
    };
  }

  const forward = rawEdge(candidate, target);
  const reverseMechanics = mechanicScore(target, candidate);
  const reverseReply = Math.max(-14, Math.min(20, reverseMechanics.score));
  const pairMargin = forward.value - reverseReply * .42;

  const reasons = [...forward.explicit.reasons];
  forward.mechanics.reasons.forEach((reason) => pushReason(reasons, reason));

  if (reverseReply >= 11 && !forward.explicit.positive) {
    pushReason(reasons, `${target.name} conserva herramientas de respuesta; no es un counter gratuito`);
  }

  const score = clamp(50 + pairMargin);
  const absoluteEdge = Math.abs(score - 50);
  const confidence: CounterConfidence =
    forward.explicit.reviewed || (forward.explicit.positive && !forward.explicit.negative && absoluteEdge >= 18) ? "Alta" :
    forward.explicit.positive || forward.explicit.negative || forward.mechanics.reasons.length >= 2 || absoluteEdge >= 16 ? "Media" :
    "Baja";

  if (!reasons.length) {
    reasons.push(`Matchup cercano: ${candidate.name} no obtiene una interacción mecánica claramente dominante contra ${target.name}`);
  }

  return {
    candidate,
    target,
    score,
    confidence,
    explicit: forward.explicit.positive,
    reasons: reasons.slice(0, 4),
    reason: reasons.slice(0, 2).join(" · "),
  };
}

export function rankCountersAgainst(target: Brawler, roster: Brawler[], limit = 6) {
  return roster
    .filter((candidate) => norm(candidate.name) !== norm(target.name))
    .map((candidate) => evaluateSpecificMatchup(candidate, target))
    .sort((a, b) =>
      b.score - a.score ||
      Number(b.explicit) - Number(a.explicit) ||
      a.candidate.name.localeCompare(b.candidate.name, "es")
    )
    .slice(0, limit);
}

export function rankTargetsFor(candidate: Brawler, roster: Brawler[], limit = 6) {
  return roster
    .filter((target) => norm(candidate.name) !== norm(target.name))
    .map((target) => evaluateSpecificMatchup(candidate, target))
    .sort((a, b) =>
      b.score - a.score ||
      Number(b.explicit) - Number(a.explicit) ||
      a.target.name.localeCompare(b.target.name, "es")
    )
    .slice(0, limit);
}
