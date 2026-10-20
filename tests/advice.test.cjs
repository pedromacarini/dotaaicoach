const assert = require('node:assert/strict');
const { test } = require('node:test');

test('resolve herói GSI e recomenda a próxima skill antes dos itens da fase', () => {
  const { buildMatchAdvice } = require('../dist-electron/src/core/advice.js');
  const advice = buildMatchAdvice({
    heroInternalName: 'npc_dota_hero_axe', heroName: 'Axe', heroLevel: 2, gameTime: 720,
    position: 3, libraryUrl: 'http://127.0.0.1:3000/',
    heroes: [{ id: 2, internalName: 'npc_dota_hero_axe', name: 'Axe' }],
    abilities: [{ key: 'axe_counter_helix', name: 'Counter Helix' }],
    items: [{ id: 1, key: 'blink', name: 'Blink Dagger' }],
    abilityIds: { 101: 'axe_berserkers_call', 102: 'axe_battle_hunger', 103: 'axe_counter_helix' },
    itemIds: { 1: 'blink' },
    recommendations: { sampleSize: 12, skillBuilds: [{ abilityIds: [101, 102, 103], matches: 3 }] },
    popularity: { mid_game_items: { 1: 99 } },
  });

  assert.equal(advice.heroId, 2);
  assert.equal(advice.position, 3);
  assert.equal(advice.nextSkill.name, 'Counter Helix');
  assert.equal(advice.nextSkillLevel, 3);
  assert.equal(advice.itemPhase, 'Meio de jogo');
  assert.deepEqual(advice.items.map(item => item.name), ['Blink Dagger']);
});

test('não inventa recomendação para herói desconhecido', () => {
  const { buildMatchAdvice } = require('../dist-electron/src/core/advice.js');
  const result = buildMatchAdvice({
    heroInternalName: 'npc_dota_hero_unknown', heroName: 'Unknown', heroLevel: 1, gameTime: 1,
    position: 1, libraryUrl: 'http://127.0.0.1:3000/', heroes: [], abilities: [], items: [],
    abilityIds: {}, itemIds: {}, recommendations: {}, popularity: {},
  });
  assert.equal(result, null);
});
