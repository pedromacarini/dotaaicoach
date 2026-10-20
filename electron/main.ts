import { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen, shell } from 'electron';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { GameSnapshot, AppStatus, DraftScenario, GsiDiagnostics, ItemTimingState, MatchSessionState, MatchSessionUpdate, NotificationMode, OverlayLayoutPatch } from '../src/shared/contracts';
import { GSI_PORT, generateToken, makeGsiConfig, startGsiServer, unknownInventory } from './gsi';
import { resolveRendererTarget } from './renderer-target';
import { createPreferencesStore, defaultPreferences, type PreferencesStore } from './preferences';
import { createOverlayWindowController, resolveOverlayBounds, type OverlayWindowController } from './overlay-window';
import { createSessionHistoryStore } from './session-history';
import { createMatchSessionRecorder, type MatchSessionRecorder } from './match-session-recorder';
import { createNotificationStore, type NotificationStore } from './notification-store';
import { createNotificationCenter, type NotificationCenter } from './notification-center';
import { createItemTracker, type ItemTracker } from '../src/core/item-tracker';
import { createDraftStore, type DraftStore } from './draft-store';
import { createProfileStore, type ProfileStore } from './profile-store';
import { createLicenseStore, type LicenseStore } from './license-store';
import type { Position } from '../src/shared/contracts';
import {
  defaultSteamRoots, discoverDotaInstallation, inspectGsiInstallation, installGsiConfiguration,
  resolveDotaPath, type DotaLocation,
} from './gsi-installation';

let dashboard: BrowserWindow | null = null;
let overlay: BrowserWindow | null = null;
let gsiServer: Awaited<ReturnType<typeof startGsiServer>> | null = null;
let libraryServer: Server | null = null;
let libraryUrl: string | null = null;
let authToken = '';
let preferencesStore: PreferencesStore | null = null;
let overlayController: OverlayWindowController | null = null;
let sessionRecorder: MatchSessionRecorder | null = null;
let notificationStore: NotificationStore | null = null;
let notificationCenter: NotificationCenter | null = null;
let itemTracker: ItemTracker | null = null;
let draftStore: DraftStore | null = null;
let profileStore: ProfileStore | null = null;
let licenseStore: LicenseStore | null = null;
let snapshot: GameSnapshot = emptySnapshot();
const librarySmokeOutput = process.argv
  .find(argument => argument.startsWith('--library-smoke-output='))
  ?.slice('--library-smoke-output='.length) ?? null;
const overlayAdviceSmokeOutput = process.argv
  .find(argument => argument.startsWith('--overlay-advice-smoke-output='))
  ?.slice('--overlay-advice-smoke-output='.length) ?? null;
const overlayDisabledAdviceSmokeOutput = process.argv
  .find(argument => argument.startsWith('--overlay-disabled-advice-smoke-output='))
  ?.slice('--overlay-disabled-advice-smoke-output='.length) ?? null;
const overlayLayoutSmokeOutput = process.argv
  .find(argument => argument.startsWith('--overlay-layout-smoke-output='))
  ?.slice('--overlay-layout-smoke-output='.length) ?? null;
const overlayLayoutSmokeStage = process.argv
  .find(argument => argument.startsWith('--overlay-layout-smoke-stage='))
  ?.slice('--overlay-layout-smoke-stage='.length) ?? 'read';
const notificationSmokeOutput = process.argv
  .find(argument => argument.startsWith('--notification-smoke-output='))
  ?.slice('--notification-smoke-output='.length) ?? null;
const itemTimingSmokeOutput = process.argv
  .find(argument => argument.startsWith('--item-timing-smoke-output='))
  ?.slice('--item-timing-smoke-output='.length) ?? null;
const draftSmokeOutput = process.argv
  .find(argument => argument.startsWith('--draft-smoke-output='))
  ?.slice('--draft-smoke-output='.length) ?? null;
const smokeMode = Boolean(librarySmokeOutput || overlayAdviceSmokeOutput || overlayDisabledAdviceSmokeOutput || overlayLayoutSmokeOutput || notificationSmokeOutput || itemTimingSmokeOutput || draftSmokeOutput);
const status: AppStatus = { overlayVisible: true, overlayEditing: false, overlayEffectiveScale: 1, demoEnabled: false, gsiPort: GSI_PORT, gsiListening: false, error: null };
let overlayAdviceRemoteRequests = 0;
const smokeRemoteUrls: string[] = [];
let dotaLocation: DotaLocation | null = null;
let gsiDiagnostics: GsiDiagnostics = {
  installation: { detected: false, dotaPath: null, configDirectory: null, configFilePath: null,
    configInstalled: false, configCurrent: false, detectionSource: null, error: null },
  packetsReceived: 0, rejectedRequests: 0, lastPacketAt: null, lastProblem: null,
};

function emptySnapshot(): GameSnapshot {
  return { source: 'idle', connected: false, receivedAt: null, gameTime: null, matchId: null, gameState: null,
    playerActivity: null,
    heroInternalName: null, heroName: null, heroLevel: null, lastHits: null, denies: null, netWorth: null,
    gpm: null, kills: null, deaths: null, assists: null, inventory: unknownInventory() };
}

function demoSnapshot(): GameSnapshot {
  return { source: 'demo', connected: false, receivedAt: Date.now(), gameTime: 16 * 60 + 22, matchId: 'demo',
    gameState: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS', heroInternalName: 'npc_dota_hero_axe', heroName: 'Axe', heroLevel: 12,
    playerActivity: 'playing',
    lastHits: 112, denies: 9, netWorth: 8420, gpm: 515, kills: 5, deaths: 2, assists: 8,
    inventory: { observation: 'observed', slots: [
      { key: 'slot0', area: 'active', state: 'present', itemInternalName: 'item_boots', charges: null },
      { key: 'slot1', area: 'active', state: 'present', itemInternalName: 'item_blink', charges: null },
      { key: 'slot2', area: 'active', state: 'empty', itemInternalName: null, charges: null },
      { key: 'slot6', area: 'backpack', state: 'present', itemInternalName: 'item_tango', charges: 2 },
      { key: 'neutral0', area: 'neutral', state: 'unknown', itemInternalName: null, charges: null },
    ] } };
}

