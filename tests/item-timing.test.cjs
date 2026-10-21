const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createItemTracker } = require('../dist-electron/src/core/item-tracker.js');
const { aggregatePurchaseLogBenchmarks, compareItemTiming } = require('../dist-electron/src/core/item-timing.js');

const inventory = slots => ({observation:'observed',slots});
const present = (key, area, itemInternalName) => ({key,area,state:'present',itemInternalName,charges:null});
const empty = (key, area='active') => ({key,area,state:'empty',itemInternalName:null,charges:null});
const snapshot = (overrides={}) => ({
  source:'gsi',connected:true,receivedAt:1000,gameTime:100,matchId:'m1',gameState:'playing',playerActivity:'playing',
  heroInternalName:'npc_dota_hero_axe',heroName:'Axe',heroLevel:5,lastHits:20,denies:1,netWorth:2000,gpm:400,
  kills:0,deaths:0,assists:0,inventory:inventory([]),...overrides,
});

test('tracker registra primeira observação uma vez entre slot, mochila e baú', () => {
  const tracker=createItemTracker();
  tracker.accept(snapshot({gameTime:100,inventory:inventory([present('slot0','active','item_blink')])}),3);
  tracker.accept(snapshot({gameTime:110,inventory:inventory([empty('slot0'),present('slot6','backpack','item_blink')])}),3);
  tracker.accept(snapshot({gameTime:120,inventory:inventory([present('stash0','stash','item_blink')])}),3);
  const state=tracker.getState();
  assert.equal(state.observations.length,1);
  assert.equal(state.observations[0].firstSeenAt,100);
  assert.equal(state.observations[0].firstSeenArea,'active');
});

test('tracker não registra itens antes de GAME_IN_PROGRESS', () => {
  const tracker=createItemTracker();
  tracker.accept(snapshot({gameTime:null,gameState:'DOTA_GAMERULES_STATE_STRATEGY_TIME',inventory:inventory([present('slot0','active','item_boots')])}),3);
  assert.equal(tracker.getState().observations.length,0);
  tracker.accept(snapshot({gameTime:0,gameState:'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',inventory:inventory([present('slot0','active','item_boots')])}),3);
  assert.equal(tracker.getState().observations[0].firstSeenAt,0);
});

test('combinação vira novo tipo, desaparecimento/reaparição e reconexão não duplicam', () => {
  const tracker=createItemTracker();
  tracker.accept(snapshot({gameTime:200,inventory:inventory([present('slot0','active','item_energy_booster'),present('slot1','active','item_void_stone')])}),3);
  tracker.accept(snapshot({gameTime:210,inventory:inventory([empty('slot0'),empty('slot1')])}),3);
  tracker.accept(snapshot({connected:false,gameTime:null,inventory:{observation:'unknown',slots:[]}}),3);
  tracker.accept(snapshot({gameTime:230,inventory:inventory([present('slot0','active','item_energy_booster'),present('slot1','active','item_aether_lens')])}),3);
  assert.deepEqual(tracker.getState().observations.map(value=>value.itemInternalName),[
    'item_energy_booster','item_void_stone','item_aether_lens',
  ]);
});

test('item desconhecido permanece rastreável e matchid novo reinicia sessão', () => {
  const tracker=createItemTracker();
  tracker.accept(snapshot({inventory:inventory([present('slot0','active','item_future_unknown')])}),3);
  assert.equal(tracker.getState().observations[0].itemInternalName,'item_future_unknown');
  tracker.accept(snapshot({matchId:'m2',gameTime:20,inventory:inventory([present('slot0','active','item_boots')])}),3);
  assert.deepEqual(tracker.getState().observations.map(value=>value.itemInternalName),['item_boots']);
});

test('nova identidade sem herói não reutiliza benchmark do herói anterior', () => {
  const tracker=createItemTracker();
  tracker.accept(snapshot({matchId:'m1',gameTime:260,inventory:inventory([present('slot0','active','item_boots')])}),3);
  assert.equal(tracker.getState().comparisons[0].benchmark,null,'GSI sem benchmark histórico deve falhar fechado');
  tracker.accept(snapshot({matchId:'m2',gameTime:100,heroInternalName:null,heroName:null,
    inventory:inventory([present('slot0','active','item_blink')])}),3);
  const state=tracker.getState();
  assert.deepEqual(state.observations.map(value=>value.itemInternalName),['item_blink']);
  assert.equal(state.comparisons[0].benchmark,null);
  assert.equal(state.comparisons[0].verdict,'no-sample');
});

test('matchid confiável que chega tarde adota identidade sem apagar primeira observação', () => {
  const tracker=createItemTracker();
  tracker.accept(snapshot({matchId:null,gameTime:10,inventory:inventory([present('slot0','active','item_boots')])}),3);
  tracker.accept(snapshot({matchId:'late-id',gameTime:100,inventory:inventory([present('slot6','backpack','item_boots')])}),3);
  const state=tracker.getState();
  assert.equal(state.sessionKey,'match:late-id');
  assert.equal(state.observations.length,1);
  assert.equal(state.observations[0].firstSeenAt,10);
});

