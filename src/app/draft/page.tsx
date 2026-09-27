import type { Metadata } from "next";
import DraftAssistant from "@/components/DraftAssistant";
import DraftVoicePermissionGuard from "@/components/DraftVoicePermissionGuard";
import VoiceDraftControl from "@/components/VoiceDraftControl";
import { rankedMaps, brawlers, draftBrawlers } from "@/lib/data";
import "./draft-compact.css";
import "./draft-mobile-control-v182.css";
import "./draft-voice-v185.css";
import "./draft-live-order-v193.css";
import "./draft-live-order-v194.css";
import "./draft-mobile-viewport-v196.css";
import "./draft-desktop-density-v211.css";
import "./draft-visual-v214.css";
import "./draft-readable-v215.css";
import "./draft-overlap-fix-v216.css";
import "./draft-alternatives-fulltext-v217.css";
import "./draft-desktop-voice-v221.css";
import "./draft-context-alignment-v231.css";
import "./draft-first-pick-mobile-v232.css";
import "./draft-select-contrast-v233.css";
import "./draft-mobile-fit-v321.css";
import "./draft-mobile-accessibility-v340.css";
import "./draft-voice-permission-v350.css";

export const metadata: Metadata = { title: "Draft Coach en vivo" };

export default function DraftPage() {
  return <div className="page draft-page-v340">
    <div className="page-heading">
      <span className="eyebrow">Draft Engine 2.0 · v0.36.1 · Ranked revisado 27/09</span>
      <h1>Draft Coach</h1>
      <p>El asistente usa únicamente los 28 mapas del pool Ranked actual, incluidos los cuatro mapas destacados estacionales. Los first picks se recalculan con los perfiles post-16/09 y R-T conserva su valor como antidive/counter sin recibir prioridad artificial como apertura. Gale, Lou y Wendy siguen siendo opciones contextuales cuando mapa y matchup lo justifican.</p>
    </div>
    <DraftAssistant maps={rankedMaps} brawlers={draftBrawlers} />
    <DraftVoicePermissionGuard />
    <VoiceDraftControl roster={brawlers} targetMode="ban" />
    <VoiceDraftControl roster={brawlers} targetMode="pick" />
  </div>;
}
