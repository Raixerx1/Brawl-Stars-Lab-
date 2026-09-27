import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "kanna-draft-v361-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];

const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/first-pick-model.ts",
  "src/lib/season53-meta.ts",
  "src/lib/update69-live.ts",
  "src/lib/post-balance-1709.ts",
  "src/lib/post-balance-2509.ts",
  "src/lib/post-balance-2609.ts",
  "src/lib/draft-calibration-2709.ts",
  "src/lib/update69-maps.ts",
  "src/lib/ranked-pool-2709.ts",
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
const live = require(join(output, "update69-live.js"));
const post1709 = require(join(output, "post-balance-1709.js"));
const post2509 = require(join(output, "post-balance-2509.js"));
const post2609 = require(join(output, "post-balance-2609.js"));
const calibration = require(join(output, "draft-calibration-2709.js"));
const updateMaps = require(join(output, "update69-maps.js"));
const ranked = require(join(output, "ranked-pool-2709.js"));

const rawBrawlers = JSON.parse(await readFile(join(root, "src/data/brawlers.json"), "utf8"));
const rawMaps = JSON.parse(await readFile(join(root, "src/data/maps.json"), "utf8"));
const [draftPage, draftAssistant, voiceControl] = await Promise.all([
  readFile(join(root, "src/app/draft/page.tsx"), "utf8"),
  readFile(join(root, "src/components/DraftAssistant.tsx"), "utf8"),
  readFile(join(root, "src/components/VoiceDraftControl.tsx"), "utf8"),
]);

const roster = calibration.applyDraftCalibration2709(
  post2609.applyPostBalance2609(
    post2509.applyPostBalance2509(
      post1709.applyPostBalance1709(
        live.applyUpdate69Live(season.applySeason53Meta(rawBrawlers)),
      ),
    ),
  ),
);

const maps = ranked.recalibrateRankedFirstPicks2709(
  ranked.applyRankedPool2709(updateMaps.applyUpdate69Maps(rawMaps)),
  roster,
);
const current = maps.filter((map) => map.rotationStatus === "Actual");
const historical = maps.filter((map) => map.rotationStatus === "Histórico");

const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(current.length === 28, `Pool actual: ${current.length}, esperado 28`);
expect(new Set(current.map((map) => map.name)).size === 28, "Hay mapas actuales duplicados");
for (const featured of ["Spiraling Out", "Beach Ball", "In the Liminal", "Quick Travel"]) {
  expect(current.some((map) => map.name === featured), `Falta mapa destacado: ${featured}`);
}

const expectedCounts = {
  "Caza Estelar": 4,
  "Balón Brawl": 6,
  "Atrapagemas": 4,
  "Atraco": 4,
  "Zona Restringida": 6,
  "Noqueo": 4,
};
for (const [mode, expected] of Object.entries(expectedCounts)) {
  const actual = current.filter((map) => map.mode === mode).length;
  expect(actual === expected, `${mode}: ${actual}, esperado ${expected}`);
}

const rt = roster.find((brawler) => brawler.name === "R-T");
expect(Boolean(rt), "R-T no existe en el roster");
expect(!rt?.tags.includes("safe"), "R-T conserva la etiqueta safe heredada");
expect((rt?.firstPickProfile?.blindSafety || 100) <= 48, "R-T conserva blindSafety excesivo");
expect((rt?.firstPickProfile?.counterRisk || 0) >= 62, "R-T conserva counterRisk demasiado bajo");

const rtLeads = current.filter((map) => map.firstPicks[0] === "R-T");
expect(rtLeads.length === 0, `R-T sigue liderando ${rtLeads.length}/28 mapas: ${rtLeads.map((map) => map.name).join(", ")}`);
expect(current.every((map) => map.firstPicks.length === 3), "Algún mapa actual no tiene top 3 de first picks");
expect(current.every((map) => map.firstPickReviewedAt === "27/09/2026"), "Hay first picks actuales sin revisión 27/09");
expect(historical.length > 0, "Se perdieron los mapas históricos");
expect(draftPage.includes("DraftAssistant maps={rankedMaps}"), "Draft Assist no está aislado al pool Ranked actual");

expect(draftAssistant.includes('VOICE_PICK_COMMIT_EVENT = "brawl-draft-lab:voice-pick-commit"'), "DraftAssistant no declara el puente React de picks por voz");
expect(draftAssistant.includes("window.addEventListener(VOICE_PICK_COMMIT_EVENT"), "DraftAssistant no escucha commits de voz");
expect(draftAssistant.includes("setOrderedPicks((current) =>"), "El puente de voz no actualiza el estado ordenado de React");
expect(voiceControl.includes('VOICE_PICK_COMMIT_EVENT = "brawl-draft-lab:voice-pick-commit"'), "VoiceDraftControl no comparte el evento de commit");
expect(voiceControl.includes("window.dispatchEvent(new CustomEvent(VOICE_PICK_COMMIT_EVENT"), "VoiceDraftControl no envía cada pick directamente al estado React");

const leaders = new Map();
for (const map of current) leaders.set(map.firstPicks[0], (leaders.get(map.firstPicks[0]) || 0) + 1);
const topLeaders = [...leaders.entries()].sort((a, b) => b[1] - a[1]);

// La concentración se informa, pero no se fuerza una cuota artificial de diversidad:
// un meta real puede hacer que un blind pick seguro lidere varios mapas. v0.36.2
// audita por separado que el prior Ranked específico de cada mapa esté presente.
console.log(`Mapas Ranked actuales: ${current.length}`);
console.log(`Históricos conservados: ${historical.length}`);
console.log(`R-T lidera: ${rtLeads.length}/28`);
console.log(`Líderes first pick: ${topLeaders.map(([name, count]) => `${name} ${count}`).join(" · ")}`);
console.log(`Voz picks: bridge React directo verificado`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría v0.36.1 correcta: pool, mapas destacados, first picks y voz sincronizados.");
