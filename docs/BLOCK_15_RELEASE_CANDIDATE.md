# Block 15 — Nihon v1.1.0 release candidate / integration gate

This block adds no product. It turns the audited work of Blocks 1–14 into a reproducible,
auditable release candidate for integrating `claude/sleepy-heisenberg-hn7340` into `main`.

---

## 1. Identity and ancestry

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/sleepy-heisenberg-hn7340` |
| Product SHA audited (Block 14 close) | `de653b28ddd6f8380a3e5f9c8ee91046ca5d1239` |
| `origin/main` | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` |
| Merge base | **`1a11fe8`** — exactly `origin/main` |
| Ahead / behind | **42 / 0** |
| Relationship | `origin/main` is a **direct ancestor**; the branch is a clean fast-forward descendant. No divergence, no rebase, no force-push. |

`main` did not change during this block. Verified at preflight and again before the pull request.

## 2. The previous release, and why this is 1.1.0

| | |
|---|---|
| Existing tag | **`v1.0.0`** → `1a11fe8` — the only tag in the repository |
| Existing GitHub Release | **Nihon v1.0.0**, published **2026-09-17**, non-draft, non-prerelease |
| `v1.1.0` tag | **does not exist** — local and remote both checked |
| `v1.1.0` Release | **does not exist** |
| Open PR for this integration | **none** — the only open PR is #122, `codex/…` → `experiment/astra-redesign`, unrelated |

**This branch is not v1.0.0.** `v1.0.0` is the historical `main` from before Blocks 1–14, and its
tag, its GitHub Release and `docs/RELEASE_V1.0.0.md` are left exactly as published.

**Why `1.1.0` and not `1.0.1`:** the delta is a backward-compatible *feature* release, not a patch.
It adds a two-traveller model, an accommodation-zone comparison layer, a provenance and freshness
model, a portable backup, and a phone-first discovery layer. Under semver that is a MINOR bump. It is
not `2.0.0` because nothing breaks: a browser holding a v1.0.0 saved list migrates automatically
through the existing authority, and no stored decision is discarded.

## 3. The delta, derived from the diff

Derived by comparing `v1.0.0..de653b28`, not by reading handoffs.

**42 commits · 327 files · +37,506 / −2,133**, of which 182 are new image assets under `app/public`,
79 under `app/src`, 30 docs, 14 Python scripts, 14 browser audits and 6 data files.

| area | what changed since v1.0.0 |
|---|---|
| **UX / discovery** | phone-first photo-led cards, plain-language interest level, `Lista`/`Mapa` switch, first-run explainer, save confirmation on every surface, shortlist filter bar |
| **Photography** | **144 → 163 images**, **144 → 157 places**; six galleries; card-sized renditions |
| **Accommodation zones** | new: 16 zones (Tokio 6 · Kioto 5 · Osaka 5), fact/derived/editorial kept apart, zone-seeded planner anchors |
| **Two-traveller model** | new: per-person stances, derived shared shortlist, roster management, carried-over migration from the v1.0.0 single list |
| **Divergence** | new: coincidences and disagreements reported as stated preferences, never as a score |
| **Planning** | stable day identity, whole-trip composition, evidence-complete local swap/relocation, manual inter-hub segments, draft schema V3 → V8 |
| **Provenance** | new: per-source `covers`, authority tier, evidence strings |
| **Airport links** | re-sourced to operator pages where one exists |
| **Editorial governance** | editorial ratings made reviewable and separated from fact |
| **Freshness** | new: `consultedAt` semantics and derived freshness states; age never treated as falsehood |
| **Performance architecture** | planner and zone comparison deferred with idle prefetch; reproducible `bundle-report.mjs` |
| **Portable backup** | new: versioned local export/import, replace-never-merge, best-effort rollback |
| **Accessibility** | labelled modals, focus management, Escape, tap-target floor enforced on new controls |
| **Documentation** | current-state corrections (photography count, persistence model, two-traveller and backup coverage) |

**The catalogue itself is unchanged at 214 places.** v1.1.0 adds no new research.

## 4. Baseline reproduced before any metadata change

| check | expected | found |
|---|---|---|
| Vitest | 3179 / 92 files | **3179 / 92** |
| lint · `tsc` · build | clean (Vite advisory allowed) | clean |
| Python suites | 13 | **13 / 13** |
| Argument-free validators | 8 | **8 / 8** |
| Block 1 · 2 · 3 · 4 · 5 | 142 · 69 · 105 · 261 · 225 | **exact** |
| Block 6 · 7 · 8 · 9 · 10 | 216 · 129 · 114 · 153 · 81 | **exact** |
| Block 11 | no audit by design | no audit |
| Block 12 · 13 · 14 | 81 · 156 · 226 | **exact** |
| `git diff --check` | clean | clean |

Run from a **removed `node_modules` and a fresh `npm ci`**, per the gate list.

## 5. Version metadata

Changed, in total, **three lines**:

