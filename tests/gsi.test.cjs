const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const { normalizeGsi, makeGsiConfig, generateToken, startGsiServer, GSI_PORT } = require('../dist-electron/electron/gsi.js');

test('Normalização de um payload do jogador local', () => {
  const result = normalizeGsi({ map: { game_time: 912, matchid: '987654321012345678' }, hero: { name: 'npc_dota_hero_crystal_maiden', level: 11 }, player: { activity: 'playing', last_hits: 81, net_worth: 6030, denies: 5 } }, 1000);
  assert.equal(result.heroName, 'Crystal Maiden');
  assert.equal(result.heroInternalName, 'npc_dota_hero_crystal_maiden');
  assert.equal(result.gameTime, 912);
  assert.equal(result.matchId, '987654321012345678');
  assert.equal(result.lastHits, 81);
  assert.equal(result.netWorth, 6030);
  assert.equal(result.playerActivity, 'playing');
  assert.equal(result.gpm, null);
  assert.equal(result.source, 'gsi');
});

test('Payload incompleto não inventa dados', () => {
  const result = normalizeGsi({ map: {} });
  assert.equal(result.heroName, null);
  assert.equal(result.netWorth, null);
  assert.equal(result.kills, null);
  assert.equal(result.matchId, null);
  assert.equal(result.inventory.observation, 'unknown');
  assert.ok(result.inventory.slots.every(slot => slot.state === 'unknown'));
});

test('inventário diferencia campo ausente, slot vazio e áreas observadas', () => {
  const result = normalizeGsi({ items: {
    slot0: {name:'item_blink'}, slot1: {name:'empty'}, slot6: {name:'item_tango',charges:2},
    stash0: {}, teleport0: {name:'item_tpscroll',charges:1}, neutral0: {name:'item_broom_handle'},
  } });
  assert.equal(result.inventory.observation, 'observed');
  assert.deepEqual(result.inventory.slots.find(slot => slot.key === 'slot0'), {
    key:'slot0',area:'active',state:'present',itemInternalName:'item_blink',charges:null,
  });
  assert.equal(result.inventory.slots.find(slot => slot.key === 'slot1').state, 'empty');
  assert.equal(result.inventory.slots.find(slot => slot.key === 'slot2').state, 'unknown');
  assert.equal(result.inventory.slots.find(slot => slot.key === 'slot6').area, 'backpack');
  assert.equal(result.inventory.slots.find(slot => slot.key === 'stash0').state, 'empty');
  assert.equal(result.inventory.slots.find(slot => slot.key === 'teleport0').area, 'teleport');
  assert.equal(result.inventory.slots.find(slot => slot.key === 'neutral0').area, 'neutral');
});

test('Configuração contém endpoint loopback e token', () => {
  const token = generateToken();
  assert.match(token, /^[0-9a-f]{48}$/);
  const cfg = makeGsiConfig(token);
  assert.ok(cfg.includes('127.0.0.1:3199/gsi'));
  assert.ok(cfg.includes(token));
  assert.match(cfg, /"items"\s+"1"/);
  assert.ok(!cfg.includes('allplayers'));
});

function post(token, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: GSI_PORT, method: 'POST', path: '/gsi', headers: { 'Content-Type': 'application/json' } }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end(JSON.stringify({ ...body, auth: { token } }));
  });
}

test('Servidor recusa token errado e aceita token certo', async () => {
  const token = generateToken();
  const received = [];
  const server = await startGsiServer(token, s => received.push(s));
  try {
    assert.equal(await post('wrong', { player: { last_hits: 20 } }), 401);
    assert.equal(received.length, 0);
    assert.equal(await post(token, { player: { last_hits: 22 } }), 200);
    assert.equal(received[0].lastHits, 22);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
