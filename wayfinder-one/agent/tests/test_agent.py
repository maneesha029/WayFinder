"""Unit and integration tests for LangGraph agent, guards, courtesy, i18n, Local Pulse, and evals (Owner: P3)."""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from agent import courtesy, graph, guards, i18n, localpulse_classifier
from agent.evals.run_evals import evaluate_prompts
from contracts import models as m

FIXTURES = ROOT / "contracts" / "fixtures"
IST = timezone(timedelta(hours=5, minutes=30))


def _load_kerala(_intent: m.TripIntent) -> m.Inventory:
    return m.Inventory.model_validate(json.loads((FIXTURES / "inventory_kerala.json").read_text()))


def test_graph_golden_planned_flow():
    msg = (
        "Plan a 5-day budget trip from Bengaluru to Munnar for 2 people, early December, "
        "around ₹55,000. We like tea estates, waterfalls and sunsets. Avoid driving on ghat roads after dark."
    )
    st = m.AgentState(trip_id="trip_golden", intent=m.TripIntent())
    turn = graph.run_turn(st, msg, "en", _load_kerala)
    assert turn.response.stage == "PLANNED"
    assert turn.intent.missing == []
    assert turn.intent.destination == "Munnar"
    assert turn.response.plan_a is not None
    assert turn.response.plan_b is not None
    assert turn.response.plan_a.total_cost_inr == 46300
    assert turn.response.plan_a.validation.budget_headroom_inr == 8700


def test_graph_clarifying_asks_at_most_two_questions():
    st = m.AgentState(trip_id="trip_vague", intent=m.TripIntent())
    turn = graph.run_turn(st, "plan a trip", "en", _load_kerala)
    assert turn.response.stage == "CLARIFYING"
    assert turn.response.plan_a is None
    assert len(turn.response.quick_replies) >= 1
    assert len(turn.intent.missing) >= 2
    assert turn.response.assistant_message.count("?") <= 2


def test_graph_recommending_three_options_only_munnar_available():
    msg = "Plan a 5-day trip from Bengaluru for 2 people, early December, around ₹55,000, waterfalls and tea estates."
    st = m.AgentState(trip_id="trip_rec", intent=m.TripIntent())
    turn = graph.run_turn(st, msg, "en", _load_kerala)
    assert turn.response.stage == "RECOMMENDING"
    opts = turn.response.destination_options
    assert len(opts) == 3
    avail = [o.name for o in opts if o.available]
    assert avail == ["Munnar"]


def test_graph_post_booking_qa_and_cancel_gate():
    detail = m.TripDetail.model_validate(json.loads((FIXTURES / "golden_trip_detail.json").read_text()))
    st = m.AgentState(trip_id="trip_golden", intent=detail.trip.intent, trip_facts=detail)

    qa_turn = graph.run_turn(st, "What is my hotel check-in cutoff?", "en", _load_kerala)
    assert qa_turn.response.stage == "ANSWER"
    assert "Tea Valley Resort" in qa_turn.response.assistant_message
    assert "20:00" in qa_turn.response.assistant_message

    cancel_turn = graph.run_turn(st, "Cancel my booking", "en", _load_kerala)
    assert cancel_turn.response.proposed_action is not None
    assert cancel_turn.response.proposed_action.action == "CANCEL_BOOKING"


def test_guards_reject_ungrounded_numbers_and_times():
    facts = {"total_cost_inr": 46300, "min_slack_min": 65, "feasibility": 0.92, "time": "15:45"}
    assert guards.verify_output("Plan costs ₹46,300 with 92% feasibility, 65 min slack until 15:45.", facts) is True

    # Rejects fabricated rupee, percentage, duration, and clock time
    assert guards.verify_output("Plan costs ₹99,999.", facts) is False
    assert guards.verify_output("Feasibility is 99%.", facts) is False
    assert guards.verify_output("Slack is 999 min.", facts) is False
    assert guards.verify_output("Arrive by 23:59.", facts) is False

    out, tripped = guards.apply_guard("Flight costs ₹99,999.", facts, "Plan costs ₹46,300.")
    assert tripped is True
    assert out == "Plan costs ₹46,300."


