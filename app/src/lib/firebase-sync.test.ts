import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string; isAnonymous: boolean } | null },
  observe: vi.fn(), authenticate: vi.fn(), listen: vi.fn(), unsubscribe: vi.fn(), stopListener: vi.fn(), transact: vi.fn(),
}));
vi.mock("firebase/app", () => ({ getApps: () => [{ name: "nihon-sync" }], initializeApp: vi.fn() }));
vi.mock("firebase/auth", () => ({ getAuth: () => mocks.auth, onAuthStateChanged: mocks.observe, signInAnonymously: mocks.authenticate }));
vi.mock("firebase/firestore", () => ({
  getFirestore: () => ({}), collection: vi.fn(), doc: vi.fn(), documentId: vi.fn(),
  query: vi.fn(), where: vi.fn(), onSnapshot: mocks.listen, runTransaction: mocks.transact,
}));
import { connectFirebase, syncErrorMessage } from "./firebase-sync";
import { SyncHold, type SyncJournal } from "./sync-session";
import { StorageFullError } from "./sync-backups";
import { projectTrip, type TripState } from "./trip-sync";
import { toFirestoreRecord } from "./firestore-record";
import { freshTravellersDocument, withStance } from "./travellers";
import { freshDraft } from "./planning-draft-v8";

const config = { options: { apiKey: "test", authDomain: "test.invalid", projectId: "demo-nihon", appId: "test" }, tripId: "japon-2026" };
let observer: (user: typeof mocks.auth.currentUser) => void;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { setInterval, clearInterval });
  vi.clearAllMocks();
  mocks.auth.currentUser = null;
  mocks.observe.mockImplementation((_auth, callback) => { observer = callback; return mocks.unsubscribe; });
  mocks.authenticate.mockResolvedValue({});
  mocks.listen.mockReturnValue(mocks.stopListener);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("automatically signs in anonymously and starts listeners only after Auth confirms it", async () => {
  const connection = connectFirebase(config, vi.fn());
  observer(null);
  expect(mocks.authenticate).toHaveBeenCalledOnce();
  expect(mocks.listen).not.toHaveBeenCalled();
  await Promise.resolve();
  const user = { uid: "anonymous-device", isAnonymous: true };
  mocks.auth.currentUser = user; observer(user);
  expect(mocks.listen).toHaveBeenCalledTimes(2);
  connection.dispose();
  expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  expect(mocks.stopListener).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});
it("reuses a restored anonymous session without creating a new account", () => {
  const connection = connectFirebase(config, vi.fn());
  const user = { uid: "restored-device", isAnonymous: true };
  mocks.auth.currentUser = user; observer(user);
  expect(mocks.authenticate).not.toHaveBeenCalled();
  expect(mocks.listen).toHaveBeenCalledTimes(2);
  connection.dispose();
});
it("keeps local data on an Auth error and retries without any login UI", async () => {
  mocks.authenticate.mockRejectedValue(new Error("auth/operation-not-allowed"));
  const status = vi.fn();
  const connection = connectFirebase(config, status);
  observer(null);
  await vi.advanceTimersByTimeAsync(0);
  expect(status).toHaveBeenCalledWith(expect.stringContaining("Sus datos locales se conservan"));
  expect(mocks.listen).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(15000);
  expect(mocks.authenticate).toHaveBeenCalledTimes(2);
  connection.dispose();
});
it("does not start listeners after cleanup or retain a previous interactive session", () => {
  const connection = connectFirebase(config, vi.fn());
  observer({ uid: "old-google-account", isAnonymous: false });
  expect(mocks.authenticate).toHaveBeenCalledOnce();
  expect(mocks.listen).not.toHaveBeenCalled();
  connection.dispose();
  observer({ uid: "late-anonymous-result", isAnonymous: true });
  expect(mocks.listen).not.toHaveBeenCalled();
});

function memoryLocal(state: TripState) {
  let journal: SyncJournal = { version: 1, records: {}, baseline: null };
  const local = {
    state,
    read: async () => local.state,
    journal: () => journal,
    saveJournal: (next: SyncJournal) => { journal = next; },
    apply: vi.fn(async (transform: (s: TripState) => TripState) => { local.state = transform(local.state); }),
  };
  return local;
}
const snapshot = (docs: { id: string; data: unknown }[]) => ({ metadata: { fromCache: false }, docs: docs.map((d) => ({ id: d.id, data: () => d.data })) });
function trips() {
  let n = 0;
  const people = freshTravellersDocument(() => `t-${++n}`);
  const local: TripState = { travellers: people, draft: freshDraft(["JP-001"]) };
  const remote: TripState = { travellers: withStance(withStance(people, "JP-001", "t-1", "interested"), "JP-002", "t-2", "interested"), draft: freshDraft(["JP-001"]) };
  return { local, remote };
}

