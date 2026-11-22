"""Fact-grounding guards verifying LLM outputs never invent prices, percentages, durations, or times (Owner: P3)."""
from __future__ import annotations

import json
import re
from typing import Any

_RUPEE_RE = re.compile(r"₹\s*([\d,]+)")
_PCT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%")
_MIN_RE = re.compile(r"(\d+)\s*min\b", re.IGNORECASE)
_TIME_RE = re.compile(r"\b(\d{1,2}:\d{2})\b")


def _extract_tokens(text: str) -> dict[str, set[str]]:
    rupees = {m.replace(",", "") for m in _RUPEE_RE.findall(text)}
    pcts = {m for m in _PCT_RE.findall(text)}
    mins = {m for m in _MIN_RE.findall(text)}
    times = {
        f"{int(h):02d}:{m}"
        for t in _TIME_RE.findall(text)
        for h, m in [t.split(":")]
    }
    return {"rupees": rupees, "pcts": pcts, "mins": mins, "times": times}


def _collect_allowed_numbers_and_times(facts: Any) -> tuple[set[str], set[str]]:
    """Collect all numeric scalars and HH:MM strings present anywhere in structured facts."""
    if isinstance(facts, str):
        blob = facts
    else:
        blob = json.dumps(facts, default=str, ensure_ascii=False)

    nums: set[str] = set()
    for raw in re.findall(r"\b\d[\d,]*(?:\.\d+)?\b", blob):
        clean = raw.replace(",", "")
        nums.add(clean)
        # Also allow rounded integer/percentage forms derived from floats (e.g. 0.92 -> 92, 0.58 -> 58)
        try:
            fval = float(clean)
            nums.add(str(round(fval)))
            if 0.0 <= fval <= 1.0:
                nums.add(str(round(fval * 100)))
        except ValueError:
            pass

    times: set[str] = set()
    for t in _TIME_RE.findall(blob):
        h, m = t.split(":")
        times.add(f"{int(h):02d}:{m}")
        times.add(f"{int(h)}:{m}")

    return nums, times


def find_violations(text: str, allowed_facts: Any) -> list[str]:
    """Return a list of ungrounded ₹, %, min, or HH:MM tokens in text."""
    tokens = _extract_tokens(text)
    allowed_nums, allowed_times = _collect_allowed_numbers_and_times(allowed_facts)

    violations: list[str] = []
    for r in sorted(tokens["rupees"]):
        if r not in allowed_nums:
            violations.append(f"ungrounded_rupee:₹{r}")
    for p in sorted(tokens["pcts"]):
        if p not in allowed_nums:
            violations.append(f"ungrounded_pct:{p}%")
    for m_val in sorted(tokens["mins"]):
        if m_val not in allowed_nums:
            violations.append(f"ungrounded_min:{m_val}min")
    for t_val in sorted(tokens["times"]):
        if t_val not in allowed_times:
            violations.append(f"ungrounded_time:{t_val}")

    return violations


def verify_output(text: str, allowed_facts: Any) -> bool:
    """True iff every ₹, %, min, and HH:MM token in text exists in allowed_facts."""
    return len(find_violations(text, allowed_facts)) == 0


def apply_guard(
    candidate: str,
    allowed_facts: Any,
    fallback: str,
) -> tuple[str, bool]:
    """Return (candidate, False) if grounded, else (fallback, True)."""
    if verify_output(candidate, allowed_facts):
        return candidate, False
    return fallback, True
