#!/usr/bin/env python3
"""Run agent intent-extraction accuracy evals and 200-generation guard compliance checks (Owner: P3).

Run: python -m agent.evals.run_evals
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from agent import courtesy, graph, guards, llm
from contracts import models as m

PROMPTS_FILE = Path(__file__).resolve().parent / "golden_prompts.jsonl"
FIXTURES = ROOT / "contracts" / "fixtures"


def _load_inv(intent: m.TripIntent) -> m.Inventory:
    dest = (intent.destination or "Munnar").lower()
    if "alleppey" in dest or "→" in dest:
        fname = "inventory_kerala_circuit.json"
    elif "coorg" in dest:
        fname = "inventory_coorg.json"
    elif "hampi" in dest:
        fname = "inventory_hampi.json"
    elif "goa" in dest:
        fname = "inventory_goa.json"
    else:
        fname = "inventory_kerala.json"
    return m.Inventory.model_validate(json.loads((FIXTURES / fname).read_text()))


def evaluate_prompts() -> dict[str, Any]:
    rows = [json.loads(line) for line in PROMPTS_FILE.read_text().splitlines() if line.strip()]
    detail = m.TripDetail.model_validate(json.loads((FIXTURES / "golden_trip_detail.json").read_text()))
    plan_a = detail.plan_a
    plan_b = detail.plan_b
    sw_rec = m.SwitchRecommendation.model_validate(json.loads((FIXTURES / "golden_switch.json").read_text()))

    total_fields = 0
    matched_fields = 0
    guard_checks = 0
    guard_violations = 0
    failures: list[str] = []

    for row in rows:
        pid = row["id"]
        msg = row["message"]
        locale = row.get("locale", "en")

        if "expected" in row:
            intent, _ = llm.extract_intent(msg)
            exp = row["expected"]
            for field, exp_val in exp.items():
                total_fields += 1
                actual = getattr(intent, field)
                if field == "start_date" and actual is not None:
                    actual = actual.isoformat()
                if actual == exp_val:
                    matched_fields += 1
                else:
                    failures.append(f"{pid}.{field}: expected={exp_val!r}, got={actual!r}")

            # Also execute graph turn and guard-verify generated assistant_message
            state = m.AgentState(trip_id="trip_eval", intent=m.TripIntent())
            turn = graph.run_turn(state, msg, locale, _load_inv)
            if turn.response.stage == "PLANNED" and turn.response.plan_a is not None:
                facts = {
                    "total_cost_inr": turn.response.plan_a.total_cost_inr,
                    "headroom_inr": turn.response.plan_a.validation.budget_headroom_inr,
                    "min_slack_min": turn.response.plan_a.validation.min_slack_min,
                    "budget_inr": turn.intent.budget_inr,
                    "travellers": turn.intent.travellers,
                }
                guard_checks += 1
                if not guards.verify_output(turn.response.assistant_message, facts):
                    guard_violations += 1

        elif "expected_stage" in row:
            total_fields += 1
            state = m.AgentState(trip_id="trip_golden", intent=detail.trip.intent, trip_facts=detail)
            turn = graph.run_turn(state, msg, locale, _load_inv)
            if turn.response.stage == row["expected_stage"]:
                matched_fields += 1
            else:
                failures.append(f"{pid}.stage: expected={row['expected_stage']}, got={turn.response.stage}")
            guard_checks += 1
            if not guards.verify_output(turn.response.assistant_message, detail.model_dump()):
                guard_violations += 1

        elif "expected_action" in row:
            total_fields += 1
            state = m.AgentState(trip_id="trip_golden", intent=detail.trip.intent, trip_facts=detail)
            turn = graph.run_turn(state, msg, locale, _load_inv)
            act = turn.response.proposed_action.action if turn.response.proposed_action else None
            if act == row["expected_action"]:
                matched_fields += 1
            else:
                failures.append(f"{pid}.action: expected={row['expected_action']}, got={act}")

    # Expand guard verification to >= 200 generations across locales, plans, Q&A, and courtesy drafts
    qa_questions = [
        "What is my hotel check-in cutoff?",
        "When is my flight departing?",
        "What is my current slack score?",
        "How much is the total trip cost?",
        "Show my booking statuses.",
    ]
    while guard_checks < 200:
        for lang in ("en", "hi", "hinglish"):
            # Plan explanation
            text_exp, _ = llm.explain_plan(plan_a, plan_b, detail.trip.intent, lang)
            facts_exp = {
                "total_cost_inr": plan_a.total_cost_inr,
                "headroom_inr": plan_a.validation.budget_headroom_inr,
                "min_slack_min": plan_a.validation.min_slack_min,
                "travellers": detail.trip.intent.travellers,
            }
            guard_checks += 1
            if not guards.verify_output(text_exp, facts_exp):
                guard_violations += 1

            # Courtesy drafts
            drafts = courtesy.draft_messages(sw_rec, detail.trip, plan_a, plan_b, lang)
            draft_facts = {
                "delay_min": 55,
                "eta": "16:00",
                "pickup": "11:30",
                "eravikulam": "09:00",
                "cutoff": "20:00",
                "wait_fee": 1400,
                "rebook_fee": 400,
            }
            for dr in drafts:
                guard_checks += 1
                if not guards.verify_output(dr.body, draft_facts):
                    guard_violations += 1

            # QA answers
            for q in qa_questions:
                ans, _ = llm.answer_qa(q, detail, lang)
                guard_checks += 1
                if not guards.verify_output(ans, detail.model_dump()):
                    guard_violations += 1
            if guard_checks >= 200:
                break

    accuracy = (matched_fields / total_fields) if total_fields else 0.0
    return {
        "prompt_count": len(rows),
        "total_fields": total_fields,
        "matched_fields": matched_fields,
        "intent_accuracy": round(accuracy, 4),
        "guard_checks": guard_checks,
        "guard_violations": guard_violations,
        "failures": failures,
    }


def main() -> int:
    res = evaluate_prompts()
    print(
        f"Evals: prompts={res['prompt_count']} | "
        f"intent_accuracy={res['intent_accuracy']*100:.1f}% ({res['matched_fields']}/{res['total_fields']}) | "
        f"guard_checks={res['guard_checks']} | guard_violations={res['guard_violations']}"
    )
    if res["failures"]:
        print("Sample mismatches:", res["failures"][:10])
    if res["intent_accuracy"] < 0.90 or res["guard_violations"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
