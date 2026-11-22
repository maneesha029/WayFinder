"""LangGraph conversational planner, post-booking Q&A, cancel gate, and WhatsApp router (Owner: P3)."""
from __future__ import annotations

import re
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import TypedDict

from langgraph.graph import END, StateGraph

from agent import i18n, llm, mock_llm
from contracts.models import (
    ActionRef,
    AgentState,
    AgentTurn,
    ChatResponse,
    DestinationOption,
    Inventory,
    Plan,
    TripIntent,
)
from engine import planner
from engine.errors import Infeasible

IST = timezone(timedelta(hours=5, minutes=30))
_WA_EXACT_RE = re.compile(r"^\s*yes\s+(sw[_-]?\d+)\s*$", re.IGNORECASE)


class _GraphState(TypedDict, total=False):
    agent_state: AgentState
    message: str
    locale: str
    inventory_provider: Callable[[TripIntent], Inventory]
    route: str
    extracted: TripIntent
    merged: TripIntent
    stage: str
    assistant_message: str
    quick_replies: list[str]
    destination_options: list[DestinationOption]
    plan_a: Plan | None
    plan_b: Plan | None
    proposed_action: ActionRef | None
    llm_fallback: bool


def _route_intent(g: _GraphState) -> _GraphState:
    msg = g["message"].strip().lower()
    st = g["agent_state"]

    # Explicit cancel trigger
    if any(w in msg for w in ("cancel", "refund booking", "रद्द")):
        return {"route": "CANCEL"}

    # Post-booking Q&A when trip is already planned/booked/active and user asks a question rather than starting a new plan
    is_new_plan = any(
        k in msg
        for k in ("plan a ", "plan trip", "plan ", "from ", "budget ", "day trip", "nights")
    ) and not any(q in msg for q in ("what", "when", "which", "status", "check-in", "voucher", "score", "health", "hotel", "flight"))
    if st.trip_facts is not None and st.trip_facts.trip.status in ("BOOKED", "ACTIVE", "PLANNED") and not is_new_plan:
        return {"route": "TRIP_QA"}

    return {"route": "PLAN"}


def _node_extract(g: _GraphState) -> _GraphState:
    st = g["agent_state"]
    extracted, fb = llm.extract_intent(g["message"], st.intent)
    return {"extracted": extracted, "llm_fallback": bool(g.get("llm_fallback", False) or fb)}


def _node_merge(g: _GraphState) -> _GraphState:
    st = g["agent_state"]
    base = st.intent
    ext = g["extracted"]
    merged = TripIntent(
        origin=ext.origin or base.origin,
        destination=ext.destination or base.destination,
        start_date=ext.start_date or base.start_date,
        nights=ext.nights if ext.nights is not None else base.nights,
        travellers=ext.travellers if ext.travellers is not None else base.travellers,
        budget_inr=ext.budget_inr if ext.budget_inr is not None else base.budget_inr,
        interests=list(dict.fromkeys(base.interests + ext.interests)),
        constraints=list(dict.fromkeys(base.constraints + ext.constraints)),
        pace=ext.pace or base.pace,
        must_dos=list(dict.fromkeys(base.must_dos + ext.must_dos)),
    )
    merged.missing = mock_llm.compute_missing(merged)
    return {"merged": merged}


def _route_after_merge(g: _GraphState) -> str:
    merged = g["merged"]
    if merged.missing:
        return "clarify"
    if not merged.destination:
        return "recommend"
    return "plan"


def _node_clarify(g: _GraphState) -> _GraphState:
    merged = g["merged"]
    locale = g["locale"]
    msg, quick = mock_llm.clarify_response(merged, locale)
    return {
        "stage": "CLARIFYING",
        "assistant_message": msg,
        "quick_replies": quick,
        "destination_options": [],
        "plan_a": None,
        "plan_b": None,
        "proposed_action": None,
    }


def _node_recommend(g: _GraphState) -> _GraphState:
    merged = g["merged"]
    locale = g["locale"]
    msg, opts = mock_llm.recommend_destinations(merged, locale)
    return {
        "stage": "RECOMMENDING",
        "assistant_message": msg,
        "quick_replies": [f"Plan {o.name}" for o in opts if o.available],
        "destination_options": opts,
        "plan_a": None,
        "plan_b": None,
        "proposed_action": None,
    }


def _node_plan(g: _GraphState) -> _GraphState:
    st = g["agent_state"]
    merged = g["merged"]
    locale = g["locale"]
    inv = g["inventory_provider"](merged)
    now = (
        st.trip_facts.trip.sim_now
        if st.trip_facts is not None and st.trip_facts.trip.sim_now is not None
        else datetime(2026, 11, 22, 10, 0, tzinfo=IST)
    )
    try:
        pair = planner.build_plan_pair(merged, inv, now, st.trip_id)
        return {
            "stage": "PLANNED",
            "plan_a": pair.plan_a,
            "plan_b": pair.plan_b,
            "quick_replies": ["Book Plan A", "Make it cheaper", "More relaxed"],
            "destination_options": [],
            "proposed_action": None,
        }
    except Infeasible as exc:
        msg = i18n.render("err.infeasible", locale, reason=exc.message, suggestion=exc.suggestion)
        return {
            "stage": "CLARIFYING",
            "assistant_message": msg,
            "quick_replies": ["Increase budget", "More relaxed pace"],
            "destination_options": [],
            "plan_a": None,
            "plan_b": None,
            "proposed_action": None,
        }


