import type { MapProfile } from "@/lib/types";
import { MapArtwork } from "./GameArtwork";

function notesFor(map: MapProfile) {
  const notes: string[] = [];
  if (map.layout === "Abierto") notes.push("Mantén líneas largas y evita cruzar el centro sin ventaja de munición.");
  if (map.layout === "Cerrado") notes.push("Los laterales y pasillos valen más que el centro al inicio.");
  if (map.traits.some((trait) => trait.includes("arbust"))) notes.push("Revisa arbustos antes de adelantar al portador o al tirador.");
  if (map.traits.some((trait) => trait.includes("muro") || trait.includes("rebote"))) notes.push("Rompe solo los muros que eliminen refugio rival o habiliten tu mejor línea.");
  if (map.mode === "Atrapagemas") notes.push("El centro debe conservar visión y una ruta segura de retirada.");
  if (map.mode === "Balón Brawl") notes.push("No avances con el balón si tu equipo pierde dos líneas.");
  if (map.mode === "Zona Restringida") notes.push("Escalona entradas: una baja no compensa perder todo el tiempo de zona.");
  if (map.mode === "Atraco") notes.push("La ventana de daño a caja pesa más que perseguir una eliminación lateral.");
  if (["Noqueo", "Caza Estelar"].includes(map.mode)) notes.push("La primera baja cambia el mapa: no la regales por ganar diez metros.");
  return notes.slice(0, 4);
}

export default function MapTactics({ map }: { map: MapProfile }) {
  const notes = notesFor(map);
  return <section className="panel map-tactics-panel">
    <div className="section-title"><div><span className="eyebrow">Lectura visual</span><h2>Líneas y zonas de presión</h2></div><span className="status-pill">{map.layout}</span></div>
    <div className="tactical-map-wrap">
      <MapArtwork name={map.name} className="tactical-map-art" />
      <div className="lane-marker lane-left"><b>IZQ</b><span>Línea lateral</span></div>
      <div className="lane-marker lane-mid"><b>MID</b><span>Control / objetivo</span></div>
      <div className="lane-marker lane-right"><b>DER</b><span>Línea lateral</span></div>
      <div className="pressure-zone pressure-one">1</div>
      <div className="pressure-zone pressure-two">2</div>
    </div>
    <div className="map-tactic-notes">{notes.map((note, index) => <p key={note}><b>{index + 1}</b>{note}</p>)}</div>
  </section>;
}
