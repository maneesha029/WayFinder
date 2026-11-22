# Brainstorming Session - 22 Nov 2026 (updated)
## Session Focus
WAYFINDER ONE (VoyageHack 4.0, TBO, PS3: Virtual Travel Agent / Travel Agent Copilot): full-scope, phase-based build plan for three people.

## Key Insights
- The brief rewards end-to-end lifecycle, orchestration, reliability and confirmation before consequential actions; "guardian after booking" is the differentiator.
- With ample time the right move is not a longer feature list but real signals, real adapters and hard gates, so judges see a product, not a demo.
- Trust is a judging lens: simulated data is labelled; the LLM never produces prices, times or feasibility numbers; every consequential action needs approval and an idempotency key.

## Decisions Made
- Scope changed from a 48-hour cut-down to full scope: all 22 features (F1-F22) ship working; nothing is cut; only real payments, real ticketing, native apps and location history are explicitly out.
- 7 phases (0-6, about 6 weeks, scalable) with exit gates tied to a 44-item acceptance checklist.
- Split: P1 frontend PWA; P2 backend/workers/providers/notifications/security; P3 contracts + engine + agent + CI/docs (engine as pure libraries so P3 is independent after Phase 0).
- Hybrid signals: real weather (Open-Meteo), ETA (OSRM, free-flow only), news-based Local Pulse; flight status via provider if a key exists; Demo Control Panel injections always labelled SIMULATED.
- Contract is generated: Python models are the source of truth, TypeScript types are generated and CI-checked.
- Group trips: only the owner can spend; advisor can act only with recorded consent; WhatsApp switch approval needs an exact two-step phrase.

## Open Questions
- Real deadline and demo format (assumed ~6 weeks, 4-minute live demo plus recorded backup)?
- Will TBO sandbox credentials be provided? (TboLiveAdapter is planned; mock stays for tests/offline.)
- Deck lists four names (DV, RK, MG, Vrinda): who is the fourth, and do they own pitch, demo script and user testing?
- Do you have or want WhatsApp (Meta Cloud API/Twilio), flight-status API and SMTP accounts? Without them those channels run as labelled simulations.
- Emission factors are illustrative placeholders: pick the cited source (e.g. DEFRA/ICAO) before the final demo.

## Next Actions
- P3: Phase 0 first: fixtures for every endpoint, stubs, CI, tag contracts-v1.
- P2: compose, DB, Alembic, all routes on stubs, auth skeleton.
- P1: scaffold, tokens, UI kit, fixtures mode for every endpoint.
- Team: assign names, create repo from the starter, run the contract test, hold the Phase 0 gate.

---
