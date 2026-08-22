import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-video-review-v23-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];
const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/video-review.ts",
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
  event(18.8, "combat", "Interacción intensa", "neutral", 73),
  event(21, "death", "Muerte", "bad", 88),
  event(23.5, "objective", "Cambio de objetivo", "objective", 84),
  event(61, "super", "Super utilizada", "neutral", 79),
  event(64, "combat", "Interacción intensa", "neutral", 76),
  event(112, "death", "Muerte", "bad", 89),
  event(124, "death", "Muerte", "bad", 85),
];

const clean = review.dedupeVideoEvents(events);
if (clean.filter((item) => item.key === "combat" && item.second < 20).length !== 1) {
  errors.push("La deduplicación no consolidó dos señales de combate próximas");
}

const report = review.buildVideoReviewReport(events, 150);
const criticalChain = report.sequences.find((sequence) => sequence.label === "Combate → muerte → objetivo");
if (!criticalChain) errors.push("No se detectó la cadena combate → muerte → objetivo");
if (criticalChain && criticalChain.startSecond >= 18) errors.push("La secuencia debe empezar antes del primer evento para ofrecer contexto");
if (!report.sequences.some((sequence) => sequence.label === "Super → interacción")) {
  errors.push("No se detectó la secuencia super → interacción");
}
if (!report.sequences.some((sequence) => sequence.label === "Muertes próximas")) {
  errors.push("No se detectaron dos muertes próximas");
}
if (report.events.length >= events.length) errors.push("El informe debería usar señales deduplicadas");
if (report.phases.length !== 3) errors.push("El informe no separa Inicio/Medio/Final");
if (Math.max(...report.phases.map((phase) => phase.activity)) !== 100) errors.push("La fase más activa debe normalizarse a 100");
if (report.signalQuality === "Baja") errors.push("La muestra coherente no debería clasificarse como evidencia baja");
if (!report.headline.includes("Combate") && !report.headline.includes("Muerte")) errors.push(`Headline inesperado: ${report.headline}`);

const noise = review.buildVideoReviewReport([
  event(5, "scene", "Cambio de fase", "neutral", 61),
  event(20, "scene", "Cambio de fase", "neutral", 62),
  event(35, "scene", "Cambio de fase", "neutral", 60),
], 120);
if (noise.signalQuality !== "Baja") errors.push("Una muestra dominada por cambios de escena debe conservar evidencia baja");

console.log(`Señales limpias: ${report.events.length}`);
console.log(`Secuencias: ${report.sequences.length}`);
console.log(`Evidencia: ${report.signalQuality} · confianza ${report.averageConfidence}%`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de analizador de vídeo v0.23 correcta.");
