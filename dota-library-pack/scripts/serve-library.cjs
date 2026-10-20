'use strict';
/** Dota Open Library v1.6. Acesso exclusivamente local e proxy somente leitura da API publica OpenDota. */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const TYPES={'.json':'application/json; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const PORT=Number(process.env.DOTA_LIBRARY_PORT)||3198;
const cache=new Map();const ongoing=new Map();const TTL=30*60*1000;
const OPEN_DOTA_TIMEOUT_MS=20000;
const json=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(obj));};
async function requestOpenDota(endpoint,remoteFetch=fetch,options={}){
 const now=options.now?options.now():Date.now();const old=cache.get(endpoint);
 if(old && now-old.stamp<TTL)return {...old.value,cached:true};
 if(ongoing.has(endpoint))return ongoing.get(endpoint);
 const task=(async()=>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),options.timeoutMs??OPEN_DOTA_TIMEOUT_MS);
  try{
   const upstream=await remoteFetch('https://api.opendota.com/api/'+endpoint,{headers:{Accept:'application/json','User-Agent':'DotaOpenLibrary/1.6 (local viewer; automatic cache)'},signal:controller.signal});
   if(!upstream.ok){const err=new Error('OpenDota respondeu HTTP '+upstream.status);err.status=upstream.status;throw err;}
   const data=await upstream.json();
   if(!(Array.isArray(data)||data&&typeof data==='object'))throw new Error('Resposta inesperada da OpenDota');
   const value={source:'OpenDota API',fetchedAt:new Date().toISOString(),cached:false,data};cache.set(endpoint,{stamp:options.now?options.now():Date.now(),value});return value;
  }catch(error){
   if(old)return {...old.value,cached:true,stale:true,warning:'OpenDota indisponível; exibindo o último dado em cache.'};
   throw error;
  }finally{clearTimeout(timer);ongoing.delete(endpoint);}
 })(); ongoing.set(endpoint,task);return task;
}
function recommendationSql(heroId,position){return `WITH ranked AS (
 SELECT pm.match_id,pm.account_id,np.name,l.name AS league_name,pm.hero_id,pm.player_slot,
  pm.item_0,pm.item_1,pm.item_2,pm.item_3,pm.item_4,pm.item_5,pm.lane_role,pm.is_roaming,
  pm.last_hits,pm.gold_per_min,m.start_time,m.radiant_win,mp.patch,
  ROW_NUMBER() OVER (PARTITION BY pm.match_id,(pm.player_slot<128),pm.lane_role
   ORDER BY pm.gold_per_min DESC NULLS LAST,pm.last_hits DESC NULLS LAST) AS lane_rank
 FROM player_matches pm
 JOIN matches m ON m.match_id=pm.match_id
 LEFT JOIN match_patch mp ON mp.match_id=pm.match_id
 LEFT JOIN notable_players np ON np.account_id=pm.account_id
 LEFT JOIN leagues l ON l.leagueid=m.leagueid
 WHERE m.version IS NOT NULL AND m.start_time>extract(epoch from now())-7776000
  AND EXISTS (SELECT 1 FROM player_matches picked
   WHERE picked.match_id=pm.match_id AND picked.hero_id=${heroId})
), classified AS (
 SELECT *,CASE
  WHEN is_roaming THEN 4
  WHEN lane_role=2 THEN 2
  WHEN lane_role=1 AND lane_rank=1 THEN 1
  WHEN lane_role=1 THEN 5
  WHEN lane_role=3 AND lane_rank=1 THEN 3
  WHEN lane_role=3 THEN 4
  ELSE NULL END AS position
 FROM ranked
)
SELECT match_id,account_id,name,league_name,hero_id,player_slot,item_0,item_1,item_2,item_3,item_4,item_5,
 start_time,radiant_win,patch,position
FROM classified WHERE hero_id=${heroId} AND position=${position}
ORDER BY start_time DESC LIMIT 12`;}
function aggregateSkillBuilds(matches){
 const valid=matches.filter(value=>value.abilityIds.length);const grouped=new Map();
 for(const match of valid){const key=match.abilityIds.join(',');const current=grouped.get(key)||{abilityIds:match.abilityIds,matches:0};current.matches++;grouped.set(key,current);}
 return [...grouped.values()].sort((a,b)=>b.matches-a.matches).slice(0,3)
  .map(value=>({...value,pickRate:valid.length?value.matches/valid.length:0}));
}
async function requestRecommendations(heroId,position,remoteFetch=fetch){
 if(!Number.isInteger(heroId)||heroId<1||heroId>999)throw new Error('Heroi invalido');
 if(!Number.isInteger(position)||position<1||position>5)throw new Error('Posicao invalida');
 const explorerEndpoint='explorer?sql='+encodeURIComponent(recommendationSql(heroId,position));
 const explorer=await requestOpenDota(explorerEndpoint,remoteFetch);
 const rows=Array.isArray(explorer.data?.rows)?explorer.data.rows:[];
 const detailRows=rows.slice(0,4);
 const detailResults=await Promise.allSettled(detailRows.map(row=>requestOpenDota('matches/'+Number(row.match_id),remoteFetch)));
 const details=new Map();let allDetailsCached=true;
 for(let index=0;index<detailResults.length;index++){
  const result=detailResults[index];const row=detailRows[index];
  if(result.status!=='fulfilled'){allDetailsCached=false;continue;}
  allDetailsCached=allDetailsCached&&result.value.cached===true;
  const players=Array.isArray(result.value.data?.players)?result.value.data.players:[];
  const player=players.find(value=>Number(value.hero_id)===heroId&&Number(value.player_slot)===Number(row.player_slot));
  if(player&&Array.isArray(player.ability_upgrades_arr))details.set(String(row.match_id),player.ability_upgrades_arr.map(Number).filter(Number.isFinite));
 }
 const matches=rows.map(row=>{
  const radiant=Number(row.player_slot)<128;const itemIds=[row.item_0,row.item_1,row.item_2,row.item_3,row.item_4,row.item_5]
   .map(Number).filter(value=>Number.isFinite(value)&&value>0);
  return {matchId:String(row.match_id),playerName:row.name||null,leagueName:row.league_name||null,
   playedAt:Number(row.start_time),patch:row.patch||null,won:radiant===Boolean(row.radiant_win),itemIds,
   abilityIds:details.get(String(row.match_id))||[]};
 });
 return {source:'OpenDota API · partidas profissionais',fetchedAt:new Date().toISOString(),
  cached:explorer.cached===true&&allDetailsCached,data:{heroId,position,sampleSize:matches.length,
   detailedMatches:detailRows.length,matches,skillBuilds:aggregateSkillBuilds(matches)}};
}
function makeServer({base=ROOT,remoteFetch}={}){
 const view=path.resolve(base,'viewer'),data=path.resolve(base,'data');
 return http.createServer(async(req,res)=>{
  if(req.method!=='GET'){json(res,405,{error:'Metodo nao permitido'});return;}
  let parsedUrl,pathname;try{parsedUrl=new URL(req.url,'http://127.0.0.1');pathname=decodeURIComponent(parsedUrl.pathname);}catch{json(res,400,{error:'URL invalida'});return;}
  const api=pathname.match(/^\/api\/opendota\/heroes\/(\d{1,3})\/(itemPopularity|matchups|recommendations)$/);
  if(pathname.startsWith('/api/')){
   if(!api || Number(api[1])<1){json(res,404,{error:'Endpoint nao encontrado'});return;}
   try{const heroId=Number(api[1]);const result=api[2]==='recommendations'
    ?await requestRecommendations(heroId,Number(parsedUrl.searchParams.get('position')),remoteFetch)
    :await requestOpenDota('heroes/'+heroId+'/'+api[2],remoteFetch);json(res,200,result);}
   catch(err){let status=err.status===429?429:502;json(res,status,{error:err.status===429?'Limite de consultas da OpenDota. Aguarde e tente novamente.':err.name==='AbortError'?'Tempo limite da OpenDota excedido.':'Nao foi possivel consultar a OpenDota: '+err.message,source:'OpenDota API'});}
   return;
  }
  let basedir,rel;
  if(pathname==='/'||pathname==='/index.html'){basedir=view;rel='index.html';}
  else if(pathname.startsWith('/data/')){basedir=data;rel=pathname.slice(6);}
  else{basedir=view;rel=pathname.slice(1);}
  const target=path.resolve(basedir,rel);
  if(!(target===basedir||target.startsWith(basedir+path.sep))){json(res,403,{error:'Caminho bloqueado'});return;}
  fs.stat(target,(err,stats)=>{
   if(err||!stats.isFile()){json(res,404,{error:'Arquivo indisponivel'});return;}
   res.writeHead(200,{'Content-Type':TYPES[path.extname(target).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   fs.createReadStream(target).pipe(res);
  });
 });
}
if(require.main===module){makeServer().listen(PORT,'127.0.0.1',()=>console.log('Dota Open Library v1.6: http://127.0.0.1:'+PORT+'/'));}
module.exports={makeServer,requestOpenDota,requestRecommendations,recommendationSql,OPEN_DOTA_TIMEOUT_MS};
