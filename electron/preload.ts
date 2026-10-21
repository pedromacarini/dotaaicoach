// Ponte autocontida e compatível com preload sandboxed do Electron.
// Referências de tipos são eliminadas na compilação.
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');
type DotaOverlayAPI = import('../src/shared/contracts').DotaOverlayAPI;
type GameSnapshot = import('../src/shared/contracts').GameSnapshot;
type AppStatus = import('../src/shared/contracts').AppStatus;
type AppPreferences = import('../src/shared/contracts').AppPreferences;
type GsiDiagnostics = import('../src/shared/contracts').GsiDiagnostics;
type MatchSessionUpdate = import('../src/shared/contracts').MatchSessionUpdate;
type OverlayLayoutPatch = import('../src/shared/contracts').OverlayLayoutPatch;
type NotificationCenterState = import('../src/shared/contracts').NotificationCenterState;
type NotificationRule = import('../src/shared/contracts').NotificationRule;
type NotificationMode = import('../src/shared/contracts').NotificationMode;
type ItemTimingState = import('../src/shared/contracts').ItemTimingState;
type DraftScenarioState = import('../src/shared/contracts').DraftScenarioState;
type DraftLiveState = import('../src/shared/contracts').DraftLiveState;
type DraftScenario = import('../src/shared/contracts').DraftScenario;
type LocalProfile = import('../src/shared/contracts').LocalProfile;
type LicenseStatus = import('../src/shared/contracts').LicenseStatus;
type TelemetryState = import('../src/shared/contracts').TelemetryState;

