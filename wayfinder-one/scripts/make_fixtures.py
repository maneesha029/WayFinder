#!/usr/bin/env python3
"""Generate and validate all inventory, golden, group, advisor, safety, and endpoint fixtures.
Run from repo root: python scripts/make_fixtures.py
Owner: P3.
"""
from __future__ import annotations

import json
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from contracts import models as m

IST = "+05:30"
FIXTURES = ROOT / "contracts" / "fixtures"
FIXTURES.mkdir(parents=True, exist_ok=True)


def ts(iso_str: str) -> datetime:
    if "+" in iso_str or iso_str.endswith("Z"):
        return datetime.fromisoformat(iso_str)
    return datetime.fromisoformat(iso_str + IST)


PROV_TBO = m.Provenance(
    source="TBO Sandbox (sim)",
    checked_at=ts("2026-11-22T10:00:00"),
    is_simulated=True,
    confidence=1.0,
)
PROV_FLIGHT = m.Provenance(
    source="Flight status feed (sim)",
    checked_at=ts("2026-12-05T04:40:00"),
    is_simulated=True,
    confidence=0.95,
)
PROV_WEATHER = m.Provenance(
    source="Open-Meteo (sim)",
    checked_at=ts("2026-12-02T07:40:00"),
    is_simulated=True,
    confidence=0.85,
)
PROV_TRAFFIC = m.Provenance(
    source="Traffic feed (sim)",
    checked_at=ts("2026-12-05T13:05:00"),
    is_simulated=True,
    confidence=0.9,
)

# Shared Munnar Places
PLACES_MUNNAR = {
    "BLR": m.Place(name="Bengaluru Airport (BLR)", lat=13.1986, lng=77.7066),
    "COK": m.Place(name="Kochi Airport (COK)", lat=10.1520, lng=76.4019),
    "MUN": m.Place(name="Munnar", lat=10.0889, lng=77.0595),
    "ERA": m.Place(name="Eravikulam National Park", lat=10.1667, lng=77.0500),
    "HOT": m.Place(name="Tea Valley Resort, Munnar", lat=10.0870, lng=77.0620),
    "TEA": m.Place(name="Tea Museum, Munnar", lat=10.0866, lng=77.0586),
    "MAT": m.Place(name="Mattupetty Dam", lat=10.1065, lng=77.1241),
    "LAK": m.Place(name="Lakkam Waterfalls", lat=10.0970, lng=77.1480),
    "TOP": m.Place(name="Top Station", lat=10.1209, lng=77.2339),
    "SPI": m.Place(name="Kalladanthy Spice Garden, Munnar", lat=10.0620, lng=77.0410),
    "LOC": m.Place(name="Lockhart Tea Factory, Munnar", lat=10.0320, lng=77.1290),
    "CHI": m.Place(name="Chithirapuram Quiet Ridge, Munnar", lat=10.0560, lng=77.0460),
}


