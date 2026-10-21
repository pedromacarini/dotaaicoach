const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('modo inicial de debug local coleta e permite pausar sem enviar dados', () => {
  const { createTelemetryStore } = require('../dist-electron/electron/telemetry-store.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-iacoach-telemetry-'));
  const file = path.join(dir, 'telemetry.json');
  try {
    const store = createTelemetryStore(file);
    store.record('debug.started', { value: 1 });
    assert.equal(store.get().enabled, true);
    assert.equal(store.get().events.length, 1);
    store.setEnabled(false);
    store.record('match.started', { hero: 'npc_dota_hero_axe' });
    assert.equal(store.get().events.length, 1);
    assert.equal(createTelemetryStore(file).get().events[0].name, 'debug.started');
    store.clear();
    assert.equal(store.get().events.length, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
