"""Golden & secondary scenario tests (Owner: P3). Run: make golden"""
from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from agent import graph
from contracts import models as m
from engine import (
    group,
    multicity,
    optionality,
    planner,
    responsible,
    slack,
    switch,
    validator,
)

FIXTURES = ROOT / "contracts" / "fixtures"
IST = timezone(timedelta(hours=5, minutes=30))


def _load_inv(name: str) -> m.Inventory:
    return m.Inventory.model_validate(json.loads((FIXTURES / name).read_text()))


def _golden_intent() -> m.TripIntent:
    return m.TripIntent(
        origin="Bengaluru",
        destination="Munnar",
        start_date=date(2026, 12, 5),
        nights=4,
        travellers=2,
        budget_inr=55000,
        interests=["tea estates", "waterfalls", "sunsets"],
        constraints=["no night ghat driving"],
        pace="BALANCED",
        must_dos=[],
        missing=[],
    )


def test_golden_scenario_munnar_end_to_end():
    inv = _load_inv("inventory_kerala.json")
    intent = _golden_intent()
    now_base = datetime(2026, 11, 22, 10, 0, tzinfo=IST)

    # 1. Baseline Plan A + Plan B
    pair = planner.build_plan_pair(intent, inv, now_base, "trip_golden")
    plan_a, plan_b = pair.plan_a, pair.plan_b

    assert plan_a.total_cost_inr == 46300
    assert plan_a.validation.budget_headroom_inr == 8700
    assert plan_a.validation.feasible is True
    assert plan_a.validation.feasibility >= 0.85

    a_ids = {i.id for i in plan_a.items}
    b_ids = {i.id for i in plan_b.items}
    assert len(a_ids ^ b_ids) >= 3
    assert {"it_a_f1", "it_a_f2", "it_a_h1"} <= b_ids

    s_base = slack.compute_slack(plan_a, [], now_base)
    assert s_base.health == "GREEN"
    assert s_base.score >= 75

    # No switch at baseline
    assert switch.evaluate(plan_a, plan_b, intent, [], now_base) is None

    # 2. FLIGHT_DELAY 55 at T-3H
    t_3h = datetime(2026, 12, 5, 4, 40, tzinfo=IST)
    sig_55 = m.Signal(
        id="sg_55",
        trip_id="trip_golden",
        kind="FLIGHT_STATUS",
        item_id="it_a_f1",
        severity=2,
        summary="Flight BLR→COK delayed by 55 min",
        payload={"delay_min": 55},
        provenance=m.Provenance(source="Flight status feed (sim)", checked_at=t_3h, is_simulated=True),
    )

    val_a_55 = validator.validate(plan_a, intent, [sig_55], t_3h)
    val_b_55 = validator.validate(plan_b, intent, [sig_55], t_3h)
    assert 0.45 <= val_a_55.feasibility <= 0.65
    assert val_b_55.feasibility >= 0.90

    s_55 = slack.compute_slack(plan_a, [sig_55], t_3h)
    assert s_55.health == "AMBER"
    assert 45 <= s_55.score <= 74

    rec = switch.evaluate(plan_a, plan_b, intent, [sig_55], t_3h)
    assert rec is not None
    assert rec.mode == "MIXED"
    assert 1200 <= rec.delta_cost_inr <= 2400
    assert rec.delta_cost_inr == 1800
    assert any("Mattupetty" in l.title for l in rec.lost_items)
    assert {"it_a_f1", "it_a_h1", "it_a_t2", "it_a_f2"} <= set(rec.kept_booking_item_ids)
    assert {"it_a_t1", "it_a_e1"} <= set(rec.changed_booking_item_ids)
    assert rec.resulting_plan.kind == "A"
    assert rec.resulting_plan.version == plan_a.version + 1

    # 3. FLIGHT_DELAY 120 -> RED
    sig_120 = m.Signal(
        id="sg_120",
        trip_id="trip_golden",
        kind="FLIGHT_STATUS",
        item_id="it_a_f1",
        severity=3,
        summary="Flight BLR→COK delayed by 120 min",
        payload={"delay_min": 120},
        provenance=m.Provenance(source="Flight status feed (sim)", checked_at=t_3h, is_simulated=True),
    )
    s_120 = slack.compute_slack(plan_a, [sig_120], t_3h)
    assert s_120.health == "RED"
    assert s_120.score < 45


