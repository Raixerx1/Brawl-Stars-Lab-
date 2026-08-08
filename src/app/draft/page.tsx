import type { Metadata } from "next";
import DraftAssistant from "@/components/DraftAssistant";
import { maps, brawlers } from "@/lib/data";

export const metadata: Metadata = { title: "Draft Assistant en vivo" };

export default function DraftPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Motor adaptativo v0.3</span>
      <h1>Draft Assistant</h1>
      <p>Introduce aliados, rivales y bans conforme aparecen. La recomendación se recalcula al instante según mapa, matchups, sinergias, carencias y fase del draft.</p>
    </div>
    <DraftAssistant maps={maps} brawlers={brawlers} />
  </div>;
}
