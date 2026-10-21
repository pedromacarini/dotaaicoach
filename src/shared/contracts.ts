export interface GameSnapshot {
  source: 'idle' | 'demo' | 'gsi';
  connected: boolean;
  receivedAt: number | null;
  gameTime: number | null;
  /** Valor bruto de map.game_time, antes da calibração do início da partida. */
  rawGameTime?: number | null;
  patch?: string | null;
  mode?: ItemTimingMode | null;
  matchId: string | null;
  gameState: string | null;
  playerActivity: string | null;
  heroInternalName: string | null;
  heroName: string | null;
  heroLevel: number | null;
  lastHits: number | null;
  denies: number | null;
  netWorth: number | null;
  gpm: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  learnedAbilities?: Record<string, number>;
  inventory: InventorySnapshot;
  /** Draft opcional enviado pelo GSI. Ausência nunca é inferida. */
  draft?: DraftLiveState;
}

export type InventoryArea = 'active' | 'backpack' | 'stash' | 'teleport' | 'neutral';
export type InventorySlotState = 'present' | 'empty' | 'unknown';

export interface InventorySlot {
  key: string;
  area: InventoryArea;
  state: InventorySlotState;
  itemInternalName: string | null;
  charges: number | null;
}

export interface InventorySnapshot {
  observation: 'observed' | 'unknown';
  slots: InventorySlot[];
}

export interface ItemObservation {
  itemInternalName: string;
  firstSeenAt: number | null;
  firstSeenReceivedAt: number | null;
  firstSeenArea: InventoryArea;
}

export type ItemTimingVerdict = 'early' | 'expected' | 'late' | 'no-sample' | 'unknown-time';
export type ItemTimingMode = 'normal' | 'turbo';
export type ItemTimingBenchmarkSourceKind = 'opendota-purchase-log' | 'stratz-purchase-log' | 'synthetic-fixture';

/** Uma primeira compra histórica extraída de purchase_log; nunca representa o inventário ao vivo. */
export interface ItemPurchaseLogSample {
  matchId: string;
  heroInternalName: string;
  position: Position;
  itemInternalName: string;
  purchaseTimeSeconds: number;
  patch: string;
  mode: ItemTimingMode;
  source: string;
  sourceKind: Exclude<ItemTimingBenchmarkSourceKind, 'synthetic-fixture'>;
}

export interface ItemTimingBenchmark {
  schemaVersion: 1;
  heroInternalName: string;
  position: Position;
  itemInternalName: string;
  medianSeconds: number;
  p25Seconds: number;
  p75Seconds: number;
  sampleSize: number;
  patch: string;
  mode: ItemTimingMode;
  source: string;
  sourceKind: ItemTimingBenchmarkSourceKind;
  updatedAt: string;
}

export interface ItemTimingComparison {
  observation: ItemObservation;
  verdict: ItemTimingVerdict;
  deltaSeconds: number | null;
  benchmark: ItemTimingBenchmark | null;
}

export interface ItemTimingState {
  sessionKey: string | null;
  source: GameSnapshot['source'];
  validation: 'none' | 'synthetic-demo' | 'historical-local' | 'unvalidated-gsi';
  inventory: InventorySnapshot;
  observations: ItemObservation[];
  comparisons: ItemTimingComparison[];
}

export type DraftMode = 'all-pick' | 'turbo' | 'captains';

export interface DraftScenario {
  id: string;
  name: string;
  mode: DraftMode;
  position: Position;
  allies: number[];
  enemies: number[];
  bans: number[];
  updatedAt: number;
}

export interface DraftScenarioState {
  schemaVersion: 1;
  current: DraftScenario;
  saved: DraftScenario[];
}

export type DraftLivePhase = 'lobby' | 'strategy' | 'picking' | 'banning' | 'complete' | 'unknown';
export type DraftTeam = 'radiant' | 'dire' | 'unknown';
export type DraftPickKind = 'pick' | 'ban';
export type DraftPickSource = 'gsi' | 'manual';

export interface DraftPick {
  heroId: number;
  team: DraftTeam;
  kind: DraftPickKind;
  order: number;
  source: DraftPickSource;
  confirmedAt: number;
}

export interface DraftContextPrompt {
  visible: boolean;
  message: string;
  phase: DraftLivePhase;
  cooldownUntil: number | null;
  action: 'ranked' | 'follow' | 'later' | null;
}

export interface DraftLiveState {
  source: 'gsi' | 'manual' | 'unavailable';
  /** Time do jogador local, quando o payload do GSI informar. */
  localTeam: DraftTeam;
  phase: DraftLivePhase;
  activeTeam: DraftTeam;
  secondsRemaining: number | null;
  allies: DraftPick[];
  enemies: DraftPick[];
  bans: DraftPick[];
  revision: number;
  receivedAt: number | null;
  prompt?: DraftContextPrompt;
}

