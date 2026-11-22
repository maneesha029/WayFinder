"""Pure Switch Engine evaluating FULL vs MIXED commitment-preserving recovery (Owner: P3)."""
from __future__ import annotations

from datetime import datetime

from contracts.models import (
    LostItem,
    Plan,
    PlanItem,
    Provenance,
    Signal,
    SwitchRecommendation,
    TripIntent,
)
from engine import config
from engine.validator import compute_link_metrics, validate


def _base_name(title: str) -> str:
    return title.split("(")[0].strip().lower()


def _items_overlap(a: PlanItem, b: PlanItem) -> bool:
    if a.day != b.day:
        return False
    if a.type == "HOTEL" or b.type == "HOTEL":
        return False
    return not (a.end <= b.start or b.end <= a.start)


def _is_bookable_commitment(it: PlanItem) -> bool:
    return (
        it.booking is not None
        or it.type in ("FLIGHT", "HOTEL", "TRANSFER")
        or it.fixed
        or it.rebook_fee_inr is not None
    )


def _compute_delta_cost(
    active_items: list[PlanItem],
    new_items: list[PlanItem],
    now: datetime,
) -> int:
    """Commitment-preserving delta cost: rebook fees for rescheduled counterparts + new - refundable cancellations."""
    active_by_id = {it.id: it for it in active_items}
    new_by_id = {it.id: it for it in new_items}

    removed = [it for it in active_items if it.id not in new_by_id]
    added = [it for it in new_items if it.id not in active_by_id]

    matched_removed: set[str] = set()
    matched_added: set[str] = set()
    delta = 0

    for old in removed:
        for cand in added:
            if cand.id in matched_added:
                continue
            if old.type == cand.type and _base_name(old.title) == _base_name(cand.title):
                matched_removed.add(old.id)
                matched_added.add(cand.id)
                if old.rebook_fee_inr is not None:
                    delta += old.rebook_fee_inr
                elif old.type == "TRANSFER" and old.cancel_by is not None and now >= old.cancel_by:
                    delta += config.DEFAULT_CAB_WAIT_FEE_INR
                elif old.day == cand.day and not old.fixed:
                    delta += max(0, cand.price_inr - old.price_inr)
                elif not old.refundable:
                    delta += cand.price_inr
                else:
                    delta += max(0, cand.price_inr - old.price_inr)
                break

    for old in removed:
        if old.id in matched_removed:
            continue
        # Refund only if refundable AND within cancellation deadline
        if old.refundable and (old.cancel_by is None or now < old.cancel_by):
            delta -= old.price_inr

    for cand in added:
        if cand.id not in matched_added:
            delta += cand.price_inr

    return delta


