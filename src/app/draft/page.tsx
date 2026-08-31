import type { Metadata } from "next";
import DraftAssistant from "@/components/DraftAssistant";
import DraftUiEnhancer from "@/components/DraftUiEnhancer";
import DesktopPickVoiceGuard from "@/components/DesktopPickVoiceGuard";
import VoiceDraftControl from "@/components/VoiceDraftControl";
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
import "./draft-desktop-voice-v221.css";
import "./draft-context-alignment-v231.css";

export const metadata: Metadata = { title: "Draft Coach en vivo" };

export default function DraftPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Motor de Draft 2.0 · v0.22.2 · meta 31/08</span>
      <h1>Draft Coach</h1>
      <p>Tier global actualizado con la fotografía Meta 24 h del 30/08. Matchups, Counter Explorer y coach por voz recalculan sobre esa viabilidad sin activar todavía los cambios de balance de septiembre.</p>
    </div>
    <DraftAssistant maps={maps} brawlers={draftBrawlers} />
    <DraftUiEnhancer />
    <DesktopPickVoiceGuard />
    <VoiceDraftControl roster={brawlers} targetMode="ban" />
    <VoiceDraftControl roster={brawlers} targetMode="pick" />
  </div>;
}
