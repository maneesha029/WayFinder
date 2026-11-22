"""Deterministic regex/keyword extractor, clarifier, recommender, explainer, and Q&A engine (Owner: P3)."""
from __future__ import annotations

import re
from datetime import date

from agent import i18n
from contracts.models import (
    DestinationOption,
    Plan,
    TripDetail,
    TripIntent,
)

_ORIGINS: dict[str, str] = {
    "bengaluru": "Bengaluru",
    "bangalore": "Bengaluru",
    "blr": "Bengaluru",
    "बेंगलुरु": "Bengaluru",
    "mumbai": "Mumbai",
    "bombay": "Mumbai",
    "मुंबई": "Mumbai",
    "delhi": "Delhi",
    "new delhi": "Delhi",
    "दिल्ली": "Delhi",
    "chennai": "Chennai",
    "madras": "Chennai",
    "चेन्नई": "Chennai",
    "hyderabad": "Hyderabad",
    "हैदराबाद": "Hyderabad",
    "kochi": "Kochi",
    "cochin": "Kochi",
    "कोच्चि": "Kochi",
    "pune": "Pune",
    "kolkata": "Kolkata",
}

_DESTINATIONS: dict[str, str] = {
    "munnar": "Munnar",
    "मुन्नार": "Munnar",
    "coorg": "Coorg",
    "kodagu": "Coorg",
    "कूर्ग": "Coorg",
    "hampi": "Hampi",
    "हम्पी": "Hampi",
    "goa": "Goa",
    "गोवा": "Goa",
    "kochi": "Kochi",
    "cochin": "Kochi",
    "alleppey": "Alleppey",
    "alappuzha": "Alleppey",
    "wayanad": "Wayanad",
    "ooty": "Ooty",
}

_MONTH_FIRST_SAT: dict[str, date] = {
    "december": date(2026, 12, 5),
    "dec": date(2026, 12, 5),
    "दिसंबर": date(2026, 12, 5),
    "january": date(2027, 1, 2),
    "jan": date(2027, 1, 2),
    "जनवरी": date(2027, 1, 2),
    "february": date(2027, 2, 6),
    "feb": date(2027, 2, 6),
    "november": date(2026, 11, 28),
    "nov": date(2026, 11, 28),
    "नवंबर": date(2026, 11, 28),
}

_MONTH_NUM: dict[str, int] = {
    "jan": 1, "january": 1, "जनवरी": 1,
    "feb": 2, "february": 2, "फरवरी": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11, "नवंबर": 11,
    "dec": 12, "december": 12, "दिसंबर": 12,
}


def compute_missing(intent: TripIntent) -> list[str]:
    required = ["origin", "budget_inr", "nights", "start_date", "travellers"]
    missing: list[str] = []
    for field in required:
        if getattr(intent, field) is None:
            missing.append(field)
    return missing