def _node_explain(g: _GraphState) -> _GraphState:
    if g.get("plan_a") is None or g.get("plan_b") is None:
        return {}
    msg, fb = llm.explain_plan(g["plan_a"], g["plan_b"], g["merged"], g["locale"])
    return {
        "assistant_message": msg,
        "llm_fallback": bool(g.get("llm_fallback", False) or fb),
    }


def _node_qa(g: _GraphState) -> _GraphState:
    st = g["agent_state"]
    msg, fb = llm.answer_qa(g["message"], st.trip_facts, g["locale"])
    return {
        "merged": st.intent,
        "stage": "ANSWER",
        "assistant_message": msg,
        "quick_replies": [],
        "destination_options": [],
        "plan_a": st.trip_facts.plan_a if st.trip_facts else None,
        "plan_b": st.trip_facts.plan_b if st.trip_facts else None,
        "proposed_action": None,
        "llm_fallback": bool(g.get("llm_fallback", False) or fb),
    }


def _node_cancel(g: _GraphState) -> _GraphState:
    st = g["agent_state"]
    msg = i18n.render("chat.cancel_proposed", g["locale"], trip_id=st.trip_id)
    return {
        "merged": st.intent,
        "stage": "ANSWER",
        "assistant_message": msg,
        "quick_replies": ["Review cancel quote"],
        "destination_options": [],
        "plan_a": st.trip_facts.plan_a if st.trip_facts else None,
        "plan_b": st.trip_facts.plan_b if st.trip_facts else None,
        "proposed_action": ActionRef(
            action="CANCEL_BOOKING",
            label="Review cancellation quote",
            params={"trip_id": st.trip_id},
        ),
    }


def _build_graph():
    builder = StateGraph(_GraphState)
    builder.add_node("router", _route_intent)
    builder.add_node("extract", _node_extract)
    builder.add_node("merge_intent", _node_merge)
    builder.add_node("clarify", _node_clarify)
    builder.add_node("recommend", _node_recommend)
    builder.add_node("plan", _node_plan)
    builder.add_node("explain", _node_explain)
    builder.add_node("qa", _node_qa)
    builder.add_node("propose_cancel", _node_cancel)

    builder.set_entry_point("router")
    builder.add_conditional_edges(
        "router",
        lambda s: s["route"],
        {"PLAN": "extract", "TRIP_QA": "qa", "CANCEL": "propose_cancel"},
    )
    builder.add_edge("extract", "merge_intent")
    builder.add_conditional_edges(
        "merge_intent",
        _route_after_merge,
        {"clarify": "clarify", "recommend": "recommend", "plan": "plan"},
    )
    builder.add_edge("clarify", END)
    builder.add_edge("recommend", END)
    builder.add_edge("plan", "explain")
    builder.add_edge("explain", END)
    builder.add_edge("qa", END)
    builder.add_edge("propose_cancel", END)
    return builder.compile()


_COMPILED_GRAPH = _build_graph()


def _normalize_sw_code(rec_id: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9]", "", rec_id).upper()
    return clean


