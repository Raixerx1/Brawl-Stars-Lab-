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
  description: "Análisis local de vídeo completo con doble barrido adaptativo, estimación de HP/munición/super/hipercarga/objetivo, reconstrucción 3v3, clasificación corregible de bajas y lectura táctica para Brawl Stars Ranked.",
};

export default function LiveReviewPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Brawl Draft Lab · Coach v0.26</span>
      <h1>Auto Review + Entrenador</h1>
      <p>El analizador v0.26 mantiene el doble barrido de la partida y añade un modelo de estado local: posición relativa del jugador, HP, munición, super/hipercarga, posesión probable de balón o gemas y reconstrucción temporal 3v3 → 3v2 → 2v2/2v3. Las bajas siguen siendo corregibles y cualquier corrección recalcula la lectura táctica.</p>
    </div>
    <MatchRecorder maps={maps} brawlers={brawlers} />
    <LiveMatchAnalyzer maps={maps} brawlers={brawlers} />
    <CoachDebriefDashboard />
    <LearningDashboard maps={maps} brawlers={brawlers} />
  </div>;
}