def _build_mixed_plan(
    active: Plan,
    standby: Plan,
    failing_ids: set[str],
    now: datetime,
) -> Plan | None:
    """Build a MIXED plan replacing failing chains & conflicting days with Plan B segments."""
    standby_by_base: dict[str, list[PlanItem]] = {}
    for it in standby.items:
        standby_by_base.setdefault(_base_name(it.title), []).append(it)

    affected_days: set[int] = {it.day for it in active.items if it.id in failing_ids}
    landing_days: set[int] = set()
    replacements: list[PlanItem] = []
    replaced_active_ids: set[str] = set()

    # Replace failing items with Plan B counterparts (even if moved to another day)
    for it in active.items:
        if it.id not in failing_ids:
            continue
        cands = [c for c in standby_by_base.get(_base_name(it.title), []) if c.id != it.id]
        if cands:
            chosen = cands[0]
            replacements.append(chosen)
            replaced_active_ids.add(it.id)
            affected_days.add(chosen.day)
            if chosen.day != it.day or it.type == "ACTIVITY":
                landing_days.add(chosen.day)
        else:
            # Drop if no counterpart exists in Plan B
            replaced_active_ids.add(it.id)

    # Keep unaffected items from active, replacing activity segment on landing_days with Plan B's day segment
    kept_items: list[PlanItem] = []
    for it in active.items:
        if it.id in replaced_active_ids:
            continue
        if it.type == "ACTIVITY" and (
            it.day in landing_days or any(_items_overlap(it, rep) for rep in replacements)
        ):
            replaced_active_ids.add(it.id)
            continue
        kept_items.append(it)

    # Bring in Plan B activities for landing_days (coherent Plan B day segment) or displaced counterparties
    replacement_ids = {r.id for r in replacements}
    for b_it in standby.items:
        if b_it.id in replacement_ids or any(k.id == b_it.id for k in kept_items):
            continue
        if (
            b_it.type == "ACTIVITY"
            and (
                b_it.day in landing_days
                or (
                    b_it.day in affected_days
                    and any(_base_name(a.title) == _base_name(b_it.title) for a in active.items if a.id in replaced_active_ids)
                )
            )
            and not any(_items_overlap(b_it, x) for x in kept_items + replacements)
        ):
            replacements.append(b_it)
            replacement_ids.add(b_it.id)

    merged = kept_items + replacements
    merged_ids = {it.id for it in merged}

    # Repair depends_on pointers (e.g., hotel depending on replaced cab)
    repaired: list[PlanItem] = []
    for it in merged:
        new_deps: list[str] = []
        for dep in it.depends_on:
            if dep in merged_ids:
                new_deps.append(dep)
            else:
                # Look for replacement matching same type/day
                old_dep = next((a for a in active.items if a.id == dep), None)
                if old_dep is not None:
                    rep = next(
                        (r for r in replacements if r.type == old_dep.type and r.day == old_dep.day),
                        None,
                    )
                    if rep is not None:
                        new_deps.append(rep.id)
        repaired.append(it.model_copy(update={"depends_on": new_deps}))

    repaired.sort(key=lambda it: (it.day, it.start, it.id))
    if {it.id for it in repaired} == {it.id for it in standby.items}:
        return None  # Identical to FULL

    total = sum(it.price_inr for it in repaired)
    return active.model_copy(
        update={
            "id": f"plan_a{active.version + 1}",
            "kind": "A",
            "version": active.version + 1,
            "items": repaired,
            "total_cost_inr": total,
            "summary": "MIXED recovery plan: affected segments from Plan B, rest of Plan A preserved.",
            "created_at": now,
        }
    )


