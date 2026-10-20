import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const data=path.join(root,'src/data/generated');
const manifest=JSON.parse(fs.readFileSync(path.join(data,'manifest.json'),'utf8'));
console.log(JSON.stringify(manifest,null,2));
if(manifest.status!=='ready') {console.error('Biblioteca ainda não sincronizada. Use npm run data:sync.');process.exitCode=1;}
else {
  for(const name of ['heroes','items','abilities','heroAbilities']){
    const v=JSON.parse(fs.readFileSync(path.join(data,name+'.json'),'utf8'));
    if(!Array.isArray(v)||v.length<100) throw new Error(`Dataset inválido: ${name}`);
  }
  console.log('Datasets principais íntegros.');
}
