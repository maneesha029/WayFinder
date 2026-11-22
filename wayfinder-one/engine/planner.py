"""Pure OR-Tools CP-SAT Itinerary Planner, Plan B Generator & Item Swapper (Owner: P3)."""
from __future__ import annotations

import itertools
import time
from datetime import date, datetime, timedelta, timezone

from ortools.sat.python import cp_model

from contracts.models import (
    Inventory,
    Offer,
    Plan,
    PlanItem,
    PlanPair,
    Priority,
    SwapPreview,
    TripIntent,
)
from engine import config, geo
from engine.errors import Infeasible
from engine.validator import validate

IST = timezone(timedelta(hours=5, minutes=30))


def _to_ist(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=IST)
    return dt.astimezone(IST)


def _local_min(dt: datetime) -> int:
    d = _to_ist(dt)
    return d.hour * 60 + d.minute


def _base_date(inventory: Inventory, intent: TripIntent) -> date:
    dates: list[date] = []
    for offer in (
        inventory.flights + inventory.hotels + inventory.transfers + inventory.activities
    ):
        if offer.earliest_start is not None:
            dates.append(_to_ist(offer.earliest_start).date())
    if dates:
        return min(dates)
    return intent.start_date or date(2026, 12, 5)


def _norm_title(title: str) -> str:
    return title.split("(")[0].strip().lower()


def _offer_to_plan_item(
    offer: Offer,
    day: int,
    start_dt: datetime,
    end_dt: datetime,
    depends_on: list[str] | None = None,
    priority_override: Priority | None = None,
) -> PlanItem:
    cancel_by = None
    if offer.refundable and offer.cancel_hours_before is not None:
        cancel_by = start_dt - timedelta(hours=offer.cancel_hours_before)
    return PlanItem(
        id=offer.id,
        type=offer.type,
        title=offer.title,
        day=day,
        start=start_dt,
        end=end_dt,
        origin=offer.origin,
        place=offer.place,
        price_inr=offer.price_inr,
        price_provenance=offer.price_provenance,
        refundable=offer.refundable,
        cancel_by=cancel_by,
        priority=priority_override or offer.priority_hint,
        fixed=offer.fixed_start is not None,
        hard_deadline=offer.hard_deadline,
        depends_on=depends_on or [],
        risk_tags=list(offer.risk_tags),
        indoor=offer.indoor,
        co2_kg=offer.co2_kg,
        rebook_fee_inr=offer.rebook_fee_inr,
        booking=None,
    )


def _resolve_day_and_times(
    offer: Offer,
    base_dt: date,
    trip_start: date,
    num_days: int,
) -> tuple[int, datetime, datetime, int, int]:
    shift_days = (trip_start - base_dt).days
    if offer.earliest_start is not None:
        orig_ist = _to_ist(offer.earliest_start)
        orig_day_idx = (orig_ist.date() - base_dt).days
        day = max(1, min(num_days, orig_day_idx + 1))
        start_dt = orig_ist + timedelta(days=shift_days)
        end_dt = start_dt + timedelta(minutes=offer.duration_min)
        (
            _to_ist(offer.hard_deadline) + timedelta(days=shift_days)
            if offer.hard_deadline is not None
            else None
        )
    else:
        day = 1
        start_dt = datetime(
            trip_start.year, trip_start.month, trip_start.day, 9, 0, tzinfo=IST
        )
        end_dt = start_dt + timedelta(minutes=offer.duration_min)
    s_min = _local_min(start_dt)
    e_min = s_min + offer.duration_min
    return day, start_dt, end_dt, s_min, e_min


def _is_multi_city(intent: TripIntent, inventory: Inventory) -> bool:
    dest = (intent.destination or "").lower()
    if any(sep in dest for sep in ("->", "→", ",", "circuit")):
        return True
    hotel_dests = {h.destination for h in inventory.hotels if h.destination}
    return len(hotel_dests) > 1


