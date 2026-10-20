const assert = require('node:assert/strict');
const { test } = require('node:test');

const { requestRecommendations } = require('../dota-library-pack/scripts/serve-library.cjs');

test('monta recomendações de partidas profissionais com skills antes dos itens', async () => {
  const calls = [];
  const remoteFetch = async url => {
    calls.push(String(url));
    if (String(url).includes('/explorer?sql=')) {
      return new Response(JSON.stringify({ rows: [
        {
          match_id: 101, account_id: 10, name: 'Jogador A', league_name: 'Liga A',
          hero_id: 2, player_slot: 0, item_0: 1, item_1: 50, item_2: 100,
          item_3: 0, item_4: 0, item_5: 0, start_time: 1_790_000_000,
          radiant_win: true, patch: '7.41', position: 1,
        },
        {
          match_id: 102, account_id: 11, name: 'Jogador B', league_name: 'Liga B',
          hero_id: 2, player_slot: 129, item_0: 1, item_1: 50, item_2: 101,
          item_3: 0, item_4: 0, item_5: 0, start_time: 1_789_000_000,
          radiant_win: true, patch: '7.41', position: 1,
        },
      ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const matchId = Number(String(url).match(/\/matches\/(\d+)/)?.[1]);
    const player = matchId === 101
      ? { hero_id: 2, player_slot: 0, ability_upgrades_arr: [201, 202, 201, 203] }
      : { hero_id: 2, player_slot: 129, ability_upgrades_arr: [201, 202, 201, 203] };
    return new Response(JSON.stringify({ players: [player] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await requestRecommendations(2, 1, remoteFetch);

  assert.equal(result.data.heroId, 2);
  assert.equal(result.data.position, 1);
  assert.equal(result.data.sampleSize, 2);
  assert.deepEqual(result.data.skillBuilds[0], {
    abilityIds: [201, 202, 201, 203], matches: 2, pickRate: 1,
  });
  assert.deepEqual(result.data.matches[0].itemIds, [1, 50, 100]);
  assert.equal(result.data.matches[0].playerName, 'Jogador A');
  assert.ok(calls.some(url => url.includes('/explorer?sql=')));
  assert.ok(calls.some(url => url.endsWith('/matches/101')));
  assert.ok(calls.some(url => url.endsWith('/matches/102')));
});
