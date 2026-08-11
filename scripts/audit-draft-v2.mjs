import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-draft-v2-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];
const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/performance.ts",
  "src/lib/first-pick-model.ts",
  "src/lib/draft-engine.ts",
  "--outDir", output,
  "--target", "ES2022",
  "--module", "CommonJS",
  "--moduleResolution", "Node",
  "--lib", "ES2022,DOM",
  "--skipLibCheck",
], { cwd: root, encoding: "utf8" });

if (compilation.status !== 0) {
  console.error(compilation.stdout);
  console.error(compilation.stderr);
  await rm(output, { recursive: true, force: true });
  process.exit(1);
}

const require = createRequire(import.meta.url);
const engine = require(join(output, "draft-engine.js"));
const firstPickModel = require(join(output, "first-pick-model.js"));
const brawlers = JSON.parse(await readFile(join(root, "src/data/brawlers.json"), "utf8"));
const maps = JSON.parse(await readFile(join(root, "src/data/maps.json"), "utf8"));
const errors = [];
const winnerCounts = new Map();
let recommendationsChecked = 0;
let openingChecks = 0;

const enemies = ["Edgar", "Piper", "Bibi", "Tick", "Surge", "Meg", "Mortis", "Gale"];

for (const map of maps) {
  for (const brawler of brawlers) {
    const evaluation = firstPickModel.evaluateFirstPick(brawler, map);
    if (evaluation.openingProbability > (map.geometry?.destructibility ?? 45)) {
      errors.push(`${map.name}/${brawler.name}: probabilidad de apertura superior a la facilidad de ruptura`);
    }
    const initialDistance = Math.abs(evaluation.expectedMapFit - evaluation.initialFit);
    const openDistance = Math.abs(evaluation.expectedMapFit - evaluation.afterBreakFit);
    if (evaluation.openingProbability < 30 && initialDistance > openDistance) {
      errors.push(`${map.name}/${brawler.name}: un escenario abierto improbable domina el valor esperado`);
    }
    openingChecks += 1;
  }

  const first = engine.analyzeDraft({
    map,
    position: "First pick",
    allies: [],
    enemies: [],
    bans: [],
    priority: "Seguro",
    poolPolicy: "Off",
  }, brawlers);
  const winner = first.recommendations[0]?.brawler.name;
  winnerCounts.set(winner, (winnerCounts.get(winner) || 0) + 1);
  if (process.env.DRAFT_AUDIT_DEBUG === "1") {
    console.log(`${map.name}: ${first.recommendations.slice(0, 4).map((item) => `${item.brawler.name}=${item.score}[M${item.metrics.mapFit}/S${item.metrics.safety}/T${item.metrics.meta}]`).join(" | ")}`);
  }

  const enemyPair = enemies.slice(map.slug.length % 5, map.slug.length % 5 + 2);
  const last = engine.analyzeDraft({
    map,
    position: "Last pick",
    allies: [],
    enemies: enemyPair,
    bans: [],
    priority: "Counter",
    poolPolicy: "Off",
  }, brawlers);

  for (const analysis of [first, last]) {
    if (!analysis.confidence || !Number.isFinite(analysis.confidence.score)) errors.push(`${map.name}: falta confianza normalizada`);
    if (!Array.isArray(analysis.checklist) || !analysis.checklist.length) errors.push(`${map.name}: checklist vacío`);
    for (let index = 1; index < analysis.recommendations.length; index += 1) {
      if (analysis.recommendations[index].score > analysis.recommendations[index - 1].score) {
        errors.push(`${map.name}: ranking no ordenado por score final`);
        break;
      }
    }
    for (const recommendation of analysis.recommendations) {
      const metrics = Object.values(recommendation.metrics);
      if (metrics.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) errors.push(`${map.name}/${recommendation.brawler.name}: métrica inválida`);
      if (recommendation.score < 0 || recommendation.score > 100) errors.push(`${map.name}/${recommendation.brawler.name}: score inválido`);
      if (analysis === last && recommendation.matchups.length !== enemyPair.length) errors.push(`${map.name}/${recommendation.brawler.name}: matriz de matchups incompleta`);
      recommendationsChecked += 1;
    }
  }
}

const [dominant = "—", dominantCount = 0] = [...winnerCounts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
if (dominantCount / maps.length > .36) errors.push(`${dominant} domina ${(dominantCount / maps.length * 100).toFixed(1)}% de los first picks`);

console.log(`Escenarios de apertura comprobados: ${openingChecks}`);
console.log(`Recomendaciones comprobadas: ${recommendationsChecked}`);
console.log(`First pick más frecuente: ${dominant} (${dominantCount}/${maps.length})`);
console.log(`Distribución: ${[...winnerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => `${name} ${count}`).join(" · ")}`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.slice(0, 30).forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría del Motor de Draft 2.0 correcta.");
