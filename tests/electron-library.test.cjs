const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test('biblioteca incorporada continua visível ao trocar de herói para itens', { timeout: 20_000 }, async () => {
  const project = path.resolve(__dirname, '..');
  const output = path.join(os.tmpdir(), `dota-library-smoke-${process.pid}-${Date.now()}.json`);
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [
    '.',
    `--library-smoke-output=${output}`,
  ], {
    cwd: project,
    env: environment,
    stdio: 'ignore',
    windowsHide: true,
  });

  try {
    for (let attempt = 0; attempt < 150 && !fs.existsSync(output); attempt++) await wait(100);
    assert.ok(fs.existsSync(output), 'Electron não concluiu a verificação da biblioteca.');
    const result = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(result.error, undefined);
    assert.match(result.activeTab, /Itens/);
    assert.ok(result.bodyTextLength > 0, 'A interface desapareceu após trocar a categoria.');
    assert.ok(result.itemCount > 0, 'A categoria não exibiu itens.');
    assert.equal(result.detailTitle, 'Blink Dagger');
    assert.ok(result.onlineRequests.some(value => value.endsWith('/itemPopularity')),
      'Selecionar um herói deve pré-carregar os itens populares.');
    assert.ok(result.onlineRequests.some(value => value.endsWith('/matchups')),
      'Selecionar um herói deve pré-carregar os confrontos.');
    assert.ok(result.onlineRequests.some(value => value.includes('/recommendations?position=')),
      'Selecionar um herói deve pré-carregar skills e builds recomendadas.');
  } finally {
    if (!child.killed) child.kill();
    if (fs.existsSync(output)) fs.rmSync(output);
  }
});
