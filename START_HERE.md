# WAYFINDER ONE: team pack

**What this is.** A full-scope, phase-based build plan (about 6 weeks, scalable) split into three role files, plus a starter repo. Every feature in your ideation doc is in scope and must work end to end; nothing is cut.

| File | For |
|---|---|
| `01_PERSON1_FRONTEND_UX.md` | Person 1: Next.js PWA, design system, every screen |
| `02_PERSON2_BACKEND_DATA.md` | Person 2: FastAPI, Postgres, Celery, suppliers, providers, notifications, security |
| `03_PERSON3_ENGINE_INTEGRATION.md` | Person 3: contracts, OR-Tools engine, LangGraph agent, tests, CI, docs |
| `wayfinder-one/` | Starter repo (contract models + generated TS types + fixture + Makefile + compose + CI skeleton) |
| `BRAINSTORM.md` | Decisions and open questions so far |

**Steps**
1. Fill in the "Assigned to" row in each file.
2. Create the git repo from `wayfinder-one/`; copy the three role files into `docs/roles/`.
3. `python -m venv .venv && source .venv/bin/activate && pip install "pydantic>=2.6" pytest && python scripts/gen_types.py && pytest tests/contract -q`
4. P3 starts Phase 0 (contracts and fixtures for every endpoint) first; P1 and P2 scaffold in parallel; then work phase by phase with the gates in B8/B11.

**Honest status.** The contract models, generated TypeScript types, golden Plan A fixture and contract tests were actually run (4 tests pass, TypeScript compiles in strict mode). Everything else (backend, frontend, engine, agent) is a plan, and every acceptance check is a planned check until you run it.

**Needs your input (see BRAINSTORM.md):** real deadline/demo format, TBO credentials, who the fourth person on the deck is, WhatsApp/flight-status accounts.
