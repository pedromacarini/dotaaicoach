const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const baseRule = overrides => ({
  id: 'power-rune', enabled: true, title: 'Runa de poder', atSeconds: 360, position: 'all', tags: ['runa'],
  repeatEverySeconds: 120, repeatUntilSeconds: 720, durationSeconds: 8, audio: 'silent', ...overrides,
});

test('scheduler não duplica pacote, tolera pausa/regressão e respeita repetição/limite', () => {
  const { createNotificationScheduler } = require('../dist-electron/src/core/notification-scheduler.js');
  const scheduler = createNotificationScheduler();
  const context = { mode: 'normal', position: 2 };
  assert.equal(scheduler.advance(359, [baseRule()], context, 1000).length, 0);
  assert.deepEqual(scheduler.advance(360, [baseRule()], context, 1000).map(x => x.scheduledAt), [360]);
  assert.equal(scheduler.advance(360, [baseRule()], context, 1000).length, 0, 'pacote duplicado');
  assert.equal(scheduler.advance(300, [baseRule()], context, 1000).length, 0, 'regressão');
  assert.equal(scheduler.advance(360, [baseRule()], context, 1000).length, 0, 'não dispara de novo após regressão');
  assert.deepEqual(scheduler.advance(601, [baseRule()], context, 1000).map(x => x.scheduledAt), [480, 600]);
  assert.deepEqual(scheduler.advance(900, [baseRule()], context, 1000).map(x => x.scheduledAt), [720]);
});

test('scheduler filtra posição e disparo inicial usa tolerância curta sem recuperar a partida toda', () => {
  const { createNotificationScheduler } = require('../dist-electron/src/core/notification-scheduler.js');
  const scheduler = createNotificationScheduler();
  assert.equal(scheduler.advance(360, [baseRule({position: 4})], {mode:'normal',position:2}).length, 0);
  scheduler.reset();
  assert.equal(scheduler.advance(601, [baseRule()], {mode:'normal',position:2}).length, 1);
  assert.equal(scheduler.advance(601, [baseRule()], {mode:'normal',position:2})[0], undefined);
});

test('repetição sem fim explícito segue até teto global e advance possui teto global', () => {
  const { createNotificationScheduler, MAX_OCCURRENCES_PER_ADVANCE } = require('../dist-electron/src/core/notification-scheduler.js');
  const scheduler = createNotificationScheduler();
  const endless = baseRule({atSeconds:0,repeatEverySeconds:60,repeatUntilSeconds:null});
  scheduler.advance(0,[endless],{mode:'normal',position:1});
  assert.deepEqual(scheduler.advance(121,[endless],{mode:'normal',position:1}).map(x=>x.scheduledAt),[60,120]);
  const many = Array.from({length:200},(_,index)=>baseRule({id:`rule-${index}`,atSeconds:200,repeatEverySeconds:null,repeatUntilSeconds:null}));
  scheduler.reset();
  scheduler.advance(0,many,{mode:'normal',position:1});
  assert.equal(scheduler.advance(200,many,{mode:'normal',position:1}).length,MAX_OCCURRENCES_PER_ADVANCE);
});

test('store valida importação, persiste CRUD e limita arquivo a 200 regras', () => {
  const { createNotificationStore, validateNotificationConfig } = require('../dist-electron/electron/notification-store.js');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-notifications-'));
  const file = path.join(folder, 'notifications.json');
  try {
    const store = createNotificationStore(file);
    assert.ok(store.get().rules.length > 0);
    store.upsert(baseRule({id:'mine',title:'Meu alerta'}));
    assert.equal(store.get().rules.some(rule => rule.id === 'mine'), true);
    store.remove('mine');
    assert.equal(store.get().rules.some(rule => rule.id === 'mine'), false);
    assert.equal(createNotificationStore(file).get().rules.some(rule => rule.id === 'mine'), false);
    assert.throws(() => validateNotificationConfig({schemaVersion:1,mode:'normal',rules:[baseRule({id:'x',tags:['a','a']})]}), /duplicadas/);
    assert.throws(() => validateNotificationConfig({schemaVersion:1,mode:'normal',rules:Array.from({length:201},(_,i)=>baseRule({id:`r${i}`}))}), /excede/);
    assert.throws(() => validateNotificationConfig({schemaVersion:1,mode:'normal',rules:[baseRule({title:'<script>',audio:'arquivo.mp3'})]}), /áudio/);
  } finally { fs.rmSync(folder, {recursive:true,force:true}); }
});

test('store só publica candidato depois de persistência bem-sucedida', () => {
  const { createNotificationStore } = require('../dist-electron/electron/notification-store.js');
  const store = createNotificationStore(path.join(os.tmpdir(),'unused-notifications.json'), {
    persist: () => { throw new Error('disco indisponível'); },
  });
  const before = store.get();
  assert.throws(() => store.upsert(baseRule({id:'must-not-leak'})),/disco indisponível/);
  assert.deepEqual(store.get(),before);
});

test('central expira, dispensa, filtra posição e toca somente regra beep', () => {
  const { createNotificationCenter } = require('../dist-electron/electron/notification-center.js');
  let config = {schemaVersion:1,mode:'normal',rules:[baseRule({atSeconds:10,repeatEverySeconds:null,repeatUntilSeconds:null,audio:'beep',durationSeconds:2})]};
  let sounds = 0;
  const store = { get: () => structuredClone(config) };
  const center = createNotificationCenter({store,getPosition:()=>2,getAlertsEnabled:()=>true,onSound:()=>sounds++});
  assert.equal(center.acceptGameTime(10, 1000), true);
  assert.equal(sounds, 1);
  assert.equal(center.getState(1000).runtime.active.length, 1);
  const id = center.getState(1000).runtime.active[0].id;
  assert.equal(center.dismiss(id), true);
  assert.equal(center.getState(1000).runtime.active.length, 0);
  center.setSimulatedTime(10, 2000);
  assert.equal(center.getState(2000).runtime.simulated, true);
  assert.equal(center.expire(4001), true);
  assert.equal(center.getState(4001).runtime.active.length, 0);
});

