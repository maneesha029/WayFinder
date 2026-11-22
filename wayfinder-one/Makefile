.PHONY: maps db-up db-down install migrate seed dev test golden gen-types e2e load lint up-prod reset db-backup db-restore contract
# Owner: P3. Targets prefixed p1-/p2-/p3- are personal; the rest are shared.

maps:             ## free regional map file (see scripts/make_pmtiles.sh)
	./scripts/make_pmtiles.sh
db-up:            ## postgres + redis
	docker compose up -d postgres redis
db-down:
	docker compose down
install:          ## backend + engine + frontend + e2e deps
	pip install -r requirements-engine.txt -r backend/requirements.txt
	cd frontend && npm ci
	cd tests/e2e && npm ci
migrate:
	cd backend && alembic upgrade head
seed:
	python -m backend.seed.seed
dev:              ## api + worker + beat + web (uses honcho/foreman-style parallel run)
	(cd backend && uvicorn app.main:app --reload --port 8000 &) ; \
	(cd backend && celery -A app.worker.celery_app worker -l info &) ; \
	(cd backend && celery -A app.worker.celery_app beat -l info &) ; \
	(cd frontend && npm run dev)
test:
	pytest engine agent backend tests/contract -q
golden:
	pytest engine/tests/test_golden_scenario.py -q
gen-types:
	python scripts/gen_types.py
contract:         ## what CI runs for contracts
	python scripts/gen_types.py && git diff --exit-code contracts/types.ts && pytest tests/contract -q
e2e:
	cd tests/e2e && npx playwright test
load:
	k6 run tests/load/golden.js
lint:
	ruff check . && (cd frontend && npm run lint) && gitleaks detect --no-banner
up-prod:
	docker compose -f docker-compose.prod.yml up --build
reset:
	curl -s -X POST localhost:8000/api/v1/demo/reset
db-backup:
	pg_dump "$$DATABASE_URL" > backups/wayfinder_$$(date +%F_%H%M).sql
db-restore:
	psql "$$DATABASE_URL" < $$FILE
