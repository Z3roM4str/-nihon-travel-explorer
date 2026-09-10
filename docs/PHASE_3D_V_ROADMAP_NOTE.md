# Phase 3D-V — Trip Bounds Design Gate

Phase 3D-V is **design/audit only**.

Authoritative design:
[`docs/TRIP_BOUNDS_DESIGN.md`](TRIP_BOUNDS_DESIGN.md).

Decision: **approve one persisted civil field, `endDate: string | null`, on a new
`ManualPlanningDraftV6`**, under the unchanged storage key `nihon.manualPlanningDraft`, migrated
from V5 as `null` and never derived from `days.length`. `[startDate, endDate]` is an **inclusive**
civil-date range; `tripCalendarDays = differenceInCivilDays(startDate, endDate) + 1` is derived on
read only. The civil range and the day-bucket assignment stay **independent**: no bucket is ever
created, deleted, truncated or reordered to match the range, and no bound is ever derived from the
buckets. A day after the end of the trip becomes representable through a purely derived three-state
assessment (`bounds-unavailable` / `within-bounds` / `after-trip-end`) that annotates the UI and
repairs nothing.

Rejected alternatives, with reasons recorded in the design document: `tripLengthDays: number | null`
(not standalone, reintroduces the days/nights ambiguity, shaped like `days.length`); deriving the
end from `days.length` (circular — out-of-bounds stays unrepresentable, and editing buckets would
rewrite the user's travel dates); and adding nothing yet (the harm is present today and the model
reached its final day shape in 3D-S/3D-U).

This gate does not introduce runtime code, UI controls, a real schema migration, new runtime tests,
dataset or dependency changes, routing, live transit, hotel search, hotel-to-hotel inference,
luggage/takkyubin logic, check-in/check-out, flights, airports, arrival/departure clock times,
timezone scheduling, night counts, automatic itinerary generation, automatic day creation or
removal, optimization, duration recommendation, drag-and-drop, or booking integration. Luggage
remains an expressly separate axis.

Recommended successor: **Phase 3D-W — Trip Bounds Runtime**.

Phase 3D-W is **NOT STARTED** by this gate.
