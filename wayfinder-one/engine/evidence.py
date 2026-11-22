"""Pure Evidence Pack assembler for airline/insurance/supplier claims (Owner: P3)."""
from __future__ import annotations

from datetime import datetime

from contracts.models import (
    Booking,
    ClaimSection,
    EvidenceEvent,
    EvidencePack,
    Signal,
    Trip,
)


def build_pack(
    trip: Trip,
    events: list[EvidenceEvent],
    bookings: list[Booking],
    signals: list[Signal],
    now: datetime,
) -> EvidencePack:
    """Assemble chronological evidence timeline, delay totals, and conservative claim sections."""
    sorted_events = sorted(events, key=lambda e: (e.ts, e.id))

    flight_delays = [
        int(s.payload.get("delay_min", 0))
        for s in signals
        if s.kind == "FLIGHT_STATUS"
    ]
    total_delay_min = max(flight_delays, default=0)

    extra_cost_inr = sum(
        int(e.ref.get("amount_inr", 0))
        for e in sorted_events
        if e.kind == "COST"
    )
    if extra_cost_inr == 0:
        extra_cost_inr = sum(b.penalty_inr or 0 for b in bookings)

    flight_sigs = [s for s in signals if s.kind == "FLIGHT_STATUS" and int(s.payload.get("delay_min", 0)) > 0]
    flight_bks = [b for b in bookings if b.supplier_ref and "F-" in b.supplier_ref]
    airline_attachments = [b.id for b in flight_bks] + [s.id for s in flight_sigs]

    claim_sections: list[ClaimSection] = []

    if flight_sigs or total_delay_min > 0:
        src = flight_sigs[0].provenance.source if flight_sigs else "Flight status feed"
        ts_str = flight_sigs[0].provenance.checked_at.isoformat() if flight_sigs else now.isoformat()
        claim_sections.append(
            ClaimSection(
                type="AIRLINE",
                summary=(
                    f"Recorded {total_delay_min} min flight delay via {src} at {ts_str}. "
                    "Whether compensation, meal vouchers, or fee waivers apply depends on the operating airline's policy and fare conditions."
                ),
                amount_inr=None,
                attachments=airline_attachments,
            )
        )
    else:
        claim_sections.append(
            ClaimSection(
                type="AIRLINE",
                summary="No flight delay recorded. Eligibility for any carrier adjustment depends on the airline's fare policy.",
                amount_inr=None,
                attachments=[b.id for b in flight_bks],
            )
        )

    if extra_cost_inr > 0:
        claim_sections.append(
            ClaimSection(
                type="INSURANCE",
                summary=(
                    f"Documented ₹{extra_cost_inr:,} in verified rebooking/disruption expenses "
                    f"with {total_delay_min} min upstream delay evidence attached."
                ),
                amount_inr=extra_cost_inr,
                attachments=[b.id for b in bookings] + [s.id for s in signals],
            )
        )

    supplier_attachments = [b.id for b in bookings]
    claim_sections.append(
        ClaimSection(
            type="SUPPLIER",
            summary=(
                f"Supplier ledger across {len(bookings)} booking(s): "
                f"total recorded rebook/cancellation fees ₹{extra_cost_inr:,}."
            ),
            amount_inr=extra_cost_inr,
            attachments=supplier_attachments,
        )
    )

    return EvidencePack(
        trip_id=trip.id,
        generated_at=now,
        events=sorted_events,
        total_delay_min=total_delay_min,
        extra_cost_inr=extra_cost_inr,
        claim_sections=claim_sections,
    )
