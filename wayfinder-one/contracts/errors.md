# WAYFINDER ONE — Error Catalog (`CONTRACT_VERSION = "1.0.0"`)

All API error responses use the canonical `ErrorResponse` envelope defined in [`contracts/models.py`](file:///home/ronit/1PROJECTS/wayfinder/wayfinder-one/contracts/models.py):

```json
{
  "error": {
    "code": "PRICE_CHANGED",
    "message": "Fare for Cab COK→Munnar changed from ₹4,300 to ₹4,650.",
    "details": {
      "items": [
        { "item_id": "it_a_t1", "old_inr": 4300, "new_inr": 4650 }
      ]
    },
    "request_id": "req_8f2c1a"
  }
}
```

## UI & Client Handling Rules
- Display `error.message` directly to the user; never synthesize or fabricate prices/times client-side.
- Branch UI behavior strictly on `error.code` (e.g., `PRICE_CHANGED` opens the price re-confirmation dialog; `APPROVAL_REQUIRED` renders the quote & approval confirmation dialog).
- Always include `request_id` in support/diagnostic logs.

## Error Codes

| Code | HTTP Status | Trigger / Meaning | Expected `details` Payload | UI Behaviour |
|---|---|---|---|---|
| `VALIDATION_ERROR` | `422` | Request payload or query failed Pydantic/schema validation (e.g. empty chat message, invalid lat/lng, `EDIT` draft without body, unknown demo inject kind). | `{"fields": [{"loc": [...], "msg": "..."}]}` (optional) | Show inline field validation error or toast `message`. |
| `NOT_FOUND` | `404` | Trip, booking, alert, recommendation, voucher (if not `CONFIRMED`), group invite code, or share link (expired/revoked) does not exist. | `{"resource": "trip", "id": "..."}` (optional) | Show `EmptyState` / not-found message. |
| `CONFLICT` | `409` | Duplicate registration email, group capacity reached (max 5 members), or duplicate conflicting state. | `{"reason": "..."}` (optional) | Show inline conflict message. |
| `APPROVAL_REQUIRED` | `400` | Consequential action attempted with `approve=false` (booking, switch, rebalance `apply=true`, swap-item `apply=true`, cancel, modify). | For **cancel**: `{"penalty_inr": int, "refundable": bool, "cancel_by": iso \| null}`.<br>For **modify**: `{"fee_inr": int, "new_price_inr": int, "available": bool}`. | Open confirmation dialog showing the returned quote/penalty and an explicit Approve button. |
| `INVALID_STATE` | `409` | Action invalid in the current entity state (e.g. deciding a switch recommendation that is not `PROPOSED`). | `{"current_state": "..."}` (optional) | Refresh trip state and inform user. |
| `SUPPLIER_UNAVAILABLE` | `502` | Supplier adapter failed or timed out (e.g. `SUPPLIER_FAIL_REBOOK=1` during switch execution). Nothing is half-applied. | `{"item_id": "..."}` (optional) | Show inline recovery message ("Nothing was changed. Plan A is still active.") + Retry. |
| `PRICE_CHANGED` | `409` | Price drifted between planning and `POST /trips/{id}/book` pre-check. | `{"items": [{"item_id": str, "old_inr": int, "new_inr": int}]}` | Open re-confirm dialog showing old → new prices per drifted item. |
| `SOLVER_INFEASIBLE` | `422` | OR-Tools CP-SAT solver could not satisfy all hard constraints (budget, daily window, night-ghat rule, must-dos). | `{"binding_constraint": str, "suggestion": str}` | Display binding reason and actionable suggestion in chat/swap UI. |
| `LLM_UNAVAILABLE` | `503` | Upstream LLM unavailable when fallback is disabled (in normal/demo modes `LLM_MODE` falls back automatically to `mock` and never raises this). | `{"provider": "gemini"}` (optional) | Show retry option. |
| `INTERNAL` | `500` | Unexpected unhandled server error. Stack traces are logged server-side only, never returned. | `null` | Show generic error state with `request_id`. |
| `UNAUTHENTICATED` | `401` | Missing, expired, or invalid JWT / SSE token, or invalid login credentials (same message for unknown email and wrong password). | `null` | Redirect to `/login` or show login failure message. |
| `FORBIDDEN` | `403` | Authenticated user lacks permission for the trip/action (e.g. group member trying to book/cancel, non-member accessing trip). | `null` | Show permission denied notice; disable owner-only buttons in UI. |
| `RATE_LIMITED` | `429` | Endpoint rate limit exceeded (auth 5/min/IP, chat 30/min/user, public share 30/min/IP, others 120/min/user). | `{"retry_after_sec": int}` (optional) | Show cooldown notice before retrying. |
| `CONSENT_REQUIRED` | `403` | Advisor attempted an acting mutation on a client trip without `advisor_consent=true`. | `{"trip_id": str}` (optional) | Prompt advisor to request client consent first. |
