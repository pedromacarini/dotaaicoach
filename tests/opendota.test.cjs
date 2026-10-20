const assert = require('node:assert/strict');
const { test } = require('node:test');

const catalogs = {
  patches: [{ id: 60, name: '7.41' }],
  items: [
    { id: 39, key: 'flask' },
    { id: 216, key: 'enchanted_mango' },
  ],
};

const lanes = [1, 1, 2, 3, 3];

const rawPlayer = (index) => {
  const radiant = index < 5;
  return {
    player_slot: radiant ? index : 128 + index - 5,
    isRadiant: radiant,
    hero_id: index + 1,
    last_hits: 200 - index * 10,
    net_worth: 18_000 - index * 500,
    win: radiant ? 1 : 0,
    lane_role: lanes[index % 5],
    is_roaming: index === 1,
    hero_variant: index % 2,
    rank_tier: 70 + index,
    purchase_log: index === 0
      ? [{ time: -15, key: 'flask' }, { time: 42, key: 'enchanted_mango' }]
      : [],
    ability_upgrades_arr: index === 0 ? [101, 102, 101] : [],
  };
};

const parsedMatch = () => ({
  match_id: 9_052_727_689,
  version: 22,
  patch: 60,
  start_time: 1_792_427_014,
  radiant_win: true,
  players: Array.from({ length: 10 }, (_, index) => rawPlayer(index)),
});

test('normaliza uma partida OpenDota analisada para o motor de builds', () => {
  const { normalizeOpenDotaMatch } = require('../dist-electron/src/core/opendota.js');

  const result = normalizeOpenDotaMatch(parsedMatch(), catalogs);

  assert.equal(result.status, 'accepted');
  assert.deepEqual(result.warnings, []);
  assert.equal(result.match.matchId, '9052727689');
  assert.equal(result.match.patch, '7.41');
  assert.equal(result.match.startedAt, 1_792_427_014);
  assert.equal(result.match.averageRankTier, 74.5);
  assert.equal(result.match.parsed, true);
  assert.equal(result.match.players.length, 10);
  assert.deepEqual(result.match.players[0], {
    heroId: 1,
    team: 'radiant',
    laneRole: 1,
    lastHits: 200,
    netWorth: 18_000,
    won: true,
    isRoaming: false,
    facetId: 0,
    purchaseLog: [
      { time: -15, itemId: 39 },
      { time: 42, itemId: 216 },
    ],
    abilityUpgrades: [101, 102, 101],
  });
  assert.equal(result.match.players[5].team, 'dire');
  assert.equal(result.match.players[5].won, false);
});

test('rejeita partida que a OpenDota ainda não analisou', () => {
  const { normalizeOpenDotaMatch } = require('../dist-electron/src/core/opendota.js');
  const raw = parsedMatch();
  delete raw.version;
  raw.players = raw.players.map(({ purchase_log, ability_upgrades_arr, lane_role, ...player }) => player);

  const result = normalizeOpenDotaMatch(raw, catalogs);

  assert.deepEqual(result, {
    status: 'rejected',
    reason: 'unparsed',
    details: 'A OpenDota ainda não analisou o replay desta partida.',
  });
});

test('rejeita patch que não existe no catálogo local', () => {
  const { normalizeOpenDotaMatch } = require('../dist-electron/src/core/opendota.js');
  const raw = parsedMatch();
  raw.patch = 999;

  const result = normalizeOpenDotaMatch(raw, catalogs);

  assert.deepEqual(result, {
    status: 'rejected',
    reason: 'unknown-patch',
    details: 'O patch OpenDota 999 não existe no catálogo local.',
  });
});

test('rejeita elenco incompleto antes de gerar observações', () => {
  const { normalizeOpenDotaMatch } = require('../dist-electron/src/core/opendota.js');
  const raw = parsedMatch();
  raw.players.pop();

  const result = normalizeOpenDotaMatch(raw, catalogs);

  assert.deepEqual(result, {
    status: 'rejected',
    reason: 'incomplete-roster',
    details: 'A partida precisa ter exatamente cinco jogadores em cada time.',
  });
});

test('rejeita jogador sem os campos necessários do replay', () => {
  const { normalizeOpenDotaMatch } = require('../dist-electron/src/core/opendota.js');
  const raw = parsedMatch();
  delete raw.players[0].lane_role;

  const result = normalizeOpenDotaMatch(raw, catalogs);

  assert.deepEqual(result, {
    status: 'rejected',
    reason: 'incomplete-player-data',
    details: 'O jogador no slot 0 não possui todos os dados analisados necessários.',
  });
});

test('ignora item desconhecido e registra aviso sem perder a partida', () => {
  const { normalizeOpenDotaMatch } = require('../dist-electron/src/core/opendota.js');
  const raw = parsedMatch();
  raw.players[0].purchase_log.push({ time: 500, key: 'item_do_patch_novo' });

  const result = normalizeOpenDotaMatch(raw, catalogs);

  assert.equal(result.status, 'accepted');
  assert.deepEqual(result.match.players[0].purchaseLog, [
    { time: -15, itemId: 39 },
    { time: 42, itemId: 216 },
  ]);
  assert.deepEqual(result.warnings, [{
    code: 'unknown-item',
    playerSlot: 0,
    value: 'item_do_patch_novo',
  }]);
});

test('rejeita resposta com metadados essenciais inválidos', () => {
  const { normalizeOpenDotaMatch } = require('../dist-electron/src/core/opendota.js');
  const raw = parsedMatch();
  delete raw.start_time;

  const result = normalizeOpenDotaMatch(raw, catalogs);

  assert.deepEqual(result, {
    status: 'rejected',
    reason: 'invalid-match',
    details: 'A resposta da OpenDota não contém uma partida válida.',
  });
});
