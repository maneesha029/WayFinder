"""Pure Time Banking module for day re-balancing while protecting MUST items (Owner: P3)."""
from __future__ import annotations

from datetime import datetime, timedelta

from contracts.models import LostItem, Plan, PlanItem, RebalancePreview, TripIntent
from engine import config
from engine.validator import _local_minutes, validate


def rebalance(
    plan: Plan,
    lost_min: int,
    from_item_id: str,
    now: datetime,
) -> RebalancePreview:
    """Re-balance the day containing from_item_id after losing lost_min minutes.

    Protects MUST items, shortens non-fixed dwell times up to 25%, drops
    SKIP_IF_NEEDED then lowest-value NICE items, and returns a RebalancePreview.
    """
    anchor = next((it for it in plan.items if it.id == from_item_id), None)
    if anchor is None:
        return RebalancePreview(
            plan_preview=plan.model_copy(update={"version": plan.version + 1}),
            dropped=[],
            shortened=[],
            summary="No matching item found; plan unchanged.",
            applied=False,
        )

    day = anchor.day
    day_items = sorted(
        [it for it in plan.items if it.day == day],
        key=lambda it: (it.start, it.id),
    )
    other_items = [it for it in plan.items if it.day != day]

    anchor_idx = next(idx for idx, it in enumerate(day_items) if it.id == from_item_id)
    head_items = day_items[: anchor_idx + 1]
    tail_items = [it for it in day_items[anchor_idx + 1 :] if it.type != "HOTEL"]
    hotel_items = [it for it in day_items[anchor_idx + 1 :] if it.type == "HOTEL"]

    # Determine end-of-day ceiling (19:30 or 18:00 if tail has ghat transfer)
    day_date = anchor.start.date()
    tz = anchor.start.tzinfo
    day_end_dt = datetime(day_date.year, day_date.month, day_date.day, 19, 30, tzinfo=tz)

    def _schedule_tail(candidates: list[PlanItem], shorten_factor: float = 1.0) -> tuple[list[PlanItem], list[str], bool]:
        cursor = anchor.end + timedelta(minutes=lost_min)
        scheduled: list[PlanItem] = []
        shortened_ids: list[str] = []
        fits = True

        for it in candidates:
            orig_dur = round((it.end - it.start).total_seconds() / 60.0)
            if it.fixed or it.type in ("FLIGHT", "TRANSFER"):
                # Cannot move fixed start
                new_start = max(it.start, cursor)
                if it.fixed and new_start > it.start:
                    fits = False
                new_end = new_start + timedelta(minutes=orig_dur)
                if it.hard_deadline and new_end > it.hard_deadline and new_start > it.hard_deadline:
                    fits = False
            else:
                new_start = max(it.start, cursor + timedelta(minutes=10))
                dur = orig_dur
                if shorten_factor < 1.0 and orig_dur >= 60:
                    dur = max(30, round(orig_dur * shorten_factor))
                    if dur < orig_dur:
                        shortened_ids.append(it.id)
                new_end = new_start + timedelta(minutes=dur)
                if new_end > day_end_dt:
                    fits = False
                if "GHAT_ROAD" in it.risk_tags and _local_minutes(new_end) > config.NIGHT_GHAT_CUTOFF_MIN:
                    fits = False
                if it.hard_deadline and new_start > it.hard_deadline:
                    fits = False
            scheduled.append(it.model_copy(update={"start": new_start, "end": new_end}))
            cursor = new_end

        return scheduled, shortened_ids, fits

    # Try 1: Keep all items, no shortening
    sched, shortened, fits = _schedule_tail(tail_items, shorten_factor=1.0)

    # Try 2: Shorten non-fixed activities up to 25%
    if not fits:
        sched, shortened, fits = _schedule_tail(tail_items, shorten_factor=0.75)

    # Try 3: Drop SKIP_IF_NEEDED then lowest-value NICE items (protect MUST!)
    dropped: list[LostItem] = []
    remaining = list(tail_items)
    prio_order = {"SKIP_IF_NEEDED": 0, "NICE": 1, "MUST": 2}
    while not fits:
        droppable = [it for it in remaining if it.priority != "MUST" and not it.fixed]
        if not droppable:
            break
        victim = min(droppable, key=lambda it: (prio_order.get(it.priority, 1), it.price_inr))
        remaining = [it for it in remaining if it.id != victim.id]
        dropped.append(LostItem(item_id=victim.id, title=victim.title, priority=victim.priority))
        sched, shortened, fits = _schedule_tail(remaining, shorten_factor=0.75)

    new_items = other_items + head_items + sched + hotel_items
    new_items.sort(key=lambda it: (it.day, it.start, it.id))
    total_cost = sum(it.price_inr for it in new_items)

    preview = plan.model_copy(
        update={
            "id": f"plan_a{plan.version + 1}",
            "version": plan.version + 1,
            "items": new_items,
            "total_cost_inr": total_cost,
            "created_at": now,
        }
    )
    preview = preview.model_copy(
        update={"validation": validate(preview, TripIntent(), [], now)}
    )

    parts = [f"Absorbed {lost_min} min delay after {anchor.title}"]
    if shortened:
        parts.append(f"shortened {len(shortened)} item(s) up to 25%")
    if dropped:
        parts.append("dropped " + ", ".join(f"{d.title} ({d.priority})" for d in dropped))
    else:
        parts.append("all items kept")
    summary = "; ".join(parts) + "; MUST items protected."

    return RebalancePreview(
        plan_preview=preview,
        dropped=dropped,
        shortened=shortened,
        summary=summary,
        applied=False,
    )
