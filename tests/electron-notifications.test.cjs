const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test('Electron abre central, simula banner e permite dismiss com áudio desligado no preset', {timeout:30_000}, async () => {
  const project = path.resolve(__dirname, '..');
  const output = path.join(os.tmpdir(), `dota-notification-smoke-${process.pid}.json`);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-notification-profile-'));
  const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), ['.',`--user-data-dir=${profile}`,`--notification-smoke-output=${output}`], {cwd:project,env,stdio:'ignore',windowsHide:true});
  try {
    for(let attempt=0;attempt<200&&!fs.existsSync(output);attempt++) await wait(100);
    assert.ok(fs.existsSync(output),'Smoke de notificações não terminou.');
    const result=JSON.parse(fs.readFileSync(output,'utf8'));
    assert.equal(result.error,undefined);
    assert.ok(result.initialRules>=3);
    assert.equal(result.confirmationAsked,true);
    assert.equal(result.canceledPresetPreserved,true);
    assert.equal(result.failedSavePreserved,true);
    assert.equal(result.simulated.runtime.simulated,true);
    assert.equal(result.simulated.runtime.active[0].title,'Runa de poder');
    assert.equal(result.dismissed.runtime.active.length,0);
    assert.equal(result.restored.runtime.simulated,false);
  } finally {
    if(child.exitCode===null){child.kill();await Promise.race([new Promise(resolve=>child.once('close',resolve)),wait(2000)]);}
    if(fs.existsSync(output))fs.rmSync(output);
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
