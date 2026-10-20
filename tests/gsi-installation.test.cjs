const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  discoverDotaInstallation, inspectGsiInstallation, installGsiConfiguration,
  parseSteamLibraryPaths, resolveDotaPath, GSI_CONFIG_NAME,
} = require('../dist-electron/electron/gsi-installation.js');

test('encontra Dota em uma biblioteca adicional registrada pelo Steam', t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-open-gsi-discovery-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const steam = path.join(folder, 'Steam');
  const library = path.join(folder, 'Games');
  fs.mkdirSync(path.join(steam, 'steamapps'), { recursive: true });
  fs.mkdirSync(path.join(library, 'steamapps', 'common', 'dota 2 beta', 'game', 'dota'), { recursive: true });
  fs.writeFileSync(path.join(steam, 'steamapps', 'libraryfolders.vdf'),
    `"libraryfolders"\n{\n "0" { "path" "${library.replace(/\\/g, '\\\\')}" }\n}`);

  assert.deepEqual(parseSteamLibraryPaths(`"path" "${library.replace(/\\/g, '\\\\')}"`), [library]);
  const found = discoverDotaInstallation([{ path: steam, source: 'Teste' }]);
  assert.equal(found.dotaPath, path.join(library, 'steamapps', 'common', 'dota 2 beta'));
  assert.equal(found.source, 'Biblioteca Steam');
});

test('instala configuração atomicamente e confirma que está atual', t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-open-gsi-install-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const dotaPath = path.join(folder, 'dota 2 beta');
  fs.mkdirSync(path.join(dotaPath, 'game', 'dota'), { recursive: true });
  assert.equal(resolveDotaPath(folder), dotaPath);
  const location = { dotaPath, source: 'Teste' };
  const before = inspectGsiInstallation(location, 'conteúdo novo');
  assert.equal(before.configInstalled, false);

  const after = installGsiConfiguration(location, 'conteúdo novo');
  assert.equal(after.configInstalled, true);
  assert.equal(after.configCurrent, true);
  assert.equal(fs.readFileSync(path.join(after.configDirectory, GSI_CONFIG_NAME), 'utf8'), 'conteúdo novo');
  assert.equal(fs.existsSync(`${after.configFilePath}.tmp`), false);
});
