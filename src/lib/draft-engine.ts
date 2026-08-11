import { personalAdjustment } from "./performance";
import { evaluateFirstPick } from "./first-pick-model";
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
  if (input.map.layout === "Cerrado" && allies.length > 0 && allies.every(isLongRange)) needs.push("Presencia de primera lÃ­nea");
  if (!allies.some(isControl) && ["Zona Restringida", "Atrapagemas", "BalÃ³n Brawl"].includes(input.map.mode)) needs.push("Control de espacio");
  if (input.map.mode === "Atraco" && !allies.some(isObjective)) needs.push("DaÃ±o al objetivo");
  if (input.map.mode === "Atrapagemas" && !allies.some((ally) => hasTag(ally, "mid", "safe") || isSupport(ally) || isLongRange(ally))) needs.push("Mid / portador estable");
  if (input.map.mode === "BalÃ³n Brawl" && !allies.some(isFrontline)) needs.push("PresiÃ³n y movilidad");
  if (input.map.mode === "Zona Restringida" && !allies.some(isControl)) needs.push("NegaciÃ³n de zona");
  if (["Noqueo", "Caza Estelar"].includes(input.map.mode) && !allies.some((ally) => isLongRange(ally) || hasTag(ally, "safe"))) needs.push("DaÃ±o seguro a distancia");
  if (input.map.traits.some((trait) => trait.includes("arbust")) && !allies.some(hasVision)) needs.push("VisiÃ³n de arbustos");
  if (input.map.traits.some((trait) => trait.includes("muro")) && !allies.some(hasWallbreak) && enemies.some(isThrower)) needs.push("Ruptura de muros");
  if (allies.filter(isSupport).length >= 2) needs.push("Carry con daÃ±o propio");
  if (allies.filter(isLongRange).length >= 2 && enemies.some(isFrontline)) needs.push("ProtecciÃ³n del backline");
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
  if (input.map.mode === "Atraco" && allies.some(isObjective)) strengths.push("PresiÃ³n directa sobre la caja");
  if (enemies.some((enemy) => allies.some((ally) => includesName(ally.counters, enemy.name)))) strengths.push("Ya existe al menos un matchup favorable");
  return unique(strengths).slice(0, 6);
}

function draftThreats(allies: Brawler[], enemies: Brawler[]) {
  const threats: string[] = [];
  for (const enemy of enemies) {
    const exposedAllies = allies.filter((ally) => includesName(ally.counteredBy, enemy.name));
    if (exposedAllies.length) threats.push(`${enemy.name} amenaza a ${exposedAllies.map((ally) => ally.name).join(" y ")}`);
  }
  if (enemies.some((enemy) => enemy.role === "Tanque") && !allies.some(isAntitank)) threats.push("Falta daÃ±o consistente contra tanques");
  if (enemies.some((enemy) => enemy.role === "Asesino") && !allies.some(isAntidive)) threats.push("El backline estÃ¡ expuesto al dive");
  if (enemies.some(isThrower) && !allies.some(isFrontline)) threats.push("Falta acceso contra artilleros");
  if (allies.filter(isLongRange).length >= 2 && enemies.filter(isFrontline).length >= 2) threats.push("Doble rango expuesto a entradas simultÃ¡neas");
  return unique(threats).slice(0, 6);
}

function enemyWeaknesses(input: DraftInput, enemies: Brawler[]) {
  const weaknesses: string[] = [];
  if (enemies.length < 2) return weaknesses;
  if (enemies.filter(isShortRange).length >= 2) weaknesses.push("Mucho corto alcance: castÃ­galo con control y antitanque");
  if (enemies.filter(isLongRange).length >= 2) weaknesses.push("Backline frÃ¡gil: presiÃ³n mÃ³vil y cierre de distancia");
  if (enemies.filter(isThrower).length >= 2) weaknesses.push("Doble artillero: vulnerable a movilidad y ruptura de muros");
  if (enemies.filter(isSupport).length >= 2) weaknesses.push("DaÃ±o propio limitado: fuerza intercambios rÃ¡pidos");
  if (!enemies.some(isAntitank)) weaknesses.push("Sin antitanque claro: un tanque de Ãºltimo pick puede castigar");
  if (!enemies.some(isAntidive) && enemies.some(isLongRange)) weaknesses.push("Sin antidive: los asesinos mÃ³viles ganan valor");
  if (input.map.mode === "Atraco" && !enemies.some(isObjective)) weaknesses.push("Poca presiÃ³n directa sobre la caja");
  if (input.map.layout === "Abierto" && !enemies.some(isLongRange)) weaknesses.push("Rango insuficiente para el mapa abierto");
  return unique(weaknesses).slice(0, 5);
}

function lineFor(brawler: Brawler, input: DraftInput) {
  if (hasTag(brawler, "mid") || (input.map.mode === "Atrapagemas" && (isSupport(brawler) || hasTag(brawler, "safe") || isLongRange(brawler)))) return "Centro / portador";
  if (isThrower(brawler)) return "LÃ­nea con muros";
  if (brawler.role === "Asesino" || brawler.role === "Tanque") return "Lateral de presiÃ³n";
  if (isLongRange(brawler)) return input.map.layout === "Abierto" ? "LÃ­nea larga" : "Lateral con Ã¡ngulo";
  if (isControl(brawler)) return "Centro o lÃ­nea de control";
  return "LÃ­nea flexible";
}

