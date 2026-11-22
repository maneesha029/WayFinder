"""Pure plan validator and probabilistic feasibility model (Owner: P3).

Independence assumption: link transition durations are modelled as independent
normal random variables so P_link = Phi(effective_slack / sqrt(sum(sigma^2))).
"""
from __future__ import annotations

import math
import time
from datetime import datetime, timedelta
from typing import Any

from contracts.models import Plan, PlanItem, ProofCheck, Signal, TripIntent, Validation
from engine import config


def norm_cdf(x: float) -> float:
    """Standard normal cumulative distribution function."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _item_sigma(item: PlanItem) -> float:
    if item.type == "FLIGHT":
        return config.SIGMA_MIN["FLIGHT"]
    if item.type == "TRANSFER":
        if "GHAT_ROAD" in item.risk_tags:
            return config.SIGMA_MIN["GHAT_TRANSFER"]
        return config.SIGMA_MIN["TRANSFER"]
    if item.type == "HOTEL":
        return config.SIGMA_MIN["HOTEL"]
    return config.SIGMA_MIN["ACTIVITY"]


def _local_minutes(dt: datetime) -> int:
    # Convert to +05:30 if offset-aware, else use wall-clock hour/minute
    if dt.tzinfo is not None:
        ist_offset = timedelta(hours=5, minutes=30)
        dt_ist = dt.astimezone(tz=dt.tzinfo)
        # Normalise explicitly to +05:30
        from datetime import timezone

        dt_ist = dt.astimezone(timezone(ist_offset))
        return dt_ist.hour * 60 + dt_ist.minute
    return dt.hour * 60 + dt.minute


def _direct_signal_uplift(item: PlanItem, signals: list[Signal]) -> tuple[int, list[str]]:
    """Compute direct delay/weather/bandh uplift (minutes) on an item and matching signal IDs."""
    delay = 0
    matched: list[str] = []

    for sig in signals:
        if sig.kind == "FLIGHT_STATUS" and item.type == "FLIGHT":
            if sig.item_id == item.id or (sig.item_id is None and item.day == 1):
                d = int(sig.payload.get("delay_min", 0))
                if d > 0:
                    delay += d
                    matched.append(sig.id)

        elif sig.kind == "TRAFFIC" and item.type == "TRANSFER":
            sig_day = sig.payload.get("day")
            if sig.item_id == item.id or (sig.item_id is None and (sig_day is None or sig_day == item.day)):
                d = int(sig.payload.get("delay_min", 0))
                if d > 0:
                    delay += d
                    matched.append(sig.id)

        elif sig.kind == "WEATHER":
            sig_day = sig.payload.get("day")
            rain = str(sig.payload.get("rain", "")).upper()
            if rain and ("GHAT_ROAD" in item.risk_tags or "RAIN" in item.risk_tags) and (sig.item_id == item.id or sig_day == item.day):
                delay += config.WEATHER_UPLIFT_MIN.get(rain, 15)
                matched.append(sig.id)

        elif sig.kind == "LOCAL_EVENT":
            sig_day = sig.payload.get("day")
            ev_kind = str(sig.payload.get("kind", "")).upper()
            is_bandh = ev_kind in ("BANDH", "STRIKE") or "bandh" in sig.summary.lower()
            if is_bandh and (sig.item_id == item.id or sig_day == item.day):
                delay += config.BANDH_UPLIFT_MIN
                matched.append(sig.id)

    return delay, matched


def _trace_chain(item: PlanItem, by_id: dict[str, PlanItem]) -> list[PlanItem]:
    """Build ordered chain [root_ancestor, ..., item] along first dependency."""
    chain = [item]
    seen = {item.id}
    cur = item
    while cur.depends_on:
        pred_id = cur.depends_on[0]
        if pred_id in seen or pred_id not in by_id:
            break
        pred = by_id[pred_id]
        chain.append(pred)
        seen.add(pred_id)
        cur = pred
    chain.reverse()
    return chain


def compute_link_metrics(plan: Plan, signals: list[Signal]) -> dict[str, dict[str, Any]]:
    """Compute per-hard-link scheduled slack, effective slack, sigma, and P_link."""
    by_id = {it.id: it for it in plan.items}
    metrics: dict[str, dict[str, Any]] = {}

    for target in plan.items:
        if not target.depends_on:
            continue
        if not (target.fixed or target.hard_deadline is not None):
            continue

        chain = _trace_chain(target, by_id)
        if len(chain) < 2:
            continue
        pred = chain[-2]

        # Determine deadline & transit overhead
        if target.type == "FLIGHT" and pred.type == "TRANSFER":
            deadline = target.hard_deadline or target.start
            overhead = config.AIRPORT_CHECKIN_OVERHEAD_MIN
        elif target.type == "TRANSFER" and pred.type == "FLIGHT":
            deadline = target.start
            overhead = 0
        else:
            deadline = target.hard_deadline or target.start
            overhead = config.GATE_OVERHEAD_MIN

        scheduled_slack = round((deadline - pred.end).total_seconds() / 60.0) - overhead

        # Propagate signal delays along chain
        propagated_delay = 0
        matched_signals: list[str] = []
        for idx in range(len(chain) - 1):
            u = chain[idx]
            v = chain[idx + 1]
            u_delay, u_sigs = _direct_signal_uplift(u, signals)
            matched_signals.extend(u_sigs)
            propagated_delay += u_delay

            # Intentional excess standby buffer between FLIGHT and TRANSFER absorbs delay
            if u.type == "FLIGHT" and v.type == "TRANSFER" and idx < len(chain) - 2:
                gap_min = round((v.start - u.end).total_seconds() / 60.0)
                excess_padding = max(0, gap_min - config.AIRPORT_EXIT_BUFFER_MIN)
                propagated_delay = max(0, propagated_delay - excess_padding)

        # Target's own weather/traffic uplift if applicable (not flight delay since target isn't upstream)
        if target.type != "FLIGHT":
            t_delay, t_sigs = _direct_signal_uplift(target, signals)
            matched_signals.extend(t_sigs)
            propagated_delay += t_delay

        effective_slack = scheduled_slack - propagated_delay

        # Link sigma over uncertain transit legs
        sigmas: list[float] = []
        for node in chain[:-1]:
            if node.type in ("FLIGHT", "TRANSFER"):
                sigmas.append(_item_sigma(node))
        if target.type in ("FLIGHT", "TRANSFER"):
            sigmas.append(_item_sigma(target))
        if not sigmas:
            sigmas.append(_item_sigma(pred))

        sigma_link = math.sqrt(sum(s * s for s in sigmas))
        p_link = norm_cdf(effective_slack / sigma_link) if sigma_link > 0 else (1.0 if effective_slack >= 0 else 0.0)

        metrics[target.id] = {
            "target_id": target.id,
            "pred_id": pred.id,
            "chain_ids": [n.id for n in chain],
            "scheduled_slack_min": scheduled_slack,
            "delay_uplift_min": propagated_delay,
            "effective_slack_min": effective_slack,
            "sigma_link_min": round(sigma_link, 2),
            "p_link": p_link,
            "signal_ids": list(dict.fromkeys(matched_signals)),
        }

    return metrics


def validate(
    plan: Plan,
    intent: TripIntent,
    signals: list[Signal],
    now: datetime,
) -> Validation:
    """Validate hard constraints and compute probabilistic feasibility for a Plan."""
    t0 = time.perf_counter()
    checks: list[ProofCheck] = []
    budget = intent.budget_inr if intent.budget_inr is not None else plan.total_cost_inr + plan.validation.budget_headroom_inr
    headroom = budget - plan.total_cost_inr

    # 1. Budget check
    budget_ok = plan.total_cost_inr <= budget
    budget_fit = 1.0 if budget_ok else max(0.0, 1.0 - (plan.total_cost_inr - budget) / max(1, budget))
    checks.append(
        ProofCheck(
            name="budget",
            passed=budget_ok,
            detail=f"₹{plan.total_cost_inr:,} of ₹{budget:,}",
        )
    )

    # 2. Hard connection links
    link_metrics = compute_link_metrics(plan, signals)
    p_prod = 1.0
    min_slack: int | None = None
    all_links_ok = True
    for target_id, lm in link_metrics.items():
        eff = int(lm["effective_slack_min"])
        p_val = float(lm["p_link"])
        p_prod *= p_val
        if min_slack is None or eff < min_slack:
            min_slack = eff
        ok = eff >= 0
        if not ok:
            all_links_ok = False
        checks.append(
            ProofCheck(
                name=f"hard_connection:{lm['pred_id']}->{target_id}",
                passed=ok,
                detail=f"{eff} min effective slack (P={p_val:.2f}, σ={lm['sigma_link_min']:.1f} min)",
            )
        )

    if min_slack is None:
        min_slack = 60

    # 3. Daily hours check (08:00 - 19:30 for activities)
    daily_violations: list[str] = []
    for it in plan.items:
        if it.type == "ACTIVITY":
            s_min = _local_minutes(it.start)
            e_min = _local_minutes(it.end)
            if s_min < config.DAY_START_MIN or e_min > config.DAY_END_MIN:
                daily_violations.append(it.title)
    daily_ok = len(daily_violations) == 0
    checks.append(
        ProofCheck(
            name="daily_hours",
            passed=daily_ok,
            detail=(
                "All activities scheduled within 08:00–19:30"
                if daily_ok
                else f"Outside 08:00–19:30: {', '.join(daily_violations)}"
            ),
        )
    )

    # 4. No night ghat driving (< 18:00)
    night_ghats: list[str] = []
    for it in plan.items:
        if it.type == "TRANSFER" and "GHAT_ROAD" in it.risk_tags and _local_minutes(it.end) > config.NIGHT_GHAT_CUTOFF_MIN:
            night_ghats.append(it.title)
    ghat_ok = len(night_ghats) == 0
    checks.append(
        ProofCheck(
            name="no_night_ghat",
            passed=ghat_ok,
            detail=(
                "All ghat transfers finish before 18:00"
                if ghat_ok
                else f"Night ghat transfer after 18:00: {', '.join(night_ghats)}"
            ),
        )
    )

    # 5. Refundability coverage summary
    refundable_val = sum(it.price_inr for it in plan.items if it.refundable)
    pct_ref = round(100.0 * refundable_val / max(1, plan.total_cost_inr))
    checks.append(
        ProofCheck(
            name="refundability",
            passed=True,
            detail=f"₹{refundable_val:,} ({pct_ref}%) refundable across {sum(1 for i in plan.items if i.refundable)} items",
        )
    )

    # Soft constraint check (pace)
    soft_violations = 0
    if intent.pace:
        max_act = config.PACE_MAX_ACTIVITIES.get(intent.pace, 3)
        by_day: dict[int, int] = {}
        for it in plan.items:
            if it.type == "ACTIVITY":
                by_day[it.day] = by_day.get(it.day, 0) + 1
        if any(cnt > max_act for cnt in by_day.values()):
            soft_violations += 1

    constraint_sat = 0.8 ** soft_violations
    feasibility = round(max(0.0, min(1.0, p_prod * budget_fit * constraint_sat)), 4)
    feasible = budget_ok and daily_ok and ghat_ok and all_links_ok

    solve_ms = max(1, int((time.perf_counter() - t0) * 1000))
    return Validation(
        feasible=feasible,
        checks=checks,
        min_slack_min=min_slack,
        budget_headroom_inr=headroom,
        feasibility=feasibility,
        solver=plan.validation.solver if plan.validation else "ortools-cp-sat",
        solve_ms=solve_ms,
    )
