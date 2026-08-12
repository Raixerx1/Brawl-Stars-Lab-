import type { Metadata } from "next";
import DraftAssistant from "@/components/DraftAssistant";
import { maps, brawlers } from "@/lib/data";
import "./draft-compact.css";

export const metadata: Metadata = { title: "Draft Coach en vivo" };

export default function DraftPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Motor de Draft 2.0 · v0.18.1</span>
      <h1>Draft Coach</h1>
      <p>Introduce aliados, rivales y bans conforme aparecen. En móvil y tablet, la recomendación principal queda pegada a la barra de picks para decidir sin hacer scroll.</p>
    </div>
    <DraftAssistant maps={maps} brawlers={brawlers} />
  </div>;
}
