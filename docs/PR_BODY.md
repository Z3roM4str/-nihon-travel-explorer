## Summary

PR #3 now uses **automatic Firebase Anonymous Auth**. The app opens the fixed shared trip (long random ID from `VITE_FIREBASE_TRIP_ID`) without Google/email-link buttons, account setup or a sign-in screen. With missing required Vite configuration it remains local-only.

Each person's opinion on a place is its own Firestore document, `items/{placeId}~{slot}` (slot 0 or 1 in the shared roster; `~carried` for places carried over from the single-list era); the roster and the planner live in `state/roster` and `state/planner`. Merge by document timestamp, retain tombstones, and compare outgoing edits in transactions. Network, Auth, permission, quota and empty-remote failures preserve local data. The complete planner remains one atomic shared document. Portable exports and old imports keep their format; the backup's rendered copy is guarded against mentioning sync/cloud/sign-in without configuration.

### Fixes from Claude's review

- **C1:** likes are stored per place **and per traveller slot** (`items/{placeId}~0`, `~1`, `~carried`), never by anonymous UID, so both people can mark the same place offline without one overwriting the other. Stances of a profile that is no longer slot 0/1 are not published.
- **C2:** a device without a plan never publishes an empty planner; the client and the rules both reject it.
- **C3:** rules only allow the one trip ID, have no hard delete (tombstones only), validate exact shapes and sizes, and refuse an empty plan or empty roster, so the trip cannot be wiped in one write.
### Fixes from Claude's third review (on 2bb046f)

No change to `firestore.rules`, `VITE_FIREBASE_TRIP_ID` or the document format; existing documents keep working.

- **N11:** a held mass removal now offers «No, conservar los nuestros» besides «Sí, quitar…». Keeping republishes this phone's likes over the remote tombstones as updates of the same documents with a newer timestamp (the published rules already allow a tombstone → live update; a rules test checks it) and sync resumes.
- **N12:** Nosotros → Copia del viaje → «Recuperar copia de antes de sincronizar» lists the daily and rotating pre-sync copies; choosing one turns it into a normal backup file that goes through the same preview and shared-trip confirmation as «Importar respaldo».
- **N1b:** on a device's first join, if its people's names don't match the shared roster (and it has opinions to publish), sync asks «¿Quién eres en este viaje?» with the shared names and puts the person holding the phone in that slot before publishing anything. Devices that already joined are never asked.
- **24 h counter (optional item):** remote removals applied automatically are counted per device for 24 h; once the total would pass 10, the next one is held with the same confirmation. Confirming either way resets the counter.

### Fixes from Claude's second review (on 82c1e0f)

- **N1:** «Viaje compartido» again says to keep both people in the same order on both phones. Guard: if this phone lists the same two names as the shared roster but in the opposite order, sync is held (nothing published or applied) with a message to fix the order.
- **N2:** a remote change that would remove more than 10 likes, or more than 30% of this phone's likes (at least 3), is not applied automatically: a backup is kept and the people confirm it with a button. Rules deny creating a document that is already a tombstone; the client never publishes a tombstone for a like the server never had.
- **N3:** besides the 5 rotating pre-sync copies, the first copy of each day is kept for 7 days (`nihon.recovered.before-sync.daily-YYYY-MM-DD.*`). A full storage shows its own message.
- **N4 (decision):** emptying the plan on one phone does not empty it for both; sync restores the shared plan (no data loss). This is intentional for now so that a phone without a plan can never erase the other's. Fernando can ask for an explicit «vaciar el plan compartido» action later.
- **N5:** the rules test reads the trip ID from `firestore.rules` and checks `app/.env.example` matches. `.env.example` keeps the real public values because they are not documented anywhere else in the repo for Vercel.
- **N7/N10:** tests for a roster with more than 2 travellers, a malformed remote item, and listener backoff.
- **N8:** data errors no longer tell people to check their connection.
- **N6 (not done):** the iPhone preview workflow does not inject `VITE_FIREBASE_*`; it would need repository secrets/variables and the same `persist-credentials` change as P-06.

