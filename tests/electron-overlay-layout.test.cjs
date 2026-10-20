const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function runStage(project, profile, stage) {
  const output = path.join(os.tmpdir(), `dota-overlay-layout-${stage}-${process.pid}-${Date.now()}.json`);
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [
    '.', `--user-data-dir=${profile}`, `--overlay-layout-smoke-stage=${stage}`, `--overlay-layout-smoke-output=${output}`,
  ], { cwd: project, env: environment, stdio: 'ignore', windowsHide: true });
  try {
    for (let attempt = 0; attempt < 180 && !fs.existsSync(output); attempt++) await wait(100);
    assert.ok(fs.existsSync(output), `Electron não concluiu o smoke de layout (${stage}).`);
    return JSON.parse(fs.readFileSync(output, 'utf8'));
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([new Promise(resolve => child.once('close', resolve)), wait(2_000)]);
    }
    if (fs.existsSync(output)) fs.rmSync(output);
  }
}

test('Electron aplica layout, conclui edição click-through e recupera após reinício', { timeout: 35_000 }, async () => {
  const project = path.resolve(__dirname, '..');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-overlay-layout-profile-'));
  try {
    const written = await runStage(project, profile, 'write');
    assert.equal(written.preferences.overlayLayout.scale, 1.25);
    assert.equal(written.preferences.overlayLayout.opacity, .66);
    assert.deepEqual(written.preferences.overlayLayout.modules, { stats: false, skill: true, items: false, alerts: true });
    assert.equal(written.editingState.focusable, true);
    assert.equal(written.editingState.nativeResizable, false);
    assert.equal(written.editingState.preferenceScale, 1.25);
    assert.ok(written.editingState.resizeAfter.width > written.editingState.resizeBefore.width);
    assert.ok(written.editingState.resizeAfter.height > written.editingState.resizeBefore.height);
    assert.deepEqual(written.hiddenDuringEdit, { visible: false, focusable: false, editing: false });
    assert.deepEqual(written.rendererExitState, { visible: false, focusable: false, editing: false });
    assert.deepEqual(written.failedLoadState, { visible: false, focusable: false, editing: false });
    assert.deepEqual(written.preloadErrorState, { visible: false, focusable: false, editing: false });
    assert.deepEqual(written.completedState, { focusable: false, resizable: false });
    assert.equal(written.bounds.width, 538);
    assert.equal(written.bounds.height, 393);
    assert.ok(Math.abs(written.opacity - .66) < .02);

    const restored = await runStage(project, profile, 'read');
    assert.equal(restored.preferences.overlayLayout.scale, 1.25);
    assert.equal(restored.preferences.overlayLayout.opacity, .66);
    assert.deepEqual(restored.bounds, written.bounds);
    assert.deepEqual(restored.completedState, { focusable: false, resizable: false });
  } finally { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
