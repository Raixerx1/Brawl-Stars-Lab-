import type { Metadata } from "next";
import "../coach-debrief-v19.css";
import "../coach-debrief-v20.css";
import "./video-review-v22.css";
import "./video-review-v23.css";
import CoachDebriefDashboard from "@/components/CoachDebriefDashboard";
import LearningDashboard from "@/components/LearningDashboard";
import LiveMatchAnalyzer from "@/components/LiveMatchAnalyzer";
import MatchRecorder from "@/components/MatchRecorder";
import { brawlers, maps } from "@/lib/data";

export const metadata: Metadata = {
  title: "Auto Review y Entrenador",
  description: "Análisis local de vídeo completo con clasificación de bajas por equipo, secuencias tácticas, revisión en directo, debrief y aprendizaje contextual para Brawl Stars Ranked.",
};

export default function LiveReviewPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Brawl Draft Lab · Coach v0.24</span>
      <h1>Auto Review + Entrenador</h1>
      <p>El analizador v0.24 añade lectura temporal del HUD para separar tu muerte, una muerte aliada y una eliminación rival cuando existe evidencia suficiente. Las secuencias posteriores ya tienen en cuenta la ventaja o desventaja numérica antes de valorar objetivo y recursos.</p>
    </div>
    <MatchRecorder maps={maps} brawlers={brawlers} />
    <LiveMatchAnalyzer maps={maps} brawlers={brawlers} />
    <CoachDebriefDashboard />
    <LearningDashboard maps={maps} brawlers={brawlers} />
  </div>;
}
