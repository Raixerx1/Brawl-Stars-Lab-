import type { MapProfile } from "@/lib/types";
import { MapArtwork } from "./GameArtwork";

function notesFor(map: MapProfile) {
  const notes: string[] = [];
  const geometry = map.geometry;

  if (!geometry) {
    if (map.layout === "Abierto") notes.push("Mantén líneas largas y evita cruzar el centro sin ventaja de munición.");
    if (map.layout === "Cerrado") notes.push("Los laterales y pasillos valen más que el centro al inicio.");
  } else {
    if (geometry.openness >= 70) {
      notes.push("Mapa muy abierto: el first pick necesita rango estable, supervivencia frente a dive y utilidad sin depender de muros.");
    } else if (geometry.openness <= 32) {
      notes.push("Mapa muy cerrado: control de pasillos, antidive y presión de corta distancia ganan valor.");
    } else {
      notes.push("Mapa mixto: prioriza brawlers que puedan alternar centro y lateral sin quedar atados a una sola línea.");
    }

    if (geometry.bushDensity >= 70) {
      notes.push("Arbustos dominantes: visión, bush-check y capacidad para sobrevivir a una entrada ciega son obligatorios.");
    } else if (geometry.bushDensity >= 45) {
      notes.push("Los arbustos alteran los matchups: conserva herramientas para comprobar laterales antes de avanzar.");
    }

    if (geometry.destructibility >= 70) {
      notes.push("Wallbreak decisivo: evita un first pick que dependa de muros y pierda su condición de victoria cuando el mapa se abra.");
    } else if (geometry.wallDensity >= 60 && geometry.destructibility <= 35) {
      notes.push("Los muros suelen permanecer: rebotes, artilleros y control angular conservan valor durante toda la partida.");
    }

    if (geometry.chokeDensity >= 70) {
      notes.push("Pasillos estrechos: el control de acceso y el daño en área pesan más que el alcance bruto.");
    }

    if (geometry.waterInfluence >= 55) {
      notes.push("El agua limita las rutas: movilidad y capacidad de disparar a través de ángulos largos ganan valor.");
    }
  }

  if (map.mode === "Atrapagemas") notes.push("El mid debe conservar visión y una ruta segura de retirada.");
  if (map.mode === "Balón Brawl") notes.push("No avances con el balón si tu equipo pierde dos líneas.");
  if (map.mode === "Zona Restringida") notes.push("Escalona entradas: una baja no compensa perder todo el tiempo de zona.");
  if (map.mode === "Atraco") notes.push("La ventana de daño a caja pesa más que perseguir una eliminación lateral.");
  if (["Noqueo", "Caza Estelar"].includes(map.mode)) notes.push("La primera baja cambia el mapa: no la regales por ganar diez metros.");

  return notes.slice(0, 5);
}

const metricLabel: Record<string, string> = {
  openness: "Apertura",
  bushDensity: "Arbustos",
  wallDensity: "Muros",
  destructibility: "Destructibilidad",
  chokeDensity: "Pasillos",
  laneWidth: "Anchura de línea",
  waterInfluence: "Influencia del agua",
};

export default function MapTactics({ map }: { map: MapProfile }) {
  const notes = notesFor(map);
  const geometryEntries: Array<[string, number]> = map.geometry
    ? [
      ["openness", map.geometry.openness],
      ["bushDensity", map.geometry.bushDensity],
      ["wallDensity", map.geometry.wallDensity],
      ["destructibility", map.geometry.destructibility],
      ["chokeDensity", map.geometry.chokeDensity],
      ["laneWidth", map.geometry.laneWidth],
      ["waterInfluence", map.geometry.waterInfluence],
    ]
    : [];

  return <section className="panel map-tactics-panel map-tactics-v12">
    <div className="section-title">
      <div><span className="eyebrow">Lectura estructural</span><h2>Líneas, cobertura y transformación</h2></div>
      <span className="status-pill">{map.layout}</span>
    </div>

    {geometryEntries.length > 0 && <div className="map-geometry-bars-v12">
      {geometryEntries.map(([key, value]) => <div key={key}>
        <span><b>{metricLabel[key]}</b><strong>{value}/100</strong></span>
        <i><em style={{ width: `${value}%` }} /></i>
      </div>)}
    </div>}

    {map.geometry && <div className="map-transformation-v12">
      <span><b>Inicio</b>{map.geometry.openness}% abierto · {map.geometry.wallDensity}% muros</span>
      <span>→</span>
      <span><b>Tras wallbreak</b>{map.geometry.afterBreakOpenness}% abierto · {map.geometry.afterBreakWalls}% muros</span>
      <span><b>Visión</b>{map.geometry.visionImportance}</span>
      <span><b>Impacto de ruptura</b>{map.geometry.wallBreakImpact}</span>
    </div>}

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
