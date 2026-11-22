# WAYFINDER ONE — Person 3: Contracts, Engine, Agent & Integration
**VoyageHack 4.0 · TBO · Problem Statement 3: Virtual Travel Agent / Travel Agent Copilot**
**Your role: Person 3, Contract keeper, Solver/Engine, LangGraph agent, Integration, CI and Delivery**

> **How to use this file.** Part A is *your* work packet. Part B is the shared reference and is **identical in all three team files** (feature catalogue, contracts, file ownership, phases, merge rules, acceptance checklist). If Part B ever differs between files, the copy in `main` (`docs/` + `contracts/`) wins; ask P3.
> **Read first:** A3 (phase tasks; the contracts deliverable is due first), A6 (engine math), A7 (agent), then B6 and B9.
> **Status:** this is a plan plus a starter repo (`wayfinder-one/`: folder structure, `docker-compose`, `Makefile`, the contract models with generated TypeScript types, one validated golden fixture, and a contract test). Those pieces were import-checked, type-checked and run. Nothing else has been built; every other acceptance check is a *planned check* until someone runs it and ticks it in B11.

## Team at a glance
| | Person 1 | Person 2 | Person 3 |
|---|---|---|---|
| **Role** | Frontend and UX (Next.js PWA) | Backend, data, supplier + provider layers, workers, notifications, security | Contracts, solver/engine, agent, integration, CI and delivery |
| **Owns** | `frontend/` | `backend/`, `docker-compose*.yml`, `deploy/` | `contracts/`, `engine/`, `agent/`, `tests/`, `docs/`, `scripts/`, `.github/`, `README.md`, `Makefile` |
| **Assigned to** | ____________ | ____________ | ____________ |

> **Why this split differs from the generic template:** WAYFINDER ONE's hard part is the solver, Switch Engine and agent, not CRUD. Putting them with the contract keeper (P3) as *pure libraries* keeps P2's backend a testable orchestrator and lets P3 work with zero dependency on the other two after Phase 0. P2 owns `docker-compose` because it owns the database and workers.

**Phases at a glance (about 6 weeks; keep the order, scale the time):** 0 Foundations → 1 Core slice (chat→plan→book) → 2 Guardian (pulse, slack, real signals) → 3 Twin Plans and recovery (switch, courtesy, time banking, live, evidence) → 4 People and channels (groups, advisor, notifications) → 5 Reach and responsibility (WhatsApp, Hinglish, voice, offline, SOS, green, multi-city) → 6 Hardening and delivery. Every phase ends with a gate (B8/B11). **Everything in the feature catalogue (B2, F1–F22) ships working end to end; nothing is cut.**

**Contents.** Part A (A1 goal · A2 files · A3 tasks by phase · A4 inputs/outputs · specs · dependencies). Part B (B1 assumptions · B2 journeys and feature catalogue · B3 architecture · B4 file tree · B5 golden and secondary scenarios · B6 contracts · B7 connection map · B8 phases and matrices · B9 merge plan · B10 setup · B11 acceptance · B12 risks).

---

# PART A — YOUR WORK PACKET

## A1. Goal and definition of done

**Goal.** Own the *intelligence* and the *glue*: the contracts everyone codes against, the solver and engine (Slack, Switch, Time Banking, Optionality, Group, Responsible, Live, Evidence), the LangGraph agent in three languages, the Local Pulse classifier, and the integration, tests, CI and docs that turn three branches into one product.

**Done when:** AC-02, 03, 08..11, 13, 14, 17, 20, 22, 24, 25, 28 (logic), 32 (agent side), 33, 34 (eval side), 37, 38, 42, 43 pass; `make golden` (golden + all secondary scenarios) is green; CI runs lint, unit, contract, golden, backend, e2e, security scans on every PR; README, ARCHITECTURE, SECURITY, TEST_PLAN, DEMO_SCRIPT and AI_TOOLS_USED are written.

**You are the contract keeper, not the bottleneck.** The first deliverable (contracts + generated types + fixtures + stubs) unblocks both teammates. After that your engine/agent work is pure Python and needs neither backend nor frontend. **There are no cut lines in this plan:** if a phase slips, say so at once, re-order *within* the phase, and ask P2 (lighter after Phase 3) to take well-defined pieces (PDF layout, docs scripts); do not drop a feature.

## A2. Files you own and files you must not touch

| You own (edit freely) | Do not edit (file a CR to the owner) |
|---|---|
| `contracts/*`, `engine/*`, `agent/*`, `tests/*` (contract, e2e, load), `scripts/*` | `backend/*` (P2) incl. DB schema, migrations, `main.py`, seeds |
| `README.md`, `Makefile`, `.env.example` (structure; each person edits only their own block), `requirements-engine.txt`, `docs/*`, `.github/workflows/*` | `frontend/*` (P1) |
| `contracts/fixtures/inventory_*.json`, `golden_*.json`, `group_*.json`, `advisor_*.json` (P1/P2 read-only) | `docker-compose*.yml`, `deploy/*` (P2) |

## A3. Tasks by phase

| Phase | Tasks | Output / gate |
|---|---|---|
| **0 Foundations** (days 1–3) | Repo skeleton, branches, protection rules, `Makefile`, `.env.example` (3 blocks), CI skeleton (lint, contract, unit); **`contracts/models.py`** (B6.1 + B6.1b + internal models in A4); `scripts/gen_types.py` → `types.ts`; `errors.md`; **fixtures for every endpoint and SSE event**, `golden_plan_a/b.json`, `golden_switch.json`, `golden_alerts.json`, `golden_slack_{baseline,amber,red}.json`, `golden_evidence.json`, `golden_live.json`, `group_*.json`, `advisor_*.json`, `inventory_kerala.json`; `engine/stubs.py`; `tests/contract`. Tag `contracts-v1` | **Hard deadline (first deliverable).** AC-01, 20 |
| **1 Core slice** (week 1) | `engine/config.py`, `geo.py`, `validator.py`, `planner.py` (CP-SAT Plan A + Plan B v1); `agent/`: mock LLM path, then Gemini, then guards, destination recommendation; inventory for Munnar; golden test v1 | AC-02, 03 |
| **2 Guardian** (week 2) | `slack.py` (feasibility + score); `agent/i18n.py` (en/hi/hinglish templates for alerts and notifications, with placeholders); `agent/localpulse_classifier.py` + `engine/localpulse_rules.py` + labelled sample set (≥ 60 news items); golden tests for slack bands | AC-08, 22 |
| **3 Twin Plans and recovery** (week 3) | `switch.py` (FULL + MIXED), `timebank.py`, `agent/courtesy.py`, `optionality.py`, `live.py`, `evidence.py`, `planner.swap_item`, Plan-B diversity tuning; remove `stubs.py` from every call path with P2; golden test v2 | AC-09..14, 24, 25 |
| **4 People and channels** (week 4) | `group.py` (merge, tally, split, regroup) + tests incl. rounding property tests; audience rules for alerts (which members an event affects); courtesy drafts per recipient/channel; e2e specs for owner vs member vs advisor | AC-28, 29 (logic) |
| **5 Reach and responsibility** (week 5) | WhatsApp channel behaviour in the agent (status, two-step approval phrasing, expiry); Hinglish/Hindi quality pass; `responsible.py` (emission factors table + insights); `multicity.py` + inventories for Coorg, Hampi, Goa, Kerala circuit; secondary scenario golden tests (S-G, S-R, S-M, S-O2); `scripts/make_pmtiles.sh` + `make maps` (extract the Kerala/Karnataka/Goa region from the free Protomaps build with the `pmtiles` CLI, output to `frontend/public/maps/`, git-ignored) | AC-32..34, 37, 38 |
| **6 Hardening and delivery** (week 6) | LLM eval harness and run (A7); load tests (`tests/load`); full e2e suite incl. axe; `docs/SECURITY.md`, `TEST_PLAN.md`, `ARCHITECTURE.md`, `README`, `DEMO_SCRIPT.md` (4-minute timed script + backup plan), `AI_TOOLS_USED.md` (one line each from P1, P2); CI gates; release tag `v1.0.0`; backup video state script | AC-39..44, all |

**Order inside a phase may change; the gate may not.** If the golden test is red, nothing merges.

## A4. Internal models you maintain in `contracts/models.py`

The starter repo already contains `Offer`, `Inventory`, `PlanPair`, `AgentState`, `AgentTurn`, `PriceCheck`, `SupplierBooking`, `CancelOutcome`, `FlightStatus`. You add, in Phase 0 (they are referenced by B6/A6 signatures): `NewsItem(id, title, summary, url, source, published_at, lang)`, `LocalEvent(kind: BANDH|STRIKE|FESTIVAL|LANDSLIDE|ROAD_RESTRICTION|VIP_MOVEMENT|CROWD_PEAK|NONE, location_text, destination, start, end, confidence, source_url)`, `VoteRequestRow(user_id, plan_id, vote)`. Then run `make gen-types`.

## A5. Library interfaces (frozen with the contract; P2 calls these)

Signatures are in the P2 packet A6. Rules for all engine functions: **pure** (no DB, no network, no wall-clock; `now` is passed in), deterministic (CP-SAT `num_workers=1`, `random_seed=7`), return Pydantic models from `contracts.models`, raise `engine.errors.Infeasible(message, suggestion)` only from the planner.


Additional pure functions (signatures in the P2 packet A6): `timebank.rebalance`, `planner.swap_item`, `optionality.report`, `responsible.report`, `group.merge_preferences`, `group.tally_votes`, `group.split_cost`, `group.regroup`. The same purity rules apply (no DB, no network, no wall-clock; `eta_fn` is injected).
## A6. Engine specification

**Time model.** Minutes since trip start for solving; convert back to `+05:30` datetimes. `geo.travel_min(a, b, mode)` = `10 + haversine_km × 1.35 / speed_kmh` with speeds DRIVE 40, DRIVE_GHAT 28, WALK 5, METRO 30. `ETA_PROVIDER=osrm` swaps in an HTTP router via the optional `eta_fn`.

**Planner (OR-Tools CP-SAT).**
- Variables: optional interval per candidate activity per day; start-time integers; selection booleans for cab/hotel offers.
- Hard constraints: budget cap (`Σ price ≤ intent.budget_inr`); daily window 08:00–19:30; no overlap (with travel gaps from `geo`); fixed items at `fixed_start`; hard deadlines with a **30-min minimum buffer**; hotel check-in cut-off; max activities/day by pace (RELAXED 2, BALANCED 3, PACKED 4); `no night ghat` constraint: a GHAT_ROAD transfer must end before 18:00; must-dos included.
- Objective: maximise `Σ priority_weight × rating × selected − 0.002 × cost` with weights MUST 10, NICE 4, SKIP_IF_NEEDED 1; ties broken by earlier finish.
- Infeasible → `Infeasible` with the *binding* constraint named and a suggestion ("raise budget by ₹X or drop the Top Station sunset").
- `Validation.checks` lists human-readable proofs: budget, each hard connection with its slack, daily hours, night-ghat rule, refundability coverage. The LLM may only restate these.
- Time limit 5s; if hit with a feasible incumbent, return it and note it in `Validation`.

**Plan B generator (same solver, extra constraints).** Different where it matters: (1) forbid RAIN-tagged items unless indoor, (2) transfers start ≥ 90 min later than Plan A **or** use a different mode, (3) at least 3 items differ from Plan A, (4) keep flights and hotel identical (preserve commitments), (5) bonus for refundable components (so keeping B warm costs ~nothing), (6) must still satisfy all of Plan A's hard constraints. `regenerate_plan_b` re-solves after any Plan A change.

**Feasibility (per plan).**
`feasibility = Π_over_hard_links P_link × budget_fit × constraint_sat`
- Hard links = every item with `fixed` or `hard_deadline` that depends on an upstream chain (flight → cab → timed ticket; cab → flight home; hotel cut-off).
- `scheduled_slack = deadline − (predecessor_end + transit/overhead)`; `effective_slack = scheduled_slack − μ`, where μ = known delays on the chain (flight delay, traffic jam) + weather uplift (RAIN on ghat transfer +15 min, HEAVY +30) + bandh on that day +60.
- `σ_link = sqrt(Σ σ_leg²)` with σ: flight 25, plain transfer 20, ghat transfer 30, activity 10.
- `P_link = Φ(effective_slack / σ_link)` (normal CDF). Independence assumed (state it in `ARCHITECTURE.md`).
- `budget_fit = 1` if within budget else `max(0, 1 − overshoot / budget)`; `constraint_sat = 1`, or `0.8` per violated *soft* preference.

**Slack Score (0–100, higher = safer).**
`time_buffer = clamp(100 × min_effective_slack / 60)`; `delay_risk = 100 × Π P_link`; `weather_risk = 100 − 25 × rain_hits (HEAVY counts double)`; `crowd_risk = 100 − 15 × CROWD items − 30 × bandh days`; `budget_headroom = clamp(100 × headroom / (0.2 × budget))`.
`score = 0.40 tb + 0.25 dr + 0.15 w + 0.10 c + 0.10 b`. **GREEN ≥ 75, AMBER 45–74, RED < 45.** `weakest_item_id` = item with lowest `P_link`; `explanation` is templated from numbers (not LLM).

**Worked sanity check (use it to tune `config.py`).** Baseline: Eravikulam last entry 15:45, cab ends 14:20, +20 min overhead → slack 65, σ = √(25²+30²) ≈ 39, P ≈ 0.95; with other links feasibility ≈ 0.92, score ≈ 94 (GREEN). `FLIGHT_DELAY 55`: effective slack 10, P ≈ 0.60, score ≈ 53 (AMBER). `FLIGHT_DELAY 120`: slack −55, P ≈ 0.08, score ≈ 33 (RED). Plan B under the 55-min delay: cab starts ≥ 90 min later, slack ≈ 120, feasibility ≈ 0.97.

**Switch Engine (`engine.switch.evaluate`).**
- **Trigger:** `min effective_slack(A) < 20` on any hard link **or** `feasibility(A) < feasibility(B) − 0.10`. Otherwise return `None`.
- **Candidates:** FULL (Plan B) and MIXED. MIXED algorithm: (1) affected items = those on a link with `P_link < 0.9`, plus everything after the first failing item that day; (2) replace each with Plan B's counterpart (same day, same type, overlapping window) or B-only items on that day, keeping every unaffected A item; (3) re-validate the merged plan with `validator` (re-solve ordering with fixed items pinned); infeasible → drop MIXED.
- **Choice:** among candidates with `feasibility ≥ 0.90`, minimise lost value (`MUST 5, NICE 2, SKIP 1` per lost item), then cost; if none ≥ 0.90 pick the highest feasibility and say so in `reason`.
- **Commitment-preserving output:** `kept_booking_item_ids` (identical item in both and already booked), `changed_booking_item_ids`, `lost_items`, `delta_cost_inr = Σ new − Σ removed refunds + rebook fees` (golden: ₹400 ticket rebook + ₹1,400 driver wait = **₹1,800**), `resulting_plan` (kind "A", version + 1).
- The engine never executes anything; it only recommends.

**Time Banking (`timebank.rebalance`).** Given lost minutes at a point, re-solve the remainder of that day: protect MUST, shorten dwell up to 25%, drop SKIP_IF_NEEDED then lowest-value NICE, re-sequence to cut travel. Used by MIXED and by live `RESHUFFLE_DAY`.

**Live reroute (`engine.live.reroute`).** Next commitment = earliest unstarted item that is booked/fixed/has a deadline. `eta` from `eta_fn` or `geo`; `slack = arrive_by − (now + eta)`. Options, only those that improve slack or protect a MUST: faster mode/route; `SHIFT_SLOT` (uses `rebook_fee_inr`); `USE_PLAN_B_SEGMENT`; `RESHUFFLE_DAY` (timebank). Sorted by (slack ≥ 0 first, lower cost). Geofence: ≤ 300 m from hotel → `ARRIVED_HOTEL`; > 5 km from the planned corridor → `OFF_ROUTE`. Every option carries `Provenance`.

