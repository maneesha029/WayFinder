"""Pure Live Reroute and Geofence evaluation (Owner: P3)."""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from contracts.models import (
    GeofencePrompt,
    Health,
    LiveStatus,
    LocationPing,
    NextCommitment,
    Place,
    Plan,
    Provenance,
    RerouteOption,
    Signal,
)
from engine import config, geo


def reroute(
    plan: Plan,
    standby: Plan,
    ping: LocationPing,
    signals: list[Signal],
    now: datetime,
    eta_fn: Callable[[Place, Place, str], int] | None = None,
) -> LiveStatus:
    """Compute next commitment slack, reroute options, and geofence prompts."""
    user_place = Place(name="Current position", lat=ping.lat, lng=ping.lng)
    tracking_on = (now - ping.ts).total_seconds() <= 600.0

    # Traffic uplift from active TRAFFIC signals
    traffic_delay = max(
        (int(s.payload.get("delay_min", 0)) for s in signals if s.kind == "TRAFFIC"),
        default=0,
    )
    flight_delay = max(
        (int(s.payload.get("delay_min", 0)) for s in signals if s.kind == "FLIGHT_STATUS"),
        default=0,
    )
    total_uplift = traffic_delay + flight_delay

    # Find earliest unstarted commitment (booked, fixed, or has hard_deadline)
    commitments = [
        it for it in plan.items
        if (it.hard_deadline is not None or it.fixed or it.booking is not None)
        and (it.hard_deadline or it.end) >= now
    ]
    commitments.sort(key=lambda it: (it.hard_deadline or it.start, it.id))

    next_comm: NextCommitment | None = None
    reroute_options: list[RerouteOption] = []
    geofence: GeofencePrompt | None = None

    prov = Provenance(
        source="OSRM free-flow + GPS" if eta_fn is not None else "Haversine ETA + GPS (sim)",
        checked_at=now,
        is_simulated=eta_fn is None,
        confidence=0.95,
    )

    if commitments:
        nxt = commitments[0]
        arrive_by = nxt.hard_deadline or nxt.start
        dest_place = nxt.place or nxt.origin
        mode = "DRIVE_GHAT" if "GHAT_ROAD" in nxt.risk_tags else "DRIVE"
        base_eta = geo.travel_min(user_place, dest_place, mode=mode, eta_fn=eta_fn)
        eta = base_eta + total_uplift
        slack = round((arrive_by - now).total_seconds() / 60.0) - eta

        if slack >= 20:
            health: Health = "GREEN"
        elif slack >= 0:
            health = "AMBER"
        else:
            health = "RED"

        next_comm = NextCommitment(
            item_id=nxt.id,
            title=nxt.title,
            arrive_by=arrive_by,
            eta_min=eta,
            slack_min=slack,
            health=health,
        )

        # Build reroute options whenever slack is tight or disrupted
        if slack < 30 or total_uplift > 0:
            # 1. Faster route / express drive
            express_eta = max(10, round(eta * 0.8))
            express_slack = round((arrive_by - now).total_seconds() / 60.0) - express_eta
            if express_slack > slack:
                reroute_options.append(
                    RerouteOption(
                        id="ro_drive_fast",
                        mode="DRIVE",
                        title=f"Take bypass corridor to {nxt.title}",
                        eta_min=express_eta,
                        slack_min=express_slack,
                        delta_cost_inr=300,
                        note="Avoids main market congestion; toll/bypass surcharge ~₹300",
                        provenance=prov,
                    )
                )

            # 2. Shift slot if rebookable or Plan B has an alternative slot
            base_title = nxt.title.split("(")[0].strip().lower()
            b_match = next(
                (b for b in standby.items if b.title.split("(")[0].strip().lower() == base_title and b.id != nxt.id),
                None,
            )
            if b_match is not None:
                b_deadline = b_match.hard_deadline or b_match.start
                b_slack = round((b_deadline - now).total_seconds() / 60.0) - eta
                fee = nxt.rebook_fee_inr if nxt.rebook_fee_inr is not None else 400
                reroute_options.append(
                    RerouteOption(
                        id="ro_shift_slot",
                        mode="SHIFT_SLOT",
                        title=f"Move {nxt.title} to Day {b_match.day}, {b_match.start.strftime('%H:%M')}",
                        eta_min=None,
                        slack_min=b_slack,
                        delta_cost_inr=fee,
                        note=f"Rebooking fee ₹{fee:,}; eliminates missed-entry risk",
                        provenance=prov,
                    )
                )

            # 3. Use Plan B segment
            reroute_options.append(
                RerouteOption(
                    id="ro_plan_b_seg",
                    mode="USE_PLAN_B_SEGMENT",
                    title="Switch to Plan B standby segment",
                    eta_min=max(10, base_eta),
                    slack_min=max(slack + 60, 45),
                    delta_cost_inr=(nxt.rebook_fee_inr or 0) + 1400,
                    note="Activates Plan B recovery segment while keeping flights & hotel",
                    provenance=prov,
                )
            )

            # 4. Reshuffle day (Time Banking)
            reroute_options.append(
                RerouteOption(
                    id="ro_reshuffle",
                    mode="RESHUFFLE_DAY",
                    title="Re-balance today's remaining stops (Time Banking)",
                    eta_min=eta,
                    slack_min=max(0, slack + 25),
                    delta_cost_inr=0,
                    note="Shortens non-fixed stops up to 25% and protects MUST items",
                    provenance=prov,
                )
            )

        reroute_options.sort(key=lambda o: (0 if o.slack_min >= 0 else 1, o.delta_cost_inr, -o.slack_min))

    # Geofence checks
    hotels = [it for it in plan.items if it.type == "HOTEL" and it.place is not None]
    for h in hotels:
        dist_m = geo.haversine_km(user_place, h.place) * 1000.0
        if dist_m <= config.GEOFENCE_HOTEL_ARRIVED_M:
            geofence = GeofencePrompt(
                kind="ARRIVED_HOTEL",
                title=f"Arrived at {h.title}",
                body="You are within 300m of your hotel. Ready to check in?",
            )
            break

    if geofence is None and plan.items:
        places = [
            p for it in plan.items for p in (it.origin, it.place) if p is not None
        ]
        if places:
            min_dist_km = min(geo.haversine_km(user_place, p) for p in places)
            if min_dist_km > config.GEOFENCE_OFF_ROUTE_KM:
                # Also check distance to line segments between origin/place if huge leg
                on_corridor = False
                for it in plan.items:
                    if it.origin and it.place:
                        d_ab = geo.haversine_km(it.origin, it.place)
                        d_ap = geo.haversine_km(it.origin, user_place)
                        d_pb = geo.haversine_km(user_place, it.place)
                        # Approximate corridor check via triangle inequality surplus
                        if d_ap + d_pb - d_ab <= 10.0:
                            on_corridor = True
                            break
                if not on_corridor:
                    geofence = GeofencePrompt(
                        kind="OFF_ROUTE",
                        title="Off planned corridor",
                        body=f"Your GPS is {min_dist_km:.1f} km from the nearest planned stop.",
                    )

    return LiveStatus(
        trip_id=plan.trip_id,
        as_of=now,
        location=user_place,
        tracking_on=tracking_on,
        next_commitment=next_comm,
        reroute_options=reroute_options,
        geofence_prompt=geofence,
    )