export interface DraftMatchupRow {
  heroId: number;
  gamesPlayed: number;
  wins: number;
}

export interface DraftMatchupEvidence {
  focalEnemyId: number;
  source: string;
  fetchedAt: string;
  rows: DraftMatchupRow[];
}

export interface DraftExplanation {
  kind: 'statistic' | 'heuristic' | 'unavailable';
  text: string;
}

export interface DraftRecommendation {
  heroId: number;
  heroName: string;
  captainMode: boolean;
  statistic: null | {
    source: string;
    fetchedAt: string;
    sampleSize: number;
    opponentsCovered: number;
    winRate: number;
    advantage: number;
    confidence: 'low' | 'medium' | 'high';
  };
  roleCoverage: {
    kind: 'heuristic';
    addedRoles: string[];
    positionRoleMatched: boolean;
  };
  explanations: DraftExplanation[];
}

export type Position = 1 | 2 | 3 | 4 | 5;
export interface OverlayModules {
  stats: boolean;
  skill: boolean;
  items: boolean;
  alerts: boolean;
}

export interface OverlayLayout {
  x: number | null;
  y: number | null;
  scale: number;
  opacity: number;
  locked: boolean;
  modules: OverlayModules;
}

export interface OverlayLayoutPatch {
  x?: number | null;
  y?: number | null;
  scale?: number;
  opacity?: number;
  locked?: boolean;
  modules?: Partial<OverlayModules>;
}

export interface AppPreferences {
  schemaVersion: 2;
  position: Position;
  overlayLayout: OverlayLayout;
}
export interface LocalProfile { schemaVersion: 1; localId: string; displayName: string; preferredPosition: Position; createdAt: string; updatedAt: string; }
export interface LicenseStatus { valid: boolean; plan: 'free' | 'premium'; subject: string | null; expiresAt: string | null; features: string[]; reason: string; }

export interface TelemetryEvent {
  name: string;
  at: string;
  data: Record<string, string | number | boolean | null>;
}

export interface TelemetryState {
  schemaVersion: 1;
  enabled: boolean;
  events: TelemetryEvent[];
}

export type MatchSessionSource = 'real' | 'demo';
export type MatchSessionEndReason = 'post-game' | 'new-match' | 'demo-complete';

export interface MatchSample {
  recordedAt: number;
  gameTime: number;
  lastHits: number | null;
  denies: number | null;
  netWorth: number | null;
  gpm: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
}

export interface MatchSessionSummary {
  duration: number;
  sampleCount: number;
  lastHits: number | null;
  denies: number | null;
  netWorth: number | null;
  gpm: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
}

export interface MatchSession {
  id: string;
  source: MatchSessionSource;
  position: Position;
  heroInternalName: string | null;
  heroName: string | null;
  startedAt: number;
  endedAt: number | null;
  endReason: MatchSessionEndReason | null;
  samples: MatchSample[];
  summary: MatchSessionSummary;
}

export interface MatchSessionState {
  active: MatchSession | null;
  recent: MatchSession[];
}

export interface MatchSessionUpdate {
  active: MatchSession | null;
  recentChanged: boolean;
}

export type NotificationMode = 'normal' | 'turbo';
export type NotificationPosition = Position | 'all';
export type NotificationAudioMode = 'silent' | 'beep' | 'voice';

export interface NotificationRule {
  id: string;
  enabled: boolean;
  title: string;
  atSeconds: number;
  position: NotificationPosition;
  tags: string[];
  repeatEverySeconds: number | null;
  repeatUntilSeconds: number | null;
  durationSeconds: number;
  audio: NotificationAudioMode;
}

export interface NotificationPreset {
  id: string;
  name: string;
  patch: string;
  mode: NotificationMode;
  description: string;
  rules: NotificationRule[];
}

export interface NotificationConfig {
  schemaVersion: 1;
  mode: NotificationMode;
  rules: NotificationRule[];
}

export interface NotificationBanner {
  id: string;
  ruleId: string;
  title: string;
  scheduledAt: number;
  tags: string[];
  expiresAt: number;
  audio: NotificationAudioMode;
}

export interface NotificationContextEvent {
  id: string;
  title: string;
  tags: string[];
  audio: NotificationAudioMode;
  durationSeconds: number;
  scheduledAt?: number;
}

export interface NotificationRuntime {
  gameTime: number | null;
  simulated: boolean;
  active: NotificationBanner[];
}

export interface NotificationCenterState {
  config: NotificationConfig;
  presets: NotificationPreset[];
  runtime: NotificationRuntime;
}

