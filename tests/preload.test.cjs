const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

test('preload expõe ponte tipada sem exigir exports no sandbox', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  assert.doesNotMatch(compiled, /Object\.defineProperty\(exports/);
  const exposed = {};
  const listeners = new Map();
  const contextBridge = { exposeInMainWorld: (key, value) => { exposed[key] = value; } };
  const ipcRenderer = {
    invoke: (channel, ...args) => Promise.resolve({ channel, args }),
    on: (channel, fn) => { listeners.set(channel, fn); },
    removeListener: (channel, fn) => { if (listeners.get(channel) === fn) listeners.delete(channel); }
  };
  vm.runInNewContext(compiled, {
    require: name => {
      assert.equal(name, 'electron');
      return { contextBridge, ipcRenderer };
    }
  }, { timeout: 1000 });
  const api = exposed.dotaOverlay;
  assert.ok(api, 'ponte não foi exposta');
  assert.deepEqual((await api.getStatus()).channel, 'status:get');
  assert.deepEqual((await api.getLibraryUrl()).channel, 'library:url');
  assert.deepEqual((await api.getPreferences()).channel, 'preferences:get');
  assert.deepEqual((await api.getGsiDiagnostics()).channel, 'gsi:diagnostics');
  assert.deepEqual((await api.getMatchSessions()).channel, 'sessions:get');
  assert.deepEqual((await api.getItemTiming()).channel, 'items:get');
  assert.deepEqual((await api.getDraftScenarios()).channel, 'draft:get');
  assert.deepEqual((await api.getTelemetry()).channel, 'telemetry:get');
  assert.deepEqual((await api.setTelemetryEnabled(true)).args, [true]);
  assert.deepEqual((await api.clearTelemetry()).channel, 'telemetry:clear');
  assert.deepEqual((await api.exportTelemetry()).channel, 'telemetry:export');
  assert.deepEqual((await api.setDemo(true)).args, [true]);
  assert.deepEqual((await api.setPosition(3)).args, [3]);
  assert.deepEqual((await api.updateOverlayLayout({opacity:.8})).args, [{opacity:.8}]);
  assert.deepEqual((await api.resetOverlayLayout()).channel, 'preferences:reset-overlay-layout');
  assert.deepEqual((await api.setOverlayEditing(true)).args, [true]);
  assert.deepEqual((await api.resizeOverlay(1.2)).args, [1.2]);
  assert.deepEqual((await api.getNotificationCenter()).channel, 'notifications:get');
  assert.deepEqual((await api.upsertNotificationRule({id:'x'})).args, [{id:'x'}]);
  assert.deepEqual((await api.deleteNotificationRule('x')).args, ['x']);
  assert.deepEqual((await api.setNotificationMode('turbo')).args, ['turbo']);
  assert.deepEqual((await api.applyNotificationPreset('test')).args, ['test']);
  assert.deepEqual((await api.importNotifications()).channel, 'notifications:import');
  assert.deepEqual((await api.exportNotifications()).channel, 'notifications:export');
  assert.deepEqual((await api.setSimulatedGameTime(360)).args, [360]);
  assert.deepEqual((await api.dismissNotification('banner')).args, ['banner']);
  assert.deepEqual((await api.previewNotificationSound()).channel, 'notifications:preview-sound');
  assert.deepEqual((await api.updateDraftScenario({id:'x'})).args, [{id:'x'}]);
  assert.deepEqual((await api.saveDraftScenario({id:'x'})).args, [{id:'x'}]);
  assert.deepEqual((await api.deleteDraftScenario('x')).args, ['x']);
  assert.deepEqual((await api.installGsiConfig()).channel, 'gsi:install-config');
  let eventValue;
  const off = api.onSnapshot(v => { eventValue = v; });
  listeners.get('snapshot:changed')({}, {heroName:'Axe'});
  assert.equal(eventValue.heroName, 'Axe');
  off();
  assert.equal(listeners.has('snapshot:changed'), false);
  let preferences;
  const offPreferences = api.onPreferences(value => { preferences = value; });
  listeners.get('preferences:changed')({}, {position: 5});
  assert.equal(preferences.position, 5);
  offPreferences();
  assert.equal(listeners.has('preferences:changed'), false);
  let diagnostics;
  const offDiagnostics = api.onGsiDiagnostics(value => { diagnostics = value; });
  listeners.get('gsi:diagnostics-changed')({}, {packetsReceived: 4});
  assert.equal(diagnostics.packetsReceived, 4);
  offDiagnostics();
  assert.equal(listeners.has('gsi:diagnostics-changed'), false);
  let sessions;
  const offSessions = api.onMatchSessions(value => { sessions = value; });
  listeners.get('sessions:changed')({}, {active: null, recentChanged: false});
  assert.equal(sessions.active, null);
  assert.equal(sessions.recentChanged, false);
  offSessions();
  assert.equal(listeners.has('sessions:changed'), false);
  let itemTiming;
  const offItemTiming = api.onItemTiming(value => { itemTiming = value; });
  listeners.get('items:changed')({}, {observations:[]});
  assert.equal(itemTiming.observations.length, 0);
  offItemTiming();
  assert.equal(listeners.has('items:changed'), false);
  let drafts;
  const offDrafts = api.onDraftScenarios(value => { drafts = value; });
  listeners.get('draft:changed')({}, {saved:[]});
  assert.equal(drafts.saved.length, 0);
  offDrafts();
  assert.equal(listeners.has('draft:changed'), false);
  let notificationCenter;
  const offNotificationCenter = api.onNotificationCenter(value => { notificationCenter = value; });
  listeners.get('notifications:changed')({}, {runtime:{active:[]}});
  assert.equal(notificationCenter.runtime.active.length, 0);
  offNotificationCenter();
  assert.equal(listeners.has('notifications:changed'), false);
});
