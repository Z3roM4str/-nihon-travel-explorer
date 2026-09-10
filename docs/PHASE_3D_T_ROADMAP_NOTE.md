# Phase 3D-T — Manual Day Reordering Design Gate

Phase 3D-T is **design/audit only**.

Authoritative design:
[`docs/MANUAL_DAY_REORDERING_DESIGN.md`](MANUAL_DAY_REORDERING_DESIGN.md).

Decision: approve a narrow explicit day-order move that swaps whole existing `PlanningDayV5`
entities by stable day id. The day id, `placeIds`, and accommodation boundary travel together;
ordinal `Día N` labels and civil dates continue to derive from array position and therefore change
when the user changes day order.

This gate does not introduce runtime code, UI controls, schema V6, a second order vector, automatic
itinerary optimization, recommended city ordering, drag-and-drop, hotel routing, live transit,
geocoding, luggage logic, booking integration, or any new transport evidence.

Recommended successor: **Phase 3D-U — Manual Day Reordering Runtime**.

Phase 3D-U is **NOT STARTED** by this gate.