def write_fixture(filename: str, data: object) -> None:
    out_path = FIXTURES / filename
    if isinstance(data, m.BaseModel):
        payload = json.loads(data.model_dump_json())
    elif isinstance(data, list):
        payload = [
            json.loads(x.model_dump_json()) if isinstance(x, m.BaseModel) else x
            for x in data
        ]
    elif isinstance(data, dict):
        payload = {
            k: (json.loads(v.model_dump_json()) if isinstance(v, m.BaseModel) else v)
            for k, v in data.items()
        }
    else:
        payload = data
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def build_inventories() -> dict[str, m.Inventory]:
    # 1. Kerala (Munnar Golden)
    kerala = m.Inventory(
        flights=[
            m.Offer(
                id="it_a_f1",
                type="FLIGHT",
                title="Flight BLR→COK (sim)",
                origin=PLACES_MUNNAR["BLR"],
                place=PLACES_MUNNAR["COK"],
                price_inr=8600,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-05T07:40:00"),
                latest_end=ts("2026-12-05T09:05:00"),
                fixed_start=ts("2026-12-05T07:40:00"),
                duration_min=85,
                priority_hint="MUST",
                rating=4.5,
                destination="Munnar",
                tags=["flight", "inbound"],
            ),
            m.Offer(
                id="it_a_f2",
                type="FLIGHT",
                title="Flight COK→BLR (sim)",
                origin=PLACES_MUNNAR["COK"],
                place=PLACES_MUNNAR["BLR"],
                price_inr=7800,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-09T17:35:00"),
                latest_end=ts("2026-12-09T19:00:00"),
                fixed_start=ts("2026-12-09T17:35:00"),
                duration_min=85,
                priority_hint="MUST",
                rating=4.5,
                destination="Munnar",
                tags=["flight", "outbound"],
            ),
        ],
        hotels=[
            m.Offer(
                id="it_a_h1",
                type="HOTEL",
                title="Tea Valley Resort, 4 nights",
                place=PLACES_MUNNAR["HOT"],
                price_inr=16000,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=48,
                earliest_start=ts("2026-12-05T14:30:00"),
                latest_end=ts("2026-12-05T20:00:00"),
                duration_min=330,
                hard_deadline=ts("2026-12-05T20:00:00"),
                flex_premium_inr=0,
                priority_hint="MUST",
                rating=4.6,
                indoor=True,
                destination="Munnar",
                tags=["hotel", "tea estates", "local_owned"],
            ),
        ],
        transfers=[
            m.Offer(
                id="it_a_t1",
                type="TRANSFER",
                title="Cab Kochi Airport → Munnar",
                origin=PLACES_MUNNAR["COK"],
                place=PLACES_MUNNAR["MUN"],
                price_inr=4300,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=24,
                earliest_start=ts("2026-12-05T09:50:00"),
                latest_end=ts("2026-12-05T14:20:00"),
                duration_min=270,
                rebook_fee_inr=1400,
                flex_premium_inr=500,
                priority_hint="MUST",
                rating=4.4,
                risk_tags=["GHAT_ROAD"],
                destination="Munnar",
                tags=["transfer", "inbound", "cab"],
            ),
            m.Offer(
                id="it_b_t1",
                type="TRANSFER",
                title="Cab Kochi Airport → Munnar (Late Buffer)",
                origin=PLACES_MUNNAR["COK"],
                place=PLACES_MUNNAR["MUN"],
                price_inr=4300,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=24,
                earliest_start=ts("2026-12-05T11:30:00"),
                latest_end=ts("2026-12-05T16:00:00"),
                duration_min=270,
                rebook_fee_inr=0,
                flex_premium_inr=0,
                priority_hint="MUST",
                rating=4.4,
                risk_tags=["GHAT_ROAD"],
                destination="Munnar",
                tags=["transfer", "inbound", "cab", "late"],
            ),
            m.Offer(
                id="it_a_t2",
                type="TRANSFER",
                title="Cab Munnar → Kochi Airport",
                origin=PLACES_MUNNAR["MUN"],
                place=PLACES_MUNNAR["COK"],
                price_inr=4300,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=24,
                earliest_start=ts("2026-12-09T10:00:00"),
                latest_end=ts("2026-12-09T14:30:00"),
                duration_min=270,
                rebook_fee_inr=400,
                flex_premium_inr=400,
                priority_hint="MUST",
                rating=4.4,
                risk_tags=["GHAT_ROAD"],
                destination="Munnar",
                tags=["transfer", "outbound", "cab"],
            ),
            m.Offer(
                id="off_eco_t1",
                type="TRANSFER",
                title="Shared EV Shuttle Munnar → Kochi Airport",
                origin=PLACES_MUNNAR["MUN"],
                place=PLACES_MUNNAR["COK"],
                price_inr=3200,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=24,
                earliest_start=ts("2026-12-09T09:30:00"),
                latest_end=ts("2026-12-09T14:15:00"),
                duration_min=285,
                rebook_fee_inr=0,
                flex_premium_inr=0,
                priority_hint="NICE",
                rating=4.3,
                risk_tags=["GHAT_ROAD"],
                co2_kg=5.5,
                destination="Munnar",
                tags=["transfer", "outbound", "eco", "shared_ev"],
            ),
        ],
        activities=[
            m.Offer(
                id="it_a_e1",
                type="ACTIVITY",
                title="Eravikulam NP timed entry",
                place=PLACES_MUNNAR["ERA"],
                price_inr=1000,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-05T15:00:00"),
                latest_end=ts("2026-12-05T17:00:00"),
                fixed_start=ts("2026-12-05T15:00:00"),
                duration_min=120,
                hard_deadline=ts("2026-12-05T15:45:00"),
                rebook_fee_inr=400,
                flex_premium_inr=250,
                priority_hint="MUST",
                rating=4.9,
                risk_tags=["RAIN"],
                destination="Munnar",
                tags=["tea estates", "wildlife", "nature"],
            ),
            m.Offer(
                id="it_b_e1",
                type="ACTIVITY",
                title="Eravikulam NP timed entry",
                place=PLACES_MUNNAR["ERA"],
                price_inr=1000,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=12,
                earliest_start=ts("2026-12-06T09:00:00"),
                latest_end=ts("2026-12-06T11:00:00"),
                fixed_start=ts("2026-12-06T09:00:00"),
                duration_min=120,
                hard_deadline=ts("2026-12-06T11:45:00"),
                rebook_fee_inr=0,
                flex_premium_inr=0,
                priority_hint="MUST",
                rating=4.9,
                risk_tags=[],
                destination="Munnar",
                tags=["tea estates", "wildlife", "nature", "standby"],
            ),
            m.Offer(
                id="it_a_tm",
                type="ACTIVITY",
                title="Tea Museum",
                place=PLACES_MUNNAR["TEA"],
                price_inr=400,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-06T10:00:00"),
                latest_end=ts("2026-12-06T11:30:00"),
                duration_min=90,
                priority_hint="NICE",
                rating=4.4,
                indoor=True,
                destination="Munnar",
                tags=["tea estates", "tea", "indoor", "heritage"],
            ),
            m.Offer(
                id="it_b_tm",
                type="ACTIVITY",
                title="Tea Museum",
                place=PLACES_MUNNAR["TEA"],
                price_inr=400,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=12,
                earliest_start=ts("2026-12-06T14:00:00"),
                latest_end=ts("2026-12-06T15:30:00"),
                fixed_start=ts("2026-12-06T14:00:00"),
                duration_min=90,
                priority_hint="NICE",
                rating=4.4,
                indoor=True,
                destination="Munnar",
                tags=["tea estates", "tea", "indoor", "heritage", "standby"],
            ),
            m.Offer(
                id="it_a_mb",
                type="ACTIVITY",
                title="Mattupetty Dam boating",
                place=PLACES_MUNNAR["MAT"],
                price_inr=900,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-06T13:30:00"),
                latest_end=ts("2026-12-06T15:00:00"),
                duration_min=90,
                priority_hint="NICE",
                rating=4.2,
                destination="Munnar",
                tags=["waterfalls", "boating", "nature"],
            ),
            m.Offer(
                id="it_a_wf",
                type="ACTIVITY",
                title="Lakkam waterfall guided trek",
                place=PLACES_MUNNAR["LAK"],
                price_inr=1600,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-07T08:30:00"),
                latest_end=ts("2026-12-07T13:00:00"),
                duration_min=270,
                priority_hint="MUST",
                rating=4.8,
                risk_tags=["RAIN"],
                destination="Munnar",
                tags=["waterfalls", "trek", "nature"],
            ),
            m.Offer(
                id="it_b_sp",
                type="ACTIVITY",
                title="Spice plantation + cooking class",
                place=PLACES_MUNNAR["SPI"],
                price_inr=1500,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=24,
                earliest_start=ts("2026-12-07T09:30:00"),
                latest_end=ts("2026-12-07T13:00:00"),
                duration_min=210,
                priority_hint="NICE",
                rating=4.6,
                indoor=True,
                destination="Munnar",
                tags=["tea estates", "local_owned", "indoor", "standby"],
            ),
            m.Offer(
                id="it_a_ts",
                type="ACTIVITY",
                title="Top Station sunset point (jeep)",
                place=PLACES_MUNNAR["TOP"],
                price_inr=1400,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-08T16:00:00"),
                latest_end=ts("2026-12-08T19:00:00"),
                duration_min=180,
                priority_hint="NICE",
                rating=4.8,
                risk_tags=["RAIN", "CROWD"],
                destination="Munnar",
                tags=["sunsets", "sunset", "viewpoint"],
            ),
            m.Offer(
                id="it_b_tf",
                type="ACTIVITY",
                title="Lockhart Tea Factory & Heritage Tour",
                place=PLACES_MUNNAR["LOC"],
                price_inr=1100,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=24,
                earliest_start=ts("2026-12-08T15:00:00"),
                latest_end=ts("2026-12-08T17:30:00"),
                duration_min=150,
                priority_hint="NICE",
                rating=4.5,
                indoor=True,
                destination="Munnar",
                tags=["tea estates", "sunsets", "eco", "heritage", "offbeat", "local_owned", "indoor", "standby"],
            ),
            m.Offer(
                id="it_b_ec",
                type="ACTIVITY",
                title="Chithirapuram Quiet Ridge Sunset Walk",
                place=PLACES_MUNNAR["CHI"],
                price_inr=900,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=12,
                earliest_start=ts("2026-12-08T16:00:00"),
                latest_end=ts("2026-12-08T18:00:00"),
                duration_min=120,
                priority_hint="NICE",
                rating=4.3,
                indoor=False,
                destination="Munnar",
                tags=["sunsets", "sunset", "offbeat", "eco", "local_owned"],
            ),
        ],
    )

    # 2. Coorg
    p_blr = PLACES_MUNNAR["BLR"]
    p_cok_mad = m.Place(name="Madikeri, Coorg", lat=12.4244, lng=75.7382)
    p_abbey = m.Place(name="Abbey Falls, Coorg", lat=12.4586, lng=75.7168)
    p_dubare = m.Place(name="Dubare Camp, Coorg", lat=12.3712, lng=75.9016)
    p_raja = m.Place(name="Raja's Seat, Madikeri", lat=12.4158, lng=75.7366)
    p_coffee = m.Place(name="Mercara Coffee Estate, Coorg", lat=12.4080, lng=75.7220)
    p_fort = m.Place(name="Madikeri Fort Museum", lat=12.4210, lng=75.7380)
    coorg = m.Inventory(
        flights=[],
        hotels=[
            m.Offer(
                id="cg_h1",
                type="HOTEL",
                title="Coorg Wilderness Homestay (3 nights)",
                place=p_cok_mad,
                price_inr=18000,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=48,
                earliest_start=ts("2026-12-12T13:00:00"),
                latest_end=ts("2026-12-12T20:00:00"),
                duration_min=300,
                hard_deadline=ts("2026-12-12T20:00:00"),
                priority_hint="MUST",
                rating=4.7,
                indoor=True,
                destination="Coorg",
                tags=["hotel", "local_owned", "vegetarian_friendly"],
            ),
        ],
        transfers=[
            m.Offer(
                id="cg_t1",
                type="TRANSFER",
                title="SUV Bengaluru → Coorg",
                origin=p_blr,
                place=p_cok_mad,
                price_inr=6800,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=24,
                earliest_start=ts("2026-12-12T08:00:00"),
                latest_end=ts("2026-12-12T13:30:00"),
                fixed_start=ts("2026-12-12T08:00:00"),
                duration_min=330,
                priority_hint="MUST",
                rating=4.5,
                risk_tags=["GHAT_ROAD"],
                destination="Coorg",
                tags=["transfer", "inbound"],
            ),
            m.Offer(
                id="cg_t2",
                type="TRANSFER",
                title="SUV Coorg → Bengaluru",
                origin=p_cok_mad,
                place=p_blr,
                price_inr=6800,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=24,
                earliest_start=ts("2026-12-15T10:00:00"),
                latest_end=ts("2026-12-15T15:30:00"),
                fixed_start=ts("2026-12-15T10:00:00"),
                duration_min=330,
                priority_hint="MUST",
                rating=4.5,
                risk_tags=["GHAT_ROAD"],
                destination="Coorg",
                tags=["transfer", "outbound"],
            ),
        ],
        activities=[
            m.Offer(
                id="cg_a1",
                type="ACTIVITY",
                title="Abbey Falls Nature Walk",
                place=p_abbey,
                price_inr=1200,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-12T15:00:00"),
                latest_end=ts("2026-12-12T17:00:00"),
                duration_min=120,
                priority_hint="MUST",
                rating=4.6,
                risk_tags=["RAIN"],
                destination="Coorg",
                tags=["waterfalls", "nature"],
            ),
            m.Offer(
                id="cg_a2",
                type="ACTIVITY",
                title="Organic Coffee Estate & Vegetarian Sadhya",
                place=p_coffee,
                price_inr=2400,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=24,
                earliest_start=ts("2026-12-13T09:30:00"),
                latest_end=ts("2026-12-13T12:30:00"),
                duration_min=180,
                priority_hint="MUST",
                rating=4.8,
                indoor=True,
                destination="Coorg",
                tags=["coffee", "local_owned", "vegetarian", "indoor"],
            ),
            m.Offer(
                id="cg_a3",
                type="ACTIVITY",
                title="Barapole White-Water Rafting",
                place=p_dubare,
                price_inr=3600,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-13T14:00:00"),
                latest_end=ts("2026-12-13T17:00:00"),
                duration_min=180,
                priority_hint="NICE",
                rating=4.7,
                risk_tags=["RAIN"],
                destination="Coorg",
                tags=["adventure", "waterfalls"],
            ),
            m.Offer(
                id="cg_a4",
                type="ACTIVITY",
                title="Raja's Seat Sunset Point",
                place=p_raja,
                price_inr=800,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-14T16:30:00"),
                latest_end=ts("2026-12-14T18:30:00"),
                duration_min=120,
                priority_hint="NICE",
                rating=4.5,
                risk_tags=["CROWD"],
                destination="Coorg",
                tags=["sunsets", "viewpoint"],
            ),
            m.Offer(
                id="cg_a5",
                type="ACTIVITY",
                title="Madikeri Fort & Heritage Gallery",
                place=p_fort,
                price_inr=600,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-14T10:30:00"),
                latest_end=ts("2026-12-14T12:30:00"),
                duration_min=120,
                priority_hint="NICE",
                rating=4.4,
                indoor=True,
                destination="Coorg",
                tags=["heritage", "indoor", "standby"],
            ),
        ],
    )

    # 3. Hampi
    p_hampi = m.Place(name="Hampi Bazaar", lat=15.3350, lng=76.4600)
    p_vit = m.Place(name="Vittala Temple Complex", lat=15.3422, lng=76.4754)
    p_mat = m.Place(name="Matanga Hill", lat=15.3324, lng=76.4648)
    p_cor = m.Place(name="Sanapur Tungabhadra Coracle Ferry", lat=15.3490, lng=76.4470)
    hampi = m.Inventory(
        flights=[],
        hotels=[
            m.Offer(
                id="hp_h1",
                type="HOTEL",
                title="Evolve Heritage Cottage, Hampi (3 nights)",
                place=p_hampi,
                price_inr=12000,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=48,
                earliest_start=ts("2026-12-12T13:30:00"),
                latest_end=ts("2026-12-12T20:00:00"),
                duration_min=300,
                hard_deadline=ts("2026-12-12T20:00:00"),
                priority_hint="MUST",
                rating=4.6,
                indoor=True,
                destination="Hampi",
                tags=["hotel", "heritage", "local_owned"],
            ),
        ],
        transfers=[
            m.Offer(
                id="hp_t1",
                type="TRANSFER",
                title="Overnight Express / Cab Bengaluru → Hampi",
                origin=p_blr,
                place=p_hampi,
                price_inr=3600,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-12T08:00:00"),
                latest_end=ts("2026-12-12T13:00:00"),
                fixed_start=ts("2026-12-12T08:00:00"),
                duration_min=300,
                priority_hint="MUST",
                rating=4.4,
                destination="Hampi",
                tags=["transfer", "inbound"],
            ),
            m.Offer(
                id="hp_t2",
                type="TRANSFER",
                title="Cab Hampi → Bengaluru",
                origin=p_hampi,
                place=p_blr,
                price_inr=3600,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-15T10:00:00"),
                latest_end=ts("2026-12-15T15:30:00"),
                fixed_start=ts("2026-12-15T10:00:00"),
                duration_min=330,
                priority_hint="MUST",
                rating=4.4,
                destination="Hampi",
                tags=["transfer", "outbound"],
            ),
        ],
        activities=[
            m.Offer(
                id="hp_a1",
                type="ACTIVITY",
                title="Virupaksha Temple & Hampi Bazaar Guided Walk",
                place=p_hampi,
                price_inr=1200,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-12T15:00:00"),
                latest_end=ts("2026-12-12T17:30:00"),
                duration_min=150,
                priority_hint="MUST",
                rating=4.8,
                destination="Hampi",
                tags=["heritage", "eco"],
            ),
            m.Offer(
                id="hp_a2",
                type="ACTIVITY",
                title="Vittala Temple Stone Chariot Tour",
                place=p_vit,
                price_inr=1400,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-13T09:00:00"),
                latest_end=ts("2026-12-13T12:00:00"),
                duration_min=180,
                priority_hint="MUST",
                rating=4.9,
                risk_tags=["HEAT"],
                destination="Hampi",
                tags=["heritage", "architecture"],
            ),
            m.Offer(
                id="hp_a3",
                type="ACTIVITY",
                title="Matanga Hill Sunset Viewpoint",
                place=p_mat,
                price_inr=600,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-13T16:30:00"),
                latest_end=ts("2026-12-13T18:30:00"),
                duration_min=120,
                priority_hint="NICE",
                rating=4.7,
                risk_tags=["CROWD"],
                destination="Hampi",
                tags=["sunsets", "viewpoint"],
            ),
            m.Offer(
                id="hp_a4",
                type="ACTIVITY",
                title="Tungabhadra Coracle Ride & Craft Workshop",
                place=p_cor,
                price_inr=900,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-14T10:00:00"),
                latest_end=ts("2026-12-14T12:30:00"),
                duration_min=150,
                priority_hint="NICE",
                rating=4.6,
                indoor=True,
                destination="Hampi",
                tags=["local_owned", "offbeat", "standby"],
            ),
        ],
    )

    # 4. Goa
    p_goi = m.Place(name="Goa Airport (GOI)", lat=15.3808, lng=73.8314)
    p_pan = m.Place(name="Fontainhas, Panjim", lat=15.4956, lng=73.8304)
    p_bag = m.Place(name="Anjuna Coast, Goa", lat=15.5736, lng=73.7407)
    p_dud = m.Place(name="Dudhsagar Falls Trail", lat=15.3144, lng=74.3143)
    goa = m.Inventory(
        flights=[
            m.Offer(
                id="ga_f1",
                type="FLIGHT",
                title="Flight BLR→GOI (sim)",
                origin=p_blr,
                place=p_goi,
                price_inr=7200,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-12T08:15:00"),
                latest_end=ts("2026-12-12T09:30:00"),
                fixed_start=ts("2026-12-12T08:15:00"),
                duration_min=75,
                priority_hint="MUST",
                rating=4.5,
                destination="Goa",
                tags=["flight", "inbound"],
            ),
            m.Offer(
                id="ga_f2",
                type="FLIGHT",
                title="Flight GOI→BLR (sim)",
                origin=p_goi,
                place=p_blr,
                price_inr=7400,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-15T17:45:00"),
                latest_end=ts("2026-12-15T19:00:00"),
                fixed_start=ts("2026-12-15T17:45:00"),
                duration_min=75,
                priority_hint="MUST",
                rating=4.5,
                destination="Goa",
                tags=["flight", "outbound"],
            ),
        ],
        hotels=[
            m.Offer(
                id="ga_h1",
                type="HOTEL",
                title="Panjim Heritage Boutique Inn (3 nights)",
                place=p_pan,
                price_inr=14000,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=48,
                earliest_start=ts("2026-12-12T12:00:00"),
                latest_end=ts("2026-12-12T20:00:00"),
                duration_min=300,
                hard_deadline=ts("2026-12-12T20:00:00"),
                priority_hint="MUST",
                rating=4.7,
                indoor=True,
                destination="Goa",
                tags=["hotel", "heritage", "local_owned"],
            ),
        ],
        transfers=[
            m.Offer(
                id="ga_t1",
                type="TRANSFER",
                title="Cab GOI Airport → Panjim",
                origin=p_goi,
                place=p_pan,
                price_inr=1800,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-12T10:15:00"),
                latest_end=ts("2026-12-12T11:15:00"),
                fixed_start=ts("2026-12-12T10:15:00"),
                duration_min=60,
                priority_hint="MUST",
                rating=4.5,
                destination="Goa",
                tags=["transfer", "inbound"],
            ),
            m.Offer(
                id="ga_t2",
                type="TRANSFER",
                title="Cab Panjim → GOI Airport",
                origin=p_pan,
                place=p_goi,
                price_inr=1800,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-15T14:30:00"),
                latest_end=ts("2026-12-15T15:30:00"),
                fixed_start=ts("2026-12-15T14:30:00"),
                duration_min=60,
                priority_hint="MUST",
                rating=4.5,
                destination="Goa",
                tags=["transfer", "outbound"],
            ),
        ],
        activities=[
            m.Offer(
                id="ga_a1",
                type="ACTIVITY",
                title="Fontainhas Latin Quarter Heritage Walk",
                place=p_pan,
                price_inr=900,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-12T15:30:00"),
                latest_end=ts("2026-12-12T17:30:00"),
                duration_min=120,
                priority_hint="MUST",
                rating=4.7,
                indoor=False,
                destination="Goa",
                tags=["heritage", "local_owned"],
            ),
            m.Offer(
                id="ga_a2",
                type="ACTIVITY",
                title="Dudhsagar Falls Eco Safari",
                place=p_dud,
                price_inr=2400,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-13T08:30:00"),
                latest_end=ts("2026-12-13T14:00:00"),
                duration_min=330,
                priority_hint="MUST",
                rating=4.8,
                risk_tags=["RAIN"],
                destination="Goa",
                tags=["waterfalls", "nature"],
            ),
            m.Offer(
                id="ga_a3",
                type="ACTIVITY",
                title="Anjuna Cliff Sunset Cruise",
                place=p_bag,
                price_inr=1600,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-14T16:30:00"),
                latest_end=ts("2026-12-14T18:30:00"),
                duration_min=120,
                priority_hint="NICE",
                rating=4.5,
                risk_tags=["RAIN", "CROWD"],
                destination="Goa",
                tags=["sunsets", "sunset"],
            ),
            m.Offer(
                id="ga_a4",
                type="ACTIVITY",
                title="Goan Spice Farm & Culinary Studio",
                place=p_pan,
                price_inr=1300,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-14T10:30:00"),
                latest_end=ts("2026-12-14T13:30:00"),
                duration_min=180,
                priority_hint="NICE",
                rating=4.6,
                indoor=True,
                destination="Goa",
                tags=["local_owned", "indoor", "standby"],
            ),
        ],
    )

    # 5. Kerala Multi-City Circuit (Kochi -> Munnar -> Alleppey)
    p_koc_fort = m.Place(name="Fort Kochi", lat=9.9658, lng=76.2421)
    p_all = m.Place(name="Alleppey Backwaters", lat=9.4981, lng=76.3388)
    circuit = m.Inventory(
        flights=[
            m.Offer(
                id="kc_f1",
                type="FLIGHT",
                title="Flight BLR→COK (sim)",
                origin=p_blr,
                place=PLACES_MUNNAR["COK"],
                price_inr=8600,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-05T07:40:00"),
                latest_end=ts("2026-12-05T09:05:00"),
                fixed_start=ts("2026-12-05T07:40:00"),
                duration_min=85,
                priority_hint="MUST",
                rating=4.5,
                destination="Kochi",
                tags=["flight", "inbound"],
            ),
            m.Offer(
                id="kc_f2",
                type="FLIGHT",
                title="Flight COK→BLR (sim)",
                origin=PLACES_MUNNAR["COK"],
                place=p_blr,
                price_inr=7800,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-11T17:35:00"),
                latest_end=ts("2026-12-11T19:00:00"),
                fixed_start=ts("2026-12-11T17:35:00"),
                duration_min=85,
                priority_hint="MUST",
                rating=4.5,
                destination="Kochi",
                tags=["flight", "outbound"],
            ),
        ],
        hotels=[
            m.Offer(
                id="kc_h_kochi",
                type="HOTEL",
                title="Fort Kochi Heritage Inn (1 night)",
                place=p_koc_fort,
                price_inr=4500,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=48,
                earliest_start=ts("2026-12-05T13:00:00"),
                latest_end=ts("2026-12-05T20:00:00"),
                duration_min=240,
                hard_deadline=ts("2026-12-05T20:00:00"),
                priority_hint="MUST",
                rating=4.6,
                indoor=True,
                destination="Kochi",
                tags=["hotel", "heritage"],
            ),
            m.Offer(
                id="kc_h_munnar",
                type="HOTEL",
                title="Tea Valley Resort Munnar (3 nights)",
                place=PLACES_MUNNAR["HOT"],
                price_inr=12000,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=48,
                earliest_start=ts("2026-12-06T14:00:00"),
                latest_end=ts("2026-12-06T20:00:00"),
                duration_min=240,
                hard_deadline=ts("2026-12-06T20:00:00"),
                priority_hint="MUST",
                rating=4.6,
                indoor=True,
                destination="Munnar",
                tags=["hotel", "tea estates"],
            ),
            m.Offer(
                id="kc_h_alleppey",
                type="HOTEL",
                title="Alleppey Eco Backwater Stay (2 nights)",
                place=p_all,
                price_inr=9000,
                price_provenance=PROV_TBO,
                refundable=True,
                cancel_hours_before=48,
                earliest_start=ts("2026-12-09T14:00:00"),
                latest_end=ts("2026-12-09T20:00:00"),
                duration_min=240,
                hard_deadline=ts("2026-12-09T20:00:00"),
                priority_hint="MUST",
                rating=4.7,
                indoor=True,
                destination="Alleppey",
                tags=["hotel", "eco"],
            ),
        ],
        transfers=[
            m.Offer(
                id="kc_t_air_kochi",
                type="TRANSFER",
                title="Cab COK Airport → Fort Kochi",
                origin=PLACES_MUNNAR["COK"],
                place=p_koc_fort,
                price_inr=1400,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-05T09:45:00"),
                latest_end=ts("2026-12-05T11:15:00"),
                duration_min=90,
                priority_hint="MUST",
                rating=4.5,
                destination="Kochi",
                tags=["transfer", "intercity"],
            ),
            m.Offer(
                id="kc_t_kochi_munnar",
                type="TRANSFER",
                title="Cab Kochi → Munnar",
                origin=p_koc_fort,
                place=PLACES_MUNNAR["MUN"],
                price_inr=4300,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-06T09:00:00"),
                latest_end=ts("2026-12-06T13:30:00"),
                duration_min=270,
                priority_hint="MUST",
                rating=4.5,
                risk_tags=["GHAT_ROAD"],
                destination="Munnar",
                tags=["transfer", "intercity"],
            ),
            m.Offer(
                id="kc_t_kochi_munnar_b",
                type="TRANSFER",
                title="Morning Express Bus Kochi → Munnar",
                origin=p_koc_fort,
                place=PLACES_MUNNAR["MUN"],
                price_inr=1800,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-06T10:30:00"),
                latest_end=ts("2026-12-06T15:30:00"),
                duration_min=300,
                priority_hint="NICE",
                rating=4.2,
                risk_tags=["GHAT_ROAD"],
                destination="Munnar",
                tags=["transfer", "intercity", "standby", "eco"],
            ),
            m.Offer(
                id="kc_t_munnar_all",
                type="TRANSFER",
                title="Cab Munnar → Alleppey",
                origin=PLACES_MUNNAR["MUN"],
                place=p_all,
                price_inr=4800,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-09T09:00:00"),
                latest_end=ts("2026-12-09T14:00:00"),
                duration_min=300,
                priority_hint="MUST",
                rating=4.5,
                risk_tags=["GHAT_ROAD"],
                destination="Alleppey",
                tags=["transfer", "intercity"],
            ),
            m.Offer(
                id="kc_t_all_air",
                type="TRANSFER",
                title="Cab Alleppey → COK Airport",
                origin=p_all,
                place=PLACES_MUNNAR["COK"],
                price_inr=2600,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-11T12:00:00"),
                latest_end=ts("2026-12-11T14:30:00"),
                duration_min=150,
                priority_hint="MUST",
                rating=4.5,
                destination="Alleppey",
                tags=["transfer", "outbound"],
            ),
        ],
        activities=[
            m.Offer(
                id="kc_a_k1",
                type="ACTIVITY",
                title="Fort Kochi Chinese Fishing Nets Sunset",
                place=p_koc_fort,
                price_inr=800,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-05T16:00:00"),
                latest_end=ts("2026-12-05T18:30:00"),
                duration_min=150,
                priority_hint="MUST",
                rating=4.7,
                risk_tags=["CROWD"],
                destination="Kochi",
                tags=["sunsets", "heritage"],
            ),
            m.Offer(
                id="kc_a_k2",
                type="ACTIVITY",
                title="Mattancherry Spice Warehouse Tour",
                place=p_koc_fort,
                price_inr=700,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-05T14:00:00"),
                latest_end=ts("2026-12-05T15:30:00"),
                duration_min=90,
                priority_hint="NICE",
                rating=4.5,
                indoor=True,
                destination="Kochi",
                tags=["heritage", "indoor", "standby"],
            ),
            m.Offer(
                id="kc_a_m1",
                type="ACTIVITY",
                title="Eravikulam NP & Tea Valley Walk",
                place=PLACES_MUNNAR["ERA"],
                price_inr=1000,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-07T09:00:00"),
                latest_end=ts("2026-12-07T12:00:00"),
                duration_min=180,
                priority_hint="MUST",
                rating=4.9,
                risk_tags=["RAIN"],
                destination="Munnar",
                tags=["tea estates", "nature"],
            ),
            m.Offer(
                id="kc_a_m2",
                type="ACTIVITY",
                title="Lakkam Waterfall Trek",
                place=PLACES_MUNNAR["LAK"],
                price_inr=1400,
                price_provenance=PROV_TBO,
                refundable=False,
                earliest_start=ts("2026-12-08T09:00:00"),
                latest_end=ts("2026-12-08T13:00:00"),
                duration_min=240,
                priority_hint="MUST",
                rating=4.7,
                risk_tags=["RAIN"],
                destination="Munnar",
                tags=["waterfalls", "trek"],
            ),
            m.Offer(
                id="kc_a_m3",
                type="ACTIVITY",
                title="Munnar Tea Museum & Factory",
                place=PLACES_MUNNAR["TEA"],
                price_inr=600,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-07T14:30:00"),
                latest_end=ts("2026-12-07T16:30:00"),
                duration_min=120,
                priority_hint="NICE",
                rating=4.5,
                indoor=True,
                destination="Munnar",
                tags=["tea estates", "indoor", "standby"],
            ),
            m.Offer(
                id="kc_a_m4",
                type="ACTIVITY",
                title="Spice Garden Culinary Workshop",
                place=PLACES_MUNNAR["SPI"],
                price_inr=1100,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-08T10:00:00"),
                latest_end=ts("2026-12-08T13:00:00"),
                duration_min=180,
                priority_hint="NICE",
                rating=4.6,
                indoor=True,
                destination="Munnar",
                tags=["local_owned", "indoor", "standby"],
            ),
            m.Offer(
                id="kc_a_a1",
                type="ACTIVITY",
                title="Vembanad Backwater Shikara Cruise",
                place=p_all,
                price_inr=1800,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-10T09:00:00"),
                latest_end=ts("2026-12-10T12:30:00"),
                duration_min=210,
                priority_hint="MUST",
                rating=4.8,
                destination="Alleppey",
                tags=["backwaters", "eco"],
            ),
            m.Offer(
                id="kc_a_a2",
                type="ACTIVITY",
                title="Kuttanad Village Coir & Canoe Experience",
                place=p_all,
                price_inr=1200,
                price_provenance=PROV_TBO,
                refundable=True,
                earliest_start=ts("2026-12-10T14:30:00"),
                latest_end=ts("2026-12-10T17:00:00"),
                duration_min=150,
                priority_hint="NICE",
                rating=4.6,
                indoor=True,
                destination="Alleppey",
                tags=["local_owned", "eco", "standby"],
            ),
        ],
    )

    inventories = {
        "inventory_kerala.json": kerala,
        "inventory_coorg.json": coorg,
        "inventory_hampi.json": hampi,
        "inventory_goa.json": goa,
        "inventory_kerala_circuit.json": circuit,
    }
    for fname, inv in inventories.items():
        write_fixture(fname, inv)
    return inventories


