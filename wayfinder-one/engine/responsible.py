"""Pure Responsible Travel CO2 calculation & alternative insights (Owner: P3)."""
from __future__ import annotations

from contracts.models import (
    Inventory,
    Offer,
    Plan,
    PlanItem,
    ResponsibleInsight,
    ResponsibleReport,
    Signal,
)
from engine import config, geo


def _transfer_mode_for(title: str, tags: list[str]) -> str:
    low = title.lower()
    tset = {t.lower() for t in tags}
    if "ev" in low or "shared_ev" in tset:
        return "EV_SHUTTLE"
    if "bus" in low or "bus" in tset:
        return "BUS"
    if "train" in low or "express" in low:
        return "TRAIN"
    if "metro" in low:
        return "METRO"
    if "walk" in low:
        return "WALK"
    return "CAR"


def item_co2_kg(item: PlanItem, travellers: int = 2, tags: list[str] | None = None) -> float:
    """Compute illustrative CO2 kg for a PlanItem using EMISSION_FACTORS_V1."""
    if item.co2_kg is not None:
        return round(item.co2_kg, 2)
    dist_km = 0.0
    if item.origin is not None and item.place is not None:
        dist_km = geo.haversine_km(item.origin, item.place)
    if item.type == "FLIGHT":
        return round(dist_km * config.EMISSION_FACTORS_V1["FLIGHT"] * max(1, travellers), 2)
    if item.type == "TRANSFER":
        mode = _transfer_mode_for(item.title, tags or [])
        factor = config.EMISSION_FACTORS_V1.get(mode, config.EMISSION_FACTORS_V1["CAR"])
        if mode == "CAR":
            # Vehicle emissions split across passengers, total for party = vehicle_km * factor
            return round(dist_km * config.DETOUR_FACTOR * factor, 2)
        return round(dist_km * config.DETOUR_FACTOR * factor * max(1, travellers), 2)
    if item.type == "ACTIVITY":
        return 0.0 if item.indoor else config.EMISSION_FACTORS_V1["ACTIVITY_DEFAULT"]
    return 0.0


def _offer_co2_kg(offer: Offer, travellers: int = 2) -> float:
    if offer.co2_kg is not None:
        return round(offer.co2_kg, 2)
    dist_km = 0.0
    if offer.origin is not None and offer.place is not None:
        dist_km = geo.haversine_km(offer.origin, offer.place)
    if offer.type == "FLIGHT":
        return round(dist_km * config.EMISSION_FACTORS_V1["FLIGHT"] * max(1, travellers), 2)
    if offer.type == "TRANSFER":
        mode = _transfer_mode_for(offer.title, offer.tags)
        factor = config.EMISSION_FACTORS_V1.get(mode, config.EMISSION_FACTORS_V1["CAR"])
        if mode == "CAR":
            return round(dist_km * config.DETOUR_FACTOR * factor, 2)
        return round(dist_km * config.DETOUR_FACTOR * factor * max(1, travellers), 2)
    return 0.0 if offer.indoor else config.EMISSION_FACTORS_V1["ACTIVITY_DEFAULT"]


