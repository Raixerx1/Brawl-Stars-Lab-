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
  description: "Análisis local de vídeo con tracking estabilizado, calibración robusta de HUD, reconstrucción completa 3v3 hasta 3v0/0v3, detección de wipes y lectura de riesgo para Brawl Stars Ranked.",
};

export default function LiveReviewPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Brawl Draft Lab · Coach v0.28</span>
      <h1>Auto Review + Entrenador</h1>
      <p>El analizador v0.28 conserva el tracking y los recursos estabilizados de v0.27 y corrige la reconstrucción numérica completa: ahora puede representar 3v0 y 0v3, detectar wipes, medir cuánto duran y priorizar si se convierten en objetivo o generan una mala salida tras el reset.</p>
    </div>
    <MatchRecorder maps={maps} brawlers={brawlers} />
    <LiveMatchAnalyzer maps={maps} brawlers={brawlers} />
    <CoachDebriefDashboard />
    <LearningDashboard maps={maps} brawlers={brawlers} />
  </div>;
}