def extract_intent(message: str, current: TripIntent | None = None) -> TripIntent:
    """Extract TripIntent fields deterministically from English, Hindi, or Hinglish text."""
    base = current.model_copy(deep=True) if current is not None else TripIntent()
    text = message.strip()
    low = text.lower()

    # 1. Origin: "from <city>" or "<city> se" / "<city> से"
    origin: str | None = base.origin
    m_from = re.search(r"\bfrom\s+([a-z\u0900-\u097f]+(?:\s+[a-z\u0900-\u097f]+)?)", low)
    if m_from:
        cand = m_from.group(1).strip()
        for k, canonical in _ORIGINS.items():
            if cand.startswith(k):
                origin = canonical
                break
        if origin is None:
            first_tok = cand.split()[0]
            if first_tok not in ("a", "the", "my"):
                origin = first_tok.title()

    if origin is None:
        m_se = re.search(r"([^\s.,!?]+)\s+(?:se|से)(?=\s|$|[.,!?।])", low)
        if m_se:
            cand = m_se.group(1).strip()
            origin = _ORIGINS.get(cand, cand.title() if cand not in _DESTINATIONS else None)

    if origin is None:
        for k, canonical in _ORIGINS.items():
            has_hi = any("\u0900" <= ch <= "\u097f" for ch in k)
            if has_hi and k in low and k not in _DESTINATIONS:
                origin = canonical
                break
            if not has_hi and re.search(rf"\b{re.escape(k)}\b", low) and k not in _DESTINATIONS:
                if k == "kochi" and "alleppey" in low:
                    continue
                origin = canonical
                break

    # 2. Destination (supports multi-city circuits like Kochi -> Munnar -> Alleppey)
    destination: str | None = base.destination
    found_dests: list[tuple[int, str]] = []
    for k, canonical in _DESTINATIONS.items():
        idx = low.find(k)
        if idx != -1:
            # Skip origin if it matched e.g. Kochi in "from Kochi"
            if origin and canonical == origin and (f"from {k}" in low or f"{k} se" in low or f"{k} से" in low):
                continue
            found_dests.append((idx, canonical))
    if found_dests:
        found_dests.sort(key=lambda x: x[0])
        ordered_dests = list(dict.fromkeys(d for _, d in found_dests))
        if len(ordered_dests) >= 2 and ("circuit" in low or "->" in low or "→" in low or "alleppey" in low):
            destination = " → ".join(ordered_dests)
        else:
            # Prefer non-origin destination
            non_orig = [d for d in ordered_dests if d != origin]
            destination = non_orig[0] if non_orig else ordered_dests[0]

    # 3. Nights / Days
    nights: int | None = base.nights
    m_nights = re.search(r"(\d+)\s*[-\s]*(?:night|nights|raat|raatein|रात|रातों|रातें)(?=\s|$|[.,!?।])", low)
    if m_nights:
        nights = max(1, min(14, int(m_nights.group(1))))
    else:
        m_days = re.search(r"(\d+)\s*[-\s]*(?:day|days|din|दिन)(?=\s|$|[.,!?।])", low)
        if m_days:
            days = int(m_days.group(1))
            nights = max(1, min(14, days - 1 if days > 1 else 1))
        elif "weekend" in low:
            nights = 2

    # 4. Travellers
    travellers: int | None = base.travellers
    m_trav = re.search(
        r"(?:for\s+|family\s+of\s+)?(\d+)\s*(?:people|persons|pax|travellers|travelers|adults|friends|log|logon|dost|लोग|लोगों|यात्रियों)(?=\s|$|[.,!?।])",
        low,
    )
    m_fam = re.search(r"\bfamily\s+of\s+(\d+)\b", low)
    if m_fam:
        travellers = max(1, min(9, int(m_fam.group(1))))
    elif m_trav:
        travellers = max(1, min(9, int(m_trav.group(1))))
    elif re.search(r"(?:^|\s)(?:solo|alone|just me|akele|अकेले)(?=\s|$|[.,!?।])", low):
        travellers = 1
    elif re.search(r"\b(?:couple|2 of us|two of us|hum do|हम दो)\b", low):
        travellers = 2

    # 5. Budget
    budget_inr: int | None = base.budget_inr
    m_k = re.search(r"(?:₹|rs\.?|inr|budget|around|approx|लगभग)?\s*(\d+(?:\.\d+)?)\s*(?:k|hazar|hazaar|हज़ार)(?=\s|$|[.,!?।])", low)
    m_num = re.search(r"(?:₹|rs\.?|inr)\s*([\d,]{4,7})", low)
    m_plain = re.search(r"\b(\d{4,6})\s*(?:rupees|rs|inr|budget|रुपये|में|mein)(?=\s|$|[.,!?।])", low)
    per_person = bool(re.search(r"\b(?:each|per person|pp|per head)\b", low))

    raw_budget: int | None = None
    if m_num:
        raw_budget = int(m_num.group(1).replace(",", ""))
    elif m_k:
        raw_budget = round(float(m_k.group(1)) * 1000)
    elif m_plain:
        raw_budget = int(m_plain.group(1))
    else:
        # Check "around 55,000" or bare 5-digit budget like "55000"
        m_bare = re.search(r"(?:around|budget|under|max|करीब)\s*([\d,]{4,7})", low)
        if m_bare:
            raw_budget = int(m_bare.group(1).replace(",", ""))

    if raw_budget is not None and raw_budget >= 1000:
        if per_person and travellers:
            budget_inr = raw_budget * travellers
        else:
            budget_inr = raw_budget

    # 6. Start Date
    start_date: date | None = base.start_date
    m_iso = re.search(r"\b(202\d-\d{2}-\d{2})\b", low)
    if m_iso:
        start_date = date.fromisoformat(m_iso.group(1))
    else:
        m_dm = re.search(
            r"\b(\d{1,2})\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december|दिसंबर|जनवरी|नवंबर)(?=\s|$|[.,!?।])",
            low,
        )
        m_md = re.search(
            r"\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)\s+(\d{1,2})\b",
            low,
        )
        if m_dm:
            d_num = int(m_dm.group(1))
            m_num_val = _MONTH_NUM[m_dm.group(2)]
            yr = 2027 if m_num_val < 3 else 2026
            start_date = date(yr, m_num_val, min(28, d_num))
        elif m_md:
            m_num_val = _MONTH_NUM[m_md.group(1)]
            d_num = int(m_md.group(2))
            yr = 2027 if m_num_val < 3 else 2026
            start_date = date(yr, m_num_val, min(28, d_num))
        else:
            for m_key, first_sat in _MONTH_FIRST_SAT.items():
                if m_key in low:
                    start_date = first_sat
                    break
            if start_date is None and ("next weekend" in low or "this weekend" in low or "early next month" in low):
                start_date = date(2026, 12, 5)

    # 7. Interests
    interests = list(base.interests)
    interest_map = {
        "tea estates": ["tea estate", "tea estates", "tea garden", "tea", "चाय"],
        "waterfalls": ["waterfall", "waterfalls", "झरने", "झरना"],
        "sunsets": ["sunset", "sunsets", "सूर्यास्त"],
        "coffee": ["coffee"],
        "heritage": ["heritage", "temple", "ruins", "fort", "विरासत"],
        "beaches": ["beach", "beaches", "समुद्र"],
        "wildlife": ["wildlife", "park", "safari"],
        "adventure": ["trek", "rafting", "adventure"],
        "backwaters": ["backwater", "backwaters", "houseboat"],
    }
    for tag, kws in interest_map.items():
        if any(kw in low for kw in kws) and tag not in interests:
            # Don't add adventure if "no trekking"
            if tag == "adventure" and ("no trek" in low or "avoid trek" in low):
                continue
            interests.append(tag)

    # 8. Constraints
    constraints = list(base.constraints)
    if any(p in low for p in ("ghat", "after dark", "night driving", "रात में घाट")) and "no night ghat driving" not in constraints:
        constraints.append("no night ghat driving")
    if any(p in low for p in ("vegetarian", "veg only", "pure veg", "शाकाहारी")) and "vegetarian" not in constraints:
        constraints.append("vegetarian")
    if any(p in low for p in ("no trek", "avoid trek", "no trekking")) and "no trekking" not in constraints:
        constraints.append("no trekking")

    # 9. Pace
    pace = base.pace
    if any(p in low for p in ("relaxed", "slow", "chill", "आराम")):
        pace = "RELAXED"
    elif any(p in low for p in ("packed", "busy", "everything", "intense")):
        pace = "PACKED"
    elif pace is None and ("balanced" in low or "budget" in low or interests):
        pace = "BALANCED"

    updated = base.model_copy(
        update={
            "origin": origin,
            "destination": destination,
            "start_date": start_date,
            "nights": nights,
            "travellers": travellers,
            "budget_inr": budget_inr,
            "interests": interests,
            "constraints": constraints,
            "pace": pace,
        }
    )
    updated.missing = compute_missing(updated)
    return updated


