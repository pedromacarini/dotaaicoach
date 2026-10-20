#!/usr/bin/env node
'use strict';
/** Biblioteca independente, originada exclusivamente do pacote publico odota/dotaconstants.
 * Nunca le ou copia dados do Aura. Imagens sao opcionais e direitos permanecem com os titulares.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
const arg = (prefix) => args.find(a => a.startsWith(prefix))?.slice(prefix.length);
const opts = {
  images: args.includes('--download-images') || args.includes('--retry-missing'),
  source: arg('--source='), output: arg('--output='),
  concurrency: Math.min(8, Math.max(1, Number(arg('--concurrency=')) || 4)),
  timeout: Math.min(30000, Math.max(3000, Number(arg('--timeout=')) || 12000)),
};
const root = path.resolve(__dirname, '..');
const source = path.resolve(opts.source || process.env.DOTA_CONSTANTS_BUILD || path.join(process.cwd(),'node_modules','dotaconstants','build'));
const output = path.resolve(opts.output || path.join(root, 'data'));
const rawdir = path.join(output, 'raw');
const catdir = path.join(output, 'catalogs');
const imgdir = path.join(output, 'images');
const reportdir = path.join(output, 'reports');
function ensure(dir) { fs.mkdirSync(dir,{recursive:true}); }
function json(name,data) { fs.writeFileSync(path.join(catdir, `${name}.json`),JSON.stringify(data,null,2)+'\n','utf8'); }
function read(name,fallback) {
  try{return JSON.parse(fs.readFileSync(path.join(source,`${name}.json`),'utf8'));}
  catch(e){if(fallback!==undefined)return fallback;throw new Error(`Sem dataset ${name}.json: ${e.message}`);}
}
function slug(v){return String(v).replace(/[^a-z0-9_.-]/gi,'_').slice(0,160);}
function humanize(v){return String(v).replace(/^special_bonus_(unique_)?/,'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
function display(raw,key){
  if(typeof raw==='string' && raw.trim() && !/\{[^}]+\}|\$\{|<[^>]+>|^-\{/.test(raw)) return raw.trim();
  return humanize(key);
}
function validUrl(raw){
  if(typeof raw!=='string' || !raw.trim())return null;
  const s=raw.trim();
  try{
    let u;
    if(s.startsWith('/apps/dota2/images/'))u=new URL(`https://cdn.cloudflare.steamstatic.com${s}`);
    else if(s.startsWith('/assets/images/dota2/'))u=new URL(`https://www.opendota.com${s}`);
    else if(/^https:\/\//i.test(s))u=new URL(s);
    else return null;
    if(!['cdn.cloudflare.steamstatic.com','cdn.akamai.steamstatic.com','www.opendota.com','cdn.steamstatic.com'].includes(u.hostname))return null;
    u.search='';u.hash='';return u.toString();
  }catch{return null;}
}
const media=new Map();
function candidatesFor(group,key,src){
  const main=validUrl(src);
  const urls=[];
  if(main)urls.push(main);
  // Alternativas sao tentativas, NAO evidencias de que cada imagem exista no CDN.
  if(group==='neutral-abilities' && /^[a-z0-9_]+$/i.test(key)){
    const val=`/apps/dota2/images/dota_react/abilities/${key}.png`;
    const u=validUrl(val);if(u)urls.push(u);
  }
  if(main?.startsWith('https://cdn.cloudflare.steamstatic.com/apps/dota2/images/')){
    urls.push(main.replace('cdn.cloudflare.steamstatic.com','cdn.akamai.steamstatic.com'));
  }
  return [...new Set(urls)];
}
function asset(group,key,kind,src){
  const candidates=candidatesFor(group,key,src);
  if(!candidates.length)return {sourceUrl:src||null,localPath:null,status:'unavailable-source'};
  const ext=path.extname(new URL(candidates[0]).pathname).toLowerCase();
  if(!['.png','.jpg','.jpeg','.webp','.svg'].includes(ext))return {sourceUrl:candidates[0],localPath:null,status:'unsupported-extension'};
  const rel=`images/${group}/${slug(key)}-${kind}${ext}`;
  if(!media.has(rel))media.set(rel,{group,key,kind,sourceUrl:candidates[0],candidateUrls:candidates,localPath:rel,status:'pending',bytes:null,sha256:null,usedUrl:null,error:null,attempts:0});
  return {sourceUrl:candidates[0],localPath:rel,status:'download-optional'};
}
function signatureOk(buf,ext){
  if(buf.length<80 || buf.length>8*1024*1024)return false;
  if(ext==='.png')return buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(ext==='.jpg'||ext==='.jpeg')return buf[0]===255 && buf[1]===216 && buf[2]===255;
  if(ext==='.webp')return buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP';
  if(ext==='.svg')return /<svg\b/i.test(buf.toString('utf8',0,500));
  return false;
}
function cache(entry){
  const dest=path.join(output,entry.localPath);
  if(!fs.existsSync(dest))return false;
  try{
    const b=fs.readFileSync(dest);
    if(!signatureOk(b,path.extname(dest).toLowerCase()))return false;
    entry.bytes=b.length;entry.sha256=crypto.createHash('sha256').update(b).digest('hex');entry.status='cached';entry.error=null;return true;
  }catch{return false;}
}
async function download(entry){
  if(cache(entry))return;
  const file=path.join(output,entry.localPath);ensure(path.dirname(file));
  let last='Imagem não encontrada';
  for(const url of entry.candidateUrls){
    for(let attempt=1;attempt<=2;attempt++){
      entry.attempts++;
      try{
        const res=await fetch(url,{signal:AbortSignal.timeout(opts.timeout),headers:{'User-Agent':'DotaOpenLibrary/1.1 (offline catalog builder)'}});
        if(!res.ok){last=`HTTP ${res.status}: ${new URL(url).hostname}`;if([400,401,403,404,410].includes(res.status))break;continue;}
        const type=(res.headers.get('content-type')||'').toLowerCase();
        if(!type.startsWith('image/')){last=`Conteúdo não é imagem (${type || 'sem content-type'})`;break;}
        const len=Number(res.headers.get('content-length'));
        if(len>8*1024*1024){last='Imagem supera 8 MB';break;}
        const b=Buffer.from(await res.arrayBuffer());
        if(!signatureOk(b,path.extname(file).toLowerCase())){last='Assinatura/tamanho da imagem inválido';break;}
        const temp=file+`.part-${process.pid}`;
        fs.writeFileSync(temp,b);fs.renameSync(temp,file);
        entry.bytes=b.length;entry.sha256=crypto.createHash('sha256').update(b).digest('hex');entry.usedUrl=url;entry.error=null;entry.status='saved';return;
      }catch(e){last=e.message||String(e);}
    }
  }
  entry.status='failed';entry.error=last;
}
async function downloadAll(entries){
  let next=0,done=0;
  const workers=Array.from({length:opts.concurrency},async()=>{
    while(next<entries.length){
      const index=next++;
      await download(entries[index]);done++;
      if(done%90===0 || done===entries.length)console.log(`Imagens verificadas: ${done}/${entries.length}`);
      if(entries[index].status==='failed')await new Promise(resolve=>setTimeout(resolve,100));
    }
  });
  await Promise.all(workers);
}
async function main(){
  if(!fs.existsSync(source))throw new Error(`Pacote dotaconstants não localizado: ${source}\nExecute npm install na pasta principal, ou informe --source=C:/.../node_modules/dotaconstants/build`);
  for(const d of [output,rawdir,catdir,imgdir,reportdir])ensure(d);
  const files=fs.readdirSync(source).filter(x=>x.endsWith('.json'));
  for(const name of files)fs.copyFileSync(path.join(source,name),path.join(rawdir,name));
  const heroes=read('heroes',{}),items=read('items',{}),abilities=read('abilities',{}),relations=read('hero_abilities',{}),neutral=read('neutral_abilities',{});
  const lore=read('hero_lore',{}),aghs=read('aghs_desc',[]);
  const aghById=new Map((Array.isArray(aghs)?aghs:[]).map(x=>[x.hero_id,x]));
  const abilityCatalog=Object.entries(abilities).map(([key,a])=>({
    key,id:a.id??null,name:display(a.dname,key),rawName:a.dname||null,description:a.desc||null,
    notes:a.notes||null,attributes:a.attrib||[],behavior:a.bdesc||a.behavior||null,
    damageType:a.dmg_type||null,cooldown:a.cd??null,manaCost:a.mc??null,raw:a,
    isTechnical:key==='generic_hidden'||key.startsWith('special_bonus_'),
    image:asset('abilities',key,'icon',a.img),
  }));
  const abilityByKey=new Map(abilityCatalog.map(a=>[a.key,a]));
  const heroCatalog=Object.entries(heroes).map(([key,h])=>{
    const inner=h.name||key,alias=inner.replace(/^npc_dota_hero_/,'');const rel=relations[inner]||{};
    const makeLink=(abilityKey,tier)=>{
      const a=abilityByKey.get(abilityKey);
      return {key:abilityKey,name:a?.name||humanize(abilityKey),description:a?.description||null,
        cooldown:a?.cooldown??null,manaCost:a?.manaCost??null,
        image:a?.image||{sourceUrl:null,localPath:null,status:'unavailable-source'},
        ...(tier===undefined?{}:{tier})};
    };
    return {
      id:h.id,internalName:inner,name:h.localized_name||humanize(alias),primaryAttribute:h.primary_attr||null,
      attackType:h.attack_type||null,roles:h.roles||[],attributes:h,
      lore:lore[alias]||null,scepterShard:aghById.get(h.id)||null,
      abilities:(rel.abilities||[]).filter(a=>a!=='generic_hidden').map(a=>makeLink(a)),
      talents:(rel.talents||[]).filter(t=>t?.name).map(t=>makeLink(t.name,t.level)),
      facets:rel.facets||[],images:{portrait:asset('heroes',alias,'portrait',h.img),icon:asset('heroes',alias,'icon',h.icon)}
    };
  });
  const itemCatalog=Object.entries(items).map(([key,i])=>({
    key,id:i.id??null,name:display(i.dname,key),cost:i.cost??null,category:i.qual??null,
    components:i.components||[],attributes:i.attrib||[],effects:i.abilities||[],
    cooldown:i.cd??null,manaCost:i.mc??null,description:i.desc||null,notes:i.notes||null,raw:i,
    image:asset('items',key,'icon',i.img)
  }));
  const neutralCatalog=Object.entries(neutral).map(([key,n])=>{
    const a=abilityByKey.get(key);
    return {key,name:a?.name||humanize(key),description:a?.description||null,
      cooldown:a?.cooldown??null,manaCost:a?.manaCost??null,
      attributes:a?.attributes||[],raw:n,image:asset('neutral-abilities',key,'icon',n.img)};
  });
  json('heroes',heroCatalog);json('items',itemCatalog);json('abilities',abilityCatalog);json('neutral-abilities',neutralCatalog);json('hero-abilities',relations);
  const entries=[...media.values()];
  console.log(`Dados copiados: ${files.length} arquivos JSON.`);
  console.log(`Registros: ${heroCatalog.length} heróis, ${itemCatalog.length} itens, ${abilityCatalog.length} habilidades, ${neutralCatalog.length} habilidades neutras.`);
  console.log(`URLs de imagens reconhecidas: ${entries.length}.`);
  if(opts.images)await downloadAll(entries);
  else for(const e of entries)cache(e);
  const states={};for(const e of entries)states[e.status]=(states[e.status]||0)+1;
  const history=read('patch',[]);const latestPatchInSource=Array.isArray(history)&&history.length?history.at(-1)?.name||null:null;
  const manifest={schemaVersion:2,generatedAt:new Date().toISOString(),source:'odota/dotaconstants',latestPatchInSource,
    sourceVersion:(()=>{try{return JSON.parse(fs.readFileSync(path.join(source,'..','package.json'),'utf8')).version;}catch{return null;}})(),
    sourcePath:source,sourceNote:'Snapshot local do dotaconstants. Dados e artes podem estar defasados e pertencem aos titulares.',
    totals:{rawJsonFiles:files.length,heroes:heroCatalog.length,items:itemCatalog.length,abilities:abilityCatalog.length,
      heroAbilityRelations:Object.keys(relations).length,neutralAbilities:neutralCatalog.length,imagesIndexed:entries.length},
    imageResults:states,imagesDownloaded:opts.images};
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
  fs.writeFileSync(path.join(output,'image-manifest.json'),JSON.stringify(entries,null,2));
  fs.writeFileSync(path.join(reportdir,'missing-images.json'),JSON.stringify(entries.filter(x=>x.status==='failed'||x.status==='pending'),null,2));
  const failureReasons={};for(const e of entries.filter(e=>e.status==='failed')){const k=e.error||'desconhecido';failureReasons[k]=(failureReasons[k]||0)+1;}
  fs.writeFileSync(path.join(reportdir,'download-summary.json'),JSON.stringify({counts:states,failedReasons:failureReasons},null,2));
  fs.writeFileSync(path.join(output,'README.md'),[
    '# Dota 2 — biblioteca local','',`Origem: ${manifest.source}. Gerada em ${manifest.generatedAt}.`,'',
    '- raw/: dados JSON do pacote dotaconstants.','- catalogs/: catálogos normalizados, incluindo ícones nas habilidades dos heróis.',
    '- images/: imagens locais. Nunca são apagadas pelo gerador.','- reports/: faltas e erros de download por arquivo.','',
    'A licença MIT do gerador não concede direitos sobre conteúdo e imagens da Valve.'
  ].join('\n')+'\n','utf8');
  console.log('Biblioteca pronta em:',output);console.log('Status das imagens:',states);
}
main().catch(e=>{console.error('ERRO:',e.message);process.exitCode=1;});
