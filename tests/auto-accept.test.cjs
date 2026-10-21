const test = require('node:test');
const assert = require('node:assert/strict');

test('auto-accept seguro exige confirmação manual e nunca executa ação', () => {
  const { createAutoAcceptController } = require('../dist-electron/src/core/auto-accept.js');
  const controller = createAutoAcceptController({ enabled: true, cooldownSeconds: 30 }, 1000);
  assert.equal(controller.arm(), 'armed');
  assert.equal(controller.detect(2000), 'detected');
  assert.equal(controller.confirmManually(3000), 'manual-required');
  assert.equal(controller.getState().actionsTaken, 0);
  assert.equal(controller.detect(4000), 'cooldown');
});

test('pânico desarma e limpa detecção', () => {
  const { createAutoAcceptController } = require('../dist-electron/src/core/auto-accept.js');
  const controller = createAutoAcceptController({ enabled: true, cooldownSeconds: 10 });
  controller.detect();
  assert.equal(controller.panic(), 'panic');
  assert.equal(controller.getState().state, 'disabled');
  assert.equal(controller.getState().detectedAt, null);
});
