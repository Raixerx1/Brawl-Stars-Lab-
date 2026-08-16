import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-coach-v21-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];
const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/coach-debrief.ts",
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
const coach = require(join(output, "coach-debrief.js"));
const errors = [];
let id = 0;
const event = (label, second, extra = {}) => ({
  id: `e-${id += 1}`,
  second,
  label,
  category: "Audit",
  tone: "neutral",
  source: "Auto",
  confidence: 72,
  ...extra,
});
const session = (events) => ({
  id: crypto.randomUUID(),
  date: new Date().toISOString(),
  mapSlug: "audit-map",
  mapName: "Audit Map",
  mode: "Atrapagemas",
  brawler: "Piper",
  result: "Derrota",
  duration: 120,
  events,
  note: "",
  summary: { headline: "", strengths: [], mistakes: [], recommendations: [], scorecard: { overall: 0, positioning: 0, resources: 0, objective: 0, tempo: 0, reviewCoverage: 0, verdict: "Sin datos" } },
});

const pending = session([
  event("Muerte", 20),
  event("Entrada castigada", 22),
  event("Super sin conversión", 43),
  event("Muerte con coste de objetivo", 58),
  event("Cadena de muertes", 72),
]);
const confirmed = session(pending.events.map((item) => ({ ...item, id: `${item.id}-ok`, feedback: "accepted" })));
const pendingDebrief = coach.buildCoachDebrief(pending, [pending]);
const confirmedDebrief = coach.buildCoachDebrief(confirmed, [confirmed]);
if (!pendingDebrief || !confirmedDebrief) errors.push("No se genera debrief");
if (pendingDebrief?.confidence >= 52) errors.push(`La evidencia automática pendiente infla la confianza: ${pendingDebrief?.confidence}`);
if ((confirmedDebrief?.confidence || 0) < (pendingDebrief?.confidence || 0) + 20) errors.push("Confirmar detecciones no aumenta suficientemente la confianza");

const contradictory = session([
  event("Muerte con coste de objetivo", 60, { feedback: "accepted" }),
  event("Objetivo ganado", 63, { feedback: "accepted" }),
  event("Super con impacto", 65, { feedback: "accepted" }),
]);
const coherent = session([
  event("Muerte con coste de objetivo", 60, { feedback: "accepted" }),
  event("Entrada castigada", 64, { feedback: "accepted" }),
  event("Cadena de muertes", 68, { feedback: "accepted" }),
]);
const contradictoryDebrief = coach.buildCoachDebrief(contradictory, [contradictory]);
const coherentDebrief = coach.buildCoachDebrief(coherent, [coherent]);
if ((contradictoryDebrief?.confidence || 100) >= (coherentDebrief?.confidence || 0)) errors.push("Las señales contradictorias no reducen la confianza global");
const contradictoryPoint = contradictoryDebrief?.turningPoints.find((item) => item.label === "Muerte con coste de objetivo");
const coherentPoint = coherentDebrief?.turningPoints.find((item) => item.label === "Muerte con coste de objetivo");
if ((contradictoryPoint?.score || 100) >= (coherentPoint?.score || 0)) errors.push("La contradicción cercana no modera el punto de inflexión");

console.log(`Confianza pendiente: ${pendingDebrief?.confidence}`);
console.log(`Confianza confirmada: ${confirmedDebrief?.confidence}`);
console.log(`Confianza contradictoria: ${contradictoryDebrief?.confidence}`);
console.log(`Confianza coherente: ${coherentDebrief?.confidence}`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de evidencia del entrenador v0.21 correcta.");
