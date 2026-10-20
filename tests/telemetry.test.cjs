const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('telemetria local fica desligada por padrão e não registra sem opt-in', () => {
  const { createTelemetryStore } = require('../dist-electron/electron/telemetry-store.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-iacoach-telemetry-'));
  const file = path.join(dir, 'telemetry.json');
  try {
    const store = createTelemetryStore(file);
    store.record('should.not.persist', { value: 1 });
    assert.equal(store.get().enabled, false);
    assert.equal(store.get().events.length, 0);
    store.setEnabled(true);
    store.record('match.started', { hero: 'npc_dota_hero_axe' });
    assert.equal(store.get().events.length, 1);
    assert.equal(createTelemetryStore(file).get().events[0].name, 'match.started');
    store.clear();
    assert.equal(store.get().events.length, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