def clarify_response(intent: TripIntent, locale: str = "en") -> tuple[str, list[str]]:
    """Ask at most 2 clarifying questions ordered by importance."""
    prompts_map = {
        "en": {
            "origin": "where you are departing from",
            "budget_inr": "your total trip budget in INR",
            "nights": "how many nights you plan to stay",
            "start_date": "your start date or month",
            "travellers": "how many travellers are going",
        },
        "hi": {
            "origin": "आप किस शहर से यात्रा शुरू कर रहे हैं",
            "budget_inr": "आपका कुल बजट (₹ में)",
            "nights": "कितनी रातों की यात्रा है",
            "start_date": "यात्रा की तारीख या महीना",
            "travellers": "कितने यात्री जा रहे हैं",
        },
        "hinglish": {
            "origin": "aap kis city se travel kar rahe hain",
            "budget_inr": "total budget kitna hai (₹ mein)",
            "nights": "kitni nights ka trip hai",
            "start_date": "start date ya month kya hai",
            "travellers": "kitne log ja rahe hain",
        },
    }
    lang = locale if locale in prompts_map else "en"
    asked = intent.missing[:2]
    q_texts = [prompts_map[lang][f] for f in asked if f in prompts_map[lang]]
    msg = i18n.render("chat.clarify_header", lang, questions=" and ".join(q_texts) + "?")

    quick: list[str] = []
    if "origin" in asked or "budget_inr" in asked:
        quick = ["From Bengaluru, ₹55,000", "From Mumbai, ₹60,000"]
    elif "nights" in asked or "start_date" in asked:
        quick = ["5 days in early December for 2", "3 nights next weekend for 2"]
    elif "travellers" in asked:
        quick = ["For 2 people", "For 4 friends"]
    return msg, quick