def _solve_single_plan(
    intent: TripIntent,
    inventory: Inventory,
    now: datetime,
    trip_id: str,
    kind: str,
    version: int = 1,
    plan_a_ref: Plan | None = None,
    forbid_rain: bool = True,
) -> Plan:
    t0 = time.perf_counter()
    base_dt = _base_date(inventory, intent)
    trip_start = intent.start_date or base_dt
    nights = intent.nights or 4
    num_days = nights + 1
    budget = intent.budget_inr if intent.budget_inr is not None else 100000

    # Pre-check minimum mandatory cost for crisp Infeasible feedback
    def min_price(offers: list[Offer]) -> int:
        return min((o.price_inr for o in offers), default=0)

    inbound_flights = [
        o for o in inventory.flights if "inbound" in o.tags or _resolve_day_and_times(o, base_dt, trip_start, num_days)[0] == 1
    ]
    outbound_flights = [
        o for o in inventory.flights if "outbound" in o.tags or (
            o not in inbound_flights and _resolve_day_and_times(o, base_dt, trip_start, num_days)[0] == num_days
        )
    ]
    inbound_transfers = [
        o for o in inventory.transfers if "inbound" in o.tags or (
            "outbound" not in o.tags and _resolve_day_and_times(o, base_dt, trip_start, num_days)[0] == 1
        )
    ]
    outbound_transfers = [
        o for o in inventory.transfers if "outbound" in o.tags or (
            o not in inbound_transfers and _resolve_day_and_times(o, base_dt, trip_start, num_days)[0] == num_days
        )
    ]

    min_mand = (
        min_price(inbound_flights)
        + min_price(outbound_flights)
        + min_price(inventory.hotels)
        + min_price(inbound_transfers)
        + min_price(outbound_transfers)
    )
    if min_mand > budget:
        raise Infeasible(
            f"Minimum flights, stay and transfer cost ₹{min_mand:,} exceeds budget ₹{budget:,}.",
            suggestion=f"Raise budget by at least ₹{min_mand - budget:,} or shorten the trip.",
            binding_constraint="budget",
        )

    model = cp_model.CpModel()
    all_offers = (
        inventory.flights + inventory.hotels + inventory.transfers + inventory.activities
    )

    sel: dict[str, cp_model.IntVar] = {}
    meta: dict[str, tuple[Offer, int, datetime, datetime, int, int]] = {}
    for o in all_offers:
        day, s_dt, e_dt, s_min, e_min = _resolve_day_and_times(
            o, base_dt, trip_start, num_days
        )
        sel[o.id] = model.NewBoolVar(f"sel_{o.id}")
        meta[o.id] = (o, day, s_dt, e_dt, s_min, e_min)

    # Plan B pinning & constraints
    plan_a_ids: set[str] = set()
    plan_a_inbound_start: int | None = None
    if kind == "B" and plan_a_ref is not None:
        plan_a_ids = {it.id for it in plan_a_ref.items}
        for it in plan_a_ref.items:
            if it.type in ("FLIGHT", "HOTEL") and it.id in sel:
                model.Add(sel[it.id] == 1)
            if it.type == "TRANSFER" and it.day == 1:
                plan_a_inbound_start = _local_min(it.start)

    # Mandatory categories: inbound/outbound flight, hotel, inbound/outbound transfer
    if inbound_flights:
        model.Add(sum(sel[o.id] for o in inbound_flights) == 1)
    if outbound_flights:
        model.Add(sum(sel[o.id] for o in outbound_flights) == 1)
    if inventory.hotels:
        model.Add(sum(sel[o.id] for o in inventory.hotels) == 1)
    if inbound_transfers:
        # Plan B requires >= 90 min later arrival transfer or different mode if available
        if kind == "B" and plan_a_inbound_start is not None:
            later_transfers = [
                o
                for o in inbound_transfers
                if meta[o.id][4] >= plan_a_inbound_start + 90
                or o.id not in plan_a_ids
            ]
            if later_transfers:
                for o in inbound_transfers:
                    if o not in later_transfers:
                        model.Add(sel[o.id] == 0)
        model.Add(sum(sel[o.id] for o in inbound_transfers) == 1)
    if outbound_transfers:
        model.Add(sum(sel[o.id] for o in outbound_transfers) == 1)

    # Night ghat rule (hard constraint for GHAT_ROAD transfers)
    avoid_night_ghat = True  # always enforced per A6 hard constraints
    if avoid_night_ghat:
        for o in inventory.transfers:
            if "GHAT_ROAD" in o.risk_tags and meta[o.id][5] > config.NIGHT_GHAT_CUTOFF_MIN:
                model.Add(sel[o.id] == 0)

    # Daily window for activities (08:00 - 19:30)
    for o in inventory.activities:
        _, _, _, _, s_min, e_min = meta[o.id]
        if s_min < config.DAY_START_MIN or e_min > config.DAY_END_MIN:
            model.Add(sel[o.id] == 0)

    # Plan B rain filter
    if kind == "B" and forbid_rain:
        for o in inventory.activities:
            if "RAIN" in o.risk_tags and not o.indoor:
                model.Add(sel[o.id] == 0)

    # Budget cap
    model.Add(sum(sel[o.id] * o.price_inr for o in all_offers) <= budget)

    # Unique normalized activity title (cannot visit the same attraction twice)
    by_norm_title: dict[str, list[Offer]] = {}
    for o in inventory.activities:
        by_norm_title.setdefault(_norm_title(o.title), []).append(o)
    for group in by_norm_title.values():
        if len(group) > 1:
            model.Add(sum(sel[o.id] for o in group) <= 1)

    # Must-dos from intent
    for must_txt in intent.must_dos:
        needle = must_txt.strip().lower()
        matches = [
            o for o in inventory.activities
            if needle in o.title.lower() or _norm_title(o.title) in needle
        ]
        if matches:
            # In Plan B, only enforce must-do if at least one non-forbidden match exists
            if kind == "B" and forbid_rain:
                non_rain_matches = [o for o in matches if "RAIN" not in o.risk_tags or o.indoor]
                if non_rain_matches:
                    model.Add(sum(sel[o.id] for o in non_rain_matches) >= 1)
            else:
                model.Add(sum(sel[o.id] for o in matches) >= 1)

    # Pace cap per day
    max_per_day = config.PACE_MAX_ACTIVITIES.get(intent.pace or "BALANCED", 3)
    for d in range(1, num_days + 1):
        day_acts = [o for o in inventory.activities if meta[o.id][1] == d]
        if day_acts:
            model.Add(sum(sel[o.id] for o in day_acts) <= max_per_day)

    # Non-overlap between same-day items (transfers & activities) with geo travel gap
    schedulable = [o for o in inventory.transfers + inventory.activities]
    for a, b in itertools.combinations(schedulable, 2):
        _, day_a, _, _, s_a, e_a = meta[a.id]
        _, day_b, _, _, s_b, e_b = meta[b.id]
        if day_a != day_b:
            continue
        gap = geo.travel_min(a.place, b.place, "DRIVE") if (a.type == "ACTIVITY" and b.type == "ACTIVITY") else 10
        # Check whether intervals [s_a, e_a + gap] and [s_b, e_b + gap] overlap
        overlap_ab = not (e_a + gap <= s_b or e_b + gap <= s_a)
        if overlap_ab:
            model.Add(sel[a.id] + sel[b.id] <= 1)

    # Plan B diversity: at least 3 activities/transfers differ from Plan A if possible
    if kind == "B" and plan_a_ref is not None:
        non_fixed_a = [
            it.id for it in plan_a_ref.items
            if it.type in ("ACTIVITY", "TRANSFER") and it.id in sel
        ]
        b_candidates = [
            o.id for o in inventory.activities + inventory.transfers
            if o.id not in plan_a_ids and o.id in sel
        ]
        if len(b_candidates) >= 3:
            model.Add(
                sum(1 - sel[oid] for oid in non_fixed_a) + sum(sel[oid] for oid in b_candidates) >= 3
            )

    # Objective: maximise sum(priority_weight * rating * selected) - 0.002 * cost
    interest_set = {x.strip().lower() for x in intent.interests}
    obj_terms = []
    for o in all_offers:
        pw = config.PLANNER_PRIORITY_WEIGHTS.get(o.priority_hint, 4)
        # Check if intent must_dos elevates priority
        if any(m_txt.lower() in o.title.lower() for m_txt in intent.must_dos):
            pw = config.PLANNER_PRIORITY_WEIGHTS["MUST"]
        utility = round(pw * o.rating * 1000)
        if interest_set and any(t.lower() in interest_set for t in o.tags):
            utility += 200
        if kind == "B" and o.refundable:
            utility += 1000  # Plan B prefers refundable components
        cost_term = round(config.COST_PENALTY_COEFF * 1000 * o.price_inr)
        obj_terms.append((utility - cost_term) * sel[o.id])

    model.Maximize(sum(obj_terms))

    solver = cp_model.CpSolver()
    solver.parameters.num_workers = config.SOLVER_NUM_WORKERS
    solver.parameters.random_seed = config.SOLVER_RANDOM_SEED
    solver.parameters.max_time_in_seconds = config.SOLVER_MAX_TIME_SEC
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        if kind == "B" and forbid_rain:
            # Retry Plan B allowing rain-tagged items only if strict rain ban left zero feasible solutions
            return _solve_single_plan(
                intent, inventory, now, trip_id, kind, version, plan_a_ref, forbid_rain=False
            )
        raise Infeasible(
            f"No feasible plan satisfies all constraints within ₹{budget:,}.",
            suggestion=f"Raise budget by ₹5,000 or relax must-do items ({', '.join(intent.must_dos) or 'schedule'}).",
            binding_constraint="constraints",
        )

    # Reconstruct selected PlanItems with dependencies
    chosen_offers = [o for o in all_offers if solver.BooleanValue(sel[o.id])]
    chosen_ids = {o.id for o in chosen_offers}

    inbound_flight_id = next((o.id for o in inbound_flights if o.id in chosen_ids), None)
    inbound_transfer_id = next((o.id for o in inbound_transfers if o.id in chosen_ids), None)
    outbound_transfer_id = next((o.id for o in outbound_transfers if o.id in chosen_ids), None)

    plan_items: list[PlanItem] = []
    shift_days = (trip_start - base_dt).days
    for o in chosen_offers:
        _, day, s_dt, e_dt, _, _ = meta[o.id]
        deps: list[str] = []
        if o in inbound_transfers and inbound_flight_id:
            deps = [inbound_flight_id]
        elif o.type == "HOTEL" and inbound_transfer_id or o.type == "ACTIVITY" and day == 1 and inbound_transfer_id:
            deps = [inbound_transfer_id]
        elif o in outbound_flights and outbound_transfer_id:
            deps = [outbound_transfer_id]

        prio_override: Priority | None = None
        if any(m_txt.lower() in o.title.lower() for m_txt in intent.must_dos):
            prio_override = "MUST"

        item_obj = _offer_to_plan_item(o, day, s_dt, e_dt, depends_on=deps, priority_override=prio_override)
        if o.hard_deadline is not None:
            item_obj = item_obj.model_copy(
                update={"hard_deadline": _to_ist(o.hard_deadline) + timedelta(days=shift_days)}
            )
        plan_items.append(item_obj)

    plan_items.sort(key=lambda it: (it.day, it.start, it.id))
    total_cost = sum(it.price_inr for it in plan_items)
    solve_ms = max(1, int((time.perf_counter() - t0) * 1000))

    draft_plan = Plan(
        id=f"plan_{kind.lower()}{version}",
        trip_id=trip_id,
        kind="A" if kind == "A" else "B",
        version=version,
        items=plan_items,
        total_cost_inr=total_cost,
        summary=(
            f"{intent.destination or 'Trip'} plan for {intent.travellers or 2} on ₹{total_cost:,}."
            if kind == "A"
            else f"Rain-safe standby Plan B keeping committed flights and hotel (₹{total_cost:,})."
        ),
        created_at=now,
        validation=validate(
            Plan(
                id=f"plan_{kind.lower()}{version}",
                trip_id=trip_id,
                kind="A" if kind == "A" else "B",
                version=version,
                items=plan_items,
                total_cost_inr=total_cost,
                created_at=now,
                validation={
                    "feasible": True,
                    "checks": [],
                    "min_slack_min": 60,
                    "budget_headroom_inr": max(0, budget - total_cost),
                    "feasibility": 0.95,
                    "solver": "ortools-cp-sat",
                    "solve_ms": solve_ms,
                },
            ),
            intent,
            [],
            now,
        ),
    )
    draft_plan.validation.solve_ms = solve_ms
    return draft_plan


