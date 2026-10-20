const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ACTIVATION_HASH = '1bd0fbae8051a866df6c6897c13c22676bf1c99757d3f1961bfb5dc94b26ec97';

function withActivationFile(expiresAt, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-iacoach-license-'));
  const file = path.join(dir, 'license.json');
  try {
    fs.writeFileSync(file, JSON.stringify({ type: 'activation', codeHash: ACTIVATION_HASH, expiresAt }));
    run(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('ativação offline ignora expiresAt persistido e usa somente a allowlist', () => {
  const { createLicenseStore } = require('../dist-electron/electron/license-store.js');

  withActivationFile('2000-01-01T00:00:00.000Z', file => {
    const status = createLicenseStore(file, () => new Date('2026-10-20T00:00:00.000Z')).get();
    assert.equal(status.valid, true);
    assert.equal(status.expiresAt, '2027-12-31T23:59:59.000Z');
  });

  withActivationFile('2099-12-31T23:59:59.000Z', file => {
    const status = createLicenseStore(file, () => new Date('2028-01-01T00:00:00.000Z')).get();
    assert.equal(status.valid, false);
    assert.equal(status.reason, 'Código de ativação expirado.');
  });
});