function send(channel: string, value: unknown): void {
  for (const win of [dashboard, overlay]) {
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel, value);
  }
}
function notify(): void { send('snapshot:changed', snapshot); send('status:changed', {...status}); }
function notificationState() {
  if (!notificationCenter) throw new Error('Central de notificações ainda não foi inicializada.');
  return notificationCenter.getState();
}
function notifyNotifications(): void { if (notificationCenter) send('notifications:changed', notificationCenter.getState()); }
function itemTimingState(): ItemTimingState {
  return itemTracker?.getState() ?? { sessionKey: null, source: 'idle', validation: 'none',
    inventory: unknownInventory(), observations: [], comparisons: [] };
}
function notifyItemTiming(): void { if (itemTracker) send('items:changed', itemTracker.getState()); }
function draftState() {
  if (!draftStore) throw new Error('Draft Advisor ainda não foi inicializado.');
  return draftStore.get();
}
function notifyDraft(): void { if (draftStore) send('draft:changed', draftStore.get()); }
function notifyGsiDiagnostics(): void { send('gsi:diagnostics-changed', gsiDiagnostics); }
function matchSessions(): MatchSessionState { return sessionRecorder?.getState() ?? { active: null, recent: [] }; }
function notifyMatchSessions(recentChanged: boolean): void {
  const update: MatchSessionUpdate = { active: sessionRecorder?.getActive() ?? null, recentChanged };
  if (dashboard && !dashboard.isDestroyed() && !dashboard.webContents.isDestroyed())
    dashboard.webContents.send('sessions:changed', update);
}
function refreshGsiInstallation(location?: DotaLocation | null): void {
  dotaLocation = location === undefined ? discoverDotaInstallation(defaultSteamRoots()) : location;
  gsiDiagnostics = { ...gsiDiagnostics,
    installation: inspectGsiInstallation(dotaLocation, makeGsiConfig(authToken)) };
  notifyGsiDiagnostics();
}
function updateSnapshot(value: GameSnapshot): void {
  status.demoEnabled = false;
  snapshot = value;
  const sessionUpdate = sessionRecorder?.accept(value);
  if (sessionUpdate?.changed) notifyMatchSessions(sessionUpdate.recentChanged);
  if (notificationCenter?.acceptGameTime(value.gameTime, Date.now(), value.matchId)) notifyNotifications();
  const itemUpdate = itemTracker?.accept(value, preferencesStore?.get().position ?? 1);
  if (itemUpdate?.changed) notifyItemTiming();
  notify();
}

async function startLibraryServer(): Promise<void> {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'dota-library-pack')
    : path.resolve(app.getAppPath(), 'dota-library-pack');
  const modulePath = path.join(base, 'scripts', 'serve-library.cjs');
  const libraryModule = require(modulePath) as {
    makeServer(options: { base: string; remoteFetch?: typeof fetch }): Server;
  };
  const smokeFetch: typeof fetch | undefined = (overlayAdviceSmokeOutput || overlayDisabledAdviceSmokeOutput || itemTimingSmokeOutput || draftSmokeOutput) ? async input => {
    overlayAdviceRemoteRequests++;
    const url = String(input);
    smokeRemoteUrls.push(url);
    if (url.includes('/heroes/1/matchups')) return new Response(JSON.stringify([
      { hero_id: 5, games_played: 240, wins: 96 },
      { hero_id: 25, games_played: 100, wins: 55 },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/explorer?sql=')) return new Response(JSON.stringify({ rows: [{
      match_id: 101, account_id: 10, name: 'Jogador Teste', league_name: 'Liga Teste', hero_id: 2,
      player_slot: 0, item_0: 1, item_1: 50, item_2: 63, item_3: 0, item_4: 0, item_5: 0,
      start_time: 1_790_000_000, radiant_win: true, patch: '7.41', position: 3,
    }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/matches/101')) return new Response(JSON.stringify({ players: [{
      hero_id: 2, player_slot: 0,
      ability_upgrades_arr: [5007,5009,5009,5008,5009,5010,5009,5007,5007,5008,5008,5010,5010,5007,5008,5010],
    }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/heroes/2/itemPopularity')) return new Response(JSON.stringify({
      start_game_items: { 50: 10 }, early_game_items: { 50: 20 },
      mid_game_items: { 1: 100, 50: 80, 63: 60 }, late_game_items: { 1: 70 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } : undefined;
  const server = libraryModule.makeServer({ base, remoteFetch: smokeFetch });
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError);
      resolve();
    });
  });
  const address = server.address() as AddressInfo | null;
  if (!address) {
    server.close();
    throw new Error('O servidor local não informou uma porta.');
  }
  libraryServer = server;
  libraryUrl = `http://127.0.0.1:${address.port}/`;
}

function lockDownNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
}

