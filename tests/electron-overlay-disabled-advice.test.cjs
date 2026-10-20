const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test('overlay sem módulos de skill e itens não carrega catálogos nem consulta recomendações', { timeout: 20_000 }, async () => {
  const project = path.resolve(__dirname, '..');
  const output = path.join(os.tmpdir(), `dota-overlay-disabled-advice-${process.pid}-${Date.now()}.json`);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-overlay-disabled-profile-'));
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [
    '.', `--user-data-dir=${profile}`, `--overlay-disabled-advice-smoke-output=${output}`,
  ], { cwd: project, env: environment, stdio: 'ignore', windowsHide: true });
  try {
    for (let attempt = 0; attempt < 180 && !fs.existsSync(output); attempt++) await wait(100);
    assert.ok(fs.existsSync(output), 'Electron não concluiu o smoke de módulos ocultos.');
    const result = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(result.error, undefined);
    assert.equal(result.remoteRequests, 0);
    assert.deepEqual(result.catalogResources, []);
    assert.deepEqual(result.adviceResources, []);
    assert.doesNotMatch(result.text, /GUIA AO VIVO/);
    assert.deepEqual(result.settingsAria.initial, { skill: 'false', items: 'false', lock: 'false' });
    assert.equal(result.settingsAria.afterLock.aria.lock, 'true');
    assert.equal(result.settingsAria.afterLock.preferences.overlayLayout.locked, true);
    assert.equal(result.settingsAria.afterReset.aria.lock, 'false');
    assert.equal(result.settingsAria.afterReset.aria.skill, 'true');
    assert.equal(result.settingsAria.afterReset.preferences.overlayLayout.scale, 1);
    assert.deepEqual(result.settingsAria.general, { overlay: 'true', demo: 'true' });
    assert.deepEqual(result.backgrounds, ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
    assert.ok(result.screenRect.width > 0 && result.screenRect.height > 0);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([new Promise(resolve => child.once('close', resolve)), wait(2_000)]);
    }
    if (fs.existsSync(output)) fs.rmSync(output);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
