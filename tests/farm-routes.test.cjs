const test = require('node:test');
const assert = require('node:assert/strict');

test('planejador de rota gera sequência explicável e rotulada', () => {
  const { planFarmRoute } = require('../dist-electron/src/core/farm-routes.js');
  const route = planFarmRoute(1, 'radiant', 120);
  assert.equal(route.steps.length, 3);
  assert.equal(route.steps[0].camp.confidence, 'authorial-v1');
  assert.ok(route.warnings.some(value => value.includes('coordenadas')));
  assert.equal(route.steps[0].arriveAt, 120);
});

test('rota vazia não inventa acampamentos', () => {
  const { planFarmRoute } = require('../dist-electron/src/core/farm-routes.js');
  const route = planFarmRoute(5, 'radiant', 0, []);
  assert.deepEqual(route.steps, []);
  assert.equal(route.estimatedDuration, 0);
});
