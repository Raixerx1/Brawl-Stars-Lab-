import type { Metadata } from "next";
import MapExplorer from "@/components/MapExplorer";
import { maps, modes } from "@/lib/data";
export const metadata: Metadata = { title: "Mapas" };
export default function MapsPage() { return <div className="page"><div className="page-heading"><span className="eyebrow">Pool comprobado 08/08/2026</span><h1>Mapas Ranked</h1><p>33 mapas vigentes, mapas históricos separados, alias en español y análisis de draft por mapa.</p></div><MapExplorer maps={maps} modes={modes} /></div>; }
