# Block 16 — Nihon v1.1.0 release closure

This block adds no product. It closes the v1.1.0 release candidate opened in Block 15, now that a
physical iPhone Safari acceptance check exists for the portable backup — the single item Block 15
left outstanding.

---

## 1. Preflight

| # | Invariant | Required | Observed |
|---|---|---|---|
| 1 | `git fetch origin` | — | done |
| 2 | `origin/main` | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` | **`1a11fe8cfd2fb1b2ed31c463472181f2a29cba81`** |
| 3 | Release candidate branch | `claude/sleepy-heisenberg-hn7340` | matches |
| 4 | Release candidate HEAD | `a6f805896c41ba1858c4d187df69836572fb80c1` | **`a6f805896c41ba1858c4d187df69836572fb80c1`** |
| 5 | PR #123 | open, draft, not merged, base = `main`@`1a11fe8`, head = the SHA above | confirmed via the GitHub API |
| 6 | Ahead / behind `main` | 45 / 0 | **45 / 0** |
| 7 | Working tree | clean | clean |
| 8 | `v1.1.0` tag | must not exist | confirmed absent, local and remote |
| 9 | `v1.1.0` GitHub Release | must not exist | confirmed absent — the only release is `v1.0.0` |

No identity mismatch was found. Preflight passed without needing to stop.

---

## 2. Physical iPhone Safari acceptance

Recorded as a comment on PR #123. Summary:

> **iPhone Safari acceptance — PASS.** A real iPhone running Safari opened a Vercel preview built
> from content identical to `a6f8058` (the temporary branch `preview/iphone-v1-1-0` — one empty
> commit above the RC tree, created only to trigger the preview; no product change). Export produced
> a usable `.json`, iOS saved it, import accepted the saved file, restore replaced local state with
> the backed-up state, the required reload completed, and the restored state remained present.

**Why "importing another device's backup replaces local state" is not a defect.** The check also
surfaced that importing a second device's backup overwrites the current device's state rather than
merging it. That is exactly the semantics specified for the portable backup in Block 13: **replace,
never merge**, no account, no server, no automatic sync. The physical run demonstrated the design
working as written, not a bug in it. It is **not** evidence of cross-device synchronization, which
Nihon has never claimed and does not attempt in v1.1.0 — see §13 below and the PR comment for the
exact wording used to avoid overstating what was tested.

No product defect of any severity was found by the physical acceptance check.

---

## 3. Verdict change

Block 15 closed as:

> RC-READY — PENDING IPHONE ACCEPTANCE

With the physical check now recorded as PASS and no new regression found by the final gate (§6),
this block closes as:

> ## RELEASE-READY

Cross-device / shared-trip synchronization is **not** a blocking condition for v1.1.0. It is a new
capability under evaluation for a later release (§13), not a promise this release ever made.

---

## 4. Pre-merge recheck

Re-verified immediately before marking the PR Ready, per Block 15's own handoff procedure:

| Check | Result |
|---|---|
| `origin/main` | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` — unchanged |
| Branch | `claude/sleepy-heisenberg-hn7340` — unchanged |
| PR #123 | open, draft, `mergeable_state: clean`, base/head SHAs unchanged |
| `v1.1.0` tag | still absent |
| `v1.1.0` Release | still absent |
| New divergence | none — merge base still exactly `main` |
| Working tree | clean |
| Product-code diff since Block 15 | none — no commit was added to the branch by this block |

---

## 5. Final automated gate

Run from a fresh `npm ci` on the exact release-candidate SHA, in this environment, independently —
not copied from the PR body.

| Gate | Expected | Observed |
|---|---|---|
| Vitest | 3179 / 92 files | **3179 / 92** |
| Lint (`oxlint`) | clean | clean, exit 0 |
| `tsc -b` | clean | clean (part of `npm run build`) |
| `vite build` | clean | clean, exit 0 (Vite 500 kB advisory present and deliberately not silenced) |
| Python suites | 13 / 13 | **13 / 13** (572 tests, 149 subtests) |
| Validators | 8 / 8 | **8 / 8** |
| `node scripts/bundle-report.mjs` | matches Block 15's figures | **1,389,652 B raw / 253,742 B gzip / 203,791 B brotli**, 2 deferred chunks — unchanged |
| `git diff --check` (working tree) | clean | clean |