def evaluate(
    active: Plan,
    standby: Plan,
    intent: TripIntent,
    signals: list[Signal],
    now: datetime,
) -> SwitchRecommendation | None:
    """Evaluate FULL vs MIXED recovery plans and return SwitchRecommendation if triggered."""
    val_a = validate(active, intent, signals, now)
    val_b = validate(standby, intent, signals, now)
    metrics_a = compute_link_metrics(active, signals)

    min_eff_a = val_a.min_slack_min
    trigger = (
        min_eff_a < config.SWITCH_SLACK_TRIGGER_MIN
        or val_a.feasibility < (val_b.feasibility - config.SWITCH_FEASIBILITY_GAP)
    )
    if not trigger:
        return None

    # Failing links (P_link < 0.90)
    failing_ids: set[str] = set()
    for tid, lm in metrics_a.items():
        if float(lm["p_link"]) < 0.90 or int(lm["effective_slack_min"]) < config.SWITCH_SLACK_TRIGGER_MIN:
            failing_ids.add(tid)
            # Include immediate non-flight transfer predecessor in the failing segment
            pred_id = str(lm["pred_id"])
            pred_item = next((it for it in active.items if it.id == pred_id), None)
            if pred_item is not None and pred_item.type == "TRANSFER":
                failing_ids.add(pred_item.id)

    candidates: list[tuple[str, Plan, float, int]] = []

    # Candidate 1: FULL (Plan B promoted to Plan A v+1)
    full_plan = standby.model_copy(
        update={
            "id": f"plan_a{active.version + 1}",
            "kind": "A",
            "version": active.version + 1,
            "validation": val_b,
            "created_at": now,
        }
    )
    candidates.append(("FULL", full_plan, val_b.feasibility, val_b.min_slack_min))

    # Candidate 2: MIXED
    if failing_ids:
        mixed_plan = _build_mixed_plan(active, standby, failing_ids, now)
        if mixed_plan is not None:
            val_m = validate(mixed_plan, intent, signals, now)
            if val_m.feasible:
                mixed_plan = mixed_plan.model_copy(update={"validation": val_m})
                candidates.append(("MIXED", mixed_plan, val_m.feasibility, val_m.min_slack_min))

    def score_candidate(cand: tuple[str, Plan, float, int]) -> tuple[int, int, float]:
        _mode, plan_c, feas, _ = cand
        new_bases = {_base_name(it.title) for it in plan_c.items}
        new_ids = {it.id for it in plan_c.items}
        lost = [
            it for it in active.items
            if it.id not in new_ids and _base_name(it.title) not in new_bases
        ]
        lost_val = sum(config.SWITCH_LOST_WEIGHTS.get(it.priority, 2) for it in lost)
        delta_c = _compute_delta_cost(active.items, plan_c.items, now)
        return (lost_val, delta_c, -feas)

    viable = [c for c in candidates if c[2] >= config.SWITCH_TARGET_FEASIBILITY]
    fallback_note = ""
    if viable:
        best_mode, best_plan, best_feas, best_slack = min(viable, key=score_candidate)
    else:
        best_mode, best_plan, best_feas, best_slack = max(candidates, key=lambda c: c[2])
        fallback_note = " (no candidate reached 90% feasibility; selected highest feasibility)"

    best_ids = {it.id for it in best_plan.items}
    best_bases = {_base_name(it.title) for it in best_plan.items}

    lost_items = [
        LostItem(item_id=it.id, title=it.title, priority=it.priority)
        for it in active.items
        if it.id not in best_ids and _base_name(it.title) not in best_bases
    ]

    kept_booking_item_ids = [
        it.id for it in active.items
        if it.id in best_ids and _is_bookable_commitment(it)
    ]
    changed_booking_item_ids = [
        it.id for it in active.items
        if it.id not in best_ids
        and (_base_name(it.title) in best_bases or it.rebook_fee_inr is not None or it.fixed)
        and _is_bookable_commitment(it)
    ]
    delta_cost = _compute_delta_cost(active.items, best_plan.items, now)

    sources: list[Provenance] = [s.provenance for s in signals]
    if not sources and active.items:
        sources = [active.items[0].price_provenance]

    flight_delays = [
        int(s.payload.get("delay_min", 0))
        for s in signals
        if s.kind == "FLIGHT_STATUS" and int(s.payload.get("delay_min", 0)) > 0
    ]
    delay_prefix = f"Flight delayed {max(flight_delays)} min; " if flight_delays else ""
    reason = (
        f"{delay_prefix}Plan A slack dropped to {min_eff_a:+d} min (feasibility {round(val_a.feasibility * 100)}%). "
        f"{best_mode} switch restores feasibility to {round(best_feas * 100)}% (+{best_slack} min slack)"
        f"{fallback_note}."
    )

    return SwitchRecommendation(
        id=f"sw_{active.version + 1}",
        trip_id=active.trip_id,
        mode="MIXED" if best_mode == "MIXED" else "FULL",
        reason=reason,
        feasibility_a=round(val_a.feasibility, 4),
        feasibility_b=round(best_feas, 4),
        slack_a_min=min_eff_a,
        slack_b_min=best_slack,
        delta_cost_inr=delta_cost,
        lost_items=lost_items,
        kept_booking_item_ids=kept_booking_item_ids,
        changed_booking_item_ids=changed_booking_item_ids,
        resulting_plan=best_plan,
        sources=sources,
        state="PROPOSED",
        created_at=now,
    )
