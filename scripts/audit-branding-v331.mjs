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
const serviceWorkerRegister = read("src/components/ServiceWorkerRegister.tsx");
const styles = read("src/app/visual-polish-v320.css");
const brandStyles = read("src/app/kanna-brand.css");
const pwaStyles = read("src/app/pwa.css");
const serviceWorker = read("public/sw.js");

const icons = new Map(manifest.icons.map((icon) => [icon.src, icon]));
expect(manifest.name === "Kanna Draft", "El nombre instalable no es Kanna Draft");
expect(manifest.short_name === "Kanna Draft", "El nombre bajo el icono no es Kanna Draft");
expect(icons.get("/icon-192.png?crow=4")?.purpose === "any", "Falta el icono PWA Crow v4 normal de 192 px");
expect(icons.get("/icon-512.png?crow=4")?.purpose === "any", "Falta el icono PWA Crow v4 normal de 512 px");
expect(icons.get("/icon-maskable-512.png?crow=4")?.purpose === "maskable", "Falta el icono Crow v4 maskable protegido");
expect(layout.includes('manifest: "/manifest.webmanifest?crow=4"'), "El manifest no fuerza la versión Crow v4");
expect(layout.includes('url: "/apple-touch-icon.png?crow=4"'), "iOS no recibe el apple-touch-icon Crow v4");
expect(layout.includes('url: "/favicon-48.png?crow=4"'), "El navegador no recibe el favicon Crow v4");
expect(layout.includes('default: "Kanna Draft"'), "El título de la web no es Kanna Draft");
expect(layout.includes('title: "Kanna Draft"'), "El título de la app para iOS no es Kanna Draft");
expect(layout.includes('import "./kanna-brand.css"'), "La capa visual de Kanna Draft no está importada");
expect(!shell.includes('src="/kanna-draft-header.jpg"'), "El encabezado todavía usa el JPG anterior");
expect(shell.includes('className="kanna-header-crow"'), "El encabezado no conserva el Crow de la marca");
expect(shell.includes('className="kanna-header-wordmark"'), "El encabezado no tiene el wordmark responsive");
expect(shell.includes("<strong>Kanna</strong>"), "El wordmark no muestra Kanna");
expect(shell.includes("<em>Draft</em>"), "El wordmark no muestra Draft");
expect(shell.includes('const CROW_ICON = "/icon-192.png?crow=4"'), "La marca compacta no fuerza el Crow v4");
expect(shell.includes("unoptimized"), "El Crow del encabezado sigue pasando por el optimizador y puede conservar caché antigua");
expect(shell.includes("<strong>Kanna Draft</strong>"), "La marca visible no se llama Kanna Draft");
expect(styles.includes(".brand-logo"), "Faltan los estilos del logo compacto");
expect(brandStyles.includes(".kanna-header-wordmark"), "Faltan los estilos del wordmark de Kanna Draft");
expect(brandStyles.includes("background-clip: text"), "El wordmark no aplica el degradado verde");
expect(brandStyles.includes("kanna-leaf-glint"), "El wordmark no incluye el brillo vegetal accesible");
expect(installPrompt.includes('const CROW_ICON = "/icon-192.png?crow=4"'), "El aviso de instalación no muestra Crow v4");
expect(installPrompt.includes("Instala Kanna Draft"), "El aviso de instalación conserva el nombre anterior");
expect(pwaStyles.includes(".pwa-install-icon img"), "Faltan los estilos del icono en el aviso de instalación");
expect(serviceWorkerRegister.includes('register("/sw.js?crow=4"'), "El navegador puede conservar el service worker anterior");
expect(serviceWorker.includes('kanna-draft-v0332-crow4'), "La caché PWA no usa Crow v4");
for (const asset of [
  "/manifest.webmanifest?crow=4",
  "/favicon-32.png?crow=4",
  "/favicon-48.png?crow=4",
  "/apple-touch-icon.png?crow=4",
  "/icon-192.png?crow=4",
  "/icon-512.png?crow=4",
  "/icon-maskable-512.png?crow=4",
]) {
  expect(serviceWorker.includes(`"${asset}"`), `La PWA no precarga ${asset}`);
}

console.log("Auditoría de marca e iconos Kanna Draft · Crow v4");