### Browser audits — 13 suites, against the production build via `vite preview`

| Block | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| expected | 142 | 69 | 105 | 261 | 225 | 216 | 129 | 114 | 153 | 81 | — | 81 | 156 | 226 |
| observed | **142** | **69** | **105** | **261** | **225** | **216** | **129** | **114** | **153** | **81** | — | **81** | **156** | **226** |

**Total: 1,958 / 1,958 — exact.** Block 11 carries no browser audit by design, unchanged from every
prior gate. No test, assertion or audit was modified, skipped or weakened to reach these figures.

**No regression found.** Every figure reproduces Block 15's gate exactly, on the same untouched SHA.

---

## 6. Ready

With every check in §4 and §5 green, PR #123 was marked **Ready for review** (no longer draft).
Auto-merge was **not** enabled. Immediately re-verified: `mergeable_state: clean`, no conflicts,
base SHA `1a11fe8` and head SHA `a6f8058` unchanged from preflight.

---

## 7. Merge

PR #123 was merged into `main` using a **merge commit** — not squash, not rebase — preserving the
45-commit audit trail of Blocks 1–16. The resulting `main` SHA and the merge commit SHA are recorded
in [`docs/BLOCK_16_HANDOFF.md`](BLOCK_16_HANDOFF.md), together with confirmation that the merge
commit's first parent is the pre-merge `main` (`1a11fe8`) and its second parent is the PR head
(`a6f8058`), and that the working tree is clean after the merge.

---

## 8. Tag and GitHub Release

An annotated tag `v1.1.0`, message `Nihon v1.1.0`, was created on the exact merge commit and pushed.
A GitHub Release named **"Nihon v1.1.0"** was published from that tag, targeting the same merge
commit, **non-draft**, **non-prerelease**, with notes from `docs/RELEASE_V1.1.0.md`. `v1.0.0`'s tag
and Release were not touched. Exact SHAs and the Release URL are in
[`docs/BLOCK_16_HANDOFF.md`](BLOCK_16_HANDOFF.md).

---

## 9. No production deployment

This block closes Git only: the branch, `main`, the tag and the GitHub Release. It does **not**
promote the Vercel preview, does **not** touch the `nihon-travel-explorer.vercel.app` production
deployment, and does **not** choose a hosting provider for v1.1.0. Hosting is a separate, later
decision with its own URL and its own smoke test.

---

## 10. Temporary preview branch

`preview/iphone-v1-1-0` was created solely to trigger the Vercel preview used for the physical
acceptance check. It carries one empty commit above the exact RC tree and is not part of the
product — its state after this block (kept or deleted, and why) is recorded in
[`docs/BLOCK_16_HANDOFF.md`](BLOCK_16_HANDOFF.md).

---

## 11. Discovery for v1.2.0 — shared-trip synchronization

The physical acceptance check surfaced a legitimate, previously undocumented product need: two
people using Nihon from separate devices want their decisions to stay in step without manually
exporting and importing a backup file each time. The current backup model is portable **restore**,
not **sync** — replace, never merge, no cloud, no accounts, no automatic reconciliation — and that
remains correct for v1.1.0.

For v1.2.0, the following is recorded as **input to evaluate**, not as anything designed or
committed in this block: shared trip identity; an invite link, code or QR; a per-device traveller
identity; shared planning state; a per-traveller "Quiero ir" signal held centrally rather than only
locally; live or eventual synchronization; conflict semantics; offline/reconnect behaviour;
permissions and security; and a backend choice. No backend provider (Supabase, Firebase, Vercel KV,
or any other) is selected here. The next block that picks this up should start from architecture and
a threat/data model, not from an implementation.

---

## 12. Verdict

> ## RELEASE-READY

Merge, tag and GitHub Release completed as recorded in
[`docs/BLOCK_16_HANDOFF.md`](BLOCK_16_HANDOFF.md).
