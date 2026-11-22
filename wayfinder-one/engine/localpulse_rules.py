"""Pure rule-based Local Pulse event extraction (en, hi, ml transliterations) (Owner: P3)."""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Literal

from contracts.models import LocalEvent, NewsItem

EventKind = Literal[
    "BANDH", "STRIKE", "FESTIVAL", "LANDSLIDE",
    "ROAD_RESTRICTION", "VIP_MOVEMENT", "CROWD_PEAK", "NONE",
]

_DESTINATION_ALIASES: dict[str, list[str]] = {
    "Munnar": ["munnar", "idukki", "devikulam", "adimali", "eravikulam", "neriamangalam", "nh85", "nh-85", "gap road"],
    "Kochi": ["kochi", "cochin", "ernakulam", "fort kochi", "nedumbassery", "cok"],
    "Alleppey": ["alleppey", "alappuzha", "vembanad", "kuttanad"],
    "Coorg": ["coorg", "kodagu", "madikeri", "virajpet", "kushalnagar"],
    "Hampi": ["hampi", "hosapete", "hospet", "vijayanagara", "kamalapura"],
    "Goa": ["goa", "panjim", "panaji", "anjuna", "dudhsagar", "madgaon", "dabolim"],
}

_KEYWORD_RULES: list[tuple[EventKind, list[str]]] = [
    ("BANDH", ["bandh", "hartal", "harthal", "shutdown", "बंद", "हड़ताल"]),
    ("STRIKE", ["strike", "chakka jam", "protest blockade", "taxi union", "auto strike", "bus strike"]),
    ("LANDSLIDE", ["landslide", "mudslide", "landslip", "rockfall", "भूस्खलन", "urulpottal"]),
    ("ROAD_RESTRICTION", ["road closed", "traffic diverted", "diversion", "ghat closed", "bridge closed", "night traffic ban", "blockade"]),
    ("VIP_MOVEMENT", ["vip movement", "convoy", "prime minister visit", "cm visit", "governor visit", "security barricade"]),
    ("FESTIVAL", ["festival", "utsav", "pooram", "onam", "neelakurinji", "procession", "carnival", "temple fest"]),
    ("CROWD_PEAK", ["heavy crowd", "tourist rush", "overcrowded", "traffic jam", "gridlock", "long queue", "weekend rush"]),
]

_DATE_PATTERN = re.compile(
    r"\b(?:\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|"
    r"tomorrow|today|tonight|this weekend|friday|saturday|sunday|monday|tuesday|wednesday|thursday)\b",
    re.IGNORECASE,
)


def _match_destination(text: str, destinations: list[str]) -> tuple[str | None, str]:
    low = text.lower()
    for dest in destinations:
        aliases = _DESTINATION_ALIASES.get(dest, [dest.lower()])
        for alias in aliases:
            if alias in low:
                return dest, alias
    for dest, aliases in _DESTINATION_ALIASES.items():
        for alias in aliases:
            if alias in low:
                return dest, alias
    return None, ""


def extract_events(
    items: list[NewsItem],
    destinations: list[str],
    now: datetime,
) -> list[LocalEvent]:
    """Classify NewsItems via deterministic keyword and gazetteer rules."""
    events: list[LocalEvent] = []
    seen_urls: set[str] = set()

    for item in items:
        if item.url in seen_urls:
            continue
        seen_urls.add(item.url)

        combined = f"{item.title} {item.summary}"
        low = combined.lower()

        matched_kind: EventKind = "NONE"
        keyword_hits = 0
        for kind, kws in _KEYWORD_RULES:
            hits = sum(1 for kw in kws if kw in low)
            if hits > 0 and matched_kind == "NONE" or hits > keyword_hits:
                matched_kind = kind
                keyword_hits = hits

        dest, loc_alias = _match_destination(combined, destinations)
        has_date = bool(_DATE_PATTERN.search(combined))

        if matched_kind == "NONE":
            conf = 0.1
        elif dest and (has_date or keyword_hits >= 2):
            conf = 0.85
        elif dest or has_date:
            conf = 0.75
        else:
            conf = 0.6

        # Never fabricate dates: default to publish date ± 1 day when unstated
        pub = item.published_at
        start = pub
        end = pub + timedelta(days=1)

        events.append(
            LocalEvent(
                kind=matched_kind,
                location_text=loc_alias.title() if loc_alias else (dest or ""),
                destination=dest,
                start=start,
                end=end,
                confidence=conf,
                source_url=item.url,
            )
        )

    return events
