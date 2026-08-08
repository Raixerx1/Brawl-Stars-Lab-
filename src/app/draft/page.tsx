import type { Metadata } from "next";
import DraftAssistant from "@/components/DraftAssistant";
import { maps, brawlers } from "@/lib/data";

export const metadata: Metadata = { title: "Draft Coach en vivo" };

export default function DraftPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Motor adaptativo v0.4</span>
      <h1>Draft Coach</h1>
      <p>Introduce aliados, rivales y bans conforme aparecen. El motor recalcula picks, líneas, builds, amenazas, posibles respuestas rivales y prioridades de ban.</p>
    </div>
    <DraftAssistant maps={maps} brawlers={brawlers} />
  </div>;
}