def report(
    plan: Plan,
    signals: list[Signal],
    inventory: Inventory,
    travellers: int = 2,
) -> ResponsibleReport:
    """Compute trip CO2 footprint by mode and actionable eco/crowd/local alternatives."""
    by_mode: dict[str, float] = {}
    all_offers = inventory.flights + inventory.hotels + inventory.transfers + inventory.activities
    offer_by_id = {o.id: o for o in all_offers}

    item_emissions: dict[str, float] = {}
    for it in plan.items:
        off = offer_by_id.get(it.id)
        co2 = item_co2_kg(it, travellers=travellers, tags=off.tags if off else [])
        item_emissions[it.id] = co2
        if co2 > 0:
            by_mode[it.type] = round(by_mode.get(it.type, 0.0) + co2, 2)

    total_co2 = round(sum(item_emissions.values()), 2)
    insights: list[ResponsibleInsight] = []
    plan_ids = {it.id for it in plan.items}

    # 1. CO2 insight: look for lower-emission transfer alternative
    transfers = sorted(
        [it for it in plan.items if it.type == "TRANSFER"],
        key=lambda x: item_emissions.get(x.id, 0.0),
        reverse=True,
    )
    for tr in transfers:
        tr_co2 = item_emissions.get(tr.id, 0.0)
        eco_alts = [
            o for o in inventory.transfers
            if o.id not in plan_ids
            and ("eco" in o.tags or "shared_ev" in o.tags or "bus" in o.title.lower())
            and (o.origin is None or tr.origin is None or o.origin.name == tr.origin.name)
            and (o.place is None or tr.place is None or o.place.name == tr.place.name)
        ]
        if eco_alts:
            best = min(eco_alts, key=lambda o: _offer_co2_kg(o, travellers))
            alt_co2 = _offer_co2_kg(best, travellers)
            saving = round(max(0.0, tr_co2 - alt_co2), 2)
            insights.append(
                ResponsibleInsight(
                    item_id=tr.id,
                    kind="CO2",
                    title=f"Lower-emission transfer available for {tr.title}",
                    detail=f"Switch to {best.title} to save {saving:.1f} kg CO₂ ({best.price_inr - tr.price_inr:+,d} ₹).",
                    alternative_offer_id=best.id,
                    co2_saving_kg=saving,
                    delta_cost_inr=best.price_inr - tr.price_inr,
                )
            )
            break

    # 2. CROWD_RELIEF insight: CROWD-tagged item -> offbeat alternative
    for it in plan.items:
        if "CROWD" in it.risk_tags:
            it_tags = set(offer_by_id[it.id].tags) if it.id in offer_by_id else set()
            alts = [
                o for o in inventory.activities
                if o.id not in plan_ids
                and "offbeat" in o.tags
                and (not it_tags or bool(it_tags & set(o.tags)) or o.destination == (offer_by_id[it.id].destination if it.id in offer_by_id else None))
            ]
            if alts:
                best = alts[0]
                saving = round(max(0.0, item_emissions.get(it.id, 0.0) - _offer_co2_kg(best, travellers)), 2)
                insights.append(
                    ResponsibleInsight(
                        item_id=it.id,
                        kind="CROWD_RELIEF",
                        title=f"Avoid peak crowds at {it.title}",
                        detail=f"Try {best.title} for a quieter, lower-impact experience.",
                        alternative_offer_id=best.id,
                        co2_saving_kg=saving,
                        delta_cost_inr=best.price_inr - it.price_inr,
                    )
                )
                break

    # 3. LOCAL_ECONOMY insight
    local_items = [
        it for it in plan.items
        if it.id in offer_by_id and "local_owned" in offer_by_id[it.id].tags
    ]
    if local_items:
        insights.append(
            ResponsibleInsight(
                item_id=local_items[0].id,
                kind="LOCAL_ECONOMY",
                title="Locally owned stay or experience included",
                detail=f"{local_items[0].title} keeps spend inside the local community.",
            )
        )
    else:
        local_alts = [o for o in inventory.activities if "local_owned" in o.tags and o.id not in plan_ids]
        if local_alts and plan.items:
            anchor = next((it for it in plan.items if it.type == "ACTIVITY"), plan.items[0])
            best = local_alts[0]
            insights.append(
                ResponsibleInsight(
                    item_id=anchor.id,
                    kind="LOCAL_ECONOMY",
                    title="Support a locally owned operator",
                    detail=f"Consider {best.title} (locally run).",
                    alternative_offer_id=best.id,
                    delta_cost_inr=best.price_inr - anchor.price_inr,
                )
            )

    # 4. ECO_HERITAGE insight
    eco_alts = [
        o for o in inventory.activities
        if o.id not in plan_ids and ("eco" in o.tags or "heritage" in o.tags)
    ]
    if eco_alts:
        anchor = next((it for it in plan.items if "CROWD" in it.risk_tags or it.type == "ACTIVITY"), None)
        if anchor is not None:
            best = eco_alts[0]
            insights.append(
                ResponsibleInsight(
                    item_id=anchor.id,
                    kind="ECO_HERITAGE",
                    title="Eco & heritage alternative available",
                    detail=f"{best.title} highlights regional heritage with minimal footprint.",
                    alternative_offer_id=best.id,
                    co2_saving_kg=round(max(0.0, item_emissions.get(anchor.id, 0.0) - _offer_co2_kg(best, travellers)), 2),
                    delta_cost_inr=best.price_inr - anchor.price_inr,
                )
            )

    return ResponsibleReport(
        trip_id=plan.trip_id,
        total_co2_kg=total_co2,
        by_mode=by_mode,
        insights=insights,
        method=config.EMISSION_METHOD_V1,
    )
