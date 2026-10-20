#!/usr/bin/env node
'use strict';
/** Dota Open Library: read-only image coverage audit. No internet, no game modification.
 * Files in data/reports/ are regenerated; downloaded image files and manifests are NOT changed.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = path.resolve(process.argv.find(a=>a.startsWith('--data='))?.slice(7) || path.join(root,'data'));
const reports = path.join(data, 'reports');
const read = p => JSON.parse(fs.readFileSync(p,'utf8'));
const save = (p, obj) => { fs.mkdirSync(path.dirname(p),{recursive:true}); const tmp=p+`.tmp-${process.pid}`; fs.writeFileSync(tmp,JSON.stringify(obj,null,2)+'\n');fs.renameSync(tmp,p); };
const csv = v => '"'+String(v??'').replaceAll('"','""')+'"';
function safeImage(relative) {
  if(typeof relative!=='string' || !/^images\/[a-z0-9_.-]+\/[a-z0-9_.-]+\.(png|jpe?g|webp|svg)$/i.test(relative) || relative.includes('..')) return null;
  const resolved=path.resolve(data,relative);
  return resolved.startsWith(data+path.sep)?resolved:null;
}
function validate(relative) {
 const p=safeImage(relative);if(!p)return {status:'invalid-reference',bytes:0};
 let fd;
 try {
  const st=fs.statSync(p);
  if(!st.isFile() || st.size<80 || st.size>8*1024*1024)return {status:'invalid',bytes:st.size};
  fd=fs.openSync(p,'r');const buf=Buffer.alloc(Math.min(st.size,512));fs.readSync(fd,buf,0,buf.length,0);
  const ext=path.extname(p).toLowerCase();
  const ok=ext==='.png' ? buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
    ['.jpg','.jpeg'].includes(ext)?buf[0]===255&&buf[1]===216&&buf[2]===255:
    ext==='.webp'?buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP':
    ext==='.svg'?/<svg\b/i.test(buf.toString('utf8')):false;
  return {status:ok?'available':'invalid',bytes:st.size};
 }catch(e){return {status:e.code==='ENOENT'?'missing':'unreadable',bytes:0};}
 finally{if(fd!==undefined)fs.closeSync(fd);}
}
function main(){
 const manifestPath=path.join(data,'image-manifest.json');
 if(!fs.existsSync(manifestPath))throw Error('image-manifest.json não encontrado em '+data);
 const manifest=read(manifestPath);if(!Array.isArray(manifest))throw Error('O manifesto não é uma lista.');
 const relationPath=path.join(data,'raw','hero_abilities.json');
 const relations=fs.existsSync(relationPath)?read(relationPath):{};
 const heroRelations=new Map();
 for(const [hero,r] of Object.entries(relations))for(const key of r.abilities||[]) {
  if(!heroRelations.has(key))heroRelations.set(key,new Set());heroRelations.get(key).add(hero.replace(/^npc_dota_hero_/,''));
 }
 const indexes={};const entries=[],pending=[],categories={},origins={},keys=new Map();
 for(const item of manifest){
   const current=validate(item.localPath);
   const group=item.group||'outro';
   indexes[group]??={available:0,missing:0,invalid:0,total:0};indexes[group].total++;
   const state=current.status==='available'?'available':current.status==='missing'?'missing':'invalid';
   indexes[group][state]++;
   const category=group==='heroes'?'herói':group==='items'?'item':
    /^(generic_hidden|dota_base_ability|dota_empty_ability)$/.test(item.key||'')||/^(special_bonus_|.+_hidden\d+$)/.test(item.key||'')?'interno':
    group==='neutral-abilities'?'neutro':heroRelations.has(item.key)?'habilidade de herói':'outros';
   if(state!=='available')categories[category]=(categories[category]||0)+1;
   if(state==='available')origins[item.usedUrl?.startsWith('vpk-local:')?'VPK local':item.usedUrl?'download':'cache/local']=(origins[item.usedUrl?.startsWith('vpk-local:')?'VPK local':item.usedUrl?'download':'cache/local']||0)+1;
   const e={group,key:item.key,localPath:item.localPath,status:state,bytes:current.bytes,category,heroes:[...(heroRelations.get(item.key)||[])],previousStatus:item.status||null,error:state==='available'?null:item.error||null};
   entries.push(e);if(state!=='available')pending.push(e);
   if(!keys.has(item.key))keys.set(item.key,[]);keys.get(item.key).push(e);
 }
 const available=entries.filter(x=>x.status==='available').length;
 const total=entries.length;
 const uniqueKeys=new Set(entries.map(e=>e.key));
 const pendingUnique=new Set(pending.map(e=>e.key));
 const summary={generatedAt:new Date().toISOString(),source:'image-manifest.json + arquivos locais',entries:total,available,missing:total-available,coveragePct:total?+(100*available/total).toFixed(2):0,uniqueKeys:uniqueKeys.size,missingUniqueKeys:pendingUnique.size,pendingDuplicateReferences:pending.length-pendingUnique.size,groups:indexes,pendingCategories:categories,availableOrigins:origins,heroRelationsLoaded:fs.existsSync(relationPath),imageFilesModified:false};
 fs.mkdirSync(reports,{recursive:true});
 save(path.join(reports,'image-health.json'),{summary,entries});
 save(path.join(reports,'missing-images-current.json'),pending);
 const csvLines=[['grupo','chave','categoria','herois','status','arquivo','erro anterior'].map(csv).join(';')];
 for(const e of pending)csvLines.push([e.group,e.key,e.category,e.heroes.join(','),e.status,e.localPath,e.error].map(csv).join(';'));
 fs.writeFileSync(path.join(reports,'missing-images-current.csv'),'\ufeff'+csvLines.join('\n')+'\n','utf8');
 console.log('DOTA OPEN LIBRARY — CONSOLIDAÇÃO');
 console.log(JSON.stringify(summary,null,2));
 console.log('Relatórios: data/reports/image-health.json, missing-images-current.json e missing-images-current.csv');
 console.log('Nenhuma imagem, catálogo ou manifesto original foi alterado.');
}
try{main();}catch(e){console.error('ERRO:',e.message);process.exitCode=1;}
