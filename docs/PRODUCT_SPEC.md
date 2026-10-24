# Nihon Product Specification

## Product definition

Nihon is a map-based travel discovery web application for exploring Japan before deciding on a route. It is not an itinerary generator in the first releases.

## Core user flow

1. The user opens a map of Japan.
2. The user selects a hub, region, or city.
3. Markers show verified places and clusters.
4. Clicking a marker opens a responsive place-detail drawer.
5. The drawer presents a gallery or image strip, a short explanation, practical facts, seasonal warnings, nearby places, and actions.
6. The user saves places to a personal selection.
7. The selection panel estimates activity time and highlights geographic/logistical pressure.

## Place-detail drawer

Every place profile should be able to show:

- name, Japanese name, hub, municipality, neighborhood, and category;
- a lead image plus a scrollable gallery when assets exist;
- what it is and what makes it different;
- priority and tourism intensity;
- visit duration range and recommended planning block;
- ideal time of day and season;
- price range, opening hours, closure notes, and reservation requirements;
- accessibility notes;
- February–March 2027 status, warning, and recommended action;
- official source and Google Maps links;
- nearby places and alternatives;
- `Quiero ir` / saved-state action.

## Time model

The interface must distinguish:

- **visit time** — time spent at the place itself;
- **planning block** — practical amount of day space to reserve;
- **logistics time** — movement between selected places, added later from nearby relations or routing;
- **variability** — how strongly queues, weather, reservations, or personal pace change the estimate.

Display ranges honestly. For example, `30–60 min` is preferable to a false precision such as `45 min`.

The first estimator can sum place ranges. It must label that result as an activity estimate and avoid pretending it includes all transportation until route logic is implemented.

## Initial filters

- hub / city;
- category;
- grade / priority;
- hidden-gem status;
- tourism intensity;
- ideal time of day;
- reservation required;
- February–March 2027 status;
- estimated time block.

## Responsive behavior

- Desktop: map plus right-side detail drawer.
- Mobile: full-screen detail sheet over the map.
- Escape closes the detail view on desktop.
- Focus must remain accessible inside modal/sheet states.
- Reduced-motion preferences must disable nonessential map and gallery animation.

## Out of scope for the first slice

- automatic day-by-day itinerary generation;
- booking or payment;
- live hotel or flight prices;
- exact travel-time routing;
- scraping image sites without a defined licensing/source policy.