async function runLibrarySmoke(win: BrowserWindow, outputFile: string): Promise<void> {
  try {
    await win.webContents.executeJavaScript(`(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      const button = [...document.querySelectorAll('button')]
        .find(value => value.textContent?.includes('Biblioteca Dota 2'));
      if (!button) throw new Error('Botão da biblioteca não encontrado.');
      button.click();
    })()`);
    let frame = null;
    for (let attempt = 0; attempt < 30 && !frame; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      frame = win.webContents.mainFrame.frames
        .find(value => Boolean(libraryUrl) && value.url.startsWith(libraryUrl!)) ?? null;
    }
    if (!frame) throw new Error('Frame da biblioteca não carregou.');
    const result = await frame.executeJavaScript(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      for (let attempt = 0; attempt < 30 && !document.querySelector('.catalog-item'); attempt++)
        await wait(100);
      const heroes = [...document.querySelectorAll('.catalog-item')];
      if (heroes.length < 2) throw new Error('Catálogo de heróis não carregou.');
      const onlineRequests = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = String(input instanceof Request ? input.url : input);
        if (!url.includes('/api/opendota/')) return originalFetch(input, init);
        const parsed = new URL(url, location.href);
        onlineRequests.push(parsed.pathname + parsed.search);
        let data = {};
        if (parsed.pathname.endsWith('/matchups')) data = [];
        if (parsed.pathname.endsWith('/itemPopularity')) data = {
          start_game_items: {}, early_game_items: {}, mid_game_items: {}, late_game_items: {}
        };
        if (parsed.pathname.endsWith('/recommendations')) data = {
          heroId: 2, position: 1, sampleSize: 0, matches: [], skillBuilds: []
        };
        return new Response(JSON.stringify({
          source: 'OpenDota API (teste)', fetchedAt: new Date().toISOString(), cached: false, data
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
      heroes[1].click();
      for (let attempt = 0; attempt < 30 && onlineRequests.length < 3; attempt++) await wait(100);
      const items = [...document.querySelectorAll('#catalog-tabs button')]
        .find(value => value.textContent?.includes('Itens'));
      if (!items) throw new Error('Categoria Itens não encontrada.');
      items.click();
      for (let attempt = 0; attempt < 30 && !items.classList.contains('active'); attempt++)
        await wait(100);
      await wait(300);
      return {
        bodyTextLength: document.body.textContent?.trim().length ?? 0,
        activeTab: items.textContent?.trim() ?? '',
        itemCount: document.querySelectorAll('.catalog-item').length,
        detailTitle: document.querySelector('#details h2')?.textContent?.trim() ?? '',
        onlineRequests
      };
    })()`) as { bodyTextLength: number; activeTab: string; itemCount: number; detailTitle: string; onlineRequests: string[] };
    fs.writeFileSync(outputFile, JSON.stringify(result));
    app.exit(result.bodyTextLength > 0 && result.activeTab.includes('Itens') && result.itemCount > 0 ? 0 : 2);
  } catch (error) {
    fs.writeFileSync(outputFile, JSON.stringify({ error: String(error) }));
    app.exit(3);
  }
}

async function runOverlayAdviceSmoke(outputFile: string): Promise<void> {
  try {
    if (!dashboard || !overlay) throw new Error('Janelas de teste não foram criadas.');
    await dashboard.webContents.executeJavaScript(`(async()=>{
      await window.dotaOverlay.setPosition(3);
      await window.dotaOverlay.setDemo(true);
    })()`);
    let result: { text: string; imageCount: number } = { text: '', imageCount: 0 };
    for (let attempt = 0; attempt < 80; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      result = await overlay.webContents.executeJavaScript(`({
        text: document.body.textContent || '',
        imageCount: document.querySelectorAll('.overlay-advice img').length
      })`) as { text: string; imageCount: number };
      if (result.text.includes('Culling Blade') && result.text.includes('Blink Dagger')) break;
    }
    fs.writeFileSync(outputFile, JSON.stringify(result));
    app.exit(result.text.includes('GUIA AO VIVO · Offlane')
      && result.text.includes('Culling Blade') && result.text.includes('Blink Dagger') ? 0 : 2);
  } catch (error) {
    fs.writeFileSync(outputFile, JSON.stringify({ error: String(error) }));
    app.exit(3);
  }
}

async function runOverlayDisabledAdviceSmoke(outputFile: string): Promise<void> {
  try {
    if (!overlay) throw new Error('Overlay de teste não foi criado.');
    snapshot = demoSnapshot();
    status.demoEnabled = true;
    notify();
    await new Promise(resolve => setTimeout(resolve, 700));
    const result = await overlay.webContents.executeJavaScript(`({
      text: document.body.textContent || '',
      catalogResources: performance.getEntriesByType('resource').map(entry => entry.name)
        .filter(name => /abilities-|items-|heroes-|extras-/.test(name)),
      adviceResources: performance.getEntriesByType('resource').map(entry => entry.name)
        .filter(name => name.includes('/api/opendota/')),
      backgrounds: [getComputedStyle(document.documentElement).backgroundColor,
        getComputedStyle(document.body).backgroundColor,
        getComputedStyle(document.getElementById('root')).backgroundColor],
      screenRect: (() => { const r=document.querySelector('.overlay-screen').getBoundingClientRect(); return {width:r.width,height:r.height}; })()
    })`) as { text: string; catalogResources: string[]; adviceResources: string[]; backgrounds: string[]; screenRect: { width: number; height: number } };
    const remoteRequestsBeforeUi = overlayAdviceRemoteRequests;
    const settingsAria = await dashboard?.webContents.executeJavaScript(`(async()=>{
      [...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Configurações'))?.click();
      await new Promise(resolve=>setTimeout(resolve,50));
      const read = () => ({
        skill: document.querySelector('button[aria-label="Alternar Próxima skill"]')?.getAttribute('aria-pressed'),
        items: document.querySelector('button[aria-label="Alternar Itens"]')?.getAttribute('aria-pressed'),
        lock: document.querySelector('button[aria-label="Bloquear posição e tamanho"]')?.getAttribute('aria-pressed')
      });
      const initial = read();
      document.querySelector('button[aria-label="Bloquear posição e tamanho"]')?.click();
      for(let i=0;i<20 && read().lock!=='true';i++) await new Promise(resolve=>setTimeout(resolve,20));
      const afterLock = { aria: read(), preferences: await window.dotaOverlay.getPreferences() };
      [...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Restaurar padrão'))?.click();
      for(let i=0;i<20 && (read().lock!=='false'||read().skill!=='true');i++) await new Promise(resolve=>setTimeout(resolve,20));
      const afterReset = { aria: read(), preferences: await window.dotaOverlay.getPreferences() };
      [...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Visão geral'))?.click();
      await new Promise(resolve=>setTimeout(resolve,30));
      const general = {
        overlay: document.querySelector('button[aria-label="Alternar overlay"]')?.getAttribute('aria-pressed'),
        demo: document.querySelector('button[aria-label="Alternar demonstração"]')?.getAttribute('aria-pressed')
      };
      return { initial, afterLock, afterReset, general };
    })()`);
    const transparent = result.backgrounds.every(value => value === 'rgba(0, 0, 0, 0)');
    const ariaValid = settingsAria?.initial.skill === 'false' && settingsAria.initial.items === 'false' &&
      settingsAria.initial.lock === 'false' && settingsAria.afterLock.aria.lock === 'true' &&
      settingsAria.afterLock.preferences.overlayLayout.locked === true &&
      settingsAria.afterReset.aria.lock === 'false' && settingsAria.afterReset.aria.skill === 'true' &&
      settingsAria.afterReset.preferences.overlayLayout.scale === 1 &&
      settingsAria.general.overlay === 'true' && settingsAria.general.demo === 'true';
    fs.writeFileSync(outputFile, JSON.stringify({ ...result, settingsAria, remoteRequests: remoteRequestsBeforeUi }));
    app.exit(remoteRequestsBeforeUi === 0 && result.catalogResources.length === 0 && result.adviceResources.length === 0 &&
      transparent && ariaValid && !result.text.includes('GUIA AO VIVO') ? 0 : 2);
  } catch (error) {
    fs.writeFileSync(outputFile, JSON.stringify({ error: String(error) }));
    app.exit(3);
  }
}

function setOverlayVisibility(visible: boolean): void {
  status.overlayVisible = visible;
  if (!visible) overlayController?.setEditing(false);
  if (overlay && !overlay.isDestroyed()) {
    if (visible) {
      if (status.overlayEditing) overlay.show(); else overlay.showInactive();
    } else overlay.hide();
  }
  notify();
}

function forceOverlaySafeAfterRendererExit(): void {
  status.overlayVisible = false;
  overlayController?.setEditing(false);
  if (overlay && !overlay.isDestroyed()) overlay.hide();
  notify();
}

function loadReact(win: BrowserWindow, mode: 'dashboard' | 'overlay'): void {
  win.webContents.on('preload-error', (_event, file, err) => {
    console.error(`[${mode}] Erro no preload ${file}:`, err);
    if (mode === 'overlay') forceOverlaySafeAfterRendererExit();
  });
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[${mode}] Falha ao carregar ${url}: ${code} ${description}`);
    if (mode === 'overlay') forceOverlaySafeAfterRendererExit();
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[${mode}] Processo de interface encerrado:`, details);
    if (mode === 'overlay') forceOverlaySafeAfterRendererExit();
  });
  win.webContents.on('did-finish-load', () => {
    void win.webContents.executeJavaScript('Boolean(window.dotaOverlay)')
      .then(present => console.log(`[${mode}] Ponte Electron: ${present ? 'OK' : 'AUSENTE'}`))
      .catch(err => console.error(`[${mode}] Erro ao conferir ponte:`, err));
    if (mode === 'dashboard' && process.env.DOTA_OVERLAY_DEBUG === '1') {
      win.webContents.openDevTools({ mode: 'detach' });
    }
    if (mode === 'dashboard' && librarySmokeOutput)
      void runLibrarySmoke(win, librarySmokeOutput);
    if (mode === 'overlay' && overlayAdviceSmokeOutput)
      void runOverlayAdviceSmoke(overlayAdviceSmokeOutput);
    if (mode === 'overlay' && overlayDisabledAdviceSmokeOutput)
      void runOverlayDisabledAdviceSmoke(overlayDisabledAdviceSmokeOutput);
  });
  const target = resolveRendererTarget(
    mode,
    app.isPackaged ? [] : process.argv,
    path.resolve(__dirname, '../../dist/index.html'),
  );
  if (target.type === 'url') void win.loadURL(target.value);
  else void win.loadFile(target.value, { query: target.query });
}
function createDashboard(): void {
  dashboard = new BrowserWindow({
    width: 1500, height: 900, minWidth: 980, minHeight: 680,
    backgroundColor: '#10121e', title: 'DotaIACoach', autoHideMenuBar: true,
    show: !smokeMode,
    webPreferences: { preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  lockDownNavigation(dashboard);
  loadReact(dashboard, 'dashboard');
  dashboard.on('closed', () => { dashboard = null; app.quit(); });
}
function createOverlay(): void {
  const { workArea } = screen.getPrimaryDisplay();
  const initial = resolveOverlayBounds(preferencesStore?.get().overlayLayout ?? defaultPreferences().overlayLayout, workArea).bounds;
  overlay = new BrowserWindow({
    ...initial, resizable: false, show: !smokeMode, frame: false,
    transparent: true, backgroundColor: '#00000000', alwaysOnTop: true,
    skipTaskbar: true, focusable: false, hasShadow: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  overlay.setAlwaysOnTop(true, 'floating');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  if (!preferencesStore) throw new Error('Preferências ainda não foram inicializadas.');
  overlayController = createOverlayWindowController({
    window: overlay,
    screen,
    store: preferencesStore,
    isVisibleDesired: () => status.overlayVisible,
    onPreferencesChanged: preferences => send('preferences:changed', preferences),
    onEditingChanged: editing => { status.overlayEditing = editing; },
    onEffectiveScaleChanged: scale => {
      if (status.overlayEffectiveScale === scale) return;
      status.overlayEffectiveScale = scale;
      send('status:changed', { ...status });
    },
  });
  overlayController.apply();
  overlayController.setEditing(false);
  lockDownNavigation(overlay);
  loadReact(overlay, 'overlay');
  overlay.on('close', () => {
    status.overlayVisible = false;
    overlayController?.setEditing(false);
    status.overlayEditing = false;
  });
  overlay.on('closed', () => {
    overlayController?.dispose(); overlayController = null; overlay = null;
    status.overlayVisible = false; status.overlayEditing = false; notify();
  });
}

function runOverlayLayoutSmoke(outputFile: string, stage: string): void {
  if (!overlay || !overlayController || !preferencesStore) throw new Error('Overlay não inicializado para smoke.');
  if (stage === 'write') {
    const area = screen.getPrimaryDisplay().workArea;
    preferencesStore.updateOverlayLayout({
      x: area.x + 60, y: area.y + 70, scale: 1.2, opacity: .66,
      modules: { stats: false, skill: true, items: false, alerts: true },
    });
    overlayController.apply();
  }
  overlayController.setEditing(true);
  const resizeBefore = overlay.getBounds();
  if (stage === 'write') overlayController.resize(1.25);
  const editingState = {
    focusable: overlay.isFocusable(), nativeResizable: overlay.isResizable(),
    resizeBefore, resizeAfter: overlay.getBounds(), preferenceScale: preferencesStore.get().overlayLayout.scale,
  };
  setOverlayVisibility(false);
  const hiddenDuringEdit = {
    visible: overlay.isVisible(), focusable: overlay.isFocusable(), editing: status.overlayEditing,
  };
  setOverlayVisibility(true);
  overlayController.setEditing(true);
  forceOverlaySafeAfterRendererExit();
  const rendererExitState = {
    visible: overlay.isVisible(), focusable: overlay.isFocusable(), editing: status.overlayEditing,
  };
  const emitter = overlay.webContents as unknown as { emit(name: string, ...args: unknown[]): boolean };
  setOverlayVisibility(true);
  overlayController.setEditing(true);
  emitter.emit('did-fail-load', {}, -2, 'smoke failure', 'file://overlay-smoke', true, 0, 0);
  const failedLoadState = { visible: overlay.isVisible(), focusable: overlay.isFocusable(), editing: status.overlayEditing };
  setOverlayVisibility(true);
  overlayController.setEditing(true);
  emitter.emit('preload-error', {}, 'preload-smoke.js', new Error('smoke preload failure'));
  const preloadErrorState = { visible: overlay.isVisible(), focusable: overlay.isFocusable(), editing: status.overlayEditing };
  setOverlayVisibility(true);
  overlayController.setEditing(false);
  preferencesStore.flush();
  fs.writeFileSync(outputFile, JSON.stringify({
    stage,
    preferences: preferencesStore.get(),
    bounds: overlay.getBounds(),
    opacity: overlay.getOpacity(),
    editingState,
    hiddenDuringEdit,
    rendererExitState,
    failedLoadState,
    preloadErrorState,
    completedState: { focusable: overlay.isFocusable(), resizable: overlay.isResizable() },
  }), 'utf8');
  setImmediate(() => app.quit());
}

async function runNotificationSmoke(outputFile: string): Promise<void> {
  try {
    if (!dashboard || !overlay || !notificationCenter) throw new Error('Janelas de teste não foram criadas.');
    const waitForLoad = (win: BrowserWindow): Promise<void> => win.webContents.isLoading()
      ? new Promise(resolve => win.webContents.once('did-finish-load', () => resolve())) : Promise.resolve();
    await Promise.all([waitForLoad(dashboard), waitForLoad(overlay)]);
    const initial = await dashboard.webContents.executeJavaScript(`(async()=>{
      const menu=[...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Cronograma'));
      if(!menu) throw new Error('Menu Cronograma ausente.');
      menu.click();
      await new Promise(resolve=>setTimeout(resolve,100));
      const state=await window.dotaOverlay.getNotificationCenter();
      const preset=document.querySelector('select[aria-label="Preset de cronograma"]');
      if(!preset) throw new Error('Seletor de preset ausente.');
      const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;
      setter.call(preset,'turbo-7.41-community');
      preset.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,50));
      let confirmationAsked=false;
      const originalConfirm=window.confirm;
      window.confirm=()=>{confirmationAsked=true;return false;};
      [...document.querySelectorAll('button')].find(button=>button.textContent?.trim()==='Aplicar')?.click();
      await new Promise(resolve=>setTimeout(resolve,50));
      window.confirm=originalConfirm;
      const afterCanceledPreset=await window.dotaOverlay.getNotificationCenter();
      const inputSetter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      const title=document.querySelector('.notification-form input[maxlength="80"]');
      const tags=[...document.querySelectorAll('.notification-form label')]
        .find(label=>label.textContent?.includes('Tags'))?.querySelector('input');
      if(!title||!tags) throw new Error('Editor de regra incompleto.');
      inputSetter.call(title,'Rascunho preservado'); title.dispatchEvent(new Event('input',{bubbles:true}));
      inputSetter.call(tags,'duplicada, duplicada'); tags.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,30));
      [...document.querySelectorAll('button')].find(button=>button.textContent?.trim()==='Salvar regra')?.click();
      await new Promise(resolve=>setTimeout(resolve,80));
      const failedSavePreserved=title.value==='Rascunho preservado';
      return { menu: menu.textContent, initialRules: state.config.rules.length, confirmationAsked,
        canceledPresetPreserved: afterCanceledPreset.config.mode===state.config.mode && afterCanceledPreset.config.rules.length===state.config.rules.length,
        failedSavePreserved };
    })()`);
    notificationCenter.setSimulatedTime(360);
    notifyNotifications();
    let renderedOverlayText = '';
    for (let attempt = 0; attempt < 30; attempt++) {
      renderedOverlayText = await overlay.webContents.executeJavaScript('document.body.textContent || ""');
      if (renderedOverlayText.includes('Runa de poder')) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const simulated = notificationState();
    const banner = simulated.runtime.active[0];
    const dismissed = banner
      ? await dashboard.webContents.executeJavaScript(`window.dotaOverlay.dismissNotification(${JSON.stringify(banner.id)})`)
      : simulated;
    const restored = await dashboard.webContents.executeJavaScript('window.dotaOverlay.setSimulatedGameTime(null)');
    fs.writeFileSync(outputFile, JSON.stringify({ ...initial, simulated, renderedOverlayText, dismissed, restored }), 'utf8');
    const valid = initial.initialRules > 0 && initial.confirmationAsked && initial.canceledPresetPreserved && initial.failedSavePreserved && simulated.runtime.simulated === true &&
      simulated.runtime.active.some((item: { title: string }) => item.title === 'Runa de poder') &&
      renderedOverlayText.includes('Runa de poder') && dismissed.runtime.active.length === 0 && restored.runtime.simulated === false;
    app.exit(valid ? 0 : 2);
  } catch (error) {
    fs.writeFileSync(outputFile, JSON.stringify({ error: String(error) }));
    app.exit(3);
  }
}

async function runItemTimingSmoke(outputFile: string): Promise<void> {
  try {
    if (!dashboard || !overlay || !itemTracker) throw new Error('Janelas de teste não foram criadas.');
    const waitForLoad = (win: BrowserWindow): Promise<void> => win.webContents.isLoading()
      ? new Promise(resolve => win.webContents.once('did-finish-load', () => resolve())) : Promise.resolve();
    await Promise.all([waitForLoad(dashboard), waitForLoad(overlay)]);
    const panel = await dashboard.webContents.executeJavaScript(`(async()=>{
      await window.dotaOverlay.setPosition(3);
      await window.dotaOverlay.setDemo(true);
      const menu=[...document.querySelectorAll('button')].find(button=>button.textContent?.trim().endsWith('Itens'));
      if(!menu) throw new Error('Menu Itens ausente.');
      menu.click();
      for(let attempt=0;attempt<40&&!document.body.textContent.includes('Fixture autoral sintética');attempt++)
        await new Promise(resolve=>setTimeout(resolve,50));
      const state=await window.dotaOverlay.getItemTiming();
      return { text:document.body.textContent||'', state, menu:menu.textContent };
    })()`);
    let overlayText = '';
    for (let attempt = 0; attempt < 40; attempt++) {
      overlayText = await overlay.webContents.executeJavaScript('document.body.textContent || ""');
      if (overlayText.includes('PRIMEIRA OBSERVAÇÃO')) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const result = { ...panel, overlayText, remoteRequests: overlayAdviceRemoteRequests };
    fs.writeFileSync(outputFile, JSON.stringify(result), 'utf8');
    const valid = panel.text.includes('Timing de itens') && panel.text.includes('não compra') &&
      panel.text.includes('Fixture autoral sintética') && panel.state.validation === 'synthetic-demo' &&
      panel.state.observations.length === 3 && panel.state.comparisons.some((item: { benchmark: unknown }) => item.benchmark) &&
      overlayText.includes('PRIMEIRA OBSERVAÇÃO') && overlayAdviceRemoteRequests <= 3;
    app.exit(valid ? 0 : 2);
  } catch (error) {
    fs.writeFileSync(outputFile, JSON.stringify({ error: String(error) }));
    app.exit(3);
  }
}

async function runDraftSmoke(outputFile: string): Promise<void> {
  try {
    if (!dashboard || !draftStore) throw new Error('Painel de draft não inicializado.');
    if (dashboard.webContents.isLoading())
      await new Promise<void>(resolve => dashboard!.webContents.once('did-finish-load', () => resolve()));
    const panel = await dashboard.webContents.executeJavaScript(`(async()=>{
      const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
      const menu=[...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Draft Advisor'));
      if(!menu) throw new Error('Menu Draft Advisor ausente.');
      menu.click();
      for(let i=0;i<80;i++){
        const candidate=[...document.querySelectorAll('button')].find(button=>button.textContent?.trim()==='Carregar demo');
        if(candidate&&!candidate.disabled) break;
        await wait(50);
      }
      const demo=[...document.querySelectorAll('button')].find(button=>button.textContent?.trim()==='Carregar demo'&&!button.disabled);
      if(!demo) throw new Error('Botão de demo ausente.');
      demo.click();
      for(let i=0;i<100;i++){
        const enemy=document.querySelector('.draft-group.enemies .draft-chips')?.textContent||'';
        if(enemy&&!enemy.includes('Nenhum selecionado')&&(document.body.textContent||'').includes('Atualizado:')) break;
        await wait(50);
      }
      const beforeSave=document.body.textContent||'';
      const save=[...document.querySelectorAll('button')].find(button=>button.textContent?.trim()==='Salvar cenário');
      if(!save) throw new Error('Botão salvar ausente.');
      save.click();
      for(let i=0;i<40&&(await window.dotaOverlay.getDraftScenarios()).saved.length===0;i++) await wait(50);
      const persisted=await window.dotaOverlay.getDraftScenarios();
      const libraryUrl=await window.dotaOverlay.getLibraryUrl();
      await fetch(new URL('api/opendota/heroes/1/matchups',libraryUrl));
      const open=document.querySelector('.draft-recommendations button');
      if(!open) throw new Error('Link para biblioteca ausente.');
      open.click();
      await wait(100);
      return {beforeSave,persisted,iframe:document.querySelector('iframe')?.getAttribute('src')||''};
    })()`) as { beforeSave: string; persisted: { saved: DraftScenario[] }; iframe: string };
    let libraryText = '', libraryFrameUrl = '';
    for (let attempt = 0; attempt < 60; attempt++) {
      const frame = dashboard.webContents.mainFrame.frames.find(value => value.url.includes('?hero='));
      if (frame) {
        libraryFrameUrl = frame.url;
        libraryText = await frame.executeJavaScript('document.body?.textContent || ""') as string;
        if (libraryText.includes('Crystal Maiden')) break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const enemyMatchupRequests = smokeRemoteUrls.filter(url => url.includes('/heroes/1/matchups')).length;
    const result = { ...panel, libraryText, libraryFrameUrl, enemyMatchupRequests, remoteUrls: smokeRemoteUrls };
    fs.writeFileSync(outputFile, JSON.stringify(result), 'utf8');
    const valid = panel.beforeSave.includes('Recomendações explicadas') && panel.beforeSave.includes('Crystal Maiden') &&
      panel.beforeSave.includes('ESTATÍSTICA') && panel.beforeSave.includes('HEURÍSTICA') && panel.beforeSave.includes('Atualizado:') &&
      panel.beforeSave.includes('Sinergia estatística entre aliados: indisponível') && panel.persisted.saved.length === 1 &&
      panel.iframe.includes('hero=npc_dota_hero_crystal_maiden') && libraryFrameUrl.includes('hero=npc_dota_hero_crystal_maiden') &&
      libraryText.includes('Crystal Maiden') && enemyMatchupRequests === 1;
    app.exit(valid ? 0 : 2);
  } catch (error) {
    fs.writeFileSync(outputFile, JSON.stringify({ error: String(error) }), 'utf8');
    app.exit(3);
  }
}

function getOrCreateToken(): string {
  const file = path.join(app.getPath('userData'), 'gsi-token.txt');
  try {
    const stored = fs.readFileSync(file, 'utf8').trim();
    if (/^[a-f0-9]{48}$/.test(stored)) return stored;
  } catch { /* Token ainda não existe */ }
  const token = generateToken();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, token, { encoding: 'utf8', mode: 0o600, flag: 'w' });
  return token;
}
function assertDashboard(event: Electron.IpcMainInvokeEvent): void {
  if (!dashboard || dashboard.isDestroyed() || event.sender.id !== dashboard.webContents.id)
    throw new Error('Ação restrita ao painel de controle.');
}
function installHandlers(): void {
  ipcMain.handle('snapshot:get', () => snapshot);
  ipcMain.handle('items:get', () => itemTimingState());
  ipcMain.handle('draft:get', event => { assertDashboard(event); return draftState(); });
  ipcMain.handle('status:get', () => ({...status}));
  ipcMain.handle('preferences:get', () => preferencesStore?.get() ?? defaultPreferences());
  ipcMain.handle('profile:get', () => profileStore?.get());
  ipcMain.handle('profile:update', (event, patch: unknown) => { assertDashboard(event); if (!profileStore) throw new Error('Perfil local ainda não foi inicializado.'); return profileStore.update(patch); });
  ipcMain.handle('license:get', () => licenseStore?.get());
  ipcMain.handle('license:import', async event => { assertDashboard(event); if (!licenseStore || !dashboard) throw new Error('Licença local ainda não foi inicializada.'); const result = await dialog.showOpenDialog(dashboard, { title: 'Importar licença offline', properties: ['openFile'], filters: [{ name: 'Licença DotaIACoach', extensions: ['json'] }] }); if (result.canceled || !result.filePaths[0]) return licenseStore.get(); return licenseStore.importFile(result.filePaths[0]); });
  ipcMain.handle('gsi:diagnostics', () => gsiDiagnostics);
  ipcMain.handle('sessions:get', event => { assertDashboard(event); return matchSessions(); });
  ipcMain.handle('demo:set', (event, enabled: unknown) => {
    assertDashboard(event);
    if (typeof enabled !== 'boolean') throw new Error('Entrada inválida.');
    status.demoEnabled = enabled;
    snapshot = enabled ? demoSnapshot() : emptySnapshot();
    itemTracker?.reset();
    const itemUpdate = itemTracker?.accept(snapshot, preferencesStore?.get().position ?? 1);
    if (itemUpdate?.changed) notifyItemTiming();
    if (notificationCenter?.acceptGameTime(snapshot.gameTime, Date.now(), snapshot.matchId)) notifyNotifications();
    notify();
  });
  ipcMain.handle('overlay:visible', (event, visible: unknown) => {
    assertDashboard(event);
    if (typeof visible !== 'boolean') throw new Error('Entrada inválida.');
    setOverlayVisibility(visible);
  });
  ipcMain.handle('gsi:save-config', async event => {
    assertDashboard(event);
    const result = await dialog.showSaveDialog(dashboard!, {
      title: 'Salvar configuração GSI do Dota 2',
      defaultPath: path.join(os.homedir(), 'gamestate_integration_dota_open_overlay.cfg'),
      filters: [{ name: 'Dota 2 GSI', extensions: ['cfg'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, makeGsiConfig(authToken), { encoding: 'utf8', flag: 'w' });
    return { canceled: false, filePath: result.filePath };
  });
  ipcMain.handle('gsi:install-config', async event => {
    assertDashboard(event);
    refreshGsiInstallation();
    let location = dotaLocation;
    if (!location) {
      const selected = await dialog.showOpenDialog(dashboard!, {
        title: 'Selecione a pasta do Dota 2 ou uma biblioteca Steam',
        properties: ['openDirectory'],
        buttonLabel: 'Usar esta pasta',
      });
      if (selected.canceled || !selected.filePaths[0])
        return { canceled: true, installed: false, diagnostics: gsiDiagnostics };
      const dotaPath = resolveDotaPath(selected.filePaths[0]);
      if (!dotaPath) {
        gsiDiagnostics = { ...gsiDiagnostics, installation: { ...gsiDiagnostics.installation,
          error: 'A pasta escolhida não contém game/dota. Selecione “dota 2 beta” ou a biblioteca Steam correspondente.' } };
        notifyGsiDiagnostics();
        return { canceled: false, installed: false, diagnostics: gsiDiagnostics };
      }
      location = { dotaPath, source: 'Pasta selecionada pelo usuário' };
      refreshGsiInstallation(location);
    }
    const target = gsiDiagnostics.installation.configFilePath!;
    const confirmation = await dialog.showMessageBox(dashboard!, {
      type: 'question', title: 'Instalar integração do Dota 2',
      message: gsiDiagnostics.installation.configInstalled
        ? 'Atualizar a configuração GSI do DotaIACoach?'
        : 'Instalar a configuração GSI do DotaIACoach?',
      detail: `O aplicativo gravará somente este arquivo:\n${target}\n\nO Dota 2 precisa ser reiniciado se já estiver aberto.`,
      buttons: ['Cancelar', gsiDiagnostics.installation.configInstalled ? 'Atualizar' : 'Instalar'],
      defaultId: 1, cancelId: 0, noLink: true,
    });
    if (confirmation.response !== 1)
      return { canceled: true, installed: false, diagnostics: gsiDiagnostics };
    try {
      const installation = installGsiConfiguration(location, makeGsiConfig(authToken));
      gsiDiagnostics = { ...gsiDiagnostics, installation, lastProblem: null };
      notifyGsiDiagnostics();
      return { canceled: false, installed: true, diagnostics: gsiDiagnostics };
    } catch (error) {
      gsiDiagnostics = { ...gsiDiagnostics, installation: { ...gsiDiagnostics.installation,
        error: `Não foi possível instalar: ${error instanceof Error ? error.message : String(error)}` } };
      notifyGsiDiagnostics();
      return { canceled: false, installed: false, diagnostics: gsiDiagnostics };
    }
  });
  ipcMain.handle('dashboard:show', () => {
    if (dashboard && !dashboard.isDestroyed()) { dashboard.show(); dashboard.focus(); }
  });
  ipcMain.handle('library:url', () => libraryUrl);
  ipcMain.handle('preferences:set-position', (event, position: unknown) => {
    assertDashboard(event);
    const preferences = preferencesStore?.setPosition(position as Position);
    if (!preferences) throw new Error('Preferências ainda não foram inicializadas.');
    const itemUpdate = itemTracker?.accept(snapshot, preferences.position);
    if (itemUpdate?.changed) notifyItemTiming();
    send('preferences:changed', preferences);
    return preferences;
  });
  ipcMain.handle('preferences:update-overlay-layout', (event, patch: unknown) => {
    assertDashboard(event);
    if (!preferencesStore) throw new Error('Preferências ainda não foram inicializadas.');
    preferencesStore.updateOverlayLayout(patch as OverlayLayoutPatch);
    const preferences = overlayController?.apply() ?? preferencesStore.get();
    send('preferences:changed', preferences);
    return preferences;
  });
  ipcMain.handle('preferences:reset-overlay-layout', event => {
    assertDashboard(event);
    if (!preferencesStore) throw new Error('Preferências ainda não foram inicializadas.');
    preferencesStore.resetOverlayLayout();
    const preferences = overlayController?.apply() ?? preferencesStore.get();
    send('preferences:changed', preferences);
    return preferences;
  });
  ipcMain.handle('overlay:editing', (event, editing: unknown) => {
    if (typeof editing !== 'boolean') throw new Error('Entrada inválida.');
    const isDashboard = dashboard && !dashboard.isDestroyed() && event.sender.id === dashboard.webContents.id;
    const isOverlay = overlay && !overlay.isDestroyed() && event.sender.id === overlay.webContents.id;
    if (!isDashboard && !isOverlay) throw new Error('Ação restrita às janelas do aplicativo.');
    if (editing && !isDashboard) throw new Error('Somente o painel pode iniciar a edição.');
    if (!overlayController) throw new Error('Overlay ainda não foi inicializado.');
    if (editing) {
      status.overlayVisible = true;
      overlay?.show();
    }
    overlayController.setEditing(editing);
    notify();
    return { ...status };
  });
  ipcMain.handle('overlay:resize', (event, scale: unknown) => {
    const isOverlay = overlay && !overlay.isDestroyed() && event.sender.id === overlay.webContents.id;
    if (!isOverlay) throw new Error('Redimensionamento restrito ao overlay.');
    if (typeof scale !== 'number' || !Number.isFinite(scale)) throw new Error('Escala inválida.');
    if (!overlayController) throw new Error('Overlay ainda não foi inicializado.');
    return overlayController.resize(scale);
  });
  ipcMain.handle('notifications:get', () => notificationState());
  ipcMain.handle('notifications:upsert', (event, rule: unknown) => {
    assertDashboard(event);
    if (!notificationStore || !notificationCenter) throw new Error('Central ainda não foi inicializada.');
    const config = notificationStore.upsert(rule);
    notificationCenter.configurationChanged(config);
    notifyNotifications();
    return notificationState();
  });
  ipcMain.handle('notifications:delete', (event, id: unknown) => {
    assertDashboard(event);
    if (typeof id !== 'string' || !notificationStore || !notificationCenter) throw new Error('Regra inválida.');
    const config = notificationStore.remove(id);
    notificationCenter.configurationChanged(config);
    notifyNotifications();
    return notificationState();
  });
  ipcMain.handle('notifications:set-mode', (event, mode: unknown) => {
    assertDashboard(event);
    if (!notificationStore || !notificationCenter) throw new Error('Central ainda não foi inicializada.');
    const config = notificationStore.setMode(mode as NotificationMode);
    notificationCenter.configurationChanged(config);
    notifyNotifications();
    return notificationState();
  });
  ipcMain.handle('notifications:apply-preset', (event, id: unknown) => {
    assertDashboard(event);
    if (typeof id !== 'string' || !notificationStore || !notificationCenter) throw new Error('Preset inválido.');
    const config = notificationStore.applyPreset(id);
    notificationCenter.configurationChanged(config);
    notifyNotifications();
    return notificationState();
  });
  ipcMain.handle('notifications:import', async event => {
    assertDashboard(event);
    if (!notificationStore || !notificationCenter) throw new Error('Central ainda não foi inicializada.');
    const selected = await dialog.showOpenDialog(dashboard!, {
      title: 'Restaurar cronograma', properties: ['openFile'],
      filters: [{ name: 'Backup JSON', extensions: ['json'] }],
    });
    if (selected.canceled || !selected.filePaths[0]) return { canceled: true, state: notificationState() };
    const filePath = selected.filePaths[0];
    const size = fs.statSync(filePath).size;
    if (size > 1_000_000) throw new Error('O backup excede o limite de 1 MB.');
    const config = notificationStore.replace(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    notificationCenter.configurationChanged(config);
    notifyNotifications();
    return { canceled: false, filePath, state: notificationState() };
  });
  ipcMain.handle('notifications:export', async event => {
    assertDashboard(event);
    if (!notificationStore) throw new Error('Central ainda não foi inicializada.');
    const selected = await dialog.showSaveDialog(dashboard!, {
      title: 'Salvar backup do cronograma', defaultPath: path.join(app.getPath('documents'), 'dota-open-cronograma.json'),
      filters: [{ name: 'Backup JSON', extensions: ['json'] }],
    });
    if (selected.canceled || !selected.filePath) return { canceled: true, state: notificationState() };
    fs.writeFileSync(selected.filePath, JSON.stringify(notificationStore.get(), null, 2), { encoding: 'utf8', flag: 'w', mode: 0o600 });
    return { canceled: false, filePath: selected.filePath, state: notificationState() };
  });
  ipcMain.handle('notifications:simulate', (event, gameTime: unknown) => {
    assertDashboard(event);
    if (gameTime !== null && (typeof gameTime !== 'number' || !Number.isInteger(gameTime) || gameTime < -300 || gameTime > 14_400))
      throw new Error('Relógio simulado inválido.');
    notificationCenter?.setSimulatedTime(gameTime as number | null);
    if (gameTime === null)
      notificationCenter?.acceptGameTime(snapshot.connected ? snapshot.gameTime : null, Date.now(), snapshot.matchId);
    notifyNotifications();
    return notificationState();
  });
  ipcMain.handle('notifications:dismiss', (event, id: unknown) => {
    const isDashboard = dashboard && !dashboard.isDestroyed() && event.sender.id === dashboard.webContents.id;
    const isOverlay = overlay && !overlay.isDestroyed() && event.sender.id === overlay.webContents.id;
    if ((!isDashboard && !isOverlay) || typeof id !== 'string') throw new Error('Ação inválida.');
    notificationCenter?.dismiss(id);
    notifyNotifications();
    return notificationState();
  });
  ipcMain.handle('notifications:preview-sound', event => { assertDashboard(event); shell.beep(); });
  ipcMain.handle('draft:update', (event, value: unknown) => {
    assertDashboard(event);
    if (!draftStore) throw new Error('Draft Advisor ainda não foi inicializado.');
    const state = draftStore.setCurrent(value);
    notifyDraft();
    return state;
  });
  ipcMain.handle('draft:save', (event, value: unknown) => {
    assertDashboard(event);
    if (!draftStore) throw new Error('Draft Advisor ainda não foi inicializado.');
    const state = draftStore.save(value);
    notifyDraft();
    return state;
  });
  ipcMain.handle('draft:delete', (event, id: unknown) => {
    assertDashboard(event);
    if (typeof id !== 'string' || !draftStore) throw new Error('Cenário inválido.');
    const state = draftStore.remove(id);
    notifyDraft();
    return state;
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (dashboard) { dashboard.show(); dashboard.focus(); } });
  app.whenReady().then(async () => {
    authToken = getOrCreateToken();
    preferencesStore = createPreferencesStore(path.join(app.getPath('userData'), 'preferences.json'));
    profileStore = createProfileStore(path.join(app.getPath('userData'), 'profile.json'));
    licenseStore = createLicenseStore(path.join(app.getPath('userData'), 'license.json'));
    if (overlayDisabledAdviceSmokeOutput)
      preferencesStore.updateOverlayLayout({ modules: { skill: false, items: false } });
    const sessionHistory = createSessionHistoryStore(path.join(app.getPath('userData'), 'match-sessions.json'));
    sessionRecorder = createMatchSessionRecorder(sessionHistory, () => preferencesStore?.get().position ?? 1);
    notificationStore = createNotificationStore(path.join(app.getPath('userData'), 'notification-rules.json'));
    notificationCenter = createNotificationCenter({
      store: notificationStore,
      getPosition: () => preferencesStore?.get().position ?? 1,
      getAlertsEnabled: () => preferencesStore?.get().overlayLayout.modules.alerts ?? false,
      onSound: () => shell.beep(),
    });
    itemTracker = createItemTracker();
    itemTracker.accept(snapshot, preferencesStore.get().position);
    draftStore = createDraftStore(path.join(app.getPath('userData'), 'draft-scenarios.json'));
    refreshGsiInstallation();
    installHandlers();
    try {
      await startLibraryServer();
    } catch (error) {
      status.error = `Biblioteca local não iniciada: ${error instanceof Error ? error.message : String(error)}`;
    }
    createDashboard();
    if (librarySmokeOutput) return;
    createOverlay();
    if (overlayAdviceSmokeOutput) return;
    if (overlayDisabledAdviceSmokeOutput) return;
    if (overlayLayoutSmokeOutput) { runOverlayLayoutSmoke(overlayLayoutSmokeOutput, overlayLayoutSmokeStage); return; }
    if (notificationSmokeOutput) { void runNotificationSmoke(notificationSmokeOutput); return; }
    if (itemTimingSmokeOutput) { void runItemTimingSmoke(itemTimingSmokeOutput); return; }
    if (draftSmokeOutput) { void runDraftSmoke(draftSmokeOutput); return; }
    const shortcutRegistered = globalShortcut.register('Control+Shift+F9', () => {
      setOverlayVisibility(!status.overlayVisible);
    });
    if (!shortcutRegistered) status.error = 'Atalho Ctrl+Shift+F9 indisponível (ocupado por outro programa).';
    try {
      gsiServer = await startGsiServer(authToken, updateSnapshot, event => {
        if (event.type === 'accepted') gsiDiagnostics = { ...gsiDiagnostics,
          packetsReceived: gsiDiagnostics.packetsReceived + 1, lastPacketAt: event.at, lastProblem: null };
        else gsiDiagnostics = { ...gsiDiagnostics,
          rejectedRequests: gsiDiagnostics.rejectedRequests + 1, lastProblem: event.problem ?? 'Pacote rejeitado.' };
        notifyGsiDiagnostics();
      });
      status.gsiListening = true;
    } catch (error) {
      status.error = `Servidor GSI não iniciado: ${error instanceof Error ? error.message : String(error)}`;
    }
    notify();
    setInterval(() => {
      if (snapshot.source === 'gsi' && snapshot.receivedAt && Date.now() - snapshot.receivedAt > 15000 && snapshot.connected) {
        snapshot = { ...snapshot, connected: false };
        if (notificationCenter?.acceptGameTime(null, Date.now(), snapshot.matchId, true)) notifyNotifications();
        notify();
      }
      if (notificationCenter?.expire()) notifyNotifications();
    }, 3000).unref();
  }).catch(error => { dialog.showErrorBox('Erro ao iniciar', String(error)); app.quit(); });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll(); gsiServer?.close(); libraryServer?.close();
    overlayController?.dispose(); preferencesStore?.dispose();
  });
  app.on('activate', () => { if (!dashboard) createDashboard(); });
}
