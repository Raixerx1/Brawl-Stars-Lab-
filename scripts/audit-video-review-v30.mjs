import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-video-review-v30-"));
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
const v30 = require(join(output, "video-review-v30.js"));
const errors = [];
let id = 0;
const event = (second, key, confidence = 88) => ({
  id: `v30-${id += 1}`,
  second,
  key,
  label: key,
  category: "Auto · test",
  tone: key === "enemy-death" ? "good" : key.includes("death") ? "bad" : key === "objective" ? "objective" : "neutral",
  confidence,
  comment: key,
});

const ballEvents = [
  event(1, "scene", 92),
  event(3, "enemy-death"),
  event(4, "enemy-death"),
  event(5, "enemy-death"),
  event(7.5, "objective", 82),
  event(8, "scene", 76),
];
const ball = v30.buildVideoStateReadoutV30([], ballEvents, "Balón Brawl", 18);
if (ball.acceptedSceneResets !== 1) errors.push(`Resets válidos en Balón: ${ball.acceptedSceneResets}, esperado 1`);
if (ball.ignoredSceneResets !== 1) errors.push(`Resets falsos ignorados: ${ball.ignoredSceneResets}, esperado 1`);
if (ball.fastWipeConversions !== 1) errors.push(`Conversiones rápidas: ${ball.fastWipeConversions}, esperado 1`);
if (ball.meanWipeConversionSeconds !== 2.5) errors.push(`Tempo medio: ${ball.meanWipeConversionSeconds}, esperado 2.5`);

const late = v30.buildVideoStateReadoutV30([], [
  event(2, "enemy-death"), event(3, "enemy-death"), event(4, "enemy-death"), event(10.5, "objective"),
], "Atrapagemas", 18);
if (late.fastWipeConversions !== 0) errors.push("Una conversión tardía se contó como rápida");
if (!late.moments.some((moment) => moment.label === "Conversión tardía tras wipe")) errors.push("No expone la conversión tardía");

const respawnMode = v30.filterStateEventsV30([event(4, "scene", 96)], "Zona Restringida");
if (respawnMode.events.some((item) => item.key === "scene")) errors.push("Acepta un reset visual aislado en un modo de respawn");

const knockout = v30.filterStateEventsV30([
  event(2, "enemy-death"), event(3, "enemy-death"), event(4, "scene", 80),
], "Noqueo");
if (knockout.acceptedSceneResets !== 1) errors.push("Noqueo rechaza un reset respaldado por dos bajas");

console.log(`Resets Balón: ${ball.acceptedSceneResets} válidos / ${ball.ignoredSceneResets} ignorados`);
console.log(`Conversión rápida: ${ball.fastWipeConversions} · media ${ball.meanWipeConversionSeconds} s`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de analizador de vídeo v0.30 correcta.");
