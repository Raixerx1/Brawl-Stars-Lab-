import type { Metadata } from "next";
import DraftAssistant from "@/components/DraftAssistant";
import VoiceDraftControl from "@/components/VoiceDraftControl";
import { maps, brawlers } from "@/lib/data";
import "./draft-compact.css";
import "./draft-mobile-control-v182.css";
import "./draft-voice-v185.css";

export const metadata: Metadata = { title: "Draft Coach en vivo" };

export default function DraftPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Motor de Draft 2.0 · v0.18.6</span>
      <h1>Draft Coach</h1>
      <p>Introduce aliados y rivales en orden. Para los bans puedes usar teclado o micrófono: di uno o varios nombres y se añadirán automáticamente hasta completar los 6 bans.</p>
    </div>
    <DraftAssistant maps={maps} brawlers={brawlers} />
    <VoiceDraftControl roster={brawlers} />
  </div>;
}