def build_plan_pair(
    intent: TripIntent,
    inventory: Inventory,
    now: datetime,
    trip_id: str,
) -> PlanPair:
    """Solve deterministic Plan A and diverse rain-safe Plan B using OR-Tools CP-SAT."""
    if _is_multi_city(intent, inventory):
        from engine.multicity import build_multicity_plan_pair

        return build_multicity_plan_pair(intent, inventory, now, trip_id)

    plan_a = _solve_single_plan(intent, inventory, now, trip_id, kind="A", version=1)
    plan_b = _solve_single_plan(
        intent, inventory, now, trip_id, kind="B", version=1, plan_a_ref=plan_a
    )
    return PlanPair(plan_a=plan_a, plan_b=plan_b)


def regenerate_plan_b(
    plan_a: Plan,
    intent: TripIntent,
    inventory: Inventory,
    now: datetime,
) -> Plan:
    """Re-solve Plan B after Plan A is updated, keeping flights and hotel identical."""
    if _is_multi_city(intent, inventory):
        from engine.multicity import build_multicity_plan_pair

        pair = build_multicity_plan_pair(intent, inventory, now, plan_a.trip_id)
        return pair.plan_b.model_copy(update={"version": plan_a.version + 1})

    return _solve_single_plan(
        intent,
        inventory,
        now,
        plan_a.trip_id,
        kind="B",
        version=plan_a.version + 1,
        plan_a_ref=plan_a,
    )


