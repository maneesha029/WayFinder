"""Pure Slack Score & Journey Health computation (Owner: P3)."""
from __future__ import annotations

from datetime import datetime

from contracts.models import Health, Plan, Signal, SlackComponents, SlackScore
from engine import config
from engine.validator import compute_link_metrics


def _clamp(val: float, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, round(val)))


def compute_slack(
    plan: Plan,
    signals: list[Signal],
    now: datetime,
    budget_inr: int | None = None,
) -> SlackScore:
    """Compute the 0-100 Slack Score, 5 components, Health band, and templated explanation."""
    metrics = compute_link_metrics(plan, signals)

    if metrics:
        weakest_entry = min(metrics.values(), key=lambda m: float(m["p_link"]))
        weakest_id: str | None = str(weakest_entry["target_id"])
        min_eff_slack = min(int(m["effective_slack_min"]) for m in metrics.values())
        p_prod = 1.0
        for m in metrics.values():
            p_prod *= float(m["p_link"])
    else:
        weakest_entry = None
        weakest_id = plan.items[0].id if plan.items else None
        min_eff_slack = plan.validation.min_slack_min if plan.validation else 60
        p_prod = plan.validation.feasibility if plan.validation else 0.95

    time_buffer = _clamp(100.0 * min_eff_slack / 60.0)
    delay_risk = _clamp(100.0 * p_prod)

    # Weather hits on RAIN-tagged items or matching days
    rain_days: dict[int, int] = {}
    for s in signals:
        if s.kind == "WEATHER":
            rain = str(s.payload.get("rain", "")).upper()
            d = s.payload.get("day")
            if rain and d is not None:
                weight = 2 if rain == "HEAVY" else 1
                rain_days[int(d)] = max(rain_days.get(int(d), 0), weight)
    rain_hits = 0
    for it in plan.items:
        if ("RAIN" in it.risk_tags or "GHAT_ROAD" in it.risk_tags) and it.day in rain_days:
            rain_hits += rain_days[it.day]
    weather_risk = _clamp(100 - 25 * rain_hits)

    # Crowd & bandh risk
    crowd_items = sum(1 for it in plan.items if "CROWD" in it.risk_tags)
    bandh_days = {
        s.payload.get("day")
        for s in signals
        if s.kind == "LOCAL_EVENT"
        and (
            str(s.payload.get("kind", "")).upper() in ("BANDH", "STRIKE")
            or "bandh" in s.summary.lower()
        )
    }
    crowd_risk = _clamp(100 - 15 * crowd_items - 30 * len(bandh_days))

    # Budget headroom
    inferred_budget = budget_inr
    if inferred_budget is None:
        inferred_budget = plan.total_cost_inr + (
            plan.validation.budget_headroom_inr if plan.validation else 0
        )
    headroom = max(0, inferred_budget - plan.total_cost_inr)
    denom = max(1.0, 0.2 * max(1, inferred_budget))
    budget_headroom = _clamp(100.0 * headroom / denom)

    w_tb, w_dr, w_w, w_c, w_b = config.SLACK_WEIGHTS
    raw_score = (
        w_tb * time_buffer
        + w_dr * delay_risk
        + w_w * weather_risk
        + w_c * crowd_risk
        + w_b * budget_headroom
    )
    score = _clamp(raw_score)

    if score >= config.HEALTH_GREEN_MIN:
        health: Health = "GREEN"
    elif score >= config.HEALTH_AMBER_MIN:
        health = "AMBER"
    else:
        health = "RED"

    by_id = {it.id: it for it in plan.items}
    weak_title = by_id[weakest_id].title if weakest_id and weakest_id in by_id else "schedule"
    if weakest_entry is not None:
        p_pct = round(float(weakest_entry["p_link"]) * 100)
        eff = int(weakest_entry["effective_slack_min"])
        if health == "GREEN":
            explanation = (
                f"Healthy buffer: tightest link is {weak_title} with +{eff} min effective slack "
                f"({p_pct}% on-time probability)."
            )
        elif health == "AMBER":
            explanation = (
                f"Tight buffer: {weak_title} drops to {eff:+d} min effective slack "
                f"({p_pct}% link probability)."
            )
        else:
            explanation = (
                f"Critical risk: {weak_title} has {eff:+d} min effective slack "
                f"({p_pct}% link probability); switch or reroute recommended."
            )
    else:
        explanation = f"Slack Score {score}/100 ({health}) with ₹{headroom:,} budget headroom."

    return SlackScore(
        trip_id=plan.trip_id,
        health=health,
        score=score,
        components=SlackComponents(
            time_buffer=time_buffer,
            delay_risk=delay_risk,
            weather_risk=weather_risk,
            crowd_risk=crowd_risk,
            budget_headroom=budget_headroom,
        ),
        weakest_item_id=weakest_id,
        explanation=explanation,
        computed_at=now,
    )
