#!/usr/bin/env python3
"""Smoke test for contracts/engine/agent offline and optionally live API endpoints (Owner: P3).

Run offline: python scripts/smoke.py
Run live:    python scripts/smoke.py --live http://localhost:8000/api/v1
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from agent import courtesy, graph
from contracts import models as m
from engine import evidence, live, optionality, planner, responsible, slack, switch

FIXTURES = ROOT / "contracts" / "fixtures"
IST = timezone(timedelta(hours=5, minutes=30))


def run_offline_smoke() -> None:
    inv = m.Inventory.model_validate(json.loads((FIXTURES / "inventory_kerala.json").read_text()))
    now = datetime(2026, 12, 5, 4, 40, tzinfo=IST)
    st = m.AgentState(trip_id="trip_smoke", intent=m.TripIntent())
    turn = graph.run_turn(
        st,
        "Plan a 5-day budget trip from Bengaluru to Munnar for 2 people, early December, around ₹55,000.",
        "en",
        lambda _: inv,
    )
    assert turn.response.stage == "PLANNED"
    plan_a = turn.response.plan_a
    plan_b = turn.response.plan_b
    assert plan_a is not None and plan_b is not None

    s0 = slack.compute_slack(plan_a, [], now)
    assert s0.health == "GREEN"

    sig = m.Signal(
        id="sg_smoke", trip_id="trip_smoke", kind="FLIGHT_STATUS", item_id="it_a_f1",
        severity=2, summary="Flight BLR→COK delayed by 55 min", payload={"delay_min": 55},
        provenance=m.Provenance(source="Flight status feed (sim)", checked_at=now),
    )
    s1 = slack.compute_slack(plan_a, [sig], now)
    assert s1.health == "AMBER"

    rec = switch.evaluate(plan_a, plan_b, turn.intent, [sig], now)
    assert rec is not None and rec.mode == "MIXED"

    trip = m.Trip(
        id="trip_smoke", title="Munnar Smoke Trip", status="BOOKED",
        intent=turn.intent, owner_id="usr_demo", created_at=now,
    )
    drafts = courtesy.draft_messages(rec, trip, plan_a, plan_b, "en")
    assert len(drafts) == 3

    ls = live.reroute(plan_a, plan_b, m.LocationPing(lat=10.0261, lng=76.917, ts=now), [sig], now)
    assert ls.next_commitment is not None

    ev = m.EvidenceEvent(
        id="ev_smoke", trip_id="trip_smoke", ts=now, kind="COST", source="sim",
        detail="Rebook ₹1,800", ref={"amount_inr": 1800},
    )
    pack = evidence.build_pack(trip, [ev], [], [sig], now)
    assert pack.extra_cost_inr == 1800

    opt = optionality.report(plan_a, [sig], inv, now)
    resp = responsible.report(plan_a, [sig], inv, travellers=2)
    assert len(opt.lines) > 0 and resp.total_co2_kg > 0

    # Also test planner directly
    pair = planner.build_plan_pair(turn.intent, inv, now, "trip_smoke")
    assert pair.plan_a.total_cost_inr == 46300
    print("Offline smoke check PASSED (contracts + agent + all engine modules).")


def run_live_smoke(base_url: str) -> None:
    import httpx

    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        h = client.get("/health")
        h.raise_for_status()
        hdata = h.json()
        assert hdata.get("contract_version") == m.CONTRACT_VERSION

        # Demo seed + read checks when demo mode enabled
        seed = client.post("/demo/seed-trip")
        if seed.status_code == 200:
            detail = m.TripDetail.model_validate(seed.json())
            tid = detail.trip.id
            m.SlackScore.model_validate(client.get(f"/trips/{tid}/slack").json())
            m.OptionalityReport.model_validate(client.get(f"/trips/{tid}/optionality").json())
            m.ResponsibleReport.model_validate(client.get(f"/trips/{tid}/responsible").json())
            m.EvidencePack.model_validate(client.get(f"/trips/{tid}/evidence").json())
        print(f"Live smoke check PASSED against {base_url}.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", default=None, help="Base API URL (e.g. http://localhost:8000/api/v1)")
    args = parser.parse_args()
    run_offline_smoke()
    if args.live:
        run_live_smoke(args.live)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
