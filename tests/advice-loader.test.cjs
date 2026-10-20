const assert = require('node:assert/strict');
const { test } = require('node:test');

test('guia mantém dados úteis quando apenas uma rota OpenDota falha', async () => {
  const { loadAdviceRemoteData } = require('../dist-electron/src/core/advice-loader.js');
  const previous = { recommendations: [{ position: 3 }], popularity: [{ id: 1 }] };
  const result = await loadAdviceRemoteData({
    previous,
    loadRecommendations: async () => [{ position: 3, fresh: true }],
    loadPopularity: async () => { throw new Error('OpenDota timeout'); },
  });
  assert.deepEqual(result.recommendations, [{ position: 3, fresh: true }]);
  assert.deepEqual(result.popularity, previous.popularity);
  assert.match(result.warning, /OpenDota indisponível.*itens/i);
});

test('guia conserva último payload completo durante falha transitória', async () => {
  const { loadAdviceRemoteData } = require('../dist-electron/src/core/advice-loader.js');
  const previous = { recommendations: [{ position: 5 }], popularity: [{ id: 2 }] };
  const result = await loadAdviceRemoteData({
    previous,
    loadRecommendations: async () => { throw new Error('timeout'); },
    loadPopularity: async () => { throw new Error('timeout'); },
  });
  assert.deepEqual(result.recommendations, previous.recommendations);
  assert.deepEqual(result.popularity, previous.popularity);
  assert.match(result.warning, /OpenDota indisponível/i);
});

test('renderer nunca aceita payload de outro herói ou posição', () => {
  const { selectCurrentAdvicePayload } = require('../dist-electron/src/core/advice-loader.js');
  const payload = { requestKey: 'npc_dota_hero_axe:3', marker: 'axe-offlane' };
  assert.equal(selectCurrentAdvicePayload('npc_dota_hero_axe:3', payload), payload);
  assert.equal(selectCurrentAdvicePayload('npc_dota_hero_axe:4', payload), null);
  assert.equal(selectCurrentAdvicePayload('npc_dota_hero_lina:3', payload), null);
});
