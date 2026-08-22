import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-matchups-v20-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];
const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/season53-meta.ts",
  "src/lib/counter-engine.ts",
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
const season = require(join(output, "season53-meta.js"));
const counters = require(join(output, "counter-engine.js"));
const rawRoster = JSON.parse(await readFile(join(root, "src", "data", "brawlers.json"), "utf8"));
const roster = season.applySeason53Meta(rawRoster);
const errors = [];
let evaluated = 0;

for (const candidate of roster) {
  for (const target of roster) {
    if (candidate.name === target.name) continue;
    const result = counters.evaluateSpecificMatchup(candidate, target);
    evaluated += 1;
    if (!Number.isFinite(result.score) || result.score < 0 || result.score > 100) {
      errors.push(`Score inválido ${candidate.name} -> ${target.name}: ${result.score}`);
    }
    if (!result.reason) errors.push(`Sin razón ${candidate.name} -> ${target.name}`);
  }
}

for (const target of roster) {
  const top = counters.rankCountersAgainst(target, roster, 6);
  const names = top.map((item) => item.candidate.name);
  if (names.includes(target.name)) errors.push(`${target.name} aparece como su propio counter`);
  if (new Set(names).size !== names.length) errors.push(`Counters duplicados para ${target.name}`);
  for (let index = 1; index < top.length; index += 1) {
    if (top[index].score > top[index - 1].score) errors.push(`Orden de score incorrecto para ${target.name}`);
  }
}

if (!roster.some((brawler) => brawler.name === "Wendy")) errors.push("Wendy no está en el roster operativo");
const wendy = roster.find((brawler) => brawler.name === "Wendy");
if (wendy && counters.rankCountersAgainst(wendy, roster, 6).length !== 6) errors.push("Wendy no genera 6 counters calculados");

console.log(`Roster operativo: ${roster.length}`);
console.log(`Matchups evaluados: ${evaluated}`);
console.log(`Errores: ${errors.length}`);
await rm(output, { recursive: true, force: true });

if (errors.length) {
  errors.slice(0, 40).forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría completa de matchups Windstock correcta.");
