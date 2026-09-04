"""Generic openrouteservice (HeiGIT) HTTP client primitives.

Extracted from scripts/validate-walking-pilot.py during Phase 3B2B-A so the same
network-request code (Directions, Snap, retry policy, failure classification,
attribution text) can be shared between the Phase 3B2A pilot pipeline and the
Phase 3B2B scale-up pipeline (scripts/validate-walking-scale.py) without duplicating
it. Nothing here is pilot- or scale-specific: it only knows how to talk to
openrouteservice's Directions and Snap endpoints and how to classify a failure.

This module makes no assumption about how many edges/places are being processed, how
results are cached, or what happens to a result afterward — that's the caller's job.
"""
import json
import time
import urllib.error
import urllib.request

from logistics_common import (
    ORS_DIRECTIONS_PATH_TEMPLATE,
    ORS_HOST,
    ORS_PROFILE_FOOT_WALKING,
    ORS_SNAP_MAX_RADIUS_METERS,
    ORS_SNAP_PATH_TEMPLATE,
    to_ors_coordinates,
)

# Verified against openrouteservice's terms of service and the OpenStreetMap Foundation's
# attribution guidelines during Phase 3B2A. Two distinct things are credited here, per
# their own separate licenses: the routing computation itself (openrouteservice/HeiGIT,
# CC BY 4.0) and the underlying map data (OpenStreetMap contributors, ODbL). Terms can
# change — re-verify at https://openrouteservice.org and
# https://www.openstreetmap.org/copyright before any production or public-facing use.
ATTRIBUTION = (
    "(c) openrouteservice.org by HeiGIT (routing computation, CC BY 4.0) | "
    "Map data (c) OpenStreetMap contributors, available under the Open Database "
    "License (ODbL). See https://openrouteservice.org and "
    "https://www.openstreetmap.org/copyright for current terms."
)

# One bounded retry for a transient failure (timeout / HTTP 429 or 5xx) per request.
# Never retried: a successful non-route answer (2010/2009) or a client error (401/403).
MAX_TRANSIENT_RETRIES = 1
RETRY_DELAY_SECONDS = 2
REQUEST_TIMEOUT_SECONDS = 15

# ORS error codes documented as "no routable point" / "route not found" — a real,
# deterministic answer from the provider, not a transient failure. Never retried.
NO_ROUTE_ERROR_CODES = {2009, 2010}


class RoutingRequestError(Exception):
    """status is the result status this failure should become: 'no-route' only for
    ORS's own "no routable point / no route" answer, 'request-error' for everything
    else (auth, malformed response, rate limit, network, timeout). transient controls
    the one bounded retry and is independent of status — a 429 is transient and still
    ends up 'request-error' if the retry also fails.
    """

    def __init__(self, message, status, transient):
        super().__init__(message)
        self.status = status
        self.transient = transient


def query_ors(api_key, from_place, to_place):
    """POST the Directions API for one directed edge. Returns (distance_m, duration_s)
    on success. Raises RoutingRequestError('no-route', ...) only for ORS's own "no
    routable point / no route" answer; every other failure raises it with
    status='request-error' (auth, malformed body, rate limit, network, timeout).
    """
    url = ORS_HOST + ORS_DIRECTIONS_PATH_TEMPLATE.format(profile=ORS_PROFILE_FOOT_WALKING)
    body = json.dumps(
        {
            "coordinates": [to_ors_coordinates(from_place), to_ors_coordinates(to_place)],
            "geometry": False,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            payload = None
        error_code = None
        error_message = str(exc)
        if isinstance(payload, dict) and isinstance(payload.get("error"), dict):
            error_code = payload["error"].get("code")
            error_message = payload["error"].get("message", error_message)
        if error_code in NO_ROUTE_ERROR_CODES:
            raise RoutingRequestError(error_message, status="no-route", transient=False) from exc
        transient = exc.code == 429 or exc.code >= 500
        raise RoutingRequestError(
            f"HTTP {exc.code}: {error_message}", status="request-error", transient=transient
        ) from exc
    except urllib.error.URLError as exc:
        raise RoutingRequestError(f"network error: {exc.reason}", status="request-error", transient=True) from exc
    except TimeoutError as exc:
        raise RoutingRequestError("request timed out", status="request-error", transient=True) from exc

    try:
        summary = payload["routes"][0]["summary"]
        return summary["distance"], summary["duration"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RoutingRequestError(
            f"unexpected response shape: {exc}", status="request-error", transient=False
        ) from exc


def query_ors_with_retry(api_key, from_place, to_place):
    """query_ors, plus exactly one retry for a transient failure."""
    attempts = 0
    while True:
        try:
            return query_ors(api_key, from_place, to_place), None
        except RoutingRequestError as exc:
            attempts += 1
            if exc.transient and attempts <= MAX_TRANSIENT_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
                continue
            return None, exc


def query_ors_snap(api_key, locations, radius=ORS_SNAP_MAX_RADIUS_METERS):
    """POST the Snap endpoint for a batch of [lng, lat] locations (openrouteservice
    accepts many locations per request — this is not limited to two). Returns a list
    of snapped_distance values in meters — None where no snap point was found within
    radius — in the same order as the input. Raises RoutingRequestError the same way
    query_ors does on failure.
    """
    url = ORS_HOST + ORS_SNAP_PATH_TEMPLATE.format(profile=ORS_PROFILE_FOOT_WALKING)
    body = json.dumps({"locations": locations, "radius": radius}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            error_payload = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            error_payload = None
        message = str(exc)
        if isinstance(error_payload, dict) and isinstance(error_payload.get("error"), dict):
            message = error_payload["error"].get("message", message)
        transient = exc.code == 429 or exc.code >= 500
        raise RoutingRequestError(f"HTTP {exc.code}: {message}", status="request-error", transient=transient) from exc
    except urllib.error.URLError as exc:
        raise RoutingRequestError(f"network error: {exc.reason}", status="request-error", transient=True) from exc
    except TimeoutError as exc:
        raise RoutingRequestError("request timed out", status="request-error", transient=True) from exc

    try:
        return [loc["snapped_distance"] if loc else None for loc in payload["locations"]]
    except (KeyError, TypeError) as exc:
        raise RoutingRequestError(
            f"unexpected snap response shape: {exc}", status="request-error", transient=False
        ) from exc
