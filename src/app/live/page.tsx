import type { Metadata } from "next";
import "../coach-debrief-v19.css";
import "../coach-debrief-v20.css";
import "./video-review-v22.css";
import "./video-review-v23.css";
import "./video-review-v25.css";
import "./video-review-v26.css";
import "./video-review-v31.css";
import "./video-review-v33.css";
import CoachDebriefDashboard from "@/components/CoachDebriefDashboard";
import LearningDashboard from "@/components/LearningDashboard";
import LiveMatchAnalyzer from "@/components/LiveMatchAnalyzer";
import MatchRecorder from "@/components/MatchRecorder";
import { brawlers, maps } from "@/lib/data";

export const metadata: Metadata = {
  title: "Auto Review y Entrenador",
  description: "Captura compatible y análisis local en vivo o desde vídeo, con tracking estabilizado, reconstrucción 3v3–3v0/0v3, primeras bajas, trades, reagrupación y control de momentum para Brawl Stars Ranked.",
};

export default function LiveReviewPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Brawl Draft Lab · Coach v0.33</span>
      <h1>Auto Review en vivo + Entrenador</h1>
      <p>El analizador v0.33 registra señales y HUD durante una captura compatible, entrega un informe provisional al terminar y mantiene el refinado completo de primeras bajas, trades, reagrupaciones, conversión y reconstrucción 3v3–3v0/0v3. En iPhone guía la importación directa del vídeo porque Safari no puede capturar otra app.</p>
    </div>
    <MatchRecorder maps={maps} brawlers={brawlers} />
    <LiveMatchAnalyzer maps={maps} brawlers={brawlers} />
    <CoachDebriefDashboard />
    <LearningDashboard maps={maps} brawlers={brawlers} />
  </div>;
}
