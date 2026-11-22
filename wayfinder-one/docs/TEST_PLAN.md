# WAYFINDER ONE — Test Plan & Verification Matrix

## 1. Automated Suites

| Suite | Command | Scope & Guarantees |
|---|---|---|
| Contract & Type Parity | `pytest tests/contract -q` + `python scripts/gen_types.py` | Zero TS drift across 98 interfaces; all 40+ fixtures & stubs validate against `contracts/models.py`. |
| Golden & Secondary Scenarios | `make golden` (`pytest engine/tests/test_golden_scenario.py -q`) | Golden Munnar scenario (baseline GREEN ≥ 0.85; `FLIGHT_DELAY 55` → AMBER, 0.45–0.65, MIXED +₹1,800, lost Mattupetty; `FLIGHT_DELAY 120` → RED) plus S-G, S-R, S-M, S-O2, S-W, and all 5 destinations. |
| Engine Unit, Property & Purity | `pytest engine/tests/test_engine_unit.py -q` | Hypothesis split-sum invariant (`EQUAL`/`BY_BUDGET`), determinism, `Infeasible`, Time Banking `MUST` protection, Live geofences, Evidence non-eligibility, AST purity (no clock/DB/network). |
| Agent Unit & Local Pulse | `pytest agent/tests/test_agent.py -q` | LangGraph routes (`CLARIFYING`, `RECOMMENDING`, `PLANNED`, `TRIP_QA`, `CANCEL`), fact guards, multilingual courtesy drafts, 46 i18n keys × 3 languages, ≥ 60 Local Pulse news samples. |
| LLM Evals & Guard Stress | `python -m agent.evals.run_evals` | 64 multilingual/voice/vague prompts (`>= 90%` intent field accuracy) and `>= 200` guard checks (`0` violations). |
| Smoke Script | `python scripts/smoke.py` | End-to-end offline contract+engine+agent flow (`--live` hits running FastAPI endpoints). |
| E2E & Accessibility | `make e2e` (`tests/e2e/golden.spec.ts`) | Playwright golden flow, 4-context group flow, advisor consent, offline PWA, HMAC WhatsApp webhook, `@axe-core/playwright`. |
| Load Test | `make load` (`tests/load/golden.js`) | k6 50 concurrent VUs checking p95 < 300 ms on read endpoints, < 2000 ms on Pulse. |

## 2. Acceptance Criteria Coverage (`AC-01` – `AC-44`)

- **P3 Verified Offline (Contracts, Engine, Agent, Evals):** AC-02, AC-03, AC-08, AC-09, AC-11 (draft logic), AC-13 (reroute/geofence logic), AC-14 (evidence pack logic), AC-17, AC-20, AC-22 (classifier + rules), AC-24 (timebank logic), AC-25 (optionality logic), AC-28 (group merge/vote/split/regroup/audience logic), AC-32 (WhatsApp two-step approval logic), AC-33 (Hinglish/Hindi i18n & guard compliance), AC-37 (responsible CO₂ & swap logic), AC-38 (multi-city + all 5 destinations), AC-42 (evals ≥ 90% accuracy, 0 guard violations).
- **Full-Stack Integration Gates (when P1 + P2 stacks are running):** AC-01, AC-04..07, AC-10, AC-12, AC-15, AC-16, AC-18, AC-19, AC-21, AC-23, AC-26, AC-27, AC-29..31, AC-34..36, AC-39..41, AC-43, AC-44.