it("one malformed remote item is skipped and does not block the rest", async () => {
  mocks.transact.mockImplementation(async (_db, run) => run({ get: async () => ({ exists: () => false }), set: vi.fn() }));
  const { local: localState, remote } = trips();
  const local = memoryLocal(localState);
  const status = vi.fn();
  const connection = connectFirebase(config, status, local);
  observer({ uid: "device-b", isAnonymous: true });
  const records = Object.values(projectTrip(remote, "device-a")).map((r) => ({ ...r, updatedAt: 100 }));
  const items = records.filter((r) => r.kind === "place").map((r) => ({ id: r.id, data: toFirestoreRecord(r) }));
  const state = records.filter((r) => r.kind !== "place").map((r) => ({ id: r.id, data: toFirestoreRecord(r) }));
  const malformed = { id: "JP-003~0", data: { id: "JP-003~0", kind: "place", payload: { placeId: "JP-003", slot: 7 }, deleted: false, updatedAt: 1, writer: "x" } };
  const [itemsListener, stateListener] = mocks.listen.mock.calls;
  itemsListener[2](snapshot([items[0], malformed, items[1]]));
  stateListener[2](snapshot(state));
  await vi.advanceTimersByTimeAsync(0);
  await vi.waitFor(() => expect(local.apply).toHaveBeenCalled());
  expect(local.state.travellers.interests.map((i) => i.placeId).sort()).toEqual(["JP-001", "JP-002"]);
  expect(status).toHaveBeenLastCalledWith(expect.stringContaining("Se omitieron datos remotos inválidos"));
  connection.dispose();
});

it("a snapshot listener error resubscribes with backoff", async () => {
  const status = vi.fn();
  const connection = connectFirebase(config, status, memoryLocal(trips().local));
  observer({ uid: "device-b", isAnonymous: true });
  expect(mocks.listen).toHaveBeenCalledTimes(2);
  mocks.listen.mock.calls[0][3](new Error("unavailable"));
  expect(mocks.stopListener).toHaveBeenCalledOnce();
  expect(status).toHaveBeenLastCalledWith(expect.stringContaining("volveremos a intentarlo"));
  await vi.advanceTimersByTimeAsync(999); expect(mocks.listen).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1); expect(mocks.listen).toHaveBeenCalledTimes(3);
  mocks.listen.mock.calls[2][3](new Error("unavailable"));
  await vi.advanceTimersByTimeAsync(1999); expect(mocks.listen).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(1); expect(mocks.listen).toHaveBeenCalledTimes(4);
  connection.dispose();
});

it("only connection errors ask to check the connection; data, storage and holds say what happened", () => {
  expect(syncErrorMessage(Object.assign(new Error("x"), { code: "unavailable" }))).toContain("Revisen la conexión");
  const data = syncErrorMessage(new Error("Invalid merged trip"));
  expect(data).toContain("no son válidos"); expect(data).not.toContain("conexión");
  expect(syncErrorMessage(new StorageFullError())).toContain("almacenamiento de este navegador está lleno");
  expect(syncErrorMessage(new SyncHold("roster-order"))).toContain("mismo orden");
  const hold = syncErrorMessage(new SyncHold("mass-removal", 12, "sig"));
  expect(hold).toContain("12 «me gusta»"); expect(hold).toContain("confírmenlo");
  for (const message of [data, hold]) expect(message).not.toMatch(/\b(tus|tu|puedes|confirma)\b/i);
});

it("held syncs offer the right choices: apply or keep ours, and «¿Quién eres en este viaje?»", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { SyncHoldActions } = await import("../components/TripSync");
  const removal = renderToStaticMarkup(createElement(SyncHoldActions, { hold: { kind: "mass-removal", removed: 12, approve: vi.fn(), keep: vi.fn() } }));
  expect(removal).toContain("Sí, quitar esos 12 «me gusta» en este teléfono");
  expect(removal).toContain("No, conservar los nuestros");
  const who = renderToStaticMarkup(createElement(SyncHoldActions, { hold: { kind: "who-are-you", names: ["Ana", "Luis"], choose: vi.fn() } }));
  expect(who).toContain("¿Quién eres en este viaje?");
  expect(who).toContain(">Ana</button>"); expect(who).toContain(">Luis</button>");
  expect(syncErrorMessage(new SyncHold("who-are-you", 0, "", ["Ana", "Luis"]))).toContain("Respondan abajo");
  expect(syncErrorMessage(new SyncHold("mass-removal", 3, "s"))).toContain("conserven los suyos");
});
