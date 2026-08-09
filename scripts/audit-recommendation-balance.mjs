import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-draft-balance-"));

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
], {
  cwd: root,
  encoding: "utf8",
});

if (compilation.status !== 0) {
  console.error(compilation.stdout);
  console.error(compilation.stderr);
  await rm(output, { recursive: true, force: true });
  process.exit(1);
}

const require = createRequire(import.meta.url);
const engine = require(join(output, "draft-engine.js"));
const brawlers = JSON.parse(await readFile(join(root, "src/data/brawlers.json"), "utf8"));
const maps = JSON.parse(await readFile(join(root, "src/data/maps.json"), "utf8"));

const sample = [
  "Edgar", "Mortis", "Buzz", "Bull", "El Primo", "Starr Nova", "Nori", "Gigi",
  "Piper", "Brock", "Belle", "8-Bit", "Surge", "Gale", "Damian", "Charlie",
  "Rico", "Tick", "Sprout", "Colette",
];

const alternativeTierBonus = {
  "S+": 9, S: 8, "A+": 6, A: 5, "B+": 3, B: 2,
  C: 0, D: -7, F: -11, "Sin evaluar": -4,
};

const primaryCounts = new Map();
const safeCounts = new Map();
let total = 0;

const increment = (map, name) => map.set(name, (map.get(name) || 0) + 1);

const safeAlternative = (recommendations, best) => [...recommendations]
  .filter((item) => item.brawler.name !== best.brawler.name)
  .sort((a, b) => {
    const aValue =
      a.score * .42 +
      a.metrics.safety * .32 +
      a.metrics.mapFit * .15 +
      a.metrics.composition * .08 -
      a.metrics.risk * .20 +
      (alternativeTierBonus[a.brawler.tier] || 0);
    const bValue =
      b.score * .42 +
      b.metrics.safety * .32 +
      b.metrics.mapFit * .15 +
      b.metrics.composition * .08 -
      b.metrics.risk * .20 +
      (alternativeTierBonus[b.brawler.tier] || 0);
    return bValue - aValue;
  })[0];

const evaluate = (map, enemies, position) => {
  const analysis = engine.analyzeDraft({
    map,
    position,
    allies: [],
    enemies,
    bans: [],
    priority: "Counter",
    poolPolicy: "Off",
  }, brawlers);

  const best = analysis.recommendations[0];
  const safe = safeAlternative(analysis.recommendations, best);
  increment(primaryCounts, best.brawler.name);
  if (safe) increment(safeCounts, safe.brawler.name);
  total += 1;
};

for (const map of maps) {
  for (const enemy of sample) evaluate(map, [enemy], "Pick intermedio");

  for (let left = 0; left < sample.length; left += 1) {
    for (let right = left + 1; right < sample.length; right += 1) {
      if ((left * 31 + right * 17) % 11 === 0) {
        evaluate(map, [sample[left], sample[right]], "Last pick");
      }
    }
  }
}

const rtPrimary = primaryCounts.get("R-T") || 0;
const rtSafe = safeCounts.get("R-T") || 0;
const rtPrimaryShare = rtPrimary / total;
const rtSafeShare = rtSafe / total;
const dominant = [...primaryCounts.entries()].sort((a, b) => b[1] - a[1])[0];
const dominantShare = dominant[1] / total;

const errors = [];
if (rtPrimaryShare > .06) errors.push(`R-T aparece como principal en ${(rtPrimaryShare * 100).toFixed(1)}%`);
if (rtSafeShare > .08) errors.push(`R-T aparece como alternativa segura en ${(rtSafeShare * 100).toFixed(1)}%`);
if (rtPrimary === 0) errors.push("R-T nunca aparece: la corrección sería una supresión artificial");
if (dominantShare > .25) errors.push(`${dominant[0]} domina ${(dominantShare * 100).toFixed(1)}% de los escenarios`);

console.log(`Escenarios: ${total}`);
console.log(`R-T principal: ${rtPrimary} (${(rtPrimaryShare * 100).toFixed(1)}%)`);
console.log(`R-T alternativa segura: ${rtSafe} (${(rtSafeShare * 100).toFixed(1)}%)`);
console.log(`Brawler principal más frecuente: ${dominant[0]} (${(dominantShare * 100).toFixed(1)}%)`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Auditoría de diversidad de recomendaciones correcta.");
}
