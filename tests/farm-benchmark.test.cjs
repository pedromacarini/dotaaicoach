const assert = require('node:assert/strict');
const { test } = require('node:test');
const { evaluateFarm, selectFarmObservation, targetLastHits, EXPERIMENTAL_FARM_PROFILE } = require('../dist-electron/src/core/farm-benchmark.js');

test('perfil experimental é transparente e interpola a meta por posição', () => {
  assert.equal(EXPERIMENTAL_FARM_PROFILE[1][2][1], 67);
  assert.equal(targetLastHits(1, 10 * 60), 67);
  assert.equal(targetLastHits(1, 12.5 * 60), 88);
  assert.ok(targetLastHits(1, 20 * 60) > targetLastHits(3, 20 * 60));
  assert.ok(targetLastHits(3, 20 * 60) > targetLastHits(5, 20 * 60));
});

test('avaliação retorna meta, delta e classificação sem inventar LH ausente', () => {
  const ahead = evaluateFarm(1, 10 * 60, 80);
  assert.equal(ahead.targetLastHits, 67);
  assert.equal(ahead.delta, 13);
  assert.equal(ahead.classification, 'ahead');
  assert.equal(evaluateFarm(1, 10 * 60, 66).classification, 'on-track');
  assert.equal(evaluateFarm(1, 10 * 60, 40).classification, 'behind');
  const absent = evaluateFarm(1, 10 * 60, null);
  assert.equal(absent.actualLastHits, null);
  assert.equal(absent.delta, null);
  assert.equal(absent.classification, 'unavailable');
  assert.equal(evaluateFarm(1, null, 10), null);
});

test('pacote GSI atual com LH ausente não reutiliza valor de amostra antiga', () => {
  const oldSample = { gameTime: 590, lastHits: 62 };
  const current = selectFarmObservation({ source: 'gsi', gameTime: 600, lastHits: null }, oldSample);
  assert.deepEqual(current, { gameTime: 600, lastHits: null });
  assert.equal(evaluateFarm(1, current.gameTime, current.lastHits).classification, 'unavailable');

  const idle = selectFarmObservation({ source: 'idle', gameTime: null, lastHits: null }, oldSample);
  assert.deepEqual(idle, { gameTime: 590, lastHits: 62 });
  const demo = selectFarmObservation({ source: 'demo', gameTime: 982, lastHits: 112 }, oldSample);
  assert.deepEqual(demo, { gameTime: 982, lastHits: 112 });
});