def swap_item(
    plan: Plan,
    item_id: str,
    offer: Offer,
    inventory: Inventory,
    intent: TripIntent,
    now: datetime,
) -> SwapPreview:
    """Replace one item with an Offer, re-validate the day and whole plan, return SwapPreview."""
    target = next((it for it in plan.items if it.id == item_id), None)
    if target is None:
        raise Infeasible(
            f"Item {item_id} not found in plan.",
            suggestion="Select an existing itinerary item to swap.",
            binding_constraint="item_not_found",
        )

    day = target.day
    # Align offer times onto target's calendar date if needed
    target_date = _to_ist(target.start).date()
    if offer.earliest_start is not None:
        s_ist = _to_ist(offer.earliest_start)
        new_start = datetime(
            target_date.year,
            target_date.month,
            target_date.day,
            s_ist.hour,
            s_ist.minute,
            tzinfo=IST,
        )
    else:
        new_start = _to_ist(target.start)
    new_end = new_start + timedelta(minutes=offer.duration_min)

    if offer.type == "TRANSFER" and "GHAT_ROAD" in offer.risk_tags and _local_min(new_end) > config.NIGHT_GHAT_CUTOFF_MIN:
        raise Infeasible(
            f"Swapping to {offer.title} violates the no-night-ghat rule (ends after 18:00).",
            suggestion="Choose a daytime transfer ending before 18:00.",
            binding_constraint="no_night_ghat",
        )

    new_item = _offer_to_plan_item(
        offer,
        day=day,
        start_dt=new_start,
        end_dt=new_end,
        depends_on=list(target.depends_on),
        priority_override=target.priority,
    )

    new_items: list[PlanItem] = []
    for it in plan.items:
        if it.id == item_id:
            new_items.append(new_item)
        else:
            # Update depends_on references from old item_id to new offer.id
            updated_deps = [offer.id if d == item_id else d for d in it.depends_on]
            new_items.append(it.model_copy(update={"depends_on": updated_deps}))

    new_items.sort(key=lambda it: (it.day, it.start, it.id))
    new_total = sum(it.price_inr for it in new_items)
    budget = intent.budget_inr if intent.budget_inr is not None else plan.total_cost_inr + plan.validation.budget_headroom_inr
    if new_total > budget:
        raise Infeasible(
            f"Swap raises total cost to ₹{new_total:,}, exceeding budget ₹{budget:,}.",
            suggestion=f"Increase budget by ₹{new_total - budget:,} or pick a lower-cost alternative.",
            binding_constraint="budget",
        )

    candidate = plan.model_copy(
        update={
            "version": plan.version + 1,
            "items": new_items,
            "total_cost_inr": new_total,
            "created_at": now,
        }
    )
    val = validate(candidate, intent, [], now)
    if not val.feasible:
        failed = [c.detail for c in val.checks if not c.passed]
        raise Infeasible(
            f"Swap failed plan validation: {'; '.join(failed) or 'schedule conflict'}.",
            suggestion="Choose an alternative slot that preserves connection slack.",
            binding_constraint="validation",
        )
    candidate = candidate.model_copy(update={"validation": val})

    # Compute CO2 delta via responsible helper if available
    from engine.responsible import item_co2_kg

    old_co2 = item_co2_kg(target, intent.travellers or 2)
    new_co2 = item_co2_kg(new_item, intent.travellers or 2)
    delta_co2 = round(new_co2 - old_co2, 2)
    delta_cost = new_total - plan.total_cost_inr

    return SwapPreview(
        plan_preview=candidate,
        delta_cost_inr=delta_cost,
        delta_co2_kg=delta_co2,
        lost_items=[],
        changed_booking_item_ids=[item_id] if target.booking is not None or item_id else [],
        summary=(
            f"Swapped {target.title} for {offer.title} "
            f"({delta_cost:+,d} ₹, {delta_co2:+.1f} kg CO₂)."
        ),
        applied=False,
    )
