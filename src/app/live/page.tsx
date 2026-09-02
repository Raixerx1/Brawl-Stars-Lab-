import type { Metadata } from "next";
import "../coach-debrief-v19.css";
import "../coach-debrief-v20.css";
import "./video-review-v22.css";
import "./video-review-v23.css";
import "./video-review-v25.css";
import "./video-review-v26.css";
import "./video-review-v31.css";
import CoachDebriefDashboard from "@/components/CoachDebriefDashboard";
import LearningDashboard from "@/components/LearningDashboard";
import LiveMatchAnalyzer from "@/components/LiveMatchAnalyzer";
import MatchRecorder from "@/components/MatchRecorder";
import { brawlers, maps } from "@/lib/data";

export const metadata: Metadata = {
  title: "Auto Review y Entrenador",
  description: "Análisis local de vídeo con tracking estabilizado, reconstrucción 3v3–3v0/0v3, primeras bajas, trades, reagrupación, resets validados y tempo de conversión para Brawl Stars Ranked.",
};

export default function LiveReviewPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Brawl Draft Lab · Coach v0.31</span>
      <h1>Auto Review + Entrenador</h1>
      <p>El analizador v0.31 identifica quién logra la primera baja de cada pelea, si la ventaja se conserva, si respondes con trade, cómo vuelves a igualdad y si una persecución tras wipe cuesta una muerte. Mantiene los resets validados, el tempo de conversión y la reconstrucción 3v3–3v0/0v3.</p>
    </div>
    <MatchRecorder maps={maps} brawlers={brawlers} />
    <LiveMatchAnalyzer maps={maps} brawlers={brawlers} />
    <CoachDebriefDashboard />
    <LearningDashboard maps={maps} brawlers={brawlers} />
  </div>;
}
