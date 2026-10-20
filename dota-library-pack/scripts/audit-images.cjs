#!/usr/bin/env node
'use strict';
/** Auditoria e tentativa seletiva de recuperacao de imagens Dota 2.
 * Nunca apaga imagens existentes, nem le aplicativo proprietario.
 * --recover faz apenas GET de caminhos historicos publicos da Valve.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root,'data');
const reportDir = path.join(dataDir,'reports');
const missingFile = path.join(reportDir,'missing-images.json');
const indexFile = path.join(dataDir,'image-manifest.json');
const manifestFile = path.join(dataDir,'manifest.json');
const args = process.argv.slice(2);
const get = prefix => args.find(x => x.startsWith(prefix))?.slice(prefix.length);
const recover = args.includes('--recover');
const all = args.includes('--all');
const limit = all ? Number.MAX_SAFE_INTEGER : Math.max(1,Math.min(500,Number(get('--limit=')) || 25));
const timeout = Math.max(3000,Math.min(20000,Number(get('--timeout=')) || 6500));
const only = get('--only=') || null;
const concurrency = Math.max(1,Math.min(3,Number(get('--concurrency=')) || 2));

function loadJson(p, fallback) {try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){if(fallback!==undefined)return fallback;throw new Error(`Falha ao ler ${p}: ${e.message}`);}}
function writeJson(p,data){fs.mkdirSync(path.dirname(p),{recursive:true});const t=p+`.tmp-${process.pid}`;fs.writeFileSync(t,JSON.stringify(data,null,2)+'\n','utf8');fs.renameSync(t,p);}
function safePath(p){if(typeof p!=='string'||!/^images\/[a-zA-Z0-9_./-]+\.png$/.test(p)||p.includes('..'))throw new Error('Caminho de imagem invalido: '+p);return path.join(dataDir,p);}
function isPng(b){return b.length>80&&b.length<=8*1024*1024&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));}
function simpleHero(h){return h.replace(/^npc_dota_hero_/,'');}
function getHeroLinks(){
  const p=path.join(dataDir,'raw','hero_abilities.json');
  const local=loadJson(p,{});const links=new Map();
  for(const [hero,r] of Object.entries(local)) for(const key of r.abilities||[]){
    if(!links.has(key))links.set(key,new Set()); links.get(key).add(simpleHero(hero));
  }
  return {links,found:fs.existsSync(p)};
}
function typeOf(key,isNeutral,links){
  if(key==='generic_hidden'||/^(dota_base_ability|dota_empty_ability|bear_empty\d+|consumable_hidden|AbilityCastPoint|AbilityCastAnimation)$/.test(key)||/_hidden\d+$/.test(key))return 'interno/placeholder';
  if(links.has(key))return 'heroi';
  if(isNeutral)return 'neutro';
  if(/^(seasonal_|greevil_|cny|deity_|plus_|ad_special_bonus_|roshan_halloween_)/.test(key))return 'sazonal/evento';
  if(/^(courier_|creep_|roshan_|miniboss_|neutral_|frogmen_|ability_)/.test(key))return 'sistema/unidade';
  return 'outros/verificar';
}
function makeReport(missing,links,localRelations){
  const groups=new Map();
  for(const row of missing){
    if(!row||typeof row.key!=='string')continue;
    if(!groups.has(row.key))groups.set(row.key,{key:row.key, entries:[], neutral:false});
    const target=groups.get(row.key);
    target.entries.push(row);if(row.group==='neutral-abilities')target.neutral=true;
  }
  const rows=[...groups.values()].map(r=>({key:r.key,category:typeOf(r.key,r.neutral,links),heroes:[...(links.get(r.key)||[])].sort(),groups:[...new Set(r.entries.map(x=>x.group))],failedReferences:r.entries.length,lastErrors:[...new Set(r.entries.map(x=>x.error).filter(Boolean))]}));
  const priorities={'heroi':0,'neutro':1,'outros/verificar':2,'sistema/unidade':3,'sazonal/evento':4,'interno/placeholder':5};
  rows.sort((a,b)=>(priorities[a.category]-priorities[b.category])||a.key.localeCompare(b.key));
  const categories={};for(const r of rows)categories[r.category]=(categories[r.category]||0)+1;
  const summary={generatedAt:new Date().toISOString(),missingReferences:missing.length,uniqueKeys:rows.length,duplicates:missing.length-rows.length,
   allLastErrors404:missing.every(x=>/^HTTP 404/.test(x.error||'')),heroRelationsLocal:localRelations, categories,
   note:localRelations?'Classificacao por relacoes de herois presentes no seu dotaconstants local.':'Sem data/raw/hero_abilities.json; classificacao de herois incompleta. Rode build-library.cjs e repita.'};
  return {rows,summary};
}
const field=s=>'"'+String(s??'').replaceAll('"','""')+'"';
function saveReport({rows,summary}){
 writeJson(path.join(reportDir,'image-audit.json'),{summary,rows});
 const csv=[['chave','categoria','herois','grupos','falhas','erros'].map(field).join(';')];
 for(const r of rows)csv.push([r.key,r.category,r.heroes.join(','),r.groups.join(','),r.failedReferences,r.lastErrors.join(' | ')].map(field).join(';'));
 fs.writeFileSync(path.join(reportDir,'image-audit.csv'),'\ufeff'+csv.join('\n')+'\n','utf8');
}
function urls(key){
  if(!/^[a-z0-9_]+$/i.test(key))return [];
  // Formatos historicos de icones Valve. A existencia nao e garantida.
  const base=`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/abilities/${key}`;
  return [`${base}_md.png`,`${base}_lg.png`,`${base}_hp2.png`];
}
async function tryRecover(row){
  let attempts=0;const errors=[];
  for(const url of urls(row.key)){
    attempts++;
    try {
      const r=await fetch(url,{signal:AbortSignal.timeout(timeout),headers:{'User-Agent':'DotaOpenLibraryImageAudit/1.2'}});
      if(!r.ok){errors.push('HTTP '+r.status);continue;}
      const ct=(r.headers.get('content-type')||'').toLowerCase();
      if(!ct.startsWith('image/')){errors.push('tipo nao imagem');continue;}
      const len=Number(r.headers.get('content-length'));
      if(len>8*1024*1024){errors.push('arquivo grande');continue;}
      const b=Buffer.from(await r.arrayBuffer());if(!isPng(b)){errors.push('PNG invalido');continue;}
      const dests=row.groups.map(g=>`images/${g}/${row.key}-icon.png`);
      for(const rel of dests){const dest=safePath(rel);fs.mkdirSync(path.dirname(dest),{recursive:true});
        if(fs.existsSync(dest)&&isPng(fs.readFileSync(dest)))continue;
        const temp=dest+`.part-${process.pid}`;fs.writeFileSync(temp,b);fs.renameSync(temp,dest);
      }
      return {key:row.key,success:true,url,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),attempts,groups:row.groups};
    }catch(e){errors.push(String(e.message||e));}
  }
  return {key:row.key,success:false,attempts,errors};
}
async function recoverImages(report, allIndex){
  const candidates=report.rows.filter(r=>r.category!=='interno/placeholder'&&(!only||r.key.includes(only))).slice(0,limit);
  console.log(`Recuperacao experimental: ${candidates.length} habilidades unicas; concorrencia ${concurrency}; limite ${timeout}ms/URL`);
  let next=0,done=0;const recovered=[];const unsuccessful=[];
  await Promise.all(Array.from({length:concurrency},async()=>{
    while(next<candidates.length){const c=candidates[next++];const result=await tryRecover(c);done++;
      if(result.success)recovered.push(result);else unsuccessful.push(result);
      if(done%10===0||done===candidates.length)console.log(`${done}/${candidates.length} verificadas; ${recovered.length} recuperadas`);
    }
  }));
  if(!recovered.length){writeJson(path.join(reportDir,'image-recovery.json'),{recovered,unsuccessful,checked:candidates.length});
    console.log('Nenhuma imagem recuperada. Nenhum manifesto/imagem existente alterado.');return;}
  const found=new Map(recovered.map(x=>[x.key,x]));
  for(const e of allIndex){const match=found.get(e.key);if(!match||!match.groups.includes(e.group))continue;
    const file=safePath(e.localPath);if(!fs.existsSync(file)||!isPng(fs.readFileSync(file)))continue;
    e.status='saved';e.bytes=fs.statSync(file).size;e.sha256=match.sha256;e.error=null;e.usedUrl=match.url;e.attempts=(e.attempts||0)+match.attempts;
    e.candidateUrls=[...new Set([...(e.candidateUrls||[]),match.url])];
  }
  writeJson(indexFile,allIndex);
  const stillMissing=allIndex.filter(x=>x.status==='failed'||x.status==='pending');writeJson(missingFile,stillMissing);
  const counts={};for(const e of allIndex)counts[e.status]=(counts[e.status]||0)+1;
  const m=loadJson(manifestFile,null);if(m){m.imageResults=counts;m.imagesDownloaded=true;writeJson(manifestFile,m);}
  const failureReasons={};for(const e of stillMissing){const k=e.error||'desconhecido';failureReasons[k]=(failureReasons[k]||0)+1;}
  writeJson(path.join(reportDir,'download-summary.json'),{counts,failedReasons:failureReasons});
  writeJson(path.join(reportDir,'image-recovery.json'),{recovered,unsuccessful,checked:candidates.length});
  console.log(`RECUPERADAS: ${recovered.length} habilidades unicas; novas referencias pendentes: ${stillMissing.length}`);
}
async function main(){
 if(!fs.existsSync(missingFile))throw new Error('Falta data/reports/missing-images.json. Confira a pasta do projeto.');
 const missing=loadJson(missingFile),allIndex=loadJson(indexFile,[]);
 if(!Array.isArray(missing))throw new Error('Relatorio de imagens nao e uma lista.');
 const {links,found}=getHeroLinks();const report=makeReport(missing,links,found);saveReport(report);
 console.log('Auditoria:',JSON.stringify(report.summary,null,2));
 console.log('Relatorio:',path.join(reportDir,'image-audit.csv'));
 if(!recover)return;
 if(!fs.existsSync(indexFile)||!allIndex.length)throw new Error('image-manifest.json ausente; nao e seguro registrar downloads.');
 await recoverImages(report,allIndex);
 // Recomputa a auditoria local com as referencias realmente restantes.
 const remaining=loadJson(missingFile);saveReport(makeReport(remaining,links,found));
}
main().catch(e=>{console.error('ERRO:',e.message);process.exitCode=1;});
