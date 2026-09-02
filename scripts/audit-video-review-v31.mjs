import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-video-review-v31-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const compilation = spawnSync(existsSync(localTsc) ? process.execPath : "tsc", [
  ...(existsSync(localTsc) ? [localTsc] : []),
  "src/lib/types.ts",
  "src/lib/auto-vision.ts",
  "src/lib/video-review.ts",
  "src/lib/video-review-v26.ts",
  "src/lib/video-review-v27.ts",
  "src/lib/video-review-v28.ts",
  "src/lib/video-review-v29.ts",
  "src/lib/video-review-v30.ts",
  "src/lib/video-review-v31.ts",
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
const v31 = require(join(output, "video-review-v31.js"));
const errors = [];
let id = 0;
const event = (second, key, confidence = 88) => ({
  id: `v31-${id += 1}`,
  second,
  key,
  label: key,
  category: "Auto · test",
  tone: key === "enemy-death" ? "good" : key.includes("death") ? "bad" : key === "objective" ? "objective" : "neutral",
  confidence,
  comment: key,
});

const reversal = v31.buildVideoStateReadoutV31([], [
  event(.5, "scene", 92),
  event(2, "enemy-death"),
  event(5, "ally-death"),
], "Balón Brawl", 18);
if (reversal.fightOpenersFor !== 1) errors.push(`Primeras bajas a favor: ${reversal.fightOpenersFor}, esperado 1`);
if (reversal.retainedOpenersFor !== 0 || reversal.advantageReversals !== 1) errors.push("No detecta la ventaja inicial devuelta");
if (!reversal.momentumMoments.some((moment) => moment.kind === "reversal")) errors.push("No crea momento clicable de reversión");
if (reversal.ignoredSceneResets !== 1) errors.push("v0.31 no conserva los resets rechazados por v0.30");

const converted = v31.buildVideoStateReadoutV31([], [
  event(2, "enemy-death"),
  event(4, "objective", 82),
  event(5, "ally-death"),
], "Balón Brawl", 18);
if (converted.retainedOpenersFor !== 1 || converted.openerRetentionRate !== 100) errors.push("Penaliza una baja posterior a una conversión visible");

const defensiveTrade = v31.buildVideoStateReadoutV31([], [
  event(2, "ally-death"),
  event(4.5, "enemy-death"),
], "Zona Restringida", 18);
if (defensiveTrade.fightOpenersAgainst !== 1) errors.push(`Primeras bajas en contra: ${defensiveTrade.fightOpenersAgainst}, esperado 1`);
if (defensiveTrade.tradeResponses !== 1 || defensiveTrade.tradeResponseRate !== 100) errors.push("No reconoce el trade defensivo");
if (defensiveTrade.activeRecoveries !== 1) errors.push("No cuenta la recuperación activa a igualdad");
if (defensiveTrade.disadvantageRecoveries !== 1 || defensiveTrade.cleanRegroups !== 1) errors.push("No reconstruye la reagrupación limpia");

const untraded = v31.buildVideoStateReadoutV31([], [event(2, "death")], "Atraco", 14);
if (untraded.tradeResponses !== 0 || !untraded.momentumMoments.some((moment) => moment.kind === "opener")) errors.push("No prioriza la primera baja propia sin trade");

const overchase = v31.buildVideoStateReadoutV31([], [
  event(2, "enemy-death"),
  event(3, "enemy-death"),
  event(4, "enemy-death"),
  event(6, "death"),
], "Balón Brawl", 16);
if (overchase.overchaseDeaths !== 1) errors.push(`Sobrepersecuciones: ${overchase.overchaseDeaths}, esperado 1`);
if (!overchase.momentumMoments.some((moment) => moment.kind === "overchase")) errors.push("No crea el momento post-wipe sin objetivo");

const late = v31.buildVideoStateReadoutV31([], [event(88, "ally-death")], "Atraco", 100);
if (late.lateGameSwings !== 1 || !late.momentumMoments[0]?.lateGame) errors.push("No eleva la primera baja crítica del tramo final");

console.log(`Openers: ${reversal.fightOpenersFor}-${reversal.fightOpenersAgainst}`);
console.log(`Trade defensivo: ${defensiveTrade.tradeResponses}/${defensiveTrade.fightOpenersAgainst}`);
console.log(`Recuperaciones limpias: ${defensiveTrade.cleanRegroups}/${defensiveTrade.disadvantageRecoveries}`);
console.log(`Sobrepersecuciones: ${overchase.overchaseDeaths}`);
console.log(`Swings finales: ${late.lateGameSwings}`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de analizador de vídeo v0.31 correcta.");
