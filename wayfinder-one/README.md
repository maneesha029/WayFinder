# WAYFINDER ONE

*The travel agent that doesn't stop working after you book.* VoyageHack 4.0 (TBO) — Problem Statement 3: Virtual Travel Agent / Travel Agent Copilot.

**Core principle:** *LLM reasons, solver certifies, supplier layer books, traveller approves every consequential action.*

## Repository Layout

- `contracts/` (`P3`) — Pydantic v2 canonical models (`models.py`), generated TypeScript types (`types.ts`), error catalog (`errors.md`), and validated fixtures/inventories (`fixtures/`).
- `engine/` (`P3`) — Pure, deterministic Python decision and OR-Tools CP-SAT optimization libraries (`planner.py`, `multicity.py`, `validator.py`, `slack.py`, `switch.py`, `timebank.py`, `live.py`, `evidence.py`, `optionality.py`, `group.py`, `responsible.py`, `localpulse_rules.py`).
- `agent/` (`P3`) — LangGraph conversational agent, Gemini wrapper with mock fallback, numeric/time fact guards, courtesy drafter, Local Pulse classifier, multilingual `en`/`hi`/`hinglish` templates (`i18n.py`), and 64-prompt eval suite (`evals/`).
- `tests/` (`P3`) — Contract tests (`tests/contract/`), Playwright E2E + Axe accessibility specs (`tests/e2e/`), and k6 load test (`tests/load/`).
- `scripts/` (`P3`) — TypeScript generator (`gen_types.py`), fixture builder (`make_fixtures.py`), smoke check (`smoke.py`), demo state recorder (`record_demo_state.py`), PMTiles builder (`make_pmtiles.sh`).
- `docs/` (`P3`) — [`ARCHITECTURE.md`](file:///home/ronit/1PROJECTS/wayfinder/wayfinder-one/docs/ARCHITECTURE.md), [`SECURITY.md`](file:///home/ronit/1PROJECTS/wayfinder/wayfinder-one/docs/SECURITY.md), [`TEST_PLAN.md`](file:///home/ronit/1PROJECTS/wayfinder/wayfinder-one/docs/TEST_PLAN.md), [`DEMO_SCRIPT.md`](file:///home/ronit/1PROJECTS/wayfinder/wayfinder-one/docs/DEMO_SCRIPT.md), [`CHANGE_REQUESTS.md`](file:///home/ronit/1PROJECTS/wayfinder/wayfinder-one/docs/CHANGE_REQUESTS.md).
- `backend/` (`P2`) & `frontend/` (`P1`) — FastAPI + Celery + PostgreSQL backend and Next.js PWA frontend (scaffolded for P2/P1 implementation).

## Quickstart (Person 3 — Contracts, Engine & Agent)

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements-engine.txt ruff

python scripts/gen_types.py                      # regenerate contracts/types.ts
pytest tests/contract engine agent -q            # contract, unit, property, golden & agent suites
pytest engine/tests/test_golden_scenario.py -q   # golden + secondary scenarios (make golden)
python -m agent.evals.run_evals                  # 64-prompt intent accuracy & 200-gen guard checks
python scripts/smoke.py                          # offline end-to-end smoke check
ruff check contracts engine agent scripts tests  # static lint check
```

## Known Scope Notes

- `backend/` and `frontend/` directories are owned by Person 2 and Person 1 respectively and remain scaffolded for their branches; all Person 3 deliverables (`contracts/`, `engine/`, `agent/`, `scripts/`, `tests/`, `docs/`, `.github/`) are implemented and verified offline with deterministic `LLM_MODE=mock`.
- Real payments, real ticket issuance, native mobile apps, and stored location history are explicitly excluded by design.
