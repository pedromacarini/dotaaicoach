const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chooseDisplayedSession, createDemoSession, summarizeSession } = require('../dist-electron/src/core/match-session.js');
const { createSessionHistoryStore } = require('../dist-electron/electron/session-history.js');
const { createMatchSessionRecorder, limitSessionSamples, MAX_SESSION_SAMPLES } = require('../dist-electron/electron/match-session-recorder.js');

const snapshot = (gameTime, overrides = {}) => ({
  source: 'gsi', connected: true, receivedAt: 1_000_000 + gameTime * 1000,
  gameTime, gameState: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',
  playerActivity: 'playing',
  heroInternalName: 'npc_dota_hero_axe', heroName: 'Axe', heroLevel: 1,
  lastHits: gameTime / 10, denies: null, netWorth: null, gpm: null,
  kills: 0, deaths: 0, assists: 0, ...overrides,
});

test('resumo usa o maior tempo válido mesmo com amostras fora de ordem', () => {
  const samples = [snapshot(100), snapshot(140), snapshot(120)].map(value => ({
    recordedAt: value.receivedAt, gameTime: value.gameTime, lastHits: value.lastHits,
    denies: null, netWorth: null, gpm: null, kills: 0, deaths: 0, assists: 0,
  }));
  assert.equal(summarizeSession(samples).duration, 140);
});

test('sessão de demonstração é rica, explícita e resumida', () => {
  const demo = createDemoSession(3, 2_000_000);
  assert.equal(demo.source, 'demo');
  assert.equal(demo.position, 3);
  assert.ok(demo.samples.length >= 7);
  assert.equal(demo.summary.lastHits, 112);
  assert.equal(demo.summary.assists, 8);
  assert.equal(summarizeSession([]).lastHits, null);
});

test('gravador evita excesso de duplicatas e finaliza no pós-jogo', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-open-sessions-'));
  try {
    const store = createSessionHistoryStore(path.join(folder, 'history.json'));
    const recorder = createMatchSessionRecorder(store, () => 2);
    assert.equal(recorder.accept(snapshot(100)).changed, true);
    assert.equal(recorder.accept(snapshot(102)).changed, false);
    assert.equal(recorder.accept(snapshot(103, { kills: 1 })).changed, true, 'KDA importante não deve esperar cinco segundos');
    assert.equal(recorder.accept(snapshot(109, { kills: 1, lastHits: null })).changed, true);
    assert.equal(recorder.getState().active.samples[2].lastHits, null, 'campo ausente deve continuar ausente');
    const completed = recorder.accept(snapshot(110, { gameState: 'DOTA_GAMERULES_STATE_POST_GAME', kills: 1 }));
    assert.deepEqual(completed, { changed: true, recentChanged: true });
    const state = recorder.getState();
    assert.equal(state.active, null);
    assert.equal(state.recent.length, 1);
    assert.equal(state.recent[0].position, 2);
    assert.equal(state.recent[0].endReason, 'post-game');
    assert.equal(createSessionHistoryStore(path.join(folder, 'history.json')).get().length, 1);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

test('regressão forte do relógio fecha uma partida e abre outra', () => {
  const sessions = [];
  const store = { get: () => sessions.slice(), add: value => { sessions.unshift(value); return sessions; } };
  const recorder = createMatchSessionRecorder(store, () => 1);
  recorder.accept(snapshot(600));
  recorder.accept(snapshot(610));
  assert.deepEqual(recorder.accept(snapshot(5)), { changed: true, recentChanged: true });
  assert.equal(sessions[0].endReason, 'new-match');
  assert.equal(recorder.getState().active.samples[0].gameTime, 5);
});

test('recorder ignora lobby/espectador e permite mudar posição somente no pré-jogo', () => {
  const sessions = [];
  const store = { get: () => sessions.slice(), add: value => { sessions.unshift(value); return sessions; } };
  let position = 1;
  const recorder = createMatchSessionRecorder(store, () => position);
  assert.equal(recorder.accept(snapshot(-30, { gameState: 'DOTA_GAMERULES_STATE_HERO_SELECTION' })).changed, false);
  assert.equal(recorder.accept(snapshot(-25, { playerActivity: 'spectating' })).changed, false);
  assert.equal(recorder.getState().active, null);
  assert.equal(recorder.accept(snapshot(-20, { gameState: 'DOTA_GAMERULES_STATE_PRE_GAME' })).changed, true);
  assert.equal(recorder.getState().active.position, 1);
  position = 4;
  assert.equal(recorder.accept(snapshot(-15, { gameState: 'DOTA_GAMERULES_STATE_PRE_GAME' })).changed, true);
  assert.equal(recorder.getState().active.position, 4);
  recorder.accept(snapshot(0));
  position = 2;
  recorder.accept(snapshot(6));
  assert.equal(recorder.getState().active.position, 4, 'posição deve congelar ao iniciar a partida');
});

test('limite de amostras preserva eventos KDA sem tratar null como evento', () => {
  const samples = Array.from({ length: MAX_SESSION_SAMPLES + 20 }, (_, index) => ({
    recordedAt: index, gameTime: index * 5, lastHits: index, denies: null, netWorth: null, gpm: null,
    kills: index === 500 ? 1 : index > 500 ? 1 : 0, deaths: index === 700 ? null : index > 700 ? 1 : 0, assists: 0,
  }));
  const limited = limitSessionSamples(samples);
  assert.equal(limited.length, MAX_SESSION_SAMPLES);
  assert.ok(limited.some(value => value.gameTime === 500 * 5), 'evento de kill deve permanecer');
  assert.equal(limited.at(-1).gameTime, samples.at(-1).gameTime);
});

test('sessão ativa tem prioridade, seguida da recente selecionada e da demo', () => {
  const demo = createDemoSession(1, 10_000);
  const recent = { ...demo, id: 'recent', source: 'real', endedAt: 9_000 };
  const active = { ...demo, id: 'active', source: 'real', endedAt: null };
  assert.equal(chooseDisplayedSession('gsi', active, 'recent', [recent], demo).id, 'active');
  assert.equal(chooseDisplayedSession('idle', null, 'recent', [recent], demo).id, 'recent');
  assert.equal(chooseDisplayedSession('idle', null, null, [recent], demo), null);
  assert.equal(chooseDisplayedSession('demo', active, 'recent', [recent], demo).id, 'demo-session',
    'modo demo não pode misturar dados da sessão real ativa');
});

test('atualização frequente da sessão ativa não lê nem clona o histórico', () => {
  let historyReads = 0;
  const store = { get: () => { historyReads++; return []; }, add: () => [] };
  const recorder = createMatchSessionRecorder(store, () => 1);
  assert.deepEqual(recorder.accept(snapshot(10)), { changed: true, recentChanged: false });
  assert.equal(recorder.getActive().samples.length, 1);
  assert.equal(historyReads, 0, 'evento frequente deve carregar somente a sessão ativa');
  assert.equal(recorder.getState().recent.length, 0);
  assert.equal(historyReads, 1, 'histórico completo é lido somente sob demanda');
});
