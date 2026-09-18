# Astra SOL-0–SOL-2 browser runner

This runner is evidence infrastructure for PR review. It does not grant visual approval.

## CI entry point

`.github/workflows/astra-sol-0-2-browser-audit.yml` runs only for `pull_request` events whose base is
`experiment/astra-redesign`. It checks out `github.event.pull_request.head.sha` and compares the
actual checkout to that exact value before installing or running anything. Permissions are limited
to `contents: read`; it uses neither secrets nor `pull_request_target`.

The job installs locked npm dependencies and Playwright Chromium, builds the production bundle,
then runs:

```sh
npm run audit:astra:browser
```

`ASTRA_EXPECTED_SHA` is required. The script refuses to audit a different commit.

## Eight automated journeys

1. Required responsive viewports and horizontal overflow.
2. Planned-place unsave blocking and unchanged serialized V7 storage.
3. Detail Back/Forward and exploration scroll/state restoration.
4. Multi-category filters, reload durability, and list/map parity.
5. Detail modal focus isolation, Escape, and opener restoration.
6. Forced image failure, independent retry target, and no accidental detail open.
7. Initial-load map/planner/provider request absence and on-demand map loading.
8. 320px reflow, advanced-filter modal focus ownership, and a single live result region.

Each journey records a Playwright trace and a final screenshot. Journey 1 additionally records all
required viewport screenshots: 375×812, 390×844, 430×932, 768×1024, 1024×768, 1440×900, and
320×800 reflow. Assertions continue after an individual journey fails so evidence from the other
journeys is retained; the process exits non-zero after writing the aggregate result.

## Artifacts

The workflow always uploads one artifact named:

```text
astra-sol-0-2-<PR_HEAD_SHA>
```

Its source directory is `artifacts/astra-sol-0-2/` and contains:

- `checkout.txt` — expected and actual SHA, created before dependency installation;
- `runner.log` — complete streamed runner output;
- `results.json` and `summary.md` — machine/human result summaries;
- `screenshots/*.png` — viewport and final-state captures;
- `traces/*.zip` — Playwright traces with screenshots, snapshots, and sources.

The artifact upload uses `if: always()`, so checkout metadata and any evidence produced before a
failure remain available. Astra must still inspect screenshots/traces and classify fidelity; green
automation alone is not a visual PASS.