**Evidence (`engine.evidence.build_pack`).** `total_delay_min` = max delay in FLIGHT_STATUS signals; `extra_cost_inr` = Σ COST events. Claim sections: `AIRLINE` (delay documentation with source and timestamps; **do not assert eligibility**, state that it depends on the airline's policy), `INSURANCE` (when extra cost > 0), `SUPPLIER` (rebooking fee / refunds). Attachments reference booking and signal ids.


**Multi-city planner (`multicity.py`).** Intent may name several places or the agent may propose a circuit (Kochi → Munnar → Alleppey). Order cities by brute force (≤ 4 stops) on total transfer time; split nights proportionally to the number of must-do/high-value activities per city (min 1 night); inter-city transfers are `TRANSFER` offers with `origin`/`place` names; hard constraints and the night-ghat rule apply per leg; Plan B must differ in at least one inter-city transfer time or mode and in the activities.

**Time Banking (`timebank.rebalance`, extended).** Input `lost_min` at `from_item_id`; protect MUST; shorten dwell up to 25 %; drop SKIP_IF_NEEDED then lowest-value NICE; re-sequence to reduce travel; output `RebalancePreview` with `dropped`, `shortened` (item ids), a one-line `summary` built from numbers, and the preview plan (version+1, not saved).

**Swap (`planner.swap_item`).** Replace one item with an `Offer` (same slot or nearest feasible), re-solve ordering of that day with all other items pinned, re-validate the whole plan; return `SwapPreview` (cost delta, CO₂ delta, lost items, bookings that would change). Infeasible → `Infeasible` with the binding constraint.

**Optionality (`optionality.report`).** For each bookable item *i* with price `p`:
- Disruption probability `q = 1 − P_link(i) × (1 − w_i)`; `P_link` from the feasibility model; `w_i` = weather/strike risk for that day (RAIN-tagged item: baseline 0.05; MODERATE rain signal 0.25; HEAVY 0.5; bandh on that day 0.6 for GHAT/CROWD items).
- Saver (non-refundable) expected loss = `q × (p − recoverable)` with `recoverable = 0`; Flex expected loss = `q × rebook_fee_inr` (0 if free change).
- Recommend `FLEX` iff `expected_loss_saver > flex_premium_inr`, else `SAVER`; `reason` is templated from the numbers.
- Totals: `total_saver_inr = Σ p`; `total_saver_with_risk_inr = Σ p + Σ expected_loss_saver`; `total_flex_inr = Σ p + Σ flex_premium (recommended FLEX only) + Σ residual expected loss`. Recommendation sentence compares the two totals.
- Booking itself still goes through P2; the report only informs the choice (never auto-selects).

**Group (`group.py`).**
- *Merge:* budget → per-person budget = **minimum** of members' budgets (× member count for the trip total); constraints → **union** (they are hard: vegetarian, accessibility, "no trekking"); interests → ranked by how many members share them, ties alternated; pace → the **most conservative**; must-dos → union (if the solver cannot fit them all, report which one was dropped and why). Each differing field yields a `PrefConflict` with a plain resolution sentence.
- *Votes:* majority of members for one plan (`⌊n/2⌋+1`) decides; with a tie the owner's vote decides; `decided` also true when everyone voted. 
- *Split:* `EQUAL` = `total // n` each, remaining rupees (`total mod n`) given one each to members sorted by `user_id` (largest-remainder); `BY_BUDGET` = proportional to stated budgets with largest-remainder rounding. **Invariant: shares sum exactly to the plan total** (property test with random totals and member counts).
- *Regroup:* given latest positions of members who share location, if the largest ETA gap to the next common item exceeds 20 min, propose the common item's place (or the last common stop) as the meeting point, `meet_by = max(now + max_eta + 10, item_start − 15 min)`, and list affected members.
- *Audience:* `engine.group.affected_members(plan, signal)` returns users whose items a signal touches (used by P2 to set `Alert.audience_user_ids`).

**Responsible Travel (`responsible.py`).**
- CO₂ per item = `factor[mode] × distance_km × (1 / occupancy for cars)`; **factors are a versioned table in `engine/config.py` (`EMISSION_FACTORS_V1`) with a `method` string shown in the UI.** Start with clearly labelled illustrative factors (domestic flight ≈ 0.15 kg/pax-km, taxi/car ≈ 0.19 kg/vehicle-km ÷ occupants, bus ≈ 0.05, train ≈ 0.04) and replace them with a cited source (e.g. DEFRA/ICAO methodology) before the final demo; never present them as precise.
- Insights: `CO2` (largest-emitter item and a lower-emission alternative if one exists in inventory), `CROWD_RELIEF` (CROWD-tagged item at peak → earlier slot or an `offbeat`-tagged offer with overlapping interest tags), `LOCAL_ECONOMY` (`local_owned` tag), `ECO_HERITAGE` (`eco`/`heritage` tags). Each insight with an alternative carries `alternative_offer_id` and the deltas; applying is `swap_item`.

**Local Pulse rules (`localpulse_rules.py`).** Keyword + pattern layer (English, Hindi, Malayalam transliterations: bandh, hartal, strike, landslide, "road closed", "traffic diverted", festival names, VIP visit) and destination gazetteer (aliases per destination). Rules produce a candidate with a base confidence (0.6 for a single keyword match, 0.8 with place + date match). The LLM classifier (A7) may raise or lower it. Output `LocalEvent`.
## A7. Agent specification (LangGraph + Gemini, mock fallback)

```
router ─ PLAN ─▶ extract ─▶ merge_intent ─▶ [missing?] ─▶ clarify (≤2 questions + quick_replies) ─▶ END
                                         └▶ [no destination] ─▶ recommend (3 options, only Munnar available=true) ─▶ END
                                         └▶ [ready] ─▶ plan (inventory_provider → build_plan_pair) ─▶ explain ─▶ END
         ─ TRIP_QA ─▶ qa (answers ONLY from AgentState.trip_facts) ─▶ END
         ─ CANCEL ─▶ propose_cancel (returns proposed_action=CANCEL_BOOKING, never executes) ─▶ END
```
- **Extraction:** Gemini with JSON schema = `TripIntent`, temperature 0. Required to plan: origin, start_date (or month → first Saturday), nights, travellers, budget_inr. Ask at most 2 questions per turn, ordered by importance.
- **Explanation:** Gemini receives a facts JSON (costs, slack, checks) and writes 2–3 sentences. **Guard (`guards.py`):** every `₹` amount, `%`, `min` and clock time in the output must exist in the facts; otherwise discard and use the template. Same guard for QA answers and courtesy drafts.
- **Mock LLM (`mock_llm.py`):** regex/keyword extraction (origin after "from", `\d+[- ]day`, "for N people", budget `₹?[\d,]+`, interests keywords) + templated replies. Default mode. Golden request must yield `missing=[]` and Munnar.
- **Fallback:** Gemini timeout 8s or any error → mock path, `llm_fallback=true`, no user-visible error.
- **Safety:** system prompt forbids booking, quoting unlisted prices, or confirming anything the data does not show. Prompt text lives in `prompts.py` and is versioned.

**Courtesy (`agent/courtesy.py`).** On a recommendation create: HOTEL (late check-in note with new ETA), DRIVER (new pickup time), VENDOR (slot-change request for each rebooked ticket), COMPANION (optional update). Templates in `en` and `hinglish` (and `hi` if time), filled **from structured data** (names, times, booking refs); Gemini may polish tone but the guard verifies all names/times are unchanged. Channel defaults: driver WhatsApp, hotel email, vendor WhatsApp.


**Local Pulse classifier (`agent/localpulse_classifier.py`).** Input `NewsItem[]`; step 1 rules (`localpulse_rules.py`); step 2 Gemini (JSON schema = `LocalEvent`, temperature 0, headline + summary only, **never fabricate dates**: if no date is stated, `start/end` = publish date ± 1 day and confidence capped at 0.6); mock mode uses rules only. Output confidence thresholds are the contract with P2 (≥0.8 → severity 2, 0.5–0.8 → 1, <0.5 → 0). Every event keeps `source_url`.

**WhatsApp channel (`AgentState.channel="WHATSAPP"`).** Replies ≤ 600 characters, plain text, in the user's language. Intents: `STATUS` (health + next commitment + latest alert, from `trip_facts`), `PENDING` ("what needs me?"), `SWITCH_CONFIRM`, `HELP`, unknown → one clarifying line. **Two-step approval:** the agent first echoes the trade-off ("Switch to Plan B: +₹1,800, you lose Mattupetty boating. Reply YES SW2 to confirm.") and returns `proposed_action=SWITCH_PLAN`; only a message that is exactly `YES SW<n>` (case-insensitive) for the pending recommendation id yields an *approval result* that P2 executes. Expired, mismatched or ambiguous input never approves anything.

**i18n (`agent/i18n.py`).** `render(key, lang, **vars)` with `lang ∈ {en, hi, hinglish}`. Keys cover every alert type, notification digest, WhatsApp reply, courtesy draft, and error hint (≥ 40 keys). Placeholders are structured (`{amount_inr}`, `{time}`, `{item}`); a test renders every key in all three languages and checks placeholders survive and no `{…}` is left. Hindi uses Devanagari; Hinglish is Roman-script Hindi-English mix. Have a native speaker review the strings before Phase 6.

**Evals (`agent/evals/`).** `golden_prompts.jsonl` (≥ 60 prompts: en, hi, hinglish, voice-style transcripts with fillers, vague and over-specified requests, post-booking questions) with expected `TripIntent` fields; `run_evals.py` scores field-level accuracy (target ≥ 90 % intent accuracy) and counts guard violations over 200 generations (target 0). Runs in mock mode in CI and in Gemini mode on demand (AC-42).
## A8. Tests, CI and delivery duties

| Test / gate | What it proves |
|---|---|
| `tests/contract` | Fixtures validate against `models.py`; `make gen-types` produces no diff; Schemathesis conformance against the running API |
| `engine/tests` unit + property tests | Planner determinism and infeasible messages; slack math; MIXED validity; **split invariant**; optionality totals; timebank protects MUSTs; no engine function reads the clock |
| `engine/tests/test_golden_scenario.py` (`make golden`) | Baseline A ≥ 0.85 GREEN; `FLIGHT_DELAY 55` → A 0.45–0.65, B ≥ 0.90, AMBER, MIXED, delta ₹1,200–2,400, lost = Mattupetty boating; `FLIGHT_DELAY 120` → RED. Plus S-G, S-R, S-M, S-O2 scenarios |
| `agent/tests` + evals | Mock path golden request → PLANNED; vague → ≤ 2 questions; guard rejects invented prices/times; i18n placeholders; WhatsApp two-step approval and expiry |
| `tests/e2e` (Playwright) | Golden journey with P1's test ids; group journey (4 contexts); advisor consent; offline mode (context offline); WhatsApp webhook posts with signed payloads; axe on every page |
| `tests/load` (k6 or locust) | 50 concurrent users on read endpoints, p95 < 300 ms; chat latency; Pulse < 2 s |
| `scripts/smoke.py` | After `make dev`, hits every endpoint once and validates against the models |
| CI (`.github/workflows/ci.yml`) | ruff, eslint/prettier, gitleaks, `pip-audit`, `npm audit` (fail on high), unit, contract, golden, backend tests (postgres+redis services), build images, e2e on `main` |

**Integration duties.** At each phase gate: fetch all branches, run `make test golden`, merge in the B9 order, run `make e2e`, post the pass/fail table (B11 rows for that phase) to the team, tag `phase-N-done`.

**Docs duties.** `README` (what, setup, demo, architecture picture, known gaps), `ARCHITECTURE.md` (principle "LLM reasons, solver certifies", independence assumption in the feasibility model, real-vs-mock table, data flow diagrams), `SECURITY.md` (threat model: auth, authz matrix, webhooks, share links, location privacy, secrets, dependency policy; P2 appends its sections), `TEST_PLAN.md` (how each AC is verified), `DEMO_SCRIPT.md` (4-minute timed script with exact clicks, plus a 2-minute backup video plan and the `POST /demo/seed-trip` reset), `AI_TOOLS_USED.md` (hackathon asks teams to name AI tools).

## A9. Dependencies and how to unblock yourself

You depend on nobody for Phase 0. For the planner you need only `inventory_*.json` (you write them). P2 asks for real functions per B8; ship stubs first so they never wait. If a teammate hits a contract gap, handle the CR first: it is your highest-priority interrupt (4 working hours; 30 minutes if marked blocking).


---

# PART B — SHARED REFERENCE (identical in all three files)

## B1. Assumptions and project definition

**Project.** WAYFINDER ONE: an AI travel agent that plans a trip, proves the plan is feasible, books it with approval, then *guards it after booking* (alerts, Plan B, reroute, courtesy messages, claim evidence), for individuals, groups and travel advisors.
**Event.** VoyageHack 4.0 (TBO), Problem Statement 3: *Virtual Travel Agent / Travel Agent Copilot*. Required: conversational planning, discovery and comparison, price/availability validation, cost estimates, dynamic refinement, post-booking management (confirmations, vouchers, cancellations, modifications, rebooking, disruptions), and user confirmation before consequential actions. Judged on personalization, intelligent automation, orchestration, reliability, UX.

**Build philosophy: full scope, phase-gated, nothing left as a stub.** There is no 48-hour cut-down. Every feature in B2 ships working end to end. The golden scenario (B5) remains the *demo spine*, but the system also works for other destinations, groups and advisors. Work is organised in phases with exit gates (B8); a phase is not finished until its acceptance items (B11) pass.

**Assumptions (change one → tell the other two).**

| # | Assumption | Why |
|---|---|---|
| A1 | Timeline is phase-based, planned as **about 6 weeks** for three people (Phase 0–6 in B8). If you have more or less time, keep the order and scale each phase. | Lots of time, but gates keep integration honest |
| A2 | Stack from the idea deck: Next.js (TypeScript), FastAPI, LangGraph, Gemini, OR-Tools, PostgreSQL, Redis, **Celery** workers for the Journey Pulse, as pitched. | Already pitched |
| A3 | Supplier layer is an interface `SupplierAdapter` with `MockTboAdapter` (tests, offline demo) and a **real `TboLiveAdapter`** built against the TBO API documentation/credentials supplied by the organisers. `SUPPLIER=mock \| tbo_live \| hybrid` (hybrid = live search, mock fallback per call). If credentials never arrive, mock stays the default and the live adapter is still implemented and unit-tested against recorded responses. | Real inventory is the strongest proof |
| A4 | **Real accounts**: email + password, JWT, roles `TRAVELLER` and `ADVISOR`. Demo users are seeded. | Needed for groups, advisor, notifications |
| A5 | **Signals are hybrid** (`SIGNAL_SOURCE=hybrid`): weather = real (Open-Meteo, no key); ETA/traffic = real (OSRM; public demo server by default, self-hosted optional); local events = news/RSS ingestion + curated feed, classified by P3; flight status = provider API when a key is set, otherwise simulated. The **Demo Control Panel injection stays available** and everything it injects is labelled `SIMULATED`. Real signals show their real source and `is_simulated=false`. | Real where possible, controllable for demos |
| A6 | Currency INR (integer rupees). Timezone Asia/Kolkata; datetimes ISO-8601 with `+05:30`. | One convention |
| A7 | **Inventory covers 5 destinations**: Munnar (golden), Coorg, Hampi, Goa, plus a multi-stop Kerala circuit (Kochi → Munnar → Alleppey) so the multi-city planner is exercised. | Shows it generalises |
| A8 | Exactly three builders. The deck lists four names; a fourth person, if any, owns pitch, `docs/DEMO_SCRIPT.md`, backup video and user testing. | Load balance |
| A9 | The LLM never produces prices, times or feasibility numbers. Those come only from solver/engine/supplier data, and a guard enforces it. | Core trust principle |
| A10 | Messaging is real where credentials exist: WhatsApp (Meta Cloud API or Twilio sandbox), email (SMTP), web push (VAPID). `NOTIFY_MODE=live \| sim`; same code path, sim writes to an outbox that the UI shows. | Reach and honesty |
| A11 | The product never processes real payments or issues real tickets; "booking" means a supplier-sandbox/TBO booking call. Location history is never stored (latest point only). | Safety and privacy |

**Principle (do not break).** *LLM reasons, solver certifies, supplier layer books, traveller approves every consequential action.*

## B2. Users, journeys and feature scope

**Users.** Traveller (individual), Group (2–5 travellers with one shared trip), Advisor (TBO travel advisor watching many client trips: the B2B2C "Copilot").

| Journey | Steps |
|---|---|
| J1 Plan | Chat (text, voice, Hinglish) → ≤2 follow-ups → destination options → Plan A + Plan B with proof |
| J2 Review proof | Prices show source and freshness; uncertainty visible; Plan A/B compare; carbon and flex-vs-saver cost shown |
| J3 Book | Review → explicit approve → per-item honest status; optionality-aware fare choice |
| J4 Guard | Journey Pulse at POST_BOOKING, T-72h, T-24h, T-3h, LIVE → tiered alerts with one-tap action, quiet hours, channel choice |
| J5 Switch | Disruption → Slack Score amber/red → Switch recommendation (FULL/MIXED) → approve → bookings updated, courtesy messages sent |
| J6 Live reroute | Opt-in location vs deadlines → slack + reroute options; geofenced prompts |
| J7 Evidence | Auto-built claim pack with timeline and sources, exportable as PDF |
| J8 Post-booking | Ask about reservations in chat, open vouchers, modify or cancel with quote and approval |
| J9 Group | Invite → merge preferences → vote on Plan A/B → fair cost split → regroup points → per-person alerts |
| J10 Offline and safety | Offline pack (PWA), share live trip with a trusted contact, safe-arrival check-ins, SOS |
| J11 Advisor | Dashboard of client trips by health → open trip → notes → act on behalf with client consent |
| J12 Responsible | Carbon per choice, crowd-relief and local/eco alternatives |
| J13 Messaging | Same agent over WhatsApp (inbound webhook): ask status, approve a switch by reply, receive alerts |

### Feature catalogue (everything below ships; owner = who leads, others support)

| ID | Feature | Lead | Phase |
|---|---|---|---|
| F1 | Conversational planning, clarifying questions, destination recommendations | P3 | 1 |
| F2 | Proof-carrying plans (CP-SAT, checks, source/freshness on every price) | P3 | 1 |
| F3 | Booking with approval, idempotency, honest states, price-change handling | P2 | 1 |
| F4 | Guardian Autopilot (Journey Pulse windows, tiered alerts, one-tap actions) | P2 | 2 |
| F5 | Twin Plans: Plan B stored and **kept warm** (scheduled price/availability re-checks, regenerate on change) | P3 + P2 | 3 |
| F6 | Switch Engine (FULL and MIXED), commitment-preserving recovery | P3 | 3 |
| F7 | Live Reroute (real ETA via OSRM, geofenced prompts, reroute options) | P3 | 3 |
| F8 | Slack Score and Journey Health Meter | P3 + P1 | 2 |
| F9 | Time Banking (Must/Nice/Skip ranking, day re-balancing) | P3 + P1 | 3 |
| F10 | Courtesy Agent (drafts, approval, send via WhatsApp/email; en, hi, Hinglish) | P3 | 3 |
| F11 | Claim-ready Evidence Pack, PDF export | P3 + P2 | 3 |
| F12 | Optionality-aware booking (flex vs saver using expected cost of risk) | P3 | 3 |
| F13 | Local Pulse (bandh/strike/festival/landslide/road-restriction radar with source + confidence) | P2 + P3 | 2 |
| F14 | WhatsApp-first, Hinglish and voice input | P2 + P3 + P1 | 5 |
| F15 | Offline Trip Pack (PWA) and SOS: share live trip, safe-arrival check-in | P1 + P2 | 5 |
| F16 | Group Mode (2–5) | all | 4 |
| F17 | Responsible Travel layer (CO₂, crowd relief, local/eco options) | P3 + P1 | 5 |
| F18 | Post-booking management: vouchers, modify, cancel with quote | P2 | 1–3 |
| F19 | Advisor Copilot console (B2B2C) | P1 + P2 | 4 |
| F20 | Accounts, roles, notification preferences, quiet hours, sensitivity | P2 + P1 | 4 |
| F21 | Web push and email notifications | P2 | 4 |
| F22 | Delivery: CI, Docker images, deployment, observability, security hardening | P3 + P2 | 6 |

**Explicitly out of the product (stated so nobody builds them):** real payment processing, real ticket issuance, native mobile apps (the PWA covers mobile), any storage of location history.

**Screens.** `/login`, `/` plan workspace, `/trips`, `/trips/[id]` cockpit (Itinerary, Guardian, Bookings, Live, Evidence, Group, Priorities, Responsible, Offline), switch decision card, drafts drawer, book dialog, `/trips/[id]/evidence`, `/settings` (notifications, language, privacy), `/share/[token]` (public read-only live trip), `/advisor`, `/advisor/[id]`, Demo panel (key `D`). Full specs: P1 packet.

**Data entities.** User 1—* Trip; Trip 1—0..1 Group 1—* Member; Trip 1—2 Plan (A,B; versions) 1—* PlanItem 0..1 Booking; Trip 1—* Signal, Alert, SwitchRecommendation (1—* CourtesyDraft), EvidenceEvent, ChatMessage, Vote, TrustedContact, ShareLink, SafeCheckin, AdvisorNote.

**Success criteria for the finished prototype.** All acceptance items in B11 pass from a clean clone; the golden demo runs in under 4 minutes without console errors or manual DB edits; the full journey also passes with `LLM_MODE=mock` and no internet (`SIGNAL_SOURCE=sim`, `NOTIFY_MODE=sim`, `SUPPLIER=mock`).

## B3. Architecture and what is real vs mock

```
Traveller / Group / Advisor ─▶ Next.js PWA (P1) ──REST + SSE──▶ FastAPI (P2) ─▶ PostgreSQL
WhatsApp ─▶ webhook ──────────────────────────────────────────────▶ FastAPI      └─▶ Redis (cache, pub/sub, Celery broker)
                                         ├─▶ engine/ (P3, pure Python: OR-Tools, Slack, Switch, Live, Group, Optionality, Responsible, Evidence)
                                         ├─▶ agent/  (P3, LangGraph + Gemini, mock fallback)
                                         ├─▶ suppliers/ (P2: TboLive ▸ MockTbo)        ├─▶ providers/ (P2: Open-Meteo, OSRM, flight status, news)
                                         └─▶ notify/ (P2: WhatsApp, email, web push, in-app)
Celery worker + beat (P2): Journey Pulse, Plan-B warm-refresh, safe-check-in timers ─▶ Signals ─▶ Alerts / Switch / Drafts ─▶ SSE + channels
Demo layer (P2): SimClock + injector (always labelled SIMULATED)
```

| Part | Status |
|---|---|
| LangGraph agent + Gemini (intent, explanation, drafts, local-event classification) | **Real**, deterministic `LLM_MODE=mock` fallback |
| OR-Tools solver, Plan B, MIXED switch, Time Banking, optionality, group merge, responsible layer | **Real** |
| PostgreSQL, Alembic migrations, REST, SSE, Celery, Redis | **Real** |
| Auth (JWT), roles, rate limiting, audit log | **Real** |
| TBO inventory and booking | **Real adapter** (needs credentials); mock for tests/offline |
| Weather (Open-Meteo), ETA/traffic (OSRM) | **Real** |
| Local events | **Real ingestion** (RSS/news) + curated feed; classified |
| Flight status | Real when a provider key is set, else **simulated** |
| WhatsApp / email / web push | **Real** with credentials, **simulated outbox** otherwise (labelled) |
| Map display | **Real**: MapLibre GL rendering a self-hosted PMTiles extract of OpenStreetMap data (free, works offline); the app never bulk-fetches from the public OSM tile servers |
| Location | Browser geolocation (real) or simulated drive (demo) |
| Demo injections (`/demo/*`) | **Simulated**, labelled, only when `DEMO_MODE=1` |

**Technology.** Frontend: Next.js 14 App Router, TypeScript, Tailwind (CSS-variable tokens), TanStack Query, `EventSource`, lucide-react, MapLibre GL + PMTiles (self-hosted map file), next-intl (en, hi), Web Speech API, Workbox service worker. Backend: FastAPI, SQLAlchemy 2, Alembic, psycopg, Celery + Redis, `sse-starlette`, httpx, PyJWT + passlib, pywebpush, aiosmtplib, slowapi. Engine/agent: ortools, pydantic v2, langgraph, google-genai, numpy. Tests: pytest, Playwright, Schemathesis (API fuzz).
**Conventions.** JSON keys `snake_case` end to end. IDs are prefixed strings (`usr_`, `trip_`, `plan_`, `it_`, `bk_`, `al_`, `sw_`, `dr_`, `grp_`). One error envelope (B6.4). Every external fact carries `Provenance`. `types.ts` is **generated** from `models.py` by `scripts/gen_types.py` (never hand-edited).

## B4. Project file tree and owners

Owner key: **P1** frontend, **P2** backend/data, **P3** engine/agent/contracts/integration. "May edit" = only the owner; everyone else files a change request (B9).

```
wayfinder-one/
├── README.md  Makefile  .env.example (per-person blocks)  requirements-engine.txt            P3
├── docker-compose.yml  docker-compose.prod.yml  deploy/ (Dockerfiles, fly/render configs)    P2
├── .github/workflows/ci.yml                                                                  P3
├── docs/ ARCHITECTURE.md DEMO_SCRIPT.md CHANGE_REQUESTS.md AI_TOOLS_USED.md SECURITY.md TEST_PLAN.md   P3
├── contracts/                        P3 ONLY
│   ├── models.py  types.ts (generated)  errors.md  fixtures/ (one JSON per endpoint, inventory_*.json, golden_*.json, group_*.json, advisor_*.json)
├── scripts/                          P3   gen_types.py  make_pmtiles.sh  smoke.py  wait_for_api.sh  record_demo_state.py
├── engine/                           P3   (pure functions; no DB, no network)
│   ├── config.py geo.py planner.py multicity.py validator.py slack.py switch.py timebank.py live.py evidence.py
│   ├── optionality.py group.py responsible.py localpulse_rules.py stubs.py (deleted at end of Phase 3)  errors.py
│   └── tests/
├── agent/                            P3   (LangGraph + Gemini; no DB, no HTTP)
│   ├── llm.py prompts.py graph.py courtesy.py guards.py mock_llm.py localpulse_classifier.py i18n.py (en, hi, hinglish templates)
│   └── tests/ + evals/ (golden prompt set, scored)
├── backend/                          P2
│   ├── requirements.txt  alembic.ini  alembic/versions/  ruff.toml
│   ├── app/main.py config.py deps.py db.py models_db.py events.py errors.py security.py ratelimit.py audit.py
│   ├── app/routes/ auth.py me.py chat.py trips.py booking.py alerts.py switch.py drafts.py evidence.py live.py vouchers.py
│   │              groups.py priorities.py optionality.py responsible.py share.py safety.py offline.py advisor.py webhooks.py demo.py health.py
│   ├── app/services/ one per route area + pulse_service planb_service notification_service sim_service
│   ├── app/suppliers/ base.py mock_tbo.py tbo_live.py hybrid.py registry.py recorded/ (fixtures of real responses)
│   ├── app/providers/ weather_openmeteo.py eta_osrm.py flight_status.py local_events.py registry.py
│   ├── app/notify/ base.py whatsapp.py email.py webpush.py inapp.py outbox.py
│   ├── app/worker/ celery_app.py tasks.py beat_schedule.py
│   ├── seed/ seed.py route_cok_munnar.json users.json
│   └── tests/
├── frontend/                         P1
│   ├── package.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs .prettierrc
│   ├── public/ manifest.webmanifest icons/ sw.js (Workbox build output)
│   └── src/
│       ├── app/ layout.tsx globals.css page.tsx login/ settings/ trips/ trips/[id]/ trips/[id]/evidence/ share/[token]/ advisor/ advisor/[id]/ dev/states/
│       ├── components/ ui/* auth/* chat/* itinerary/* guardian/* switch/* drafts/* live/* bookings/* evidence/* group/* priorities/* responsible/* offline/* safety/* advisor/* demo/*
│       ├── lib/ api/{client,endpoints,fixtures}.ts sse.ts format.ts queryKeys.ts auth.ts pwa.ts speech.ts
│       ├── i18n/ en.json hi.json
│       ├── hooks/ useTrip useSlack useAlerts useSwitch useLive useTripEvents useAuth useVoice useOfflinePack
│       └── styles/tokens.css
└── tests/ contract/ (P3)   e2e/ (P3: Playwright)   load/ (P3: k6 or locust)
```

## B5. Golden demo scenario (single source of numbers)

All three people test against this. P3 owns the numbers (`contracts/fixtures/inventory_kerala.json`, `golden_*.json`); P2 serves them; P1 renders them. **Prices and flights are simulated and fictional.**

**Request (typed, spoken or the "Try the demo" chip):** *"Plan a 5-day budget trip from Bengaluru for 2 people, early December, around ₹55,000. We like tea estates, waterfalls and sunsets. Avoid driving on ghat roads after dark."*
**Trip:** Sat 5 Dec to Wed 9 Dec 2026, BLR → Munnar, 2 travellers, budget ₹55,000. Sim window clock anchors: T-72h = 2 Dec 07:40, T-24h = 4 Dec 07:40, T-3h = 5 Dec 04:40, LIVE = 5 Dec 10:20.

**Plan A (approved plan)**

| Day | Item id | Item | Time | ₹ | Notes |
|---|---|---|---|---|---|
| 1 | it_a_f1 | Flight BLR→COK (sim) | 07:40–09:05 | 8,600 | fixed, non-refundable |
| 1 | it_a_t1 | Cab COK→Munnar | 09:50–14:20 | 4,300 | GHAT_ROAD, refundable until 4 Dec 09:50 |
| 1 | it_a_e1 | Eravikulam NP timed entry | 15:00–17:00 | 1,000 | MUST, RAIN, hard_deadline last entry 15:45, rebooking fee ₹400 |
| 1–5 | it_a_h1 | Tea Valley Resort, 4 nights | check-in 14:30–20:00 | 16,000 | refundable until 3 Dec 18:00, check-in cut-off 20:00 |
| 2 | it_a_tm | Tea Museum | 10:00–11:30 | 400 | NICE, indoor |
| 2 | it_a_mb | Mattupetty Dam boating | 13:30–15:00 | 900 | NICE |
| 3 | it_a_wf | Lakkam waterfall guided trek | 08:30–13:00 | 1,600 | MUST, RAIN |
| 4 | it_a_ts | Top Station sunset point (jeep) | 16:00–19:00 | 1,400 | NICE, RAIN, CROWD |
| 5 | it_a_t2 | Cab Munnar→COK | 10:00–14:30 | 4,300 | GHAT_ROAD |
| 5 | it_a_f2 | Flight COK→BLR (sim) | 17:35–19:00 | 7,800 | fixed |

Total ₹46,300, headroom ₹8,700 (meals and shopping excluded and stated as such).

**Plan B (stored, kept warm):** same flights/hotel, cab leaves later and avoids night ghat driving; Eravikulam moves to Day 2 09:00; Waterfall trek replaced by *Spice plantation + cooking class* (rain-safe); Top Station replaced by *Tea factory tour*. Refundable components preferred.

**Scripted story → expected system behaviour**

| Step | Action | Expected |
|---|---|---|
| 1 | Send request | Intent complete (or ≤2 follow-ups), Plan A + B with proof checks, ₹ with source/freshness |
| 2 | Book Plan A | Review dialog → approve → flights/cab CONFIRMED, hotel **PENDING** (with `SUPPLIER=mock`, confirms ~20s later → SSE `booking.updated`) |
| 3 | Clock → T-72h, then T-24h | Local Pulse + weather alert (Day 3 rain risk, Plan B ready); T-24h web check-in NUDGE; health GREEN → AMBER borderline |
| 4 | Clock → T-3h, inject `FLIGHT_DELAY 55` | Slack Score AMBER, ACTION_NEEDED alert, SwitchRecommendation |
| 5 | Open switch card | Plan A ≈ 50–65%, Plan B ≥ 90%, mode MIXED, delta ≈ +₹1,800 (band 1,200–2,400), lost item: Mattupetty boating (NICE) |
| 6 | Clock → LIVE, play simulated drive + inject `TRAFFIC_JAM 25` | Next commitment slack shrinks, reroute options shown |
| 7 | Approve switch + drafts | Hotel/driver/vendor drafts approved (SENT, simulated), Eravikulam rebooked, kept bookings unchanged, new Plan A v2, new Plan B regenerated |
| 8 | Open Evidence | Timeline: delay source, bookings, extra cost, claim sections |

**Target bands (P3 tunes, golden test enforces).** Baseline Plan A feasibility ≥ 0.85 (GREEN). After `FLIGHT_DELAY 55`: Plan A 0.45–0.65, Plan B ≥ 0.90, health AMBER. After `FLIGHT_DELAY 120`: health RED. Nobody hard-codes these numbers in UI or backend.

### Secondary scenarios (each has a golden test and an e2e spec)

| ID | Scenario | Expected behaviour |
|---|---|---|
| S-G Group | 4 friends plan Coorg, 3 nights, ₹16,000 each. Members `usr_g1..g4` have conflicting preferences (one vegetarian, one wants adventure, budgets ₹12k–₹20k). | Merged intent shows **explicit conflicts and how they were resolved**; vote on Plan A/B (majority + owner tiebreak); cost split sums exactly to the total (largest-remainder rounding); when `usr_g3` is delayed (inject) a **regroup point** is suggested and only affected members get the ACTION alert |
| S-A Advisor | Advisor `advisor@demo.wf` has 6 client trips in mixed health. | `/advisor` lists them sorted RED→GREEN with next risk; opening one shows the same cockpit read-only plus notes; acting on a switch needs the traveller's recorded consent flag |
| S-W WhatsApp | Traveller replies "status" then "yes switch" to an alert on WhatsApp. | Inbound webhook (signature verified) maps phone → user, answers from the Twin, and `yes` is treated as approval **only** for the exact pending recommendation id and only within 30 minutes; anything ambiguous asks again |
| S-R Responsible | Munnar plan with a car-heavy day. | Report shows total CO₂ and per-mode split; suggests a lower-crowd alternative slot and a local-economy option; selecting one produces a revalidated plan with the delta |
| S-O Offline/SOS | Trip active, network cut. | Offline pack loads itinerary, vouchers, Plan B, contacts and the cached regional map file; SOS queues and sends on reconnect; missed safe-check-in notifies the trusted contact; share link shows only live status, never PII |
| S-M Multi-city | Kochi → Munnar → Alleppey, 6 nights. | Solver orders legs, validates inter-city transfers, produces Plan A and a different Plan B |
| S-O2 Optionality | Same Munnar trip. | Report marks the cab and Eravikulam ticket as high-risk, recommends flexible options where `expected_loss > flex_premium`, and shows total cost *including* expected disruption cost for both choices |

## B6. Shared input/output and API contracts

**Contract version `1.0.0`** (covers the full-scope product). Source of truth is `contracts/models.py` (P3). `contracts/types.ts` mirrors it 1:1 (mapping: `str`→`string`, `int/float`→`number`, `datetime/date`→ISO `string`, `Optional[X]`→`X | null`, `Literal[...]`→string union, `dict`→`Record<string, unknown>`). The version is returned by `GET /health` and shown in the frontend footer. A mismatch logs a console warning.

### B6.1 Models (Python, canonical)

```python
# contracts/models.py
from __future__ import annotations
from datetime import datetime, date
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

CONTRACT_VERSION = "1.0.0"

ItemType      = Literal["FLIGHT", "HOTEL", "TRANSFER", "ACTIVITY"]
Priority      = Literal["MUST", "NICE", "SKIP_IF_NEEDED"]
BookingStatus = Literal["NOT_BOOKED", "HELD", "PENDING", "CONFIRMED", "FAILED", "CANCELLED"]
AlertLevel    = Literal["INFO", "NUDGE", "ACTION_NEEDED", "CRITICAL"]
Health        = Literal["GREEN", "AMBER", "RED"]
RiskTag       = Literal["RAIN", "GHAT_ROAD", "CROWD", "STRIKE", "HEAT"]
Window        = Literal["POST_BOOKING", "T-72H", "T-24H", "T-3H", "LIVE"]
TripStatus    = Literal["DRAFT", "PLANNED", "BOOKED", "ACTIVE", "COMPLETED"]

class Provenance(BaseModel):
    source: str                         # "TBO Sandbox (sim)", "Flight status feed (sim)"
    checked_at: datetime
    is_simulated: bool = True
    confidence: float = Field(1.0, ge=0, le=1)

class Place(BaseModel):
    name: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)

class BookingRef(BaseModel):
    booking_id: str
    status: BookingStatus
    supplier_ref: Optional[str] = None

class PlanItem(BaseModel):
    id: str
    type: ItemType
    title: str
    day: int = Field(ge=1)
    start: datetime
    end: datetime
    origin: Optional[Place] = None
    place: Optional[Place] = None
    price_inr: int = Field(ge=0)
    price_provenance: Provenance
    refundable: bool
    cancel_by: Optional[datetime] = None
    priority: Priority = "NICE"
    fixed: bool = False                         # time cannot move (flights, timed tickets)
    hard_deadline: Optional[datetime] = None    # last entry, hotel check-in cut-off
    depends_on: list[str] = []
    risk_tags: list[RiskTag] = []
    indoor: bool = False
    co2_kg: Optional[float] = None
    rebook_fee_inr: Optional[int] = None
    booking: Optional[BookingRef] = None

class ProofCheck(BaseModel):
    name: str                 # "budget", "hard_connection:it_a_t1->it_a_e1", "daily_hours", "no_night_ghat"
    passed: bool
    detail: str               # human readable, numbers come from the solver

class Validation(BaseModel):
    feasible: bool
    checks: list[ProofCheck]
    min_slack_min: int
    budget_headroom_inr: int
    feasibility: float = Field(ge=0, le=1)
    solver: str = "ortools-cp-sat"
    solve_ms: int = 0

class Plan(BaseModel):
    id: str
    trip_id: str
    kind: Literal["A", "B"]
    version: int = 1
    items: list[PlanItem]
    total_cost_inr: int
    validation: Validation
    summary: str = ""
    created_at: datetime
    superseded: bool = False

class SlackComponents(BaseModel):
    time_buffer: int; delay_risk: int; weather_risk: int; crowd_risk: int; budget_headroom: int   # each 0-100, higher = safer

class SlackScore(BaseModel):
    trip_id: str
    health: Health
    score: int = Field(ge=0, le=100)
    components: SlackComponents
    weakest_item_id: Optional[str] = None
    explanation: str
    computed_at: datetime

class DestinationOption(BaseModel):
    name: str; why: str; est_budget_inr: int; available: bool

class TripIntent(BaseModel):
    origin: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[date] = None
    nights: Optional[int] = Field(None, ge=1, le=14)
    travellers: Optional[int] = Field(None, ge=1, le=9)
    budget_inr: Optional[int] = Field(None, ge=1000)
    interests: list[str] = []
    constraints: list[str] = []
    pace: Optional[Literal["RELAXED", "BALANCED", "PACKED"]] = None
    must_dos: list[str] = []
    missing: list[str] = []          # empty => ready to plan

class ActionRef(BaseModel):
    action: Literal["SWITCH_PLAN", "APPROVE_DRAFTS", "CHECK_IN", "KEEP_PLAN", "BOOK_PLAN", "CANCEL_BOOKING", "VIEW"]
    label: str
    params: dict[str, Any] = {}

class Trip(BaseModel):
    id: str
    title: str
    status: TripStatus
    intent: TripIntent
    active_plan: Literal["A", "B"] = "A"
    plan_a_id: Optional[str] = None
    plan_b_id: Optional[str] = None
    sim_now: Optional[datetime] = None
    sim_window: Optional[Window] = None
    owner_id: str
    group_id: Optional[str] = None
    advisor_id: Optional[str] = None
    advisor_consent: bool = False
    created_at: datetime

class Booking(BaseModel):
    id: str; trip_id: str; plan_id: str; item_id: str
    status: BookingStatus
    supplier_ref: Optional[str] = None
    amount_inr: int
    refundable: bool
    failure_reason: Optional[str] = None
    penalty_inr: Optional[int] = None          # set after a cancellation
    updated_at: datetime

class Signal(BaseModel):
    id: str; trip_id: str
    kind: Literal["FLIGHT_STATUS", "WEATHER", "LOCAL_EVENT", "TRAFFIC", "HOTEL_CONFIRMATION", "FARE_RULE"]
    item_id: Optional[str] = None
    severity: int = Field(ge=0, le=3)
    summary: str
    payload: dict[str, Any] = {}              # e.g. {"delay_min": 55} | {"rain": "HEAVY", "day": 3}
    provenance: Provenance

class Alert(BaseModel):
    id: str; trip_id: str
    level: AlertLevel
    window: Window
    title: str
    body: str
    provenance: Provenance                     # source + freshness shown on every alert
    recommended_action: Optional[ActionRef] = None
    state: Literal["NEW", "SEEN", "APPROVED", "DISMISSED", "EXPIRED"] = "NEW"
    audience_user_ids: list[str] = []          # empty = everyone on the trip
    channels_sent: list[str] = []              # Channel values actually used
    created_at: datetime

class LostItem(BaseModel):
    item_id: str; title: str; priority: Priority

class SwitchRecommendation(BaseModel):
    id: str; trip_id: str
    mode: Literal["FULL", "MIXED"]
    reason: str
    feasibility_a: float; feasibility_b: float
    slack_a_min: int; slack_b_min: int
    delta_cost_inr: int
    lost_items: list[LostItem]
    kept_booking_item_ids: list[str]           # commitment-preserving: stays untouched
    changed_booking_item_ids: list[str]        # cancel/rebook needed
    resulting_plan: Plan                       # the plan that becomes active if approved (kind A, version+1)
    sources: list[Provenance]
    state: Literal["PROPOSED", "APPROVED", "REJECTED", "EXECUTED", "FAILED", "EXPIRED"] = "PROPOSED"
    created_at: datetime

class CourtesyDraft(BaseModel):
    id: str; trip_id: str; recommendation_id: Optional[str] = None
    recipient_kind: Literal["HOTEL", "DRIVER", "VENDOR", "COMPANION"]
    recipient_name: str
    channel: Literal["WHATSAPP", "EMAIL", "SMS"]
    language: Literal["en", "hi", "hinglish"] = "en"
    subject: Optional[str] = None
    body: str
    state: Literal["DRAFT", "APPROVED", "SENT", "DISCARDED"] = "DRAFT"    # SENT = simulated
    created_at: datetime

class EvidenceEvent(BaseModel):
    id: str; trip_id: str; ts: datetime
    kind: Literal["SIGNAL", "ALERT", "SWITCH", "BOOKING", "COST", "DRAFT", "NOTE"]
    source: str
    detail: str
    ref: dict[str, Any] = {}

class ClaimSection(BaseModel):
    type: Literal["AIRLINE", "INSURANCE", "SUPPLIER"]
    summary: str
    amount_inr: Optional[int] = None
    attachments: list[str] = []                # booking ids, signal ids

class EvidencePack(BaseModel):
    trip_id: str; generated_at: datetime
    events: list[EvidenceEvent]
    total_delay_min: int
    extra_cost_inr: int
    claim_sections: list[ClaimSection]

class RerouteOption(BaseModel):
    id: str
    mode: Literal["DRIVE", "METRO", "WALK", "CAB", "RESHUFFLE_DAY", "SHIFT_SLOT", "USE_PLAN_B_SEGMENT"]
    title: str
    eta_min: Optional[int] = None
    slack_min: int
    delta_cost_inr: int
    note: str
    provenance: Provenance
    action: Optional[ActionRef] = None

class NextCommitment(BaseModel):
    item_id: str; title: str; arrive_by: datetime
    eta_min: int; slack_min: int; health: Health

class GeofencePrompt(BaseModel):
    kind: Literal["ARRIVED_HOTEL", "LEAVING_VENUE", "OFF_ROUTE"]
    title: str; body: str

class LiveStatus(BaseModel):
    trip_id: str; as_of: datetime
    location: Optional[Place] = None
    tracking_on: bool
    next_commitment: Optional[NextCommitment] = None
    reroute_options: list[RerouteOption] = []
    geofence_prompt: Optional[GeofencePrompt] = None

class Voucher(BaseModel):
    booking_id: str; title: str; reference: str; html_url: str

# ---- request / response wrappers ----
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    trip_id: Optional[str] = None
    locale: Literal["en", "hi", "hinglish"] = "en"
    input_mode: Literal["TEXT", "VOICE"] = "TEXT"

class ChatResponse(BaseModel):
    trip_id: str
    stage: Literal["CLARIFYING", "RECOMMENDING", "PLANNED", "ANSWER"]
    assistant_message: str
    intent: TripIntent
    quick_replies: list[str] = []
    destination_options: list[DestinationOption] = []
    plan_a: Optional[Plan] = None
    plan_b: Optional[Plan] = None
    proposed_action: Optional[ActionRef] = None     # e.g. CANCEL_BOOKING awaiting approval

class TripDetail(BaseModel):
    trip: Trip; plan_a: Optional[Plan]; plan_b: Optional[Plan]
    bookings: list[Booking]; slack: Optional[SlackScore]; unread_alerts: int

class TripSummary(BaseModel):
    id: str; title: str; status: TripStatus; health: Optional[Health]; start_date: Optional[date]; total_cost_inr: Optional[int]

class BookRequest(BaseModel):
    plan: Literal["A", "B"] = "A"
    approve: bool                                   # must be true or API returns APPROVAL_REQUIRED
    idempotency_key: str = Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")

class BookResult(BaseModel):
    status: Literal["CONFIRMED", "PARTIAL", "PENDING"]
    bookings: list[Booking]
    message: str

class AlertAck(BaseModel):
    action: Literal["APPROVE", "DISMISS", "SEEN"]

class SwitchDecision(BaseModel):
    decision: Literal["APPROVE", "REJECT"]
    approve_draft_ids: list[str] = []
    idempotency_key: str = Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")

class SwitchResult(BaseModel):
    recommendation: SwitchRecommendation
    trip: Trip
    plan_a: Plan; plan_b: Optional[Plan]
    bookings: list[Booking]
    drafts: list[CourtesyDraft]
    evidence_event_ids: list[str]

class DraftDecision(BaseModel):
    decision: Literal["APPROVE", "EDIT", "DISCARD"]
    body: Optional[str] = None                      # required when EDIT

class LocationPing(BaseModel):
    lat: float = Field(ge=-90, le=90); lng: float = Field(ge=-180, le=180)
    speed_kmh: Optional[float] = Field(None, ge=0, le=400)
    ts: datetime

class CancelRequest(BaseModel):
    approve: bool
    idempotency_key: str = Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")

class DemoClock(BaseModel):
    window: Window

class DemoInject(BaseModel):
    kind: Literal["FLIGHT_DELAY", "RAIN", "BANDH", "TRAFFIC_JAM"]
    params: dict[str, Any] = {}                     # FLIGHT_DELAY {"minutes":55} | RAIN {"day":3,"intensity":"HEAVY"} | BANDH {"day":2} | TRAFFIC_JAM {"minutes":25}

class ErrorBody(BaseModel):
    code: Literal["VALIDATION_ERROR", "NOT_FOUND", "CONFLICT", "APPROVAL_REQUIRED", "INVALID_STATE",
                  "SUPPLIER_UNAVAILABLE", "PRICE_CHANGED", "SOLVER_INFEASIBLE", "LLM_UNAVAILABLE", "INTERNAL",
                  "UNAUTHENTICATED", "FORBIDDEN", "RATE_LIMITED", "CONSENT_REQUIRED"]
    message: str
    details: Optional[dict[str, Any]] = None
    request_id: str

class ErrorResponse(BaseModel):
    error: ErrorBody
```

### B6.1b Additional models (same file, `contracts/models.py`)

```python
# ---- accounts, preferences, notifications ----
Role = Literal["TRAVELLER", "ADVISOR"]
Channel = Literal["IN_APP", "PUSH", "WHATSAPP", "EMAIL", "SMS"]

class User(BaseModel):
    id: str; email: str; name: str; role: Role = "TRAVELLER"
    language: Literal["en", "hi", "hinglish"] = "en"

class RegisterRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    role: Role = "TRAVELLER"

class LoginRequest(BaseModel):
    email: str; password: str

class TokenResponse(BaseModel):
    access_token: str; token_type: Literal["bearer"] = "bearer"; expires_in: int; user: User

class SseToken(BaseModel):                         # EventSource cannot send headers; 60s single-purpose token
    token: str; expires_in: int = 60

class NotificationPrefs(BaseModel):
    user_id: str
    channels: list[Channel] = ["IN_APP"]
    whatsapp_number: Optional[str] = Field(None, pattern=r"^\+\d{8,15}$")
    quiet_hours_start: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")   # "22:00"
    quiet_hours_end: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    sensitivity: Literal["LOW", "NORMAL", "HIGH"] = "NORMAL"   # LOW = only ACTION_NEEDED+; HIGH = everything but batched
    language: Literal["en", "hi", "hinglish"] = "en"
    # rule: CRITICAL ignores quiet hours; INFO/NUDGE are batched during quiet hours

class PushSubscription(BaseModel):
    endpoint: str; p256dh: str; auth: str

# ---- group mode ----
class GroupMember(BaseModel):
    user_id: str; name: str; role: Literal["OWNER", "MEMBER"]; location_sharing: bool = False; joined_at: datetime

class Group(BaseModel):
    id: str; trip_id: str; invite_code: str; members: list[GroupMember]; created_at: datetime

class GroupPreference(BaseModel):
    user_id: str
    budget_inr: Optional[int] = None
    interests: list[str] = []
    constraints: list[str] = []                    # "vegetarian", "no trekking"
    pace: Optional[Literal["RELAXED", "BALANCED", "PACKED"]] = None
    must_dos: list[str] = []

class PrefConflict(BaseModel):
    field: str; values: dict[str, Any]; resolution: str   # e.g. budget: min of members; constraints: union (hard)

class MergedPreferences(BaseModel):
    merged_intent: TripIntent; conflicts: list[PrefConflict]

class VoteRequest(BaseModel):
    plan_id: str; vote: Literal["A", "B", "NEITHER"]

class VoteTally(BaseModel):
    trip_id: str; votes: dict[str, str]; counts: dict[str, int]; leader: Optional[Literal["A", "B"]] = None
    decided: bool = False; rule: str = "Majority of members; owner breaks ties"

class CostSplit(BaseModel):
    member_id: str; name: str; share_inr: int; item_ids: list[str] = []
    # shares sum EXACTLY to plan total (largest-remainder rounding); method in SplitReport; item_ids reserved (empty in v1)
class SplitReport(BaseModel):
    trip_id: str; method: Literal["EQUAL", "BY_BUDGET"]; total_inr: int; shares: list[CostSplit]

class RegroupSuggestion(BaseModel):
    reason: str; point: Place; meet_by: datetime; member_etas_min: dict[str, int]; affected_user_ids: list[str]

# ---- priorities, time banking, optionality, responsible ----
class ItemPriorityUpdate(BaseModel):
    item_id: str; priority: Priority
class PrioritiesRequest(BaseModel):
    priorities: list[ItemPriorityUpdate]

class RebalanceRequest(BaseModel):
    lost_min: int = Field(ge=1, le=600); from_item_id: str
    apply: bool = False
    approve: bool = False                          # required when apply=true
    idempotency_key: Optional[str] = Field(None, pattern=r"^[A-Za-z0-9_-]{8,64}$")

class RebalancePreview(BaseModel):
    plan_preview: Plan; dropped: list[LostItem]; shortened: list[str]; summary: str; applied: bool = False

class SwapItemRequest(BaseModel):
    item_id: str; offer_id: str
    apply: bool = False
    approve: bool = False                          # required when apply=true
    idempotency_key: Optional[str] = Field(None, pattern=r"^[A-Za-z0-9_-]{8,64}$")

class SwapPreview(BaseModel):
    plan_preview: Plan; delta_cost_inr: int; delta_co2_kg: Optional[float] = None
    lost_items: list[LostItem] = []; changed_booking_item_ids: list[str] = []
    summary: str; applied: bool = False

class RiskLine(BaseModel):
    item_id: str; disruption_prob: float; expected_loss_inr: int
    flex_premium_inr: int; recommended: Literal["FLEX", "SAVER"]; reason: str
class OptionalityReport(BaseModel):
    trip_id: str; lines: list[RiskLine]
    total_saver_inr: int; total_saver_with_risk_inr: int; total_flex_inr: int; recommendation: str

class ResponsibleInsight(BaseModel):
    item_id: Optional[str] = None
    kind: Literal["CO2", "CROWD_RELIEF", "LOCAL_ECONOMY", "ECO_HERITAGE"]
    title: str; detail: str
    alternative_offer_id: Optional[str] = None
    co2_saving_kg: Optional[float] = None; delta_cost_inr: Optional[int] = None
class ResponsibleReport(BaseModel):
    trip_id: str; total_co2_kg: float; by_mode: dict[str, float]; insights: list[ResponsibleInsight]
    method: str                                   # emission-factor table name + version

# ---- safety, sharing, offline ----
class TrustedContact(BaseModel):
    id: str; trip_id: str; name: str; phone: Optional[str] = None; email: Optional[str] = None
class TrustedContactCreate(BaseModel):
    name: str; phone: Optional[str] = Field(None, pattern=r"^\+\d{8,15}$"); email: Optional[str] = None

class ShareLink(BaseModel):
    token: str; url: str; expires_at: datetime; active: bool = True
class SharedTripView(BaseModel):                  # public, read-only, NO PII (no booking refs, no phone numbers)
    title: str; health: Health; next_stop: Optional[str] = None; eta: Optional[datetime] = None
    last_location_name: Optional[str] = None; as_of: datetime

class SafeCheckinCreate(BaseModel):
    item_id: str; due_at: datetime
class SafeCheckin(BaseModel):
    id: str; trip_id: str; item_id: str; due_at: datetime
    state: Literal["PENDING", "CONFIRMED", "MISSED"] = "PENDING"

class SosRequest(BaseModel):
    lat: Optional[float] = Field(None, ge=-90, le=90); lng: Optional[float] = Field(None, ge=-180, le=180)
    message: Optional[str] = Field(None, max_length=300)
class SosResult(BaseModel):
    notified: list[str]; queued: bool = False

class OfflineResource(BaseModel):
    url: str; kind: Literal["ITINERARY", "VOUCHER", "PLAN_B", "CONTACTS", "MAP", "SOS"]; bytes: int
class OfflineManifest(BaseModel):
    trip_id: str; version: int; generated_at: datetime; resources: list[OfflineResource]; expires_at: datetime

# ---- advisor ----
class AdvisorTripRow(BaseModel):
    trip_id: str; traveller_name: str; title: str; status: TripStatus
    health: Optional[Health]; score: Optional[int]; next_risk: Optional[str]
    unread_alerts: int; start_date: Optional[date]; has_consent: bool
class AdvisorNote(BaseModel):
    id: str; trip_id: str; advisor_id: str; body: str = Field(max_length=2000); created_at: datetime
class AdvisorNoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
class AdvisorInvite(BaseModel):
    advisor_email: str; consent_to_act: bool = False

# ---- booking modification, messaging webhook ----
class ModifyBookingRequest(BaseModel):
    approve: bool
    idempotency_key: Optional[str] = Field(None, pattern=r"^[A-Za-z0-9_-]{8,64}$")
    new_start: Optional[datetime] = None; note: Optional[str] = Field(None, max_length=300)
    # approve=false returns 400 APPROVAL_REQUIRED with details {fee_inr, new_price_inr, available} (the quote)

class SignalView(BaseModel):                      # "why am I seeing this?" transparency list
    signal: Signal; used_in: list[str]            # alert ids / recommendation ids
```
**Field additions** (`Alert.audience_user_ids/channels_sent`, `Trip.owner_id/group_id/advisor_id/advisor_consent`, `ChatRequest.input_mode`, new error codes) are already applied in B6.1 above.

### B6.2 TypeScript types (generated, never hand-edited)

`contracts/types.ts` is produced by `python scripts/gen_types.py` (P3; included in the starter repo) from `contracts/models.py` using each model's JSON schema (`str`→`string`, numbers→`number`, `datetime/date`→ISO `string`, `Optional[X]`→`X | null`, `Literal[...]`→string union, `dict`→`Record<string, unknown>`, lists→arrays). `make gen-types` regenerates it; CI fails if the committed file differs. Sample of the output:

```ts
export const CONTRACT_VERSION = "1.0.0";
export type Health = "GREEN" | "AMBER" | "RED";
export interface Provenance { source: string; checked_at: string; is_simulated: boolean; confidence: number }
export interface SlackScore { trip_id: string; health: Health; score: number; components: SlackComponents;
  weakest_item_id: string | null; explanation: string; computed_at: string }
export interface ErrorResponse { error: ErrorBody }
```

### B6.3 Endpoints (base `/api/v1`, JSON, snake_case)

| # | Method + path | Request | Response | Validation / errors |
|---|---|---|---|---|
| 1 | `POST /chat` | `ChatRequest` | `ChatResponse` | message 1–2000 chars → 422 `VALIDATION_ERROR`; LLM down in mock mode never errors; Gemini down falls back to mock |
| 2 | `GET /trips` | – | `TripSummary[]` | – |
| 3 | `GET /trips/{id}` | – | `TripDetail` | 404 `NOT_FOUND` |
| 4 | `POST /trips/{id}/book` | `BookRequest` | `BookResult` | `approve=false` → 400 `APPROVAL_REQUIRED`; price moved → 409 `PRICE_CHANGED` with `details.items`; replay same key returns same result |
| 5 | `GET /trips/{id}/bookings` | – | `Booking[]` | – |
| 6 | `GET /trips/{id}/slack` | – | `SlackScore` | 404 if no plan |
| 7 | `GET /trips/{id}/alerts?state=NEW` | – | `Alert[]` (newest first) | – |
| 8 | `POST /alerts/{id}/ack` | `AlertAck` | `Alert` | 404 |
| 9 | `GET /trips/{id}/switch` | – | `SwitchRecommendation \| null` (latest PROPOSED) | – |
| 10 | `POST /switch/{id}/decision` | `SwitchDecision` | `SwitchResult` | not PROPOSED → 409 `INVALID_STATE`; supplier failure → 502 `SUPPLIER_UNAVAILABLE`, nothing half-applied (see P2 packet) |
| 11 | `GET /trips/{id}/drafts` | – | `CourtesyDraft[]` | – |
| 12 | `POST /drafts/{id}/decision` | `DraftDecision` | `CourtesyDraft` | EDIT without body → 422 |
| 13 | `GET /trips/{id}/evidence` | – | `EvidencePack` | – |
| 14 | `GET /trips/{id}/evidence/print` | – | HTML (printable) | – |
| 15 | `POST /trips/{id}/location` | `LocationPing` | `LiveStatus` | invalid lat/lng → 422 |
| 16 | `GET /trips/{id}/live` | – | `LiveStatus` | `tracking_on=false` if no ping in last 10 min |
| 17 | `GET /trips/{id}/vouchers` | – | `Voucher[]` | only CONFIRMED bookings |
| 18 | `POST /bookings/{id}/cancel` | `CancelRequest` | `Booking` | `approve=false` → 400 `APPROVAL_REQUIRED` with `details {penalty_inr, refundable, cancel_by}` (this is the quote the dialog shows); then `approve=true` performs it |
| 19 | `GET /trips/{id}/events?sse_token=` | – | SSE stream | see B6.5; token from endpoint 31; events filtered by `audience_user_ids` |
| 20 | `GET /demo/state` | – | `{trip_id, window, sim_now, injected: DemoInject[]}` | demo routes exist only when `DEMO_MODE=1` |
| 21 | `POST /demo/seed-trip` | – | `TripDetail` (fully planned golden trip, no LLM) | – |
| 22 | `POST /demo/clock?trip_id=` | `DemoClock` | `{window, sim_now}` + triggers a Pulse run | – |
| 23 | `POST /demo/inject?trip_id=` | `DemoInject` | `{signal_ids: string[]}` + triggers a Pulse run | unknown kind → 422 |
| 24 | `POST /demo/reset` | – | `{ok: true}` | wipes all tables, reseeds |
| 25 | `GET /health` | – | `{status, contract_version, llm_mode, supplier, db}` | – |
| 26 | `GET /demo/route` | – | `{points: [{lat: number, lng: number}]}` (simulated drive Kochi airport → Munnar) | demo mode only |
| 27 | `GET /vouchers/{booking_id}.html` | – | HTML voucher (target of `Voucher.html_url`) | 404 if not CONFIRMED |


### B6.3b Additional endpoints (continuing the table; same conventions)

| # | Method + path | Request | Response | Rules / errors |
|---|---|---|---|---|
| 28 | `POST /auth/register` | `RegisterRequest` | `TokenResponse` | duplicate email → 409 `CONFLICT`; weak password → 422 |
| 29 | `POST /auth/login` | `LoginRequest` | `TokenResponse` | bad credentials → 401 `UNAUTHENTICATED` (same message for unknown email and wrong password); 5 failures/min/IP → 429 `RATE_LIMITED` |
| 30 | `GET /auth/me` | – | `User` | – |
| 31 | `POST /auth/sse-token` | – | `SseToken` | used as `?sse_token=` on endpoint 19 |
| 32 | `GET /me/preferences`, `PUT /me/preferences` | `NotificationPrefs` | `NotificationPrefs` | `whatsapp_number` E.164 |
| 33 | `POST /me/push-subscription` | `PushSubscription` | `{ok: true}` | idempotent per endpoint |
| 34 | `POST /trips/{id}/group` | – | `Group` | owner only; one group per trip |
| 35 | `POST /groups/join` | `{invite_code}` | `Group` | unknown code → 404; group max 5 members → 409 |
| 36 | `GET /trips/{id}/group` | – | `Group` | members only |
| 37 | `PUT /trips/{id}/group/preferences` | `GroupPreference` | `MergedPreferences` | writes only the caller's own preference |
| 38 | `GET /trips/{id}/group/merged` | – | `MergedPreferences` | – |
| 39 | `POST /trips/{id}/votes`, `GET /trips/{id}/votes` | `VoteRequest` | `VoteTally` | one vote per member, changeable until decided |
| 40 | `GET /trips/{id}/split` | – | `SplitReport` | `?method=EQUAL\|BY_BUDGET` (proportional to each member's stated budget) |
| 41 | `GET /trips/{id}/regroup` | – | `RegroupSuggestion \| null` | needs ≥2 members sharing location |
| 42 | `PUT /trips/{id}/priorities` | `PrioritiesRequest` | `Plan` (active plan, priorities updated) | unknown item → 422; re-runs validation |
| 43 | `POST /trips/{id}/rebalance` | `RebalanceRequest` | `RebalancePreview` | `apply=true` needs `approve=true` + key (else 400 `APPROVAL_REQUIRED`); creates Plan A version+1 |
| 44 | `GET /trips/{id}/optionality` | – | `OptionalityReport` | – |
| 45 | `GET /trips/{id}/responsible` | – | `ResponsibleReport` | – |
| 46 | `POST /trips/{id}/share`, `DELETE /trips/{id}/share` | `{ttl_hours?: int}` | `ShareLink` / `{ok}` | token ≥ 128-bit random; default 24h; owner only |
| 47 | `GET /share/{token}` | – | `SharedTripView` | **public**, no auth; expired/revoked → 404; rate limited |
| 48 | `GET/POST /trips/{id}/trusted-contacts` | `TrustedContactCreate` | `TrustedContact[]` / `TrustedContact` | max 5 |
| 49 | `POST /trips/{id}/safe-checkins`, `POST /safe-checkins/{id}/confirm` | `SafeCheckinCreate` / – | `SafeCheckin` | missed → contacts notified by worker |
| 50 | `POST /trips/{id}/sos` | `SosRequest` | `SosResult` | works offline via queued replay (client retries with same `Idempotency-Key` header) |
| 51 | `GET /trips/{id}/offline-manifest` | – | `OfflineManifest` | version bumps whenever plan/bookings change |
| 52 | `GET /trips/{id}/offline-pack` | – | JSON bundle of everything in the manifest | – |
| 53 | `GET /advisor/trips` | – | `AdvisorTripRow[]` | role ADVISOR; only trips that invited this advisor |
| 54 | `GET /advisor/trips/{id}`, `POST /advisor/trips/{id}/notes` | – / `AdvisorNoteCreate` | `TripDetail` + `AdvisorNote[]` / `AdvisorNote` | read-only unless `advisor_consent`; acting without consent → 403 `CONSENT_REQUIRED` |
| 55 | `POST /trips/{id}/advisor` | `AdvisorInvite` | `Trip` | owner only; consent flag stored with timestamp in audit log |
| 56 | `POST /bookings/{id}/modify` | `ModifyBookingRequest` | `Booking` | quote/approve pattern identical to cancel |
| 57 | `GET /trips/{id}/signals` | – | `SignalView[]` | transparency |
| 58 | `GET /trips/{id}/evidence/pdf` | – | PDF | same content as print page |
| 59 | `GET /webhooks/whatsapp` | verify query | challenge echo | Meta verification handshake |
| 60 | `POST /webhooks/whatsapp` | provider payload | `{ok: true}` | **HMAC signature required**; unknown phone → polite reply, no data |
| 61 | `POST /trips/{id}/swap-item` | `SwapItemRequest` | `SwapPreview` | `apply=false` → preview (no change); `apply=true` needs `approve=true` + key (else 400 `APPROVAL_REQUIRED`); revalidates with the solver; infeasible → 422 `SOLVER_INFEASIBLE`; creates Plan A version+1 |

**Authentication and authorization (applies to every endpoint except 25, 28, 29, 47, 59, 60).**
- `Authorization: Bearer <jwt>`; HS256, 60-minute access token, `JWT_SECRET` from env. Passwords hashed with argon2/bcrypt. SSE uses the short-lived `sse_token` query parameter.
- Trip access = owner, **group member**, or **assigned advisor** (advisor: read + notes; actions only with `advisor_consent`). Anything else → 403 `FORBIDDEN` (404 if the trip should not be discoverable).
- Rate limits (slowapi): auth 5/min/IP, chat 30/min/user, others 120/min/user, public share 30/min/IP.
- Every consequential action (book, switch, cancel, modify, rebalance apply, SOS, share-link creation, advisor invite) writes an **audit log** row (`who, what, when, request_id, idempotency_key`).
- Group rule: only the trip **owner** can book, approve a switch or cancel; members can vote, edit their own preferences and confirm their own safe check-ins. (Owner may delegate nothing in this version.)

**Safety rule update.** Endpoints 4, 10, 18, 43 (apply), 56 and 61 (apply) are the **only** ones that change bookings or plans; all require explicit approval plus an idempotency key.

### B6.4 Error envelope

```json
{ "error": { "code": "PRICE_CHANGED", "message": "Fare for Cab COK→Munnar changed from ₹4,300 to ₹4,650.",
             "details": { "items": [{ "item_id": "it_a_t1", "old_inr": 4300, "new_inr": 4650 }] }, "request_id": "req_8f2c1a" } }
```
Frontend rule: show `message` as is, use `code` for behaviour (e.g. `PRICE_CHANGED` opens the re-confirm dialog).

### B6.5 SSE (`GET /trips/{id}/events`)

Envelope: `event: <type>` and `data: {"trip_id":"…","ts":"…","data": <payload>}`. Heartbeat comment every 15s. `Last-Event-ID` is not required.

| Event | Payload |
|---|---|
| `alert.created` | `Alert` |
| `slack.updated` | `SlackScore` |
| `switch.proposed` | `SwitchRecommendation` |
| `plan.switched` | `SwitchResult` |
| `draft.created` | `CourtesyDraft` |
| `booking.updated` | `Booking` |
| `sim.clock` | `{window, sim_now}` |
| `signal.created` | `Signal` |
| `plan.updated` | `{plan_id, kind, version, reason}` (e.g. Plan B warm-refresh or regeneration) |

### B6.5b Additional SSE events

| Event | Payload | Audience |
|---|---|---|
| `group.updated` | `Group` | members |
| `vote.updated` | `VoteTally` | members |
| `safe_checkin.due` | `SafeCheckin` | the member |
| `notification.sent` | `{channel, to_masked, alert_id, state}` | owner (delivery transparency) |

### B6.6 Concrete examples

**Chat request / response (stage PLANNED, abbreviated)**
```json
{ "message": "Plan a 5-day budget trip from Bengaluru for 2 people, early December, around ₹55,000. We like tea estates, waterfalls and sunsets.", "trip_id": null, "locale": "en" }
```
```json
{ "trip_id": "trip_01", "stage": "PLANNED",
  "assistant_message": "Here is a Munnar plan for 2 on ₹46,300 with ₹8,700 to spare. Your tightest link is the cab to Eravikulam (65 min of slack). A rain-safe Plan B is stored.",
  "intent": { "origin": "Bengaluru", "destination": "Munnar", "start_date": "2026-12-05", "nights": 4, "travellers": 2, "budget_inr": 55000,
              "interests": ["tea estates","waterfalls","sunsets"], "constraints": ["no night ghat driving"], "pace": "BALANCED", "must_dos": [], "missing": [] },
  "quick_replies": ["Book Plan A", "Make it cheaper", "More relaxed"], "destination_options": [],
  "plan_a": { "id": "plan_a1", "kind": "A", "version": 1, "total_cost_inr": 46300, "items": ["…"], "validation": { "feasible": true, "feasibility": 0.88, "min_slack_min": 65, "budget_headroom_inr": 8700, "checks": [{"name":"budget","passed":true,"detail":"₹46,300 of ₹55,000"}], "solver":"ortools-cp-sat", "solve_ms": 412 }, "…": "…" },
  "plan_b": { "id": "plan_b1", "kind": "B", "…": "…" }, "proposed_action": null }
```
Invalid chat: `{"message": ""}` → 422 `VALIDATION_ERROR`.

**Book**
```json
POST /trips/trip_01/book  { "plan": "A", "approve": true, "idempotency_key": "book-trip01-9f3a1c" }
→ { "status": "PENDING", "message": "3 confirmed, 1 pending hotel confirmation.",
    "bookings": [ { "id":"bk_1","item_id":"it_a_f1","status":"CONFIRMED","supplier_ref":"SIM-F-7721","amount_inr":8600,"refundable":false,"trip_id":"trip_01","plan_id":"plan_a1","failure_reason":null,"updated_at":"2026-11-22T10:00:00+05:30" },
                  { "id":"bk_4","item_id":"it_a_h1","status":"PENDING","supplier_ref":null,"amount_inr":16000,"refundable":true,"trip_id":"trip_01","plan_id":"plan_a1","failure_reason":null,"updated_at":"2026-11-22T10:00:01+05:30" } ] }
```

**Alert**
```json
{ "id":"al_7","trip_id":"trip_01","level":"ACTION_NEEDED","window":"T-3H","title":"Your flight is delayed 55 min",
  "body":"Eravikulam entry (last entry 15:45) is now at risk. Plan B recovers it with a MIXED switch.",
  "provenance":{"source":"Flight status feed (sim)","checked_at":"2026-12-05T04:40:00+05:30","is_simulated":true,"confidence":0.9},
  "recommended_action":{"action":"SWITCH_PLAN","label":"Review switch","params":{"recommendation_id":"sw_2"}}, "state":"NEW","created_at":"2026-12-05T04:40:02+05:30" }
```

**Switch decision**
```json
POST /switch/sw_2/decision { "decision": "APPROVE", "approve_draft_ids": ["dr_1","dr_2","dr_3"], "idempotency_key": "sw2-approve-77ad21" }
→ SwitchResult { "recommendation": { "state": "EXECUTED", "mode": "MIXED", "delta_cost_inr": 1800, "…": "…" }, "trip": {"active_plan":"A","…":"…"}, "plan_a": {"version": 2, "…": "…"}, "plan_b": {"version": 2, "…": "…"}, "bookings": ["…"], "drafts": ["… state SENT …"], "evidence_event_ids": ["ev_9","ev_10"] }
```

**Location + live**
```json
POST /trips/trip_01/location { "lat": 10.0261, "lng": 76.9170, "speed_kmh": 28, "ts": "2026-12-05T13:05:00+05:30" }
→ { "trip_id":"trip_01","as_of":"2026-12-05T13:05:00+05:30","tracking_on":true,"location":{"name":"Route","lat":10.0261,"lng":76.917},
    "next_commitment":{"item_id":"it_a_e1","title":"Eravikulam NP timed entry","arrive_by":"2026-12-05T15:45:00+05:30","eta_min":95,"slack_min":-10,"health":"RED"},
    "reroute_options":[{"id":"ro_1","mode":"SHIFT_SLOT","title":"Move Eravikulam to Day 2, 09:00","eta_min":null,"slack_min":720,"delta_cost_inr":400,"note":"Rebooking fee ₹400","provenance":{"source":"TBO Sandbox (sim)","checked_at":"2026-12-05T13:05:00+05:30","is_simulated":true,"confidence":1},"action":{"action":"SWITCH_PLAN","label":"Switch","params":{}}}],
    "geofence_prompt": null }
```

**Demo**
```json
POST /demo/inject?trip_id=trip_01 { "kind": "FLIGHT_DELAY", "params": { "minutes": 55 } }  →  { "signal_ids": ["sg_12"] }
POST /demo/clock?trip_id=trip_01  { "window": "T-3H" }  →  { "window": "T-3H", "sim_now": "2026-12-05T04:40:00+05:30" }
```

**Where inputs are stored/transformed.** Chat text → `chat_messages`; extracted `TripIntent` → `trips.intent`; Plans → `plans.data` (JSONB, full `Plan`); booking outcomes → `bookings`; injected/observed signals → `signals`; every state change → `evidence_events`; locations are kept only as the last ping per trip in `sim_state` (privacy: no history), deleted on `/demo/reset`.

### B6.6b More examples

**Register / login**
```json
POST /auth/login { "email": "traveller@demo.wf", "password": "demo1234" }
→ { "access_token": "eyJ…", "token_type": "bearer", "expires_in": 3600, "user": { "id": "usr_demo", "email": "traveller@demo.wf", "name": "Asha", "role": "TRAVELLER", "language": "en" } }
```
**Cost split (4 members, total ₹46,301 so rounding matters)**
```json
GET /trips/trip_g1/split?method=EQUAL → { "trip_id":"trip_g1","method":"EQUAL","total_inr":46301,"shares":[
  {"member_id":"usr_g1","name":"A","share_inr":11576,"item_ids":[]},{"member_id":"usr_g2","name":"B","share_inr":11575,"item_ids":[]},
  {"member_id":"usr_g3","name":"C","share_inr":11575,"item_ids":[]},{"member_id":"usr_g4","name":"D","share_inr":11575,"item_ids":[]}] }
```
(sum = 46,301 exactly; invalid example: shares that sum to 46,300 fail `test_split_sums_exactly`.)

**Modify quote then approve**
```json
POST /bookings/bk_3/modify { "approve": false, "new_start": "2026-12-06T09:00:00+05:30" }
→ 400 { "error": { "code": "APPROVAL_REQUIRED", "message": "Rebooking costs ₹400.", "details": { "fee_inr": 400, "new_price_inr": 1000, "available": true }, "request_id": "req_a1" } }
POST /bookings/bk_3/modify { "approve": true, "idempotency_key": "mod-bk3-4c9e11", "new_start": "2026-12-06T09:00:00+05:30" } → Booking
```
**WhatsApp inbound (provider payload normalised by P2 to this internal shape before the agent)**
```json
{ "from": "+919800000000", "text": "yes switch", "ts": "2026-12-05T04:44:00+05:30", "provider_msg_id": "wamid.HBg…" }
→ agent resolves pending recommendation sw_2 (age 4 min < 30) → asks "Confirm: switch to Plan B (+₹1,800, lose Mattupetty boating)? Reply YES SW2 to confirm." → only "YES SW2" executes.
```
**Offline manifest**
```json
{ "trip_id":"trip_01","version":7,"generated_at":"2026-12-04T20:00:00+05:30","expires_at":"2026-12-10T00:00:00+05:30",
  "resources":[{"url":"/api/v1/trips/trip_01/offline-pack","kind":"ITINERARY","bytes":48211},{"url":"/api/v1/vouchers/bk_1.html","kind":"VOUCHER","bytes":5120}] }
```

## B7. "Connected to what" map

Read each row left to right: screen/action → component (P1) → endpoint → route file → service (P2) → engine/agent call (P3) → tables → what displays the response.

| # | User action / screen | Frontend component | Endpoint | Route → Service | Engine / agent call | Tables | Displayed by |
|---|---|---|---|---|---|---|---|
| 1 | Send chat message | `chat/ChatPanel` | `POST /chat` | `chat.py` → `trip_service.handle_chat` | `agent.graph.run_turn` → `engine.planner.build_plan_pair` (inventory from `suppliers.registry`) | `trips`, `plans`, `chat_messages`, `evidence_events` | `ChatPanel` bubbles, `itinerary/ItineraryPanel`, `PlanCompare` |
| 2 | Open trip | `app/trips/[id]` | `GET /trips/{id}` | `trips.py` → `trip_service.get_detail` | `engine.slack.compute_slack` (cached) | `trips`, `plans`, `bookings`, `signals` | `HealthMeter`, `ItineraryTimeline`, `BookingList` |
| 3 | Compare Plan A/B | `itinerary/PlanCompare` | (data from #2) | – | – | – | Diff chips, validation proof list |
| 4 | Book plan | `bookings/BookDialog` | `POST /trips/{id}/book` | `booking.py` → `booking_service.book` | – (supplier adapter) | `bookings`, `evidence_events` | `BookingList` status chips, error toast for `PRICE_CHANGED` |
| 5 | Slack Score live | `guardian/HealthMeter` | `GET /trips/{id}/slack` + SSE `slack.updated` | `trips.py` → `pulse_service` | `engine.slack.compute_slack` | `signals` | Gauge + 5 component bars |
| 6 | Guardian feed | `guardian/GuardianFeed` | `GET /trips/{id}/alerts` + SSE `alert.created` | `alerts.py` → `pulse_service`, `pulse/checks.py` | – | `alerts`, `signals` | `AlertCard` by level |
| 7 | Alert one-tap action | `guardian/AlertCard` | `POST /alerts/{id}/ack` | `alerts.py` → `pulse_service.ack` | – | `alerts`, `evidence_events` | Card state change |
| 8 | Switch proposal | `switch/SwitchDecisionCard` | `GET /trips/{id}/switch` + SSE `switch.proposed` | `switch.py` → `switch_service.latest` | `engine.switch.evaluate` (run by Pulse) | `switch_recommendations` | A vs B comparison, lost items, delta cost |
| 9 | Approve switch | `switch/SwitchDecisionCard` | `POST /switch/{id}/decision` | `switch.py` → `switch_service.execute` | `engine.planner.regenerate_plan_b` | `plans`, `bookings`, `switch_recommendations`, `courtesy_drafts`, `evidence_events` | Timeline refresh, toasts, SSE `plan.switched` |
| 10 | Courtesy drafts | `drafts/DraftsDrawer` | `GET /trips/{id}/drafts`, `POST /drafts/{id}/decision` | `drafts.py` → `draft_service` | `agent.courtesy.draft_messages` (on proposal) | `courtesy_drafts` | Draft cards, WhatsApp-style preview |
| 11 | Live reroute | `live/LiveMap`, `live/CommitmentList` | `POST /trips/{id}/location`, `GET /trips/{id}/live` | `live.py` → `live_service` | `engine.live.reroute` | `sim_state`, `signals` | Map, slack chips, `RerouteOptionCard` |
| 12 | Evidence | `evidence/EvidenceTimeline` | `GET /trips/{id}/evidence` (+ `/print`) | `evidence.py` → `evidence_service` | `engine.evidence.build_pack` | `evidence_events`, `bookings` | Timeline + claim sections |
| 13 | Vouchers | `bookings/VoucherList` | `GET /trips/{id}/vouchers` | `vouchers.py` → `booking_service` | – | `bookings` | Voucher cards |
| 14 | Cancel booking | `bookings/CancelDialog` | `POST /bookings/{id}/cancel` | `booking.py` → `booking_service.cancel` | – | `bookings`, `evidence_events` | Status chip |
| 15 | Demo panel | `demo/DemoPanel` | `/demo/*` | `demo.py` → `sim_service` → `pulse_service.run` | slack + switch | `signals`, `trips`, all | Everything via SSE |
| 16 | Trips list | `app/trips` | `GET /trips` | `trips.py` | – | `trips` | Trip cards with health dot |
| 17 | Advisor console | `app/advisor` | `GET /trips` (+ `/slack` each) | same | – | – | Table sorted by health |
| 18 | Live updates | `hooks/useTripEvents` | `GET /trips/{id}/events` | `events.py` (Redis pub/sub or in-memory) | – | – | Invalidates TanStack queries |
| 19 | Login / register | `auth/LoginForm` | `POST /auth/login`, `/auth/register`, `GET /auth/me` | `auth.py` → `security.py` | – | `users` | `useAuth`, route guard |
| 20 | Notification settings | `app/settings` | `GET/PUT /me/preferences`, `POST /me/push-subscription` | `me.py` → `notification_service` | – | `notification_prefs`, `push_subscriptions` | Settings form |
| 21 | Group create / join / prefs | `group/*` | endpoints 34–38 | `groups.py` → `group_service` | `engine.group.merge_preferences` | `groups`, `group_members`, `group_prefs` | Members list, conflicts panel |
| 22 | Vote, split, regroup | `group/VotePanel`, `SplitTable`, `RegroupCard` | endpoints 39–41 | `groups.py` | `engine.group.split_cost`, `engine.group.regroup` | `votes` | Panels, SSE `vote.updated` |
| 23 | Rank priorities / rebalance | `priorities/PriorityBoard` | `PUT /priorities`, `POST /rebalance` | `priorities.py` | `engine.timebank.rebalance` | `plans` | Preview diff, apply dialog |
| 24 | Optionality | `bookings/OptionalityCard` | `GET /optionality` | `optionality.py` | `engine.optionality.report` | – | Flex vs saver table |
| 25 | Responsible tab | `responsible/*` | `GET /responsible` | `responsible.py` | `engine.responsible.report` | – | CO₂ chart, alternatives |
| 26 | Share, trusted contacts, safe check-in, SOS | `safety/*` | endpoints 46–50 | `share.py`, `safety.py` → timers in worker | – | `share_links`, `trusted_contacts`, `safe_checkins` | Safety panel, public `/share/[token]` |
| 27 | Offline pack | `offline/OfflineManager`, `sw.js` | `GET /offline-manifest`, `/offline-pack` | `offline.py` | – | `plans`, `bookings` | Offline banner, cached views |
| 28 | Advisor console | `advisor/*` | endpoints 53–55 | `advisor.py` | – | `advisor_notes`, `trips` | Table + read-only cockpit |
| 29 | Modify booking | `bookings/ModifyDialog` | `POST /bookings/{id}/modify` | `booking.py` | – | `bookings` | Quote then result |
| 30 | Voice input | `chat/VoiceButton` (`speech.ts`) | `POST /chat` (`input_mode=VOICE`) | `chat.py` | agent | – | Chat bubbles |
| 31 | WhatsApp inbound | – (phone) | `POST /webhooks/whatsapp` | `webhooks.py` → `notification_service` | `agent.graph.run_turn` (WhatsApp mode) | `chat_messages` | Reply on WhatsApp |
| 32 | Alert delivery | – | worker → `notify/*` | `pulse_service` | – | `alerts` | WhatsApp/push/email/in-app, `notification.sent` |
| 33 | Signals transparency | `guardian/WhyThis` | `GET /trips/{id}/signals` | `trips.py` | – | `signals` | "Why am I seeing this?" popover |
| 35 | Apply responsible alternative | `responsible/AlternativeCard` | `POST /trips/{id}/swap-item` | `responsible.py` → `trip_service.swap_item` | `engine.planner.swap_item` | `plans`, `bookings` | Preview diff → approve dialog |
| 34 | Evidence PDF | `evidence/DownloadPdf` | `GET /trips/{id}/evidence/pdf` | `evidence.py` | `engine.evidence.build_pack` | `evidence_events` | File download |

**Disconnected / future on purpose:** real payments, real ticket issuance, native apps, location history (none of these exist by design). Everything else in this map is built and acceptance-tested in B11.

```
chat ─▶ /chat ─▶ agent(Gemini|mock) ─▶ engine.planner(OR-Tools) ─▶ Plan A/B ─▶ DB ─▶ UI
worker(beat) ─▶ providers(weather, OSRM, news, flights) ─▶ Signal ─▶ Pulse ─▶ slack ─▶ switch.evaluate ─▶ Alert + Recommendation + Drafts ─▶ SSE + WhatsApp/push/email
approve ─▶ /switch/decision ─▶ supplier cancel/rebook (idempotent) ─▶ Plan A v2 + regenerate B ─▶ Evidence ─▶ UI
WhatsApp reply ─▶ webhook(HMAC) ─▶ agent ─▶ two-step approval ─▶ same switch execution path
```

## B8. Phases, work allocation and dependency matrices

### Phase plan (planned as ~6 weeks; keep the order, scale the durations)

Each phase ends with a **gate**: merge to `main`, `make test golden` green, the listed acceptance items ticked in B11, a 15-minute team demo. No phase starts its feature work until the previous gate passes, except frontend work that runs on fixtures.

| Phase | Window | Theme | P1 Frontend | P2 Backend | P3 Engine/agent/contracts | Gate (B11) |
|---|---|---|---|---|---|---|
| **0 Foundations** | Days 1–3 | Contracts first | Scaffold, tokens, UI kit, fixtures mode, auth pages | Compose, DB, Alembic, all routes on stub engine, auth skeleton | `models.py`, generated `types.ts`, fixtures for **every** endpoint, stubs, CI, contract tests | AC-01, 20 |
| **1 Core slice** | Week 1 | Chat → plan → book | Plan workspace, proof list, book dialog, vouchers, cancel/modify dialogs | Chat service, booking (idempotent), supplier mock + TboLive spike, vouchers, modify/cancel quotes | CP-SAT planner + Plan B v1, agent (mock + Gemini), validator, inventory for Munnar | AC-02..06, 16 |
| **2 Guardian** | Week 2 | Watch the trip | Cockpit, HealthMeter, GuardianFeed, SSE hook, settings (prefs) | Celery worker+beat, Journey Pulse, providers (Open-Meteo, OSRM, news, flight status), Local Pulse ingestion, notification prefs, in-app alerts | Slack Score, feasibility, Local Pulse classifier + rules, alert wording | AC-07, 08, 21, 22 |
| **3 Twin Plans and recovery** | Week 3 | Defend and recover | Switch card, drafts drawer, priorities UI, live map, evidence + PDF, optionality card | Plan-B warm refresh job, switch execution, drafts + send, live service, evidence service + PDF | Switch Engine FULL+MIXED, Time Banking, Courtesy, Optionality, Live reroute, Evidence | AC-09..15, 23..25 (delete `stubs.py`) |
| **4 People and channels** | Week 4 | Groups, advisors, notifications | Group UI (invite, prefs, vote, split, regroup), advisor console, notification settings | Auth hardening, groups, advisor + consent, push/email/WhatsApp outbound, audit log, rate limits | Group merge + split + regroup logic, per-audience alert logic | AC-26..31 |
| **5 Reach and responsibility** | Week 5 | WhatsApp, Hinglish, offline, safety, green | i18n (en, hi), voice input, PWA + offline pack, SOS/share/safe check-in UI, responsible tab | WhatsApp inbound webhook, offline manifest/pack, share/safe-checkin/SOS + timers, responsible endpoint | Hinglish/hi templates, WhatsApp intent routing + two-step approval logic, responsible layer, multi-city planner, 4 more destinations | AC-32..38 |
| **6 Hardening and delivery** | Week 6 | Make it unbreakable | A11y audit, responsive polish, empty/error audit, perf (bundle, LCP) | Security review, perf tuning, backup/restore, deploy configs, observability | LLM evals, load tests, e2e full suite, docs, demo script, video state script | AC-39..44 and all |

### Work matrix

| Feature / deliverable | Primary | Support | Files touched | Inputs | Outputs | Depends on | Acceptance | Integration point | Conflict risk |
|---|---|---|---|---|---|---|---|---|---|
| Contracts + fixtures + generated types | P3 | P1, P2 review | `contracts/*`, `scripts/gen_types.py` | this doc | `models.py`, `types.ts`, fixtures | – | AC-20 | tag `contracts-v1` | Low |
| F1/F2 Chat + proof plans | P3 | P2 wiring, P1 UI | `agent/*`, `engine/planner.py`, `trip_service`, `chat/*` | `ChatRequest`, `Inventory` | `ChatResponse` | contracts | AC-02, 03, 17 | `POST /chat` | Med |
| F3/F18 Booking, vouchers, modify, cancel | P2 | P1 UI | `booking_service`, `suppliers/*`, `bookings/*` | `BookRequest` etc. | `BookResult`, `Booking` | contracts | AC-04..06, 16 | `/trips/{id}/book` | Med |
| F4/F13 Pulse, providers, Local Pulse | P2 | P3 classifier | `worker/*`, `pulse_service`, `providers/*`, `agent/localpulse_*` | signals | Alerts, SSE | slack | AC-07, 21, 22 | Celery tasks | Med |
| F8 Slack Score + health meter | P3 | P1 UI, P2 call | `engine/slack.py`, `HealthMeter` | Plan + Signals | `SlackScore` | planner | AC-08 | `slack.updated` | **High** (tuned vs seed) |
| F5/F6 Twin Plans + Switch | P3 | P2 execute, P1 card | `engine/switch.py`, `planb_service`, `switch_service`, `switch/*` | Plans, Signals | `SwitchRecommendation`, `SwitchResult` | slack | AC-09, 10, 12, 23 | `/switch/{id}/decision` | **High** |
| F9 Time Banking + priorities | P3 | P1, P2 | `engine/timebank.py`, `priorities/*`, `priorities.py` | priorities | `RebalancePreview` | planner | AC-24 | `/rebalance` | Med |
| F10 Courtesy | P3 | P2 send, P1 UI | `agent/courtesy.py`, `draft_service`, `drafts/*` | rec | `CourtesyDraft[]` | agent | AC-11, 31 | `draft.created` | Med |
| F11 Evidence + PDF | P3 | P2, P1 | `engine/evidence.py`, `evidence_service`, `evidence/*` | events | `EvidencePack`, PDF | switch | AC-14 | `/evidence(/pdf)` | Low |
| F12 Optionality | P3 | P1 | `engine/optionality.py`, `optionality.py`, card | Plan, signals | `OptionalityReport` | planner | AC-25 | `/optionality` | Low |
| F7 Live reroute | P3 | P2, P1 | `engine/live.py`, `live_service`, `live/*`, `providers/eta_osrm.py` | `LocationPing` | `LiveStatus` | planner, ETA | AC-13 | `/location` | Med |
| F14 WhatsApp, Hinglish, voice | P2 (channel) | P3 agent, P1 voice | `notify/whatsapp.py`, `webhooks.py`, `agent/i18n.py`, `speech.ts` | webhook payload | replies, alerts | agent | AC-31..34 | `/webhooks/whatsapp` | Med |
| F15 Offline, SOS, share | P1 (PWA) | P2 | `pwa.ts`, `sw.js`, `offline.py`, `share.py`, `safety.py` | manifest | cached app, SOS | contracts | AC-35, 36 | `/offline-*`, `/share/*` | Med |
| F16 Group | P3 (logic) | P2 API, P1 UI | `engine/group.py`, `groups.py`, `group/*` | prefs, votes | merged, split, regroup | auth | AC-28 | `/group*` | **High** |
| F17 Responsible | P3 | P1 | `engine/responsible.py`, `responsible.py`, tab | Plan | `ResponsibleReport` | planner | AC-37 | `/responsible` | Low |
| F19 Advisor | P2 | P1 | `advisor.py`, `advisor/*` | consent | rows, notes | auth | AC-29 | `/advisor/*` | Low |
| F20/F21 Accounts, prefs, push, email | P2 | P1 | `security.py`, `notify/*`, `auth/*`, `settings/*` | prefs | delivery | – | AC-26, 27, 30 | `/auth`, `/me` | Med |
| F22 Delivery | P3 | P2 | `.github`, `deploy/`, `tests/e2e`, `tests/load`, `docs/*` | – | CI, images, docs | all | AC-39..44 | – | Low |

### Dependency matrix

| Stream | Needs from P1 | Needs from P2 | Needs from P3 | Can start with |
|---|---|---|---|---|
| **P1** | – | Real endpoints per phase (fixtures until then); SSE shapes unchanged | `types.ts` + **all** fixtures at Phase 0 | Fixtures mode |
| **P2** | Nothing | – | `models.py` at Phase 0; stubs at Phase 0; each engine/agent function at the phase listed above | Stub engine (`ENGINE_IMPL=stub`) |
| **P3** | Stable `data-testid`s (for e2e) | Inventory loader + persisted shapes; real provider adapters for integration tests | – | Pure fixtures |

## B9. Merge conflict prevention and integration procedure

**Rules**
1. **Ownership beats convenience.** Edit only files you own (B4). Need something elsewhere? Use the change request (CR).
2. **Contract-first.** After tag `contracts-v1` (Phase 0), shapes change only through a CR. Types are generated, so a CR is a `models.py` edit + `make gen-types`.
3. **Branches.** `main` (always runnable, protected), `feat/p1-*`, `feat/p2-*`, `feat/p3-*` (short-lived, one feature each), tags `contracts-vN` and `phase-N-done`. Worktrees: `git worktree add ../wf-p2 feat/p2-pulse`.
4. **Pull requests.** Keep them under ~400 changed lines; one feature (`F#`) per PR; squash-merge; CI must pass (lint, unit, contract, golden); one teammate approves (contract or golden impact must be approved by P3).
5. **Sync.** Rebase on `origin/main` at least daily and always before opening a PR: `git fetch && git rebase origin/main`.
6. **Merge order inside a phase gate:** P3 (contracts/engine) → P2 (backend) → P1 (frontend) → P3 (e2e/docs). Next person rebases on the result.
7. **Database migrations (Alembic)** are linear. Only P2 creates them; one migration per PR; if two heads appear, P2 merges them (`alembic merge`).
8. **Never** commit `.env`, secrets, `node_modules`, `.venv`, DB dumps, large binaries. A `gitleaks` check runs in CI.
9. **Formatting:** Python `ruff` (config P2), TypeScript `prettier` + `eslint` (config P1). CI enforces; no style debates.

**Change request protocol.**
1. Append to `docs/CHANGE_REQUESTS.md`: `CR-n | who | what changes (field/endpoint) | why | who must change code | urgency`. Post in chat.
2. The other two reply 👍 or object within **4 working hours** (30 minutes if marked *blocking*; silence = 👍).
3. P3 applies it in one commit: `models.py` + regenerated `types.ts` + affected fixtures + contract tests, bumps `CONTRACT_VERSION` (patch = additive optional field, minor = new endpoint/model, major = breaking, only at phase boundaries), merges, pings.
4. Everyone rebases before using the new shape. **Nobody implements a changed shape before the CR is merged.**
5. If your code no longer matches the contract: stop; conform or file a CR. `tests/contract` and Schemathesis in CI fail on drift.

**Two people must edit one file.** The owner makes the edit (or accepts a commit authored by the requester on the owner's branch). Never both on the same lines in different branches. On a textual conflict the **file owner resolves**, keeps both intents, runs tests, and tells the other person.

### Conflict matrix

| File / area | Owner | Likely conflicting contributors | Prevention rule | Resolution |
|---|---|---|---|---|
| `contracts/*` | P3 | P1, P2 | Only P3 commits; CR protocol | P3 reconciles, bumps version |
| `frontend/package.json`, lockfile | P1 | P3 | P3's e2e/load deps live in `tests/e2e/package.json` | P1 regenerates lockfile |
| `frontend/src/i18n/*.json` | P1 | P3 (agent strings) | Agent templates live in `agent/i18n.py`; UI strings only in P1 files | P1 |
| `frontend/public/sw.js` / PWA config | P1 | P2 (manifest content) | P2 only changes the manifest API, never the SW | P1 |
| `backend/requirements.txt` | P2 | P3 | P3 deps only in `requirements-engine.txt` | P2 merges |
| `requirements-engine.txt` | P3 | P2 | P2 asks via CR | P3 |
| `backend/app/main.py` (router registration) | P2 | P3 | Routes self-contained; P3 asks for registration | P2 |
| `backend/alembic/versions/*`, `models_db.py` | P2 | P3 | P3 never touches DB; needs a table → CR | P2 merges heads |
| `docker-compose*.yml`, `deploy/*` | P2 | P3 (CI uses them) | P3 requests changes | P2 |
| `.github/workflows/*`, `Makefile`, `.env.example` | P3 | P1, P2 | `.env.example` has per-person blocks (each edits only own); Makefile targets prefixed `p1-`/`p2-`/`p3-` except shared | Owner merges |
| `frontend/src/app/layout.tsx`, `globals.css`, `tailwind.config.ts`, `styles/tokens.css` | P1 | none | Single owner | – |
| `frontend/src/lib/api/*` | P1 | P3 (fixtures) | Fixtures live in `contracts/fixtures`, read-only for P1 | P1 |
| `contracts/fixtures/inventory_*.json`, `golden_*.json` | P3 | P2 (seed) | P2 reads only; extra decoys in `backend/seed/` | P3 + P2 re-run golden |
| `backend/seed/*` | P2 | P3 | P2 runs `make golden` before merging seed changes | P2 fixes or CR to P3 |
| `engine/config.py` (tuning constants) | P3 | P2 | P2 asks for threshold tweaks | P3 |
| `backend/app/notify/*` templates vs `agent/i18n.py` | P2 / P3 | each other | Message *content* is P3 (agent/i18n); *delivery* is P2 | owner of the layer |
| `README.md`, `docs/*` | P3 | all | Others send text via chat/CR; may append only to `CHANGE_REQUESTS.md`, `AI_TOOLS_USED.md`, and their section in `SECURITY.md` | P3 |
| `tests/e2e/*` | P3 | P1 (`data-testid`) | P1 keeps test ids from the P1 packet stable (renames need a CR) | P3 |

## B10. Setup, seed data and run instructions

**Prerequisites:** Node 20+, Python 3.11+, Docker.

```bash
cp .env.example .env              # defaults run fully offline (mock LLM, sim signals, mock supplier, sim notify)
make db-up                        # postgres + redis (+ optional osrm profile)
make install                      # backend deps, engine deps, npm ci (frontend, tests/e2e)
make migrate                      # alembic upgrade head
make seed                         # demo users, golden trip, 5 destinations of inventory
make dev                          # api :8000, celery worker, celery beat, web :3000
make test                         # engine, agent, backend unit + contract tests
make golden                       # golden + secondary scenario tests (must stay green)
make gen-types                    # regenerate contracts/types.ts from models.py
make e2e                          # Playwright suites (needs make dev running)
make load                         # load test
make lint                         # ruff, eslint, prettier --check, gitleaks
make up-prod                      # production-like compose (built images)
make reset                        # POST /demo/reset
```

**Demo accounts (seeded):** `traveller@demo.wf / demo1234`, `advisor@demo.wf / demo1234`, group members `g1@demo.wf … g4@demo.wf / demo1234`.

**Environment variables (`.env.example`, one block per person)**

| Block | Variable | Default | Meaning |
|---|---|---|---|
| P1 | `NEXT_PUBLIC_API_BASE` | `http://localhost:8000/api/v1` | API base |
| P1 | `NEXT_PUBLIC_API_MODE` | `live` | `live` or `fixtures` |
| P1 | `NEXT_PUBLIC_DEMO_MODE` | `1` | Demo panel hotkey |
| P1 | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | empty | Web push |
| P2 | `DATABASE_URL` | `postgresql+psycopg://wayfinder:wayfinder@localhost:5432/wayfinder` | DB |
| P2 | `REDIS_URL` | `redis://localhost:6379/0` | Cache, pub/sub, Celery broker (required) |
| P2 | `JWT_SECRET`, `JWT_TTL_MIN` | dev secret, `60` | Auth (prod must override; startup fails if default in prod) |
| P2 | `DEMO_MODE` | `1` | Enables `/demo/*` |
| P2 | `SUPPLIER` | `mock` | `mock`, `tbo_live`, `hybrid` |
| P2 | `TBO_BASE_URL`, `TBO_USERNAME`, `TBO_PASSWORD`, `TBO_CLIENT_ID` | empty | Live adapter |
| P2 | `SIGNAL_SOURCE` | `sim` | `sim`, `live`, `hybrid` |
| P2 | `OSRM_URL` | `https://router.project-osrm.org` | ETA provider; self-host for reliability |
| P2 | `FLIGHT_STATUS_PROVIDER`, `FLIGHT_STATUS_API_KEY` | empty | Real flight status |
| P2 | `NEWS_FEEDS` | curated RSS list | Local Pulse sources |
| P2 | `NOTIFY_MODE` | `sim` | `live` or `sim` |
| P2 | `WHATSAPP_PROVIDER`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | empty | Meta Cloud API or Twilio |
| P2 | `SMTP_URL`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | empty | Email, web push |
| P2 | `PULSE_INTERVAL_SEC`, `PLANB_REFRESH_MIN` | `30`, `30` | Worker cadence |
| P2 | `SUPPLIER_PRICE_DRIFT`, `SUPPLIER_FAIL_REBOOK` | empty, `0` | Failure injection (tests/demo) |
| P3 | `LLM_MODE` | `mock` | `mock` or `gemini` |
| P3 | `GEMINI_API_KEY`, `GEMINI_MODEL` | empty, `gemini-flash-latest` | Verify the model name for your key |
| P3 | `ETA_PROVIDER` | `haversine` | `haversine` / `osrm` |
| P3 | `ENGINE_GOLDEN_FALLBACK` | `0` | Demo insurance only; **off by default** |

**Seed data.** `make seed` creates users, the golden trip `trip_golden` (PLANNED, unbooked), group trip `trip_g1` (4 members), 6 advisor client trips in mixed health, inventory for 5 destinations. `POST /demo/seed-trip` re-creates the golden trip; `POST /demo/reset` wipes and reseeds.

### Cost: building and demoing everything for free

The default configuration (`LLM_MODE=mock`, `SIGNAL_SOURCE=sim`, `NOTIFY_MODE=sim`, `SUPPLIER=mock`) needs **no money and no accounts**. Every paid or credential-gated service is an optional switch. Free-tier limits and terms change, so verify each at the time you switch it on.

| Need | Free option used | Limits and notes |
|---|---|---|
| Core stack (Next.js, FastAPI, Postgres, Redis, Celery, OR-Tools, LangGraph, Playwright, k6, WeasyPrint) | Open source, runs in local Docker | Free |
| LLM | `LLM_MODE=mock` (no network); optionally a Gemini API key from Google AI Studio | Free tier has rate and daily limits and its data-use terms can change; the product must pass the whole golden journey without it |
| Weather | Open-Meteo | Free for non-commercial use, no key |
| Routing / ETA | Public OSRM demo server, or self-hosted OSRM in Docker | Public server is fair-use only (no heavy load); self-hosting is free but needs a region extract and RAM. No live traffic either way (traffic jams stay simulated and labelled) |
| Maps | MapLibre GL + a **PMTiles extract of OpenStreetMap data** (`scripts/make_pmtiles.sh`, `make maps`) | Free and offline-capable. **Do not prefetch tiles from tile.openstreetmap.org** (their policy forbids bulk/offline use). Show "© OpenStreetMap contributors". Pick the max zoom to keep the file small (about 12) and verify the size |
| Local events | Public RSS feeds | Free; respect each site's terms and rate limits |
| Flight status | Simulated by default | Real providers have small free tiers with tight request caps: use only for a rehearsed demo |
| WhatsApp | Simulated outbox by default | Meta's test number or Twilio sandbox are free for testing with a few pre-registered recipients; real production sending needs business verification and can cost money |
| Email | Simulated, or Gmail app-password SMTP / Mailtrap free | Free with sending limits |
| Web push | VAPID keys, no provider | Free; needs HTTPS or localhost |
| Voice input | Browser Web Speech API | Free, works mainly in Chromium browsers, audio is processed by the browser vendor's service; the button hides where unsupported |
| TBO inventory | Credentials from the organisers | Normally provided for the event; otherwise mock |
| Hosting | Local Docker, plus a free tunnel (e.g. Cloudflare Tunnel) for a public demo URL | Free. For always-on hosting the weak spot is the **Celery worker + beat + Redis**: free hosts often sleep or cap Redis commands, so treat a laptop demo as the safe default and an always-free VM as a bonus (availability varies) |
| CI | GitHub Actions | Free for public repos; private repos have a monthly free allowance |
| Not used | Google Maps/Routes (`ETA_PROVIDER=google`) | Paid and needs a card; only if you choose it |

**Verification status.** Nothing in this document has been implemented or tested yet (only the contract models have been import-checked). Every check is a **planned check** until someone runs it and ticks it in B11.

## B11. End-to-end acceptance checklist

Tick only after running it. `[ ]` = planned check.

| ID | Phase | Check | Pass when |
|---|---|---|---|
| AC-01 | 0 | Clean start | `make db-up migrate seed dev` → `/health` ok, `contract_version` matches, UI loads without console errors |
| AC-02 | 1 | Chat → plan (mock LLM) | Golden request returns Plan A + B < 15s; every item shows price, source, freshness |
| AC-03 | 1 | Clarify and validation | "plan a trip" → ≤2 follow-ups → PLANNED; empty message rejected with visible text; destination options shown when none given |
| AC-04 | 1 | Book with approval | UI dialog; API refuses `approve=false` with `APPROVAL_REQUIRED` |
| AC-05 | 1 | Honest booking states | CONFIRMED + PENDING shown; PENDING → CONFIRMED via SSE without refresh |
| AC-06 | 1 | Idempotency and price change | Same key → same bookings, no DB duplicates; forced drift → `PRICE_CHANGED` dialog |
| AC-07 | 2 | Pulse windows | Clock T-72h → T-24h → T-3h produce the B5 alerts with source+freshness in the right level; only ACTION_NEEDED/CRITICAL toast |
| AC-08 | 2 | Slack Score | GREEN baseline, AMBER at `FLIGHT_DELAY 55`, RED at 120; five components; equals `/slack` |
| AC-09 | 3 | Switch proposal | Arrives via SSE ≤5s; A 0.45–0.65, B ≥ 0.90, MIXED, delta ₹1,200–2,400, lost items with priority |
| AC-10 | 3 | Approve switch | Kept bookings unchanged (same ids); changed ones cancelled/rebooked; Plan A v2; Plan B regenerated; never switches before approval |
| AC-11 | 3 | Courtesy drafts | 3 drafts exist before the card is opened; edit works; approve → send via notification layer (SENT, labelled if sim) |
| AC-12 | 3 | Failure safety | `SUPPLIER_FAIL_REBOOK=1` → 502, active plan unchanged, rec FAILED, UI recovery text |
| AC-13 | 3 | Live reroute | Real OSRM ETA (or labelled fallback); `TRAFFIC_JAM 25` → ≥1 option with cost delta; tracking indicator accurate |
| AC-14 | 3 | Evidence pack | Timeline with delay source, booking refs, ₹ extra cost, 3 claim sections (no eligibility asserted); print page and PDF match |
| AC-15 | 3 | Demo panel | Hotkey `D`; clock, inject, drive, reset all work |
| AC-16 | 1 | Post-booking | Chat answers from the Twin; vouchers only for CONFIRMED; modify and cancel show a quote then need approval |
| AC-17 | 6 | Offline-LLM safety | Full golden journey with `LLM_MODE=mock`, `SIGNAL_SOURCE=sim`, no internet |
| AC-18 | 6 | Accessibility | Keyboard-only path chat → book → switch approve; focus visible; alerts not colour-only; contrast ≥ 4.5:1; axe has no serious issues |
| AC-19 | 6 | Responsive | 375/768/1280 px: no horizontal scroll; switch card and timeline usable |
| AC-20 | 0 | Contract parity | Fixtures validate; `make gen-types` produces no diff; Schemathesis conforms |
| AC-21 | 2 | Real providers | Weather call returns real data labelled real; OSRM ETA real; network off → labelled sim fallback, no crash |
| AC-22 | 2 | Local Pulse | Sample "bandh" RSS item → signal with source + confidence; low confidence → INFO only; duplicates deduped |
| AC-23 | 3 | Plan B warm | Worker re-checks Plan B prices/availability every `PLANB_REFRESH_MIN`; Plan B version updates; stale > 2× interval is flagged in UI |
| AC-24 | 3 | Time Banking | Ranking Must/Nice/Skip persists; rebalance preview protects MUSTs, drops lowest value first; apply needs approval |
| AC-25 | 3 | Optionality | Report marks high-risk legs, recommends FLEX only when expected loss > premium, totals with and without risk shown |
| AC-26 | 4 | Auth | Register/login; 401 without token; 403 on another user's trip; login throttled; SSE token works |
| AC-27 | 4 | Notification prefs | Quiet hours batch INFO/NUDGE; CRITICAL bypasses; sensitivity LOW suppresses NUDGE; channels respected |
| AC-28 | 4 | Group | Invite code join; conflicts listed with resolutions; vote tally; split sums exactly; only affected members get an alert; only owner can book/approve |
| AC-29 | 4 | Advisor | Dashboard sorted by health; read-only without consent; action without consent → `CONSENT_REQUIRED`; notes saved |
| AC-30 | 4 | Push and email | Delivery (live or sim) with `notification.sent` events; failures retried with backoff, then marked failed |
| AC-31 | 4 | WhatsApp outbound | Approved draft/alert sent (live) or outbox entry (sim) with right template and language |
| AC-32 | 5 | WhatsApp inbound | Bad signature rejected; "status" answered from Twin; switch needs `YES SW<n>`; expires after 30 min; unknown number gets no data |
| AC-33 | 5 | Hinglish/Hindi | UI language switch; drafts and alerts in Hinglish pass the guard (names, times unchanged) |
| AC-34 | 5 | Voice | Voice input fills chat in supported browsers; clean fallback otherwise; Hinglish recognised acceptably on the eval set |
| AC-35 | 5 | Offline | After pack download, with network off: itinerary, vouchers, Plan B, contacts load; app shell opens; offline banner shown |
| AC-36 | 5 | SOS and sharing | SOS queues offline and sends on reconnect; missed check-in notifies contacts; share link exposes no PII, expires, revocable |
| AC-37 | 5 | Responsible | CO₂ total and by mode; alternatives revalidated; method/version shown |
| AC-38 | 5 | Multi-city and destinations | Kochi→Munnar→Alleppey plan valid with inter-city transfers; all 5 destinations plan without errors |
| AC-39 | 6 | Security | No secrets in repo; authz matrix test passes; SQLi/XSS probes fail safely; HMAC webhooks; prod refuses default `JWT_SECRET`; dependency audit clean of high severity |
| AC-40 | 6 | Performance | p95 < 300 ms for non-LLM endpoints at 50 concurrent users; chat < 15s (mock) / < 25s (Gemini); Pulse run < 2s; LCP < 2.5s on the plan page |
| AC-41 | 6 | Reliability | Kill worker mid-Pulse → no duplicate alerts or bookings after restart; DB restore from backup works |
| AC-42 | 6 | LLM evals | ≥ 90% intent accuracy on the golden prompt set; 0 guard violations across 200 generations |
| AC-43 | 6 | Deployment | CI green; `make up-prod` or documented cloud deploy works from scratch |
| AC-44 | 6 | API fuzz | Schemathesis run produces no 500s |

**Done means:** every AC passes, or a deviation is written in `README.md` with the reason and an owner.

## B12. Risks, open decisions and recommended defaults

| Risk / open decision | Recommended default | Owner |
|---|---|---|
| TBO credentials may not arrive | Build `TboLiveAdapter` against the supplied docs with recorded responses in `suppliers/recorded/`; `SUPPLIER=hybrid` once creds exist; mock stays for tests and offline demo | P2 |
| Public OSRM server rate-limits or goes down | Retry + 15-minute route cache; labelled haversine fallback; optional self-hosted OSRM compose profile | P2 |
| Flight-status APIs are paid/limited | Provider is pluggable; simulated source stays labelled; real source used only if a key exists | P2 |
| WhatsApp business onboarding is slow | Twilio sandbox first; sim outbox otherwise; identical code path | P2 |
| Local-event classification false positives | Confidence threshold; low confidence → INFO only; every signal shows its source link; human-readable "why am I seeing this" (endpoint 57) | P3 |
| Solver tuning vs seed drift | `make golden` green before any PR touching seed, `engine/config.py`, inventory; tuning only by P3 | P3 |
| Group trust: who can spend money | Owner-only booking/approval; stated in UI and contract | all |
| Privacy of location and share links | Latest point only; no PII in share view; tokens 128-bit, expiring, revocable; documented in `SECURITY.md` | P2 |
| Gemini cost/latency/availability | Mock default; 8s timeout then fallback; cache identical prompts; guard everywhere | P3 |
| PWA offline correctness | Versioned pack, stale-while-revalidate for app shell, explicit "offline" banner and last-sync time | P1 |
| Scope creep with lots of time | Feature list is B2 F1–F22 only; new ideas go to a `docs/BACKLOG.md` and need a CR | team |
| Map tile policy: public OSM tile servers forbid bulk/offline use | Self-hosted PMTiles extract rendered with MapLibre; attribution shown; no per-tile prefetch | P1, P3 |
| Free-tier hosting cannot run Celery + Redis reliably | Local Docker is the demo default; always-on is optional; `docker-compose.prod.yml` stays portable | P2 |
| Fourth teammate | Owns pitch, demo script, backup video, user testing sessions (5 people) | team |
| Open: deployment target | Default: Docker compose locally + one cloud deploy (frontend on Vercel, API/worker on Render/Fly, Neon Postgres, Upstash Redis) | P2 |

