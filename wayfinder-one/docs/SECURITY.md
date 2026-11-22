# WAYFINDER ONE — Security & Privacy Architecture

## 1. Threat Model & Trust Boundaries

1. **Client → API:** Untrusted inputs validated strictly via Pydantic v2 contract schemas (`contracts/models.py`). Unknown fields/invalid formats return `422 VALIDATION_ERROR`.
2. **Consequential Actions Gate:** Booking, plan switching, cancel, modify, rebalance apply, and swap-item apply require explicit `approve=true` plus a validated `idempotency_key` (`^[A-Za-z0-9_-]{8,64}$`). Unapproved calls return `400 APPROVAL_REQUIRED`.
3. **LLM / Prompt Injection Boundary:**
   - The LLM never receives DB credentials, payment capabilities, or execution tools.
   - `agent/guards.py` validates every generated `₹` amount, `%`, `min` duration, and `HH:MM` clock time against structured solver/DB facts.
   - WhatsApp two-step approval rejects ambiguous confirmations (`"yes"`) and requires exact `YES SW<n>` matching a non-expired (< 30 min) recommendation ID.

## 2. Authentication & Authorization Matrix

- Passwords hashed with Argon2id; JWT signed with HS256 (`JWT_SECRET`, `JWT_TTL_MIN=60`). Production startup refuses default dev secrets.
- SSE streams authenticate via short-lived (`60s`) single-purpose tokens (`POST /auth/sse-token`).
- Login throttled at 5 failures/min/IP; identical error messages for unknown email and wrong password.

| Action / Resource | Owner | Group Member | Assigned Advisor (no consent) | Assigned Advisor (`advisor_consent=true`) | Unrelated User |
|---|---|---|---|---|---|
| View Trip / Plan / Slack / Alerts | Allow | Allow | Allow | Allow | 403 `FORBIDDEN` |
| Edit own group prefs / vote / confirm own check-in | Allow | Allow | 403 | 403 | 403 |
| Add Advisor Notes | 403 | 403 | Allow | Allow | 403 |
| Book / Cancel / Modify / Switch / Apply Rebalance | Allow | 403 `FORBIDDEN` | 403 `CONSENT_REQUIRED` | Allow (audit-logged) | 403 |
| Create / Revoke Share Link | Allow | 403 | 403 | 403 | 403 |

## 3. Webhooks, Share Links & Location Privacy

- **WhatsApp Webhook:** `POST /webhooks/whatsapp` verifies HMAC signature (`X-Hub-Signature-256` with `WHATSAPP_APP_SECRET`), deduplicates by `provider_msg_id`, and never discloses trip data to unverified phone numbers.
- **Public Share Links (`/share/{token}`):** Tokens use `>= 128`-bit CSPRNG randomness (`secrets.token_urlsafe(24)`), stored only as SHA-256 hashes with default 24-hour TTL and explicit revocation. Returns strictly `SharedTripView` (title, health, next stop, ETA, last place name) — **zero PII, coordinates, booking refs, or phone numbers**.
- **Location Privacy:** WAYFINDER ONE never stores location history. Only the latest ping is held in `sim_state` during active windows and deleted on `/demo/reset`.

## 4. Secrets & Dependency Hygiene

- `.gitignore` excludes `.env`, `.venv/`, `node_modules/`, and backups.
- CI runs `gitleaks` on full git history, `ruff` static analysis, `pip-audit`, and `npm audit --audit-level=high`.
- Frontend forbids `dangerouslySetInnerHTML`, enforces strict CSP, and stores JWTs in memory / `sessionStorage` (never `localStorage`).
