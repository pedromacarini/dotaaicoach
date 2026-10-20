const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test('Electron executa cenário manual, persiste e abre ficha recomendada', {timeout:30_000}, async () => {
  const project=path.resolve(__dirname,'..');
  const output=path.join(os.tmpdir(),`dota-draft-smoke-${process.pid}.json`);
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'dota-draft-profile-'));
  const env={...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(require('electron'),['.',`--user-data-dir=${profile}`,`--draft-smoke-output=${output}`],{cwd:project,env,stdio:'ignore',windowsHide:true});
  try{
    for(let attempt=0;attempt<250&&!fs.existsSync(output);attempt++) await wait(100);
    assert.ok(fs.existsSync(output),'Smoke de draft não terminou.');
    const result=JSON.parse(fs.readFileSync(output,'utf8'));
    assert.equal(result.error,undefined);
    assert.match(result.beforeSave,/Crystal Maiden/);
    assert.match(result.beforeSave,/Sinergia estatística entre aliados: indisponível/);
    assert.match(result.beforeSave,/Atualizado:/);
    assert.equal(result.persisted.saved.length,1);
    assert.match(result.libraryFrameUrl,/hero=npc_dota_hero_crystal_maiden/);
    assert.match(result.libraryText,/Crystal Maiden/);
    assert.equal(result.enemyMatchupRequests,1,'segunda consulta deve usar cache do servidor local');
  }finally{
    if(child.exitCode===null){child.kill();await Promise.race([new Promise(resolve=>child.once('close',resolve)),wait(2000)]);}
    if(fs.existsSync(output))fs.rmSync(output);
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
