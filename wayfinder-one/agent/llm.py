"""Gemini API wrapper with 8s timeout, JSON-schema support, and automatic mock fallback (Owner: P3)."""
from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from typing import Any

from agent import guards, mock_llm, prompts
from contracts.models import LocalEvent, NewsItem, Plan, TripDetail, TripIntent


def _llm_mode() -> str:
    return os.getenv("LLM_MODE", "mock").strip().lower()


def _call_gemini_text(system_prompt: str, user_prompt: str, timeout_sec: float = 8.0) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    model_name = os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip() or "gemini-flash-latest"

    from google import genai  # lazy import so mock mode needs no network client setup
    from google.genai import types

    client = genai.Client(api_key=api_key)

    def _invoke() -> str:
        resp = client.models.generate_content(
            model=model_name,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.0,
            ),
        )
        return resp.text or ""

    with ThreadPoolExecutor(max_workers=1) as pool:
        fut = pool.submit(_invoke)
        return fut.result(timeout=timeout_sec)


def _call_gemini_json(
    system_prompt: str,
    user_prompt: str,
    schema_cls: Any,
    timeout_sec: float = 8.0,
) -> Any:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    model_name = os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip() or "gemini-flash-latest"

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    def _invoke() -> Any:
        resp = client.models.generate_content(
            model=model_name,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.0,
                response_mime_type="application/json",
                response_schema=schema_cls,
            ),
        )
        return schema_cls.model_validate_json(resp.text)

    with ThreadPoolExecutor(max_workers=1) as pool:
        fut = pool.submit(_invoke)
        return fut.result(timeout=timeout_sec)


def extract_intent(
    message: str,
    current: TripIntent | None = None,
) -> tuple[TripIntent, bool]:
    """Extract TripIntent via Gemini when enabled, falling back cleanly to mock_llm."""
    if _llm_mode() == "gemini" and os.getenv("GEMINI_API_KEY", "").strip():
        try:
            prompt = (
                f"Current intent: {current.model_dump_json() if current else '{}'}\n"
                f"User message: {message}"
            )
            extracted = _call_gemini_json(
                prompts.EXTRACT_SYSTEM_PROMPT, prompt, TripIntent, timeout_sec=8.0
            )
            extracted.missing = mock_llm.compute_missing(extracted)
            return extracted, False
        except (FuturesTimeoutError, Exception):  # noqa: BLE001
            return mock_llm.extract_intent(message, current), True
    return mock_llm.extract_intent(message, current), False


def explain_plan(
    plan_a: Plan,
    plan_b: Plan,
    intent: TripIntent,
    locale: str = "en",
) -> tuple[str, bool]:
    """Explain Plan A/B guarded against ungrounded prices/times."""
    fallback = mock_llm.explain_plan(plan_a, plan_b, intent, locale)
    if _llm_mode() == "gemini" and os.getenv("GEMINI_API_KEY", "").strip():
        facts = {
            "total_cost_inr": plan_a.total_cost_inr,
            "headroom_inr": plan_a.validation.budget_headroom_inr,
            "min_slack_min": plan_a.validation.min_slack_min,
            "feasibility_pct": round(plan_a.validation.feasibility * 100),
            "plan_b_total_inr": plan_b.total_cost_inr,
            "destination": intent.destination,
            "travellers": intent.travellers,
        }
        try:
            cand = _call_gemini_text(
                prompts.EXPLAIN_SYSTEM_PROMPT,
                f"Locale: {locale}\nFacts JSON: {json.dumps(facts)}",
                timeout_sec=8.0,
            )
            guarded, tripped = guards.apply_guard(cand.strip(), facts, fallback)
            return guarded, tripped
        except Exception:  # noqa: BLE001
            return fallback, True
    return fallback, False


def answer_qa(
    question: str,
    trip_facts: TripDetail | None,
    locale: str = "en",
) -> tuple[str, bool]:
    """Answer post-booking Q&A strictly guarded against trip_facts."""
    fallback = mock_llm.answer_trip_qa(question, trip_facts, locale)
    if _llm_mode() == "gemini" and os.getenv("GEMINI_API_KEY", "").strip() and trip_facts is not None:
        facts_json = trip_facts.model_dump_json()
        try:
            cand = _call_gemini_text(
                prompts.QA_SYSTEM_PROMPT,
                f"Locale: {locale}\nTrip facts: {facts_json}\nQuestion: {question}",
                timeout_sec=8.0,
            )
            guarded, tripped = guards.apply_guard(cand.strip(), facts_json, fallback)
            return guarded, tripped
        except Exception:  # noqa: BLE001
            return fallback, True
    return fallback, False


def polish_courtesy(
    draft_body: str,
    facts: dict[str, Any],
    locale: str = "en",
) -> tuple[str, bool]:
    """Optionally polish courtesy text via Gemini; discard if guard detects any altered number/time."""
    if _llm_mode() == "gemini" and os.getenv("GEMINI_API_KEY", "").strip():
        try:
            cand = _call_gemini_text(
                prompts.COURTESY_SYSTEM_PROMPT,
                f"Locale: {locale}\nFacts: {json.dumps(facts, default=str)}\nDraft: {draft_body}",
                timeout_sec=8.0,
            )
            guarded, _ = guards.apply_guard(cand.strip(), facts, draft_body)
            return guarded, False
        except Exception:  # noqa: BLE001
            return draft_body, True
    return draft_body, False


def classify_local_event(
    item: NewsItem,
    rule_candidate: LocalEvent,
    destinations: list[str],
) -> tuple[LocalEvent, bool]:
    """Refine rule candidate using Gemini when enabled, enforcing date and confidence rules."""
    if _llm_mode() == "gemini" and os.getenv("GEMINI_API_KEY", "").strip():
        try:
            prompt = (
                f"Destinations: {destinations}\n"
                f"Headline: {item.title}\nSummary: {item.summary}\n"
                f"Published at: {item.published_at.isoformat()}\n"
                f"Source URL: {item.url}\n"
                f"Rule candidate: {rule_candidate.model_dump_json()}"
            )
            ev = _call_gemini_json(
                prompts.LOCAL_PULSE_SYSTEM_PROMPT, prompt, LocalEvent, timeout_sec=8.0
            )
            ev.source_url = item.url
            if ev.start is None or ev.end is None:
                ev.start = rule_candidate.start
                ev.end = rule_candidate.end
                ev.confidence = min(ev.confidence, 0.6)
            return ev, False
        except Exception:  # noqa: BLE001
            return rule_candidate, True
    return rule_candidate, False