- **A2–A6:** importing a backup while sync is on asks for confirmation; pre-sync backups rotate (last 5) plus one per day for 7 days; invalid remote documents are skipped (quarantined) and listeners reconnect with backoff; sync starts automatically.
- es-MX: «Añadid»/«Cread» fixed, sync texts use *ustedes*, no sign-in copy, «¿Quiénes sois?» removed from the CSS comment.
- CI: `p06-certification.yml` checkout uses `persist-credentials: true` so the historical-base `git fetch` can authenticate on the private repo.

Design and audit: [SYNC_PLAN.md](SYNC_PLAN.md). Mexican Spanish inventory: [ES_MX_CHANGES.md](ES_MX_CHANGES.md).

## Firebase setup — Fernando

1. Use the existing **nihon-b11c6** project on **Spark**, with Firestore Standard in production mode.
2. Enable **Authentication → Sign-in method → Anonymous**. Google and email link may remain enabled in the project, but this app has no UI or calls for them. No user emails, UID allowlist or `members` field are required. No root `/trips/{tripId}` document needs to be created; allowed item/state documents are created by sync.
3. In **Authentication → Settings → Authorized domains**, add **nihon-travel-explorer.vercel.app**.
4. Copy `app/.env.example` to `app/.env.local` for local setup. It contains the six supplied public web configuration values plus **`VITE_FIREBASE_TRIP_ID` with a long random ID (40 characters)**. The app reads only `import.meta.env`, with no hardcoded runtime fallback. Missing API key, Auth domain, project ID, app ID or trip ID disables sync. Storage bucket and messaging sender ID are included in the example but unused by Auth/Firestore.
5. Deploy the repository's `firestore.rules`. From `app/`, authenticate the Firebase CLI as the project administrator, then run:

   ```sh
   npx firebase deploy --config ../firebase.json --only firestore:rules --project nihon-b11c6
   ```

   Alternatively paste these rules into the Firestore console and publish. Deploy them before using the configured app; replace any old membership-based rules. Rules are fixed to that same random trip ID: another env trip ID will be denied and local data retained.
6. **Orchy will decide Vercel environment injection later.** No Vercel variables or production deployment were changed here. Vite embeds env values at build time; rebuild/redeploy after injection is configured. `.env.example` is a setup template, not an automatically loaded env file. Do not put private keys or service-account credentials in Vite variables.
7. Export backups on both devices before the first connection. **Keep the two traveller profiles in the same order (Persona 1 and Persona 2) on both phones**; if the names are swapped, sync stops and says so. Open the configured app on the first device, allow it to publish, then open it on the second. Authentication and joining are automatic. If a terminal rules/provider error occurred before setup was corrected, reload to recreate listeners.

## Privacy trade-off

**Anyone with access to the app can read and edit this shared trip.** Any authenticated Firebase user, including anonymous users, can access the allowed documents under `/trips/{tripId}`. There is no restriction to two people. Public config, the trip ID and authorized domains do not act as a private invitation or membership boundary.

Rules deny unauthenticated access, other trips, root metadata, unknown state documents, unrelated paths and hard deletes. They enforce exact wire keys/types, ID/author lengths, timestamps, one stance per place and slot (0/1), at most two profiles, profile label lengths, a non-empty plan with bounded route IDs and a bounded planner JSON string. An empty plan or empty roster is denied. These bounds reject oversized/malformed wire shapes; they do not prevent valid unwanted edits or quota exhaustion by visitors. Keep offline portable backups.

## Merge and device clock

Tombstones remain `deleted:true` with `updatedAt`; a winning explicit tombstone removes a saved place. Empty remote data and errors never mean deletion. Place/roster wire payloads are typed maps/arrays so rules can validate them; local journals and portable backups retain their JSON representation. The planner payload stays an atomic JSON string capped at 250,000 characters. Rules cannot parse JSON; the client validates planner syntax/schema/references and fails closed without changing the local trip on invalid data. An authenticated visitor can submit a bounded invalid planner string and interrupt sync until an administrator repairs it.

