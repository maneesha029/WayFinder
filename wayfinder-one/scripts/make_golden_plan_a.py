#!/usr/bin/env python3
"""Builds contracts/fixtures/golden_plan_a.json from the B5 table and validates it against contracts/models.py.
Starting point for P3 (replace validation numbers with real engine output in Phase 1). Coordinates are approximate."""
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from contracts.models import Place, Plan, PlanItem, ProofCheck, Provenance, Validation

IST = "+05:30"
PROV = Provenance(source="TBO Sandbox (sim)", checked_at=datetime.fromisoformat("2026-11-22T10:00:00" + IST), is_simulated=True)
P = {
    "BLR": Place(name="Bengaluru Airport (BLR)", lat=13.1986, lng=77.7066),
    "COK": Place(name="Kochi Airport (COK)", lat=10.1520, lng=76.4019),
    "MUN": Place(name="Munnar", lat=10.0889, lng=77.0595),
    "ERA": Place(name="Eravikulam National Park", lat=10.1667, lng=77.0500),
    "HOT": Place(name="Tea Valley Resort, Munnar", lat=10.0870, lng=77.0620),
    "TEA": Place(name="Tea Museum, Munnar", lat=10.0866, lng=77.0586),
    "MAT": Place(name="Mattupetty Dam", lat=10.1065, lng=77.1241),
    "LAK": Place(name="Lakkam Waterfalls", lat=10.0970, lng=77.1480),
    "TOP": Place(name="Top Station", lat=10.1209, lng=77.2339),
}


def dt(day: str, hm: str) -> datetime:
    return datetime.fromisoformat(f"2026-12-{day}T{hm}:00{IST}")


def item(id, type, title, day, d, s, e, price, refundable, **kw):
    return PlanItem(id=id, type=type, title=title, day=day, start=dt(d, s), end=dt(d, e), price_inr=price,
                    price_provenance=PROV, refundable=refundable, **kw)


items = [
    item("it_a_f1", "FLIGHT", "Flight BLR→COK (sim)", 1, "05", "07:40", "09:05", 8600, False, fixed=True, priority="MUST",
         origin=P["BLR"], place=P["COK"], co2_kg=None),
    item("it_a_t1", "TRANSFER", "Cab Kochi Airport → Munnar", 1, "05", "09:50", "14:20", 4300, True, origin=P["COK"], place=P["MUN"],
         risk_tags=["GHAT_ROAD"], depends_on=["it_a_f1"], cancel_by=dt("04", "09:50"), rebook_fee_inr=1400, priority="MUST"),
    item("it_a_e1", "ACTIVITY", "Eravikulam NP timed entry", 1, "05", "15:00", "17:00", 1000, False, fixed=True, priority="MUST",
         place=P["ERA"], risk_tags=["RAIN"], hard_deadline=dt("05", "15:45"), rebook_fee_inr=400, depends_on=["it_a_t1"]),
    item("it_a_h1", "HOTEL", "Tea Valley Resort, 4 nights", 1, "05", "14:30", "20:00", 16000, True, place=P["HOT"],
         hard_deadline=dt("05", "20:00"), cancel_by=dt("03", "18:00"), priority="MUST", depends_on=["it_a_t1"]),
    item("it_a_tm", "ACTIVITY", "Tea Museum", 2, "06", "10:00", "11:30", 400, False, place=P["TEA"], indoor=True, priority="NICE"),
    item("it_a_mb", "ACTIVITY", "Mattupetty Dam boating", 2, "06", "13:30", "15:00", 900, False, place=P["MAT"], priority="NICE"),
    item("it_a_wf", "ACTIVITY", "Lakkam waterfall guided trek", 3, "07", "08:30", "13:00", 1600, False, place=P["LAK"],
         risk_tags=["RAIN"], priority="MUST"),
    item("it_a_ts", "ACTIVITY", "Top Station sunset point (jeep)", 4, "08", "16:00", "19:00", 1400, False, place=P["TOP"],
         risk_tags=["RAIN", "CROWD"], priority="NICE"),
    item("it_a_t2", "TRANSFER", "Cab Munnar → Kochi Airport", 5, "09", "10:00", "14:30", 4300, True, origin=P["MUN"], place=P["COK"],
         risk_tags=["GHAT_ROAD"], cancel_by=dt("08", "10:00"), priority="MUST"),
    item("it_a_f2", "FLIGHT", "Flight COK→BLR (sim)", 5, "09", "17:35", "19:00", 7800, False, fixed=True, priority="MUST",
         origin=P["COK"], place=P["BLR"], depends_on=["it_a_t2"]),
]
total = sum(i.price_inr for i in items)
assert total == 46300, total
plan = Plan(
    id="plan_a1", trip_id="trip_golden", kind="A", version=1, items=items, total_cost_inr=total,
    summary="Munnar for 2: tea estates, waterfalls and sunsets, within budget.",
    created_at=datetime.fromisoformat("2026-11-22T10:00:05" + IST),
    validation=Validation(feasible=True, feasibility=0.92, min_slack_min=65, budget_headroom_inr=55000 - total, solver="fixture",
        checks=[ProofCheck(name="budget", passed=True, detail=f"₹{total:,} of ₹55,000"),
                ProofCheck(name="hard_connection:it_a_t1->it_a_e1", passed=True, detail="Cab ends 14:20, +20 min to gate, last entry 15:45: 65 min slack"),
                ProofCheck(name="no_night_ghat", passed=True, detail="Both ghat transfers end before 18:00")]),
)
out = ROOT / "contracts" / "fixtures" / "golden_plan_a.json"
out.write_text(json.dumps(json.loads(plan.model_dump_json()), indent=2, ensure_ascii=False))
print("wrote", out.relative_to(ROOT), "| total", total, "| headroom", plan.validation.budget_headroom_inr, "| items", len(items))