def main() -> None:
    inventories = build_inventories()
    inventories["inventory_kerala.json"]

    # Load / refresh golden_plan_a
    plan_a_path = FIXTURES / "golden_plan_a.json"
    plan_a = m.Plan.model_validate(json.loads(plan_a_path.read_text()))

    # Build golden_plan_b
    b_items = [
        next(i for i in plan_a.items if i.id == "it_a_f1"),
        m.PlanItem(
            id="it_b_t1",
            type="TRANSFER",
            title="Cab Kochi Airport → Munnar (Late Buffer)",
            day=1,
            start=ts("2026-12-05T11:30:00"),
            end=ts("2026-12-05T16:00:00"),
            origin=PLACES_MUNNAR["COK"],
            place=PLACES_MUNNAR["MUN"],
            price_inr=4300,
            price_provenance=PROV_TBO,
            refundable=True,
            cancel_by=ts("2026-12-04T11:30:00"),
            priority="MUST",
            depends_on=["it_a_f1"],
            risk_tags=["GHAT_ROAD"],
            rebook_fee_inr=0,
        ),
        next(i for i in plan_a.items if i.id == "it_a_h1").model_copy(
            update={"depends_on": ["it_b_t1"]}
        ),
        m.PlanItem(
            id="it_b_e1",
            type="ACTIVITY",
            title="Eravikulam NP timed entry",
            day=2,
            start=ts("2026-12-06T09:00:00"),
            end=ts("2026-12-06T11:00:00"),
            place=PLACES_MUNNAR["ERA"],
            price_inr=1000,
            price_provenance=PROV_TBO,
            refundable=True,
            cancel_by=ts("2026-12-05T21:00:00"),
            priority="MUST",
            fixed=True,
            hard_deadline=ts("2026-12-06T11:45:00"),
            risk_tags=[],
            rebook_fee_inr=0,
        ),
        m.PlanItem(
            id="it_b_tm",
            type="ACTIVITY",
            title="Tea Museum",
            day=2,
            start=ts("2026-12-06T14:00:00"),
            end=ts("2026-12-06T15:30:00"),
            place=PLACES_MUNNAR["TEA"],
            price_inr=400,
            price_provenance=PROV_TBO,
            refundable=True,
            priority="NICE",
            indoor=True,
        ),
        m.PlanItem(
            id="it_b_sp",
            type="ACTIVITY",
            title="Spice plantation + cooking class",
            day=3,
            start=ts("2026-12-07T09:30:00"),
            end=ts("2026-12-07T13:00:00"),
            place=PLACES_MUNNAR["SPI"],
            price_inr=1500,
            price_provenance=PROV_TBO,
            refundable=True,
            cancel_by=ts("2026-12-06T09:30:00"),
            priority="NICE",
            indoor=True,
        ),
        m.PlanItem(
            id="it_b_tf",
            type="ACTIVITY",
            title="Lockhart Tea Factory & Heritage Tour",
            day=4,
            start=ts("2026-12-08T15:00:00"),
            end=ts("2026-12-08T17:30:00"),
            place=PLACES_MUNNAR["LOC"],
            price_inr=1100,
            price_provenance=PROV_TBO,
            refundable=True,
            cancel_by=ts("2026-12-07T15:00:00"),
            priority="NICE",
            indoor=True,
        ),
        next(i for i in plan_a.items if i.id == "it_a_t2"),
        next(i for i in plan_a.items if i.id == "it_a_f2"),
    ]
    total_b = sum(i.price_inr for i in b_items)
    plan_b = m.Plan(
        id="plan_b1",
        trip_id="trip_golden",
        kind="B",
        version=1,
        items=b_items,
        total_cost_inr=total_b,
        summary="Rain-safe, delay-buffered standby Munnar plan keeping flights and hotel.",
        created_at=ts("2026-11-22T10:00:06"),
        validation=m.Validation(
            feasible=True,
            feasibility=0.96,
            min_slack_min=70,
            budget_headroom_inr=55000 - total_b,
            solver="ortools-cp-sat",
            solve_ms=380,
            checks=[
                m.ProofCheck(name="budget", passed=True, detail=f"₹{total_b:,} of ₹55,000"),
                m.ProofCheck(name="hard_connection:it_a_f1->it_b_t1", passed=True, detail="Flight ends 09:05, cab starts 11:30: 145 min buffer"),
                m.ProofCheck(name="no_night_ghat", passed=True, detail="Both ghat transfers end before 18:00"),
            ],
        ),
    )
    write_fixture("golden_plan_b.json", plan_b)

    # Golden Intent & Trip
    intent = m.TripIntent(
        origin="Bengaluru",
        destination="Munnar",
        start_date=date(2026, 12, 5),
        nights=4,
        travellers=2,
        budget_inr=55000,
        interests=["tea estates", "waterfalls", "sunsets"],
        constraints=["no night ghat driving"],
        pace="BALANCED",
        must_dos=["Eravikulam NP timed entry"],
        missing=[],
    )
    trip = m.Trip(
        id="trip_golden",
        title="Munnar Tea & Waterfalls (5 days)",
        status="BOOKED",
        intent=intent,
        active_plan="A",
        plan_a_id="plan_a1",
        plan_b_id="plan_b1",
        sim_now=ts("2026-12-05T04:40:00"),
        sim_window="T-3H",
        owner_id="usr_demo",
        created_at=ts("2026-11-22T10:00:00"),
    )
    write_fixture("golden_trip.json", trip)

    # Bookings & BookResult & Vouchers
    bookings = [
        m.Booking(
            id="bk_1", trip_id="trip_golden", plan_id="plan_a1", item_id="it_a_f1",
            status="CONFIRMED", supplier_ref="SIM-F-7721", amount_inr=8600,
            refundable=False, updated_at=ts("2026-11-22T10:05:00"),
        ),
        m.Booking(
            id="bk_2", trip_id="trip_golden", plan_id="plan_a1", item_id="it_a_t1",
            status="CONFIRMED", supplier_ref="SIM-C-4102", amount_inr=4300,
            refundable=True, updated_at=ts("2026-11-22T10:05:00"),
        ),
        m.Booking(
            id="bk_3", trip_id="trip_golden", plan_id="plan_a1", item_id="it_a_e1",
            status="CONFIRMED", supplier_ref="SIM-E-9012", amount_inr=1000,
            refundable=False, updated_at=ts("2026-11-22T10:05:00"),
        ),
        m.Booking(
            id="bk_4", trip_id="trip_golden", plan_id="plan_a1", item_id="it_a_h1",
            status="PENDING", supplier_ref=None, amount_inr=16000,
            refundable=True, updated_at=ts("2026-11-22T10:05:01"),
        ),
    ]
    write_fixture("golden_bookings.json", bookings)
    write_fixture(
        "golden_book_result.json",
        m.BookResult(
            status="PENDING",
            bookings=bookings,
            message="3 confirmed, 1 pending hotel confirmation.",
        ),
    )
    write_fixture(
        "golden_vouchers.json",
        [
            m.Voucher(booking_id="bk_1", title="Flight BLR→COK (sim)", reference="SIM-F-7721", html_url="/api/v1/vouchers/bk_1.html"),
            m.Voucher(booking_id="bk_2", title="Cab Kochi Airport → Munnar", reference="SIM-C-4102", html_url="/api/v1/vouchers/bk_2.html"),
            m.Voucher(booking_id="bk_3", title="Eravikulam NP timed entry", reference="SIM-E-9012", html_url="/api/v1/vouchers/bk_3.html"),
        ],
    )

    # Slack Scores (Baseline, Amber, Red)
    slack_base = m.SlackScore(
        trip_id="trip_golden",
        health="GREEN",
        score=94,
        components=m.SlackComponents(time_buffer=100, delay_risk=92, weather_risk=100, crowd_risk=85, budget_headroom=79),
        weakest_item_id="it_a_e1",
        explanation="Healthy buffer: tightest link is Eravikulam NP timed entry with +65 min slack (95% on-time probability).",
        computed_at=ts("2026-11-22T10:00:05"),
    )
    slack_amber = m.SlackScore(
        trip_id="trip_golden",
        health="AMBER",
        score=53,
        components=m.SlackComponents(time_buffer=17, delay_risk=58, weather_risk=100, crowd_risk=85, budget_headroom=79),
        weakest_item_id="it_a_e1",
        explanation="Tight buffer: Eravikulam NP timed entry drops to +10 min effective slack after 55 min flight delay (60% link probability).",
        computed_at=ts("2026-12-05T04:40:02"),
    )
    slack_red = m.SlackScore(
        trip_id="trip_golden",
        health="RED",
        score=33,
        components=m.SlackComponents(time_buffer=0, delay_risk=8, weather_risk=100, crowd_risk=85, budget_headroom=79),
        weakest_item_id="it_a_e1",
        explanation="Critical risk: Eravikulam NP timed entry is at -55 min effective slack after 120 min flight delay (8% link probability).",
        computed_at=ts("2026-12-05T04:45:00"),
    )
    write_fixture("golden_slack_baseline.json", slack_base)
    write_fixture("golden_slack_amber.json", slack_amber)
    write_fixture("golden_slack_red.json", slack_red)

    # TripDetail & TripSummary list
    write_fixture(
        "golden_trip_detail.json",
        m.TripDetail(
            trip=trip, plan_a=plan_a, plan_b=plan_b, bookings=bookings,
            slack=slack_amber, unread_alerts=2,
        ),
    )
    write_fixture(
        "golden_trips_list.json",
        [
            m.TripSummary(
                id="trip_golden", title=trip.title, status="BOOKED",
                health="AMBER", start_date=date(2026, 12, 5), total_cost_inr=46300,
            ),
            m.TripSummary(
                id="trip_g1", title="Coorg Group Retreat (4 friends)", status="PLANNED",
                health="GREEN", start_date=date(2026, 12, 12), total_cost_inr=36200,
            ),
        ],
    )

    # Signals & Alerts
    signals = [
        m.Signal(
            id="sg_10", trip_id="trip_golden", kind="WEATHER", item_id="it_a_wf",
            severity=1, summary="Day 3 rain outlook moderate for Lakkam trek",
            payload={"day": 3, "rain": "MODERATE"}, provenance=PROV_WEATHER,
        ),
        m.Signal(
            id="sg_12", trip_id="trip_golden", kind="FLIGHT_STATUS", item_id="it_a_f1",
            severity=2, summary="Flight BLR→COK delayed by 55 min",
            payload={"delay_min": 55, "flight_ref": "SIM-F-7721"}, provenance=PROV_FLIGHT,
        ),
    ]
    write_fixture("golden_signals.json", [m.SignalView(signal=s, used_in=["al_7", "sw_2"] if s.id == "sg_12" else ["al_3"]) for s in signals])

    alerts = [
        m.Alert(
            id="al_7", trip_id="trip_golden", level="ACTION_NEEDED", window="T-3H",
            title="Your flight is delayed 55 min",
            body="Eravikulam entry (last entry 15:45) is now at risk. Plan B recovers it with a MIXED switch (+₹1,800).",
            provenance=PROV_FLIGHT,
            recommended_action=m.ActionRef(action="SWITCH_PLAN", label="Review switch", params={"recommendation_id": "sw_2"}),
            state="NEW", created_at=ts("2026-12-05T04:40:02"),
        ),
        m.Alert(
            id="al_5", trip_id="trip_golden", level="NUDGE", window="T-24H",
            title="Web check-in is open",
            body="Check in for Flight BLR→COK (07:40 departure).",
            provenance=PROV_FLIGHT,
            recommended_action=m.ActionRef(action="CHECK_IN", label="Web check-in", params={"item_id": "it_a_f1"}),
            state="SEEN", created_at=ts("2026-12-04T07:40:00"),
        ),
        m.Alert(
            id="al_3", trip_id="trip_golden", level="NUDGE", window="T-72H",
            title="Day 3 rain outlook — Plan B is ready",
            body="Moderate rain forecast on Day 3 (Lakkam waterfall trek). Rain-safe Spice plantation standby is warmed.",
            provenance=PROV_WEATHER,
            recommended_action=m.ActionRef(action="VIEW", label="Compare Plan B", params={"plan": "B"}),
            state="SEEN", created_at=ts("2026-12-02T07:40:00"),
        ),
    ]
    write_fixture("golden_alerts.json", alerts)

    # SwitchRecommendation (MIXED) & Result & Drafts
    mixed_items = [
        next(i for i in plan_a.items if i.id == "it_a_f1"),
        next(i for i in plan_b.items if i.id == "it_b_t1"),
        next(i for i in plan_a.items if i.id == "it_a_h1").model_copy(update={"depends_on": ["it_b_t1"]}),
        next(i for i in plan_b.items if i.id == "it_b_e1"),
        next(i for i in plan_b.items if i.id == "it_b_tm"),
        next(i for i in plan_a.items if i.id == "it_a_wf"),
        next(i for i in plan_a.items if i.id == "it_a_ts"),
        next(i for i in plan_a.items if i.id == "it_a_t2"),
        next(i for i in plan_a.items if i.id == "it_a_f2"),
    ]
    mixed_total = sum(i.price_inr for i in mixed_items)
    resulting_plan = m.Plan(
        id="plan_a2",
        trip_id="trip_golden",
        kind="A",
        version=2,
        items=mixed_items,
        total_cost_inr=mixed_total,
        summary="MIXED recovery plan: afternoon/Day 2 from Plan B, rest of Plan A preserved.",
        created_at=ts("2026-12-05T04:40:02"),
        validation=m.Validation(
            feasible=True,
            feasibility=0.96,
            min_slack_min=70,
            budget_headroom_inr=55000 - mixed_total,
            solver="ortools-cp-sat",
            solve_ms=110,
            checks=[
                m.ProofCheck(name="budget", passed=True, detail=f"₹{mixed_total:,} of ₹55,000"),
                m.ProofCheck(name="no_night_ghat", passed=True, detail="Both ghat transfers end before 18:00"),
            ],
        ),
    )
    sw_rec = m.SwitchRecommendation(
        id="sw_2",
        trip_id="trip_golden",
        mode="MIXED",
        reason="Flight delay cuts Eravikulam slack to +10 min. MIXED keeps Days 3–5 from Plan A and moves Eravikulam to Day 2 morning.",
        feasibility_a=0.58,
        feasibility_b=0.96,
        slack_a_min=10,
        slack_b_min=70,
        delta_cost_inr=1800,
        lost_items=[m.LostItem(item_id="it_a_mb", title="Mattupetty Dam boating", priority="NICE")],
        kept_booking_item_ids=["it_a_f1", "it_a_h1", "it_a_t2", "it_a_f2"],
        changed_booking_item_ids=["it_a_t1", "it_a_e1"],
        resulting_plan=resulting_plan,
        sources=[PROV_FLIGHT, PROV_TBO],
        state="PROPOSED",
        created_at=ts("2026-12-05T04:40:02"),
    )
    write_fixture("golden_switch.json", sw_rec)

    drafts = [
        m.CourtesyDraft(
            id="dr_1", trip_id="trip_golden", recommendation_id="sw_2",
            recipient_kind="HOTEL", recipient_name="Tea Valley Resort",
            channel="EMAIL", language="en",
            subject="Updated arrival time — Ref SIM-H-101 (Tea Valley Resort)",
            body="Hello Tea Valley Resort team, our flight BLR→COK is delayed by 55 min. Our revised check-in ETA is 16:00 on 05 Dec (well before 20:00 cut-off). Please keep our 4-night reservation active.",
            state="DRAFT", created_at=ts("2026-12-05T04:40:03"),
        ),
        m.CourtesyDraft(
            id="dr_2", trip_id="trip_golden", recommendation_id="sw_2",
            recipient_kind="DRIVER", recipient_name="Munnar Cab Service",
            channel="WHATSAPP", language="en",
            body="Hi, flight BLR→COK is delayed 55 min. Please shift pickup at Kochi Airport (COK) from 09:50 to 11:30 on 05 Dec (arrival Munnar 16:00). Wait/reschedule fee ₹1,400 noted.",
            state="DRAFT", created_at=ts("2026-12-05T04:40:03"),
        ),
        m.CourtesyDraft(
            id="dr_3", trip_id="trip_golden", recommendation_id="sw_2",
            recipient_kind="VENDOR", recipient_name="Eravikulam NP Ticketing",
            channel="WHATSAPP", language="en",
            body="Requesting slot move for booking SIM-E-9012 from 05 Dec 15:00 to 06 Dec 09:00 due to 55 min flight delay. Rebooking fee ₹400 approved.",
            state="DRAFT", created_at=ts("2026-12-05T04:40:03"),
        ),
    ]
    write_fixture("golden_drafts.json", drafts)
    write_fixture(
        "golden_switch_result.json",
        m.SwitchResult(
            recommendation=sw_rec.model_copy(update={"state": "EXECUTED"}),
            trip=trip.model_copy(update={"plan_a_id": "plan_a2"}),
            plan_a=resulting_plan,
            plan_b=plan_b.model_copy(update={"version": 2}),
            bookings=bookings,
            drafts=[d.model_copy(update={"state": "SENT"}) for d in drafts],
            evidence_event_ids=["ev_9", "ev_10"],
        ),
    )

    # Live Status
    write_fixture(
        "golden_live.json",
        m.LiveStatus(
            trip_id="trip_golden",
            as_of=ts("2026-12-05T13:05:00"),
            location=m.Place(name="NH85 Neriamangalam Ghat Corridor", lat=10.0261, lng=76.9170),
            tracking_on=True,
            next_commitment=m.NextCommitment(
                item_id="it_a_e1",
                title="Eravikulam NP timed entry",
                arrive_by=ts("2026-12-05T15:45:00"),
                eta_min=95,
                slack_min=-10,
                health="RED",
            ),
            reroute_options=[
                m.RerouteOption(
                    id="ro_1",
                    mode="SHIFT_SLOT",
                    title="Move Eravikulam to Day 2, 09:00",
                    eta_min=None,
                    slack_min=720,
                    delta_cost_inr=400,
                    note="Rebooking fee ₹400; preserves Tea Museum at 14:00",
                    provenance=PROV_TBO,
                    action=m.ActionRef(action="SWITCH_PLAN", label="Switch", params={"recommendation_id": "sw_2"}),
                ),
                m.RerouteOption(
                    id="ro_2",
                    mode="USE_PLAN_B_SEGMENT",
                    title="Switch to Plan B Day 1–2 recovery segment",
                    eta_min=75,
                    slack_min=70,
                    delta_cost_inr=1800,
                    note="Uses Plan B Day 2 morning Eravikulam slot",
                    provenance=PROV_TRAFFIC,
                    action=m.ActionRef(action="SWITCH_PLAN", label="Review switch", params={"recommendation_id": "sw_2"}),
                ),
            ],
            geofence_prompt=None,
        ),
    )

    # Evidence Pack
    write_fixture(
        "golden_evidence.json",
        m.EvidencePack(
            trip_id="trip_golden",
            generated_at=ts("2026-12-05T05:00:00"),
            total_delay_min=55,
            extra_cost_inr=1800,
            events=[
                m.EvidenceEvent(
                    id="ev_1", trip_id="trip_golden", ts=ts("2026-11-22T10:05:00"),
                    kind="BOOKING", source="TBO Sandbox (sim)",
                    detail="Booked Plan A (3 confirmed: bk_1, bk_2, bk_3; 1 pending: bk_4).",
                    ref={"booking_ids": ["bk_1", "bk_2", "bk_3", "bk_4"]},
                ),
                m.EvidenceEvent(
                    id="ev_6", trip_id="trip_golden", ts=ts("2026-12-05T04:40:00"),
                    kind="SIGNAL", source="Flight status feed (sim)",
                    detail="Flight BLR→COK delayed by 55 min (new ETA 10:00).",
                    ref={"signal_id": "sg_12", "delay_min": 55},
                ),
                m.EvidenceEvent(
                    id="ev_9", trip_id="trip_golden", ts=ts("2026-12-05T04:42:00"),
                    kind="SWITCH", source="Wayfinder Switch Engine",
                    detail="Executed MIXED switch sw_2: Eravikulam moved to Day 2 09:00; kept flights & hotel.",
                    ref={"recommendation_id": "sw_2", "mode": "MIXED"},
                ),
                m.EvidenceEvent(
                    id="ev_10", trip_id="trip_golden", ts=ts("2026-12-05T04:42:05"),
                    kind="COST", source="TBO Sandbox (sim)",
                    detail="Reschedule costs recorded: ₹400 Eravikulam slot rebook + ₹1,400 cab driver wait.",
                    ref={"amount_inr": 1800},
                ),
            ],
            claim_sections=[
                m.ClaimSection(
                    type="AIRLINE",
                    summary="Recorded 55 min inbound delay on Flight BLR→COK (SIM-F-7721) at 2026-12-05T04:40:00+05:30 from Flight status feed (sim). Compensation or waiver eligibility depends on the operating airline's fare rules and carrier policy.",
                    amount_inr=None,
                    attachments=["bk_1", "sg_12"],
                ),
                m.ClaimSection(
                    type="INSURANCE",
                    summary="Documented ₹1,800 in downstream trip interruption/rescheduling expenses caused by the 55 min inbound flight delay.",
                    amount_inr=1800,
                    attachments=["bk_2", "bk_3", "sg_12"],
                ),
                m.ClaimSection(
                    type="SUPPLIER",
                    summary="Supplier modification ledger: Cab wait fee ₹1,400 (bk_2) and Eravikulam rebooking fee ₹400 (bk_3); ₹0 non-refundable loss on Mattupetty boating.",
                    amount_inr=1800,
                    attachments=["bk_2", "bk_3"],
                ),
            ],
        ),
    )

    # Optionality, Responsible, Rebalance, Swap
    write_fixture(
        "golden_optionality.json",
        m.OptionalityReport(
            trip_id="trip_golden",
            lines=[
                m.RiskLine(
                    item_id="it_a_t1",
                    disruption_prob=0.12,
                    expected_loss_inr=516,
                    flex_premium_inr=500,
                    recommended="FLEX",
                    reason="Disruption probability 12% gives expected loss ₹516 > flex premium ₹500.",
                ),
                m.RiskLine(
                    item_id="it_a_e1",
                    disruption_prob=0.32,
                    expected_loss_inr=320,
                    flex_premium_inr=250,
                    recommended="FLEX",
                    reason="Disruption probability 32% gives expected loss ₹320 > flex premium ₹250.",
                ),
                m.RiskLine(
                    item_id="it_a_t2",
                    disruption_prob=0.08,
                    expected_loss_inr=344,
                    flex_premium_inr=400,
                    recommended="SAVER",
                    reason="Disruption probability 8% gives expected loss ₹344 <= flex premium ₹400.",
                ),
            ],
            total_saver_inr=9600,
            total_saver_with_risk_inr=10780,
            total_flex_inr=10694,
            recommendation="Choose FLEX on Cab COK→Munnar and Eravikulam NP: expected risk-adjusted total is ₹10,694 vs ₹10,780 saver-with-risk.",
        ),
    )

    write_fixture(
        "golden_responsible.json",
        m.ResponsibleReport(
            trip_id="trip_golden",
            total_co2_kg=254.2,
            by_mode={"FLIGHT": 176.0, "TRANSFER": 76.2, "ACTIVITY": 2.0},
            method="EMISSION_FACTORS_V1 (illustrative DEFRA/ICAO-aligned draft)",
            insights=[
                m.ResponsibleInsight(
                    item_id="it_a_t2",
                    kind="CO2",
                    title="Lower-emission return transfer available",
                    detail="Switch Cab Munnar → Kochi Airport to Shared EV Shuttle to save 32.6 kg CO₂ and ₹1,100.",
                    alternative_offer_id="off_eco_t1",
                    co2_saving_kg=32.6,
                    delta_cost_inr=-1100,
                ),
                m.ResponsibleInsight(
                    item_id="it_a_ts",
                    kind="CROWD_RELIEF",
                    title="Avoid peak sunset crowds at Top Station",
                    detail="Chithirapuram Quiet Ridge Sunset Walk offers an offbeat ridge view with lower crowd pressure and saves ₹500.",
                    alternative_offer_id="it_b_ec",
                    co2_saving_kg=1.8,
                    delta_cost_inr=-500,
                ),
                m.ResponsibleInsight(
                    item_id="it_a_h1",
                    kind="LOCAL_ECONOMY",
                    title="Locally owned stay included",
                    detail="Tea Valley Resort supports local Munnar hospitality.",
                ),
                m.ResponsibleInsight(
                    item_id="it_a_ts",
                    kind="ECO_HERITAGE",
                    title="Eco-heritage alternative available",
                    detail="Lockhart Tea Factory & Heritage Tour pairs low-impact indoor heritage with local ownership.",
                    alternative_offer_id="it_b_tf",
                    co2_saving_kg=2.1,
                    delta_cost_inr=-300,
                ),
            ],
        ),
    )

    write_fixture(
        "golden_rebalance.json",
        m.RebalancePreview(
            plan_preview=plan_a.model_copy(update={"version": 2}),
            dropped=[m.LostItem(item_id="it_a_mb", title="Mattupetty Dam boating", priority="NICE")],
            shortened=["it_a_tm"],
            summary="Absorbed 75 min delay by shortening Tea Museum (15 min) and dropping Mattupetty Dam boating (NICE); all MUST items protected.",
            applied=False,
        ),
    )

    swapped_items = [
        (i if i.id != "it_a_t2" else m.PlanItem(
            id="off_eco_t1", type="TRANSFER", title="Shared EV Shuttle Munnar → Kochi Airport",
            day=5, start=ts("2026-12-09T09:30:00"), end=ts("2026-12-09T14:15:00"),
            origin=PLACES_MUNNAR["MUN"], place=PLACES_MUNNAR["COK"], price_inr=3200,
            price_provenance=PROV_TBO, refundable=True, cancel_by=ts("2026-12-08T09:30:00"),
            priority="MUST", risk_tags=["GHAT_ROAD"], co2_kg=5.5,
        ))
        for i in plan_a.items
    ]
    write_fixture(
        "golden_swap.json",
        m.SwapPreview(
            plan_preview=plan_a.model_copy(update={"version": 2, "items": swapped_items, "total_cost_inr": 45200}),
            delta_cost_inr=-1100,
            delta_co2_kg=-32.6,
            lost_items=[],
            changed_booking_item_ids=["it_a_t2"],
            summary="Swapped Cab Munnar → Kochi Airport for Shared EV Shuttle (-₹1,100, -32.6 kg CO₂).",
            applied=False,
        ),
    )

    # Chat responses
    write_fixture(
        "golden_chat_planned.json",
        m.ChatResponse(
            trip_id="trip_golden",
            stage="PLANNED",
            assistant_message="Here is a Munnar plan for 2 on ₹46,300 with ₹8,700 to spare. Your tightest link is the cab to Eravikulam (65 min of slack). A rain-safe Plan B is stored.",
            intent=intent,
            quick_replies=["Book Plan A", "Make it cheaper", "More relaxed"],
            destination_options=[],
            plan_a=plan_a,
            plan_b=plan_b,
            proposed_action=None,
        ),
    )
    write_fixture(
        "golden_chat_clarifying.json",
        m.ChatResponse(
            trip_id="trip_draft_1",
            stage="CLARIFYING",
            assistant_message="I can help plan that! Where are you travelling from, and what is your approximate total budget in INR?",
            intent=m.TripIntent(missing=["origin", "budget_inr", "nights", "travellers", "start_date"]),
            quick_replies=["From Bengaluru, ₹55,000", "From Mumbai, ₹70,000"],
            destination_options=[],
        ),
    )
    write_fixture(
        "golden_chat_recommending.json",
        m.ChatResponse(
            trip_id="trip_draft_2",
            stage="RECOMMENDING",
            assistant_message="Here are 3 destinations matching your preferences. Munnar is ready with live prototype inventory.",
            intent=m.TripIntent(
                origin="Bengaluru", start_date=date(2026, 12, 5), nights=4, travellers=2,
                budget_inr=55000, interests=["tea estates", "waterfalls", "sunsets"], missing=[],
            ),
            quick_replies=["Plan Munnar"],
            destination_options=[
                m.DestinationOption(name="Munnar", why="Tea estates, waterfalls, and cool December sunsets within ₹46,300.", est_budget_inr=46300, available=True),
                m.DestinationOption(name="Coorg", why="Coffee estates and misty hills 6h from Bengaluru.", est_budget_inr=38000, available=True),
                m.DestinationOption(name="Wayanad", why="Forest waterfalls and wildlife sanctuaries.", est_budget_inr=42000, available=False),
            ],
        ),
    )

    # Group fixtures (S-G)
    members = [
        m.GroupMember(user_id="usr_g1", name="Asha", role="OWNER", location_sharing=True, joined_at=ts("2026-11-22T09:00:00")),
        m.GroupMember(user_id="usr_g2", name="Bikram", role="MEMBER", location_sharing=True, joined_at=ts("2026-11-22T09:05:00")),
        m.GroupMember(user_id="usr_g3", name="Charu", role="MEMBER", location_sharing=True, joined_at=ts("2026-11-22T09:10:00")),
        m.GroupMember(user_id="usr_g4", name="Dev", role="MEMBER", location_sharing=False, joined_at=ts("2026-11-22T09:15:00")),
    ]
    write_fixture(
        "group_detail.json",
        m.Group(id="grp_1", trip_id="trip_g1", invite_code="COORG4WF", members=members, created_at=ts("2026-11-22T09:00:00")),
    )
    write_fixture(
        "group_merged_prefs.json",
        m.MergedPreferences(
            merged_intent=m.TripIntent(
                origin="Bengaluru", destination="Coorg", start_date=date(2026, 12, 12),
                nights=3, travellers=4, budget_inr=48000,
                interests=["coffee", "waterfalls", "adventure", "sunsets"],
                constraints=["vegetarian", "no night ghat driving"],
                pace="RELAXED",
                must_dos=["Organic Coffee Estate & Vegetarian Sadhya"],
                missing=[],
            ),
            conflicts=[
                m.PrefConflict(
                    field="budget_inr",
                    values={"usr_g1": 16000, "usr_g2": 20000, "usr_g3": 12000, "usr_g4": 18000},
                    resolution="Used minimum per-person budget ₹12,000 × 4 = ₹48,000 total so nobody is priced out.",
                ),
                m.PrefConflict(
                    field="constraints",
                    values={"usr_g2": ["vegetarian"], "usr_g1": ["no night ghat driving"]},
                    resolution="Combined all hard constraints (union): vegetarian, no night ghat driving.",
                ),
                m.PrefConflict(
                    field="pace",
                    values={"usr_g1": "BALANCED", "usr_g2": "RELAXED", "usr_g3": "PACKED", "usr_g4": "BALANCED"},
                    resolution="Selected most conservative pace: RELAXED.",
                ),
            ],
        ),
    )
    write_fixture(
        "group_votes.json",
        m.VoteTally(
            trip_id="trip_g1",
            votes={"usr_g1": "A", "usr_g2": "A", "usr_g3": "B", "usr_g4": "A"},
            counts={"A": 3, "B": 1, "NEITHER": 0},
            leader="A",
            decided=True,
        ),
    )
    write_fixture(
        "group_split_equal.json",
        m.SplitReport(
            trip_id="trip_g1",
            method="EQUAL",
            total_inr=46301,
            shares=[
                m.CostSplit(member_id="usr_g1", name="Asha", share_inr=11576),
                m.CostSplit(member_id="usr_g2", name="Bikram", share_inr=11575),
                m.CostSplit(member_id="usr_g3", name="Charu", share_inr=11575),
                m.CostSplit(member_id="usr_g4", name="Dev", share_inr=11575),
            ],
        ),
    )
    write_fixture(
        "group_split_budget.json",
        m.SplitReport(
            trip_id="trip_g1",
            method="BY_BUDGET",
            total_inr=46301,
            shares=[
                m.CostSplit(member_id="usr_g1", name="Asha", share_inr=11225),
                m.CostSplit(member_id="usr_g2", name="Bikram", share_inr=14031),
                m.CostSplit(member_id="usr_g3", name="Charu", share_inr=8418),
                m.CostSplit(member_id="usr_g4", name="Dev", share_inr=12627),
            ],
        ),
    )
    write_fixture(
        "group_regroup.json",
        m.RegroupSuggestion(
            reason="Charu (usr_g3) ETA gap exceeds 20 min (38 min behind group).",
            point=m.Place(name="Mercara Coffee Estate, Coorg", lat=12.4080, lng=75.7220),
            meet_by=ts("2026-12-13T10:15:00"),
            member_etas_min={"usr_g1": 12, "usr_g2": 15, "usr_g3": 50},
            affected_user_ids=["usr_g3"],
        ),
    )

    # Advisor fixtures (S-A)
    write_fixture(
        "advisor_trips.json",
        [
            m.AdvisorTripRow(trip_id="trip_adv_1", traveller_name="Rohan Mehta", title="Munnar Monsoon Escape", status="ACTIVE", health="RED", score=34, next_risk="Flight delayed 110 min; check-in cut-off", unread_alerts=3, start_date=date(2026, 12, 5), has_consent=True),
            m.AdvisorTripRow(trip_id="trip_golden", traveller_name="Asha Rao", title="Munnar Tea & Waterfalls (5 days)", status="BOOKED", health="AMBER", score=53, next_risk="Eravikulam timed entry (+10 min slack)", unread_alerts=2, start_date=date(2026, 12, 5), has_consent=True),
            m.AdvisorTripRow(trip_id="trip_adv_3", traveller_name="Neha Kapoor", title="Goa Family Retreat", status="BOOKED", health="AMBER", score=64, next_risk="Day 2 heavy rain outlook", unread_alerts=1, start_date=date(2026, 12, 12), has_consent=False),
            m.AdvisorTripRow(trip_id="trip_adv_4", traveller_name="Karan Verma", title="Hampi Heritage Weekend", status="PLANNED", health="GREEN", score=88, next_risk=None, unread_alerts=0, start_date=date(2026, 12, 12), has_consent=False),
            m.AdvisorTripRow(trip_id="trip_adv_5", traveller_name="Priya Nair", title="Coorg Group Retreat", status="BOOKED", health="GREEN", score=91, next_risk=None, unread_alerts=0, start_date=date(2026, 12, 12), has_consent=True),
            m.AdvisorTripRow(trip_id="trip_adv_6", traveller_name="Vikram Joshi", title="Kerala 3-City Circuit", status="PLANNED", health="GREEN", score=93, next_risk=None, unread_alerts=0, start_date=date(2026, 12, 5), has_consent=True),
        ],
    )
    write_fixture(
        "advisor_notes.json",
        [
            m.AdvisorNote(
                id="an_1", trip_id="trip_golden", advisor_id="usr_advisor",
                body="Spoke with Asha; traveller prefers keeping Tea Valley Resort and moving Eravikulam to Day 2.",
                created_at=ts("2026-12-05T04:41:00"),
            ),
        ],
    )

    # Auth, Me, Safety, Offline, SSE
    demo_user = m.User(id="usr_demo", email="traveller@demo.wf", name="Asha", role="TRAVELLER", language="en")
    write_fixture("auth_user.json", demo_user)
    write_fixture(
        "auth_token.json",
        m.TokenResponse(access_token="demo-fixture-jwt-token", token_type="bearer", expires_in=3600, user=demo_user),
    )
    write_fixture(
        "me_preferences.json",
        m.NotificationPrefs(
            user_id="usr_demo",
            channels=["IN_APP", "WHATSAPP", "EMAIL"],
            whatsapp_number="+919800000000",
            quiet_hours_start="22:00",
            quiet_hours_end="07:00",
            sensitivity="NORMAL",
            language="en",
        ),
    )
    write_fixture(
        "safety_contacts.json",
        [
            m.TrustedContact(id="tc_1", trip_id="trip_golden", name="Meera Rao", phone="+919811112222", email="meera@example.com"),
        ],
    )
    write_fixture(
        "safety_checkin.json",
        m.SafeCheckin(id="sc_1", trip_id="trip_golden", item_id="it_a_h1", due_at=ts("2026-12-05T20:00:00"), state="PENDING"),
    )
    write_fixture(
        "safety_share_link.json",
        m.ShareLink(token="shr_demo_128bit_token_fixture", url="/share/shr_demo_128bit_token_fixture", expires_at=ts("2026-12-10T20:00:00"), active=True),
    )
    write_fixture(
        "safety_shared_view.json",
        m.SharedTripView(
            title="Munnar Tea & Waterfalls (5 days)",
            health="AMBER",
            next_stop="Tea Valley Resort, Munnar",
            eta=ts("2026-12-05T16:00:00"),
            last_location_name="NH85 Neriamangalam Ghat Corridor",
            as_of=ts("2026-12-05T13:05:00"),
        ),
    )
    write_fixture(
        "offline_manifest.json",
        m.OfflineManifest(
            trip_id="trip_golden",
            version=7,
            generated_at=ts("2026-12-04T20:00:00"),
            expires_at=ts("2026-12-10T00:00:00"),
            resources=[
                m.OfflineResource(url="/api/v1/trips/trip_golden/offline-pack", kind="ITINERARY", bytes=48211),
                m.OfflineResource(url="/api/v1/vouchers/bk_1.html", kind="VOUCHER", bytes=5120),
                m.OfflineResource(url="/maps/south-india.pmtiles", kind="MAP", bytes=12582912),
            ],
        ),
    )
    write_fixture(
        "sse_events.json",
        [
            {"event": "sim.clock", "data": {"trip_id": "trip_golden", "ts": "2026-12-05T04:40:00+05:30", "data": {"window": "T-3H", "sim_now": "2026-12-05T04:40:00+05:30"}}},
            {"event": "signal.created", "data": {"trip_id": "trip_golden", "ts": "2026-12-05T04:40:01+05:30", "data": json.loads(signals[1].model_dump_json())}},
            {"event": "slack.updated", "data": {"trip_id": "trip_golden", "ts": "2026-12-05T04:40:02+05:30", "data": json.loads(slack_amber.model_dump_json())}},
            {"event": "alert.created", "data": {"trip_id": "trip_golden", "ts": "2026-12-05T04:40:02+05:30", "data": json.loads(alerts[0].model_dump_json())}},
            {"event": "draft.created", "data": {"trip_id": "trip_golden", "ts": "2026-12-05T04:40:03+05:30", "data": json.loads(drafts[0].model_dump_json())}},
            {"event": "switch.proposed", "data": {"trip_id": "trip_golden", "ts": "2026-12-05T04:40:03+05:30", "data": json.loads(sw_rec.model_dump_json())}},
        ],
    )
    print(f"Generated and validated fixtures in {FIXTURES.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
