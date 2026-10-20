#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {makeServer}=require('./serve-library.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 for(const filename of ['viewer/index.html','viewer/app.js','viewer/style.css','data/manifest.json','data/catalogs/heroes.json','data/catalogs/items.json','data/catalogs/abilities.json','data/catalogs/neutral-abilities.json']){
  assert.ok(fs.existsSync(path.join(root,filename)),`Arquivo ausente: ${filename}`);
 }
 const heroes=JSON.parse(fs.readFileSync(path.join(root,'data/catalogs/heroes.json'),'utf8'));
 assert.ok(Array.isArray(heroes)&&heroes.length>0,'Catálogo de heróis vazio');
 assert.ok(heroes.some(h=>Array.isArray(h.abilities)),'Dados de habilidades não relacionados aos heróis');
 let calls=0;
 const server=makeServer({base:root,remoteFetch:async url=>{calls++;return {ok:true,json:async()=>url.includes('matchups')?[{hero_id:2,games_played:55,wins:30}]:{start_game_items:{1:99}}};}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port;
  const page=await fetch(url+'/');assert.equal(page.status,200);
  const html=await page.text();assert.ok(html.includes('Dota Open Library'));
  for(const file of ['/app.js','/style.css','/data/manifest.json']){assert.equal((await fetch(url+file)).status,200,file);}
  const r1=await fetch(url+'/api/opendota/heroes/1/itemPopularity');assert.equal(r1.status,200);assert.equal((await r1.json()).data.start_game_items['1'],99);
  const r2=await fetch(url+'/api/opendota/heroes/1/itemPopularity');assert.equal((await r2.json()).cached,true);assert.equal(calls,1,'Cache não reutilizado');
  const r3=await fetch(url+'/api/opendota/heroes/1/matchups');assert.equal((await r3.json()).data[0].wins,30);
  assert.equal((await fetch(url+'/api/opendota/heroes/1/nao-existe')).status,404);
  assert.equal((await fetch(url+'/api/opendota/heroes/1/matchups',{method:'POST'})).status,405);
  console.log(`OK: catálogos (${heroes.length} heróis), arquivos estáticos, API simulada, cache, validação de rotas.`);
  console.log('Atenção: este teste não acessa a API real e não valida dados ao vivo.');
 } finally{await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error('FALHA:',e.message);process.exitCode=1;});
