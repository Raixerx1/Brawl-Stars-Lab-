export type BrawlerFirstPickProfile = {
  blindSafety: number;
  openFit: number;
  closedFit: number;
  bushFit: number;
  wallReliance: number;
  postBreakFit: number;
  vision: number;
  wallBreak: number;
  antiDive: number;
  mobility: number;
  objective: number;
  control: number;
  chokeControl: number;
  teamDependence: number;
  counterRisk: number;
};

export type MapGeometryProfile = {
  openness: number;
  bushDensity: number;
  wallDensity: number;
  destructibility: number;
  chokeDensity: number;
  laneWidth: number;
  waterInfluence: number;
  afterBreakOpenness: number;
  afterBreakWalls: number;
  visionImportance: "Baja" | "Media" | "Alta";
  wallBreakImpact: "Baja" | "Media" | "Alta";
};

export type FirstPickEvaluation = {
  score: number;
  initialFit: number;
  afterBreakFit: number;
  expectedMapFit: number;
  openingProbability: number;
  blindQuality: number;
  modeFit: number;
  modeUtility: number;
  strengths: string[];
  risks: string[];
};

export type Brawler = {
  slug: string;
  name: string;
  rarity: string;
  role: string;
  tier: string;
  range: string;
  difficulty: number;
  tags: string[];
  modes: Partial<Record<string, number>>;
  counters: string[];
  counteredBy: string[];
  build: string;
  profileComplete: boolean;
  matchupReviewedAt?: string;
  matchupNotes?: {
    favorable?: Record<string, string>;
    threats?: Record<string, string>;
  };
  firstPickProfile?: BrawlerFirstPickProfile;
  firstPickProfileReviewedAt?: string;
  firstPickProfileVersion?: string;
};

export type MapProfile = {
  slug: string;
  name: string;
  mode: string;
  layout: string;
  traits: string[];
  tierS: string[];
  tierA: string[];
  firstPicks: string[];
  lastPicks: string[];
  bans: string[];
  plan: string;
  featuredOfficialJune2026: boolean;
  status: string;
  aliases?: string[];
  rotationStatus: "Actual" | "Histórico";
  poolCheckedAt: string;
  firstPickReviewedAt?: string;
  firstPickConfidence?: "Baja" | "Media" | "Alta";
  firstPickNotes?: string;
  geometry?: MapGeometryProfile;
  geometryReviewedAt?: string;
  firstPickModelVersion?: string;
  firstPickCandidates?: Array<{
    name: string;
    score: number;
    reasons: string[];
    risks: string[];
  }>;
  rankedMetaCore?: string[];
  rankedMetaReviewedAt?: string;
  rankedMetaSample?: number;
  rankedMetaSource?: string;
};

export type DraftPosition = "First pick" | "Pick intermedio" | "Last pick";

export type DraftPriority = "Counter" | "Equilibrado" | "Seguro";

export type DraftFirstPickOwner = "Aliado" | "Rival";

export type PoolPolicy = "Off" | "Preferir" | "Solo pool";

export type QueueMode = "SoloQ" | "Dúo" | "Trío";

export type PlayerPoolEntry = {
  available: boolean;
  power11: boolean;
  hypercharge: boolean;
  mastery: number;
  avoid: boolean;
  favorite: boolean;
};

export type PlayerPool = Record<string, PlayerPoolEntry>;

export type MatchResult = "Victoria" | "Derrota";

export type PersonalMatch = {
  id: string;
  date: string;
  mapSlug: string;
  mapName: string;
  mode: string;
  brawler: string;
  brawlerSlug?: string;
  role?: string;
  result: MatchResult;
  draftPosition?: DraftPosition;
  allies?: string[];
  enemies?: string[];
  note: string;
  source: "Manual" | "Draft Coach" | "Live Review";
};

export type PersonalStat = {
  games: number;
  wins: number;
  losses: number;
  winRate: number;
};

export type PersonalPerformance = {
  overall: PersonalStat;
  brawlers: Record<string, PersonalStat>;
  maps: Record<string, PersonalStat>;
  roles: Record<string, PersonalStat>;
  brawlerMaps: Record<string, PersonalStat>;
};



export type LiveEventTone = "good" | "bad" | "neutral" | "objective";

export type LiveEventSource = "Manual" | "Auto";

export type AutoFeedbackVerdict = "accepted" | "rejected";

export type AutoFeedbackStat = {
  accepted: number;
  rejected: number;
};

export type AutoFeedbackProfile = Record<string, AutoFeedbackStat>;

export type AutoReviewHealth = "Calibrando" | "Buena" | "Estática" | "Inestable";

export type LiveMatchEvent = {
  id: string;
  second: number;
  label: string;
  category: string;
  tone: LiveEventTone;
  note?: string;
  source?: LiveEventSource;
};

export type LiveMatchSnapshot = {
  second: number;
  label?: string;
  mode?: string;
  objective?: string;
  score?: string;
  health?: string;
  superReady?: boolean;
  ammo?: number;
  visibleEnemies?: number;
  centerControl?: boolean;
  note?: string;
};

export type LiveMatchReview = {
  id: string;
  createdAt: string;
  duration: number;
  map?: string;
  mode?: string;
  brawler?: string;
  result?: MatchResult;
  summary: string;
  events: LiveMatchEvent[];
  snapshots?: LiveMatchSnapshot[];
};
