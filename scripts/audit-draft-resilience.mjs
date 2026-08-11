import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-draft-resilience-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];

const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/performance.ts",
  "src/lib/first-pick-model.ts",
  "src/lib/draft-engine.ts",
  "src/lib/draft-resilience.ts",
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
const resilienceEngine = require(join(output, "draft-resilience.js"));
const brawlers = JSON.parse(await readFile(join(root, "src/data/brawlers.json"), "utf8"));
const maps = JSON.parse(await readFile(join(root, "src/data/maps.json"), "utf8"));
const errors = [];
const winnerCounts = new Map();
const rtMaps = [];
let scenarios = 0;

for (const map of maps) {
  const analysis = resilienceEngine.analyzeRecommendationResilience({
    map,
    position: "First pick",
    allies: [],
    enemies: [],
    bans: [],
    priority: "Seguro",
    queueMode: "SoloQ",
  }, brawlers, 4, 5);

  if (!analysis.robustPick) {
    errors.push(`${map.name}: sin pick robusto`);
    continue;
  }

  const winner = analysis.robustPick.recommendation.brawler.name;
  winnerCounts.set(winner, (winnerCounts.get(winner) || 0) + 1);
  if (winner === "R-T") rtMaps.push(map.name);
  const candidateNames = new Set();

  for (const result of analysis.results) {
    const name = result.recommendation.brawler.name;
    if (candidateNames.has(name)) errors.push(`${map.name}: candidato duplicado ${name}`);
    candidateNames.add(name);
    if (result.resilience < 0 || result.resilience > 100) errors.push(`${map.name}: resiliencia inválida de ${name}`);
    if (result.worstScore > result.averageScore) errors.push(`${map.name}: peor caso superior a la media de ${name}`);
    if (!result.scenarios.length) errors.push(`${map.name}: ${name} sin respuestas simuladas`);
    const enemies = result.scenarios.map((scenario) => scenario.enemy.name);
    if (new Set(enemies).size !== enemies.length) errors.push(`${map.name}: respuestas duplicadas para ${name}`);
    scenarios += result.scenarios.length;
  }
}

const sortedWinners = [...winnerCounts.entries()].sort((a, b) => b[1] - a[1]);
const [mostFrequent = "—", mostFrequentCount = 0] = sortedWinners[0] || [];
const rtCount = winnerCounts.get("R-T") || 0;
if (mostFrequentCount / maps.length > .36) errors.push(`${mostFrequent} domina ${(mostFrequentCount / maps.length * 100).toFixed(1)}% de los mapas`);
if (rtCount / maps.length > .15) errors.push(`R-T domina ${(rtCount / maps.length * 100).toFixed(1)}% de los mapas`);

console.log(`Mapas: ${maps.length}`);
console.log(`Respuestas simuladas: ${scenarios}`);
console.log(`Pick robusto más frecuente: ${mostFrequent} (${mostFrequentCount}/${maps.length})`);
console.log(`R-T como pick robusto: ${rtCount}/${maps.length}`);
if (rtMaps.length) console.log(`Mapas de R-T: ${rtMaps.join(", ")}`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log("Auditoría de resiliencia del draft correcta.");
