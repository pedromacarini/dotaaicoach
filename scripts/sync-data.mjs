/**
 * Sync local, publicly distributed data from the MIT-licensed dotaconstants
 * dependency. No Aura files, network scraping, or executable inspection.
 * Source: https://github.com/odota/dotaconstants
 * Dota 2 game data, terminology and assets remain the rights of their owners.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src', 'data', 'generated');
const sourceDir = path.join(root, 'node_modules', 'dotaconstants', 'build');

const string = v => typeof v === 'string' ? v : null;
const finite = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const asArray = v => Array.isArray(v) ? v : [];
const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
const value = v => v === false || v === 0 || v === '' || v === null || typeof v === 'number' || typeof v === 'string' || Array.isArray(v) ? v : null;
const cleanText = v => string(v)?.replace(/<[^>]*>/g, ' ').replace(/\s+/g,' ').trim() || null;
const sortByName = xs => xs.sort((a,b) => a.name.localeCompare(b.name,'en'));

export function normalizeHeroes(raw) {
  return sortByName(Object.entries(obj(raw)).filter(([k,v]) => obj(v).id != null && /^\d+$/.test(k)).map(([key,entry]) => {
    const v=obj(entry);
    return {
      id: finite(v.id), key: String(key), internalName: string(v.name),
      name: string(v.localized_name) || String(v.name ?? key),
      primaryAttribute: string(v.primary_attr), attackType: string(v.attack_type),
      roles: asArray(v.roles).filter(x => typeof x === 'string'),
      base: { strength:finite(v.base_str), agility:finite(v.base_agi), intelligence:finite(v.base_int),
        strengthGain:finite(v.str_gain), agilityGain:finite(v.agi_gain), intelligenceGain:finite(v.int_gain),
        moveSpeed:finite(v.move_speed), attackRange:finite(v.attack_range), armor:finite(v.base_armor),
        attackMin:finite(v.base_attack_min), attackMax:finite(v.base_attack_max),
        dayVision:finite(v.day_vision), nightVision:finite(v.night_vision) },
      captainMode: Boolean(v.cm_enabled)
    };
  }));
}
export function normalizeItems(raw) {
  return sortByName(Object.entries(obj(raw)).filter(([,v]) => obj(v).id != null).map(([key,entry]) => {
    const v=obj(entry);
    return { id: finite(v.id), key, name: string(v.dname) || key,
      cost: finite(v.cost), category: string(v.qual),
      manaCost: value(v.mc), cooldown: value(v.cd),
      components: asArray(v.components).filter(x=>typeof x==='string'),
      attributes: asArray(v.attrib).map(a=>({key:string(a?.key),value:value(a?.value)})),
      effects: asArray(v.abilities).map(e=>({ type:string(e?.type), title:string(e?.title), description:cleanText(e?.description)})),
      hint: asArray(v.hint).map(cleanText).filter(Boolean),
      recipe: Boolean(v.created)
    };
  }));
}
export function normalizeAbilities(raw) {
  return sortByName(Object.entries(obj(raw)).filter(([,v]) => v !== null && typeof v === 'object' && !Array.isArray(v)).map(([key,entry]) => {
    const v=obj(entry);
    return { key, name: string(v.dname)||key,
      behavior:value(v.behavior), damageType:string(v.dmg),
      cooldown:value(v.cd), manaCost:value(v.mc),
      description:cleanText(v.desc), notes:asArray(v.notes).map(cleanText).filter(Boolean),
      attributes:asArray(v.attrib).map(a=>({key:string(a?.key),header:string(a?.header),value:value(a?.value),footer:string(a?.footer)})),
      spellImmunity:string(v.bkbpierce), dispellable:string(v.dispellable),
      scepter:cleanText(v.scepter_desc), shard:cleanText(v.shard_desc)
    };
  }));
}
export function normalizeHeroAbilities(raw) {
  return Object.entries(obj(raw)).map(([heroKey,v])=>({
    heroKey, abilities:asArray(v?.abilities).filter(x=>typeof x==='string'),
    talents:asArray(v?.talents).map(t=>({name:string(t?.name),tier:finite(t?.level)})),
    // Facetas descontinuadas podem persistir no upstream: não as apresentamos como recursos ativos.
  })).sort((a,b)=>a.heroKey.localeCompare(b.heroKey));
}
export function normalizeNeutralAbilities(raw) {
  return Object.keys(obj(raw)).sort().map(key=>({ key, name:key.replaceAll('_',' ') }));
}
export function normalizePatches(raw) {
  return asArray(raw).filter(p=>typeof p?.name==='string').map(p=>({ name:p.name,date:string(p.date),id:finite(p.id) }));
}
export function normalizeExtras(raw) {
  // Inventários auxiliares: manter chave e valor públicos do pacote, com origem identificada.
  return Object.fromEntries(Object.entries(raw).map(([domain, records]) => [domain, records]));
}

function readSource(filename, optional=false) {
  const location=path.join(sourceDir,filename+'.json');
  if (!fs.existsSync(location)) {
    if(optional) return null;
    throw new Error(`Dado exigido ausente: ${location}. Reinstale dotaconstants.`);
  }
  return JSON.parse(fs.readFileSync(location,'utf8'));
}
function write(name,data){ fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`${name}.json`),JSON.stringify(data)+'\n'); }
export function sync(){
  if (!fs.existsSync(sourceDir)) throw new Error('dotaconstants não instalado. Execute npm install primeiro.');
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'node_modules/dotaconstants/package.json'),'utf8'));
  const heroes=normalizeHeroes(readSource('heroes'));
  const items=normalizeItems(readSource('items'));
  const abilities=normalizeAbilities(readSource('abilities'));
  const heroAbilities=normalizeHeroAbilities(readSource('hero_abilities'));
  const neutralAbilities=normalizeNeutralAbilities(readSource('neutral_abilities',true));
  const patches=normalizePatches(readSource('patch',true));
  const optional=['ability_ids','item_ids','xp_level','ancients','skillshots','aghs_desc','permanent_buffs','game_mode','lobby_type'];
  const extras=normalizeExtras(Object.fromEntries(optional.map(k=>[k,readSource(k,true)]).filter(([,v])=>v!==null)));
  if (heroes.length<100 || items.length<100 || abilities.length<100 || heroAbilities.length<100)
    throw new Error(`Dados incompletos: heróis=${heroes.length}, itens=${items.length}, habilidades=${abilities.length}, ligações=${heroAbilities.length}. Não sobrescrevemos o catálogo.`);
  const outputs={heroes,items,abilities,heroAbilities,neutralAbilities,patches,extras};
  for (const [kind,records] of Object.entries(outputs)) write(kind,records);
  const manifest={schemaVersion:1,status:'ready',source:'odota/dotaconstants',sourceUrl:'https://github.com/odota/dotaconstants',
    sourceLicense:'MIT', version:pkg.version, generatedAt:new Date().toISOString(),
    latestPatchInSource:patches.at(-1)?.name ?? null,
    counts:Object.fromEntries(Object.entries(outputs).map(([key,records])=>[key,Array.isArray(records)?records.length:Object.keys(records).length])),
    note:'O catálogo é uma fotografia do pacote instalado, não confirmação de atualização com o patch atual do jogo.'};
  write('manifest',manifest);
  console.log('Biblioteca sincronizada:',JSON.stringify(manifest.counts));
  console.log('Fonte:',manifest.source,manifest.version,'Patch da fonte:',manifest.latestPatchInSource??'indisponível');
  console.log('Arquivos:',dir);
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { sync(); } catch(e){console.error('Falha ao sincronizar biblioteca:',e.message);process.exitCode=1;}
}
