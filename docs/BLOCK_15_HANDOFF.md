# Block 15 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/sleepy-heisenberg-hn7340` |
| SHA at start | `de653b28ddd6f8380a3e5f9c8ee91046ca5d1239` (Block 14 closed) |
| SHA at end | the head commit — `git log -1` on the branch is the authority |
| `origin/main` | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` — **untouched** |
| Merge base | **`1a11fe8`** — exactly `origin/main`; a clean fast-forward ancestry |
| Ahead / behind at start | **42 / 0** |
| Merge · Ready · tag · Release · deploy | **none.** Forbidden by this block and not done. |
| Working tree | Clean. |
| Block 15 status | **Closed.** |

## Verdict

> ## RC-READY — PENDING IPHONE ACCEPTANCE

## Release identity

| | |
|---|---|
| Previous release | **v1.0.0** — tag `v1.0.0` → `1a11fe8`, GitHub Release "Nihon v1.0.0", published **2026-09-17**, non-draft, non-prerelease |
| This candidate | **v1.1.0** |
| `v1.1.0` tag | **did not exist** before this block, and **was not created** |
| `v1.1.0` Release | **did not exist**, and **was not created** |
| Colliding PR | none — the only open PR is #122, `codex/…` → `experiment/astra-redesign`, unrelated |

**v1.0.0 is the historical `main` from before Blocks 1–14.** Its tag was not moved, its Release was
not edited, and `docs/RELEASE_V1.0.0.md` / `docs/FINAL_RELEASE_GATE.md` were not rewritten — they
remain the record of that release, including its "144 photographs" figure, which was correct then.

**Why 1.1.0:** backward-compatible feature release. MINOR under semver — substantial new
capabilities, nothing broken, and a v1.0.0 saved list migrates automatically.

## Baseline reproduced before any edit

From a removed `node_modules` and a fresh `npm ci`:

Vitest **3179 / 92** · lint clean · `tsc` clean · build clean (Vite advisory allowed) · Python
**13/13** · validators **8/8** · Block 1 **142** · 2 **69** · 3 **105** · 4 **261** · 5 **225** ·
6 **216** · 7 **129** · 8 **114** · 9 **153** · 10 **81** · 11 none by design · 12 **81** ·
13 **156** · 14 **226** · `git diff --check` clean. **Every figure matched.**

## Files changed

| file | change |
|---|---|
| `app/package.json` | `1.0.0` → `1.1.0` (one line) |
| `app/package-lock.json` | root `version` and `packages[""].version` (two lines) |
| `README.md` | current-status section → v1.1.0, links the new notes, photography stated as 157/163 |
| `docs/RELEASE_V1.1.0.md` | **new** |
| `docs/BLOCK_15_RELEASE_CANDIDATE.md` | **new** |
| `docs/BLOCK_15_HANDOFF.md` | **new** |
| `docs/ROADMAP.md` | Block 15 entry |

**No product code.** `git diff de653b2` over `app/src/**`, `data/**`, `app/public/**`, `scripts/**`
and `app/scripts/**` is **empty**. No dataset, image, validator, historical audit, test or CSS was
touched.

## Dependency proof

| check | result |
|---|---|
| package-entry sets identical | ✅ |
| no non-root entry changed in **any** field | ✅ |
| root entry differs **only** in `version` | ✅ |
| `dependencies` / `devDependencies` identical (both files) | ✅ |
| no `resolved` / `integrity` / non-root `version` changed | ✅ **172 entries each** |
| `lockfileVersion` unchanged | ✅ |
| `npm ci` does not rewrite the lockfile | ✅ byte-identical before **and** after the bump |
| **build neutrality** | ✅ **all 333 `dist/` files byte-identical** to the pre-bump build |

The version is not consumed at runtime — no `__APP_VERSION__`, no `import.meta.env` version, no
`package.json` import in `src/`, `vite.config.ts` or `index.html`.

## Final gate

Vitest **3179 / 92** · lint · `tsc` clean · build clean · Python **13/13** · validators **8/8** ·
`git diff --check` clean · bundle **1,389,652 B raw / 253,742 B gzip / 203,791 B brotli**, 2 deferred
chunks — unchanged from Block 14, so Block 12's architecture is intact.

Browser audits, all at their exact expected figures, **1,958 checks total**:

| Block | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| checks | 142 | 69 | 105 | 261 | 225 | 216 | 129 | 114 | 153 | 81 | — | 81 | 156 | 226 |

> **One recording note, not a failure.** In the first batch run, Block 4's summary line was missing
> from the captured output. Re-run on its own it reports **261 passed, 0 failed, exit 0**, and a
> second batch run capturing per-audit exit codes confirmed all thirteen. The first batch's `grep`
> dropped a line containing a multi-byte character; **no audit regressed.** Recorded rather than
> quietly re-run, because a release gate should not hide a missing measurement.

## Pull request

A **draft** PR from `claude/sleepy-heisenberg-hn7340` into `main`, titled
**"Nihon v1.1.0 — Blocks 1–15 release candidate"**. It carries the base and head SHAs, the delta
from v1.0.0, the Block 14 verdict, this gate's results, test and audit totals, the known
limitations, the release identity, a link to `docs/RELEASE_V1.1.0.md`, and the explicit statement
that **no merge, tag or GitHub Release may happen until the physical iPhone backup acceptance check
is recorded.**

It is **draft on purpose** and must not be marked Ready before that check passes.

## Known limitations

1. **The portable backup has not run on a physical iPhone.** A gap in evidence, not a known defect.
   **This is the only item gating the release.**
2. The 160 editorial ratings have one reader. Presented as opinion, never as fact.
3. A subpath deployment needs Vite's `base`. At a domain root, nothing is required.
4. On a phone, an expanded saved-places sheet can overlay the national start screen; one tap
   collapses it.
5. No throttled-network or CPU measurement; no first-paint or TTI figure is claimed.
6. No WCAG conformance level is claimed.

## The iPhone acceptance check — exact steps

Open Nihon in **Safari on a physical iPhone** and run this once:

1. open the app;
2. make sure there is a real trip: mark a few places, ideally as both travellers, and open the
   planner so a plan exists;
3. tap **⤓ Respaldo del viaje** in the header;
4. tap **Exportar respaldo**;
5. **confirm iOS offers and saves the `.json`** (Files, Downloads, or the share sheet);
6. change something — mark another place, or unmark one;
7. reopen **Respaldo del viaje** → **Importar respaldo**;
8. select the file saved at step 5;
9. check the preview, then tap **Sustituir con este respaldo**;
10. tap **Continuar** (the app reloads — this is required, not cosmetic);
11. confirm the trip from step 2 is back and the step-6 change is gone;
12. reload Safari and confirm it is still restored.

**PASS** — the export produces a usable file and the import restores the trip.
**FAIL** — the file cannot be saved, selected, read or restored correctly.

**"I did not test it" is not a PASS.** Record the result in the PR.

## Exact procedure after a PASS

Not executed here. In this order:

1. confirm `main` has not changed since `1a11fe8`;
2. confirm the PR is clean and mergeable;
3. re-run the affected gate (at minimum `npm ci`, `npm test`, `npm run build`, and the browser
   audits) if anything changed;
4. mark the PR **Ready for review**;
5. merge via a **merge commit** (not squash, not rebase — the 42+ commits are the audit trail);
6. verify `main` now contains the merge commit;
7. create an **annotated** tag `v1.1.0` targeting **that exact merge commit on `main`**;
8. create a GitHub Release named **"Nihon v1.1.0"**, **non-draft**, **non-prerelease**, with notes
   from `docs/RELEASE_V1.1.0.md`;
9. do **not** deploy — hosting is a separate later decision with a provider, a URL, a known
   root/subpath and a real smoke test.

## Prohibition

**No merge, no Ready, no tag, no GitHub Release and no deployment before the iPhone acceptance check
is recorded as PASS.** Everything else is ready and waiting on that one result.

## Update — Block 16

The physical iPhone Safari acceptance check has since been run on a real device against a Vercel
preview built from this exact candidate SHA and recorded as **PASS** on PR #123. Release closure —
merge, tag, GitHub Release — is carried out in Block 16; see
[`docs/BLOCK_16_V1_1_RELEASE_CLOSURE.md`](BLOCK_16_V1_1_RELEASE_CLOSURE.md) and
[`docs/BLOCK_16_HANDOFF.md`](BLOCK_16_HANDOFF.md) for the final record. This document is left
otherwise unedited.
