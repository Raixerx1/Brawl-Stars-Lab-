import type { Metadata } from "next";
import LiveMatchAnalyzer from "@/components/LiveMatchAnalyzer";
import { brawlers, maps } from "@/lib/data";

export const metadata: Metadata = {
  title: "Live Review",
  description: "Captura local de pantalla, marcadores temporales y revisión postpartida.",
};

export default function LiveReviewPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Brawl Draft Lab v0.8</span>
      <h1>Live Review</h1>
      <p>Comparte una pantalla o ventana, marca los momentos decisivos y genera una revisión estructurada sin grabar ni subir automáticamente el vídeo.</p>
    </div>
    <LiveMatchAnalyzer maps={maps} brawlers={brawlers} />
  </div>;
}
