import type { Metadata } from "next";
import DraftAssistant from "@/components/DraftAssistant";
import DraftUiEnhancer from "@/components/DraftUiEnhancer";
import VoiceDraftControl from "@/components/VoiceDraftControl";
import PersistentPickVoiceControlV3 from "@/components/PersistentPickVoiceControlV3";
import { maps, brawlers, draftBrawlers } from "@/lib/data";
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
import "./draft-pick-voice-v218.css";

export const metadata: Metadata = { title: "Draft Coach en vivo" };

export default function DraftPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Motor de Draft 2.0 · v0.21.8 · Windstock</span>
      <h1>Draft Coach</h1>
      <p>Micrófono de picks reconstruido: clic directo, indicador visible de activación, una instancia de reconocimiento nueva por turno y rearme automático tras validar cada brawler.</p>
    </div>
    <DraftAssistant maps={maps} brawlers={draftBrawlers} />
    <DraftUiEnhancer />
    <VoiceDraftControl roster={brawlers} targetMode="ban" />
    <PersistentPickVoiceControlV3 roster={brawlers} />
  </div>;
}