def test_courtesy_drafts_multilingual_and_guarded():
    detail = m.TripDetail.model_validate(json.loads((FIXTURES / "golden_trip_detail.json").read_text()))
    rec = m.SwitchRecommendation.model_validate(json.loads((FIXTURES / "golden_switch.json").read_text()))
    facts = {
        "delay_min": 55,
        "eta": "16:00",
        "pickup": "11:30",
        "eravikulam": "09:00",
        "cutoff": "20:00",
        "wait_fee": 1400,
        "rebook_fee": 400,
    }
    for lang in ("en", "hi", "hinglish"):
        drafts = courtesy.draft_messages(rec, detail.trip, detail.plan_a, detail.plan_b, locale=lang)
        assert [d.recipient_kind for d in drafts] == ["HOTEL", "DRIVER", "VENDOR"]
        assert drafts[0].channel == "EMAIL"
        assert drafts[1].channel == "WHATSAPP"
        assert drafts[2].channel == "WHATSAPP"
        for d in drafts:
            assert d.language == lang
            assert guards.verify_output(d.body, facts) is True


def test_i18n_all_keys_all_languages_placeholders():
    assert len(i18n.TEMPLATES) >= 40
    placeholder_re = re.compile(r"\{([a-zA-Z0-9_]+)\}")
    dummy_vals = {
        "delay_min": "55",
        "item": "Eravikulam NP",
        "time": "15:45",
        "amount_inr": "1,800",
        "day": "3",
        "severity": "HEAVY",
        "destination": "Munnar",
        "event": "Hartal",
        "location": "Adimali",
        "confidence": "85",
        "eta_min": "95",
        "slack_min": "10",
        "ref": "SIM-H-101",
        "trip_title": "Munnar Trip",
        "count": "2",
        "health": "AMBER",
        "score": "53",
        "next_item": "Tea Valley Resort",
        "alert_note": "No alerts.",
        "rec_id": "sw_2",
        "mode": "MIXED",
        "lost_summary": "Mattupetty boating",
        "code": "SW2",
        "text": "abc",
        "name": "Asha",
        "recipient": "Tea Valley Resort",
        "date_str": "05 Dec",
        "cutoff": "20:00",
        "questions": "origin and budget?",
        "nights": "4",
        "origin": "Bengaluru",
        "budget_inr": "55,000",
        "travellers": "2",
        "total_inr": "46,300",
        "headroom_inr": "8,700",
        "trip_id": "trip_golden",
        "topic": "meals",
        "reason": "budget",
        "suggestion": "raise budget",
        "target": "booking",
        "old_inr": "4,300",
        "new_inr": "4,650",
    }

    for key, lang_map in i18n.TEMPLATES.items():
        en_placeholders = set(placeholder_re.findall(lang_map["en"]))
        for lang in i18n.SUPPORTED_LANGS:
            assert lang in lang_map, f"Missing {lang} for {key}"
            assert set(placeholder_re.findall(lang_map[lang])) == en_placeholders, (
                f"Placeholder mismatch on {key}.{lang}"
            )
            rendered = i18n.render(key, lang, **dummy_vals)
            assert "{" not in rendered and "}" not in rendered
            for pname in en_placeholders:
                assert dummy_vals[pname] in rendered


