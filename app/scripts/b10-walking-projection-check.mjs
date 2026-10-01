import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { walkingRuntimeProjection } from './walking-runtime-plugin.ts';

// Execute the compiled public domain API with full and projected artifacts.
// A negative control removes snapping evidence and must expose a real demotion.
async function runtime(projected, mutant = false) {
  const projection = walkingRuntimeProjection();
  if (mutant) {
    const transform = projection.transform;
    projection.transform = function (code, id) {
      const result = transform.call(this, code, id);
      if (result === undefined) return;
      const rows = JSON.parse(result);
      for (const row of rows) delete row.endpointSnapping;
      return JSON.stringify(rows);
    };
  }
  const result = await build({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, logLevel: 'error',
    plugins: projected ? [projection] : [],
    build: { write: false, minify: true, lib: { entry: fileURLToPath(new URL('../src/lib/transfer.ts', import.meta.url)), formats: ['es'] } },
  });
  const chunk = (Array.isArray(result) ? result[0] : result).output.find(c => c.type === 'chunk');
  return import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
}
const original = await runtime(false), projected = await runtime(true), mutant = await runtime(true, true);
const places = JSON.parse(readFileSync(new URL('../src/data/places.json', import.meta.url)));
const ids = [...places.map(p => p.id), 'missing-place'];
let pairs = 0, promoted = 0, detected = 0;
for (const from of ids) for (const to of ids) {
  const expected = original.getBestTransfer(from, to);
  assert.deepEqual(projected.lookupTransfer(from, to), original.lookupTransfer(from, to));
  assert.deepEqual(projected.getBestTransfer(from, to), expected);
  if (expected?.confidence === 'validated-static') promoted += 1;
  if (JSON.stringify(mutant.getBestTransfer(from, to)) !== JSON.stringify(expected)) detected += 1;
  pairs += 1;
}
for (let i = 0; i < places.length; i += 3) {
  const route = places.slice(i, i + 4);
  assert.deepEqual(projected.computeLogisticsMetrics(route), original.computeLogisticsMetrics(route));
  assert.deepEqual(projected.computeLogisticsMetrics(route.toReversed()), original.computeLogisticsMetrics(route.toReversed()));
}
assert.ok(promoted > 0 && detected > 0, 'negative control must detect loss of real snapping evidence');
console.log(`B10 walking projection PASS: ${pairs} directed pairs, ${promoted} validated-static edges, forward/reverse metrics; snapping mutant detected on ${detected} pairs.`);
