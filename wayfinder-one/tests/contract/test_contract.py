"""Contract tests (owner: P3). Run: pytest tests/contract -q"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from contracts import models as m
from engine import stubs

FIXTURES = ROOT / "contracts" / "fixtures"
IST = timezone(timedelta(hours=5, minutes=30))


def _load(name: str):
    return json.loads((FIXTURES / name).read_text())


def test_version_present():
    assert m.CONTRACT_VERSION == "1.0.0"


def test_golden_plan_a_valid_and_numbers_match_b5():
    plan = m.Plan.model_validate(_load("golden_plan_a.json"))
    assert plan.total_cost_inr == sum(i.price_inr for i in plan.items) == 46300
    assert plan.validation.budget_headroom_inr == 8700
    ids = {i.id for i in plan.items}
    for it in plan.items:
        assert set(it.depends_on) <= ids  # no dangling dependencies


def test_idempotency_key_rule():
    with pytest.raises(ValidationError):
        m.BookRequest(approve=True, idempotency_key="short")
    assert m.BookRequest(approve=True, idempotency_key="book-trip01-9f3a1c").plan == "A"


def test_every_fixture_file_parses_as_json():
    files = list(FIXTURES.glob("*.json"))
    assert len(files) >= 35
    for f in files:
        json.loads(f.read_text())


@pytest.mark.parametrize(
    "filename, model_cls, is_list",
    [
        ("inventory_kerala.json", m.Inventory, False),
        ("inventory_coorg.json", m.Inventory, False),
        ("inventory_hampi.json", m.Inventory, False),
        ("inventory_goa.json", m.Inventory, False),
        ("inventory_kerala_circuit.json", m.Inventory, False),
        ("golden_plan_a.json", m.Plan, False),
        ("golden_plan_b.json", m.Plan, False),
        ("golden_trip.json", m.Trip, False),
        ("golden_trip_detail.json", m.TripDetail, False),
        ("golden_trips_list.json", m.TripSummary, True),
        ("golden_bookings.json", m.Booking, True),
        ("golden_book_result.json", m.BookResult, False),
        ("golden_vouchers.json", m.Voucher, True),
        ("golden_slack_baseline.json", m.SlackScore, False),
        ("golden_slack_amber.json", m.SlackScore, False),
        ("golden_slack_red.json", m.SlackScore, False),
        ("golden_alerts.json", m.Alert, True),
        ("golden_signals.json", m.SignalView, True),
        ("golden_switch.json", m.SwitchRecommendation, False),
        ("golden_switch_result.json", m.SwitchResult, False),
        ("golden_drafts.json", m.CourtesyDraft, True),
        ("golden_live.json", m.LiveStatus, False),
        ("golden_evidence.json", m.EvidencePack, False),
        ("golden_optionality.json", m.OptionalityReport, False),
        ("golden_responsible.json", m.ResponsibleReport, False),
        ("golden_rebalance.json", m.RebalancePreview, False),
        ("golden_swap.json", m.SwapPreview, False),
        ("golden_chat_planned.json", m.ChatResponse, False),
        ("golden_chat_clarifying.json", m.ChatResponse, False),
        ("golden_chat_recommending.json", m.ChatResponse, False),
        ("group_detail.json", m.Group, False),
        ("group_merged_prefs.json", m.MergedPreferences, False),
        ("group_votes.json", m.VoteTally, False),
        ("group_split_equal.json", m.SplitReport, False),
        ("group_split_budget.json", m.SplitReport, False),
        ("group_regroup.json", m.RegroupSuggestion, False),
        ("advisor_trips.json", m.AdvisorTripRow, True),
        ("advisor_notes.json", m.AdvisorNote, True),
        ("auth_user.json", m.User, False),
        ("auth_token.json", m.TokenResponse, False),
        ("me_preferences.json", m.NotificationPrefs, False),
        ("safety_contacts.json", m.TrustedContact, True),
        ("safety_checkin.json", m.SafeCheckin, False),
        ("safety_share_link.json", m.ShareLink, False),
        ("safety_shared_view.json", m.SharedTripView, False),
        ("offline_manifest.json", m.OfflineManifest, False),
    ],
)
def test_fixture_validates_against_contract_model(filename: str, model_cls, is_list: bool):
    raw = _load(filename)
    if is_list:
        assert isinstance(raw, list)
        for item in raw:
            model_cls.model_validate(item)
    else:
        model_cls.model_validate(raw)


def test_gen_types_produces_zero_diff():
    before = (ROOT / "contracts" / "types.ts").read_text()
    res = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "gen_types.py")],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=True,
    )
    assert "contracts/types.ts" in res.stdout
    after = (ROOT / "contracts" / "types.ts").read_text()
    assert before == after


def test_engine_stubs_contract_outputs():
    now = datetime(2026, 12, 5, 4, 40, tzinfo=IST)
    trip = m.Trip.model_validate(_load("golden_trip.json"))
    inv = m.Inventory.model_validate(_load("inventory_kerala.json"))
    plan_a = m.Plan.model_validate(_load("golden_plan_a.json"))
    plan_b = m.Plan.model_validate(_load("golden_plan_b.json"))

    pair = stubs.build_plan_pair(trip.intent, inv, now, trip.id)
    assert isinstance(pair, m.PlanPair)
    assert isinstance(stubs.regenerate_plan_b(plan_a, trip.intent, inv, now), m.Plan)
    assert isinstance(stubs.validate(plan_a, trip.intent, [], now), m.Validation)
    assert stubs.compute_slack(plan_a, [], now).health == "GREEN"

    sig = m.Signal(
        id="sg_test", trip_id=trip.id, kind="FLIGHT_STATUS", item_id="it_a_f1",
        severity=2, summary="Delayed 55 min", payload={"delay_min": 55},
        provenance=m.Provenance(source="sim", checked_at=now),
    )
    assert stubs.compute_slack(plan_a, [sig], now).health == "AMBER"
    assert stubs.evaluate(plan_a, plan_b, trip.intent, [sig], now) is not None
    assert stubs.evaluate(plan_a, plan_b, trip.intent, [], now) is None

    ping = m.LocationPing(lat=10.0261, lng=76.917, ts=now)
    assert isinstance(stubs.reroute(plan_a, plan_b, ping, [sig], now), m.LiveStatus)
    assert isinstance(stubs.build_pack(trip, [], [], [sig], now), m.EvidencePack)
    assert isinstance(stubs.rebalance(plan_a, 75, "it_a_tm", now), m.RebalancePreview)
    assert isinstance(stubs.swap_item(plan_a, "it_a_t2", inv.transfers[-1], inv, trip.intent, now), m.SwapPreview)
    assert isinstance(stubs.optionality_report(plan_a, [sig], inv, now), m.OptionalityReport)
    assert isinstance(stubs.responsible_report(plan_a, [sig], inv), m.ResponsibleReport)
    assert isinstance(stubs.merge_preferences(trip.intent, [], []), m.MergedPreferences)
    assert isinstance(stubs.tally_votes([], []), m.VoteTally)
    assert isinstance(stubs.split_cost(plan_a, [], [], "EQUAL"), m.SplitReport)
    assert stubs.regroup(plan_a, {}, now) is not None
    turn = stubs.run_turn(m.AgentState(trip_id=trip.id, intent=trip.intent), "hi", "en", lambda _: inv)
    assert isinstance(turn, m.AgentTurn)
    rec = m.SwitchRecommendation.model_validate(_load("golden_switch.json"))
    assert len(stubs.draft_messages(rec, trip, plan_a, plan_b, "en")) >= 1
    assert len(stubs.classify([m.NewsItem(id="n1", title="Test", url="https://x.test/1", source="RSS", published_at=now)], ["Munnar"], now)) == 1
    assert "hello" in stubs.render("k", "en", msg="hello")