def recommend_destinations(intent: TripIntent, locale: str = "en") -> tuple[str, list[DestinationOption]]:
    """Return 3 destination options; only Munnar available=true per A7."""
    budget = intent.budget_inr or 55000
    nights = intent.nights or 4
    origin = intent.origin or "Bengaluru"
    opts = [
        DestinationOption(
            name="Munnar",
            why="Tea estates, waterfalls, and cool December sunsets well within budget.",
            est_budget_inr=min(budget, 46300),
            available=True,
        ),
        DestinationOption(
            name="Wayanad",
            why="Misty forest waterfalls and wildlife trails.",
            est_budget_inr=min(budget, 42000),
            available=False,
        ),
        DestinationOption(
            name="Ooty",
            why="Heritage Nilgiri mountain rail and botanical gardens.",
            est_budget_inr=min(budget, 44000),
            available=False,
        ),
    ]
    msg = i18n.render(
        "chat.recommend_header",
        locale,
        nights=nights,
        origin=origin,
        budget_inr=f"{budget:,}",
    )
    return msg, opts


def explain_plan(
    plan_a: Plan,
    plan_b: Plan,
    intent: TripIntent,
    locale: str = "en",
) -> str:
    """Fact-grounded templated explanation citing exact solver numbers."""
    return i18n.render(
        "chat.plan_summary",
        locale,
        destination=intent.destination or "your destination",
        travellers=intent.travellers or 2,
        total_inr=f"{plan_a.total_cost_inr:,}",
        headroom_inr=f"{plan_a.validation.budget_headroom_inr:,}",
        slack_min=plan_a.validation.min_slack_min,
    )


def answer_trip_qa(
    question: str,
    trip_facts: TripDetail | None,
    locale: str = "en",
) -> str:
    """Answer post-booking questions strictly from TripDetail facts."""
    if trip_facts is None:
        return i18n.render("chat.qa_unavailable", locale, topic="no active trip")

    low = question.lower()
    plan = trip_facts.plan_a
    if any(k in low for k in ("hotel", "stay", "check-in", "checkin", "resort", "होटल")):
        hotel = next((it for it in plan.items if it.type == "HOTEL"), None) if plan else None
        bk = next((b for b in trip_facts.bookings if hotel and b.item_id == hotel.id), None)
        if hotel:
            dl = hotel.hard_deadline.strftime("%H:%M") if hotel.hard_deadline else hotel.end.strftime("%H:%M")
            status = bk.status if bk else "NOT_BOOKED"
            return (
                f"Your stay is {hotel.title} (₹{hotel.price_inr:,}, check-in {hotel.start.strftime('%H:%M')}–{dl}, "
                f"booking status {status})."
            )

    if any(k in low for k in ("flight", "airline", "departure", "arrival", "फ़्लाइट", "फ्लाइट")):
        flights = [it for it in plan.items if it.type == "FLIGHT"] if plan else []
        if flights:
            parts = [
                f"{f.title} ({f.start.strftime('%H:%M')}–{f.end.strftime('%H:%M')}, ₹{f.price_inr:,})"
                for f in flights
            ]
            return "Flights on your plan: " + "; ".join(parts) + "."

    if any(k in low for k in ("slack", "health", "risk", "safe", "delay", "स्थिति", "स्कोर")) and trip_facts.slack is not None:
        return (
            f"Current Journey Health is {trip_facts.slack.health} ({trip_facts.slack.score}/100). "
            f"{trip_facts.slack.explanation}"
        )

    if any(k in low for k in ("cost", "total", "budget", "price", "spent", "खर्च", "कीमत")) and plan:
        return (
            f"Plan {plan.kind} total is ₹{plan.total_cost_inr:,} with "
            f"₹{plan.validation.budget_headroom_inr:,} budget headroom."
        )

    if any(k in low for k in ("booking", "voucher", "status", "ref", "बुकिंग")) and trip_facts.bookings:
        parts = [f"{b.item_id}: {b.status} ({b.supplier_ref or 'pending'})" for b in trip_facts.bookings]
        return "Booking statuses: " + ", ".join(parts) + "."

    if plan:
        return (
            f"Trip '{trip_facts.trip.title}' is {trip_facts.trip.status} on Plan {plan.kind} "
            f"(₹{plan.total_cost_inr:,}, {len(plan.items)} items, {trip_facts.unread_alerts} unread alert(s))."
        )
    return i18n.render("chat.qa_unavailable", locale, topic=question[:40])
