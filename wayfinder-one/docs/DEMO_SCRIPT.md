# WAYFINDER ONE — 4-Minute Demo Script & Backup Plan

## Pre-Demo Checklist
1. Ensure clean state: `POST /api/v1/demo/reset` (or `make reset`), verify `GET /api/v1/health` returns `contract_version: "1.0.0"`.
2. Open browser to `http://localhost:3000` at 1280×800; keep Demo Panel hotkey `D` ready.
3. Have backup state snapshot ready at [`contracts/fixtures/demo_recorded_state.json`](file:///home/ronit/1PROJECTS/wayfinder/wayfinder-one/contracts/fixtures/demo_recorded_state.json) (generated via `python scripts/record_demo_state.py`) and `NEXT_PUBLIC_API_MODE=fixtures` available if live servers are interrupted.

## 4-Minute Timed Script

| Time | Screen / Action | What to Show & Say |
|---|---|---|
| **0:00–0:45** | **Plan Workspace (`/`)** | Paste/click demo chip: *"Plan a 5-day budget trip from Bengaluru to Munnar for 2 people, early December, around ₹55,000. We like tea estates, waterfalls and sunsets. Avoid driving on ghat roads after dark."* Show OR-Tools **Plan A (₹46,300, ₹8,700 headroom, +65 min slack)**, `ProofList` ("Verified by solver, not guessed"), provenance badges, and **Plan B** rain-safe standby in `PlanCompare`. |
| **0:45–1:15** | **Book Dialog** | Click `Review & book` → `Approve and book`. Highlight honest supplier states: Flights & Cab `CONFIRMED`, Hotel `PENDING` (flips to `CONFIRMED` via SSE without page refresh). |
| **1:15–1:55** | **Guardian Cockpit & Demo Panel (`D`)** | Press `D`. Click `T-72H` (Day 3 rain outlook NUDGE, Plan B warmed), then `T-24H` (web check-in NUDGE), then `T-3H` + `FLIGHT_DELAY 55`. Point out `HealthMeter` dropping from **GREEN (94)** to **AMBER (53)** and `ACTION_NEEDED` alert arriving via SSE. |
| **1:55–2:45** | **Switch Decision Card & Drafts Drawer** | Open `SwitchDecisionCard`: Plan A **58%** vs Plan B **96%**, **MIXED** mode (+₹1,800, only Mattupetty Dam boating lost; flights, hotel, Lakkam waterfall, and Day 5 stay intact). Open `DraftsDrawer` to show pre-generated Hotel, Driver, and Eravikulam drafts (toggle English/Hinglish). Click `Approve switch`. |
| **2:45–3:25** | **Live Tab & Evidence** | Switch to `Live` tab, click `TRAFFIC_JAM 25` and play simulated drive slider; point out shrinking slack and ranked `RerouteOption`s. Open `Evidence` tab: chronological timeline, 55 min delay, ₹1,800 extra cost, and 3 conservative claim sections (Airline, Insurance, Supplier). |
| **3:25–4:00** | **Group, Responsible & Optionality** | Briefly flash Group tab (conflict resolution & exact cost split), Responsible tab (CO₂ breakdown + EV shuttle swap), and Advisor `/advisor` console sorted RED → GREEN. |

## 2-Minute Backup Recovery Plan
- **If API hangs or restarts mid-demo:** Click `POST /demo/seed-trip` (or switch `NEXT_PUBLIC_API_MODE=fixtures`) to restore the exact golden state in < 1s.
- **If presenting purely from static/recorded artefacts:** Walk through [`contracts/fixtures/demo_recorded_state.json`](file:///home/ronit/1PROJECTS/wayfinder/wayfinder-one/contracts/fixtures/demo_recorded_state.json) alongside the fixtures-mode Next.js app.
