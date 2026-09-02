export const update69MetaLive = {
  updated: "2026-09-02",
  season: "Update 69 live · transición a Season 54 · Royal Academy",
  seasonStatus: "Cliente 69.230 live desde 01/09/2026. El motor ya incorpora la primera muestra competitiva postparche del 02/09 y conserva el 30 d como control de estabilidad.",
  officialPatch: "Update 69 · Royal Academy & Brawl-O-Ween · cliente 69.230",
  officialPatchDate: "01/09/2026",
  latestAnnouncement: "Update 69 live · Royal Academy & Brawl-O-Ween",
  latestAnnouncementDate: "01/09/2026",
  update69BalanceStatus: "CALIBRADO con muestra temprana post-U69 del 02/09. Sigue siendo una lectura volátil: mapa, orden y matchup tienen prioridad sobre el tier global.",
  nextBalanceWindow: "Revisión post-U69 del 02/09/2026 · vigilar hotfixes y consolidación de la muestra 72 h",
  rankedDataThrough: "Top 200 Meta 24 h · 02/09/2026 · control General 30 d",
  newestBrawler: "Wendy · Cosmo/Vince anunciados para el ciclo U69",
  update69Highlights: [
    "Cliente 69.230 live desde el 01/09/2026.",
    "Cosmo y Vince llegan durante el ciclo septiembre–octubre; no entran en Draft Engine hasta estar realmente disponibles y ser elegibles en Ranked.",
    "La rotación competitiva de Update 69 ya se trata como live; los mapas completamente nuevos mantienen perfil provisional hasta acumular datos.",
    "Shade, El Primo, Melodie, Amber y Gus dejan una primera señal al alza; el motor la aplica solo donde su kit y el mapa la justifican.",
    "Edgar y Mortis mantienen mucha presencia, pero continúan penalizados como first pick: popularidad no equivale a seguridad de draft.",
    "Wendy y Nori siguen fuertes en la muestra, aunque sus nerfs aumentan el riesgo y reducen su prioridad como apertura.",
    "Seis paquetes Buffie bajo seguimiento competitivo: Poco, El Primo, Amber, Gus, Chuck y Shade.",
    "Nori y Wendy reciben nuevas hipercargas durante el ciclo de la actualización; no se les concede un bonus automático hasta confirmar disponibilidad y rendimiento real.",
    "Chuck recibe una reestructuración profunda de su patrón de súper/postes; el motor lo mantiene en watchlist mixta en vez de inventar un tier post-rework sin muestra.",
    "Mega Boss Duo de 20 jugadores, colaboración con Duolingo y Brawl-O-Ween forman parte del contenido del ciclo, pero no alteran por sí mismos el modelo Ranked estándar."
  ],
  update69BalanceModel: {
    status: "Calibración postparche temprana · muestra observada + estabilidad + cambios oficiales",
    baseline: "NOFF Meta 24 h del 02/09/2026 · control General 30 d · balance oficial U69",
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
    observedLeaders: ["Shade", "Wendy", "Melodie", "El Primo", "Amber", "Gus"],
    volatilePicks: ["Edgar", "Mortis", "Nori", "Griff"]
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
    name: "NOFF — Meta 24 h post-Update 69",
    url: "https://www.noff.gg/brawl-stars/tier-list",
    kind: "Primera señal diaria postparche basada en battle logs del top 200; contrastada con su vista General 30 d"
  },
  {
    name: "Brawl Time Ninja — control de muestra amplia",
    url: "https://brawltime.ninja/tier-list/brawler",
    kind: "Control secundario de gran volumen para evitar convertir un pico del top 200 en una recomendación universal"
  }
] as const;
