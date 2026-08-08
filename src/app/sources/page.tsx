import type { Metadata } from "next";
import { meta } from "@/lib/data";

export const metadata: Metadata = { title: "Fuentes" };

type Source = { name: string; url: string; kind: string };

export default function SourcesPage() {
  return <div className="page">
    <div className="page-heading"><span className="eyebrow">Transparencia</span><h1>Fuentes y metodología</h1><p>Cada dato cambiante conserva su procedencia y fecha. Los counters son una capa editorial, no una estadística observacional.</p></div>
    <div className="source-list">{(meta.sources as Source[]).map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url} className="panel source-card"><span>{source.kind}</span><h2>{source.name}</h2><p>{source.url}</p></a>)}</div>
    <div className="notice spaced">BrawlAPI y Brawlify sirven los retratos y mapas. Si el servicio externo no está disponible, la interfaz muestra un fallback local sin romper la navegación.</div>
  </div>;
}
