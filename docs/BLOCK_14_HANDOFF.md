# Block 14 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/sleepy-heisenberg-hn7340` |
| SHA at start | `894fdc66145c91acfdee74d780488bc4b1982cfc` (Block 13 closed) |
| SHA at end | see `git log -1` on the branch — the head commit cannot carry its own hash |
| `origin/main` | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` — **untouched** |
| Position vs `origin/main` | merge-base **is** `origin/main`; branch is ahead, never behind |
| Merged? PR? Tag? Release? Deploy? | **None.** Explicitly forbidden by this block and not done. |
| Working tree | Clean. |
| Block 14 status | **Closed.** |

## Verdict

> ## RELEASE-READY WITH KNOWN LIMITATIONS

No BLOCKER and no MAJOR remain. Four limitations must be stated before publishing — see §Findings
and [`docs/BLOCK_14_RELEASE_READINESS.md`](BLOCK_14_RELEASE_READINESS.md) §11.

## Preflight, as run

| check | expected | found |
|---|---|---|
| branch | `claude/sleepy-heisenberg-hn7340` | same |
| local HEAD · `origin/…` | `894fdc6…` | both `894fdc6…` |
| `origin/main` | `1a11fe8…` | `1a11fe8…` |
| merge-base with `origin/main` | — | **`1a11fe8`** — branch strictly ahead |
| ahead / behind | ahead, not behind | **38 / 0** |
| working tree | clean | clean |

Local `main` is stale at `b924f5c`, as it has been since Block 6. Not used as authority, not touched.

## Baseline reproduced before any edit

Vitest **3178 / 92** · lint clean · `tsc` clean · build OK (RC-05 advisory expected) · Python
**13/13** · argument-free validators **8/8** · Block 1 **142** · 2 **69** · 3 **105** · 4 **261** ·
5 **225** · 6 **216** · 7 **129** · 8 **114** · 9 **153** · 10 **81** · 12 **81** · 13 **156** ·
`git diff --check` clean. **Every figure matched.**

## Findings

| # | severity | finding | action |
|---|---|---|---|
| F-1 | **MINOR** | The backup revoked its object URL **synchronously** after the anchor click — no Chromium-only API, but a pattern Safari has historically cancelled downloads for, in the one feature whose purpose is moving a trip to another device. | **Fixed**: deferred to a macrotask. Regression test added and proven to fail against the previous code. |
| F-2 | **MINOR** | `app/README.md` claimed the photography registry holds **"144 of 214"** places. It holds **157 / 163 images**. | **Fixed.** |
| F-3 | **MINOR** | `docs/DATA_MODEL.md` claimed `nihon.savedPlaceIds` "**remain[s]**" the only persisted state — false since Block 5. | **Fixed**: the section now describes the derived shortlist and names the legacy key as legacy. |
| F-4 | **MINOR** | Both READMEs described a single-user "saved places" app; no two-traveller model, no portable backup; the docs index stopped at Block 3. | **Fixed**: current status and index now cover Blocks 4–14. |
| F-5 | **OBSERVATION** | On a phone an expanded saved-places sheet **intercepts pointer events** over the national start screen's hub cards. One tap collapses it; nothing is lost. | Not fixed — layout change is out of remit. Recorded. |
| F-6 | **OBSERVATION** | The MLIT map attribution link is ~12 px tall on a phone. Legal fine print, not a product control; Block 1 owns the floor and is green. | Not fixed. Recorded. |
| F-7 | **OBSERVATION** | `dist/` uses absolute asset paths (Vite `base` = `/`). Domain root is fine; a **subpath** deployment needs `base` set. | Not fixed — no provider chosen here. Remedy recorded. |
| F-8 | **DEBT** | 160 editorial ratings still have one reader. | **Not closed, not touched.** Opinion-labelled, so not a technical blocker. |
| F-9 | **DEBT** | Real Safari/iOS device test of the backup. | Logic audited; device pending. Drives the verdict. |

**No BLOCKER. No MAJOR.**

### False positives, all in this block's own instrumentation

1. *"zone comparison unreachable after multi-hub navigation"* — an overlay/sheet left on screen reads
   exactly like a missing feature. Led to F-5.
2. *"every JS chunk returned 200"* — counted **304 Not Modified** as failure; a cached response is a
   success. Now accepts 200/304, still fails any 4xx/5xx.
3. *"Osaka unreachable"* — the national view has **two** controls whose name starts with a hub name,
   and the first in DOM order was not the visible one.
4. **A seeded inter-hub segment silently rejected the whole draft** — wrong shape; the draft parser
   falls back to a fresh draft, so the seed *looks* applied in raw storage. Same failure class as
   Block 13's day shape.
5. *"a secret in `dist/`"* — matched React DOM's internal input-type table (`password: !0`).

## Files changed

| file | change |
|---|---|
| `app/src/usePortableBackup.ts` | F-1: deferred `URL.revokeObjectURL` |
| `app/src/lib/portable-backup.test.ts` | F-1 regression test (+1) |
| `app/scripts/block14-release-readiness-browser-audit.mjs` | **new** — the integration gate |
| `app/README.md` | F-2, F-4 |
| `README.md` | F-4 |
| `docs/DATA_MODEL.md` | F-3 |
| `docs/BLOCK_14_RELEASE_READINESS.md`, `docs/BLOCK_14_HANDOFF.md`, `docs/ROADMAP.md` | **new / updated** |

**No data file changed.** No dataset was re-researched, no `consultedAt` touched, no rating altered.
All 28 pre-existing files under `app/scripts/` are byte-identical to `894fdc6` by SHA-256.

## The new audit

`app/scripts/block14-release-readiness-browser-audit.mjs` — **226 checks** (76 phone · 75 tablet ·
75 desktop), all passing, against the production build.

It is one continuous journey, not thirteen mini-demos, and exists to catch what isolated audits
cannot: the **restore trap** (restore → forced reload → *then interact* → assert the replaced trip
did not return), **multi-hub contamination**, **traveller-switch → planner**, **lazy surfaces after a
restore-triggered reload**, and **legacy-storage migration**. It also intercepts every request for
the whole journey and proves OpenStreetMap tiles are the only external host.

## Tests

Vitest **3178 → 3179** (92 files, unchanged). One regression test for F-1.

## Audits — all green, all at baseline

| audit | baseline | final |
|---|---|---|
| Block 1 | 142 | **142** |
| Block 2 | 69 | **69** |
| Block 3 | 105 | **105** |
| Block 4 | 261 | **261** |
| Block 5 | 225 | **225** |
| Block 6 | 216 | **216** |
| Block 7 | 129 | **129** |
| Block 8 | 114 | **114** |
| Block 9 | 153 | **153** |
| Block 10 | 81 | **81** |
| Block 11 | no audit by design | no audit |
| Block 12 | 81 | **81** |
| Block 13 | 156 | **156** |
| **Block 14** | — | **226** |

No historical audit was modified. lint · `tsc` · build clean; Python **13/13**; validators **8/8**;
`git diff --check` clean.

## Bundle

| | Block 13 | Block 14 |
|---|---|---|
| initial JS raw | 1,389,634 B | **1,389,652 B** |
| initial JS gzip | 253,736 B | **253,742 B** |
| initial JS brotli | 203,677 B | **203,791 B** |
| deferred chunks | 2 | **2** |

**+6 B gzip** — the `setTimeout` from F-1. Block 12 intact: same two lazy chunks, no duplication, one
initial JS request, neither deferred surface preloaded. The Vite advisory still fires and is still
deliberately not silenced.

## Limitations to state before publishing

1. **Safari/iOS device verification of the backup download is outstanding.** Logic audited, one
   Safari-fragile pattern removed; no iPhone has run it.
2. **A subpath deployment needs Vite's `base` configured.** At a domain root, nothing is needed.
3. **The 160 editorial ratings have one reader.** Labelled as opinion, never as fact.
4. **An expanded saved-places sheet can overlay the national start screen on a phone**; one tap
   collapses it.

Also, as inherited: no throttled-network or CPU measurement, so no first-paint/TTI figure is claimed;
and no WCAG conformance level is claimed, because none was measured.

## Recommendation — the exact next step

**Run the backup export/import once on a real iPhone, then publish at a domain root.**

That single device test closes the only limitation that gates the verdict. It needs no code: open the
built site on an iPhone, export a backup, confirm Safari saves the file, re-import it and confirm the
trip returns. If it works, limitation 1 is discharged and the product is unconditionally ready. If it
does not, the finding is precise and small — the export mechanism is eight lines in
`usePortableBackup.ts`.

**When the decision to publish is taken**, it is a separate, explicit step that this block did not
take: no merge, no PR, no tag, no release, no deployment was performed.

**Explicitly NOT recommended:**

- **Adding a PWA, service worker or manifest.** Nothing in this audit needed one; none is required
  for Nihon to work on a phone (§17).
- **Closing the ratings debt by declaring a second reader.** Only the two travellers can.
- **Fixing F-5 with a layout redesign** inside a release gate.
- **Setting Vite's `base`** before a hosting path is actually chosen — it would break the root case.
- **Backend, accounts, sync or merge semantics.** Deliberately absent, and the product is honest
  about it.
