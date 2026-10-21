#!/usr/bin/env node
'use strict';
/**
 * Dota Open Library – recuperação local e seletiva de ícones via VPK (v1.3).
 * Somente lê os arquivos da instalação Dota 2; não inclui texturas licenciadas.
 * Node.js >=20. Exportação PNG necessita Source2Viewer-CLI (ValveResourceFormat),
 * mantido localmente em .local/arquivo/raiz/Source2Viewer-CLI.exe.
 * Execute a partir do projeto: node .\dota-library-pack\scripts\recover-vpk-icons.cjs --vpk="X:\...\pak01_dir.vpk"
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const argv=process.argv.slice(2);
const has = key=>argv.includes(key);
const val = key=>argv.find(x=>x.startsWith(key+'='))?.slice(key.length+1);
const dataDir=path.resolve(__dirname,'..','data');
const reportDir=path.join(dataDir,'reports');
const missingPath=path.join(reportDir,'missing-images.json');
const manifestPath=path.join(dataDir,'image-manifest.json');
const catalogManifestPath=path.join(dataDir,'manifest.json');
const dirPath=path.resolve(val('--vpk') || process.env.DOTA_VPK || '');
const cliPath=val('--cli') || process.env.SOURCE2VIEWER_CLI;
const doRecover=has('--recover');
const all=has('--all');
const max=Math.min(500,Math.max(1,Number(val('--limit')) || 10));
const allowVariants=has('--include-variants');
const canOverwrite=false;
const INDEX_MAGIC=0x55AA1234;
const EXT_PATTERN=/^panorama\/images\/spellicons\/([a-z0-9_/.-]+)_png\.vtex_c$/i;
const pngSig=Buffer.from([137,80,78,71,13,10,26,10]);
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function save(p,obj){fs.mkdirSync(path.dirname(p),{recursive:true});const temp=p+`.tmp-${process.pid}`;fs.writeFileSync(temp,JSON.stringify(obj,null,2)+'\n');fs.renameSync(temp,p);}
function isPng(p){try{const st=fs.statSync(p);if(st.size<80||st.size>8*1024*1024)return false;const h=Buffer.alloc(8);const fd=fs.openSync(p,'r');try{fs.readSync(fd,h,0,8,0);}finally{fs.closeSync(fd);}return h.equals(pngSig);}catch{return false;}}
function walk(dir){let a=[];if(!fs.existsSync(dir))return a;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const t=path.join(dir,e.name);if(e.isDirectory())a=a.concat(walk(t));else if(e.isFile())a.push(t);}return a;}
function qCsv(v){return '"'+String(v??'').replaceAll('"','""')+'"';}
function archiveFile(p,i){const m=path.basename(p).match(/^(.*)_dir\.vpk$/i);if(!m)throw Error('Use um arquivo *_dir.vpk.');return path.join(path.dirname(p),`${m[1]}_${String(i).padStart(3,'0')}.vpk`);}
function inspectVpk(p){
 const b=fs.readFileSync(p);if(b.length<28)throw Error('VPK incompleto.');
 const sig=b.readUInt32LE(0),version=b.readUInt32LE(4),treeSize=b.readUInt32LE(8);
 if(sig!==INDEX_MAGIC||version!==2)throw Error(`Cabeçalho VPK não suportado: sig=${sig.toString(16)} version=${version}`);
 let cursor=28;const end=cursor+treeSize;
 if(end>b.length)throw Error('Índice VPK truncado.');
 const exactMap=new Map(),folderFiles=new Map();let n=0;
 function readStr(){let z=b.indexOf(0,cursor);if(z<0||z>=end)throw Error('Fim inesperado do índice.');const t=b.toString('utf8',cursor,z);cursor=z+1;return t;}
 for(;;){const ext=readStr();if(!ext)break;
  for(;;){const folder=readStr();if(!folder)break;
   for(;;){const filename=readStr();if(!filename)break;
    if(cursor+18>end)throw Error('Entrada truncada.');
    const crc=b.readUInt32LE(cursor),preload=b.readUInt16LE(cursor+4),archiveIndex=b.readUInt16LE(cursor+6),offset=b.readUInt32LE(cursor+8),length=b.readUInt32LE(cursor+12),terminator=b.readUInt16LE(cursor+16);
    if(terminator!==0xFFFF)throw Error(`Marcador inválido em ${cursor}.`);
    cursor+=18+preload;n++;
    const f=folder===' '?'':folder;const key=(f?f+'/':'')+filename+'.'+ext;
    // Só armazena ícones do jogo, não as 388 mil entradas.
    if(!key.toLowerCase().startsWith('panorama/images/spellicons/'))continue;
    if(ext.toLowerCase()!=='vtex_c')continue;
    const e={path:key,archiveIndex,archiveFile:archiveIndex===0x7fff?p:archiveFile(p,archiveIndex),offset,length,crc};
    exactMap.set(key.toLowerCase(),e);
    const basename=filename.toLowerCase();
    if(!folderFiles.has(basename))folderFiles.set(basename,[]);
    folderFiles.get(basename).push(e);
   }
  }
 }
 if(cursor!==end)throw Error('Leitura do índice não terminou no final esperado.');
 return {exactMap,folderFiles,entries:n,spellIcons:exactMap.size};
}
function generate(missing,index){
 const grouped=new Map();
 for(const entry of missing){if(!entry||typeof entry.key!=='string'||typeof entry.localPath!=='string')continue;
  if(!grouped.has(entry.key))grouped.set(entry.key,{key:entry.key,groups:[],targets:[]});
  const item=grouped.get(entry.key);if(!item.groups.includes(entry.group))item.groups.push(entry.group);if(!item.targets.includes(entry.localPath))item.targets.push(entry.localPath);
 }
 const rows=[];
 for(const rec of grouped.values()){
  const key=rec.key;
  const exact=index.exactMap.get(`panorama/images/spellicons/${key}_png.vtex_c`.toLowerCase());
  let variants=[];
  if(!exact){
   const prefix=key.toLowerCase()+'_';
   for(const [name,files] of index.folderFiles){if(name.startsWith(prefix)&&name.endsWith('_png')){
     variants.push(...files.filter(x=>!x.path.includes('/immortal/')));
   }}
  }
  rows.push({...rec,match:exact?'exato':variants.length?'alternativo':'ausente',path:exact?.path||null,archiveIndex:exact?.archiveIndex??null,archiveFile:exact?.archiveFile||null,alternatives:variants.map(x=>x.path).slice(0,10)});
 }
 rows.sort((a,b)=>({exato:0,alternativo:1,ausente:2}[a.match]-{exato:0,alternativo:1,ausente:2}[b.match])||a.key.localeCompare(b.key));
 const counters=rows.reduce((t,r)=>(t[r.match]++,t),{exato:0,alternativo:0,ausente:0});
 const neutral=rows.filter(x=>x.groups.includes('neutral-abilities'));
 return {rows,summary:{generatedAt:new Date().toISOString(),vpkPath:dirPath,vpkIndexedFiles:index.entries,spelliconTextureFiles:index.spellIcons,missingReferences:missing.length,uniqueKeys:rows.length,counters,neutrals:{total:neutral.length,exact:neutral.filter(x=>x.match==='exato').length},note:'Correspondência exata por nome interno. Alternativos NÃO são automaticamente utilizados, pois podem representar habilidades diferentes.'}};
}
function safeDest(rel){if(!/^images\/(abilities|neutral-abilities)\/[a-z0-9_.-]+-icon\.png$/i.test(rel)||rel.includes('..'))throw Error('Destino inválido: '+rel);const x=path.resolve(dataDir,rel);if(!x.startsWith(dataDir+path.sep))throw Error('Fora da biblioteca.');return x;}
function applyManifest(recovered){if(!recovered.length)return;
 const manifest=load(manifestPath),found=new Map(recovered.map(x=>[x.key,x]));
 for(const item of manifest){const rec=found.get(item.key);if(!rec||!rec.targets.includes(item.localPath))continue;const p=safeDest(item.localPath);if(!isPng(p))continue;const b=fs.readFileSync(p);item.status='saved';item.bytes=b.length;item.sha256=crypto.createHash('sha256').update(b).digest('hex');item.error=null;item.usedUrl=`vpk-local:${rec.path}`;item.attempts=item.attempts||0;}
 save(manifestPath,manifest);save(missingPath,manifest.filter(x=>x.status==='failed'||x.status==='pending'));
 const counts={};for(const m of manifest)counts[m.status]=(counts[m.status]||0)+1;
 if(fs.existsSync(catalogManifestPath)){const x=load(catalogManifestPath);x.imageResults=counts;x.imagesDownloaded=true;save(catalogManifestPath,x);}
 save(path.join(reportDir,'vpk-recovery-summary.json'),{counts,success:recovered});
}
function runCli(one){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dota-vpk-'));
 try{
  const args=['--input',dirPath,'--vpk_filepath',one.path,'--vpk_decompile','--output',temp];
  const job=spawnSync(cliPath,args,{encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024,windowsHide:true});
  if(job.error)throw Error(job.error.message);
  if(job.status!==0)throw Error(`CLI código ${job.status}: ${String(job.stderr||job.stdout||'').slice(-700)}`);
  const candidates=walk(temp).filter(p=>p.toLowerCase().endsWith('.png')&&isPng(p));
  if(candidates.length!==1)throw Error(`Esperado 1 PNG convertido; encontrados ${candidates.length}.`);
  const b=fs.readFileSync(candidates[0]);
  let count=0;
  for(const rel of one.targets){
   const dest=safeDest(rel);if(isPng(dest)){count++;continue;}
   if(fs.existsSync(dest)&&!canOverwrite)throw Error(`Destino existente não é PNG válido: ${dest}`);
   fs.mkdirSync(path.dirname(dest),{recursive:true});const tmp=dest+'.tmp-'+process.pid;
   fs.writeFileSync(tmp,b);fs.renameSync(tmp,dest);count++;
  }
  return {key:one.key,path:one.path,archiveIndex:one.archiveIndex,targets:one.targets,bytes:b.length,filesWritten:count};
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
}
function main(){
 if(!val('--vpk')&&!process.env.DOTA_VPK)throw Error('Informe --vpk="CAMINHO\\pak01_dir.vpk" (ver README).');
 if(!fs.existsSync(dirPath))throw Error('VPK não encontrado: '+dirPath);
 if(path.basename(dirPath).toLowerCase()!=='pak01_dir.vpk')throw Error('Selecione especificamente o pak01_dir.vpk do Dota 2.');
 if(!fs.existsSync(missingPath))throw Error('Falta o relatório data/reports/missing-images.json');
 if(!fs.existsSync(manifestPath))throw Error('Falta o data/image-manifest.json');
 const missing=load(missingPath);if(!Array.isArray(missing))throw Error('Relatório inválido.');
 console.log('Lendo índice VPK...');const index=inspectVpk(dirPath);const report=generate(missing,index);fs.mkdirSync(reportDir,{recursive:true});
 save(path.join(reportDir,'vpk-matches.json'),report);
 const lines=[['chave','correspondencia','categorias','arquivo_vpk','indice','caminho_interno','alternativas'].map(qCsv).join(';')];
 for(const row of report.rows)lines.push([row.key,row.match,row.groups.join(','),row.archiveFile,row.archiveIndex,row.path,row.alternatives.join(' | ')].map(qCsv).join(';'));
 fs.writeFileSync(path.join(reportDir,'vpk-matches.csv'),'\uFEFF'+lines.join('\n')+'\n','utf8');
 console.log('Resumo:',JSON.stringify(report.summary,null,2));
 console.log('Relatório:',path.join(reportDir,'vpk-matches.csv'));
 if(!doRecover){console.log('Modo auditoria: nenhuma imagem alterada. Para extrair, use .local/arquivo/raiz/Source2Viewer-CLI.exe e --recover --cli="CAMINHO\\Source2Viewer-CLI.exe"');return;}
 if(!cliPath||!fs.existsSync(cliPath))throw Error('Source2Viewer-CLI não encontrado. Use --cli="CAMINHO\\Source2Viewer-CLI.exe".');
 let selected=report.rows.filter(r=>r.match==='exato');
 if(allowVariants)console.warn('AVISO: --include-variants não converte variantes automaticamente: faça correspondência manual para evitar atribuir ícones errados.');
 selected=selected.slice(0,all?selected.length:max);
 console.log('Extração seletiva:',selected.length,'ícones; nunca substitui PNGs válidos.');
 const recovered=[],failed=[];
 for(let i=0;i<selected.length;i++){
  const row=selected[i];
  if(!fs.existsSync(row.archiveFile)){failed.push({key:row.key,error:'Pacote necessário ausente: '+row.archiveFile});}
  else {try {const r=runCli(row);recovered.push(r);} catch(e){failed.push({key:row.key,error:e.message});}}
  console.log(`${i+1}/${selected.length}: ${row.key} — ${recovered.some(r=>r.key===row.key)?'OK':'não recuperada'}`);
 }
 applyManifest(recovered);
 save(path.join(reportDir,'vpk-extraction-log.json'),{generatedAt:new Date().toISOString(),recovered,failed});
 console.log(`Final: ${recovered.length} ícones recuperados; ${failed.length} não recuperados. Log: data/reports/vpk-extraction-log.json`);
 if(failed.length)console.log('Primeiras falhas:',failed.slice(0,3));
}
try{main();}catch(e){console.error('ERRO:',e.message);process.exitCode=1;}
