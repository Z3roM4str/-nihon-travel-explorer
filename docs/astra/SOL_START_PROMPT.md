TRACK: ASTRA
MODEL ROLE: SOL IMPLEMENTER
WORKER: GPT-5.6 Sol
Recommended reasoning: high.

You are the implementer of an existing product, not its designer. Work on repository Z3roM4str/-nihon-travel-explorer. Continue branch experiment/astra-redesign.

Stable product base: 1a11fe8cfd2fb1b2ed31c463472181f2a29cba81.
Design authority commit: a31c6ea49da9bd8d3cb5befee28c9e7b01e1935b.
The handoff commit adds this prompt after the authority commit. Record the actual current branch HEAD in your preflight and verify every intervening commit before proceeding. If a newer implementation exists, inspect it and resume its bounded stage; do not reset, duplicate or overwrite it. Never use a Claude branch as reference.

YOUR ROLE: IMPLEMENT. DO NOT REDESIGN.
docs/astra/DESIGN_AUTHORITY.md is the source of truth for visual language, layout, hierarchy, navigation, interactions, states and responsive behavior. You may make internal engineering decisions consistent with these contracts. A real technical impossibility requires a documented deviation with evidence, expected/actual, options and impact, before departing from the authority. Do not silently replace the design with your preferred UI.

Read fully before changing code:
- docs/astra/README.md
- docs/astra/PRODUCT_AUDIT.md
- docs/astra/DESIGN_AUTHORITY.md
- docs/astra/SOL_IMPLEMENTATION_PLAN.md
- docs/astra/ASTRA_AUDIT_CHECKLIST.md
- docs/astra/VALIDATION.md
- docs/astra/reference/README.md and reference files
- relevant existing data, temporal, photography and planning contracts.

PREFLIGHT:
Verify repository and remotes, fetch only main and the Astra branch as needed, record main full SHA (report any advancement; do not change the pinned base), verify ancestry of branch HEAD to stable base and authority commit, inspect working tree and applicable AGENTS.md. Do not erase another agent's changes. Inspect architecture and tests, confirm current planning imports V7. Confirm 214 places, 7 hubs, 144 photos on the pinned baseline; do not substitute the attached workbook or historical documentation for current canonical files. No main edits, no merge, no force-push, no release/deployment.

FIRST SESSION SCOPE: SOL-0, SOL-1 and SOL-2 only, as defined in the plan.
SOL-0: render baseline/reference, obtain missing screenshots, check mobile/tablet/desktop and interaction limits. Prior Astra tests/build passed, but browser certification was blocked by the environment. Do not inherit a fictitious visual PASS. If browser remains unavailable, record PARTIAL and continue source implementation only where safe; do not call it visually approved.
SOL-1: exact responsive shell, two primary destinations Explorar / Nuestro viaje, URL navigation and preservation of existing region/hub/function entry points, tokens and lazy boundaries.
SOL-2: real photographic discovery/cards, global/hub search, all recommendations/categories, deterministic pagination, visible interest action, correct local images/credits/errors. The first slice may use the specified temporary single-reviewer saved adapter, clearly labelled and without fake couple state. Protect any existing authored route from unsave pruning; if that cannot be guaranteed, stop the affected mutation and report P0.

PRESERVE:
All canonical data/IDs/grades/hubs, all useful factual fields, duration ranges/day-scale distinction, temporal/reservation evidence, image attribution and fail-closed exclusions, geography, nearby history/directed relations and mature planner functions. Never downgrade assertions or hide missing images/low-grade places. Do not feed filtered or active-person liked IDs into V7 reconciliation. Legacy saves are unowned; never assign them to Fernando, Ella or both automatically.

DO NOT START in this session: full backend, Supabase, mass image acquisition, all remaining macroblocks, factual lodging research, automatic itinerary, migrations outside the safe specified bridge, wholesale refactoring or mechanical warning cleanup. The reference is a limited design specimen; do not promote its demonstration list into a replacement for the existing product.

VERIFY:
Run relevant behavior tests for changed risk, existing Vitest, lint, build, and relevant passive validators. Render at 390×844, tablet 768×1024 and 1024×768, desktop 1440×900; add 375/430 and text-reflow coverage per checklist. Inspect actual screenshots. Verify one-tap save, separate title/image link vs button, persistence and old-plan survival, focus/back behavior, correct images/credits and no overflow. No map/provider request on initial list if lazy boundary is complete. Do not write hundreds of repetitive tests or run acquisition scripts as passive validators.

COMMITS:
Commit coherent blocks with messages identifying as astra(sol-N). Push only experiment/astra-redesign if access allows. No main modifications/merge. Keep docs/astra/SOL_HANDOFF.md with actual base/HEAD, commits, completed blocks, real checks, screenshot paths, partials/deviations and exact next objective. Do not claim future features exist.

CONTEXT PROTOCOL:
After each major block assess whether the next can be completed coherently. If not, don't start it. Finish/check/commit current work, leave interpretable working tree, and give a full continuation prompt with repository/branch/base/HEAD/commits/tests/files/next objective. Do not wait to be cut off mid-decision, leave unexplained broken code, or ask the user to approve routine reversible implementation details.

FINAL HANDOFF TO ASTRA:
Begin exactly with TRACK: ASTRA and MODEL ROLE: SOL IMPLEMENTER.
Include repository, stable base, starting/current HEAD, branch, commits, SOL blocks completed, implementation summary, fidelity evidence at each viewport, PASS/PARTIAL/FAIL audit results, tests/build/validators, actual tree/push status, deviations and risks, and next objective. Finish with RESUMEN PARA CHATGPT — ASTRA TRACK and a concise continuation prompt if required.
Stop after SOL-2 (or a safe earlier checkpoint). Astra will audit the implementation and issue P0/P1/P2 corrections. Do not do Astra's independent approval on its behalf.