`updatedAt` still uses device epoch milliseconds. **Server timestamps were not substituted:** arrival-order timestamps would make old offline edits look newer than remote work and change the existing merge contract. A safe migration requires pending-edit/base-revision handling and journal migration. Clock skew can bias LWW; rules reject values more than five minutes ahead of server time and non-monotonic updates. Correct device time before editing. Already stamped future pending edits can remain blocked until server time catches up or their journal metadata is repaired after preserving a backup; reload alone does not restamp them. Concurrent edits to the same place/roster/whole planner can lose the older change.

## Validation results

Rerun on Java 21 after the review fixes (see the *Verificado por Gpt* section of the PR for the exact run).

| Command (in `app/`) | Result |
|---|---|
| `npm run lint` | 0 errors; 2 existing warnings (PlaceMap fast refresh, TripBackup set-state-in-effect) |
| `npm run build` | Passed; large-chunk warning remains; Firebase stays in a lazy chunk |
| `npm test` | 127 files, 3,503 tests passed |
| `npm run test:rules` | Real Firestore emulator: all 8 tests passed (positive cases plus negatives for unauthenticated, other trip incl. `japon-2026`, delete, empty plan/roster, malformed/oversized docs) |
| `git diff --check` | Passed |

In the restricted environment, run the real emulator with repository-local cache/config directories:

```sh
XDG_CONFIG_HOME="$PWD/.firebase/config" \
FIREBASE_EMULATORS_PATH="$PWD/.firebase/emulators" npm run test:rules
```

Verified: anonymous Auth startup/restoration/retry/cleanup, no listeners before anonymous confirmation, typed wire round trips and legacy reads, unconfigured backup rendering, missing-env fallback, LWW/ties, tombstones, empty/error preservation, in-flight edits, pending retries, first-device/empty-second-device merge, and old export/import compatibility. Emulator verification covers anonymous/other authenticated users, unauthenticated denial, other trip/unknown path denial, empty plan/roster denial, envelope/stance/roster/planner bounds and hard-delete denial; the rules-check reads the trip ID from `app/.env.example`. Production Anonymous provider enablement, deployed rules/authorized domain, Vercel injection and two physical devices are not verified by local tests. No production Firebase writes or deployments were made.

## Known risks

- This is a publicly accessible authenticated shared trip, with the privacy/abuse trade-off described above.
- Device clock LWW and per-document concurrency can lose older edits. The planner is atomic, not a collaborative editor.
- Tombstones accumulate indefinitely; visitors and listener reconnects consume Spark quotas. Quota errors preserve the local trip.
- Clearing browser/Auth storage can change the anonymous UID; there is no account recovery UI. Local canonical data is not automatically cleared.
- First join maps profiles by slot. Keep the same person order on both devices. This app has one fixed trip; switching to unrelated local data can publish it to that trip.
- Local rollback still depends on functioning browser storage; rotating and daily preimages are kept in `nihon.recovered.before-sync.*`. Continue exporting historical backups.
- Anyone with the trip ID can still tombstone likes; bursts and more than 10 removals in 24 h are held for confirmation (and can be rejected), smaller ones are applied. After a device has joined, the roster guard only detects the same two names in swapped order.
- Clearing the plan on one phone is undone by sync (N4 decision above).
- Multi-tab behavior depends on existing local journals and Web Locks where supported; physical-device/browser-specific races remain unverified.
- The pinned Firebase CLI is development tooling; dependency installation reported transitive advisories/engine preferences. No unrelated dependency-wide upgrades were attempted.

## Workspace handoff

Changes are committed and pushed on `codex/nihon-firestore-sync` for the existing PR #3 (not merged). Orchy will decide Vercel env injection later.
