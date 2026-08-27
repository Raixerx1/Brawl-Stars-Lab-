import type { Metadata } from "next";
import DraftAssistant from "@/components/DraftAssistant";
import VoiceDraftControl from "@/components/VoiceDraftControl";
import PersistentPickVoiceControl from "@/components/PersistentPickVoiceControl";
import { maps, brawlers, draftBrawlers } from "@/lib/data";
import "./draft-compact.css";
import "./draft-mobile-control-v182.css";
import "./draft-voice-v185.css";
import "./draft-live-order-v193.css";
import "./draft-live-order-v194.css";
import "./draft-mobile-viewport-v196.css";
import "./draft-desktop-density-v211.css";

export const metadata: Metadata = { title: "Draft Coach en vivo" };

export default function DraftPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Motor de Draft 2.0 · v0.21.3 · Windstock</span>
      <h1>Draft Coach</h1>
      <p>Bans mantiene el dictado por lista. En picks, activa el micrófono una sola vez: queda abierto, valida un nombre en el siguiente slot, espera la actualización y vuelve a escuchar automáticamente hasta completar los seis.</p>
    </div>
    <DraftAssistant maps={maps} brawlers={draftBrawlers} />
    <VoiceDraftControl roster={brawlers} targetMode="ban" />
    <PersistentPickVoiceControl roster={brawlers} />
  </div>;
}
