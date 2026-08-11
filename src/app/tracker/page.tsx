import type { Metadata } from "next";
import MatchTracker from "@/components/MatchTracker";
import { maps, brawlers } from "@/lib/data";

export const metadata: Metadata = { title: "Aprendizaje personal" };

export default function TrackerPage() {
  return <div className="page">
    <div className="page-heading"><span className="eyebrow">Draft Coach v0.14</span><h1>Aprendizaje personal</h1><p>Registra resultados manualmente o desde Auto Review para que las recomendaciones se adapten gradualmente a tus mejores brawlers, roles y mapas. Los datos permanecen en tu dispositivo.</p></div>
    <MatchTracker maps={maps} brawlers={brawlers} />
  </div>;
}
