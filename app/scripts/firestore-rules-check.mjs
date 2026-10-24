import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, query, where, documentId } from 'firebase/firestore';

// The single shared trip ID is the one hardcoded in firestore.rules (source of truth).
const rulesText = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
const trip = rulesText.match(/tripId == '([^']+)'/)?.[1];
if (!trip || trip.length < 32) throw new Error('sharedTrip() ID missing or shorter than 32 characters in firestore.rules');
// The example env must point the app at that same trip, or every write would be denied.
const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
if (envExample.match(/^VITE_FIREBASE_TRIP_ID=(\S+)$/m)?.[1] !== trip) throw new Error('app/.env.example VITE_FIREBASE_TRIP_ID differs from firestore.rules');

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-nihon-sync', firestore: { rules: rulesText } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const db = (uid = 'device-a', provider = 'anonymous') => uid
  ? env.authenticatedContext(uid, { firebase: { sign_in_provider: provider } }).firestore()
  : env.unauthenticatedContext().firestore();
const stance = (slot = 0, changes = {}) => ({ placeId: 'JP-001', slot, stance: 'interested', ...changes });
const item = (writer = 'device-a', changes = {}) => ({ id: 'JP-001~0', kind: 'place', payload: stance(0), deleted: false, updatedAt: Date.now(), writer, ...changes });
const itemRef = (uid = 'device-a', id = 'JP-001~0', tripId = trip) => doc(db(uid), `trips/${tripId}/items/${id}`);
const roster = [{ id: 't-a', label: 'Ana' }, { id: 't-b', label: 'Luis' }];
const planPayload = (routeIds = ['JP-001', 'JP-002']) => ({ routeIds, data: JSON.stringify({ version: 8, routeIds, days: [] }) });
const stateRecord = (id, payload, writer = 'device-a', changes = {}) => ({ id, kind: id, payload, deleted: false, updatedAt: Date.now(), writer, ...changes });
const stateRef = (id, uid = 'device-a', tripId = trip) => doc(db(uid), `trips/${tripId}/state/${id}`);
const stateQuery = (database) => query(collection(database, `trips/${trip}/state`), where(documentId(), 'in', ['roster', 'planner']));

test('any authenticated device (anonymous included) can read and write the shared trip', async () => {
  for (const uid of ['device-a', 'device-b', 'any-other-device']) {
    await assertSucceeds(setDoc(itemRef(uid), item(uid)));
    await assertSucceeds(getDoc(itemRef(uid)));
    await assertSucceeds(getDocs(collection(db(uid), `trips/${trip}/items`)));
  }
  await assertSucceeds(setDoc(itemRef('device-b', 'JP-001~1'), item('device-b', { id: 'JP-001~1', payload: stance(1, { stance: 'not-interested' }) })));
  await assertSucceeds(setDoc(itemRef('device-a', 'JP-001~carried'), item('device-a', { id: 'JP-001~carried', payload: { placeId: 'JP-001', carriedOver: true } })));
  await assertSucceeds(setDoc(stateRef('roster'), stateRecord('roster', roster)));
  await assertSucceeds(setDoc(stateRef('planner'), stateRecord('planner', planPayload())));
  await assertSucceeds(getDocs(stateQuery(db())));
  const google = db('other-account', 'google.com');
  await assertSucceeds(setDoc(doc(google, `trips/${trip}/items/JP-001~0`), item('other-account')));
});

test('denies unauthenticated read, query and write', async () => {
  await assertSucceeds(setDoc(itemRef(), item()));
  await assertFails(getDoc(itemRef(null)));
  await assertFails(getDocs(collection(db(null), `trips/${trip}/items`)));
  await assertFails(getDocs(stateQuery(db(null))));
  await assertFails(setDoc(itemRef(null), item('device-a')));
  await assertFails(setDoc(stateRef('roster', null), stateRecord('roster', roster)));
  await assertFails(deleteDoc(itemRef(null)));
});

test('denies other trip IDs (including the old public japon-2026), trip metadata and other paths', async () => {
  for (const other of ['japon-2026', 'other', trip.slice(0, -1), `${trip}x`]) {
    await assertFails(setDoc(itemRef('device-a', 'JP-001~0', other), item()));
    await assertFails(getDoc(itemRef('device-a', 'JP-001~0', other)));
    await assertFails(setDoc(stateRef('planner', 'device-a', other), stateRecord('planner', planPayload())));
    await assertFails(getDocs(collection(db(), `trips/${other}/items`)));
  }
  for (const path of [`trips/${trip}`, `trips/${trip}/state/unknown`, `trips/${trip}/anything/else`, 'anything/else']) {
    await assertFails(getDoc(doc(db(), path)));
    await assertFails(setDoc(doc(db(), path), item()));
  }
});

test('denies hard deletes everywhere; place removal only via tombstone; no stale resurrection', async () => {
  const updatedAt = Date.now();
  await assertSucceeds(setDoc(itemRef(), item('device-a', { updatedAt: updatedAt - 10 })));
  await assertSucceeds(setDoc(stateRef('roster'), stateRecord('roster', roster)));
  await assertSucceeds(setDoc(stateRef('planner'), stateRecord('planner', planPayload())));
  await assertFails(deleteDoc(itemRef()));
  await assertFails(deleteDoc(stateRef('roster')));
  await assertFails(deleteDoc(stateRef('planner')));
  await assertSucceeds(setDoc(itemRef(), item('device-a', { deleted: true, payload: null, updatedAt: updatedAt - 5 })));
  await assertSucceeds(setDoc(itemRef(), item('device-a', { deleted: true, payload: null, updatedAt })));
  await assertFails(setDoc(itemRef('device-b'), item('device-b', { updatedAt: updatedAt - 1 })));
  await assertFails(setDoc(itemRef(), item('device-a', { deleted: true, payload: 'null', updatedAt: updatedAt + 1 })));
  await assertFails(setDoc(stateRef('roster'), stateRecord('roster', null, 'device-a', { deleted: true })));
  await assertFails(setDoc(stateRef('planner'), stateRecord('planner', null, 'device-a', { deleted: true })));
});

