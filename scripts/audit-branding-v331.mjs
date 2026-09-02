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
const brandStyles = read("src/app/kanna-brand.css");
const pwaStyles = read("src/app/pwa.css");
const serviceWorker = read("public/sw.js");

const icons = new Map(manifest.icons.map((icon) => [icon.src, icon]));
expect(manifest.name === "Kanna Draft", "El nombre instalable no es Kanna Draft");
expect(manifest.short_name === "Kanna Draft", "El nombre bajo el icono no es Kanna Draft");
expect(icons.get("/icon-192.png")?.purpose === "any", "Falta el icono PWA normal de 192 px");
expect(icons.get("/icon-512.png")?.purpose === "any", "Falta el icono PWA normal de 512 px");
expect(icons.get("/icon-maskable-512.png")?.purpose === "maskable", "Falta el icono maskable protegido");
expect(layout.includes('url: "/apple-touch-icon.png"'), "iOS no recibe un apple-touch-icon específico");
expect(layout.includes('url: "/favicon.ico"'), "El navegador no recibe el favicon ICO");
expect(layout.includes('default: "Kanna Draft"'), "El título de la web no es Kanna Draft");
expect(layout.includes('title: "Kanna Draft"'), "El título de la app para iOS no es Kanna Draft");
expect(layout.includes('import "./kanna-brand.css"'), "La capa visual de Kanna Draft no está importada");
expect(shell.includes('src="/kanna-draft-header.jpg"'), "El encabezado no usa la imagen panorámica de Kanna Draft");
expect(shell.includes('className="kanna-header-logo"'), "El encabezado no tiene la clase de marca panorámica");
expect(shell.includes('src="/icon-192.png"'), "La marca compacta no usa el icono de Crow");
expect(shell.includes("<strong>Kanna Draft</strong>"), "La marca visible no se llama Kanna Draft");
expect(styles.includes(".brand-logo"), "Faltan los estilos del logo compacto");
expect(brandStyles.includes(".kanna-header-logo"), "Faltan los estilos del encabezado de Kanna Draft");
expect(installPrompt.includes('src="/icon-192.png"'), "El aviso de instalación no muestra el icono de Crow");
expect(installPrompt.includes("Instala Kanna Draft"), "El aviso de instalación conserva el nombre anterior");
expect(pwaStyles.includes(".pwa-install-icon img"), "Faltan los estilos del icono en el aviso de instalación");
expect(serviceWorker.includes('knna-draft-v0331'), "La caché PWA no conserva la clave v0.33.1 esperada");
for (const asset of [
  "/kanna-draft-header.jpg",
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

console.log("Auditoría de marca e iconos Kanna Draft v0.33.1");
