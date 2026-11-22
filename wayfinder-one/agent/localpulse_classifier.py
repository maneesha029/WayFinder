"""Local Pulse news classifier combining deterministic rules with optional Gemini refinement (Owner: P3)."""
from __future__ import annotations

from datetime import datetime

from agent import llm
from contracts.models import LocalEvent, NewsItem
from engine import localpulse_rules


def classify(
    items: list[NewsItem],
    destinations: list[str],
    now: datetime,
) -> list[LocalEvent]:
    """Classify NewsItems into LocalEvents, deduplicated by URL and preserving source_url."""
    rule_events = localpulse_rules.extract_events(items, destinations, now)
    item_by_url = {it.url: it for it in items}

    results: list[LocalEvent] = []
    for ev in rule_events:
        src_item = item_by_url.get(ev.source_url)
        if src_item is not None and ev.kind != "NONE":
            refined, _ = llm.classify_local_event(src_item, ev, destinations)
            results.append(refined)
        else:
            results.append(ev)
    return results
