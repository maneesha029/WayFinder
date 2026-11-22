# WAYFINDER ONE — frontend (P1)

Next.js 14 App Router PWA. Owner: Person 1. Everything in this folder is P1's; contracts live read-only one level up (`../contracts`).

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run typecheck    # tsc --noEmit
node scripts/gen-icons.cjs   # regenerate PWA icons (after palette changes)
```

`cp .env.example .env` equivalents live in `.env.local` (gitignored). The P1 block:

| Variable | Values | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | default `http://localhost:8000/api/v1` | P2's FastAPI base |
| `NEXT_PUBLIC_API_MODE` | `live` \| `fixtures` | `live` = all requests hit the API; `fixtures` = the in-app world (no backend needed) |
| `NEXT_PUBLIC_DEMO_MODE` | `1` \| `0` | demo panel + hotkey `D` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID key | web push opt-in |

## Connecting the backend (P2)

1. Start P2's stack (`docker compose up -d postgres redis`, then the API on `:8000`).
2. Set `NEXT_PUBLIC_API_MODE=live` in `.env.local` and restart `npm run dev`.
3. Every screen talks to the contract endpoints from B6.3/B6.3b through one module — `src/lib/api/endpoints.ts`. Nothing in `src/components`/`src/hooks` imports fixtures or hardcodes seed data, so flipping the mode is the only switch.
4. SSE: the app fetches `POST /auth/sse-token` and opens `GET /trips/{id}/events?sse_token=…`, mapping every event in B6.5/B6.5b to query invalidations (`src/hooks/useTripEvents.ts`). If the stream fails it polls every 5 s and shows a reconnecting state.
5. Errors arrive as the B6.4 envelope and surface verbatim; `PRICE_CHANGED` opens the re-confirm dialog, `APPROVAL_REQUIRED` powers the quote-then-approve dialogs.

## Map

`LiveMap` renders MapLibre GL reading `public/maps/south-india.pmtiles` when P3 has built it (`make maps` in the repo root); otherwise it renders the schematic SVG fallback with OSM attribution. The app never bulk-fetches public OSM tiles.