def test_secondary_sg_group():
    inv = _load_inv("inventory_coorg.json")
    now = datetime(2026, 12, 12, 9, 0, tzinfo=IST)
    members = [
        m.GroupMember(user_id="usr_g1", name="Asha", role="OWNER", location_sharing=True, joined_at=now),
        m.GroupMember(user_id="usr_g2", name="Bikram", role="MEMBER", location_sharing=True, joined_at=now),
        m.GroupMember(user_id="usr_g3", name="Charu", role="MEMBER", location_sharing=True, joined_at=now),
        m.GroupMember(user_id="usr_g4", name="Dev", role="MEMBER", location_sharing=False, joined_at=now),
    ]
    prefs = [
        m.GroupPreference(user_id="usr_g1", budget_inr=16000, interests=["coffee", "waterfalls"], constraints=["no night ghat driving"], pace="BALANCED", must_dos=["Organic Coffee Estate & Vegetarian Sadhya"]),
        m.GroupPreference(user_id="usr_g2", budget_inr=20000, interests=["coffee", "sunsets"], constraints=["vegetarian"], pace="RELAXED"),
        m.GroupPreference(user_id="usr_g3", budget_inr=12000, interests=["adventure", "waterfalls"], constraints=[], pace="PACKED"),
        m.GroupPreference(user_id="usr_g4", budget_inr=18000, interests=["sunsets"], constraints=[], pace="BALANCED"),
    ]
    base = m.TripIntent(origin="Bengaluru", destination="Coorg", start_date=date(2026, 12, 12), nights=3)
    merged = group.merge_preferences(base, prefs, members)

    assert merged.merged_intent.budget_inr == 12000 * 4
    assert merged.merged_intent.pace == "RELAXED"
    assert "vegetarian" in merged.merged_intent.constraints
    assert {c.field for c in merged.conflicts} >= {"budget_inr", "constraints", "pace"}

    # Tiebreak by owner on 2 vs 2 vote
    votes = [
        m.VoteRequestRow(user_id="usr_g1", plan_id="trip_g1", vote="B"),
        m.VoteRequestRow(user_id="usr_g2", plan_id="trip_g1", vote="A"),
        m.VoteRequestRow(user_id="usr_g3", plan_id="trip_g1", vote="A"),
        m.VoteRequestRow(user_id="usr_g4", plan_id="trip_g1", vote="B"),
    ]
    tally = group.tally_votes(members, votes)
    assert tally.leader == "B"
    assert tally.decided is True

    # Plan & exact split
    pair = planner.build_plan_pair(merged.merged_intent, inv, now, "trip_g1")
    split_eq = group.split_cost(pair.plan_a, members, prefs, "EQUAL")
    split_bg = group.split_cost(pair.plan_a, members, prefs, "BY_BUDGET")
    assert sum(s.share_inr for s in split_eq.shares) == pair.plan_a.total_cost_inr
    assert sum(s.share_inr for s in split_bg.shares) == pair.plan_a.total_cost_inr

    # Regroup when usr_g3 is far away
    positions = {
        "usr_g1": m.Place(name="Near Madikeri", lat=12.4244, lng=75.7382),
        "usr_g2": m.Place(name="Near Madikeri", lat=12.4200, lng=75.7350),
        "usr_g3": m.Place(name="Delayed on highway", lat=12.7000, lng=75.9500),
    }
    reg = group.regroup(pair.plan_a, positions, now)
    assert reg is not None
    assert "usr_g3" in reg.affected_user_ids

    sig_user = m.Signal(
        id="sg_u3", trip_id="trip_g1", kind="TRAFFIC", severity=1,
        summary="Charu delayed", payload={"user_id": "usr_g3", "delay_min": 35},
        provenance=m.Provenance(source="sim", checked_at=now),
    )
    aud = group.affected_members(pair.plan_a, sig_user, members)
    assert aud == ["usr_g3"]


def test_secondary_sr_responsible():
    inv = _load_inv("inventory_kerala.json")
    now = datetime(2026, 11, 22, 10, 0, tzinfo=IST)
    intent = _golden_intent()
    plan_a = planner.build_plan_pair(intent, inv, now, "trip_golden").plan_a

    rep = responsible.report(plan_a, [], inv, travellers=2)
    assert rep.total_co2_kg > 0
    assert "FLIGHT" in rep.by_mode and "TRANSFER" in rep.by_mode
    kinds = {ins.kind for ins in rep.insights}
    assert {"CO2", "CROWD_RELIEF", "LOCAL_ECONOMY", "ECO_HERITAGE"} <= kinds

    eco_ins = next(ins for ins in rep.insights if ins.kind == "CO2" and ins.alternative_offer_id)
    alt_offer = next(o for o in inv.transfers if o.id == eco_ins.alternative_offer_id)
    swapped = planner.swap_item(plan_a, eco_ins.item_id, alt_offer, inv, intent, now)
    assert swapped.plan_preview.validation.feasible is True
    assert swapped.delta_co2_kg is not None and swapped.delta_co2_kg < 0
    assert swapped.delta_cost_inr < 0


