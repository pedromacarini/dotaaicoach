const assert = require('node:assert/strict');
const { test } = require('node:test');

test('GSI draft ausente permanece indisponível e draft presente normaliza picks/bans sem duplicar', () => {
  const { normalizeDraft, unavailableDraft } = require('../dist-electron/electron/gsi.js');
  assert.deepEqual(normalizeDraft(undefined), unavailableDraft());
  const state = normalizeDraft({ phase: 'picking', active_team: 'radiant', seconds_remaining: '12',
    picks: [{ hero_id: 1, team: 'radiant', order: 0 }, { hero_id: 1, team: 'radiant', order: 0 }, { hero_id: 2, team: 'dire', order: 1 }],
    bans: [{ hero_id: 3, team: 'dire', order: 0 }] }, 1234);
  assert.equal(state.source, 'gsi');
  assert.equal(state.phase, 'picking');
  assert.equal(state.secondsRemaining, 12);
  assert.deepEqual(state.allies.map(pick => pick.heroId), [1]);
  assert.deepEqual(state.enemies.map(pick => pick.heroId), [2]);
  assert.deepEqual(state.bans.map(pick => pick.heroId), [3]);
  assert.equal(state.allies[0].confirmedAt, 1234);
});

test('normalizador aceita aliases observados e deixa aliados relativos ao jogador Dire', () => {
  const { normalizeDraft } = require('../dist-electron/electron/gsi.js');
  const state = normalizeDraft({ activeteam: 'dire', activeteam_time_remaining: 8,
    pick: { hero_id: 7, team: 'dire', order: 0 }, ban: { hero_id: 8, team: 'radiant', order: 0 } }, 2000, 'dire');
  assert.equal(state.activeTeam, 'dire');
  assert.equal(state.secondsRemaining, 8);
  assert.deepEqual(state.allies.map(pick => pick.heroId), [7]);
  assert.deepEqual(state.enemies.map(pick => pick.heroId), []);
  assert.equal(state.bans[0].heroId, 8);
});

test('tracker incrementa revisão, reinicia em nova partida e cooldown evita prompt repetido', () => {
  const { createDraftLiveTracker } = require('../dist-electron/src/core/draft-live.js');
  let now = 10_000;
  const tracker = createDraftLiveTracker(() => now);
  const base = { source: 'gsi', phase: 'picking', activeTeam: 'radiant', localTeam: 'radiant', secondsRemaining: 30,
    allies: [], enemies: [], bans: [], revision: 0, receivedAt: now };
  const first = tracker.accept(base, 'match-a', now);
  assert.equal(first.revision, 1);
  assert.equal(first.prompt.visible, true);
  const same = tracker.accept(base, 'match-a', now + 100);
  assert.equal(same.revision, 1);
  const dismissed = tracker.dismiss('later', now + 100);
  assert.equal(dismissed.prompt.visible, false);
  const pick = { ...base, enemies: [{ heroId: 2, team: 'dire', kind: 'pick', order: 0, source: 'gsi', confirmedAt: now + 200 }] };
  assert.equal(tracker.accept(pick, 'match-a', now + 200).revision, 2);
  assert.equal(tracker.get().prompt.visible, false);
  now += 301_000;
  assert.equal(tracker.accept(pick, 'match-a', now).prompt.visible, true);
  assert.equal(tracker.accept(pick, 'match-b', now).revision, 1);
});

test('tracker preserva picks confirmados quando o pacote seguinte traz apenas parte do draft', () => {
  const { createDraftLiveTracker } = require('../dist-electron/src/core/draft-live.js');
  const tracker = createDraftLiveTracker(() => 1_000);
  const first = { source: 'gsi', phase: 'picking', activeTeam: 'radiant', localTeam: 'radiant', secondsRemaining: 20,
    allies: [{ heroId: 1, team: 'radiant', kind: 'pick', order: 0, source: 'gsi', confirmedAt: 1 }], enemies: [], bans: [], revision: 0, receivedAt: 1 };
  tracker.accept(first, null, 1);
  const partial = { ...first, allies: [], enemies: [{ heroId: 2, team: 'dire', kind: 'pick', order: 1, source: 'gsi', confirmedAt: 2 }] };
  const result = tracker.accept(partial, null, 2);
  assert.deepEqual(result.allies.map(pick => pick.heroId), [1]);
  assert.deepEqual(result.enemies.map(pick => pick.heroId), [2]);
});
