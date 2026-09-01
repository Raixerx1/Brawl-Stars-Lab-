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
  description: "Análisis local de vídeo con tracking estabilizado, reconstrucción 3v3–3v0/0v3, wipes, conversión a objetivo, detección de stagger y filtrado de bajas por confianza para Brawl Stars Ranked.",
};

export default function LiveReviewPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Brawl Draft Lab · Coach v0.29</span>
      <h1>Auto Review + Entrenador</h1>
      <p>El analizador v0.29 ya no se limita a detectar un wipe: comprueba si aparece una conversión rápida a objetivo o marcador, identifica wipes propios con coste, busca reentradas escalonadas tras recuperar jugadores y excluye bajas automáticas débiles de la reconstrucción 3v3–3v0/0v3. Las correcciones manuales siguen teniendo prioridad.</p>
    </div>
    <MatchRecorder maps={maps} brawlers={brawlers} />
    <LiveMatchAnalyzer maps={maps} brawlers={brawlers} />
    <CoachDebriefDashboard />
    <LearningDashboard maps={maps} brawlers={brawlers} />
  </div>;
}