export interface NotificationFileResult {
  canceled: boolean;
  filePath?: string;
  state: NotificationCenterState;
}

export interface AppStatus {
  overlayVisible: boolean;
  overlayEditing: boolean;
  overlayEffectiveScale: number;
  demoEnabled: boolean;
  gsiPort: number;
  gsiListening: boolean;
  error: string | null;
}

export interface GsiInstallation {
  detected: boolean;
  dotaPath: string | null;
  configDirectory: string | null;
  configFilePath: string | null;
  configInstalled: boolean;
  configCurrent: boolean;
  detectionSource: string | null;
  error: string | null;
}

export interface GsiDiagnostics {
  installation: GsiInstallation;
  packetsReceived: number;
  rejectedRequests: number;
  lastPacketAt: number | null;
  lastProblem: string | null;
}

export interface GsiInstallResult {
  canceled: boolean;
  installed: boolean;
  diagnostics: GsiDiagnostics;
}

export interface DotaOverlayAPI {
  getLocalProfile(): Promise<LocalProfile>;
  updateLocalProfile(patch: { displayName?: string; preferredPosition?: Position }): Promise<LocalProfile>;
  getLicenseStatus(): Promise<LicenseStatus>;
  importLicense(): Promise<LicenseStatus>;
  activateLicenseCode(code: string): Promise<LicenseStatus>;
  getTelemetry(): Promise<TelemetryState>;
  setTelemetryEnabled(enabled: boolean): Promise<TelemetryState>;
  clearTelemetry(): Promise<TelemetryState>;
  exportTelemetry(): Promise<{ canceled: boolean; filePath?: string }>;
  getSnapshot(): Promise<GameSnapshot>;
  getStatus(): Promise<AppStatus>;
  getPreferences(): Promise<AppPreferences>;
  getGsiDiagnostics(): Promise<GsiDiagnostics>;
  getMatchSessions(): Promise<MatchSessionState>;
  getItemTiming(): Promise<ItemTimingState>;
  getDraftScenarios(): Promise<DraftScenarioState>;
  getDraftLive(): Promise<DraftLiveState>;
  onSnapshot(handler: (snapshot: GameSnapshot) => void): () => void;
  onStatus(handler: (status: AppStatus) => void): () => void;
  onPreferences(handler: (preferences: AppPreferences) => void): () => void;
  onGsiDiagnostics(handler: (diagnostics: GsiDiagnostics) => void): () => void;
  onMatchSessions(handler: (update: MatchSessionUpdate) => void): () => void;
  onItemTiming(handler: (state: ItemTimingState) => void): () => void;
  onDraftScenarios(handler: (state: DraftScenarioState) => void): () => void;
  onDraftLive(handler: (state: DraftLiveState) => void): () => void;
  dismissDraftPrompt(action: 'ranked' | 'follow' | 'later'): Promise<DraftLiveState>;
  setDemo(enabled: boolean): Promise<void>;
  setOverlayVisible(visible: boolean): Promise<void>;
  saveGsiConfig(): Promise<{ canceled: boolean; filePath?: string }>;
  installGsiConfig(): Promise<GsiInstallResult>;
  showDashboard(): Promise<void>;
  getLibraryUrl(): Promise<string | null>;
  setPosition(position: Position): Promise<AppPreferences>;
  updateOverlayLayout(patch: OverlayLayoutPatch): Promise<AppPreferences>;
  resetOverlayLayout(): Promise<AppPreferences>;
  setOverlayEditing(editing: boolean): Promise<AppStatus>;
  resizeOverlay(scale: number): Promise<AppPreferences>;
  getNotificationCenter(): Promise<NotificationCenterState>;
  onNotificationCenter(handler: (state: NotificationCenterState) => void): () => void;
  upsertNotificationRule(rule: NotificationRule): Promise<NotificationCenterState>;
  deleteNotificationRule(ruleId: string): Promise<NotificationCenterState>;
  setNotificationMode(mode: NotificationMode): Promise<NotificationCenterState>;
  applyNotificationPreset(presetId: string): Promise<NotificationCenterState>;
  importNotifications(): Promise<NotificationFileResult>;
  exportNotifications(): Promise<NotificationFileResult>;
  setSimulatedGameTime(gameTime: number | null): Promise<NotificationCenterState>;
  dismissNotification(bannerId: string): Promise<NotificationCenterState>;
  previewNotificationSound(): Promise<void>;
  updateDraftScenario(scenario: DraftScenario): Promise<DraftScenarioState>;
  saveDraftScenario(scenario: DraftScenario): Promise<DraftScenarioState>;
  deleteDraftScenario(scenarioId: string): Promise<DraftScenarioState>;
}
