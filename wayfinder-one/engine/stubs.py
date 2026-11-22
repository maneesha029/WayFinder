"""Phase 0 contract stubs returning validated fixture payloads (Owner: P3).

Allows P2 backend services to wire up and test every endpoint independently
with ENGINE_IMPL=stub until Phase 3 replacement is complete.
"""
from __future__ import annotations

import json
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

from contracts import models as m

_FIXTURES = Path(__file__).resolve().parent.parent / "contracts" / "fixtures"


def _load(name: str):
    return json.loads((_FIXTURES / name).read_text())


def build_plan_pair(
    intent: m.TripIntent,
    inventory: m.Inventory,
    now: datetime,
    trip_id: str,
) -> m.PlanPair:
    plan_a = m.Plan.model_validate(_load("golden_plan_a.json")).model_copy(
        update={"trip_id": trip_id, "created_at": now}
    )
    plan_b = m.Plan.model_validate(_load("golden_plan_b.json")).model_copy(
        update={"trip_id": trip_id, "created_at": now}
    )
    return m.PlanPair(plan_a=plan_a, plan_b=plan_b)


def regenerate_plan_b(
    plan_a: m.Plan,
    intent: m.TripIntent,
    inventory: m.Inventory,
    now: datetime,
) -> m.Plan:
    return m.Plan.model_validate(_load("golden_plan_b.json")).model_copy(
        update={"trip_id": plan_a.trip_id, "version": plan_a.version + 1, "created_at": now}
    )


def validate(
    plan: m.Plan,
    intent: m.TripIntent,
    signals: list[m.Signal],
    now: datetime,
) -> m.Validation:
    return plan.validation


def compute_slack(
    plan: m.Plan,
    signals: list[m.Signal],
    now: datetime,
) -> m.SlackScore:
    delay = max(
        (int(s.payload.get("delay_min", 0)) for s in signals if s.kind == "FLIGHT_STATUS"),
        default=0,
    )
    fname = "golden_slack_baseline.json"
    if delay >= 120:
        fname = "golden_slack_red.json"
    elif delay >= 45:
        fname = "golden_slack_amber.json"
    return m.SlackScore.model_validate(_load(fname)).model_copy(
        update={"trip_id": plan.trip_id, "computed_at": now}
    )


def evaluate(
    active: m.Plan,
    standby: m.Plan,
    intent: m.TripIntent,
    signals: list[m.Signal],
    now: datetime,
) -> m.SwitchRecommendation | None:
    delay = max(
        (int(s.payload.get("delay_min", 0)) for s in signals if s.kind == "FLIGHT_STATUS"),
        default=0,
    )
    if delay < 30:
        return None
    return m.SwitchRecommendation.model_validate(_load("golden_switch.json")).model_copy(
        update={"trip_id": active.trip_id, "created_at": now}
    )


def reroute(
    plan: m.Plan,
    standby: m.Plan,
    ping: m.LocationPing,
    signals: list[m.Signal],
    now: datetime,
    eta_fn=None,
) -> m.LiveStatus:
    return m.LiveStatus.model_validate(_load("golden_live.json")).model_copy(
        update={"trip_id": plan.trip_id, "as_of": now}
    )


def build_pack(
    trip: m.Trip,
    events: list[m.EvidenceEvent],
    bookings: list[m.Booking],
    signals: list[m.Signal],
    now: datetime,
) -> m.EvidencePack:
    return m.EvidencePack.model_validate(_load("golden_evidence.json")).model_copy(
        update={"trip_id": trip.id, "generated_at": now}
    )


def rebalance(
    plan: m.Plan,
    lost_min: int,
    from_item_id: str,
    now: datetime,
) -> m.RebalancePreview:
    return m.RebalancePreview.model_validate(_load("golden_rebalance.json"))


def swap_item(
    plan: m.Plan,
    item_id: str,
    offer: m.Offer,
    inventory: m.Inventory,
    intent: m.TripIntent,
    now: datetime,
) -> m.SwapPreview:
    return m.SwapPreview.model_validate(_load("golden_swap.json"))


def optionality_report(
    plan: m.Plan,
    signals: list[m.Signal],
    inventory: m.Inventory,
    now: datetime,
) -> m.OptionalityReport:
    return m.OptionalityReport.model_validate(_load("golden_optionality.json")).model_copy(
        update={"trip_id": plan.trip_id}
    )


def responsible_report(
    plan: m.Plan,
    signals: list[m.Signal],
    inventory: m.Inventory,
) -> m.ResponsibleReport:
    return m.ResponsibleReport.model_validate(_load("golden_responsible.json")).model_copy(
        update={"trip_id": plan.trip_id}
    )


def merge_preferences(
    base: m.TripIntent,
    prefs: list[m.GroupPreference],
    members: list[m.GroupMember],
) -> m.MergedPreferences:
    return m.MergedPreferences.model_validate(_load("group_merged_prefs.json"))


def tally_votes(
    members: list[m.GroupMember],
    votes: list[m.VoteRequestRow],
) -> m.VoteTally:
    return m.VoteTally.model_validate(_load("group_votes.json"))


def split_cost(
    plan: m.Plan,
    members: list[m.GroupMember],
    prefs: list[m.GroupPreference],
    method: str,
) -> m.SplitReport:
    fname = "group_split_budget.json" if method == "BY_BUDGET" else "group_split_equal.json"
    return m.SplitReport.model_validate(_load(fname)).model_copy(update={"trip_id": plan.trip_id})


def regroup(
    plan: m.Plan,
    positions: dict[str, m.Place],
    now: datetime,
    eta_fn=None,
) -> m.RegroupSuggestion | None:
    return m.RegroupSuggestion.model_validate(_load("group_regroup.json"))


def run_turn(
    state: m.AgentState,
    message: str,
    locale: str,
    inventory_provider: Callable[[m.TripIntent], m.Inventory],
) -> m.AgentTurn:
    resp = m.ChatResponse.model_validate(_load("golden_chat_planned.json")).model_copy(
        update={"trip_id": state.trip_id}
    )
    return m.AgentTurn(response=resp, intent=resp.intent, llm_fallback=False)


def draft_messages(
    rec: m.SwitchRecommendation,
    trip: m.Trip,
    active: m.Plan,
    standby: m.Plan,
    locale: str,
) -> list[m.CourtesyDraft]:
    return [m.CourtesyDraft.model_validate(d) for d in _load("golden_drafts.json")]


def classify(
    items: list[m.NewsItem],
    destinations: list[str],
    now: datetime,
) -> list[m.LocalEvent]:
    return [
        m.LocalEvent(
            kind="NONE",
            location_text="",
            destination=destinations[0] if destinations else None,
            start=now,
            end=now,
            confidence=0.1,
            source_url=it.url,
        )
        for it in items
    ]


def render(key: str, lang: str = "en", **vars) -> str:
    return f"[{lang}:{key}] " + ", ".join(f"{k}={v}" for k, v in vars.items())
