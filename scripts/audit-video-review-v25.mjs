import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-video-review-v25-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];
const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/auto-vision.ts",
  "src/lib/video-review.ts",
  "src/lib/video-review-v25.ts",
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
const review = require(join(output, "video-review.js"));
const v25 = require(join(output, "video-review-v25.js"));
const errors = [];
let index = 0;
const event = (second, key, label, tone, confidence) => ({
  id: `e-${index += 1}`,
  second,
  key,
  label,
  category: `Auto · ${label}`,
  tone,
  confidence,
  comment: label,
});

const events = [
  event(18, "combat", "Interacción intensa", "neutral", 78),
  event(21, "death", "Muerte", "bad", 88),
  event(23.5, "objective", "Cambio de objetivo", "objective", 84),
  event(61, "super", "Super utilizada", "neutral", 79),
  event(63.5, "enemy-death", "Eliminación rival", "good", 83),
  event(66, "objective", "Cambio de objetivo", "objective", 81),
  event(92, "combat", "Interacción intensa", "neutral", 76),
  event(94, "ally-death", "Muerte aliada", "bad", 82),
  event(97, "objective", "Cambio de objetivo", "objective", 80),
  event(112, "ally-death", "Muerte aliada", "bad", 84),
  event(118, "ally-death", "Muerte aliada", "bad", 86),
  event(136, "enemy-death", "Eliminación rival", "good", 86),
  event(142, "enemy-death", "Eliminación rival", "good", 84),
];

const report = review.buildVideoReviewReport(events, 165);
const tactical = v25.buildVideoTacticalReadout(report, {
  mode: "Balón Brawl",
  mapName: "Pinball Dreams",
  brawlerName: "Max",
  brawlerRole: "Apoyo",
  result: "Derrota",
});

if (tactical.pressureWindows !== 3) errors.push(`Ventanas de presión ${tactical.pressureWindows}, esperado 3`);
if (tactical.pressureConverted !== 1) errors.push(`Conversiones ${tactical.pressureConverted}, esperado 1`);
if (tactical.friendlyDeaths !== 4) errors.push(`Bajas propias/aliadas ${tactical.friendlyDeaths}, esperado 4`);
if (tactical.deathsWithObjectiveCost !== 2) errors.push(`Bajas con coste ${tactical.deathsWithObjectiveCost}, esperado 2`);
if (tactical.superUses !== 1 || tactical.superWithFollowup !== 1) errors.push("La super seguida de baja rival debe contar como follow-up");
if (!tactical.actions.some((text) => text.includes("balón") || text.includes("balón".toUpperCase()))) errors.push("Falta recomendación contextual de Balón Brawl");
if (!tactical.actions.some((text) => text.includes("Max"))) errors.push("Falta recomendación contextual por brawler/rol");

const windows = v25.buildVideoRefineWindows([
  { second: 10, score: .9 },
  { second: 10.8, score: .88 },
  { second: 30, score: .72 },
  { second: 60, score: .08 },
], 100, 8);
if (windows.length !== 2) errors.push(`Ventanas adaptativas ${windows.length}, esperado 2`);
if (!(windows[0].startSecond < 10 && windows[0].endSecond > 10)) errors.push("La primera ventana no rodea el candidato principal");

const attention = v25.frameReviewAttention({
  globalLuma: .5,
  globalSaturation: .5,
  globalDarkRatio: .1,
  motion: .12,
  centerLuma: .5,
  centerSaturation: .4,
  centerDarkRatio: .1,
  centerMotion: .18,
  topMotion: .22,
  leftTopMotion: .18,
  bottomRightEnergy: .6,
  bottomRightMotion: .24,
  killLeftMotion: .26,
  killRightMotion: .08,
  killLeftBlue: .18,
  killLeftRed: .02,
  killRightBlue: .01,
  killRightRed: .03,
});
if (attention < .3) errors.push(`Atención de frame demasiado baja: ${attention}`);

const death = events.find((item) => item.key === "death");
const corrected = v25.applyVideoEventOverrides(events, { [death.id]: "enemy-death" });
const correctedDeath = corrected.find((item) => item.id === death.id);
if (correctedDeath.key !== "enemy-death" || correctedDeath.label !== "Eliminación rival" || correctedDeath.confidence < 96) {
  errors.push("La corrección manual YO/ALIADO/RIVAL no reescribe correctamente el evento");
}
const dropped = v25.applyVideoEventOverrides(events, { [death.id]: "drop" });
if (dropped.some((item) => item.id === death.id)) errors.push("Descartar evento no lo elimina del informe");

console.log(`Ventanas adaptativas: ${windows.length}`);
console.log(`Atención sintética: ${Math.round(attention * 100)}%`);
console.log(`Conversión ventaja: ${tactical.pressureConverted}/${tactical.pressureWindows}`);
console.log(`Bajas con coste: ${tactical.deathsWithObjectiveCost}/${tactical.friendlyDeaths}`);
console.log(`Super follow-up: ${tactical.superWithFollowup}/${tactical.superUses}`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de analizador de vídeo v0.25 correcta.");
