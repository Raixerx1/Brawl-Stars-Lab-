import type { Metadata } from "next";
import MapExplorer from "@/components/MapExplorer";
import { maps, modes, rankedMaps } from "@/lib/data";

export const metadata: Metadata = { title: "Mapas" };

export default function MapsPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Pool Ranked comprobado 27/09/2026</span>
      <h1>Mapas Ranked</h1>
      <p>{rankedMaps.length} mapas vigentes, incluidos los mapas destacados estacionales. Los mapas fuera de rotación permanecen accesibles como históricos y no entran en Draft Assist.</p>
    </div>
    <MapExplorer maps={maps} modes={modes} />
  </div>;
}
