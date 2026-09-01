export const update69MetaLive = {
  updated: "2026-09-01",
  season: "Update 69 live · transición a Season 54 · Royal Academy",
  seasonStatus: "Cliente 69.230 live desde 01/09/2026. La base competitiva conserva el snapshot observado del 30/08 y añade un prior de día 1 para el nuevo balance.",
  officialPatch: "Update 69 · Royal Academy & Brawl-O-Ween · cliente 69.230",
  officialPatchDate: "01/09/2026",
  latestAnnouncement: "Update 69 live · Royal Academy & Brawl-O-Ween",
  latestAnnouncementDate: "01/09/2026",
  update69BalanceStatus: "ACTIVO como prior competitivo de día 1. Todavía no hay muestra Ranked post-parche suficiente para tratar la nueva tier como observada.",
  nextBalanceWindow: "Update 69 live desde 01/09/2026 · vigilar hotfixes y primera muestra Ranked 24–72 h",
  rankedDataThrough: "Baseline observado 30/08/2026 · prior Update 69 activo 01/09",
  newestBrawler: "Wendy · Cosmo/Vince anunciados para el ciclo U69",
  update69Highlights: [
    "Cliente 69.230 live desde el 01/09/2026.",
    "Cosmo y Vince llegan durante el ciclo septiembre–octubre; no entran en Draft Engine hasta estar realmente disponibles y ser elegibles en Ranked.",
    "La rotación competitiva de Update 69 ya se trata como live; los mapas completamente nuevos mantienen perfil provisional hasta acumular datos.",
    "Seis nuevos paquetes Buffie en watchlist competitiva: Poco, El Primo, Amber, Gus, Chuck y Shade.",
    "Nori y Wendy reciben nuevas hipercargas durante el ciclo de la actualización; no se les concede un bonus automático hasta confirmar disponibilidad y rendimiento real.",
    "Chuck recibe una reestructuración profunda de su patrón de súper/postes; el motor lo mantiene en watchlist mixta en vez de inventar un tier post-rework sin muestra.",
    "Mega Boss Duo de 20 jugadores, colaboración con Duolingo y Brawl-O-Ween forman parte del contenido del ciclo, pero no alteran por sí mismos el modelo Ranked estándar."
  ],
  update69BalanceModel: {
    status: "Prior competitivo provisional · no equivale a win rate post-parche",
    baseline: "NOFF Meta 24 h del 30/08/2026",
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
    hyperchargeWatchlist: ["Nori", "Wendy"]
  },
  engineRosterNote: "El motor mantiene 106 brawlers operativos. Cosmo y Vince se muestran como contenido anunciado, pero se excluyen de picks/counters hasta su release y elegibilidad competitiva real."
} as const;

export const update69LiveSources = [
  {
    name: "Google Play — Brawl Stars · Update 69",
    url: "https://play.google.com/store/apps/details?id=com.supercell.brawlstars",
    kind: "Oficial de Supercell: confirma Update 69, Cosmo, Vince, Mega Boss Duo, Duolingo y Season 54"
  },
  {
    name: "APKMirror — Brawl Stars 69.230",
    url: "https://www.apkmirror.com/apk/supercell/brawl-stars/brawl-stars-69-230-release/",
    kind: "Verificación de cliente firmado por Supercell: versión 69.230 publicada 01/09/2026"
  },
  {
    name: "Chosen Network / comunidad competitiva — Final Balance Changes U69",
    url: "https://www.reddit.com/r/BrawlStarsCompetitive/comments/1w1p7lp/final_balance_changes/",
    kind: "Contraste competitivo de los ajustes finales; se usa solo como prior de día 1, no como dato de win rate"
  }
] as const;
