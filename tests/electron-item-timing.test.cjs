const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test('Electron abre Itens, usa demo rotulada e mostra cartão no overlay', {timeout:30_000}, async () => {
  const project=path.resolve(__dirname,'..');
  const output=path.join(os.tmpdir(),`dota-items-smoke-${process.pid}.json`);
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'dota-items-profile-'));
  const env={...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(require('electron'),['.',`--user-data-dir=${profile}`,`--item-timing-smoke-output=${output}`],{cwd:project,env,stdio:'ignore',windowsHide:true});
  try {
    for(let attempt=0;attempt<200&&!fs.existsSync(output);attempt++) await wait(100);
    assert.ok(fs.existsSync(output),'Smoke de itens não terminou.');
    const result=JSON.parse(fs.readFileSync(output,'utf8'));
    assert.equal(result.error,undefined);
    assert.match(result.text,/Timing de itens/);
    assert.match(result.text,/Fixture autoral sintética/);
    assert.equal(result.state.validation,'synthetic-demo');
    assert.equal(result.state.observations.length,3);
    assert.match(result.overlayText,/PRIMEIRA OBSERVAÇÃO/);
    assert.ok(result.remoteRequests<=3,'não faz request a cada pacote');
  } finally {
    if(child.exitCode===null){child.kill();await Promise.race([new Promise(resolve=>child.once('close',resolve)),wait(2000)]);}
    if(fs.existsSync(output))fs.rmSync(output);
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
