import { readFile } from "node:fs/promises";

const maps = JSON.parse(await readFile(new URL("../src/data/maps.json", import.meta.url), "utf8"));
const brawlers = JSON.parse(await readFile(new URL("../src/data/brawlers.json", import.meta.url), "utf8"));
const roster = new Map(brawlers.map((brawler) => [brawler.name, brawler]));

const geometryFields = [
  "openness",
  "bushDensity",
  "wallDensity",
  "destructibility",
  "chokeDensity",
  "laneWidth",
  "waterInfluence",
  "afterBreakOpenness",
  "afterBreakWalls",
];

const profileFields = [
  "blindSafety",
  "openFit",
  "closedFit",
  "bushFit",
  "wallReliance",
  "postBreakFit",
  "vision",
  "wallBreak",
  "antiDive",
  "mobility",
  "objective",
  "control",
  "chokeControl",
  "teamDependence",
  "counterRisk",
];

const errors = [];
const warnings = [];

for (const brawler of brawlers) {
  if (!brawler.firstPickProfile) {
    errors.push(`${brawler.name}: falta firstPickProfile`);
    continue;
  }
  for (const field of profileFields) {
    const value = brawler.firstPickProfile[field];
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      errors.push(`${brawler.name}.${field}: valor inválido ${value}`);
    }
  }
  if (brawler.firstPickProfileVersion !== "v0.12") {
    errors.push(`${brawler.name}: versión de perfil incorrecta`);
  }
  if (!brawler.firstPickProfileReviewedAt) {
    errors.push(`${brawler.name}: falta fecha de revisión`);
  }
}

for (const map of maps) {
  if (!map.geometry) {
    errors.push(`${map.name}: falta geometry`);
    continue;
  }

  for (const field of geometryFields) {
    const value = map.geometry[field];
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      errors.push(`${map.name}.geometry.${field}: valor inválido ${value}`);
    }
  }

  if (map.firstPickModelVersion !== "v0.12") {
    errors.push(`${map.name}: versión del modelo incorrecta`);
  }

  if (!Array.isArray(map.firstPickCandidates) || map.firstPickCandidates.length < 6) {
    errors.push(`${map.name}: debe guardar al menos seis candidatos`);
    continue;
  }

  const candidateNames = map.firstPickCandidates.map((candidate) => candidate.name);
  if (new Set(candidateNames).size !== candidateNames.length) {
    errors.push(`${map.name}: candidatos duplicados`);
  }

  if (JSON.stringify(candidateNames.slice(0, 3)) !== JSON.stringify(map.firstPicks)) {
    errors.push(`${map.name}: los tres primeros candidatos no coinciden con firstPicks`);
  }

  for (const candidate of map.firstPickCandidates) {
    if (!roster.has(candidate.name)) errors.push(`${map.name}: candidato inexistente ${candidate.name}`);
    if (!Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 100) {
      errors.push(`${map.name}: score inválido para ${candidate.name}`);
    }
    if (!Array.isArray(candidate.reasons) || !Array.isArray(candidate.risks)) {
      errors.push(`${map.name}: razones/riesgos inválidos para ${candidate.name}`);
    }
  }

  if (map.geometry.openness >= 70) {
    const openSafe = map.firstPicks.filter((name) => {
      const profile = roster.get(name)?.firstPickProfile;
      return profile && profile.openFit >= 65 && profile.postBreakFit >= 60;
    });
    if (openSafe.length < 2) {
      warnings.push(`${map.name}: menos de dos first picks robustos en abierto`);
    }
  }

  if (map.geometry.bushDensity >= 75) {
    const bushTools = map.firstPicks.filter((name) => {
      const profile = roster.get(name)?.firstPickProfile;
      return profile && (profile.vision >= 70 || profile.bushFit >= 82);
    });
    if (bushTools.length < 2) {
      warnings.push(`${map.name}: menos de dos first picks con visión o bush fit alto`);
    }
  }

  if (map.geometry.destructibility >= 70) {
    const fragile = map.firstPicks.filter((name) => {
      const profile = roster.get(name)?.firstPickProfile;
      return profile && profile.wallReliance >= 75 && profile.postBreakFit < 55;
    });
    if (fragile.length) {
      errors.push(`${map.name}: first picks frágiles tras wallbreak: ${fragile.join(", ")}`);
    }
  }
}

const rustic = maps.find((map) => map.slug === "rustic-arcade");
if (!rustic) {
  errors.push("Falta Rustic Arcade");
} else {
  const expected = ["Piper", "8-Bit", "Brock"];
  if (JSON.stringify(rustic.firstPicks) !== JSON.stringify(expected)) {
    errors.push(`Rustic Arcade: first picks esperados ${expected.join(", ")}`);
  }
  if (rustic.firstPicks.includes("Sandy")) {
    errors.push("Rustic Arcade: Sandy no debe ser first pick");
  }
}

console.log(`Brawlers perfilados: ${brawlers.length}`);
console.log(`Mapas perfilados: ${maps.length}`);
console.log(`Errores: ${errors.length}`);
console.log(`Advertencias: ${warnings.length}`);

for (const warning of warnings) console.log(`AVISO: ${warning}`);

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Auditoría estructural de first picks correcta.");
}
