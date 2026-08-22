import type { Metadata } from "next";
import DraftAssistant from "@/components/DraftAssistant";
import VoiceDraftControl from "@/components/VoiceDraftControl";
import { maps, brawlers, draftBrawlers } from "@/lib/data";
import "./draft-compact.css";
import "./draft-mobile-control-v182.css";
import "./draft-voice-v185.css";
import "./draft-live-order-v193.css";
import "./draft-live-order-v194.css";
import "./draft-mobile-viewport-v196.css";

export const metadata: Metadata = { title: "Draft Coach en vivo" };

export default function DraftPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Motor de Draft 2.0 · v0.20.0 · Windstock</span>
      <h1>Draft Coach</h1>
      <p>Meta revisado el 22/08/2026, Wendy integrada y relaciones fuertes de counter derivadas del nuevo motor recíproco. En móvil se mantienen bans compactos, seis picks, buscador con micrófono y recomendación principal con scroll mínimo.</p>
    </div>
    <DraftAssistant maps={maps} brawlers={draftBrawlers} />
    <VoiceDraftControl roster={brawlers} targetMode="ban" />
    <VoiceDraftControl roster={brawlers} targetMode="pick" />
  </div>;
}
