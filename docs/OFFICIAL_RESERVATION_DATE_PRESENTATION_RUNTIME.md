# Phase 3F-F — Official Reservation Date Presentation Runtime

Status: **runtime implemented and validated — eligible for Ready transition**

Base: `8152d6a22e3f45dbe8b12074ca88b7593484103d` (`main` after Phase 3F-E)

Phase 3F-F implements only the presentation runtime approved by Phase 3F-E.

## 1. Runtime additions

### `app/src/lib/reservation-mechanism-presentation.ts`

Pure presentation boundary over:

- one Phase 3F-D `ReservationMechanismDateDerivation`;
- its exact matching `ReservationMechanismEvidenceRecord`.

It owns:

- Spanish scope labels;
- factual allocation disclosures;
- date/time rendering;
- explicit unknown-timezone disclosure;
- release-date vs application-window copy;
- neutral not-applicable/not-derivable copy;
- source entity + consultation-date provenance;
- source URL handoff for a normal user-initiated provenance link.

It returns `null` when:

- record/result identity does not match;
- evidence is inactive;
- no planned visit date exists.

It does not:

- rederive reservation dates;
- read the device clock;
- compare with a reference date;
- convert timezones;
- read Phase 3D editorial reservation fields;
- rank records;
- fetch a source;
- persist anything.

## 2. Planner integration

`OrderedSequenceBuilder.tsx` adds `OfficialReservationDateNotice` immediately after the existing
Phase 3D-H/3D-O `ReservationDeadlineNotice`.

The section:

- is per-day;
- iterates places in the current day order;
- derives each place through `deriveReservationMechanismDatesForPlannedPlace`;
- pairs each derivation back to its exact evidence record by `recordId`;
- preserves Phase 3F source order within each place;
- delegates all user-facing reservation copy to the new presentation helper;
- exposes scope;
- exposes allocation only when recorded;
- exposes source entity and concrete consultation date;
- exposes a normal `Ver fuente oficial` provenance link;
- renders no controls and mutates no planning state.

The component receives only:

- `places`;
- `dayAssignment`;
- `startDate`;
- `dayNumber`.

It receives no device/reference date and no Phase 3D-O current-date relation.

## 3. Real pilot behavior

The presentation helper tests pin:

- Ghibli: 10 Jan 2027, 10:00, `Asia/Tokyo`;
- Disneyland: 20 Dec 2026, 14:00, structured timezone remains unknown;
- DisneySea fallback: 1 Mar 2027, 14:00, structured timezone remains unknown;
- Katsura: independent 1 Dec 2026 05:00 and 12 Mar 2027 23:59 edges, plus lottery-if-oversubscribed disclosure;
- Osaka Sumo: 6 Feb 2027 fixed sale date with no invented time;
- Osaka Sumo outside 14–28 Mar event period: neutral not-applicable presentation.

## 4. Phase 3D separation

Phase 3F-F does not merge official mechanism evidence with the Phase 3D-H editorial advance-guidance
window.

The two sections are adjacent siblings only.

The official section explicitly states that Nihon does not combine both sources.

No Phase 3F path reads:

- `reservationReferenceDate`;
- `captureDeviceLocalCivilDate`;
- `evaluateReservationWindowReference`;
- `Place.reservation.leadTime`;
- `Place.reservation.required`;
- `febMar2027`;
- hours/closures;
- visit start times;
- trip end date.

## 5. Time/timezone boundary

Recorded local times are displayed as evidence.

- `Asia/Tokyo` remains `Asia/Tokyo`.
- `null` timezone renders as explicitly unrecorded in the structured evidence.
- `null` release time remains absent.

No instant, UTC conversion, device-time conversion or Japan-time inference is introduced.

## 6. Persistence/data/network boundary

Unchanged:

- `ManualPlanningDraftV7`;
- `nihon.manualPlanningDraft`;
- all localStorage keys;
- reservation-mechanism evidence JSON;
- places data;
- workbook;
- package manifests/dependencies.

No runtime network fetch is added.

The official source URL is rendered only as ordinary user-initiated provenance navigation.

## 7. Tests added

### `reservation-mechanism-presentation.test.ts`

Covers:

