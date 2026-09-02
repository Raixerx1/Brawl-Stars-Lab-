import type { Metadata } from "next";
import DraftAssistant from "@/components/DraftAssistant";
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
import "./draft-first-pick-mobile-v232.css";
import "./draft-select-contrast-v233.css";
import "./draft-mobile-fit-v321.css";

export const metadata: Metadata = { title: "Draft Coach en vivo" };

export default function DraftPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Draft Engine 2.0 · v0.32.1 · meta U69 del 02/09</span>
      <h1>Draft Coach</h1>
      <p>Las recomendaciones cruzan la muestra top-200 post-U69, el balance oficial y el control de estabilidad a 30 días. El mapa, el orden de picks y cada matchup siguen pesando más que el tier global.</p>
    </div>
    <DraftAssistant maps={maps} brawlers={draftBrawlers} />
    <DesktopPickVoiceGuard />
    <VoiceDraftControl roster={brawlers} targetMode="ban" />
    <VoiceDraftControl roster={brawlers} targetMode="pick" />
  </div>;
}
