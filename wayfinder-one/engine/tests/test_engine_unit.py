"""Unit, property, and AST purity tests for the pure engine modules (Owner: P3)."""
from __future__ import annotations

import ast
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from contracts import models as m
from engine import evidence, group, live, planner, timebank
from engine.errors import Infeasible

FIXTURES = ROOT / "contracts" / "fixtures"
IST = timezone(timedelta(hours=5, minutes=30))


def _load_inv() -> m.Inventory:
    return m.Inventory.model_validate(json.loads((FIXTURES / "inventory_kerala.json").read_text()))


@given(
    total=st.integers(min_value=1, max_value=1_000_000),
    n_members=st.integers(min_value=1, max_value=9),
    method=st.sampled_from(["EQUAL", "BY_BUDGET"]),
)
def test_split_sums_exactly(total: int, n_members: int, method: str):
    now = datetime(2026, 11, 22, 10, 0, tzinfo=IST)
    members = [
        m.GroupMember(
            user_id=f"usr_{i}",
            name=f"Member {i}",
            role="OWNER" if i == 0 else "MEMBER",
            joined_at=now,
        )
        for i in range(n_members)
    ]
    prefs = [
        m.GroupPreference(user_id=f"usr_{i}", budget_inr=10000 + i * 2500)
        for i in range(n_members)
    ]
    plan = m.Plan.model_validate(json.loads((FIXTURES / "golden_plan_a.json").read_text())).model_copy(
        update={"total_cost_inr": total}
    )
    report = group.split_cost(plan, members, prefs, method)
    assert len(report.shares) == n_members
    assert sum(s.share_inr for s in report.shares) == total
    assert all(s.share_inr >= 0 for s in report.shares)


def test_planner_determinism_and_infeasible():
    inv = _load_inv()
    now = datetime(2026, 11, 22, 10, 0, tzinfo=IST)
    intent = m.TripIntent(
        origin="Bengaluru",
        destination="Munnar",
        start_date=date(2026, 12, 5),
        nights=4,
        travellers=2,
        budget_inr=55000,
        interests=["tea estates", "waterfalls", "sunsets"],
        constraints=["no night ghat driving"],
        pace="BALANCED",
    )
    p1 = planner.build_plan_pair(intent, inv, now, "trip_det")
    p2 = planner.build_plan_pair(intent, inv, now, "trip_det")
    assert [i.id for i in p1.plan_a.items] == [i.id for i in p2.plan_a.items]
    assert [i.id for i in p1.plan_b.items] == [i.id for i in p2.plan_b.items]

    # Budget too low raises Infeasible with binding constraint & suggestion
    low_budget = intent.model_copy(update={"budget_inr": 10000})
    with pytest.raises(Infeasible) as exc_info:
        planner.build_plan_pair(low_budget, inv, now, "trip_infeasible")
    assert exc_info.value.binding_constraint == "budget"
    assert "budget" in exc_info.value.suggestion.lower()


def test_timebank_protects_must_and_drops_lowest_nice():
    now = datetime(2026, 12, 6, 9, 0, tzinfo=IST)
    prov = m.Provenance(source="sim", checked_at=now)
    items = [
        m.PlanItem(id="d2_1", type="ACTIVITY", title="Morning Walk", day=2, start=datetime(2026, 12, 6, 8, 30, tzinfo=IST), end=datetime(2026, 12, 6, 10, 0, tzinfo=IST), price_inr=300, price_provenance=prov, refundable=False, priority="MUST"),
        m.PlanItem(id="d2_2", type="ACTIVITY", title="Optional Souvenir Stop", day=2, start=datetime(2026, 12, 6, 10, 30, tzinfo=IST), end=datetime(2026, 12, 6, 12, 30, tzinfo=IST), price_inr=200, price_provenance=prov, refundable=False, priority="SKIP_IF_NEEDED"),
        m.PlanItem(id="d2_3", type="ACTIVITY", title="Museum Visit", day=2, start=datetime(2026, 12, 6, 13, 30, tzinfo=IST), end=datetime(2026, 12, 6, 16, 30, tzinfo=IST), price_inr=800, price_provenance=prov, refundable=False, priority="NICE"),
        m.PlanItem(id="d2_4", type="ACTIVITY", title="Protected Trek", day=2, start=datetime(2026, 12, 6, 17, 0, tzinfo=IST), end=datetime(2026, 12, 6, 19, 0, tzinfo=IST), price_inr=1500, price_provenance=prov, refundable=False, priority="MUST"),
    ]
    plan = m.Plan(
        id="p1", trip_id="t1", kind="A", version=1, items=items, total_cost_inr=2800,
        created_at=now,
        validation=m.Validation(feasible=True, checks=[], min_slack_min=60, budget_headroom_inr=5000, feasibility=0.95),
    )
    prev = timebank.rebalance(plan, lost_min=240, from_item_id="d2_1", now=now)
    kept_ids = {it.id for it in prev.plan_preview.items}
    assert "d2_1" in kept_ids
    assert "d2_4" in kept_ids  # MUST protected
    assert any(d.item_id == "d2_2" for d in prev.dropped)  # SKIP_IF_NEEDED dropped first


