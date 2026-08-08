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
};

export type DraftPosition = "First pick" | "Pick intermedio" | "Last pick";

export type PlayerPoolEntry = {
  available: boolean;
  power11: boolean;
  hypercharge: boolean;
  mastery: number;
  avoid: boolean;
};

export type PlayerPool = Record<string, PlayerPoolEntry>;

export type TacticalBuild = {
  gadget: string;
  starPower: string;
  gears: string[];
  hypercharge: string;
  reason: string;
};

export type LanePlan = {
  lane: string;
  target?: string;
  avoid?: string;
  instruction: string;
};

export type DraftInput = {
  map: MapProfile;
  position: DraftPosition;
  allies: string[];
  enemies: string[];
  bans: string[];
  myPick?: string;
  personalPool?: PlayerPool;
  usePersonalPool?: boolean;
};

export type DraftMetrics = {
  mapFit: number;
  counter: number;
  synergy: number;
  safety: number;
  composition: number;
  personal: number;
  risk: number;
};

export type DraftRecommendation = {
  brawler: Brawler;
  score: number;
  reasons: string[];
  brief: string;
  warning?: string;
  metrics: DraftMetrics;
  countersHit: string[];
  exposedTo: string[];
  suggestedLine: string;
  plan: string;
  build: TacticalBuild;
  lanePlan: LanePlan;
};

export type BanRecommendation = {
  brawler: Brawler;
  score: number;
  reasons: string[];
};

export type EnemyPickPrediction = {
  brawler: Brawler;
  score: number;
  target?: string;
  reason: string;
  response: string;
};

export type TeamAssignment = {
  ally: string;
  enemy?: string;
  lane: string;
  instruction: string;
};


export type WinEstimate = {
  percentage: number;
  lower: number;
  upper: number;
  confidence: "Baja" | "Media" | "Alta";
  completeness: number;
  alliedScore: number;
  enemyScore: number;
  title: string;
  advantages: string[];
  risks: string[];
  disclaimer: string;
};

export type DraftAnalysis = {
  recommendations: DraftRecommendation[];
  selectedPick?: DraftRecommendation;
  winEstimate?: WinEstimate;
  needs: string[];
  threats: string[];
  strengths: string[];
  enemyWeaknesses: string[];
  banRecommendations: BanRecommendation[];
  predictedEnemyPicks: EnemyPickPrediction[];
  teamAssignments: TeamAssignment[];
  compositionScore: number;
  draftStage: string;
  availableCount: number;
};
