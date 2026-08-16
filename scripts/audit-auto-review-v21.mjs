import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-auto-review-v21-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];
const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/auto-vision.ts",
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
const vision = require(join(output, "auto-vision.js"));
const errors = [];

const base = {
  globalLuma: .58,
  globalSaturation: .34,
  globalDarkRatio: .10,
  motion: .025,
  centerLuma: .60,
  centerSaturation: .36,
  centerDarkRatio: .09,
  centerMotion: .025,
  topMotion: .025,
  leftTopMotion: .025,
  bottomRightEnergy: .62,
  bottomRightMotion: .025,
};

const frame = (patch = {}) => ({ ...base, ...patch });
const calibrate = (state) => {
  for (let second = 0; second < 10; second += 1) {
    vision.detectFrameEvents(state, frame(), second, "Atrapagemas", "Media");
  }
};

const labels = (result) => result.detections.map((item) => item.eventLabel).filter(Boolean);

// 1) Una transición global no debe multiplicarse en combate + objetivo + super.
{
  const state = vision.createAutoDetectorState();
  calibrate(state);
  vision.detectFrameEvents(state, frame({
    globalLuma: .30,
    globalSaturation: .12,
    motion: .58,
    centerMotion: .54,
    topMotion: .50,
    leftTopMotion: .48,
    bottomRightMotion: .52,
    bottomRightEnergy: .38,
  }), 11, "Atrapagemas", "Media");
  const result = vision.detectFrameEvents(state, frame({
    globalLuma: .33,
    globalSaturation: .14,
    motion: .52,
    centerMotion: .49,
    topMotion: .46,
    leftTopMotion: .44,
    bottomRightMotion: .47,
    bottomRightEnergy: .40,
  }), 12, "Atrapagemas", "Media");
  const found = labels(result);
  if (found.length > 1) errors.push(`Transición global emitió demasiados eventos: ${found.join(", ")}`);
  if (found.includes("Interacción intensa") || found.includes("Cambio de objetivo") || found.includes("Super utilizada")) {
    errors.push(`Transición global se confundió con señal táctica: ${found.join(", ")}`);
  }
}

// 2) Un cambio localizado del HUD superior debe conservar la detección de objetivo.
{
  const state = vision.createAutoDetectorState();
  calibrate(state);
  vision.detectFrameEvents(state, frame({ motion: .07, topMotion: .16, centerMotion: .055, leftTopMotion: .06 }), 11, "Atrapagemas", "Media");
  const result = vision.detectFrameEvents(state, frame({ motion: .07, topMotion: .17, centerMotion: .055, leftTopMotion: .06 }), 12, "Atrapagemas", "Media");
  const found = labels(result);
  if (!found.includes("Cambio de objetivo")) errors.push("No se detecta un cambio localizado de objetivo");
  if (found.includes("Interacción intensa")) errors.push("El HUD de objetivo se confundió con combate");
}

// 3) El uso de super debe ser local al cuadrante inferior derecho, no un cambio global.
{
  const state = vision.createAutoDetectorState();
  calibrate(state);
  vision.detectFrameEvents(state, frame({ bottomRightEnergy: .68 }), 11, "Balón Brawl", "Media");
  const result = vision.detectFrameEvents(state, frame({
    motion: .065,
    centerMotion: .055,
    topMotion: .045,
    bottomRightEnergy: .46,
    bottomRightMotion: .16,
  }), 12, "Balón Brawl", "Media");
  const found = labels(result);
  if (!found.includes("Super utilizada")) errors.push("No se conserva la detección localizada de super");
  if (found.includes("Cambio de fase")) errors.push("Una super localizada se confundió con cambio de fase");
}

// 4) Una muerte necesita persistencia temporal y no debe emitirse con un único frame oscuro.
{
  const state = vision.createAutoDetectorState();
  calibrate(state);
  const dark = frame({
    globalLuma: .50,
    globalSaturation: .28,
    globalDarkRatio: .18,
    centerLuma: .34,
    centerSaturation: .18,
    centerDarkRatio: .31,
    motion: .07,
    centerMotion: .06,
  });
  const first = vision.detectFrameEvents(state, dark, 11, "Noqueo", "Media");
  const second = vision.detectFrameEvents(state, dark, 12, "Noqueo", "Media");
  if (labels(first).includes("Muerte")) errors.push("La muerte se emitió sin persistencia temporal");
  if (!labels(second).includes("Muerte")) errors.push("La muerte persistente no se detectó");
}

// 5) Combate sostenido debe seguir detectándose si no hay transición ni HUD aislado.
{
  const state = vision.createAutoDetectorState();
  calibrate(state);
  let result;
  for (let second = 11; second <= 13; second += 1) {
    result = vision.detectFrameEvents(state, frame({
      motion: .17,
      centerMotion: .17,
      topMotion: .15,
      leftTopMotion: .09,
      bottomRightMotion: .12,
    }), second, "Atrapagemas", "Media");
  }
  if (!labels(result).includes("Interacción intensa")) errors.push("Se perdió la detección de combate sostenido");
}

console.log(`Errores: ${errors.length}`);
await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría temporal de Auto Review v0.21 correcta.");
