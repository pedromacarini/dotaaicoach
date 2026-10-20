const assert = require('node:assert/strict');
const { test } = require('node:test');
const { requestOpenDota, OPEN_DOTA_TIMEOUT_MS } = require('../dota-library-pack/scripts/serve-library.cjs');

test('proxy OpenDota usa timeout ampliado e cache stale em falha transitória', async () => {
  assert.ok(OPEN_DOTA_TIMEOUT_MS >= 20_000);
  const endpoint = `test-stale-${process.pid}-${Date.now()}`;
  let now = 1;
  const first = await requestOpenDota(endpoint, async () => new Response(JSON.stringify({ ok: true })), { now: () => now });
  assert.equal(first.cached, false);
  now += 31 * 60 * 1000;
  const stale = await requestOpenDota(endpoint, async () => { throw new Error('timeout'); }, { now: () => now, timeoutMs: 10 });
  assert.equal(stale.cached, true);
  assert.equal(stale.stale, true);
  assert.match(stale.warning, /último dado em cache/);
  assert.deepEqual(stale.data, { ok: true });
});
