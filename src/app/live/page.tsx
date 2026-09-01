import type { Metadata } from "next";
import "../coach-debrief-v19.css";
import "../coach-debrief-v20.css";
import "./video-review-v22.css";
import "./video-review-v23.css";
import "./video-review-v25.css";
import "./video-review-v26.css";
import CoachDebriefDashboard from "@/components/CoachDebriefDashboard";
import LearningDashboard from "@/components/LearningDashboard";
import LiveMatchAnalyzer from "@/components/LiveMatchAnalyzer";
import MatchRecorder from "@/components/MatchRecorder";
import { brawlers, maps } from "@/lib/data";

export const metadata: Metadata = {
  title: "Auto Review y Entrenador",
  description: "Análisis local de vídeo con doble barrido adaptativo, tracking estabilizado del jugador, calibración robusta de HP/munición/super/hipercarga/objetivo, reconstrucción 3v3 y lectura de riesgo para Brawl Stars Ranked.",
};

export default function LiveReviewPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Brawl Draft Lab · Coach v0.27</span>
      <h1>Auto Review + Entrenador</h1>
      <p>El analizador v0.27 conserva el doble barrido y mejora la capa visual: sigue al jugador por coherencia con el centro de cámara, exige contraste temporal para validar recursos y suaviza picos aislados. El informe añade calidad de HUD, tracking estable, muertes con varios factores de riesgo y ventanas donde Super/Hipercarga permanecen listas para revisar el timing.</p>
    </div>
    <MatchRecorder maps={maps} brawlers={brawlers} />
    <LiveMatchAnalyzer maps={maps} brawlers={brawlers} />
    <CoachDebriefDashboard />
    <LearningDashboard maps={maps} brawlers={brawlers} />
  </div>;
}
