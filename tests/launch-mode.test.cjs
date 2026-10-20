const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

test('start usa o build local e dev opta explicitamente pelo Vite', () => {
  const pkg = require('../package.json');
  assert.match(pkg.scripts['dev:launch'], /electron \. --dev-server$/);

  const { resolveRendererTarget } = require('../dist-electron/electron/renderer-target.js');
  const distIndex = path.resolve('dist/index.html');

  assert.deepEqual(resolveRendererTarget('dashboard', [], distIndex), {
    type: 'file',
    value: distIndex,
    query: { mode: 'dashboard' },
  });
  assert.deepEqual(resolveRendererTarget('overlay', ['electron', '.', '--dev-server'], distIndex), {
    type: 'url',
    value: 'http://127.0.0.1:5173/?mode=overlay',
  });
});
