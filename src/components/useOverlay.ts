import { useEffect, useState } from 'react';
import type { AppPreferences, AppStatus, DraftScenarioState, GameSnapshot, GsiDiagnostics, ItemTimingState, LicenseStatus, LocalProfile, MatchSessionState, NotificationCenterState, TelemetryState } from '../shared/contracts';

export const empty: GameSnapshot = {
  source: 'idle', connected: false, receivedAt: null, gameTime: null, matchId: null, gameState: null,
  playerActivity: null,
  heroInternalName: null, heroName: null, heroLevel: null, lastHits: null, denies: null, netWorth: null,
  gpm: null, kills: null, deaths: null, assists: null, inventory: { observation: 'unknown', slots: [] },
};
export const defaultStatus: AppStatus = { overlayVisible: true, overlayEditing: false, overlayEffectiveScale: 1, demoEnabled: false, gsiPort: 3199, gsiListening: false, error: null };
export const defaultPreferences: AppPreferences = {
  schemaVersion: 2,
  position: 1,
  overlayLayout: {
    x: null, y: null, scale: 1, opacity: 1, locked: false,
    modules: { stats: true, skill: true, items: true, alerts: true },
  },
};
export const defaultGsiDiagnostics: GsiDiagnostics = {
  installation: { detected: false, dotaPath: null, configDirectory: null, configFilePath: null,
    configInstalled: false, configCurrent: false, detectionSource: null, error: null },
  packetsReceived: 0, rejectedRequests: 0, lastPacketAt: null, lastProblem: null,
};
export const defaultMatchSessions: MatchSessionState = { active: null, recent: [] };
export const defaultNotificationCenter: NotificationCenterState = {
  config: { schemaVersion: 1, mode: 'normal', rules: [] },
  presets: [], runtime: { gameTime: null, simulated: false, active: [] },
};
export const defaultItemTiming: ItemTimingState = {
  sessionKey: null, source: 'idle', validation: 'none', inventory: { observation: 'unknown', slots: [] },
  observations: [], comparisons: [],
};
export const defaultDraftScenarios: DraftScenarioState = {
  schemaVersion: 1,
  current: { id: 'draft-default', name: 'Meu draft', mode: 'all-pick', position: 1,
    allies: [], enemies: [], bans: [], updatedAt: 0 },
  saved: [],
};
export const defaultTelemetry: TelemetryState = { schemaVersion: 1, enabled: false, events: [] };
export const formatClock = (time: number | null): string => {
  if (time == null) return '--:--';
  const sign = time < 0 ? '-' : '';
  const abs = Math.floor(Math.abs(time));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};