- `app/package.json` — `"version": "1.0.0"` → `"1.1.0"`
- `app/package-lock.json` — the root `"version"` and `packages[""].version`

No `npm update`. No dependency touched.

### Dependency-drift proof

Machine-checked against the pre-bump lockfile, all passing:

| check | result |
|---|---|
| package-entry **sets** identical | ✅ |
| **no non-root package entry changed in any field** | ✅ |
| root entry differs **only** in `version` | ✅ |
| `dependencies` / `devDependencies` identical (both files) | ✅ |
| no `resolved` changed | ✅ **172 entries** |
| no `integrity` changed | ✅ **172 entries** |
| no non-root `version` changed | ✅ **172 entries** |
| `lockfileVersion` unchanged | ✅ |
| `package.json` otherwise identical | ✅ |
| **`npm ci` does not rewrite the lockfile** | ✅ byte-identical, before and after the bump |

### Build neutrality

The package version is **not consumed at runtime** — no `__APP_VERSION__`, no
`import.meta.env.*VERSION`, no `package.json` import anywhere in `src/`, `vite.config.ts` or
`index.html`.

A clean rebuild after the bump was compared file-by-file against the pre-bump build:

> **All 333 files in `dist/` are byte-identical (SHA-256).**

JS, CSS, assets, chunk names, the image registry and the runtime network surface are unchanged. The
release metadata is inert, as intended.

## 6. Scope

Changed in this block: `app/package.json`, `app/package-lock.json`, `README.md`,
`docs/RELEASE_V1.1.0.md`, `docs/BLOCK_15_RELEASE_CANDIDATE.md`, `docs/BLOCK_15_HANDOFF.md`,
`docs/ROADMAP.md`.

**Verified untouched:** `app/src/**`, `data/**`, `app/public/**`, `scripts/**`, `app/scripts/**` —
`git diff de653b2` over those paths is empty. No product code, no dataset, no image, no validator, no
historical browser audit, no test, no CSS.

Historical documents were **not rewritten**: `RELEASE_V1.0.0.md`, `FINAL_RELEASE_GATE.md`,
`RELEASE_CANDIDATE_AUDIT.md` and every per-block roadmap entry describe their own moment and are left
as written.

## 7. Release notes

[`docs/RELEASE_V1.1.0.md`](RELEASE_V1.1.0.md) — written from figures derived at this commit, not
carried from the v1.0.0 notes. It covers exploración, fotografía (157/163), dos viajeros,
planificación, alojamiento (16 zones, fact/derived/editorial), evidencia y freshness (explicitly not
live data), rendimiento (the real lazy boundaries; the Vite advisory explained as a raw-byte
threshold rather than a user problem), respaldo portátil, privacidad, non-goals, and known
limitations.

## 8. Final gate

| check | result |
|---|---|
| `rm -rf node_modules && npm ci` | clean, lockfile untouched |
| Vitest | **3179 / 92** |
| lint · `tsc` | clean |
| `vite build` | clean; Vite 500 kB advisory, known and deliberately not silenced |
| Python suites | **13 / 13** |
| Validators | **8 / 8** |
| Block 1 | **142** |
| Block 2 | **69** |
| Block 3 | **105** |
| Block 4 | **261** |
| Block 5 | **225** |
| Block 6 | **216** |
| Block 7 | **129** |
| Block 8 | **114** |
| Block 9 | **153** |
| Block 10 | **81** |
| Block 11 | no audit by design |
| Block 12 | **81** |
| Block 13 | **156** |
| Block 14 | **226** |
| **total browser checks** | **1,958** |
| Bundle | 1,389,652 B raw / 253,742 B gzip / 203,791 B brotli · 2 deferred chunks — unchanged |
| `git diff --check` | clean |

## 9. Known limitations carried into the candidate

1. **The portable backup has not run on a physical iPhone.** Logic audited against standards, no
   Chromium-only API, one Safari-fragile pattern removed in Block 14. **A gap in evidence, not a
   known defect** — and the single item gating this release.
2. **The 160 editorial ratings have one reader.** Presented as opinion, never as fact.
3. **A subpath deployment needs Vite's `base`.** At a domain root, nothing is required.
4. **An expanded saved-places sheet can overlay the national start screen on a phone.** One tap
   collapses it.
5. No throttled-network or CPU measurement; no first-paint or TTI figure is claimed.
6. No WCAG conformance level is claimed — accessibility was verified as a sanity gate.

## 10. Gate result

> ## RC-READY — PENDING IPHONE ACCEPTANCE

Every automated gate is green at the exact expected figures; the version metadata is correct and
provably inert; there is no dependency drift; no product code was touched; `main` has not diverged;
`v1.1.0` collides with nothing; and a **draft** pull request into `main` carries the evidence.

**The only outstanding item is a physical iPhone Safari acceptance check of export/import**, which
cannot be performed from this environment and must not be assumed. Until it is recorded as PASS:
no merge, no Ready, no tag, no GitHub Release, no deployment.
