import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

const [layout, draftPage, assistant, draftCss, globalCss, packageJson, serviceWorker] = await Promise.all([
  read("src/app/layout.tsx"),
  read("src/app/draft/page.tsx"),
  read("src/components/DraftAssistant.tsx"),
  read("src/app/draft/draft-mobile-fit-v321.css"),
  read("src/app/visual-mobile-fit-v321.css"),
  read("package.json"),
  read("public/sw.js"),
]);

const errors = [];
let checks = 0;
const expect = (condition, message) => {
  checks += 1;
  if (!condition) errors.push(message);
};

expect(layout.includes('width: "device-width"'), "El viewport no usa el ancho físico del dispositivo");
expect(layout.includes("initialScale: 1"), "El viewport no arranca al 100 %");
expect(!layout.includes("maximumScale"), "El viewport bloquea el zoom de accesibilidad");
expect(layout.includes('import "./visual-mobile-fit-v321.css"'), "Falta cargar la protección móvil global");

expect(draftPage.includes('import "./draft-mobile-fit-v321.css"'), "Falta cargar el layout móvil del Draft");
expect(!draftPage.includes("DraftUiEnhancer"), "El Draft aún depende del enhancer DOM para controles críticos");

expect(assistant.includes('className="draft-first-pick-switch-v321"'), "Falta el botón React directo de First Pick");
expect(assistant.includes("onClick={toggleFirstPickOwner}"), "First Pick no tiene interacción React directa");
expect(assistant.includes('aria-label={firstPickOwner === "Aliado"'), "First Pick no informa su estado a lectores de pantalla");

expect(draftCss.includes("(pointer: coarse) and (hover: none)"), "El layout móvil depende solo del ancho y puede romperse con Page Zoom");
expect(draftCss.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "La configuración no se adapta a dos columnas");
expect(draftCss.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"), "Bans o picks no se distribuyen en una cuadrícula móvil");
expect(draftCss.includes("font-size: 16px !important"), "Los campos pueden provocar zoom automático en Safari");
expect(draftCss.includes("min-height: 44px !important"), "Faltan objetivos táctiles de al menos 44 px");
expect(draftCss.includes("position: relative !important"), "La recomendación principal podría seguir flotando sobre controles");

expect(globalCss.includes("overflow-x: clip"), "Falta la barrera global contra desbordamiento horizontal");
expect(globalCss.includes("touch-action: manipulation"), "Falta estabilizar la interacción táctil");
expect(globalCss.includes("font-size: 16px !important"), "Los formularios globales pueden activar zoom de Safari");

const pkg = JSON.parse(packageJson);
expect(pkg.version === "0.33.0", `Versión inesperada: ${pkg.version}`);
expect(pkg.scripts?.["audit:mobile"] === "node scripts/audit-mobile-layout-v321.mjs", "La auditoría móvil no está conectada");
expect(serviceWorker.includes('brawl-draft-lab-v0330'), "La caché PWA no fuerza la actualización móvil");

console.log("Auditoría móvil v0.33.0 · base de layout v0.32.1");
console.log(`Comprobaciones: ${checks - errors.length}/${checks}`);
console.log(`Errores: ${errors.length}`);

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exitCode = 1;
} else {
  console.log("Layout a escala 100 %, targets táctiles y First Pick verificados.");
}
