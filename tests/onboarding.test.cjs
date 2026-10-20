const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  ONBOARDING_COMPLETE_VALUE,
  ONBOARDING_STORAGE_KEY,
  shouldShowOnboarding,
} = require('../dist-electron/src/core/onboarding.js');

test('início guiado aparece até registrar conclusão da versão atual', () => {
  assert.equal(ONBOARDING_STORAGE_KEY, 'dota-open-overlay:onboarding-v1');
  assert.equal(shouldShowOnboarding(null), true);
  assert.equal(shouldShowOnboarding('valor-antigo'), true);
  assert.equal(shouldShowOnboarding(ONBOARDING_COMPLETE_VALUE), false);
});