test('pacote duplicado não produz mudança publicável', () => {
  const tracker=createItemTracker();
  const packet=snapshot({gameTime:100,inventory:inventory([present('slot0','active','item_blink')])});
  const first=tracker.accept(packet,3);
  const before=tracker.getState();
  const duplicate=tracker.accept({...packet,receivedAt:2000},3);
  assert.equal(first.changed,true);
  assert.equal(duplicate.changed,false);
  assert.deepEqual(duplicate.state,before);
});

test('benchmark classifica cedo, esperado, tarde e sem amostra', () => {
  const benchmark={schemaVersion:1,heroInternalName:'npc_dota_hero_axe',position:3,itemInternalName:'item_blink',
    medianSeconds:600,p25Seconds:540,p75Seconds:660,sampleSize:30,patch:'7.41',mode:'normal',source:'OpenDota',
    sourceKind:'opendota-purchase-log',updatedAt:'2026-10-21T00:00:00.000Z'};
  const observation=time=>({itemInternalName:'item_blink',firstSeenAt:time,firstSeenReceivedAt:1000,firstSeenArea:'active'});
  const context={patch:'7.41',mode:'normal'};
  assert.equal(compareItemTiming(observation(500),'npc_dota_hero_axe',3,[benchmark],context).verdict,'early');
  assert.equal(compareItemTiming(observation(600),'npc_dota_hero_axe',3,[benchmark],context).verdict,'expected');
  assert.equal(compareItemTiming(observation(700),'npc_dota_hero_axe',3,[benchmark],context).verdict,'late');
  assert.equal(compareItemTiming(observation(null),'npc_dota_hero_axe',3,[benchmark],context).verdict,'unknown-time');
  assert.equal(compareItemTiming({...observation(600),itemInternalName:'item_unknown'},'npc_dota_hero_axe',3,[benchmark],context).verdict,'no-sample');
  assert.equal(compareItemTiming(observation(700),'npc_dota_hero_axe',3,[benchmark],{patch:'7.40',mode:'normal'}).verdict,'no-sample');
  assert.equal(compareItemTiming(observation(700),'npc_dota_hero_axe',3,[benchmark],{patch:'7.41',mode:null}).verdict,'no-sample');
});

test('purchase_log agrega primeira compra em mediana/p25/p75 e aplica amostra mínima', () => {
  const row=(matchId,time,overrides={})=>({matchId,heroInternalName:'npc_dota_hero_axe',position:3,
    itemInternalName:'item_blink',purchaseTimeSeconds:time,patch:'7.41',mode:'normal',source:'OpenDota',
    sourceKind:'opendota-purchase-log',...overrides});
  const samples=Array.from({length:30},(_,index)=>row(`m${index}`,300+index*10));
  samples.push(row('m0',900));
  const result=aggregatePurchaseLogBenchmarks(samples,{updatedAt:'2026-10-21T12:00:00.000Z'});
  assert.equal(result.length,1);
  assert.deepEqual(result[0],{schemaVersion:1,heroInternalName:'npc_dota_hero_axe',position:3,
    itemInternalName:'item_blink',medianSeconds:445,p25Seconds:373,p75Seconds:518,sampleSize:30,
    patch:'7.41',mode:'normal',source:'OpenDota',sourceKind:'opendota-purchase-log',
    updatedAt:'2026-10-21T12:00:00.000Z'});
  assert.equal(aggregatePurchaseLogBenchmarks(samples.slice(0,29)).length,0);
});

test('tracker usa somente benchmark local compatível com patch e modo', () => {
  const benchmark={schemaVersion:1,heroInternalName:'npc_dota_hero_axe',position:3,itemInternalName:'item_blink',
    medianSeconds:600,p25Seconds:540,p75Seconds:660,sampleSize:30,patch:'7.41',mode:'normal',source:'OpenDota',
    sourceKind:'opendota-purchase-log',updatedAt:'2026-10-21T00:00:00.000Z'};
  let context={patch:'7.40',mode:'normal'};
  const incompatible=createItemTracker({benchmarks:[benchmark],getBenchmarkContext:()=>context});
  incompatible.accept(snapshot({gameTime:700,inventory:inventory([present('slot0','active','item_blink')])}),3);
  assert.equal(incompatible.getState().comparisons[0].verdict,'no-sample');
  context={patch:'7.41',mode:'normal'};
  const compatible=createItemTracker({benchmarks:[benchmark],getBenchmarkContext:()=>context});
  compatible.accept(snapshot({gameTime:700,inventory:inventory([present('slot0','active','item_blink')])}),3);
  assert.equal(compatible.getState().comparisons[0].verdict,'late');
  assert.equal(compatible.getState().validation,'historical-local');
});
