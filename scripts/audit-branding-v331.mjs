import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const manifest = JSON.parse(read("public/manifest.webmanifest"));
const layout = read("src/app/layout.tsx");
const shell = read("src/components/AppShell.tsx");
const installPrompt = read("src/components/PwaInstallPrompt.tsx");
const styles = read("src/app/visual-polish-v320.css");
const pwaStyles = read("src/app/pwa.css");
const serviceWorker = read("public/sw.js");

const icons = new Map(manifest.icons.map((icon) => [icon.src, icon]));
expect(manifest.name === "Knna Draft", "El nombre instalable no es Knna Draft");
expect(manifest.short_name === "Knna Draft", "El nombre bajo el icono no es Knna Draft");
expect(icons.get("/icon-192.png")?.purpose === "any", "Falta el icono PWA normal de 192 px");
expect(icons.get("/icon-512.png")?.purpose === "any", "Falta el icono PWA normal de 512 px");
expect(icons.get("/icon-maskable-512.png")?.purpose === "maskable", "Falta el icono maskable protegido");
expect(layout.includes('url: "/apple-touch-icon.png"'), "iOS no recibe un apple-touch-icon específico");
expect(layout.includes('url: "/favicon.ico"'), "El navegador no recibe el favicon ICO");
expect(layout.includes('default: "Knna Draft"'), "El título de la web no es Knna Draft");
expect(layout.includes('title: "Knna Draft"'), "El título de la app para iOS no es Knna Draft");
expect(shell.includes('src="/icon-192.png"'), "La marca visible no usa el icono de Crow");
expect(shell.includes('className="brand-logo"'), "La marca visible no tiene estilos de imagen");
expect(shell.includes("<strong>Knna Draft</strong>"), "La marca visible no se llama Knna Draft");
expect(styles.includes(".brand-logo"), "Faltan los estilos del logo visible");
expect(installPrompt.includes('src="/icon-192.png"'), "El aviso de instalación no muestra el icono de Crow");
expect(installPrompt.includes("Instala Knna Draft"), "El aviso de instalación conserva el nombre anterior");
expect(pwaStyles.includes(".pwa-install-icon img"), "Faltan los estilos del icono en el aviso de instalación");
expect(serviceWorker.includes('knna-draft-v0331'), "La caché PWA no se ha renovado para la nueva marca");
for (const asset of [
  "/favicon.ico",
  "/favicon-32.png",
  "/favicon-48.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
]) {
  expect(serviceWorker.includes(`"${asset}"`), `La PWA no precarga ${asset}`);
}

console.log("Auditoría de marca e iconos v0.33.1");
