import type { Metadata } from "next";
import "../coach-debrief-v19.css";
import "../coach-debrief-v20.css";
import "./video-review-v22.css";
import "./video-review-v23.css";
import "./video-review-v25.css";
import CoachDebriefDashboard from "@/components/CoachDebriefDashboard";
import LearningDashboard from "@/components/LearningDashboard";
import LiveMatchAnalyzer from "@/components/LiveMatchAnalyzer";
import MatchRecorder from "@/components/MatchRecorder";
import { brawlers, maps } from "@/lib/data";

export const metadata: Metadata = {
  title: "Auto Review y Entrenador",
  description: "Análisis local de vídeo completo con doble barrido adaptativo, clasificación corregible de bajas, secuencias tácticas, revisión en directo, debrief y aprendizaje contextual para Brawl Stars Ranked.",
};

export default function LiveReviewPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Brawl Draft Lab · Coach v0.25</span>
      <h1>Auto Review + Entrenador</h1>
      <p>El analizador v0.25 recorre primero toda la partida y después vuelve a las ventanas con más información para no perder bajas, cambios de HUD o usos de recursos breves. Ahora reutiliza el aprendizaje local del Auto Review, permite corregir YO/ALIADO/RIVAL y genera una lectura táctica contextual por modo, mapa y rol.</p>
    </div>
    <MatchRecorder maps={maps} brawlers={brawlers} />
    <LiveMatchAnalyzer maps={maps} brawlers={brawlers} />
    <CoachDebriefDashboard />
    <LearningDashboard maps={maps} brawlers={brawlers} />
  </div>;
}
