'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const root=path.resolve(__dirname,'..');
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'dota-library-'));
const source=path.join(fixture,'package','build');
const output=path.join(fixture,'out');
fs.mkdirSync(source,{recursive:true});
function write(name,v){fs.writeFileSync(path.join(source,`${name}.json`),JSON.stringify(v));}
fs.writeFileSync(path.join(fixture,'package','package.json'),JSON.stringify({version:'test-1.0'}));
write('heroes',{'1':{id:1,name:'npc_dota_hero_antimage',localized_name:'Anti-Mage',primary_attr:'agi',attack_type:'Melee',roles:['Carry'],move_speed:310,img:'/apps/dota2/images/dota_react/heroes/antimage.png',icon:'/apps/dota2/images/dota_react/heroes/icons/antimage.png'}});
write('items',{blink:{id:1,dname:'Blink Dagger',img:'/apps/dota2/images/dota_react/items/blink.png',cost:2250}});
write('abilities',{antimage_blink:{id:100,dname:'Blink',desc:'Blink to a position.',cd:12,mc:50,img:'/apps/dota2/images/dota_react/abilities/antimage_blink.png'},generic_hidden:{dname:'Hidden'},special_bonus_unique_kunkka_ghostship_cooldown:{dname:'-{s:bonus_AbilityCooldown} Ghostship Cooldown'},kobold_tunneler_prospecting:{dname:'Prospecting',desc:'Some ability'}});
write('neutral_abilities',{kobold_tunneler_prospecting:{img:'/assets/images/dota2/neutral_abilities/kobold_tunneler_prospecting.png'}});
write('hero_abilities',{npc_dota_hero_antimage:{abilities:['antimage_blink','generic_hidden'],talents:[{name:'special_bonus_unique_kunkka_ghostship_cooldown',level:1}],facets:[{name:'facet_one',description:'Facet description'}]}});
write('hero_lore',{antimage:'Some lore'});
write('aghs_desc',[]);write('patch',[{name:'7.41'}]);
const script=path.join(root,'scripts','build-library.cjs');
function run(){return execFileSync(process.execPath,[script,`--source=${source}`,`--output=${output}`],{encoding:'utf8'});}
test('gera catálogos e associa imagens às habilidades dos heróis',()=>{
 const out=run();assert.match(out,/Registros: 1 heróis, 1 itens, 4 habilidades, 1 habilidades neutras/);
 const h=JSON.parse(fs.readFileSync(path.join(output,'catalogs','heroes.json')))[0];
 assert.equal(h.abilities.length,1);
 assert.equal(h.abilities[0].key,'antimage_blink');
 assert.equal(h.abilities[0].description,'Blink to a position.');
 assert.match(h.abilities[0].image.localPath,/images\/abilities\/antimage_blink-icon.png/);
 assert.equal(h.talents.length,1);
 assert.equal(h.talents[0].name,'Kunkka Ghostship Cooldown');
 const n=JSON.parse(fs.readFileSync(path.join(output,'catalogs','neutral-abilities.json')))[0];
 assert.equal(n.description,'Some ability');
 const entries=JSON.parse(fs.readFileSync(path.join(output,'image-manifest.json')));
 assert.equal(entries.filter(e=>e.key==='antimage_blink').length,1);
 assert.equal(entries.find(e=>e.key==='kobold_tunneler_prospecting').candidateUrls.length,2);
 const state=JSON.parse(fs.readFileSync(path.join(output,'manifest.json')));
 assert.equal(state.sourceVersion,'test-1.0');
 assert.equal(state.imageResults.pending,5);
});
test('reutiliza imagens sem sobrescrever e registra status cached',()=>{
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(110)]);
 const dest=path.join(output,'images','abilities','antimage_blink-icon.png');
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,png);
 const before=fs.readFileSync(dest);
 run();
 assert.deepEqual(fs.readFileSync(dest),before);
 const states=JSON.parse(fs.readFileSync(path.join(output,'image-manifest.json')));
 const ability=states.find(x=>x.key==='antimage_blink');
 assert.equal(ability.status,'cached');
 assert.equal(ability.bytes,png.length);
});
test('JavaScript do visualizador é válido',()=>{
 const html=fs.readFileSync(path.join(root,'viewer','index.html'),'utf8');
 const scriptSrc=html.match(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/i)?.[1];
 assert.equal(scriptSrc,'/app.js','HTML deve carregar o JavaScript externo do visualizador');
 const js=fs.readFileSync(path.join(root,'viewer',scriptSrc.replace(/^\/+/,'')),'utf8');
 assert.doesNotThrow(()=>new Function(js));
 assert.match(js,/renderAbility/);
});
process.on('exit',()=>fs.rmSync(fixture,{recursive:true,force:true}));
test('recupera icone neutro com tentativa alternativa e preserva arte local',()=>{
 const fs=require('node:fs');const child=require('node:child_process');
 const mock=path.join(fixture,'fake-fetch.cjs');
 fs.writeFileSync(mock,`
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(120)]);
 globalThis.fetch=async function(url){
   const s=String(url);
   if(s.includes('www.opendota.com'))return new Response('not found',{status:404});
   return new Response(png,{status:200,headers:{'content-type':'image/png'}});
 };
 `);
 const out=child.execFileSync(process.execPath,['--require',mock,script,`--source=${source}`,`--output=${output}`,'--retry-missing','--concurrency=2','--timeout=3000'],{encoding:'utf8'});
 assert.match(out,/Biblioteca pronta/);
 const neutral=JSON.parse(fs.readFileSync(path.join(output,'image-manifest.json'))).find(x=>x.key==='kobold_tunneler_prospecting');
 assert.equal(neutral.status,'saved');
 assert.match(neutral.usedUrl,/dota_react\/abilities\/kobold_tunneler_prospecting\.png/);
 assert.ok(fs.existsSync(path.join(output,neutral.localPath)));
 assert.ok(fs.existsSync(path.join(output,'reports','download-summary.json')));
});
