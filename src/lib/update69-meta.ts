export const update69MetaLive = {
  updated: "2026-09-03",
  season: "Update 69 live · transición a Season 54 · Royal Academy",
  seasonStatus: "Cliente 69.230 live desde 01/09/2026. El motor ya incorpora los primeros días competitivos postparche y prioriza Ranked alto del 03/09, con NOFF 24 h y la vista general como controles.",
  officialPatch: "Update 69 · Royal Academy & Brawl-O-Ween · cliente 69.230",
  officialPatchDate: "01/09/2026",
  latestAnnouncement: "Update 69 live · Royal Academy & Brawl-O-Ween",
  latestAnnouncementDate: "01/09/2026",
  update69BalanceStatus: "RECALIBRADO 03/09 con Legendary + Masters + top 200 diario + balance oficial. La lectura sigue siendo temprana: mapa, orden y matchup tienen prioridad sobre el tier global.",
  nextBalanceWindow: "Consolidación de las primeras 72 h de Update 69 · vigilar hotfixes y estabilidad entre Legendary/Masters",
  rankedDataThrough: "03/09/2026 · Legendary 4,34 M · Masters 440 k · control Ranked global 9,67 M",
  newestBrawler: "Wendy · Cosmo/Vince anunciados para el ciclo U69",
  update69Highlights: [
    "Cliente 69.230 live desde el 01/09/2026.",
    "Cosmo y Vince llegan durante el ciclo septiembre–octubre; no entran en Draft Engine hasta estar realmente disponibles y ser elegibles en Ranked.",
    "La rotación competitiva de Update 69 ya se trata como live; los mapas completamente nuevos mantienen perfil provisional hasta acumular datos.",
    "Amber y Shade son las subidas más claras en Ranked alto durante los primeros días; Wendy continúa arriba pese al nerf.",
    "Emz mantiene una señal muy fuerte en Legendary/Masters aunque el top-200 diario sea más frío, por lo que el modelo la prioriza para Ranked alto.",
    "El Primo y Gus confirman una mejora real tras el parche, pero su valor sigue dependiendo bastante del mapa y de la composición rival.",
    "Edgar y Mortis mantienen mucha presencia, pero se rebajan como aperturas: popularidad y volumen no equivalen a seguridad de draft.",
    "Nori cae con fuerza en Legendary/Masters tras los nerfs aunque conserve señales altas en muestras agregadas; queda como pick contextual, no universal.",
    "Seis paquetes Buffie bajo seguimiento competitivo: Poco, El Primo, Amber, Gus, Chuck y Shade.",
    "Nori y Wendy reciben nuevas hipercargas durante el ciclo de la actualización; no se les concede un bonus automático hasta confirmar disponibilidad y rendimiento real.",
    "Chuck recibe una reestructuración profunda de su patrón de súper/postes; el motor lo mantiene en watchlist mixta en vez de inventar un tier post-rework sin muestra.",
    "Mega Boss Duo de 20 jugadores, colaboración con Duolingo y Brawl-O-Ween forman parte del contenido del ciclo, pero no alteran por sí mismos el modelo Ranked estándar."
  ],
  update69BalanceModel: {
    status: "Calibración de los primeros días del parche · Ranked alto + señal diaria + cambios oficiales",
    baseline: "BrawlMetrics Legendary 03/09 (4,34 M) + Masters 03/09 (440 k) + NOFF Meta 24 h + balance oficial U69",
    buffs: [
      "Bea", "Buster", "Clancy", "Colette", "Eve", "Hank", "Jacky",
      "Jae-Yong", "Janet", "Jessie", "Leon", "Lola", "Maisie", "Melodie",
      "Tara", "Ziggy"
    ],
    nerfs: [
      "Ash", "Bolt", "Griff", "Lumi", "Max", "Meg", "Nori", "Rico", "Ruffs", "Wendy"
    ],
    mixed: ["Bo", "Chuck"],
    buffieWatchlist: ["Poco", "El Primo", "Amber", "Gus", "Chuck", "Shade"],
    hyperchargeWatchlist: ["Nori", "Wendy"],
    observedLeaders: ["Amber", "Shade", "Wendy", "Emz", "Gus", "El Primo"],
    volatilePicks: ["Nori", "Edgar", "Mortis", "Bolt"]
  },
  engineRosterNote: "El motor mantiene 106 brawlers operativos. Cosmo y Vince se muestran como contenido anunciado, pero se excluyen de picks/counters hasta su release y elegibilidad competitiva real."
} as const;

export const update69LiveSources = [
  {
    name: "Supercell — Release Notes August 2026",
    url: "https://supercell.com/en/games/brawlstars/blog/release-notes/release-notes-august-2026/",
    kind: "Fuente oficial de todos los buffs, nerfs, reworks, Buffies e hipercargas de Update 69"
  },
  {
    name: "BrawlMetrics — Ranked Legendary 03/09",
    url: "https://brawlmetrics.gg/tier-list/ranked/legendary",
    kind: "Ancla principal de Ranked alto para la revisión del 03/09; más de 4,3 M de apariciones registradas"
  },
  {
    name: "BrawlMetrics — Ranked Masters 03/09",
    url: "https://brawlmetrics.gg/tier-list/ranked/masters",
    kind: "Confirmación de alto nivel con una muestra menor; se usa para validar señales, no para imponer extremos"
  },
  {
    name: "NOFF — Meta 24 h post-Update 69",
    url: "https://www.noff.gg/brawl-stars/tier-list",
    kind: "Señal diaria basada en battle logs del top 200, útil para detectar movimientos rápidos del parche"
  },
  {
    name: "Brawl Time Ninja — control de muestra amplia",
    url: "https://brawltime.ninja/tier-list/brawler",
    kind: "Control secundario de gran volumen para detectar discrepancias de muestra y popularidad"
  }
] as const;
