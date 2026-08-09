import type { Metadata } from "next";
import LiveMatchAnalyzer from "@/components/LiveMatchAnalyzer";
import { brawlers, maps } from "@/lib/data";

export const metadata: Metadata = {
  title: "Auto Review Beta",
  description: "Análisis heurístico local de fotogramas, comentarios automáticos y revisión postpartida.",
};

export default function LiveReviewPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Brawl Draft Lab v0.10</span>
      <h1>Auto Review Beta</h1>
      <p>Comparte una pantalla o ventana. La web analiza fotogramas localmente, aprende de tus correcciones y combina eventos cercanos para generar comentarios tácticos más útiles.</p>
    </div>
    <LiveMatchAnalyzer maps={maps} brawlers={brawlers} />
  </div>;
}
