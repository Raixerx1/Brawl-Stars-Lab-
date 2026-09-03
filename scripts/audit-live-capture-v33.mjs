import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-live-capture-v33-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const compilation = spawnSync(existsSync(localTsc) ? process.execPath : "tsc", [
  ...(existsSync(localTsc) ? [localTsc] : []),
  "src/lib/types.ts",
  "src/lib/auto-vision.ts",
  "src/lib/auto-learning.ts",
  "src/lib/video-review.ts",
  "src/lib/video-review-v26.ts",
  "src/lib/video-review-v27.ts",
  "src/lib/video-review-v28.ts",
  "src/lib/video-review-v29.ts",
  "src/lib/video-review-v30.ts",
  "src/lib/video-review-v31.ts",
  "src/lib/live-video-review-v33.ts",
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
const live = require(join(output, "live-video-review-v33.js"));
const [recorder, analyzer, page, css, pkgSource, serviceWorker] = await Promise.all([
  readFile(join(root, "src/components/MatchRecorder.tsx"), "utf8"),
  readFile(join(root, "src/components/VideoMatchAnalyzer.tsx"), "utf8"),
  readFile(join(root, "src/app/live/page.tsx"), "utf8"),
  readFile(join(root, "src/app/live/video-review-v33.css"), "utf8"),
  readFile(join(root, "package.json"), "utf8"),
  readFile(join(root, "public/sw.js"), "utf8"),
]);

const errors = [];
let checks = 0;
const expect = (condition, message) => {
  checks += 1;
  if (!condition) errors.push(message);
};

expect(live.isAppleMobileDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)", 5), "No detecta iPhone");
expect(live.isAppleMobileDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit", 5), "No detecta iPad con UA de escritorio");
expect(!live.isAppleMobileDevice("Mozilla/5.0 (X11; Linux x86_64)", 0), "Confunde escritorio con iOS");

const runtime = live.createLiveVideoAnalysisRuntime();
const image = { width: 120, height: 68, data: new Uint8ClampedArray(120 * 68 * 4).fill(90) };
const pulse = live.ingestLiveVideoFrame(runtime, image, .5, "Balón Brawl", "Media", {});
const seed = live.finalizeLiveVideoAnalysis(runtime, 42, "audit-session");
expect(pulse.sampledFrames === 1, "El muestreo en vivo no contabiliza frames");
expect(seed.duration === 42 && seed.sampledFrames === 1, "El informe provisional no conserva duración/lecturas");
expect(seed.id === "audit-session" && Array.isArray(seed.hudSnapshots), "El seed no es reutilizable por el analizador completo");

expect(recorder.includes("getDisplayMedia"), "Falta captura web con consentimiento");
expect(recorder.includes("new MediaRecorder(stream"), "Falta grabación simultánea del stream");
expect(recorder.includes('window.setInterval(sample, 500)'), "La lectura en vivo no mantiene la cadencia de 0,5 s");
expect(recorder.includes("video.srcObject = stream"), "La captura no alimenta el analizador de frames");
expect(recorder.includes("finalizeLiveVideoAnalysis"), "No se genera informe provisional al detener la captura");
expect(recorder.includes('accept="video/mp4,video/quicktime,video/*"'), "El fallback iOS no acepta MOV/QuickTime");
expect(recorder.includes("ReplayKit"), "La limitación y ruta nativa de iOS no se explican");
expect(recorder.includes("La captura nunca se inicia sola"), "Falta informar del consentimiento explícito");
expect(analyzer.includes("initialAnalysis"), "El analizador no hidrata el informe obtenido en directo");
expect(analyzer.includes("Refinar vídeo completo"), "Falta la segunda pasada desde el informe provisional");
expect(page.includes('import "./video-review-v33.css"'), "Los estilos v0.33 no se cargan");
expect(css.includes("@media(pointer:coarse)"), "Faltan targets táctiles para móvil");

const pkg = JSON.parse(pkgSource);
expect(pkg.version === "0.33.2", `Versión inesperada: ${pkg.version}`);
expect(pkg.scripts?.["audit:live-capture"] === "node scripts/audit-live-capture-v33.mjs", "La auditoría no está conectada");
expect(serviceWorker.includes("kanna-draft-v0332"), "La PWA no fuerza la caché v0.33.2");

await rm(output, { recursive: true, force: true });
console.log("Auditoría de captura y análisis en vivo v0.33");
console.log(`Comprobaciones: ${checks - errors.length}/${checks}`);
console.log(`Errores: ${errors.length}`);
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Captura consentida, lectura en vivo, informe provisional y fallback iOS verificados.");
