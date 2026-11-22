#!/usr/bin/env python3
"""Record deterministic golden demo state progression for backup video/offline recovery (Owner: P3).

Writes contracts/fixtures/demo_recorded_state.json.
"""
from __future__ import annotations

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


def main() -> None:
    inv = m.Inventory.model_validate(json.loads((FIXTURES / "inventory_kerala.json").read_text()))
    t_plan = datetime(2026, 11, 22, 10, 0, tzinfo=IST)
    t_72h = datetime(2026, 12, 2, 7, 40, tzinfo=IST)
    t_3h = datetime(2026, 12, 5, 4, 40, tzinfo=IST)
    t_live = datetime(2026, 12, 5, 13, 5, tzinfo=IST)

    # 1. Chat -> Plan
    turn = graph.run_turn(
        m.AgentState(trip_id="trip_golden", intent=m.TripIntent()),
        "Plan a 5-day budget trip from Bengaluru to Munnar for 2 people, early December, around ₹55,000. We like tea estates, waterfalls and sunsets. Avoid driving on ghat roads after dark.",
        "en",
        lambda _: inv,
    )
    assert turn.response.plan_a and turn.response.plan_b
    plan_a = turn.response.plan_a
    plan_b = turn.response.plan_b
    intent = turn.intent
    trip = m.Trip(
        id="trip_golden", title="Munnar Tea & Waterfalls (5 days)", status="BOOKED",
        intent=intent, plan_a_id=plan_a.id, plan_b_id=plan_b.id,
        sim_now=t_plan, sim_window="POST_BOOKING", owner_id="usr_demo", created_at=t_plan,
    )

    # 2. Baseline Slack
    slack_base = slack.compute_slack(plan_a, [], t_plan)

    # 3. T-72H Weather Signal
    sig_rain = m.Signal(
        id="sg_rain_d3", trip_id="trip_golden", kind="WEATHER", item_id="it_a_wf",
        severity=1, summary="Day 3 moderate rain outlook for Lakkam trek",
        payload={"day": 3, "rain": "MODERATE"},
        provenance=m.Provenance(source="Open-Meteo (sim)", checked_at=t_72h, is_simulated=True),
    )
    slack_72h = slack.compute_slack(plan_a, [sig_rain], t_72h)

    # 4. T-3H FLIGHT_DELAY 55 + Switch MIXED + Courtesy Drafts
    sig_delay = m.Signal(
        id="sg_delay_55", trip_id="trip_golden", kind="FLIGHT_STATUS", item_id="it_a_f1",
        severity=2, summary="Flight BLR→COK delayed by 55 min",
        payload={"delay_min": 55},
        provenance=m.Provenance(source="Flight status feed (sim)", checked_at=t_3h, is_simulated=True),
    )
    slack_3h = slack.compute_slack(plan_a, [sig_rain, sig_delay], t_3h)
    sw_rec = switch.evaluate(plan_a, plan_b, intent, [sig_rain, sig_delay], t_3h)
    assert sw_rec is not None
    drafts = courtesy.draft_messages(sw_rec, trip, plan_a, plan_b, "en")

    # Regenerate Plan B after accepting switch
    new_plan_a = sw_rec.resulting_plan
    new_plan_b = planner.regenerate_plan_b(new_plan_a, intent, inv, t_3h)

    # 5. LIVE + TRAFFIC_JAM 25
    sig_traffic = m.Signal(
        id="sg_traffic_25", trip_id="trip_golden", kind="TRAFFIC", item_id="it_a_t1",
        severity=2, summary="NH85 ghat traffic delay 25 min", payload={"delay_min": 25, "day": 1},
        provenance=m.Provenance(source="Traffic feed (sim)", checked_at=t_live, is_simulated=True),
    )
    live_status = live.reroute(
        plan_a, plan_b, m.LocationPing(lat=10.0261, lng=76.917, speed_kmh=28, ts=t_live),
        [sig_delay, sig_traffic], t_live,
    )

    # 6. Evidence, Optionality, Responsible
    ev_events = [
        m.EvidenceEvent(id="ev_1", trip_id="trip_golden", ts=t_3h, kind="SIGNAL", source="Flight status feed (sim)", detail="55 min flight delay", ref={"signal_id": sig_delay.id}),
        m.EvidenceEvent(id="ev_2", trip_id="trip_golden", ts=t_3h, kind="SWITCH", source="Wayfinder Switch Engine", detail="MIXED switch approved", ref={"recommendation_id": sw_rec.id}),
        m.EvidenceEvent(id="ev_3", trip_id="trip_golden", ts=t_3h, kind="COST", source="TBO Sandbox (sim)", detail="Cab wait ₹1,400 + Eravikulam rebook ₹400", ref={"amount_inr": sw_rec.delta_cost_inr}),
    ]
    bookings = [m.Booking.model_validate(b) for b in json.loads((FIXTURES / "golden_bookings.json").read_text())]
    ev_pack = evidence.build_pack(trip, ev_events, bookings, [sig_rain, sig_delay, sig_traffic], t_live)
    opt_rep = optionality.report(plan_a, [sig_delay], inv, t_3h)
    resp_rep = responsible.report(plan_a, [], inv, travellers=2)

    snapshot = {
        "recorded_at": t_live.isoformat(),
        "baseline": {
            "plan_a": json.loads(plan_a.model_dump_json()),
            "plan_b": json.loads(plan_b.model_dump_json()),
            "slack": json.loads(slack_base.model_dump_json()),
        },
        "t_72h": {"slack": json.loads(slack_72h.model_dump_json())},
        "t_3h": {
            "slack": json.loads(slack_3h.model_dump_json()),
            "switch": json.loads(sw_rec.model_dump_json()),
            "drafts": [json.loads(d.model_dump_json()) for d in drafts],
            "regenerated_plan_b": json.loads(new_plan_b.model_dump_json()),
        },
        "live": json.loads(live_status.model_dump_json()),
        "evidence": json.loads(ev_pack.model_dump_json()),
        "optionality": json.loads(opt_rep.model_dump_json()),
        "responsible": json.loads(resp_rep.model_dump_json()),
    }
    out = FIXTURES / "demo_recorded_state.json"
    out.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n")
    print(f"Recorded full demo state snapshot to {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
