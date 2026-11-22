"""Pure Optionality-aware booking report (Flex vs Saver expected-loss math) (Owner: P3)."""
from __future__ import annotations

from datetime import datetime

from contracts.models import (
    Inventory,
    Offer,
    OptionalityReport,
    Plan,
    PlanItem,
    RiskLine,
    Signal,
)
from engine import config
from engine.validator import compute_link_metrics


def _item_weather_strike_risk(item: PlanItem, signals: list[Signal]) -> float:
    risk = 0.0
    if "RAIN" in item.risk_tags or "GHAT_ROAD" in item.risk_tags:
        risk = config.RAIN_BASE_RISK
    for s in signals:
        if s.kind == "WEATHER":
            s_day = s.payload.get("day")
            if s.item_id == item.id or s_day == item.day:
                rain = str(s.payload.get("rain", "")).upper()
                if rain == "HEAVY":
                    risk = max(risk, config.RAIN_HEAVY_RISK)
                elif rain in ("MODERATE", "RAIN"):
                    risk = max(risk, config.RAIN_MOD_RISK)
        elif s.kind == "LOCAL_EVENT":
            s_day = s.payload.get("day")
            ev_kind = str(s.payload.get("kind", "")).upper()
            if (ev_kind in ("BANDH", "STRIKE") or "bandh" in s.summary.lower()) and (
                s.item_id == item.id or s_day == item.day
            ) and ("GHAT_ROAD" in item.risk_tags or "CROWD" in item.risk_tags or item.type == "TRANSFER"):
                risk = max(risk, config.BANDH_RISK)
    return risk


def report(
    plan: Plan,
    signals: list[Signal],
    inventory: Inventory,
    now: datetime,
) -> OptionalityReport:
    """Evaluate expected disruption loss vs flex premium per item and recommend FLEX vs SAVER."""
    link_metrics = compute_link_metrics(plan, signals)
    all_offers: dict[str, Offer] = {
        o.id: o
        for o in (inventory.flights + inventory.hotels + inventory.transfers + inventory.activities)
    }

    # Map each item to minimum P_link of any hard link that passes through it
    item_p_link: dict[str, float] = {}
    for lm in link_metrics.values():
        p_val = float(lm["p_link"])
        for nid in lm["chain_ids"]:
            if nid not in item_p_link or p_val < item_p_link[nid]:
                item_p_link[nid] = p_val

    lines: list[RiskLine] = []
    total_saver = 0
    total_saver_risk_loss = 0
    total_flex_cost = 0

    for it in plan.items:
        if it.price_inr <= 0:
            continue
        p = it.price_inr
        p_link = item_p_link.get(it.id, 1.0)
        w_i = _item_weather_strike_risk(it, signals)
        q = max(0.0, min(1.0, 1.0 - p_link * (1.0 - w_i)))

        offer = all_offers.get(it.id)
        if offer is not None and offer.flex_premium_inr is not None:
            flex_prem = offer.flex_premium_inr
        elif it.refundable:
            flex_prem = 0
        else:
            flex_prem = max(150, round(p * 0.12))

        expected_loss_saver = round(q * p)
        rebook_fee = it.rebook_fee_inr if it.rebook_fee_inr is not None else 0
        expected_loss_flex = round(q * rebook_fee)

        rec = "FLEX" if expected_loss_saver > flex_prem > 0 else "SAVER"
        if it.refundable and flex_prem == 0 and q >= 0.15:
            # Already refundable at 0 flex premium
            rec = "FLEX"

        reason = (
            f"Disruption risk {round(q * 100)}% gives expected loss ₹{expected_loss_saver:,} "
            f"{'>' if expected_loss_saver > flex_prem else '<='} flex premium ₹{flex_prem:,}."
        )
        lines.append(
            RiskLine(
                item_id=it.id,
                disruption_prob=round(q, 4),
                expected_loss_inr=expected_loss_saver,
                flex_premium_inr=flex_prem,
                recommended=rec,
                reason=reason,
            )
        )

        total_saver += p
        total_saver_risk_loss += expected_loss_saver
        if rec == "FLEX":
            total_flex_cost += p + flex_prem + expected_loss_flex
        else:
            total_flex_cost += p + expected_loss_saver

    total_saver_with_risk = total_saver + total_saver_risk_loss
    flex_picks = [
        next((it.title for it in plan.items if it.id == ln.item_id), ln.item_id)
        for ln in lines
        if ln.recommended == "FLEX" and ln.flex_premium_inr > 0
    ]
    if flex_picks:
        recommendation = (
            f"Choose FLEX on {', '.join(flex_picks)}: expected risk-adjusted total is "
            f"₹{total_flex_cost:,} vs ₹{total_saver_with_risk:,} saver-with-risk."
        )
    else:
        recommendation = (
            f"Keep SAVER fares under current low risk: expected total is "
            f"₹{total_saver_with_risk:,} (base ₹{total_saver:,})."
        )

    return OptionalityReport(
        trip_id=plan.trip_id,
        lines=lines,
        total_saver_inr=total_saver,
        total_saver_with_risk_inr=total_saver_with_risk,
        total_flex_inr=total_flex_cost,
        recommendation=recommendation,
    )
