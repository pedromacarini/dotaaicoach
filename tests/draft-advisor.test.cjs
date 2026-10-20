const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { reconcileDraftScenario, recommendDraft, shouldApplyDraftStoreEcho, validateDraftScenario, MIN_DRAFT_MATCHUP_SAMPLE } = require('../dist-electron/src/core/draft-advisor.js');
const { createDraftStore, validateDraftState } = require('../dist-electron/electron/draft-store.js');

const heroes=[
  {id:1,name:'Enemy',roles:['Carry'],captainMode:true},
  {id:2,name:'Ally',roles:['Initiator','Durable'],captainMode:true},
  {id:3,name:'Other Enemy',roles:['Carry'],captainMode:true},
  {id:5,name:'Crystal Maiden',roles:['Support','Disabler'],captainMode:true},
  {id:25,name:'Lina',roles:['Carry','Nuker'],captainMode:true},
  {id:99,name:'Outside Pool',roles:['Support'],captainMode:false},
];
const scenario=overrides=>({id:'test',name:'Teste',mode:'all-pick',position:5,allies:[2],enemies:[1],bans:[],updatedAt:1,...overrides});

test('validação fecha duplicidade e conflitos de pick/ban',()=>{
  assert.throws(()=>validateDraftScenario(scenario({allies:[2,2]}),heroes),/duplicado/);
  assert.throws(()=>validateDraftScenario(scenario({allies:[2],enemies:[2]}),heroes),/dois times/);
  assert.throws(()=>validateDraftScenario(scenario({bans:[1]}),heroes),/escolhido e banido/);
});

test("Captain's Mode rejeita seleção fora do pool e exclui candidato",()=>{
  assert.throws(()=>validateDraftScenario(scenario({mode:'captains',bans:[99]}),heroes),/pool/);
  const result=recommendDraft({scenario:scenario({mode:'captains'}),heroes,matchups:[]});
  assert.equal(result.some(value=>value.heroId===99),false);
});

test('counter usa corte de amostra, fonte, confiança e ordenação estável',()=>{
  const evidence=[{focalEnemyId:1,source:'OpenDota API',fetchedAt:'2026-01-01',rows:[
    {heroId:5,gamesPlayed:240,wins:96},
    {heroId:25,gamesPlayed:MIN_DRAFT_MATCHUP_SAMPLE-1,wins:1},
  ]}];
  const first=recommendDraft({scenario:scenario(),heroes,matchups:evidence});
  const second=recommendDraft({scenario:scenario(),heroes:[...heroes].reverse(),matchups:evidence});
  assert.equal(first[0].heroId,5);
  assert.equal(first[0].statistic.source,'OpenDota API');
  assert.equal(first[0].statistic.sampleSize,240);
  assert.equal(first[0].statistic.confidence,'medium');
  assert.equal(first[0].statistic.fetchedAt,'2026-01-01');
  assert.equal(first.find(value=>value.heroId===25).statistic,null);
  assert.deepEqual(second.map(value=>value.heroId),first.map(value=>value.heroId));
});

test('ignora evidência stale fora dos inimigos atuais e deduplica focal/oponente',()=>{
  const matchups=[
    {focalEnemyId:1,source:'OpenDota API',fetchedAt:'2026-01-01',rows:[{heroId:5,gamesPlayed:500,wins:50}]},
    {focalEnemyId:1,source:'OpenDota API',fetchedAt:'2026-02-01',rows:[
      {heroId:5,gamesPlayed:100,wins:40},{heroId:5,gamesPlayed:80,wins:20},
    ]},
    {focalEnemyId:3,source:'stale',fetchedAt:'2026-03-01',rows:[{heroId:5,gamesPlayed:900,wins:0}]},
  ];
  const current=recommendDraft({scenario:scenario({enemies:[1]}),heroes,matchups});
  const cm=current.find(value=>value.heroId===5);
  assert.equal(cm.statistic.sampleSize,100,'um focal/oponente conta somente uma vez');
  assert.equal(cm.statistic.fetchedAt,'2026-02-01');
  const swapped=recommendDraft({scenario:scenario({enemies:[3]}),heroes,matchups:matchups.filter(value=>value.focalEnemyId===1)});
  assert.equal(swapped.find(value=>value.heroId===5).statistic,null,'resultado assíncrono antigo não entra no cenário novo');
});

test("reconcilia cenário Captain salvo e guard impede echo de save sobre edição nova",()=>{
  const invalid=scenario({mode:'captains',allies:[2,99],enemies:[1],bans:[404]});
  const reconciled=reconcileDraftScenario(invalid,heroes);
  assert.deepEqual(reconciled.removedHeroIds,[99,404]);
  assert.deepEqual(reconciled.scenario.allies,[2]);
  assert.deepEqual(reconciled.scenario.bans,[]);
  assert.equal(shouldApplyDraftStoreEcho(0,null),true,'carga inicial entra');
  assert.equal(shouldApplyDraftStoreEcho(2,1),false,'edição posterior ao request vence o echo');
  assert.equal(shouldApplyDraftStoreEcho(1,1),true,'echo da revisão atual pode entrar');
});

test('cobertura é rotulada heurística e sinergia estatística fica indisponível',()=>{
  const result=recommendDraft({scenario:scenario({enemies:[]}),heroes,matchups:[]});
  const support=result.find(value=>value.heroId===5);
  assert.equal(support.roleCoverage.kind,'heuristic');
  assert.ok(support.roleCoverage.addedRoles.includes('Support'));
  assert.ok(support.explanations.some(value=>value.kind==='unavailable'&&value.text.includes('Sinergia estatística')));
  assert.equal(support.statistic,null);
});

test('store versionado persiste atomicamente e não publica falha',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dota-draft-'));
  const file=path.join(folder,'drafts.json');
  try{
    const store=createDraftStore(file);
    store.setCurrent(scenario({name:'Atual'}));
    store.save(scenario({name:'Salvo',updatedAt:2}));
    assert.equal(createDraftStore(file).get().saved[0].name,'Salvo');
    store.remove('test');
    assert.equal(store.get().saved.length,0);
    assert.throws(()=>validateDraftState({schemaVersion:2,current:scenario(),saved:[]}),/Versão/);
    const failing=createDraftStore(path.join(folder,'unused.json'),{persist:()=>{throw new Error('disco');}});
    const before=failing.get();
    assert.throws(()=>failing.save(scenario()),/disco/);
    assert.deepEqual(failing.get(),before);
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test("cenário Captain salvo reconciliado permanece corrigido após recarregar",()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dota-draft-reconcile-'));
  const file=path.join(folder,'drafts.json');
  try{
    const invalid=scenario({mode:'captains',allies:[2,99],enemies:[1],bans:[],updatedAt:2});
    fs.writeFileSync(file,JSON.stringify({schemaVersion:1,current:invalid,saved:[invalid]}),'utf8');
    const store=createDraftStore(file);
    const first=reconcileDraftScenario(store.get().saved[0],heroes);
    assert.deepEqual(first.removedHeroIds,[99]);
    store.save({...first.scenario,updatedAt:3});

    const reloaded=createDraftStore(file).get().saved[0];
    const second=reconcileDraftScenario(reloaded,heroes);
    assert.deepEqual(second.removedHeroIds,[],'reabrir não deve solicitar a mesma correção');
    assert.deepEqual(second.scenario.allies,[2]);
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
