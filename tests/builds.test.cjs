const assert = require('node:assert/strict');
const { test } = require('node:test');

const player = (heroId, team, laneRole, lastHits, netWorth, won) => ({
  heroId,
  team,
  laneRole,
  lastHits,
  netWorth,
  won,
  isRoaming: false,
  facetId: 1,
  purchaseLog: [],
  abilityUpgrades: [],
});

const match = (matchId = 'match-1') => ({
  matchId,
  patch: '7.41',
  startedAt: 1_750_000_000,
  averageRankTier: 75,
  parsed: true,
  players: [
    player(1, 'radiant', 1, 220, 18_000, true),
    player(2, 'radiant', 1, 35, 7_000, true),
    player(3, 'radiant', 2, 190, 16_500, true),
    player(4, 'radiant', 3, 155, 14_000, true),
    player(5, 'radiant', 3, 42, 7_500, true),
    player(6, 'dire', 1, 205, 17_000, false),
    player(7, 'dire', 1, 28, 6_500, false),
    player(8, 'dire', 2, 180, 15_500, false),
    player(9, 'dire', 3, 145, 13_500, false),
    player(10, 'dire', 3, 38, 7_000, false),
  ],
});

const input = (matches, minSampleSize = 2) => ({
  source: { name: 'OpenDota', fetchedAt: 1_760_000_000 },
  policy: {
    patch: '7.41',
    since: 1_740_000_000,
    minRankTier: 70,
    minSampleSize,
    minPositionConfidence: 0.65,
  },
  matches,
});

test('não publica builds abaixo da amostra mínima', () => {
  const { generateBuilds } = require('../dist-electron/src/core/builds.js');

  const result = generateBuilds(input([match()]));

  assert.deepEqual(result.recommendations, []);
  assert.deepEqual(result.audit, {
    matchesSeen: 1,
    eligibleMatches: 1,
    playerObservations: 10,
    classifiedPlayers: 10,
    unclassifiedPlayers: 0,
    publishableGroups: 0,
    groupsBelowMinimum: 10,
    rejectedMatches: {
      unparsed: 0,
      wrongPatch: 0,
      outsideWindow: 0,
      belowRank: 0,
      incomplete: 0,
    },
  });
});

test('publica evidência por herói e posição quando a amostra é suficiente', () => {
  const { generateBuilds } = require('../dist-electron/src/core/builds.js');
  const second = match('match-2');
  second.players = second.players.map(value => ({ ...value, won: !value.won }));

  const result = generateBuilds(input([match(), second]));
  const carry = result.recommendations.find(value => value.heroId === 1 && value.position === 1);

  assert.deepEqual(carry, {
    heroId: 1,
    position: 1,
    sampleSize: 2,
    wins: 1,
    winRate: 0.5,
    positionConfidence: 0.828125,
    items: { starting: [], early: [], core: [], late: [] },
    skillBuilds: [],
    facets: [{ facetId: 1, matches: 2, pickRate: 1, wins: 1, winRate: 0.5 }],
  });
  assert.equal(result.audit.publishableGroups, 10);
  assert.equal(result.audit.groupsBelowMinimum, 0);
});

test('agrega itens por fase sem contar recompras como partidas extras', () => {
  const { generateBuilds } = require('../dist-electron/src/core/builds.js');
  const first = match('match-items-1');
  const second = match('match-items-2');
  first.players[0].purchaseLog = [
    { time: -20, itemId: 44 },
    { time: -5, itemId: 44 },
    { time: 300, itemId: 50 },
    { time: 900, itemId: 100 },
    { time: 1_800, itemId: 200 },
  ];
  second.players[0].purchaseLog = [
    { time: -10, itemId: 44 },
    { time: 420, itemId: 50 },
    { time: 1_000, itemId: 101 },
    { time: 1_700, itemId: 200 },
  ];

  const result = generateBuilds(input([first, second]));
  const carry = result.recommendations.find(value => value.heroId === 1 && value.position === 1);

  assert.deepEqual(carry.items.starting, [
    { itemId: 44, matches: 2, pickRate: 1, averagePurchaseTime: -15 },
  ]);
  assert.deepEqual(carry.items.early, [
    { itemId: 50, matches: 2, pickRate: 1, averagePurchaseTime: 360 },
  ]);
  assert.deepEqual(carry.items.core, [
    { itemId: 100, matches: 1, pickRate: 0.5, averagePurchaseTime: 900 },
    { itemId: 101, matches: 1, pickRate: 0.5, averagePurchaseTime: 1_000 },
  ]);
  assert.deepEqual(carry.items.late, [
    { itemId: 200, matches: 2, pickRate: 1, averagePurchaseTime: 1_750 },
  ]);
});

test('ranqueia sequências de habilidades realmente observadas', () => {
  const { generateBuilds } = require('../dist-electron/src/core/builds.js');
  const first = match('match-skills-1');
  const second = match('match-skills-2');
  const third = match('match-skills-3');
  first.players[0].abilityUpgrades = [101, 102, 101, 103];
  second.players[0].abilityUpgrades = [101, 102, 101, 103];
  third.players[0].abilityUpgrades = [101, 103, 101, 102];

  const result = generateBuilds(input([first, second, third]));
  const carry = result.recommendations.find(value => value.heroId === 1 && value.position === 1);

  assert.deepEqual(carry.skillBuilds, [
    { abilityIds: [101, 102, 101, 103], matches: 2, pickRate: 2 / 3 },
    { abilityIds: [101, 103, 101, 102], matches: 1, pickRate: 1 / 3 },
  ]);
});

test('agrega facetas com amostra e vitórias explícitas', () => {
  const { generateBuilds } = require('../dist-electron/src/core/builds.js');
  const first = match('match-facet-1');
  const second = match('match-facet-2');
  const third = match('match-facet-3');
  first.players[0].facetId = 1;
  first.players[0].won = true;
  second.players[0].facetId = 1;
  second.players[0].won = false;
  third.players[0].facetId = 2;
  third.players[0].won = true;

  const result = generateBuilds(input([first, second, third]));
  const carry = result.recommendations.find(value => value.heroId === 1 && value.position === 1);

  assert.deepEqual(carry.facets, [
    { facetId: 1, matches: 2, pickRate: 2 / 3, wins: 1, winRate: 0.5 },
    { facetId: 2, matches: 1, pickRate: 1 / 3, wins: 1, winRate: 1 },
  ]);
});