def _handle_whatsapp(state: AgentState, message: str, locale: str) -> AgentTurn:
    text = message.strip()
    low = text.lower()
    lang = locale if locale in ("en", "hi", "hinglish") else "en"

    rec_id = state.pending_recommendation_id
    expected_code = _normalize_sw_code(rec_id) if rec_id else "SW0"

    # Check if caller marked recommendation expired in history metadata
    rec_expired = any(bool(h.get("rec_expired")) for h in state.history if isinstance(h, dict))

    slack = state.trip_facts.slack if state.trip_facts else None
    health = slack.health if slack else "GREEN"
    score = slack.score if slack else 94

    # 1. Explicit exact confirmation "YES SW<n>"
    m_exact = _WA_EXACT_RE.match(text)
    if m_exact:
        given_code = _normalize_sw_code(m_exact.group(1))
        if rec_expired or rec_id is None:
            reply = i18n.render("wa.switch_expired", lang, code=given_code)
            action = None
        elif given_code == expected_code:
            reply = i18n.render("wa.switch_confirmed", lang, code=expected_code, amount_inr="1,800")
            action = ActionRef(
                action="SWITCH_PLAN",
                label="Switch approved",
                params={"recommendation_id": rec_id, "confirmed": True},
            )
        else:
            reply = i18n.render("wa.switch_mismatch", lang, code=expected_code)
            action = None
        return AgentTurn(
            response=ChatResponse(
                trip_id=state.trip_id,
                stage="ANSWER",
                assistant_message=reply[:600],
                intent=state.intent,
                proposed_action=action,
            ),
            intent=state.intent,
            llm_fallback=False,
        )

    # 2. Ambiguous switch approval ("yes switch", "yes", "switch", "approve") -> two-step echo
    if any(w in low for w in ("yes switch", "switch", "approve", "confirm")) or low == "yes":
        if rec_expired or rec_id is None:
            reply = i18n.render("wa.switch_expired", lang, code=expected_code)
            action = None
        else:
            reply = i18n.render(
                "wa.switch_prompt",
                lang,
                mode="MIXED",
                amount_inr="1,800",
                lost_summary="Mattupetty Dam boating",
                code=expected_code,
            )
            action = ActionRef(
                action="SWITCH_PLAN",
                label=f"Confirm with YES {expected_code}",
                params={"recommendation_id": rec_id, "confirmed": False},
            )
        return AgentTurn(
            response=ChatResponse(
                trip_id=state.trip_id,
                stage="ANSWER",
                assistant_message=reply[:600],
                intent=state.intent,
                proposed_action=action,
            ),
            intent=state.intent,
            llm_fallback=False,
        )

    # 3. STATUS intent
    if any(w in low for w in ("status", "health", "update", "haal", "स्थिति")):
        next_item = "your itinerary"
        time_str = "scheduled time"
        slack_min = 65
        if state.trip_facts and state.trip_facts.plan_a and state.trip_facts.plan_a.items:
            first = state.trip_facts.plan_a.items[0]
            next_item = first.title
            time_str = (first.hard_deadline or first.start).strftime("%H:%M")
            slack_min = state.trip_facts.plan_a.validation.min_slack_min
        alert_note = (
            f"Pending switch {expected_code}."
            if rec_id and not rec_expired
            else (f"{state.trip_facts.unread_alerts} alert(s)." if state.trip_facts else "No open alerts.")
        )
        reply = i18n.render(
            "wa.status",
            lang,
            health=health,
            score=score,
            next_item=next_item,
            time=time_str,
            slack_min=slack_min,
            alert_note=alert_note,
        )
        return AgentTurn(
            response=ChatResponse(
                trip_id=state.trip_id,
                stage="ANSWER",
                assistant_message=reply[:600],
                intent=state.intent,
            ),
            intent=state.intent,
            llm_fallback=False,
        )

    # 4. PENDING intent
    if any(w in low for w in ("pending", "needs me", "action")):
        if rec_id and not rec_expired:
            reply = i18n.render(
                "wa.pending",
                lang,
                rec_id=rec_id,
                mode="MIXED",
                amount_inr="1,800",
                lost_summary="Mattupetty Dam boating",
                code=expected_code,
            )
            action = ActionRef(
                action="SWITCH_PLAN",
                label="Review switch",
                params={"recommendation_id": rec_id, "confirmed": False},
            )
        else:
            reply = i18n.render("wa.no_pending", lang, health=health, score=score)
            action = None
        return AgentTurn(
            response=ChatResponse(
                trip_id=state.trip_id,
                stage="ANSWER",
                assistant_message=reply[:600],
                intent=state.intent,
                proposed_action=action,
            ),
            intent=state.intent,
            llm_fallback=False,
        )

    # 5. HELP intent
    if "help" in low or "madad" in low:
        reply = i18n.render("wa.help", lang)
        return AgentTurn(
            response=ChatResponse(
                trip_id=state.trip_id,
                stage="ANSWER",
                assistant_message=reply[:600],
                intent=state.intent,
            ),
            intent=state.intent,
            llm_fallback=False,
        )

    # 6. Unknown -> single clarifying line
    reply = i18n.render("wa.unknown", lang, text=text[:40])
    return AgentTurn(
        response=ChatResponse(
            trip_id=state.trip_id,
            stage="ANSWER",
            assistant_message=reply[:600],
            intent=state.intent,
        ),
        intent=state.intent,
        llm_fallback=False,
    )


def run_turn(
    state: AgentState,
    message: str,
    locale: str,
    inventory_provider: Callable[[TripIntent], Inventory],
) -> AgentTurn:
    """Execute one stateless turn through the LangGraph agent (WEB or WHATSAPP)."""
    if state.channel == "WHATSAPP":
        return _handle_whatsapp(state, message, locale)

    out: _GraphState = _COMPILED_GRAPH.invoke(
        {
            "agent_state": state,
            "message": message,
            "locale": locale if locale in ("en", "hi", "hinglish") else "en",
            "inventory_provider": inventory_provider,
            "llm_fallback": False,
        }
    )
    merged_intent = out.get("merged", state.intent)
    resp = ChatResponse(
        trip_id=state.trip_id,
        stage=out.get("stage", "CLARIFYING"),
        assistant_message=out.get("assistant_message", ""),
        intent=merged_intent,
        quick_replies=out.get("quick_replies", []),
        destination_options=out.get("destination_options", []),
        plan_a=out.get("plan_a"),
        plan_b=out.get("plan_b"),
        proposed_action=out.get("proposed_action"),
    )
    return AgentTurn(
        response=resp,
        intent=merged_intent,
        llm_fallback=bool(out.get("llm_fallback", False)),
    )
