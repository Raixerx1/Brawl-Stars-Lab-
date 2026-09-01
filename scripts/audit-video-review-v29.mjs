import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-video-review-v29-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];
const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/auto-vision.ts",
  "src/lib/video-review.ts",
  "src/lib/video-review-v26.ts",
  "src/lib/video-review-v27.ts",
  "src/lib/video-review-v28.ts",
  "src/lib/video-review-v29.ts",
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
const v29 = require(join(output, "video-review-v29.js"));
const errors = [];
let id = 0;
const event = (second, key, confidence = 88) => ({
  id: `v29-${id += 1}`,
  second,
  key,
  label: key,
  category: "Auto · test",
  tone: key === "enemy-death" ? "good" : key.includes("death") ? "bad" : key === "objective" ? "objective" : "neutral",
  confidence,
  comment: key,
});

const converted = [
  event(.8, "enemy-death", 52), // ruido: debe excluirse de la reconstrucción fiable
  event(2, "enemy-death"),
  event(3, "enemy-death"),
  event(4, "enemy-death"),
  event(6.5, "objective", 78),
];
const convertedReadout = v29.buildVideoStateReadoutV29([], converted, "Balón Brawl", 18);
if (convertedReadout.teamWipesFor !== 1) errors.push(`Wipes fiables a favor: ${convertedReadout.teamWipesFor}, esperado 1`);
if (convertedReadout.wipeConversionsFor !== 1) errors.push(`Conversiones de wipe: ${convertedReadout.wipeConversionsFor}, esperado 1`);
if (convertedReadout.wipeConversionRate !== 100) errors.push(`Ratio de conversión: ${convertedReadout.wipeConversionRate}%`);
if (convertedReadout.teamEventTrustShare !== 75) errors.push(`Trust share: ${convertedReadout.teamEventTrustShare}%, esperado 75%`);
if (!convertedReadout.moments.some((item) => item.label === "Wipe convertido")) errors.push("No expone el momento Wipe convertido");

const ownCost = [
  event(5, "ally-death"),
  event(6, "ally-death"),
  event(7, "death"),
  event(9, "objective", 82),
];
const ownReadout = v29.buildVideoStateReadoutV29([], ownCost, "Atrapagemas", 20);
if (ownReadout.teamWipesAgainst !== 1) errors.push(`Wipes propios: ${ownReadout.teamWipesAgainst}, esperado 1`);
if (ownReadout.wipeObjectiveCostsAgainst !== 1) errors.push(`Costes de objetivo tras wipe: ${ownReadout.wipeObjectiveCostsAgainst}, esperado 1`);
if (!ownReadout.moments.some((item) => item.label === "Wipe con coste de objetivo")) errors.push("No expone wipe con coste de objetivo");

const stagger = [
  event(1, "ally-death"),
  event(2, "ally-death"),
  event(3, "death"),
  event(12, "ally-death"),
  event(12.5, "respawn", 78),
];
const staggerReadout = v29.buildVideoStateReadoutV29([], stagger, "Balón Brawl", 22);
if (staggerReadout.staggerDeaths < 1) errors.push(`No detecta stagger tras recuperación: ${staggerReadout.staggerDeaths}`);
if (!staggerReadout.risks.some((text) => text.includes("stagger"))) errors.push("El coaching no prioriza el stagger detectado");

const knockout = [event(2, "enemy-death"), event(3, "enemy-death"), event(4, "enemy-death"), event(8, "scene", 80)];
const knockoutReadout = v29.buildVideoStateReadoutV29([], knockout, "Noqueo", 12);
if (knockoutReadout.teamWipesFor !== 1 || knockoutReadout.wipeConversionsFor !== 1) errors.push("Noqueo no trata el wipe como conversión de ronda");

console.log(`Wipe convertido: ${convertedReadout.wipeConversionsFor}/${convertedReadout.teamWipesFor}`);
console.log(`Confianza de bajas: ${convertedReadout.teamEventTrustShare}%`);
console.log(`Wipe con coste: ${ownReadout.wipeObjectiveCostsAgainst}/${ownReadout.teamWipesAgainst}`);
console.log(`Staggers: ${staggerReadout.staggerDeaths}`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de analizador de vídeo v0.29 correcta.");
