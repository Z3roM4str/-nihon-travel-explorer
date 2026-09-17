# Astra reference — deliberately limited

TRACK: ASTRA · MODEL ROLE: ASTRA DIRECTOR

This is an isolated **design reference**, not the redesigned application and not a migration. It reads the real store, duration/reservation/seasonal adapters and current image registry. No canonical files or production entry points change. It loads repository-local images and exposes their attribution. It never saves to the app's storage or claims partner agreement.

Run from repository root after `cd app && npm ci`:

```sh
node app/node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174
```

Open `http://127.0.0.1:4174/docs/astra/reference/index.html`.
Serve with this Vite command, not file:// or a plain static server: the reference intentionally imports the existing TypeScript domain adapters instead of duplicating them. It is not in the production build or a deployable replacement site.

Demonstrates: responsive photographic grid, native-font hierarchy, real recommendation labels, real search/hub/category filtering, existing duration/reservation interpretation, missing-photo/credit treatment, separate heart action, and responsive detail with disclosures/sticky action. Native dialog is used for keyboard containment. Single-image gallery is the real state of this base; no duplicated pictures fabricate a carousel.

Deliberate omissions: map, advanced filters, URL/history routing, own/partner identity, persistence/migration, undo, priority/discard, full nearby navigation, multi-image/fullscreen gallery, actual planner and lodging. “Nuestro viaje” here is only a temporary single-reviewer demonstration list; do not copy it as the full DA-10 implementation. Saved-view membership refreshes on re-entry, preserving the button during toggling. Complete warning-link behavior is specified in DA-06 but the reference keeps warnings as text. No browser measurements or visual PASS are claimed until a renderer is available.

Authority wins over these omissions. Sol must implement the entire relevant block, not promote this HTML into the product. No backend, new dependencies, new assets or factual travel recommendations are introduced.
