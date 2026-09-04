"""Shared WalkingPilotResult-shaped builders.

Extracted from scripts/validate-walking-pilot.py during Phase 3B2B-A so the exact same
result shape (and the same "assessment is a re-derivable pure function, never a
free-standing opinion" discipline) is used by both the Phase 3B2A pilot pipeline and the
Phase 3B2B scale-up pipeline (scripts/validate-walking-scale.py), instead of two
near-identical copies drifting apart. Nothing here is pilot- or scale-specific.
"""
from logistics_common import (
    ORS_PROFILE_FOOT_WALKING,
    ORS_PROVIDER,
    ORS_SNAP_MAX_RADIUS_METERS,
    classify_endpoint_snapping,
    round_half_up_minutes,
    to_ors_coordinates,
)
from ors_client import ATTRIBUTION


def build_endpoint_snapping(
    from_snap_m, to_snap_m, routed_distance_m, radius=ORS_SNAP_MAX_RADIUS_METERS, reason=None
):
    """`reason` is only meaningful (and only ever set) when the assessment comes out
    "unknown" — e.g. "Snap query failed: ..." or a genuinely unsnappable point (None).
    Never fabricates a "clean"/"significant" verdict when a measurement is missing.
    """
    assessment = classify_endpoint_snapping(from_snap_m, to_snap_m, routed_distance_m)
    result = {
        "assessment": assessment,
        "fromSnapMeters": from_snap_m,
        "toSnapMeters": to_snap_m,
        "radiusMeters": radius,
    }
    if assessment == "unknown" and reason:
        result["reason"] = reason
    return result


def build_success_result(
    from_id, to_id, distance_m, duration_s, from_place, to_place, verified_at, endpoint_snapping=None
):
    minutes = round_half_up_minutes(duration_s)
    result = {
        "fromId": from_id,
        "toId": to_id,
        "provider": ORS_PROVIDER,
        "profile": ORS_PROFILE_FOOT_WALKING,
        "status": "validated",
        "distance": {"meters": distance_m},
        "minutes": {"minMinutes": minutes, "maxMinutes": minutes},
        "confidence": "validated-static",
        "verifiedAt": verified_at,
        "source": {
            "kind": "routing-provider",
            "provider": ORS_PROVIDER,
            "profile": ORS_PROFILE_FOOT_WALKING,
        },
        "query": {
            "fromCoordinates": to_ors_coordinates(from_place),
            "toCoordinates": to_ors_coordinates(to_place),
        },
        "durationSecondsRaw": duration_s,
        "attribution": ATTRIBUTION,
    }
    if endpoint_snapping is not None:
        result["endpointSnapping"] = endpoint_snapping
    return result


def build_failure_result(from_id, to_id, status, error, from_place, to_place, verified_at):
    return {
        "fromId": from_id,
        "toId": to_id,
        "provider": ORS_PROVIDER,
        "profile": ORS_PROFILE_FOOT_WALKING,
        "status": status,
        "verifiedAt": verified_at,
        "query": {
            "fromCoordinates": to_ors_coordinates(from_place),
            "toCoordinates": to_ors_coordinates(to_place),
        },
        "errorMessage": str(error),
    }