def test_secondary_sm_multicity_and_all_destinations():
    now = datetime(2026, 11, 22, 10, 0, tzinfo=IST)

    # Multi-city Kerala circuit (Kochi -> Munnar -> Alleppey)
    inv_circuit = _load_inv("inventory_kerala_circuit.json")
    intent_mc = m.TripIntent(
        origin="Bengaluru",
        destination="Kochi → Munnar → Alleppey",
        start_date=date(2026, 12, 5),
        nights=6,
        travellers=2,
        budget_inr=70000,
    )
    pair_mc = multicity.build_multicity_plan_pair(intent_mc, inv_circuit, now, "trip_mc")
    assert pair_mc.plan_a.validation.feasible is True
    assert pair_mc.plan_b.validation.feasible is True
    assert {i.id for i in pair_mc.plan_a.items} != {i.id for i in pair_mc.plan_b.items}
    assert any("Kochi → Munnar" in i.title for i in pair_mc.plan_a.items)

    # All 5 destinations plan cleanly (AC-38)
    for fname, dest, dt_start, nights in [
        ("inventory_kerala.json", "Munnar", date(2026, 12, 5), 4),
        ("inventory_coorg.json", "Coorg", date(2026, 12, 12), 3),
        ("inventory_hampi.json", "Hampi", date(2026, 12, 12), 3),
        ("inventory_goa.json", "Goa", date(2026, 12, 12), 3),
    ]:
        inv_d = _load_inv(fname)
        intent_d = m.TripIntent(
            origin="Bengaluru", destination=dest, start_date=dt_start, nights=nights,
            travellers=2, budget_inr=55000, pace="BALANCED",
        )
        pair_d = planner.build_plan_pair(intent_d, inv_d, now, f"trip_{dest.lower()}")
        assert pair_d.plan_a.validation.feasible is True
        assert pair_d.plan_b.validation.feasible is True


def test_secondary_so2_optionality():
    inv = _load_inv("inventory_kerala.json")
    now = datetime(2026, 12, 5, 4, 40, tzinfo=IST)
    plan_a = planner.build_plan_pair(_golden_intent(), inv, now, "trip_golden").plan_a

    sig = m.Signal(
        id="sg_55", trip_id="trip_golden", kind="FLIGHT_STATUS", item_id="it_a_f1",
        severity=2, summary="Delayed 55 min", payload={"delay_min": 55},
        provenance=m.Provenance(source="sim", checked_at=now),
    )
    opt = optionality.report(plan_a, [sig], inv, now)
    by_id = {ln.item_id: ln for ln in opt.lines}
    assert by_id["it_a_t1"].recommended == "FLEX"
    assert by_id["it_a_e1"].recommended == "FLEX"
    assert opt.total_saver_with_risk_inr > opt.total_saver_inr
    assert opt.total_flex_inr < opt.total_saver_with_risk_inr


def test_secondary_sw_whatsapp_two_step_approval():
    inv = _load_inv("inventory_kerala.json")
    detail = m.TripDetail.model_validate(json.loads((FIXTURES / "golden_trip_detail.json").read_text()))

    st = m.AgentState(
        trip_id="trip_golden",
        intent=detail.trip.intent,
        trip_facts=detail,
        channel="WHATSAPP",
        pending_recommendation_id="sw_2",
    )

    t1 = graph.run_turn(st, "status", "en", lambda _: inv)
    assert "AMBER" in t1.response.assistant_message
    assert len(t1.response.assistant_message) <= 600
    assert t1.response.proposed_action is None

    t2 = graph.run_turn(st, "yes switch", "en", lambda _: inv)
    assert "YES SW2" in t2.response.assistant_message
    assert t2.response.proposed_action is not None
    assert t2.response.proposed_action.params.get("confirmed") is False

    t3 = graph.run_turn(st, "YES SW2", "en", lambda _: inv)
    assert t3.response.proposed_action is not None
    assert t3.response.proposed_action.params.get("confirmed") is True

    # Expired recommendation must never approve
    st_exp = st.model_copy(update={"history": [{"role": "system", "rec_expired": True}]})
    t4 = graph.run_turn(st_exp, "YES SW2", "en", lambda _: inv)
    assert t4.response.proposed_action is None
