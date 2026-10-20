const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('preferência legada migra, preserva posição e rejeita valores inválidos', () => {
  const { createPreferencesStore } = require('../dist-electron/electron/preferences.js');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-open-preferences-'));
  const file = path.join(folder, 'preferences.json');
  try {
    fs.writeFileSync(file, JSON.stringify({ position: 3 }));
    const first = createPreferencesStore(file);
    assert.equal(first.get().schemaVersion, 2);
    assert.equal(first.get().position, 3);
    assert.equal(first.get().overlayLayout.scale, 1);
    assert.equal(first.setPosition(4).position, 4);
    assert.equal(createPreferencesStore(file).get().position, 4);
    assert.throws(() => first.setPosition(9), /Posição inválida/);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

test('migração recupera cada campo inválido sem apagar os válidos', () => {
  const { normalizePreferences } = require('../dist-electron/electron/preferences.js');
  const result = normalizePreferences({
    schemaVersion: 99,
    position: 5,
    overlayLayout: {
      x: 420, y: 'erro', scale: 9, opacity: .7, locked: true,
      modules: { stats: false, skill: 'erro', items: false, alerts: true },
    },
  });
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.position, 5);
  assert.equal(result.overlayLayout.x, 420);
  assert.equal(result.overlayLayout.y, null);
  assert.equal(result.overlayLayout.scale, 1);
  assert.equal(result.overlayLayout.opacity, .7);
  assert.equal(result.overlayLayout.locked, true);
  assert.deepEqual(result.overlayLayout.modules, { stats: false, skill: true, items: false, alerts: true });
});

test('atualização de layout valida, mescla módulos e persiste com debounce', async () => {
  const { createPreferencesStore } = require('../dist-electron/electron/preferences.js');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-open-layout-'));
  const file = path.join(folder, 'preferences.json');
  try {
    const store = createPreferencesStore(file, { debounceMs: 15 });
    const changed = store.updateOverlayLayout({ x: -120, y: 80, scale: 1.25, opacity: .6, modules: { items: false } });
    assert.equal(changed.overlayLayout.x, -120);
    assert.equal(changed.overlayLayout.modules.items, false);
    assert.equal(changed.overlayLayout.modules.skill, true);
    assert.throws(() => store.updateOverlayLayout({ opacity: 2 }), /Opacidade inválida/);
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(createPreferencesStore(file).get().overlayLayout.scale, 1.25);
    const reset = store.resetOverlayLayout();
    assert.equal(reset.position, 1);
    assert.equal(reset.overlayLayout.scale, 1);
    assert.deepEqual(reset.overlayLayout.modules, { stats: true, skill: true, items: true, alerts: true });
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
