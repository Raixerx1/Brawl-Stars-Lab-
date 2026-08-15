import type { Metadata } from "next";
import LearningDashboard from "@/components/LearningDashboard";
import LiveMatchAnalyzer from "@/components/LiveMatchAnalyzer";
import MatchRecorder from "@/components/MatchRecorder";
import { brawlers, maps } from "@/lib/data";

export const metadata: Metadata = {
  title: "Auto Review y Grabación",
  description: "Análisis local, grabación de partidas y aprendizaje contextual para Brawl Stars Ranked.",
};

export default function LiveReviewPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Brawl Draft Lab v0.18</span>
      <h1>Auto Review + Grabación</h1>
      <p>Analiza una partida en directo, graba o importa el vídeo completo y convierte tus resultados y revisiones en patrones de entrenamiento por brawler y mapa.</p>
    </div>
    <MatchRecorder maps={maps} brawlers={brawlers} />
    <LiveMatchAnalyzer maps={maps} brawlers={brawlers} />
    <LearningDashboard maps={maps} brawlers={brawlers} />
  </div>;
}
