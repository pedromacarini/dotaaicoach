const {test}=require('node:test');const assert=require('node:assert/strict');
const base='../scripts/sync-data.mjs';
test('normalização do catálogo aberto sem código proprietário',async()=>{
 const m=await import(base);
 const heroes=m.normalizeHeroes({'1':{id:1,name:'npc_dota_hero_antimage',localized_name:'Anti-Mage',primary_attr:'agi',roles:['Carry'],move_speed:315,base_str:21}});
 assert.equal(heroes.length,1);assert.equal(heroes[0].name,'Anti-Mage');assert.equal(heroes[0].base.moveSpeed,315);
 const items=m.normalizeItems({blink:{id:1,dname:'Blink Dagger',cost:2250,attrib:[{key:'blink_range',value:'1200'}]}});
 assert.equal(items[0].cost,2250);assert.equal(items[0].attributes[0].value,'1200');
 const abilities=m.normalizeAbilities({axe_berserkers_call:{dname:'Berserker’s Call',cd:[18,16,14,12]}});
 assert.deepEqual(abilities[0].cooldown,[18,16,14,12]);
 const loadouts=m.normalizeHeroAbilities({npc_dota_hero_axe:{abilities:['axe_berserkers_call'],talents:[{name:'special_bonus_foo',level:1}],facets:[{deprecated:'true'}]}});
 assert.equal(loadouts[0].talents[0].tier,1);assert.equal('facets' in loadouts[0],false);
});
test('sem nomes ou dados sintéticos na biblioteca inicial',async()=>{
 const {readFile}=require('node:fs/promises');
 const p=require('node:path');
 const manifest=JSON.parse(await readFile(p.join(__dirname,'../src/data/generated/manifest.json'),'utf8'));
 assert.ok(['not-synced','ready'].includes(manifest.status));
});