const overlayBridge: DotaOverlayAPI = {
  getSnapshot: () => ipcRenderer.invoke('snapshot:get'),
  getStatus: () => ipcRenderer.invoke('status:get'),
  getPreferences: () => ipcRenderer.invoke('preferences:get'),
  getGsiDiagnostics: () => ipcRenderer.invoke('gsi:diagnostics'),
  getMatchSessions: () => ipcRenderer.invoke('sessions:get'),
  getItemTiming: () => ipcRenderer.invoke('items:get'),
  getDraftScenarios: () => ipcRenderer.invoke('draft:get'),
  getDraftLive: () => ipcRenderer.invoke('draft-live:get') as Promise<DraftLiveState>,
  getLocalProfile: () => ipcRenderer.invoke('profile:get') as Promise<LocalProfile>,
  updateLocalProfile: patch => ipcRenderer.invoke('profile:update', patch),
  getLicenseStatus: () => ipcRenderer.invoke('license:get') as Promise<LicenseStatus>,
  importLicense: () => ipcRenderer.invoke('license:import') as Promise<LicenseStatus>,
  activateLicenseCode: code => ipcRenderer.invoke('license:activate-code', code) as Promise<LicenseStatus>,
  getTelemetry: () => ipcRenderer.invoke('telemetry:get') as Promise<TelemetryState>,
  setTelemetryEnabled: enabled => ipcRenderer.invoke('telemetry:set-enabled', enabled) as Promise<TelemetryState>,
  clearTelemetry: () => ipcRenderer.invoke('telemetry:clear') as Promise<TelemetryState>,
  exportTelemetry: () => ipcRenderer.invoke('telemetry:export'),
  exportDiagnosticReport: () => ipcRenderer.invoke('diagnostics:export'),
  onSnapshot: handler => {
    const listener = (_event: Electron.IpcRendererEvent, value: GameSnapshot) => handler(value);
    ipcRenderer.on('snapshot:changed', listener);
    return () => ipcRenderer.removeListener('snapshot:changed', listener);
  },
  onStatus: handler => {
    const listener = (_event: Electron.IpcRendererEvent, value: AppStatus) => handler(value);
    ipcRenderer.on('status:changed', listener);
    return () => ipcRenderer.removeListener('status:changed', listener);
  },
  onPreferences: handler => {
    const listener = (_event: Electron.IpcRendererEvent, value: AppPreferences) => handler(value);
    ipcRenderer.on('preferences:changed', listener);
    return () => ipcRenderer.removeListener('preferences:changed', listener);
  },
  onGsiDiagnostics: handler => {
    const listener = (_event: Electron.IpcRendererEvent, value: GsiDiagnostics) => handler(value);
    ipcRenderer.on('gsi:diagnostics-changed', listener);
    return () => ipcRenderer.removeListener('gsi:diagnostics-changed', listener);
  },
  onMatchSessions: handler => {
    const listener = (_event: Electron.IpcRendererEvent, value: MatchSessionUpdate) => handler(value);
    ipcRenderer.on('sessions:changed', listener);
    return () => ipcRenderer.removeListener('sessions:changed', listener);
  },
  onItemTiming: handler => {
    const listener = (_event: Electron.IpcRendererEvent, value: ItemTimingState) => handler(value);
    ipcRenderer.on('items:changed', listener);
    return () => ipcRenderer.removeListener('items:changed', listener);
  },
  onDraftScenarios: handler => {
    const listener = (_event: Electron.IpcRendererEvent, value: DraftScenarioState) => handler(value);
    ipcRenderer.on('draft:changed', listener);
    return () => ipcRenderer.removeListener('draft:changed', listener);
  },
  onDraftLive: handler => {
    const listener = (_event: Electron.IpcRendererEvent, value: DraftLiveState) => handler(value);
    ipcRenderer.on('draft-live:changed', listener);
    return () => ipcRenderer.removeListener('draft-live:changed', listener);
  },
  dismissDraftPrompt: action => ipcRenderer.invoke('draft-live:dismiss', action) as Promise<DraftLiveState>,
  setDemo: enabled => ipcRenderer.invoke('demo:set', enabled),
  setOverlayVisible: visible => ipcRenderer.invoke('overlay:visible', visible),
  saveGsiConfig: () => ipcRenderer.invoke('gsi:save-config'),
  installGsiConfig: () => ipcRenderer.invoke('gsi:install-config'),
  showDashboard: () => ipcRenderer.invoke('dashboard:show'),
  getLibraryUrl: () => ipcRenderer.invoke('library:url'),
  setPosition: position => ipcRenderer.invoke('preferences:set-position', position),
  updateOverlayLayout: (patch: OverlayLayoutPatch) => ipcRenderer.invoke('preferences:update-overlay-layout', patch),
  resetOverlayLayout: () => ipcRenderer.invoke('preferences:reset-overlay-layout'),
  setOverlayEditing: editing => ipcRenderer.invoke('overlay:editing', editing),
  resizeOverlay: scale => ipcRenderer.invoke('overlay:resize', scale),
  getNotificationCenter: () => ipcRenderer.invoke('notifications:get'),
  onNotificationCenter: handler => {
    const listener = (_event: Electron.IpcRendererEvent, value: NotificationCenterState) => handler(value);
    ipcRenderer.on('notifications:changed', listener);
    return () => ipcRenderer.removeListener('notifications:changed', listener);
  },
  upsertNotificationRule: (rule: NotificationRule) => ipcRenderer.invoke('notifications:upsert', rule),
  deleteNotificationRule: ruleId => ipcRenderer.invoke('notifications:delete', ruleId),
  setNotificationMode: (mode: NotificationMode) => ipcRenderer.invoke('notifications:set-mode', mode),
  applyNotificationPreset: presetId => ipcRenderer.invoke('notifications:apply-preset', presetId),
  importNotifications: () => ipcRenderer.invoke('notifications:import'),
  exportNotifications: () => ipcRenderer.invoke('notifications:export'),
  setSimulatedGameTime: gameTime => ipcRenderer.invoke('notifications:simulate', gameTime),
  dismissNotification: bannerId => ipcRenderer.invoke('notifications:dismiss', bannerId),
  previewNotificationSound: () => ipcRenderer.invoke('notifications:preview-sound'),
  updateDraftScenario: (scenario: DraftScenario) => ipcRenderer.invoke('draft:update', scenario),
  saveDraftScenario: (scenario: DraftScenario) => ipcRenderer.invoke('draft:save', scenario),
  deleteDraftScenario: scenarioId => ipcRenderer.invoke('draft:delete', scenarioId),
};
contextBridge.exposeInMainWorld('dotaOverlay', overlayBridge);
