import type { Metadata } from "next";
import DraftAssistant from "@/components/DraftAssistant";
import VoiceDraftControl from "@/components/VoiceDraftControl";
import { maps, brawlers } from "@/lib/data";
import "./draft-compact.css";
import "./draft-mobile-control-v182.css";
import "./draft-voice-v185.css";
import "./draft-live-order-v193.css";

export const metadata: Metadata = { title: "Draft Coach en vivo" };

export default function DraftPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Motor de Draft 2.0 · v0.19.3</span>
      <h1>Draft Coach</h1>
      <p>En móvil: picks, buscador con voz y recomendación en ese orden. La voz estabiliza las hipótesis antes de añadir nombres y valida cada ban/pick antes de continuar con el siguiente.</p>
    </div>
    <DraftAssistant maps={maps} brawlers={brawlers} />
    <VoiceDraftControl roster={brawlers} targetMode="ban" />
    <VoiceDraftControl roster={brawlers} targetMode="pick" />
  </div>;
}