test('central reconhece forte regressão ao início como nova partida', () => {
  const { createNotificationCenter } = require('../dist-electron/electron/notification-center.js');
  const config = {schemaVersion:1,mode:'normal',rules:[baseRule({atSeconds:10,repeatEverySeconds:null,repeatUntilSeconds:null})]};
  const center = createNotificationCenter({store:{get:()=>structuredClone(config)},getPosition:()=>1,getAlertsEnabled:()=>true,onSound:()=>{}});
  center.acceptGameTime(10, 1000);
  assert.equal(center.getState(1000).runtime.active.length,1);
  center.dismiss(center.getState(1000).runtime.active[0].id);
  center.acceptGameTime(700, 2000);
  center.acceptGameTime(-20, 3000);
  center.acceptGameTime(10, 4000);
  assert.equal(center.getState(4000).runtime.active.length,1);
});

test('central publica relógio sem banner, notifica expiração e silencia quando módulo está oculto', () => {
  const { createNotificationCenter } = require('../dist-electron/electron/notification-center.js');
  const config = {schemaVersion:1,mode:'normal',rules:[baseRule({atSeconds:10,repeatEverySeconds:null,repeatUntilSeconds:null,audio:'beep',durationSeconds:2})]};
  let sounds=0, alertsEnabled=false;
  const center=createNotificationCenter({store:{get:()=>structuredClone(config)},getPosition:()=>1,getAlertsEnabled:()=>alertsEnabled,onSound:()=>sounds++});
  assert.equal(center.acceptGameTime(5,1000,'match-a'),true);
  assert.equal(center.getState(1000).runtime.gameTime,5);
  assert.equal(center.acceptGameTime(5,1100,'match-a'),false,'pacote duplicado não gera tráfego');
  assert.equal(center.acceptGameTime(10,1200,'match-a'),true);
  assert.equal(sounds,0,'módulo oculto silencia áudio automático');
  assert.equal(center.acceptGameTime(11,3301,'match-a'),true,'expiração também é mudança observável');
  assert.equal(center.getState(3301).runtime.active.length,0);
  assert.equal(center.acceptGameTime(null,3400,'match-a'),true);
  assert.equal(center.getState(3400).runtime.gameTime,null);
});

test('identidade, remake curto e reconexão tardia abrem nova sessão sem depender de grande regressão', () => {
  const { createNotificationCenter } = require('../dist-electron/electron/notification-center.js');
  const config={schemaVersion:1,mode:'normal',rules:[baseRule({atSeconds:90,repeatEverySeconds:null,repeatUntilSeconds:null})]};
  const make=()=>createNotificationCenter({store:{get:()=>structuredClone(config)},getPosition:()=>1,getAlertsEnabled:()=>true,onSound:()=>{}});
  const byIdentity=make();
  byIdentity.acceptGameTime(90,1000,'100'); byIdentity.dismiss(byIdentity.getState(1000).runtime.active[0].id);
  byIdentity.acceptGameTime(90,2000,'101');
  assert.equal(byIdentity.getState(2000).runtime.active.length,1,'matchid diferente reinicia mesmo no mesmo relógio');
  const remake=make();
  remake.acceptGameTime(90,1000,null); remake.dismiss(remake.getState(1000).runtime.active[0].id);
  remake.acceptGameTime(-10,2000,null); remake.acceptGameTime(90,3000,null);
  assert.equal(remake.getState(3000).runtime.active.length,1,'retorno curto ao pré-jogo reinicia');
  const late=make();
  late.acceptGameTime(90,1000,null); late.dismiss(late.getState(1000).runtime.active[0].id);
  late.acceptGameTime(null,2000,null,true); late.acceptGameTime(90,3000,null);
  assert.equal(late.getState(3000).runtime.active.length,1,'pacote após desconexão reinicia mesmo chegando acima de 60s');
});

test('timeout e reconexão com o mesmo matchid não repetem banner nem som', () => {
  const { createNotificationCenter } = require('../dist-electron/electron/notification-center.js');
  const config={schemaVersion:1,mode:'normal',rules:[baseRule({atSeconds:10,repeatEverySeconds:null,repeatUntilSeconds:null,audio:'beep'})]};
  let sounds=0;
  const center=createNotificationCenter({store:{get:()=>structuredClone(config)},getPosition:()=>1,getAlertsEnabled:()=>true,onSound:()=>sounds++});
  center.acceptGameTime(10,1000,'match-stable');
  assert.equal(sounds,1);
  center.dismiss(center.getState(1000).runtime.active[0].id);
  center.acceptGameTime(null,2000,'match-stable',true);
  center.acceptGameTime(10,3000,'match-stable');
  assert.equal(center.getState(3000).runtime.active.length,0);
  assert.equal(sounds,1);

  const fallback=createNotificationCenter({store:{get:()=>structuredClone(config)},getPosition:()=>1,getAlertsEnabled:()=>true,onSound:()=>{}});
  fallback.acceptGameTime(10,1000,null);
  fallback.dismiss(fallback.getState(1000).runtime.active[0].id);
  fallback.acceptGameTime(null,2000,null,true);
  fallback.acceptGameTime(10,3000,null);
  assert.equal(fallback.getState(3000).runtime.active.length,1,'sem identidade, timeout continua sendo fronteira conservadora');
});
