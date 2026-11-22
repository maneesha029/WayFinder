"""Courtesy message drafter for hotels, drivers, vendors, and companions (Owner: P3)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from agent import i18n, llm
from contracts.models import (
    CourtesyDraft,
    Plan,
    PlanItem,
    SwitchRecommendation,
    Trip,
)

IST = timezone(timedelta(hours=5, minutes=30))


def _fmt_time(dt: datetime) -> str:
    d = dt.astimezone(IST) if dt.tzinfo else dt
    return d.strftime("%H:%M")


def _fmt_date(dt: datetime) -> str:
    d = dt.astimezone(IST) if dt.tzinfo else dt
    return d.strftime("%d %b")


def _extract_delay_min(rec: SwitchRecommendation) -> int:
    import re

    m = re.search(r"delay(?:ed)?(?:\s+by)?\s+(\d+)\s*min", rec.reason, re.IGNORECASE)
    if m:
        return max(0, int(m.group(1)))
    return 55


def _find_item(plan: Plan, item_type: str, base_title: str | None = None) -> PlanItem | None:
    for it in plan.items:
        if it.type == item_type and (base_title is None or base_title in it.title.lower()):
            return it
    return None


def draft_messages(
    rec: SwitchRecommendation,
    trip: Trip,
    active: Plan,
    standby: Plan,
    locale: str = "en",
) -> list[CourtesyDraft]:
    """Create structured, guard-verified HOTEL, DRIVER, VENDOR (and optional COMPANION) drafts."""
    lang = locale if locale in ("en", "hi", "hinglish") else "en"
    created = rec.created_at
    delay_min = _extract_delay_min(rec)
    new_plan = rec.resulting_plan

    drafts: list[CourtesyDraft] = []

    # 1. HOTEL draft (EMAIL)
    hotel = _find_item(new_plan, "HOTEL")
    inbound_cab = next((it for it in new_plan.items if it.type == "TRANSFER" and it.day == 1), None)
    if hotel is not None:
        eta_dt = inbound_cab.end if inbound_cab else hotel.start
        cutoff_dt = hotel.hard_deadline or hotel.end
        hotel_ref = hotel.booking.supplier_ref if hotel.booking and hotel.booking.supplier_ref else "SIM-H-101"
        hotel_name = hotel.title.split(",")[0].strip()

        subj = i18n.render("courtesy.hotel.subject", lang, time=_fmt_time(eta_dt), recipient=hotel_name)
        body_tmpl = i18n.render(
            "courtesy.hotel.body",
            lang,
            recipient=hotel_name,
            delay_min=delay_min,
            time=_fmt_time(eta_dt),
            date_str=_fmt_date(eta_dt),
            cutoff=_fmt_time(cutoff_dt),
            ref=hotel_ref,
        )
        facts = {
            "recipient": hotel_name,
            "delay_min": delay_min,
            "eta": _fmt_time(eta_dt),
            "cutoff": _fmt_time(cutoff_dt),
            "ref": hotel_ref,
        }
        polished_body, _ = llm.polish_courtesy(body_tmpl, facts, lang)
        drafts.append(
            CourtesyDraft(
                id="dr_1",
                trip_id=trip.id,
                recommendation_id=rec.id,
                recipient_kind="HOTEL",
                recipient_name=hotel_name,
                channel="EMAIL",
                language=lang,  # type: ignore[arg-type]
                subject=subj,
                body=polished_body,
                state="DRAFT",
                created_at=created,
            )
        )

    # 2. DRIVER draft (WHATSAPP)
    old_cab = next((it for it in active.items if it.type == "TRANSFER" and it.day == 1), None)
    if inbound_cab is not None:
        cab_ref = (
            old_cab.booking.supplier_ref
            if old_cab and old_cab.booking and old_cab.booking.supplier_ref
            else "SIM-C-4102"
        )
        wait_fee = old_cab.rebook_fee_inr if old_cab and old_cab.rebook_fee_inr is not None else 1400
        driver_name = "Munnar Cab Service"
        body_tmpl = i18n.render(
            "courtesy.driver.body",
            lang,
            recipient=driver_name,
            delay_min=delay_min,
            time=_fmt_time(inbound_cab.start),
            date_str=_fmt_date(inbound_cab.start),
            amount_inr=f"{wait_fee:,}",
            ref=cab_ref,
        )
        facts = {
            "recipient": driver_name,
            "delay_min": delay_min,
            "time": _fmt_time(inbound_cab.start),
            "amount_inr": wait_fee,
            "ref": cab_ref,
        }
        polished_body, _ = llm.polish_courtesy(body_tmpl, facts, lang)
        drafts.append(
            CourtesyDraft(
                id="dr_2",
                trip_id=trip.id,
                recommendation_id=rec.id,
                recipient_kind="DRIVER",
                recipient_name=driver_name,
                channel="WHATSAPP",
                language=lang,  # type: ignore[arg-type]
                subject=None,
                body=polished_body,
                state="DRAFT",
                created_at=created,
            )
        )

    # 3. VENDOR draft (WHATSAPP) for changed/rebooked activities
    changed_acts = [
        it for it in active.items
        if it.id in rec.changed_booking_item_ids and it.type == "ACTIVITY"
    ]
    if not changed_acts:
        changed_acts = [it for it in active.items if it.type == "ACTIVITY" and it.rebook_fee_inr]

    for idx, old_act in enumerate(changed_acts, start=3):
        base = old_act.title.split("(")[0].strip().lower()
        new_act = next(
            (it for it in new_plan.items if it.type == "ACTIVITY" and it.title.split("(")[0].strip().lower() == base),
            None,
        )
        target_act = new_act or old_act
        v_ref = (
            old_act.booking.supplier_ref
            if old_act.booking and old_act.booking.supplier_ref
            else "SIM-E-9012"
        )
        fee = old_act.rebook_fee_inr if old_act.rebook_fee_inr is not None else 400
        vendor_name = f"{old_act.title.split()[0]} Ticketing"
        body_tmpl = i18n.render(
            "courtesy.vendor.body",
            lang,
            recipient=vendor_name,
            item=old_act.title,
            time=_fmt_time(target_act.start),
            date_str=_fmt_date(target_act.start),
            delay_min=delay_min,
            amount_inr=f"{fee:,}",
            ref=v_ref,
        )
        facts = {
            "recipient": vendor_name,
            "item": old_act.title,
            "time": _fmt_time(target_act.start),
            "delay_min": delay_min,
            "amount_inr": fee,
            "ref": v_ref,
        }
        polished_body, _ = llm.polish_courtesy(body_tmpl, facts, lang)
        drafts.append(
            CourtesyDraft(
                id=f"dr_{idx}",
                trip_id=trip.id,
                recommendation_id=rec.id,
                recipient_kind="VENDOR",
                recipient_name=vendor_name,
                channel="WHATSAPP",
                language=lang,  # type: ignore[arg-type]
                subject=None,
                body=polished_body,
                state="DRAFT",
                created_at=created,
            )
        )

    # 4. Optional COMPANION draft if group trip
    if trip.group_id is not None:
        comp_body = i18n.render(
            "courtesy.companion.body",
            lang,
            recipient="Group",
            item=changed_acts[0].title if changed_acts else "Day 1 schedule",
            time=_fmt_time(changed_acts[0].start) if changed_acts else "09:00",
            date_str=_fmt_date(changed_acts[0].start) if changed_acts else "06 Dec",
            amount_inr=f"{rec.delta_cost_inr:,}",
            delay_min=delay_min,
        )
        drafts.append(
            CourtesyDraft(
                id=f"dr_{len(drafts) + 1}",
                trip_id=trip.id,
                recommendation_id=rec.id,
                recipient_kind="COMPANION",
                recipient_name="Travel Group",
                channel="WHATSAPP",
                language=lang,  # type: ignore[arg-type]
                subject=None,
                body=comp_body,
                state="DRAFT",
                created_at=created,
            )
        )

    return drafts