export function useOverlay() {
  const [snapshot, setSnapshot] = useState<GameSnapshot>(empty);
  const [status, setStatus] = useState<AppStatus>(defaultStatus);
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [gsiDiagnostics, setGsiDiagnostics] = useState<GsiDiagnostics>(defaultGsiDiagnostics);
  const [matchSessions, setMatchSessions] = useState<MatchSessionState>(defaultMatchSessions);
  const [notificationCenter, setNotificationCenter] = useState<NotificationCenterState>(defaultNotificationCenter);
  const [itemTiming, setItemTiming] = useState<ItemTimingState>(defaultItemTiming);
  const [draftScenarios, setDraftScenarios] = useState<DraftScenarioState>(defaultDraftScenarios);
  const [localProfile, setLocalProfile] = useState<LocalProfile | null>(null);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryState>(defaultTelemetry);
  useEffect(() => {
    let mounted = true;
    const tracksSessions = new URLSearchParams(window.location.search).get('mode') !== 'overlay';
    const api = window.dotaOverlay;
    if (!api) {
      setStatus(current => ({ ...current,
        error: 'Ponte Electron (preload) indisponível. Confira as mensagens do terminal. Os controles precisam da ponte.' }));
      return () => { mounted = false; };
    }
    const offSnapshot = api.onSnapshot(v => { if (mounted) setSnapshot(v); });
    const offStatus = api.onStatus(v => { if (mounted) setStatus(v); });
    const offPreferences = api.onPreferences(v => { if (mounted) setPreferences(v); });
    const offGsiDiagnostics = api.onGsiDiagnostics(v => { if (mounted) setGsiDiagnostics(v); });
    const offMatchSessions = tracksSessions
      ? api.onMatchSessions(update => {
        if (!mounted) return;
        setMatchSessions(current => ({ ...current, active: update.active }));
        if (update.recentChanged) void api.getMatchSessions()
          .then(value => { if (mounted) setMatchSessions(value); })
          .catch(err => { if (mounted) setStatus(old => ({...old, error: 'Falha ao atualizar histórico: '+String(err)})); });
      }) : () => undefined;
    const offNotifications = api.onNotificationCenter(value => { if (mounted) setNotificationCenter(value); });
    const offItemTiming = api.onItemTiming(value => { if (mounted) setItemTiming(value); });
    const offDraftScenarios = api.onDraftScenarios(value => { if (mounted) setDraftScenarios(value); });
    void api.getSnapshot().then(v => { if (mounted) setSnapshot(v); })
      .catch(err => { if (mounted) setStatus(old => ({...old, error: 'Falha ao buscar dados GSI: '+String(err)})); });
    void api.getStatus().then(v => { if (mounted) setStatus(v); })
      .catch(err => { if (mounted) setStatus(old => ({...old, error: 'Falha ao buscar estado do app: '+String(err)})); });
    if (tracksSessions) void api.getLocalProfile().then(v => { if (mounted) setLocalProfile(v); })
      .catch(err => { if (mounted) setStatus(old => ({...old, error: 'Falha ao buscar perfil local: '+String(err)})); });
    if (tracksSessions) void api.getLicenseStatus().then(v => { if (mounted) setLicense(v); })
      .catch(err => { if (mounted) setStatus(old => ({...old, error: 'Falha ao buscar licença local: '+String(err)})); });
    if (tracksSessions) void api.getTelemetry().then(v => { if (mounted) setTelemetry(v); })
      .catch(err => { if (mounted) setStatus(old => ({...old, error: 'Falha ao buscar telemetria local: '+String(err)})); });
    void api.getPreferences().then(v => { if (mounted) setPreferences(v); })
      .catch(err => { if (mounted) setStatus(old => ({...old, error: 'Falha ao buscar preferências: '+String(err)})); });
    void api.getGsiDiagnostics().then(v => { if (mounted) setGsiDiagnostics(v); })
      .catch(err => { if (mounted) setStatus(old => ({...old, error: 'Falha ao buscar diagnóstico GSI: '+String(err)})); });
    if (tracksSessions) void api.getMatchSessions().then(v => { if (mounted) setMatchSessions(v); })
      .catch(err => { if (mounted) setStatus(old => ({...old, error: 'Falha ao buscar histórico: '+String(err)})); });
    void api.getNotificationCenter().then(v => { if (mounted) setNotificationCenter(v); })
      .catch(err => { if (mounted) setStatus(old => ({...old, error: 'Falha ao buscar cronograma: '+String(err)})); });
    void api.getItemTiming().then(v => { if (mounted) setItemTiming(v); })
      .catch(err => { if (mounted) setStatus(old => ({...old, error: 'Falha ao buscar timing de itens: '+String(err)})); });
    if (tracksSessions) void api.getDraftScenarios().then(v => { if (mounted) setDraftScenarios(v); })
      .catch(err => { if (mounted) setStatus(old => ({...old, error: 'Falha ao buscar drafts: '+String(err)})); });
    return () => { mounted = false; offSnapshot(); offStatus(); offPreferences(); offGsiDiagnostics(); offMatchSessions(); offNotifications(); offItemTiming(); offDraftScenarios(); };
  }, []);
  return { snapshot, status, preferences, gsiDiagnostics, matchSessions, notificationCenter, itemTiming, draftScenarios, localProfile, setLocalProfile, license, setLicense, telemetry, setTelemetry };
}