test('denies an empty plan or an empty roster (nobody can wipe the trip at once)', async () => {
  await assertSucceeds(setDoc(stateRef('planner'), stateRecord('planner', planPayload())));
  for (const payload of [planPayload([]), null, 'null', {}, [], { routeIds: ['JP-001'], data: '' }]) {
    await assertFails(setDoc(stateRef('planner'), stateRecord('planner', payload)));
  }
  await assertSucceeds(setDoc(stateRef('roster'), stateRecord('roster', roster)));
  for (const payload of [[], null]) await assertFails(setDoc(stateRef('roster'), stateRecord('roster', payload)));
});

test('validates envelope fields, identity and clock bounds', async () => {
  for (const changes of [{ id: 'wrong' }, { kind: 'planner' }, { writer: 'someone-else' }, { writer: 'x'.repeat(129) }, { updatedAt: -1 }, { updatedAt: 1.5 }, { updatedAt: 'now' }, { updatedAt: Date.now() + 600000 }, { deleted: 'true' }, { deleted: true }, { extra: true }]) {
    await assertFails(setDoc(itemRef(), item('device-a', changes)));
  }
  const missing = item(); delete missing.writer;
  await assertFails(setDoc(itemRef(), missing));
  await assertFails(setDoc(stateRef('roster'), stateRecord('roster', roster, 'someone-else')));
});

test('rejects malformed or oversized place documents and IDs', async () => {
  for (const payload of [null, 'json', stance(0, { placeId: 'JP-002' }), stance(0, { extra: true }), stance(2), stance('0'), stance(0, { stance: 'maybe' }), { placeId: 'JP-001', slot: 0 }, { placeId: 'JP-001', carriedOver: true }]) {
    await assertFails(setDoc(itemRef(), item('device-a', { payload })));
  }
  for (const id of ['JP-001~2', 'JP-001~uid-abc', 'JP_001~0', `${'x'.repeat(97)}~0`]) {
    const placeId = id.split('~')[0];
    await assertFails(setDoc(itemRef('device-a', id), item('device-a', { id, payload: stance(0, { placeId }) })));
  }
  await assertFails(setDoc(itemRef('device-a', 'JP-001~carried'), item('device-a', { id: 'JP-001~carried', payload: { placeId: 'JP-001', carriedOver: false } })));
});

test('rejects malformed or oversized roster and planner documents', async () => {
  for (const payload of [Array(3).fill(roster[0]), [roster[0], roster[0]], [{ ...roster[0], label: 'x'.repeat(81) }], [{ ...roster[0], label: '' }], [{ ...roster[0], id: 'x'.repeat(129) }], [{ ...roster[0], extra: true }], [{ id: 't-a', label: 42 }], { 0: roster[0] }]) {
    await assertFails(setDoc(stateRef('roster'), stateRecord('roster', payload)));
  }
  const many = Array.from({ length: 601 }, (_, i) => `JP-${i}`);
  for (const payload of [planPayload(many), planPayload(['JP-001', 'JP-001']), planPayload(['JP 001']), { ...planPayload(), data: 'x'.repeat(10) }, { ...planPayload(), data: `{${'x'.repeat(200000)}}` }, { ...planPayload(), extra: true }, { routeIds: 'JP-001', data: '{}' }]) {
    await assertFails(setDoc(stateRef('planner'), stateRecord('planner', payload)));
  }
  await assertFails(setDoc(stateRef('planner'), stateRecord('planner', planPayload(), 'device-a', { extra: true })));
});

test('denies creating a document that is already a tombstone (mass-delete mitigation)', async () => {
  const tombstone = (id, uid = 'device-a') => item(uid, { id, payload: null, deleted: true, updatedAt: Date.now() });
  for (const id of ['JP-001~0', 'JP-002~1', 'JP-003~carried']) await assertFails(setDoc(itemRef('device-a', id), tombstone(id)));
  await assertSucceeds(setDoc(itemRef(), item()));
  await assertSucceeds(setDoc(itemRef('device-b'), tombstone('JP-001~0', 'device-b')));
});

test('rejects a roster with more than 2 travellers', async () => {
  const people = Array.from({ length: 5 }, (_, i) => ({ id: `t-${i}`, label: `Persona ${i + 1}` }));
  await assertSucceeds(setDoc(stateRef('roster'), stateRecord('roster', people.slice(0, 2))));
  for (const size of [3, 4, 5]) await assertFails(setDoc(stateRef('roster'), stateRecord('roster', people.slice(0, size))));
});

test('a tombstoned like can be updated back to live with a newer timestamp («No, conservar los nuestros»)', async () => {
  const t = Date.now();
  await assertSucceeds(setDoc(itemRef(), item('device-a', { updatedAt: t - 20 })));
  await assertSucceeds(setDoc(itemRef('attacker'), item('attacker', { deleted: true, payload: null, updatedAt: t - 10 })));
  await assertFails(setDoc(itemRef('device-a'), item('device-a', { updatedAt: t - 11 })));
  await assertSucceeds(setDoc(itemRef('device-a'), item('device-a', { updatedAt: t })));
});
