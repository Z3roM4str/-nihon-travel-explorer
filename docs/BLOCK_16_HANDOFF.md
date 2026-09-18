# Block 16 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Status

> ## RELEASE CLOSURE FAILED — merged to main, tag and GitHub Release not created

Git closure (merge) succeeded exactly as designed. The tag and GitHub Release steps could not be
completed in this session because of an environment permission restriction, described exactly in
§6. Nothing was faked, skipped or silently substituted to reach a green verdict.

## Physical iPhone acceptance

Recorded on PR #123 as a comment: **PASS**. A real iPhone running Safari opened a Vercel preview
built from content identical to `a6f8058` (temporary branch `preview/iphone-v1-1-0`, one empty
commit above the RC tree). Export produced a usable `.json`, iOS saved it, import accepted the
saved file, restore replaced local state with the backed-up state, the required reload completed,
and the restored state remained present. Importing another device's backup replacing local state
was observed and is the intended replace-not-merge semantics specified in Block 13, not a defect —
it is not cross-device synchronization. Full record:
[`docs/BLOCK_16_V1_1_RELEASE_CLOSURE.md`](BLOCK_16_V1_1_RELEASE_CLOSURE.md).

## Final gate — reproduced independently, exact figures

| Check | Result |
|---|---|
| Vitest | **3179 / 92** |
| Lint (`oxlint`) | clean |
| `tsc -b` / `vite build` | clean |
| Python suites | **13 / 13** (572 tests, 149 subtests) |
| Validators | **8 / 8** |
| `bundle-report.mjs` | 1,389,652 B raw / 253,742 B gzip / 203,791 B brotli — unchanged |
| `git diff --check` | clean |
| Browser audits, 13 suites | 142 · 69 · 105 · 261 · 225 · 216 · 129 · 114 · 153 · 81 · — · 81 · 156 · 226 |
| **Total browser checks** | **1,958 / 1,958 — exact** |

No regression. Every figure matched Block 15's gate on the same untouched product SHA.

## PR Ready

PR #123 was marked **Ready for review** (no longer draft) after the acceptance comment and the
Block 16 docs commit (§ below) were in place. `mergeable_state` was `clean` immediately before
merge.

## Merge

| | |
|---|---|
| Merge method | **merge commit** (not squash, not rebase) |
| PR head before merge | `d00d4a56a0bd82aa503cd057b50c0606bc4163d6` (Block 15's `a6f8058` plus one Block 16 docs commit adding the acceptance record and this closure's evidence) |
| Base before merge | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` |
| **Merge commit SHA** | **`d72e19921b4aa9c9f68d0d07f8b35f37f158a286`** |
| Merge commit parents | `1a11fe8…` (pre-merge `main`, first parent) and `d00d4a5…` (PR head, second parent) — verified with `git log -1 --format="%P"` |
| `main` after merge | **`d72e19921b4aa9c9f68d0d07f8b35f37f158a286`** — verified with a fresh `git fetch origin main` |
| PR head is ancestor of `main` | verified with `git merge-base --is-ancestor` |
| Working tree | clean |

## Tag — not created

An annotated tag `v1.1.0` was created **locally** on `d72e199`, message `Nihon v1.1.0`. Pushing it
(`git push origin v1.1.0`, plain and as an explicit `refs/tags/...` refspec) was refused by GitHub
itself with **HTTP 403** on the `git-receive-pack` request, confirmed with `GIT_CURL_VERBOSE=1`
(the 403 comes from `github.com`, not from the outbound proxy — TLS and routing succeeded). Retried
three times; not transient. Branch pushes and the PR merge succeeded from the same session, so this
is a restriction specific to creating a tag ref, most likely a repository tag-protection rule or a
narrower permission scope on the git credential than on the API token used for the PR/merge/comment
calls. The local tag was deleted afterward so no unpublished tag is left lying around to drift from
`origin`.

**No MCP tool available in this session can create a tag or a GitHub Release** (only read tools —
`get_tag`, `get_release_by_tag`, `list_releases` — are exposed). Creating the tag therefore requires
either: (a) a credential/token with tag-ref push permission, or (b) an API-level "create ref" /
"create release" tool added to the session's toolset.

## GitHub Release — not created

Blocked transitively by the tag: GitHub Releases are created against a tag (or a `target_commitish`
that would auto-create one), and no MCP write tool for releases is available. **Not attempted**
against `main` directly, since that would create the Release without the intended annotated tag
object and message.

## What remains to close this out

1. Create annotated tag `v1.1.0` on `d72e19921b4aa9c9f68d0d07f8b35f37f158a286`, message `Nihon v1.1.0`,
   and push it — needs a credential with tag-push permission, or a tag-creation API call.
2. Publish a GitHub Release named **"Nihon v1.1.0"**, target `d72e19921b4aa9c9f68d0d07f8b35f37f158a286`,
   non-draft, non-prerelease, notes from `docs/RELEASE_V1.1.0.md`.
3. Re-verify `v1.0.0`'s tag and Release are untouched (they were not touched by anything in this
   block, and nothing here had permission to touch them either).

## No production deployment

Not attempted, as instructed. The Vercel preview used for the iPhone acceptance check
(`preview/iphone-v1-1-0`) was not promoted, and the production deployment was not touched.

## Temporary preview branch

`preview/iphone-v1-1-0` still exists, remote-only, one empty commit above the exact RC tree. It was
**not** deleted in this block: with the tag/Release still outstanding, removing the branch that
produced the only physical evidence for this release felt premature. It is not part of the product
and must not be confused with a development branch. Safe to delete once §"What remains" is closed
and the preview is no longer needed for reference.

## Shared-trip synchronization — discovery for v1.2.0

The physical acceptance check surfaced a real need: two people using Nihon on separate devices want
to stay in step without manually exporting and importing a backup file. The current backup model —
replace, never merge, no cloud, no accounts, no automatic sync — remains correct for v1.1.0. For
v1.2.0, evaluate (not build): shared trip identity, an invite link/code/QR, per-device traveller
identity, shared planning state, a centrally-held per-traveller "Quiero ir" signal, live/eventual
synchronization, conflict semantics, offline/reconnect behaviour, permissions/security, and a
backend choice. No backend provider was selected or added in this block. Full note:
[`docs/BLOCK_16_V1_1_RELEASE_CLOSURE.md`](BLOCK_16_V1_1_RELEASE_CLOSURE.md) §11.

## v1.0.0

Untouched. Its tag still resolves to `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81`, and it remains the
repository's only published GitHub Release.
