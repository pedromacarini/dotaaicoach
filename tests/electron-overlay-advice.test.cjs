const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test('modo demonstração leva skill e itens recomendados ao overlay', { timeout: 20_000 }, async () => {
  const project = path.resolve(__dirname, '..');
  const output = path.join(os.tmpdir(), `dota-overlay-advice-${process.pid}-${Date.now()}.json`);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-overlay-profile-'));
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [
    '.', `--user-data-dir=${profile}`, `--overlay-advice-smoke-output=${output}`,
  ], { cwd: project, env: environment, stdio: 'ignore', windowsHide: true });

  try {
    for (let attempt = 0; attempt < 180 && !fs.existsSync(output); attempt++) await wait(100);
    assert.ok(fs.existsSync(output), 'Electron não concluiu a verificação do guia no overlay.');
    const result = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(result.error, undefined);
    assert.match(result.text, /GUIA AO VIVO · Offlane/);
    assert.match(result.text, /Culling Blade/);
    assert.match(result.text, /Blink Dagger/);
    assert.ok(result.imageCount >= 2, 'Skill e itens devem ter imagens no overlay.');
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([
        new Promise(resolve => child.once('close', resolve)),
        wait(2_000),
      ]);
    }
    if (fs.existsSync(output)) fs.rmSync(output);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
