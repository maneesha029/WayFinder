"""Pure geographic distance and travel-time estimation (Owner: P3)."""
from __future__ import annotations

import math
from collections.abc import Callable

from contracts.models import Place
from engine import config


def haversine_km(a: Place, b: Place) -> float:
    """Great-circle distance between two places in kilometres."""
    r = 6371.0
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    dlat = math.radians(b.lat - a.lat)
    dlng = math.radians(b.lng - a.lng)
    h = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2.0) ** 2
    )
    return 2.0 * r * math.asin(min(1.0, math.sqrt(h)))


def travel_min(
    a: Place | None,
    b: Place | None,
    mode: str = "DRIVE",
    eta_fn: Callable[[Place, Place, str], int] | None = None,
) -> int:
    """Estimate travel time in minutes; uses injected eta_fn when available."""
    if a is None or b is None:
        return config.BASE_TRANSIT_OVERHEAD_MIN
    if eta_fn is not None:
        try:
            res = eta_fn(a, b, mode)
            if res is not None and res >= 0:
                return int(res)
        except Exception:  # noqa: BLE001, S110
            pass
    dist_km = haversine_km(a, b)
    if dist_km < 0.05:
        return 0
    speed = config.SPEED_KMH.get(mode.upper(), config.SPEED_KMH["DRIVE"])
    minutes = config.BASE_TRANSIT_OVERHEAD_MIN + (dist_km * config.DETOUR_FACTOR / speed) * 60.0
    return round(minutes)
