import type { Metadata } from "next";
import DraftAssistant from "@/components/DraftAssistant";
import VoiceDraftControl from "@/components/VoiceDraftControlV2";
import { maps, brawlers } from "@/lib/data";
import "./draft-compact.css";
import "./draft-mobile-control-v182.css";
import "./draft-voice-v185.css";

export const metadata: Metadata = { title: "Draft Coach en vivo" };

export default function DraftPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Motor de Draft 2.0 · v0.19.0</span>
      <h1>Draft Coach</h1>
      <p>Introduce bans, aliados y rivales con teclado o voz. Si dices varios brawlers seguidos, el sistema los pone en cola, valida cada uno en la interfaz y solo entonces continúa con el siguiente.</p>
    </div>
    <DraftAssistant maps={maps} brawlers={brawlers} />
    <VoiceDraftControl roster={brawlers} targetMode="ban" />
    <VoiceDraftControl roster={brawlers} targetMode="pick" />
  </div>;
}