- all scope labels;
- allocation disclosure;
- all five real pilot records;
- unknown timezone preservation;
- no invented time;
- neutral outside-event-period state;
- neutral not-derivable state;
- inactive/no-visit omission;
- record/result identity mismatch refusal;
- exact provenance pairing;
- no current-date/network/editorial-reservation dependency;
- forbidden action/currentness vocabulary.

### `OrderedSequenceBuilder.test.ts`

Adds source-scanning integration contracts for:

- importing the Phase 3F evidence/derivation/presentation owners;
- exact record-ID pairing;
- stable no-sort behavior;
- placement immediately after the existing reservation window;
- absence of reference-date/Phase 3D inputs;
- provenance link;
- read-only rendering;
- day-specific accessible name;
- source-separation disclosure;
- no second dialog;
- no localStorage;
- forbidden action/currentness vocabulary.

## 8. Styling

`App.css` adds a neutral `.official-reservation-date` family.

No success/risk/urgency palette is introduced.

## 9. Validation gate

A dedicated executable browser audit now lives at:

`app/scripts/phase3f-f-browser-audit.mjs`

It seeds real V7 drafts in isolated browser contexts and exercises the approved real fixtures,
source provenance, Phase 3D-H coexistence, day-move recomputation, start-date removal/reload,
no-derived-state persistence, and Sumo applicability boundaries.

Final repository-native validation was executed on the real checkout after the runtime correctives:

- focused Vitest: **4 files, 150/150 tests passed**;
- full Vitest: **56/56 files, 2216/2216 tests passed**;
- oxlint: exit **0**, no warnings/errors;
- build (`tsc -b && vite build`): exit **0**;
- working-tree `git diff --check`: exit **0**;
- browser audit #1: **PASS**, 0 console errors, 0 page errors;
- browser audit #2: **PASS**, same final code HEAD, 0 console errors, 0 page errors.

The final code HEAD validated by both browser runs is
`3579a1498ea160dd1c4a53f466df4d35542e9999`.

Two corrective commits were required during validation:

1. `ef8d9b016bd4701df3c6719eafe42afc69c4ccdc` removed one stray blank line at EOF in
   `OrderedSequenceBuilder.test.ts`.
2. `3579a1498ea160dd1c4a53f466df4d35542e9999` corrected the browser harness fixtures for
   DisneySea, Katsura and both Sumo scenarios so the existing planner minimum of two saved places
   is satisfied with evidence-neutral `JP-019` on a separate day.

No runtime/presentation/evidence/data/schema/package file was changed by either corrective except the
browser harness itself in the second corrective.

Suggested real-checkout commands include the focused/new suites plus the established full commands:

```bash
cd app
npx vitest run src/lib/reservation-mechanism-presentation.test.ts \
  src/lib/reservation-mechanism-evidence.test.ts \
  src/lib/reservation-mechanism-date-derivation.test.ts \
  src/components/OrderedSequenceBuilder.test.ts
npm test
npm run lint
npm run build
cd ..
git diff --check
cd app
node scripts/phase3f-f-browser-audit.mjs
node scripts/phase3f-f-browser-audit.mjs
```

Because this phase changes visible UI, the Phase 3F-E gate requires **two consecutive successful
browser audits after the final code change**.

Those validations have now been observed in a real checkout. The Playwright environment required an
external Chromium path bridge because the container's installed Chromium build differed from the
Playwright-managed expected build; no repository file or package dependency was changed for that
environment-only adjustment.

## 10. Scope

Expected changed files:

- `app/src/lib/reservation-mechanism-presentation.ts`
- `app/src/lib/reservation-mechanism-presentation.test.ts`
- `app/src/components/OrderedSequenceBuilder.tsx`
- `app/src/components/OrderedSequenceBuilder.test.ts`
- `app/src/App.css`
- `app/scripts/phase3f-f-browser-audit.mjs`
- `docs/OFFICIAL_RESERVATION_DATE_PRESENTATION_RUNTIME.md`
- `docs/ROADMAP.md`

No Phase 3F evidence, Phase 3F-D arithmetic, Phase 3D reservation-domain, persistence, schema, package or workbook change is expected.

## 11. Ready state

**VALIDATED — ELIGIBLE FOR READY TRANSITION.**

Focused tests, full regression, lint, build and the two consecutive mandatory browser audits passed
on the final code state. Hostile review reported no material finding. The remaining transition is the
repository workflow step from Draft to Ready; this document does not itself perform that transition.