function tacticalBuild(brawler: Brawler, input: DraftInput, enemies: Brawler[]): TacticalBuild {
  const enemyDive = enemies.some((enemy) => enemy.role === "Asesino" || isFrontline(enemy));
  const enemyTank = enemies.some((enemy) => enemy.role === "Tanque");
  const bushes = input.map.traits.some((trait) => trait.includes("arbust"));
  const walls = input.map.traits.some((trait) => trait.includes("muro") || trait.includes("rebote") || trait.includes("choke"));
  const open = input.map.layout === "Abierto";

  let gadget = "Gadget de tempo o utilidad";
  if (enemyDive || brawler.role === "Tirador" || brawler.role === "Artillero") gadget = "Gadget defensivo, escape o interrupciÃ³n";
  else if (walls && hasWallbreak(brawler)) gadget = "Gadget de apertura de mapa / wallbreak";
  else if (brawler.role === "Asesino" || brawler.role === "Tanque") gadget = "Gadget de entrada o supervivencia";

  let starPower = "Habilidad estelar mÃ¡s consistente";
  if (enemyTank) starPower = "Habilidad estelar orientada a daÃ±o sostenido";
  else if (enemyDive) starPower = "Habilidad estelar de supervivencia o control";
  else if (open && isLongRange(brawler)) starPower = "Habilidad estelar de alcance, precisiÃ³n o poke";
  else if (input.map.mode === "Zona Restringida") starPower = "Habilidad estelar de control persistente";

  const gears: string[] = [];
  if (bushes) gears.push("Velocidad");
  if (open && !bushes) gears.push("Escudo");
  if (brawler.role === "Tanque" || enemyDive) gears.push("Salud");
  if (isLongRange(brawler) || isObjective(brawler) || enemyTank) gears.push("DaÃ±o");
  if (isControl(brawler) || isThrower(brawler)) gears.push("Recarga");
  if (gears.length < 2) gears.push("DaÃ±o");

  const hypercharge = brawler.profileComplete
    ? "Ãšsala para ganar la interacciÃ³n decisiva u objetivo, no solo por daÃ±o"
    : "PriorÃ­zala si estÃ¡ disponible y el brawler forma parte de tu pool preparado";

  return {
    gadget,
    starPower,
    gears: unique(gears).slice(0, 2),
    hypercharge,
    reason: enemyDive
      ? "El rival tiene acceso al backline: prima supervivencia y control de entrada."
      : enemyTank
        ? "El rival acumula vida: prima daÃ±o sostenido y recarga."
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
  if (avoid) return { lane, avoid, instruction: `Evita a ${avoid}. Juega con cobertura aliada y cambia de lÃ­nea en la primera pausa segura.` };
  return { lane, instruction: input.position === "First pick" ? "No fuerces una lÃ­nea extrema: conserva flexibilidad hasta ver el counter rival." : "Ocupa la lÃ­nea que mejor complete el emparejamiento del equipo." };
}

function planFor(brawler: Brawler, countersHit: string[], exposedTo: string[], input: DraftInput) {
  if (countersHit.length) return `Busca la lÃ­nea de ${countersHit[0]} y fuerza ese matchup. ${input.map.plan}`;
  if (exposedTo.length) return `Evita emparejarte directamente con ${exposedTo[0]}; rota de lÃ­nea y juega con cobertura aliada. ${input.map.plan}`;
  if (input.position === "First pick") return `Juega de forma estable y evita revelar una condiciÃ³n de victoria frÃ¡gil. ${input.map.plan}`;
  if (input.position === "Last pick") return `Usa la informaciÃ³n completa del rival para imponer la lÃ­nea favorable. ${input.map.plan}`;
  return input.map.plan;
}

function coversNeed(brawler: Brawler, need: string) {
  return (
    (need === "Antitanque" && isAntitank(brawler)) ||
    (need === "Antidive / peel" && isAntidive(brawler)) ||
    (need === "Acceso contra artilleros" && (brawler.role === "Asesino" || hasTag(brawler, "mobile"))) ||
    (need === "Rango largo" && isLongRange(brawler)) ||
    (need === "Presencia de primera lÃ­nea" && isFrontline(brawler)) ||
    (need === "Control de espacio" && isControl(brawler)) ||
    (need === "DaÃ±o al objetivo" && isObjective(brawler)) ||
    (need === "Mid / portador estable" && (hasTag(brawler, "mid", "safe") || isSupport(brawler) || isLongRange(brawler))) ||
    (need === "PresiÃ³n y movilidad" && isFrontline(brawler)) ||
    (need === "NegaciÃ³n de zona" && isControl(brawler)) ||
    (need === "DaÃ±o seguro a distancia" && (isLongRange(brawler) || hasTag(brawler, "safe"))) ||
    (need === "VisiÃ³n de arbustos" && hasVision(brawler)) ||
    (need === "Ruptura de muros" && hasWallbreak(brawler)) ||
    (need === "Carry con daÃ±o propio" && (hasTag(brawler, "carry") || isObjective(brawler))) ||
    (need === "ProtecciÃ³n del backline" && isAntidive(brawler))
  );
}


function softCounterReason(candidate: Brawler, enemy: Brawler, input: DraftInput) {
  if (isAntitank(candidate) && (enemy.role === "Tanque" || hasTag(enemy, "tank", "tanque"))) return "antitanque";
  if (isAntidive(candidate) && (enemy.role === "Asesino" || hasTag(enemy, "assassin", "asesino", "mobile"))) return "antidive";
  if ((candidate.role === "Asesino" || hasTag(candidate, "mobile")) && isThrower(enemy)) return "acceso contra artillero";
  if (hasWallbreak(candidate) && isThrower(enemy) && input.map.traits.some((trait) => trait.includes("muro") || trait.includes("cobertura"))) return "rompe su cobertura";
  if (input.map.layout === "Abierto" && isLongRange(candidate) && isShortRange(enemy)) return "ventaja de rango";
  if (["Zona Restringida", "BalÃ³n Brawl"].includes(input.map.mode) && isControl(candidate) && isShortRange(enemy)) return "controla su entrada";
  return undefined;
}

funct÷ž7¶‰žËkºwµçx‰É…Ý±•È¹É½±”¤¤¹Í¥é”€¨€Ôì(€¥˜€¡Ñ•…´¹Í½µ”¡¥Í½¹ÑÉ½°¤¤Í½É”€¬ô€Øì(€¥˜€¡Ñ•…´¹Í½µ”¡¥Í¹Ñ¥‘¥Ù”¤¤Í½É”€¬ô€Øì(€¥˜€¡Ñ•…´¹Í½µ”¡¥Í¹Ñ¥Ñ…¹¬¤¤Í½É”€¬ô€Øì(€¥˜€¡Ñ•…´¹Í½µ”¡¡…Í]…±±‰É•…¬¤€˜˜¥¹ÁÕÐ¹µ…À¹ÑÉ…¥ÑÌ¹Í½µ” ¡ÑÉ…¥Ð¤€ôøÑÉ…¥Ð¹¥¹±Õ‘•Ì ‰µÕÉ¼ˆ¤¤¤Í½É”€¬ô€Ðì(€¥˜€¡¥¹ÁÕÐ¹µ…À¹±…å½ÕÐ€ôôô€‰‰¥•ÉÑ¼ˆ€˜˜Ñ•…´¹Í½µ”¡¥Í1½¹I…¹”¤¤Í½É”€¬ô€Ôì(€¥˜€¡¥¹ÁÕÐ¹µ…À¹±…å½ÕÐ€ôôô€‰•ÉÉ…‘¼ˆ€˜˜Ñ•…´¹Í½µ”¡¥ÍÉ½¹Ñ±¥¹”¤¤Í½É”€¬ô€Ôì(€¥˜€¡¥¹ÁÕÐ¹µ…À¹µ½‘”€ôôô€‰ÑÉ…¼ˆ€˜˜Ñ•…´¹Í½µ”¡¥Í=‰©•Ñ¥Ù”¤¤Í½É”€¬ô€Üì(€¥˜€¡¥¹ÁÕÐ¹µ…À¹µ½‘”€ôôô€‰i½¹„I•ÍÑÉ¥¹¥‘„ˆ€˜˜Ñ•…´¹Í½µ”¡¥Í½¹ÑÉ½°¤¤Í½É”€¬ô€Øì(€¥˜€¡¥¹ÁÕÐ¹µ…À¹µ½‘”€ôôô€‰ÑÉ…Á…•µ…Ìˆ€˜˜Ñ•…´¹Í½µ” ¡‰É…Ý±•È¤€ôø¥ÍMÕÁÁ½ÉÐ¡‰É…Ý±•È¤ñð¥Í½¹ÑÉ½°¡‰É…Ý±•È¤ñð¥Í1½¹I…¹”¡‰É…Ý±•È¤¤¤Í½É”€¬ô€Ðì(€¥˜€¡Ñ•…´¹™¥±Ñ•È¡¥ÍMÕÁÁ½ÉÐ¤¹±•¹Ñ €øô€È¤Í½É”€´ô€ÄÈì(€¥˜€¡Ñ•…´¹™¥±Ñ•È¡¥Í1½¹I…¹”¤¹±•¹Ñ €ôôô€Ì¤Í½É”€´ô€äì(€¥˜€¡Ñ•…´¹™¥±Ñ•È¡¥ÍM¡½ÉÑI…¹”¤¹±•¹Ñ €ôôô€Ì€˜˜¥¹ÁÕÐ¹µ…À¹±…å½ÕÐ€ôôô€‰‰¥•ÉÑ¼ˆ¤Í½É”€´ô€ÄÈì(€¥˜€¡Ñ•…´¹™¥±Ñ•È¡¥ÍQ¡É½Ý•È¤¹±•¹Ñ €øô€È¤Í½É”€´ô€Üì(€É•ÑÕÉ¸±…µÀ¡Í½É”¤ì)ô()™Õ¹Ñ¥½¸µ…Ñ¡ÕÁEÕ…±¥Ñä¡Ñ•…´è	É…Ý±•Émt°½ÁÁ½¹•¹ÑÌè	É…Ý±•Émt¤ì(€¥˜€ …Ñ•…´¹±•¹Ñ ñð€…½ÁÁ½¹•¹ÑÌ¹±•¹Ñ ¤É•ÑÕÉ¸€ÔÀì(€±•Ð•‘”€ô€Àì(€™½È€¡½¹ÍÐ…±±ä½˜Ñ•…´¤ì(€€€™½È€¡½¹ÍÐ•¹•µä½˜½ÁÁ½¹•¹ÑÌ¤ì(€€€€€¥˜€¡¥¹±Õ‘•Í9…µ”¡…±±ä¹½Õ¹Ñ•ÉÌ°•¹•µä¹¹…µ”¤¤•‘”€¬ô€Øì(€€€€€¥˜€¡¥¹±Õ‘•Í9…µ”¡…±±ä¹½Õ¹Ñ•É•‘	ä°•¹•µä¹¹…µ”¤¤•‘”€´ô€Üì(€€€€€¥˜€¡¥¹±Õ‘•Í9…µ”¡•¹•µä¹½Õ¹Ñ•É•‘	ä°…±±ä¹¹…µ”¤¤•‘”€¬ô€Ìì(€€€€€¥˜€¡¥¹±Õ‘•Í9…µ”¡•¹•µä¹½Õ¹Ñ•ÉÌ°…±±ä¹¹…µ”¤¤•‘”€´ô€Ìì(€€€€€¥˜€¡¥Í¹Ñ¥Ñ…¹¬¡…±±ä¤€˜˜•¹•µä¹É½±”€ôôô€‰Q…¹ÅÕ”ˆ¤•‘”€¬ô€Èì(€€€€€¥˜€¡¥Í¹Ñ¥‘¥Ù”¡…±±ä¤€˜˜•¹•µä¹É½±”€ôôô€‰Í•Í¥¹¼ˆ¤•‘”€¬ô€Èì(€€€ô(€ô(€É•ÑÕÉ¸±…µÀ ÔÀ€¬•‘”¤ì)ô()™Õ¹Ñ¥½¸•ÍÑ¥µ…Ñ•]¥¹AÉ½‰…‰¥±¥Ñä¡¥¹ÁÕÐèÉ…™Ñ%¹ÁÕÐ°…±±¥•Ìè	É…Ý±•Émt°•¹•µ¥•Ìè	É…Ý±•Émt¤è]¥¹ÍÑ¥µ…Ñ”ðÕ¹‘•™¥¹•ì(€¥˜€¡…±±¥•Ì¹±•¹Ñ €ôôô€Àñð•¹•µ¥•Ì¹±•¹Ñ €ôôô€À¤É•ÑÕÉ¸Õ¹‘•™¥¹•ì((€½¹ÍÐ…±±å	…Í”€ôÁ…‘‘•‘Ù•É…”¡…±±¥•Ì¹µ…À ¡‰É…Ý±•È¤€ôø‰É…Ý±•É5…ÁMÑÉ•¹Ñ ¡‰É…Ý±•È°¥¹ÁÕÐ¤¤¤ì(€½¹ÍÐ•¹•µå	…Í”€ôÁ…‘‘•‘Ù•É…”¡•¹•µ¥•Ì¹µ…À ¡‰É…Ý±•È¤€ôø‰É…Ý±•É5…ÁMÑÉ•¹Ñ ¡‰É…Ý±•È°¥¹ÁÕÐ¤¤¤ì(€½¹ÍÐ…±±å½µÁ½Í¥Ñ¥½¸€ôÑ•…µ½µÁ½Í¥Ñ¥½¹EÕ…±¥Ñä¡…±±¥•Ì°¥¹ÁÕÐ¤ì(€½¹ÍÐ•¹•µå½µÁ½Í¥Ñ¥½¸€ôÑ•…µ½µÁ½Í¥Ñ¥½¹EÕ…±¥Ñä¡•¹•µ¥•Ì°¥¹ÁÕÐ¤ì(€½¹ÍÐ…±±å5…Ñ¡ÕÁÌ€ôµ…Ñ¡ÕÁEÕ…±¥Ñä¡…±±¥•Ì°•¹•µ¥•Ì¤ì(€½¹ÍÐ•¹•µå5…Ñ¡ÕÁÌ€ôµ…Ñ¡ÕÁEÕ…±¥Ñä¡•¹•µ¥•Ì°…±±¥•Ì¤ì((€±•Ð…±±¥•‘M½É”€ô…±±å	…Í”€¨€À¸ÌÐ€¬…±±å½µÁ½Í¥Ñ¥½¸€¨€À¸ÈÐ€¬…±±å5…Ñ¡ÕÁÌ€¨€À¸ÐÈì(€±•Ð•¹•µåM½É”€ô•¹•µå	…Í”€¨€À¸ÌÐ€¬•¹•µå½µÁ½Í¥Ñ¥½¸€¨€À¸ÈÐ€¬•¹•µå5…Ñ¡ÕÁÌ€¨€À¸ÐÈì((€½¹ÍÐÍ•±•Ñ•€ô…±±¥•Ì¹™¥¹ ¡‰É…Ý±•È¤€ôø¹½É´¡‰É…Ý±•È¹¹…µ”¤€ôôô¹½É´¡¥¹ÁÕÐ¹µåA¥¬ñð€ˆˆ¤¤ì(€½¹ÍÐÁ½½±¹ÑÉä€ôÍ•±•Ñ•€ü¥¹ÁÕÐ¹Á•ÉÍ½¹…±A½½°ü¹mÍ•±•Ñ•¹Í±Õt€èÕ¹‘•™¥¹•ì(€½¹ÍÐÁ½½±A½±¥ä€ô¥¹ÁÕÐ¹Á½½±A½±¥äñð€¡¥¹ÁÕÐ¹ÕÍ•A•ÉÍ½¹…±A½½°€ü€‰M½±¼Á½½°ˆ€è€‰=™˜ˆ¤ì(€¥˜€¡Á½½±A½±¥ä€„ôô€‰=™˜ˆ€˜˜Á½½±¹ÑÉä¤ì(€€€¥˜€¡Á½½±¹ÑÉä¹Á½Ý•ÈÄÄ¤…±±¥•‘M½É”€¬ô€Ä¸Ôì(€€€¥˜€¡Á½½±¹ÑÉä¹¡åÁ•É¡…É”¤…±±¥•‘M½É”€¬ô€Ä¸Èì(€€€¥˜€¡Á½½±¹ÑÉä¹™…Ù½É¥Ñ”¤…±±¥•‘M½É”€¬ô€¸àì(€€€…±±¥•‘M½É”€¬ô€¡Á½½±¹ÑÉä¹µ…ÍÑ•Éä€´€Ì¤€¨€Ä¸Äì(€€€¥˜€ …Á½½±¹ÑÉä¹…Ù…¥±…‰±”¤…±±¥•‘M½É”€´ô€È¸Ôì(€€€¥˜€¡Á½½±¹ÑÉä¹…Ù½¥¤…±±¥•‘M½É”€´ô€Ôì(€ô((€…±±¥•‘M½É”€ô5…Ñ ¹µ…à À°5…Ñ ¹µ¥¸ ÄÀÀ°…±±¥•‘M½É”¤¤ì(€•¹•µåM½É”€ô5…Ñ ¹µ…à À°5…Ñ ¹µ¥¸ ÄÀÀ°•¹•µåM½É”¤¤ì((€½¹ÍÐ‘•±Ñ„€ô…±±¥•‘M½É”€´•¹•µåM½É”ì(€½¹ÍÐÉ…ÝAÉ½‰…‰¥±¥Ñä€ô€ÄÀÀ€¼€ Ä€¬5…Ñ ¹•áÀ µ‘•±Ñ„€¼€ÄÌ¤¤ì(€½¹ÍÐÙ¥Í¥‰±•A¥­Ì€ô5…Ñ ¹µ¥¸ Ø°…±±¥•Ì¹±•¹Ñ €¬•¹•µ¥•Ì¹±•¹Ñ ¤ì(€½¹ÍÐ½µÁ±•Ñ•¹•ÍÌ€ô5…Ñ ¹É½Õ¹ ¡Ù¥Í¥‰±•A¥­Ì€¼€Ø¤€¨€ÄÀÀ¤ì(€½¹ÍÐÍ¡É¥¹­…Ñ½È€ô€À¸ÌÈ€¬€À¸Øà€¨€¡Ù¥Í¥‰±•A¥­Ì€¼€Ø¤ì(€½¹ÍÐÁ•É•¹Ñ…”€ô5…Ñ ¹µ…à Äà°5…Ñ ¹µ¥¸ àÈ°5…Ñ ¹É½Õ¹ ÔÀ€¬€¡É…ÝAÉ½‰…‰¥±¥Ñä€´€ÔÀ¤€¨Í¡É¥¹­…Ñ½È¤¤¤ì((€½¹ÍÐ…±±½µÁ±•Ñ”€ôl¸¸¹…±±¥•Ì°€¸¸¹•¹•µ¥•Ít¹•Ù•Éä ¡‰É…Ý±•È¤€ôø‰É…Ý±•È¹ÁÉ½™¥±•½µÁ±•Ñ”¤ì(€½¹ÍÐ½¹™¥‘•¹”è]¥¹ÍÑ¥µ…Ñ•l‰½¹™¥‘•¹”‰t€ô(€€€Ù¥Í¥‰±•A¥­Ì€ôôô€Ø€˜˜…±±½µÁ±•Ñ”€ü€‰±Ñ„ˆ€è(€€€Ù¥Í¥‰±•A¥­Ì€øô€Ô€ü€‰5•‘¥„ˆ€è€‰	…©„ˆì(€½¹ÍÐµ…É¥¸€ô½¹™¥‘•¹”€ôôô€‰±Ñ„ˆ€ü€Ô€è½¹™¥‘•¹”€ôôô€‰5•‘¥„ˆ€ü€ä€è€ÄÐì((€½¹ÍÐ™…Ù½É…‰±•A…¥ÉÌèÍÑÉ¥¹mt€ômtì(€½¹ÍÐÕ¹™…Ù½É…‰±•A…¥ÉÌèÍÑÉ¥¹mt€ômtì(€™½È€¡½¹ÍÐ…±±ä½˜…±±¥•Ì¤ì(€€€™½È€¡½¹ÍÐ•¹•µä½˜•¹•µ¥•Ì¤ì(€€€€€¥˜€¡¥¹±Õ‘•Í9…µ”¡…±±ä¹½Õ¹Ñ•ÉÌ°•¹•µä¹¹…µ”¤¤™…Ù½É…‰±•A…¥ÉÌ¹ÁÕÍ ¡€‘í…±±ä¹¹…µ•ô™É•¹„„€‘í•¹•µä¹¹…µ•õ€¤ì(€€€€€¥˜€¡¥¹±Õ‘•Í9…µ”¡…±±ä¹½Õ¹Ñ•É•‘	ä°•¹•µä¹¹…µ”¤¤Õ¹™…Ù½É…‰±•A…¥ÉÌ¹ÁÕÍ ¡€‘í•¹•µä¹¹…µ•ô™É•¹„„€‘í…±±ä¹¹…µ•õ€¤ì(€€€ô(€ô((€½¹ÍÐ…‘Ù…¹Ñ…•ÌèÍÑÉ¥¹mt€ômtì(€½¹ÍÐÉ¥Í­ÌèÍÑÉ¥¹mt€ômtì(€¥˜€¡…±±å	…Í”€øô•¹•µå	…Í”€¬€Ì¤…‘Ù…¹Ñ…•Ì¹ÁÕÍ  ‰5•©½È•¹…©”µ•‘¥¼½¸•°µ…Á„ä•°µ½‘¼ˆ¤ì(€¥˜€¡…±±å½µÁ½Í¥Ñ¥½¸€øô•¹•µå½µÁ½Í¥Ñ¥½¸€¬€Ð¤…‘Ù…¹Ñ…•Ì¹ÁÕÍ  ‰½µÁ½Í¥§Í¸…±¥…‘„·…Ì•ÅÕ¥±¥‰É…‘„ˆ¤ì(€¥˜€¡…±±å5…Ñ¡ÕÁÌ€øô•¹•µå5…Ñ¡ÕÁÌ€¬€Ð¤…‘Ù…¹Ñ…•Ì¹ÁÕÍ  ‰Y•¹Ñ…©„±½‰…°‘”µ…Ñ¡ÕÁÌˆ¤ì(€…‘Ù…¹Ñ…•Ì¹ÁÕÍ  ¸¸¹Õ¹¥ÅÕ”¡™…Ù½É…‰±•A…¥ÉÌ¤¹Í±¥” À°€È¤¤ì((€¥˜€¡•¹•µå	…Í”€øô…±±å	…Í”€¬€Ì¤É¥Í­Ì¹ÁÕÍ  ‰°É¥Ù…°Ñ¥•¹”µ•©½È…‘…ÁÑ…§Í¸µ•‘¥„…°µ…Á„ˆ¤ì(€¥˜€¡•¹•µå½µÁ½Í¥Ñ¥½¸€øô…±±å½µÁ½Í¥Ñ¥½¸€¬€Ð¤É¥Í­Ì¹ÁÕÍ  ‰1„½µÁ½Í¥§Í¸É¥Ù…°•ÍÓ„·…Ì½µÁ±•Ñ„ˆ¤ì(€¥˜€¡•¹•µå5…Ñ¡ÕÁÌ€øô…±±å5…Ñ¡ÕÁÌ€¬€Ð¤É¥Í­Ì¹ÁÕÍ  ‰°É¥Ù…°‘½µ¥¹„·…Ì•µÁ…É•©…µ¥•¹Ñ½Ì‘¥É•Ñ½Ìˆ¤ì(€É¥Í­Ì¹ÁÕÍ  ¸¸¹Õ¹¥ÅÕ”¡Õ¹™…Ù½É…‰±•A…¥ÉÌ¤¹Í±¥” À°€È¤¤ì(€¥˜€¡Ù¥Í¥‰±•A¥­Ì€ð€Ø¤É¥Í­Ì¹ÁÕÍ ¡ÍÑ¥µ…§Í¸ÁÉ½Ù¥Í¥½¹…°è™…±Ñ…¸€‘ìØ€´Ù¥Í¥‰±•A¥­ÍôÁ¥­ÌÁ½È¥¹ÑÉ½‘Õ¥É€¤ì((€½¹ÍÐÑ¥Ñ±”€ôÁ•É•¹Ñ…”€øô€ÔÜ€ü€‰Y•¹Ñ…©„…±¥…‘„ˆ€èÁ•É•¹Ñ…”€ðô€ÐÌ€ü€‰Y•¹Ñ…©„É¥Ù…°ˆ€è€‰É…™Ð•ÅÕ¥±¥‰É…‘¼ˆì((€É•ÑÕÉ¸ì(€€€Á•É•¹Ñ…”°(€€€±½Ý•Èè5…Ñ ¹µ…à ÄÀ°Á•É•¹Ñ…”€´µ…É¥¸¤°(€€€ÕÁÁ•Èè5…Ñ ¹µ¥¸ äÀ°Á•É•¹Ñ…”€¬µ…É¥¸¤°(€€€½¹™¥‘•¹”°(€€€½µÁ±•Ñ•¹•ÍÌ°(€€€…±±¥•‘M½É”è5…Ñ ¹É½Õ¹¡…±±¥•‘M½É”¤°(€€€•¹•µåM½É”è5…Ñ ¹É½Õ¹¡•¹•µåM½É”¤°(€€€Ñ¥Ñ±”°(€€€…‘Ù…¹Ñ…•ÌèÕ¹¥ÅÕ”¡…‘Ù…¹Ñ…•Ì¤¹Í±¥” À°€Ð¤°(€€€É¥Í­ÌèÕ¹¥ÅÕ”¡É¥Í­Ì¤¹Í±¥” À°€Ð¤°(€€€‘¥Í±…¥µ•Èè€‰ÍÑ¥µ…§Í¸¡•ÕËµÍÑ¥„‘•°‘É…™Ðì¹¼•ÌÕ¸Ý¥¸É…Ñ”½‰Í•ÉÙ…‘¼¹¤…É…¹Ñ¥é„•°É•ÍÕ±Ñ…‘¼‘”±„Á…ÉÑ¥‘„¸ˆ°(€ôì)ô()™Õ¹Ñ¥½¸É•½µµ•¹‘…Ñ¥½¹½¹™¥‘•¹” (€¥¹ÁÕÐèÉ…™Ñ%¹ÁÕÐ°(€É•½µµ•¹‘…Ñ¥½¹ÌèÉ…™ÑI•½µµ•¹‘…Ñ¥½¹mt°(€Ù¥Í¥‰±•A¥­Ìè¹Õµ‰•È°(¤èÉ…™Ñ½¹™¥‘•¹”ì(€½¹ÍÐ‰•ÍÐ€ôÉ•½µµ•¹‘…Ñ¥½¹ÍlÁtì(€½¹ÍÐÍ•½¹€ôÉ•½µµ•¹‘…Ñ¥½¹ÍlÅtì(€½¹ÍÐ…À€ô‰•ÍÐ€˜˜Í•½¹€ü5…Ñ ¹µ…à À°‰•ÍÐ¹Í½É”€´Í•½¹¹Í½É”¤€è€Àì(€½¹ÍÐÁÉ½™¥±•EÕ…±¥Ñä€ôÉ•½µµ•¹‘…Ñ¥½¹Ì¹Í±¥” À°€Ì¤¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹‰É…Ý±•È¹ÁÉ½™¥±•½µÁ±•Ñ”¤¹±•¹Ñ ì(€½¹ÍÐµ…Á½¹™¥‘•¹”€ô¥¹ÁÕÐ¹µ…À¹™¥ÉÍÑA¥­½¹™¥‘•¹”€ôôô€‰±Ñ„ˆ€ü€Ü€è¥¹ÁÕÐ¹µ…À¹™¥ÉÍÑA¥­½¹™¥‘•¹”€ôôô€‰	…©„ˆ€ü€´Ø€è€Àì(€½¹ÍÐ¥¹™½Éµ…Ñ¥½¸€ô¥¹ÁÕÐ¹Á½Í¥Ñ¥½¸€ôôô€‰¥ÉÍÐÁ¥¬ˆ€ü€È€è5…Ñ ¹µ¥¸ ÄÔ°Ù¥Í¥‰±•A¥­Ì€¨€Ì¤ì(€½¹ÍÐ•áÁ½ÍÕÉ•A•¹…±Ñä€ô‰•ÍÐ€ü‰•ÍÐ¹•áÁ½Í•‘Q¼¹±•¹Ñ €¨€Ü€è€ÄÀì(€½¹ÍÐÍ½É”€ô±…µÀ Ðà€¬…À€¨€Ð€¬ÁÉ½™¥±•EÕ…±¥Ñä€¨€Ì€¬µ…Á½¹™¥‘•¹”€¬¥¹™½Éµ…Ñ¥½¸€´•áÁ½ÍÕÉ•A•¹…±Ñä¤ì(€½¹ÍÐ±…‰•°èÉ…™Ñ½¹™¥‘•¹•l‰±…‰•°‰t€ôÍ½É”€øô€ÜÔ€ü€‰±Ñ„ˆ€èÍ½É”€øô€Ôà€ü€‰5•‘¥„ˆ€è€‰	…©„ˆì(€½¹ÍÐÉ•…Í½¹ÌèÍÑÉ¥¹mt€ômtì(€½¹ÍÐ…ÕÑ¥½¹ÌèÍÑÉ¥¹mt€ômtì((€¥˜€¡…À€øô€Ü¤É•…Í½¹Ì¹ÁÕÍ ¡Y•¹Ñ…©„±…É„‘”€‘í…ÁôÁÕ¹Ñ½ÌÍ½‰É”±„Í•Õ¹‘„½Á§Í¹€¤ì(€•±Í”¥˜€¡…À€øô€Ì¤É•…Í½¹Ì¹ÁÕÍ ¡5…É•¸‘”€‘í…ÁôÁÕ¹Ñ½ÌÍ½‰É”±„…±Ñ•É¹…Ñ¥Ù…€¤ì(€•±Í”…ÕÑ¥½¹Ì¹ÁÕÍ  ‰1…ÌÁÉ¥µ•É…Ì½Á¥½¹•Ì•ÍÓ…¸µÕä¥Õ…±…‘…Ìˆ¤ì(€¥˜€¡Ù¥Í¥‰±•A¥­Ì€øô€Ô¤É•…Í½¹Ì¹ÁÕÍ  ‰°‘É…™Ð…Á½ÉÑ„…Í¤Ñ½‘„±„¥¹™½Éµ…§Í¸‘”µ…Ñ¡ÕÁÌˆ¤ì(€¥˜€¡ÁÉ½™¥±•EÕ…±¥Ñä€ôôô€Ì¤É•…Í½¹Ì¹ÁÕÍ  ‰1½ÌÑÉ•Ì…¹‘¥‘…Ñ½ÌÁÉ¥¹¥Á…±•ÌÑ¥•¹•¸Á•É™¥°½µÁ±•Ñ¼ˆ¤ì(€¥˜€¡¥¹ÁÕÐ¹Á½Í¥Ñ¥½¸€ôôô€‰¥ÉÍÐÁ¥¬ˆ¤…ÕÑ¥½¹Ì¹ÁÕÍ  ‰é¸¹¼Í”½¹½•¸±½Ì½Õ¹Ñ•ÉÌÉ¥Ù…±•Ìˆ¤ì(€¥˜€¡‰•ÍÐü¹•áÁ½Í•‘Q¼¹±•¹Ñ ¤…ÕÑ¥½¹Ì¹ÁÕÍ ¡°Á¥¬ÁÉ¥¹¥Á…°ÅÕ•‘„•áÁÕ•ÍÑ¼„€‘í‰•ÍÐ¹•áÁ½Í•‘Q¼¹©½¥¸ ˆä€ˆ¥õ€¤ì(€¥˜€ (€€€‰•ÍÐü¹™¥ÉÍÑA¥­Ù…±Õ…Ñ¥½¸€˜˜(€€€‰•ÍÐ¹™¥ÉÍÑA¥­Ù…±Õ…Ñ¥½¸¹…™Ñ•É	É•…­¥Ð€øô‰•ÍÐ¹™¥ÉÍÑA¥­Ù…±Õ…Ñ¥½¸¹¥¹¥Ñ¥…±¥Ð€¬€ÄÔ€˜˜(€€€‰•ÍÐ¹™¥ÉÍÑA¥­Ù…±Õ…Ñ¥½¸¹½Á•¹¥¹AÉ½‰…‰¥±¥Ñä€ð€ÌÀ(€€¤ì(€€€…ÕÑ¥½¹Ì¹ÁÕÍ  ‰A…ÉÑ”‘”ÍÔÙ…±½È‘•Á•¹‘”‘”ÅÕ”•°…µÁ¼Í”…‰É„ˆ¤ì(€ô((€É•ÑÕÉ¸ìÍ½É”°±…‰•°°…À°É•…Í½¹ÌèÕ¹¥ÅÕ”¡É•…Í½¹Ì¤¹Í±¥” À°€Ì¤°…ÕÑ¥½¹ÌèÕ¹¥ÅÕ”¡…ÕÑ¥½¹Ì¤¹Í±¥” À°€Ì¤ôì)ô()™Õ¹Ñ¥½¸‘É…™Ñ¡•­±¥ÍÐ¡¥¹ÁÕÐèÉ…™Ñ%¹ÁÕÐ°…±±¥•Ìè	É…Ý±•Émt°•¹•µ¥•Ìè	É…Ý±•Émt¤èÉ…™Ñ¡•­±¥ÍÑ%Ñ•µmtì(€½¹ÍÐ¥Ñ•µÌèÉ…™Ñ¡•­±¥ÍÑ%Ñ•µmt€ômtì(€½¹ÍÐ…‘€ô€¡±…‰•°èÍÑÉ¥¹œ°½Ù•É•è‰½½±•…¸°Á…ÉÑ¥…°è‰½½±•…¸°‘•Ñ…¥°èÍÑÉ¥¹œ¤€ôø¥Ñ•µÌ¹ÁÕÍ ¡ì(€€€±…‰•°°(€€€ÍÑ…ÑÕÌè½Ù•É•€ü€‰Õ‰¥•ÉÑ¼ˆ€èÁ…ÉÑ¥…°€ü€‰A…É¥…°ˆ€è€‰…±Ñ„ˆ°(€€€‘•Ñ…¥°°(€ô¤ì((€½¹ÍÐÉ½±•Ì€ô¹•ÜM•Ð¡…±±¥•Ì¹µ…À ¡…±±ä¤€ôø…±±ä¹É½±”¤¤ì(€…‘ ‰¥Ù•ÉÍ¥‘…‘”É½±•Ìˆ°É½±•Ì¹Í¥é”€øô5…Ñ ¹µ¥¸ Ì°…±±¥•Ì¹±•¹Ñ ¤°É½±•Ì¹Í¥é”€øô€È°É½±•Ì¹Í¥é”€øô€È€ü€‘íÉ½±•Ì¹Í¥é•ô™Õ¹¥½¹•Ì‘¥ÍÑ¥¹Ñ…Í€€è€‰•µ…Í¥…‘½ÌÁ¥­Ì½¸±„µ¥Íµ„™Õ¹§Í¸ˆ¤ì((€¥˜€¡¥¹ÁÕÐ¹µ…À¹±…å½ÕÐ€ôôô€‰‰¥•ÉÑ¼ˆñð€¡¥¹ÁÕÐ¹µ…À¹•½µ•ÑÉäü¹½Á•¹¹•ÍÌñð€À¤€øô€ØÀ¤ì(€€€½¹ÍÐÉ…¹•€ô…±±¥•Ì¹™¥±Ñ•È¡¥Í1½¹I…¹”¤¹±•¹Ñ ì(€€€…‘ ‰I…¹¼•ÍÑ…‰±”ˆ°É…¹•€øô€Ä°É…¹•€ôôô€À€˜˜…±±¥•Ì¹Í½µ”¡¥Í½¹ÑÉ½°¤°É…¹•€ü€‘íÉ…¹•‘ô½Á§Í¸‘íÉ…¹•€ø€Ä€ü€‰•Ìˆ€è€ˆ‰ô‘”É…¹¼±…É½€€è€‰…±Ñ„…±…¹”Á…É„±…Ì³µ¹•…Ì¥¹¥¥…±•Ìˆ¤ì(€ô(€¥˜€¡l‰i½¹„I•ÍÑÉ¥¹¥‘„ˆ°€‰ÑÉ…Á…•µ…Ìˆ°€‰	…³Í¸	É…Ý°‰t¹¥¹±Õ‘•Ì¡¥¹ÁÕÐ¹µ…À¹µ½‘”¤¤ì(€€€…‘ ‰½¹ÑÉ½°‘”•ÍÁ…¥¼ˆ°…±±¥•Ì¹Í½µ”¡¥Í½¹ÑÉ½°¤°…±±¥•Ì¹Í½µ”¡¥ÍMÕÁÁ½ÉÐ¤°…±±¥•Ì¹Í½µ”¡¥Í½¹ÑÉ½°¤€ü€‰!…äÕ¹„¡•ÉÉ…µ¥•¹Ñ„±…É„‘”½¹ÑÉ½°ˆ€è€‰°µ½‘¼•á¥”‘¥ÍÁÕÑ…Èé½¹…Ìä…•Í½Ìˆ¤ì(€ô(€¥˜€¡•¹•µ¥•Ì¹Í½µ” ¡•¹•µä¤€ôø•¹•µä¹É½±”€ôôô€‰Q…¹ÅÕ”ˆñð¡…ÍQ…œ¡•¹•µä°€‰Ñ…¹¬ˆ°€‰Ñ…¹ÅÕ”ˆ¤¤¤ì(€€€…‘ ‰I•ÍÁÕ•ÍÑ„…¹Ñ¥Ñ…¹ÅÕ”ˆ°…±±¥•Ì¹Í½µ”¡¥Í¹Ñ¥Ñ…¹¬¤°…±±¥•Ì¹Í½µ”¡¥Í½¹ÑÉ½°¤°…±±¥•Ì¹Í½µ”¡¥Í¹Ñ¥Ñ…¹¬¤€ü€‰‡Å¼Í½ÍÑ•¹¥‘¼½¹ÑÉ„ÁÉ¥µ•É„³µ¹•„ˆ€è€‰°É¥Ù…°ÁÕ•‘”…Ù…¹é…ÈÍ¥¸…ÍÑ¥¼•ÍÁ•µ™¥¼ˆ¤ì(€ô(€¥˜€¡•¹•µ¥•Ì¹Í½µ” ¡•¹•µä¤€ôø•¹•µä¹É½±”€ôôô€‰Í•Í¥¹¼ˆñð¡…ÍQ…œ¡•¹•µä°€‰…ÍÍ…ÍÍ¥¸ˆ°€‰…Í•Í¥¹¼ˆ°€‰µ½‰¥±”ˆ¤¤¤ì(€€€…‘ ‰AÉ½Ñ•§Í¸…¹Ñ¥‘¥Ù”ˆ°…±±¥•Ì¹Í½µ”¡¥Í¹Ñ¥‘¥Ù”¤°…±±¥•Ì¹Í½µ”¡¥ÍÉ½¹Ñ±¥¹”¤°…±±¥•Ì¹Í½µ”¡¥Í¹Ñ¥‘¥Ù”¤€ü€‰°‰…­±¥¹”‘¥ÍÁ½¹”‘”Á••°ˆ€è€‰…±Ñ„Õ¹„É•ÍÁÕ•ÍÑ„™¥…‰±”„±„•¹ÑÉ…‘„É¥Ù…°ˆ¤ì(€ô(€¥˜€¡¥¹ÁÕÐ¹µ…À¹µ½‘”€ôôô€‰ÑÉ…¼ˆ¤ì(€€€…‘ ‰‡Å¼…°½‰©•Ñ¥Ù¼ˆ°…±±¥•Ì¹Í½µ”¡¥Í=‰©•Ñ¥Ù”¤°…±±¥•Ì¹Í½µ” ¡…±±ä¤€ôø¡…ÍQ…œ¡…±±ä°€‰‘…µ…”ˆ¤¤°…±±¥•Ì¹Í½µ”¡¥Í=‰©•Ñ¥Ù”¤€ü€‰1„½µÁ½Í¥§Í¸…µ•¹…é„±„…©„ˆ€è€‰A½„½¹Ù•ÉÍ§Í¸Í½‰É”•°½‰©•Ñ¥Ù¼ˆ¤ì(€ô((€½¹ÍÐ•½µ•ÑÉä€ô¥¹ÁÕÐ¹µ…À¹•½µ•ÑÉäì(€¥˜€¡•½µ•ÑÉä€˜˜•½µ•ÑÉä¹Ý…±±•¹Í¥Ñä€øô€ÔÔ€˜˜•½µ•ÑÉä¹‘•ÍÑÉÕÑ¥‰¥±¥Ñä€øô€ÔÔ¤ì(€€€½¹ÍÐ‰É•…­•ÉÌ€ô…±±¥•Ì¹™¥±Ñ•È¡¡…Í]…±±‰É•…¬¤¹±•¹Ñ ì(€€€…‘ (€€€€€€‰Á•ÉÑÕÉ„‘•°…µÁ¼ˆ°(€€€€€‰É•…­•ÉÌ€øô€Ä°(€€€€€•½µ•ÑÉä¹‘•ÍÑÉÕÑ¥‰¥±¥Ñä€øô€ÜÔ°(€€€€€‰É•…­•ÉÌ€øô€Ä(€€€€€€€€ü€‘í‰É•…­•ÉÍô¡•ÉÉ…µ¥•¹Ñ„‘í‰É•…­•ÉÌ€ø€Ä€ü€‰Ìˆ€è€ˆ‰ôÁÉ½Á¥„‘í‰É•…­•ÉÌ€ø€Ä€ü€‰Ìˆ€è€ˆ‰ôÁ…É„…‰É¥ÈµÕÉ½Í€(€€€€€€€€è€‰°µ…Á„•ÌÉ½µÁ¥‰±”°Á•É¼ÑÔ½µÁ½Í¥§Í¸¹¼…É…¹Ñ¥é„…‰É¥É±¼ˆ°(€€€€¤ì(€ô((€É•ÑÕÉ¸¥Ñ•µÌ¹Í±¥” À°€Ø¤ì)ô()•áÁ½ÉÐ™Õ¹Ñ¥½¸…¹…±åé•É…™Ð¡¥¹ÁÕÐèÉ…™Ñ%¹ÁÕÐ°É½ÍÑ•Èè	É…Ý±•Émt¤èÉ…™Ñ¹…±åÍ¥Ìì(€½¹ÍÐÕ¹…Ù…¥±…‰±”€ô¹•ÜM•Ð¡l¸¸¹¥¹ÁÕÐ¹…±±¥•Ì°€¸¸¹¥¹ÁÕÐ¹•¹•µ¥•Ì°€¸¸¹¥¹ÁÕÐ¹‰…¹Ì°¥¹ÁÕÐ¹µåA¥¬ñð€ˆ‰t¹™¥±Ñ•È¡	½½±•…¸¤¹µ…À¡¹½É´¤¤ì(€½¹ÍÐ•¹•µ¥•Ì€ô™¥¹‘AÉ½™¥±•Ì¡¥¹ÁÕÐ¹•¹•µ¥•Ì°É½ÍÑ•È¤ì(€½¹ÍÐ½Ñ¡•É±±¥•Ì€ô™¥¹‘AÉ½™¥±•Ì¡¥¹ÁÕÐ¹…±±¥•Ì°É½ÍÑ•È¤ì(€½¹ÍÐÍ•±•Ñ•‘AÉ½™¥±”€ô¥¹ÁÕÐ¹µåA¥¬(€€€€üÉ½ÍÑ•È¹™¥¹ ¡‰É…Ý±•È¤€ôø¹½É´¡‰É…Ý±•È¹¹…µ”¤€ôôô¹½É´¡¥¹ÁÕÐ¹µåA¥¬ñð€ˆˆ¤¤(€€€€èÕ¹‘•™¥¹•ì(€½¹ÍÐ™Õ±±±±¥•Ì€ôÍ•±•Ñ•‘AÉ½™¥±”€ül¸¸¹½Ñ¡•É±±¥•Ì°Í•±•Ñ•‘AÉ½™¥±•t€è½Ñ¡•É±±¥•Ìì((€½¹ÍÐÉ•½µµ•¹‘…Ñ¥½¹9••‘Ì€ôÑ•…µ9••‘Ì¡¥¹ÁÕÐ°½Ñ¡•É±±¥•Ì°•¹•µ¥•Ì¤ì(€½¹ÍÐ™¥¹…±9••‘Ì€ôÑ•…µ9••‘Ì¡¥¹ÁÕÐ°™Õ±±±±¥•Ì°•¹•µ¥•Ì¤ì(€½¹ÍÐÑ¡É•…ÑÌ€ô‘É…™ÑQ¡É•…ÑÌ¡™Õ±±±±¥•Ì°•¹•µ¥•Ì¤ì(€½¹ÍÐÍÑÉ•¹Ñ¡Ì€ô‘É…™ÑMÑÉ•¹Ñ¡Ì¡¥¹ÁÕÐ°™Õ±±±±¥•Ì°•¹•µ¥•Ì¤ì((€½¹ÍÐÉ•½µµ•¹‘…Ñ¥½¹Ì€ôÉ½ÍÑ•È(€€€€¹™¥±Ñ•È ¡‰É…Ý±•È¤€ôø€…Õ¹…Ù…¥±…‰±”¹¡…Ì¡¹½É´¡‰É…Ý±•È¹¹…µ”¤¤¤(€€€€¹™¥±Ñ•È ¡‰É…Ý±•È¤€ôøì(€€€€€½¹ÍÐÁ½½±A½±¥ä€ô¥¹ÁÕÐ¹Á½½±A½±¥äñð€¡¥¹ÁÕÐ¹ÕÍ•A•ÉÍ½¹…±A½½°€ü€‰M½±¼Á½½°ˆ€è€‰=™˜ˆ¤ì(€€€€€¥˜€¡Á½½±A½±¥ä€„ôô€‰M½±¼Á½½°ˆ¤É•ÑÕÉ¸ÑÉÕ”ì(€€€€€½¹ÍÐ•¹ÑÉä€ô¥¹ÁÕÐ¹Á•ÉÍ½¹…±A½½°ü¹m‰É…Ý±•È¹Í±Õtì(€€€€€¥˜€ …•¹ÑÉä¤É•ÑÕÉ¸™…±Í”ì(€€€€€É•ÑÕÉ¸•¹ÑÉä¹…Ù…¥±…‰±”€˜˜€…•¹ÑÉä¹…Ù½¥ì(€€€ô¤(€€€€¹µ…À ¡‰É…Ý±•È¤€ôøÍ½É•…¹‘¥‘…Ñ”¡‰É…Ý±•È°¥¹ÁÕÐ°½Ñ¡•É±±¥•Ì°•¹•µ¥•Ì°É•½µµ•¹‘…Ñ¥½¹9••‘Ì¤¤(€€€€¹Í½ÉÐ ¡„°ˆ¤€ôøì(€€€€€¥˜€¡¥¹ÁÕÐ¹Á½Í¥Ñ¥½¸€ôôô€‰¥ÉÍÐÁ¥¬ˆ¤ì(€€€€€€€½¹ÍÐ…ÕÉ…Ñ•€ô¥¹ÁÕÐ¹µ…À¹™¥ÉÍÑA¥­Ì¹¥¹‘•á=˜¡„¹‰É…Ý±•È¹¹…µ”¤ì(€€€€€€€½¹ÍÐ‰ÕÉ…Ñ•€ô¥¹ÁÕÐ¹µ…À¹™¥ÉÍÑA¥­Ì¹¥¹‘•á=˜¡ˆ¹‰É…Ý±•È¹¹…µ”¤ì(€€€€€€€É•ÑÕÉ¸ˆ¹Í½É”€´„¹Í½É”ñð(€€€€€€€€€€¡ˆ¹™¥ÉÍÑA¥­Ù…±Õ…Ñ¥½¸ü¹•áÁ•Ñ•‘5…Á¥Ðñð€À¤€´€¡„¹™¥ÉÍÑA¥­Ù…±Õ…Ñ¥½¸ü¹•áÁ•Ñ•‘5…Á¥Ðñð€À¤ñð(€€€€€€€€€€¡…ÕÉ…Ñ•€ð€À€ü€ää€è…ÕÉ…Ñ•¤€´€¡‰ÕÉ…Ñ•€ð€À€ü€ää€è‰ÕÉ…Ñ•¤ì(€€€€€ô(€€€€€¥˜€¡¥¹ÁÕÐ¹Á½Í¥Ñ¥½¸€ôôô€‰1…ÍÐÁ¥¬ˆ€˜˜•¹•µ¥•Ì¹±•¹Ñ ¤ì(€€€€€€€½¹ÍÐ…½Ù•É…”€ô„¹½Õ¹Ñ•ÉÍ!¥Ð¹±•¹Ñ €¨€Ð€¬„¹Í½™Ñ½Õ¹Ñ•ÉÌ¹±•¹Ñ €¨€Ä¸Ð€´„¹•áÁ½Í•‘Q¼¹±•¹Ñ €¨€Ìì(€€€€€€€½¹ÍÐ‰½Ù•É…”€ôˆ¹½Õ¹Ñ•ÉÍ!¥Ð¹±•¹Ñ €¨€Ð€¬ˆ¹Í½™Ñ½Õ¹Ñ•ÉÌ¹±•¹Ñ €¨€Ä¸Ð€´ˆ¹•áÁ½Í•‘Q¼¹±•¹Ñ €¨€Ìì(€€€€€€€É•ÑÕÉ¸ˆ¹Í½É”€´„¹Í½É”ñð‰½Ù•É…”€´…½Ù•É…”ñðˆ¹µ•ÑÉ¥Ì¹½Õ¹Ñ•È€´„¹µ•ÑÉ¥Ì¹½Õ¹Ñ•Èñð„¹µ•ÑÉ¥Ì¹É¥Í¬€´ˆ¹µ•ÑÉ¥Ì¹É¥Í¬ì(€€€€€ô(€€€€€¥˜€¡•¹•µ¥•Ì¹±•¹Ñ ¤ì(€€€€€€€½¹ÍÐ…½Ù•É…”€ô„¹½Õ¹Ñ•ÉÍ!¥Ð¹±•¹Ñ €¨€È¸Ô€¬„¹Í½™Ñ½Õ¹Ñ•ÉÌ¹±•¹Ñ €´„¹•áÁ½Í•‘Q¼¹±•¹Ñ €¨€Ä¸Ôì(€€€€€€€½¹ÍÐ‰½Ù•É…”€ôˆ¹½Õ¹Ñ•ÉÍ!¥Ð¹±•¹Ñ €¨€È¸Ô€¬ˆ¹Í½™Ñ½Õ¹Ñ•ÉÌ¹±•¹Ñ €´ˆ¹•áÁ½Í•‘Q¼¹±•¹Ñ €¨€Ä¸Ôì(€€€€€€€É•ÑÕÉ¸ˆ¹Í½É”€´„¹Í½É”ñð‰½Ù•É…”€´…½Ù•É…”ñðˆ¹µ•ÑÉ¥Ì¹½Õ¹Ñ•È€´„¹µ•ÑÉ¥Ì¹½Õ¹Ñ•Èñðˆ¹µ•ÑÉ¥Ì¹½µÁ½Í¥Ñ¥½¸€´„¹µ•ÑÉ¥Ì¹½µÁ½Í¥Ñ¥½¸ì(€€€€€ô(€€€€€É•ÑÕÉ¸ˆ¹Í½É”€´„¹Í½É”ñðˆ¹µ•ÑÉ¥Ì¹½Õ¹Ñ•È€´„¹µ•ÑÉ¥Ì¹½Õ¹Ñ•Èñðˆ¹µ•ÑÉ¥Ì¹Í…™•Ñä€´„¹µ•ÑÉ¥Ì¹Í…™•Ñäì(€€€ô¤(€€€€¹Í±¥” À°€ÄØ¤ì((€½¹ÍÐÍ•±•Ñ•‘A¥¬€ôÍ•±•Ñ•‘AÉ½™¥±”(€€€€üÍ½É•…¹‘¥‘…Ñ”¡Í•±•Ñ•‘AÉ½™¥±”°¥¹ÁÕÐ°½Ñ¡•É±±¥•Ì°•¹•µ¥•Ì°É•½µµ•¹‘…Ñ¥½¹9••‘Ì¤(€€€€èÕ¹‘•™¥¹•ì(€½¹ÍÐ½…¡…¹‘¥‘…Ñ”€ôÍ•±•Ñ•‘AÉ½™¥±”ñð€¡™Õ±±±±¥•Ì¹±•¹Ñ €ð€Ì€üÉ•½µµ•¹‘…Ñ¥½¹ÍlÁtü¹‰É…Ý±•È€èÕ¹‘•™¥¹•¤ì(€½¹ÍÐÙ¥Í¥‰±•A¥­Ì€ô™Õ±±±±¥•Ì¹±•¹Ñ €¬•¹•µ¥•Ì¹±•¹Ñ ì(€½¹ÍÐÁÉ½©•Ñ•‘±±¥•Ì€ôÍ•±•Ñ•‘AÉ½™¥±”(€€€€ü™Õ±±±±¥•Ì(€€€€èÉ•½µµ•¹‘…Ñ¥½¹ÍlÁt(€€€€€€ül¸¸¹™Õ±±±±¥•Ì°É•½µµ•¹‘…Ñ¥½¹ÍlÁt¹‰É…Ý±•Ét(€€€€€€è™Õ±±±±¥•Ìì(€½¹ÍÐ‘É…™ÑMÑ…”€ôÍ•±•Ñ•‘AÉ½™¥±”(€€€€üÙ¥Í¥‰±•A¥­Ì€øô€Ø(€€€€€€ü€‰É…™Ð½µÁ±•Ñ¼è•Ù…±Õ…¹‘¼±½Ì‘½Ì•ÅÕ¥Á½Ìˆ(€€€€€€è€‰QÔÁ¥¬•ÍÓ„Í•±•¥½¹…‘¼è•Ù…±Õ…§Í¸ÁÉ½Ù¥Í¥½¹…°ˆ(€€€€è¥¹ÁÕÐ¹Á½Í¥Ñ¥½¸€ôôô€‰¥ÉÍÐÁ¥¬ˆ(€€€€€€ü€‰¥ÉÍÐÁ¥¬èÁÉ¥½É¥é…¹‘¼Í½±¥‘•è°µ•Ñ„‘•°µ…Á„ä‰…©„•áÁ½Í¥§Í¸ˆ(€€€€€€è¥¹ÁÕÐ¹Á½Í¥Ñ¥½¸€ôôô€‰1…ÍÐÁ¥¬ˆ(€€€€€€€€ü€‰1…ÍÐÁ¥¬è‰ÕÍ…¹‘¼•°·…á¥µ¼…ÍÑ¥¼½¹ÑÉ„±„½µÁ½Í¥§Í¸½µÁ±•Ñ„ˆ(€€€€€€€€è¥¹ÁÕÐ¹•¹•µ¥•Ì¹±•¹Ñ (€€€€€€€€€€ü€‰A¥­Ì¥¹Ñ•Éµ•‘¥½Ìè½Õ¹Ñ•É•…È…°É¥Ù…°Í¥¸É½µÁ•È±„½µÁ½Í¥§Í¸ˆ(€€€€€€€€€€è€‰A¥­Ì¥¹Ñ•Éµ•‘¥½Ìè•ÍÁ•É…¹‘¼¥¹™½Éµ…§Í¸É¥Ù…°äµ…¹Ñ•¹¥•¹‘¼™±•á¥‰¥±¥‘…ˆì((€É•ÑÕÉ¸ì(€€€É•½µµ•¹‘…Ñ¥½¹Ì°(€€€Í•±•Ñ•‘A¥¬°(€€€Ý¥¹ÍÑ¥µ…Ñ”è™Õ±±±±¥•Ì¹±•¹Ñ €˜˜•¹•µ¥•Ì¹±•¹Ñ €ü•ÍÑ¥µ…Ñ•]¥¹AÉ½‰…‰¥±¥Ñä¡¥¹ÁÕÐ°™Õ±±±±¥•Ì°•¹•µ¥•Ì¤€èÕ¹‘•™¥¹•°(€€€¹••‘Ìè™¥¹…±9••‘Ì°(€€€Ñ¡É•…ÑÌ°(€€€ÍÑÉ•¹Ñ¡Ì°(€€€•¹•µå]•…­¹•ÍÍ•Ìè•¹•µå]•…­¹•ÍÍ•Ì¡¥¹ÁÕÐ°•¹•µ¥•Ì¤°(€€€‰…¹I•½µµ•¹‘…Ñ¥½¹Ìè‰…¹I•½µµ•¹‘…Ñ¥½¹Ì¡¥¹ÁÕÐ°É½ÍÑ•È°™Õ±±±±¥•Ì¤°(€€€ÁÉ•‘¥Ñ•‘¹•µåA¥­ÌèÁÉ•‘¥Ñ¹•µåA¥­Ì¡¥¹ÁÕÐ°É½ÍÑ•È°™Õ±±±±¥•Ì°•¹•µ¥•Ì¤°(€€€Ñ•…µÍÍ¥¹µ•¹ÑÌè±…¹•ÍÍ¥¹µ•¹ÑÌ¡½…¡…¹‘¥‘…Ñ”°Í•±•Ñ•‘AÉ½™¥±”€ü½Ñ¡•É±±¥•Ì€è™Õ±±±±¥•Ì°•¹•µ¥•Ì°¥¹ÁÕÐ¤°(€€€½µÁ½Í¥Ñ¥½¹M½É”è½µÁ½Í¥Ñ¥½¹M½É”¡Í•±•Ñ•‘AÉ½™¥±”€ü½Ñ¡•É±±¥•Ì€è™Õ±±±±¥•Ì°½…¡…¹‘¥‘…Ñ”°™¥¹…±9••‘Ì¤°(€€€‘É…™ÑMÑ…”°(€€€…Ù…¥±…‰±•½Õ¹ÐèÉ½ÍÑ•È¹±•¹Ñ €´Õ¹…Ù…¥±…‰±”¹Í¥é”°(€€€½¹™¥‘•¹”èÉ•½µµ•¹‘…Ñ¥½¹½¹™¥‘•¹”¡¥¹ÁÕÐ°É•½µµ•¹‘…Ñ¥½¹Ì°Ù¥Í¥‰±•A¥­Ì¤°(€€€¡•­±¥ÍÐè‘É…™Ñ¡•­±¥ÍÐ¡¥¹ÁÕÐ°ÁÉ½©•Ñ•‘±±¥•Ì°•¹•µ¥•Ì¤°(€ôì)ô()•áÁ½ÉÐ™Õ¹Ñ¥½¸É•½µµ•¹‘É…™Ð¡¥¹ÁÕÐèÉ…™Ñ%¹ÁÕÐ°É½ÍÑ•Èè	É…Ý±•Émt¤èÉ…™ÑI•½µµ•¹‘…Ñ¥½¹mtì(€É•ÑÕÉ¸…¹…±åé•É…™Ð¡¥¹ÁÕÐ°É½ÍÑ•È¤¹É•½µµ•¹‘…Ñ¥½¹Ìì)ô