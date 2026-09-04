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

# HTTP statuses that mean the credential itself is bad, not that this one request had a
# problem: every subsequent call with the same ORS_API_KEY will fail exactly the same
# way. A per-edge retry or "move on to the next edge" response is actively harmful here
# — it burns the batch repeating one failure hundreds of times instead of stopping.
# Machine-readable by design: callers check `exc.fatal` / `exc.http_status`, never a
# substring of `str(exc)`.
FATAL_HTTP_STATUS_CODES = frozenset({401, 403})


class RoutingRequestError(Exception):
    """status is the result status this failure should become: 'no-route' only for
    ORS's own "no routable point / no route" answer, 'request-error' for everything
    else (auth, malformed response, rate limit, network, timeout). transient controls
    the one bounded retry and is independent of status — a 429 is transient and still
    ends up 'request-error' if the retry also fails.

    `http_status` is the raw HTTP status code when the failure came from an HTTPError
    (None for a network/timeout failure that never got a response), and `fatal` is
    True exactly when `http_status` is in FATAL_HTTP_STATUS_CODES — a global,
    account-level failure a caller should stop the whole batch over, not just record
    and move on to the next edge. Both are plain attributes, never derived from the
    exception's message text.
    """

    def __init__(self, message, status, transient, http_status=None, fatal=False):
        super().__init__(message)
        self.status = status
        self.transient = transient
        self.http_status = http_status
        self.fatal = fatal


class RateLimiter:
    """Sliding-window rate limiter, applied per HTTP *attempt* (retries included).

    Why a real limiter rather than reacting to HTTP 429: a 429 means the request was
    already rejected — the quota was already spent on a refused call, and the provider
    is under no obligation to keep serving a client that keeps overshooting. Pacing
    proactively means the documented ceiling is never crossed in the first place, and
    the bounded retry stays what it is for (a genuinely transient failure), not a
    pacing mechanism.

    `clock` and `sleep` are injectable so the whole thing is testable with a fake clock
    and zero real waiting (see FakeClock in scripts/test_walking_scale.py): `clock()`
    returns a monotonically non-decreasing float in seconds, `sleep(seconds)` must
    advance whatever `clock()` reads by at least that much.

    max_events <= 0 disables pacing entirely (acquire() becomes a no-op), which is how
    a caller opts out explicitly rather than by passing None and hoping.
    """

    def __init__(self, max_events, per_seconds, clock=time.monotonic, sleep=time.sleep):
        self.max_events = max_events
        self.per_seconds = per_seconds
        self._clock = clock
        self._sleep = sleep
        self._events = []

    def _prune(self, now):
        cutoff = now - self.per_seconds
        # Timestamps are appended in non-decreasing order, so everything to drop is a
        # prefix — no need to scan the whole window.
        drop = 0
        for timestamp in self._events:
            if timestamp > cutoff:
                break
            drop += 1
        if drop:
            del self._events[:drop]

    def acquire(self):
        """Blocks (via the injected sleep) until another attempt may be made now, then
        records it. Every caller that is about to open an HTTP connection must call
        this first — including a retry of a request that already consumed a slot."""
        if self.max_events is None or self.max_events <= 0:
            return
        now = self._clock()
        self._prune(now)
        while len(self._events) >= self.max_events:
            oldest = self._events[0]
            wait = (oldest + self.per_seconds) - now
            if wait > 0:
                self._sleep(wait)
            now = self._clock()
            self._prune(now)
        self._events.append(now)


def directions_rate_limiter(per_minute, clock=time.monotonic, sleep=time.sleep):
    """The Directions limiter the scale-up batch runs under. `per_minute` comes from
    the caller (ORS_DIRECTIONS_PER_MINUTE_LIMIT_DOCUMENTED by default, overridable on
    the CLI for an account whose plan actually differs) — this module never guesses a
    ceiling for an endpoint whose limit is not documented."""
    return RateLimiter(per_minute, 60.0, clock=clock, sleep=sleep)


def query_ors(api_key, from_place, to_place, rate_limiter=None):
    """POST the Directions API for one directed edge. Returns (distance_m, duration_s)
    on success. Raises RoutingRequestError('no-route', ...) only for ORS's own "no
    routable point / no route" answer; every other failure raises it with
    status='request-error' (auth, malformed body, rate limit, network, timeout).

    `rate_limiter`, when given, is acquired immediately before the HTTP call — so this
    function is the single choke point every Directions attempt passes through, and a
    retry (which calls back in here) is paced exactly like a first attempt. Defaults to
    None (no pacing) so Phase 3B2A's pilot pipeline, which validates 24 edges well under
    any documented ceiling, behaves exactly as it did before this parameter existed.
    """
    if rate_limiter is not None:
        rate_limiter.acquire()
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
            raise RoutingRequestError(
                error_message, status="no-route", transient=False, http_status=exc.code
            ) from exc
        transient = exc.code == 429 or exc.code >= 500
        raise RoutingRequestError(
            f"HTTP {exc.code}: {error_message}", status="request-error", transient=transient,
            http_status=exc.code, fatal=exc.code in FATAL_HTTP_STATUS_CODES,
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


def query_ors_with_retry(api_key, from_place, to_place, rate_limiter=None, sleep=None):
    """query_ors, plus exactly one retry for a transient failure.

    The retry goes back through query_ors, so it acquires `rate_limiter` again: a
    retried edge costs two paced slots, never two unpaced back-to-back calls. `sleep`
    is injectable purely so tests don't wait out RETRY_DELAY_SECONDS for real; it is
    resolved at call time (not bound as a default) so patching this module's `time`
    keeps working for callers that do it that way.
    """
    attempts = 0
    while True:
        try:
            return query_ors(api_key, from_place, to_place, rate_limiter=rate_limiter), None
        except RoutingRequestError as exc:
            attempts += 1
            if exc.transient and attempts <= MAX_TRANSIENT_RETRIES:
                (sleep or time.sleep)(RETRY_DELAY_SECONDS)
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
        raise RoutingRequestError(
            f"HTTP {exc.code}: {message}", status="request-error", transient=transient,
            http_status=exc.code, fatal=exc.code in FATAL_HTTP_STATUS_CODES,
        ) from exc
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


def query_ors_snap_with_retry(api_key, locations, radius=ORS_SNAP_MAX_RADIUS_METERS, sleep=None):
    """query_ors_snap, plus the same single bounded retry for a transient failure.

    Deliberately NOT rate-limited: openrouteservice documents the Snap endpoint's
    per-request location cap (5,000) but not a per-minute or per-day request ceiling,
    and inventing one would be a made-up number dressed as a provider limit. Batching
    is what keeps Snap traffic small — one request covers thousands of places — so the
    bounded retry is the only reliability measure this needs.

    Returns (distances, None) on success, (None, RoutingRequestError) on failure — the
    tuple shape query_ors_with_retry uses, so a caller distinguishes a transport-level
    failure from a per-location "no snap point found" (a None inside `distances`)
    without inspecting any message text.
    """
    attempts = 0
    while True:
        try:
            return query_ors_snap(api_key, locations, radius=radius), None
        except RoutingRequestError as exc:
            attempts += 1
            if exc.transient and attempts <= MAX_TRANSIENT_RETRIES:
                (sleep or time.sleep)(RETRY_DELAY_SECONDS)
                continue
            return None, exc