def test_localpulse_classifier_60_labelled_samples():
    now = datetime(2026, 12, 2, 8, 0, tzinfo=IST)
    samples: list[tuple[str, str, str, str]] = [
        # (title, summary, lang, expected_kind)
        ("Idukki hartal called tomorrow near Munnar", "Shops closed on 3 Dec", "en", "BANDH"),
        ("Munnar bandh announced for Friday", "Transport suspended in Devikulam", "en", "BANDH"),
        ("केरल के मुन्नार में कल बंद", "इडुक्की में हड़ताल का आह्वान", "hi", "BANDH"),
        ("Kochi port hartal on Saturday", "Full shutdown in Ernakulam", "en", "BANDH"),
        ("Kodagu district bandh on 12 Dec", "Madikeri markets shut", "en", "BANDH"),
        ("Taxi union strike in Munnar tomorrow", "Cab operators protest", "en", "STRIKE"),
        ("Auto strike across Fort Kochi", "Commuters affected today", "en", "STRIKE"),
        ("Karnataka bus strike hits Coorg", "Services suspended on Friday", "en", "STRIKE"),
        ("Goa tourist taxi strike called", "Airport cabs offline today", "en", "STRIKE"),
        ("हम्पी में ऑटो हड़ताल", "यातायात प्रभावित", "hi", "STRIKE"),
        ("Landslide blocks NH85 near Adimali", "Munnar road closed today", "en", "LANDSLIDE"),
        ("Minor landslip reported near Devikulam", "Debris clearance in Munnar", "en", "LANDSLIDE"),
        ("Urulpottal alert in Idukki hills", "Heavy rain triggers mudslide", "ml", "LANDSLIDE"),
        ("मुन्नार के पास भूस्खलन", "सड़क बाधित", "hi", "LANDSLIDE"),
        ("Rockfall near Dudhsagar trail in Goa", "Trail closed today", "en", "LANDSLIDE"),
        ("Traffic diverted on Gap Road Munnar", "Road closed for repair on 5 Dec", "en", "ROAD_RESTRICTION"),
        ("Night traffic ban on Coorg highway", "Road closed after dark", "en", "ROAD_RESTRICTION"),
        ("Hampi bridge closed for maintenance", "Diversion via Hospet today", "en", "ROAD_RESTRICTION"),
        ("Panjim city road closed for marathon", "Traffic diverted Sunday", "en", "ROAD_RESTRICTION"),
        ("NH85 ghat closed for culvert work", "Expect delays near Neriamangalam", "en", "ROAD_RESTRICTION"),
        ("VIP movement in Kochi tomorrow", "Security barricade near airport", "en", "VIP_MOVEMENT"),
        ("CM visit causes convoy hold-ups in Goa", "Panjim traffic restricted today", "en", "VIP_MOVEMENT"),
        ("Governor visit in Madikeri Coorg", "VIP movement along fort road", "en", "VIP_MOVEMENT"),
        ("Prime Minister visit security in Kochi", "Brief route closures", "en", "VIP_MOVEMENT"),
        ("VIP convoy passes Ernakulam bypass", "Short traffic pause today", "en", "VIP_MOVEMENT"),
        ("Onam festival procession in Kochi", "Heavy cultural crowd tomorrow", "en", "FESTIVAL"),
        ("Goa Carnival parade in Panjim", "Festival floats on 14 Dec", "en", "FESTIVAL"),
        ("Hampi Utsav cultural festival starts", "Three-day heritage fest", "en", "FESTIVAL"),
        ("Temple festival pooram near Alleppey", "Procession along canal road", "en", "FESTIVAL"),
        ("Neelakurinji bloom festival in Munnar", "Special buses arranged", "en", "FESTIVAL"),
        ("Heavy crowd at Top Station Munnar", "Weekend rush causes long queue", "en", "CROWD_PEAK"),
        ("Tourist rush fills Abbey Falls Coorg", "Traffic jam near parking today", "en", "CROWD_PEAK"),
        ("Weekend rush at Anjuna beach Goa", "Overcrowded sunset cliff", "en", "CROWD_PEAK"),
        ("Long queue at Vittala Temple Hampi", "Heavy crowd this morning", "en", "CROWD_PEAK"),
        ("Alleppey houseboat jetty overcrowded", "Weekend rush expected", "en", "CROWD_PEAK"),
        # Single-keyword generic / no explicit location -> confidence 0.6
        ("Statewide hartal warning issued", "Travellers urged to verify routes", "en", "BANDH"),
        ("Regional bus strike announced", "Union talks ongoing", "en", "STRIKE"),
        ("Hill highway landslide clearance", "Work crews deployed", "en", "LANDSLIDE"),
        ("Highway traffic diverted overnight", "Check alternate lanes", "en", "ROAD_RESTRICTION"),
        ("Security convoy delays expected", "VIP movement alert", "en", "VIP_MOVEMENT"),
        ("Annual town festival begins", "Local fair open", "en", "FESTIVAL"),
        ("Holiday weekend rush peaks", "Long queue at gates", "en", "CROWD_PEAK"),
        # Benign news -> NONE (< 0.5)
        ("Munnar wins eco-tourism award", "Community homestays praised", "en", "NONE"),
        ("New EV charging hub opens in Kochi", "Supports green travel", "en", "NONE"),
        ("Coorg arabica harvest outlook bright", "Farms welcome visitors", "en", "NONE"),
        ("Hampi museum launches audio guide", "Available in 5 languages", "en", "NONE"),
        ("Goa expands coastal solar lighting", "Clean energy milestone", "en", "NONE"),
        ("Alleppey boat race training begins", "Teams practice on lake", "en", "NONE"),
        ("Bengaluru airport opens new lounge", "Faster domestic check-in", "en", "NONE"),
        ("Kerala spice exports rise 12%", "Strong winter demand", "en", "NONE"),
        ("Tea Museum adds vintage machinery display", "Open daily from 10 AM", "en", "NONE"),
        ("Local chefs host culinary workshop", "Fresh seasonal menu", "en", "NONE"),
        ("Monsoon photography exhibition in Panjim", "Free entry all week", "en", "NONE"),
        ("Heritage conservation grant for Hampi", "Stone pathways restored", "en", "NONE"),
        ("Munnar botanical garden adds orchids", "New conservatory wing", "en", "NONE"),
        ("Coorg honey co-op launches store", "Direct from growers", "en", "NONE"),
        ("Alleppey backwater clean-up drive", "Volunteers collect plastic", "en", "NONE"),
        ("New cycle trail opens in Fort Kochi", "Marked coastal path", "en", "NONE"),
        ("Wildlife census begins in Eravikulam", "Routine annual count", "en", "NONE"),
        ("Digital ticketing speeds park entry", "QR scans at gate", "en", "NONE"),
    ]
    assert len(samples) >= 60

    news_items = [
        m.NewsItem(
            id=f"n_{idx}",
            title=title,
            summary=summary,
            url=f"https://news.example.com/item-{idx}",
            source="Local RSS",
            published_at=now,
            lang=lang,  # type: ignore[arg-type]
        )
        for idx, (title, summary, lang, _) in enumerate(samples)
    ]
    # Add 1 duplicate URL to test deduplication
    news_items.append(news_items[0].model_copy(update={"id": "n_dup"}))

    events = localpulse_classifier.classify(
        news_items, ["Munnar", "Kochi", "Alleppey", "Coorg", "Hampi", "Goa"], now
    )
    assert len(events) == len(samples)  # duplicate URL deduped

    correct = sum(1 for ev, (_, _, _, exp) in zip(events, samples) if ev.kind == exp)
    assert correct / len(samples) >= 0.90

    # Verify source_url & confidence thresholds
    assert events[0].source_url == news_items[0].url
    assert events[0].confidence >= 0.8  # Munnar + tomorrow -> high confidence
    assert events[35].confidence == 0.6  # single keyword without destination
    assert events[-1].kind == "NONE" and events[-1].confidence < 0.5


def test_agent_evals_threshold():
    res = evaluate_prompts()
    assert res["prompt_count"] >= 60
    assert res["intent_accuracy"] >= 0.90
    assert res["guard_checks"] >= 200
    assert res["guard_violations"] == 0
