# Webion Live AR — Project Progress Report

**Last Updated:** 24 March 2026, 02:15 IST  
**Branch:** `develop` (all tracks merged)  
**Checkpoint:** Full seller→buyer flow working with mock garment

---

## Architecture Overview

```
┌──────────────────────────┐  Agora RTC + Data  ┌──────────────────────────┐
│      SELLER TAB          │ ◄════════════════►  │       BUYER TAB          │
│  - Camera → mannequin    │    Live Video       │  - Sees seller video     │
│  - Frame capture engine  │    Stream Message   │  - AR garment overlay    │
│  - Quality checks        │    (GARMENT_READY)  │  - Pose detection        │
│  - Garment present flow  │                     │  - Size estimation       │
└──────────┬───────────────┘                     └──────────────────────────┘
           │ POST /api/ar/segment-live
           ▼
┌──────────────────────────┐    HTTP     ┌──────────────────────────┐
│   Node.js Backend        │ ──────────► │  Flask Segmentation      │
│   Express (port 3001)    │             │  REMBG (port 5001)       │
│   - File management      │             │  - Background removal    │
│   - Session cleanup      │             │  - Returns PNG           │
└──────────────────────────┘             └──────────────────────────┘
```

## Verified End-to-End Flow (Checkpoint 2)

| Step | Status | Detail |
|------|--------|--------|
| 1. Seller joins channel | ✅ | Agora RTC + data stream created |
| 2. Buyer joins channel | ✅ | Both see each other's video |
| 3. Seller clicks "Present Garment" | ✅ | State → SELLER_PREPARING |
| 4. Frame capture checks run | ✅ | mannequin✓ lighting✓ stability✓ sharp✓ |
| 5. 1.5s stability hold → capture | ✅ | JPEG captured from seller's camera |
| 6. Frame sent to backend | ✅ | POST /api/ar/segment-live (mock fallback) |
| 7. Backend returns garment URL | ✅ | `/test_garment.png` (mock) |
| 8. State → AR_ACTIVE | ✅ | Transitions working correctly |
| 9. Buyer receives GARMENT_READY | ✅ | Agora data stream message |
| 10. Buyer consent (localStorage) | ✅ | Auto-accepts after first approval |
| 11. Buyer loads garment PNG | ✅ | Image loads, "AR Try-On Active" shown |
| 12. Screenshot button | ✅ | Captures composite image |
| 13. Real REMBG segmentation | ❌ | Client falls back to mock, need to wire |
| 14. AR overlay on buyer body | ❌ | Currently shows garment image standalone |

## Bugs Fixed (Cumulative — 13 total)

| # | Issue | Fix |
|---|-------|-----|
| 1–10 | (see previous checkpoint) | Various state machine, capture, sync fixes |
| 11 | Garment 404 (`localhost:3001/test_garment.png`) | Fixed URL construction — mock paths served by Vite, not backend |
| 12 | MediaPipe Pose WASM crash | Made Pose a singleton + rAF loop (no Camera helper) |
| 13 | BuyerARPanel empty | Removed CSS dependency, inline styles, visible state indicators |

## Flask Microservice Status

- **Running:** ✅ `/health` → `{"status":"ok"}`
- **REMBG model:** Loaded (`isnet-general-use`)
- **Port:** 5001
- **Pipeline:** Node `form-data` + `axios` installed and wired
- **Not yet tested:** Real frame → REMBG → segmented PNG end-to-end

## Running the Project

```bash
# Terminal 1 — Python segmentation (port 5001)
cd server/scripts && python segment_service.py

# Terminal 2 — Node backend (port 3001)
cd server && node app.js

# Terminal 3 — React frontend (port 5173)
cd client && npm run dev -- --host

# Terminal 4 — Cloudflare tunnel (for mobile testing)
cloudflared tunnel --url http://localhost:5173
```