def test_live_reroute_and_geofences():
    plan_a = m.Plan.model_validate(json.loads((FIXTURES / "golden_plan_a.json").read_text()))
    plan_b = m.Plan.model_validate(json.loads((FIXTURES / "golden_plan_b.json").read_text()))
    now = datetime(2026, 12, 5, 13, 5, tzinfo=IST)

    # Traffic jam on corridor
    sig = m.Signal(
        id="sg_tr", trip_id="trip_golden", kind="TRAFFIC", item_id="it_a_t1",
        severity=2, summary="Traffic jam 25 min", payload={"delay_min": 25, "day": 1},
        provenance=m.Provenance(source="Traffic feed (sim)", checked_at=now),
    )
    ping = m.LocationPing(lat=10.0261, lng=76.9170, speed_kmh=28, ts=now)
    status = live.reroute(plan_a, plan_b, ping, [sig], now)
    assert status.tracking_on is True
    assert status.next_commitment is not None
    assert len(status.reroute_options) >= 2
    assert status.geofence_prompt is None

    # Arrived at hotel (within 300m of Tea Valley Resort 10.0870, 77.0620)
    ping_hotel = m.LocationPing(lat=10.0871, lng=77.0621, ts=now)
    st_hotel = live.reroute(plan_a, plan_b, ping_hotel, [], now)
    assert st_hotel.geofence_prompt is not None
    assert st_hotel.geofence_prompt.kind == "ARRIVED_HOTEL"

    # Far off-route (> 5 km from any corridor)
    ping_off = m.LocationPing(lat=11.5000, lng=78.5000, ts=now)
    st_off = live.reroute(plan_a, plan_b, ping_off, [], now)
    assert st_off.geofence_prompt is not None
    assert st_off.geofence_prompt.kind == "OFF_ROUTE"


def test_evidence_pack_never_asserts_airline_eligibility():
    now = datetime(2026, 12, 5, 5, 0, tzinfo=IST)
    trip = m.Trip.model_validate(json.loads((FIXTURES / "golden_trip.json").read_text()))
    bookings = [m.Booking.model_validate(b) for b in json.loads((FIXTURES / "golden_bookings.json").read_text())]
    sig = m.Signal(
        id="sg_12", trip_id=trip.id, kind="FLIGHT_STATUS", item_id="it_a_f1",
        severity=2, summary="Delayed 55 min", payload={"delay_min": 55},
        provenance=m.Provenance(source="Flight status feed (sim)", checked_at=now),
    )
    ev = m.EvidenceEvent(
        id="ev_cost", trip_id=trip.id, ts=now, kind="COST", source="TBO Sandbox (sim)",
        detail="Rebook fee ₹1,800", ref={"amount_inr": 1800},
    )
    pack = evidence.build_pack(trip, [ev], bookings, [sig], now)
    assert pack.total_delay_min == 55
    assert pack.extra_cost_inr == 1800
    airline = next(s for s in pack.claim_sections if s.type == "AIRLINE")
    assert "depends on" in airline.summary.lower()
    assert "guaranteed" not in airline.summary.lower()


def test_engine_purity_no_clock_db_or_network_imports():
    forbidden_modules = {"sqlalchemy", "psycopg", "sqlite3", "redis", "celery", "httpx", "requests", "urllib", "aiohttp", "fastapi"}
    engine_dir = ROOT / "engine"
    for py_file in engine_dir.glob("*.py"):
        if py_file.name == "stubs.py":
            continue
        tree = ast.parse(py_file.read_text(), filename=str(py_file))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    top = alias.name.split(".")[0]
                    assert top not in forbidden_modules, f"{py_file.name} imports forbidden {top}"
            elif isinstance(node, ast.ImportFrom) and node.module:
                top = node.module.split(".")[0]
                assert top not in forbidden_modules, f"{py_file.name} imports forbidden {top}"
            elif (
                isinstance(node, ast.Attribute)
                and node.attr in ("now", "utcnow", "today")
                and isinstance(node.value, ast.Name)
                and node.value.id == "datetime"
            ):
                raise AssertionError(f"{py_file.name} calls datetime.{node.attr}() directly")
