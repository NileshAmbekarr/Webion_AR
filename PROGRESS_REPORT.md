# Webion Live AR — Project Progress Report

**Date:** 23 March 2026  
**Branch:** `develop` (all tracks merged)

---

## Architecture Overview

```
┌──────────────────────────┐     Agora RTC     ┌──────────────────────────┐
│      SELLER TAB          │ ◄═══════════════►  │       BUYER TAB          │
│  - Camera → mannequin    │    Live Video      │  - Sees seller video     │
│  - Frame capture engine  │                    │  - AR garment overlay    │
│  - Quality checks        │                    │  - Pose detection        │
│  - Garment present flow  │                    │  - Size estimation       │
└──────────┬───────────────┘                    └──────────────────────────┘
           │ POST /api/ar/segment-live
           ▼
┌──────────────────────────┐    HTTP     ┌──────────────────────────┐
│   Node.js Backend        │ ──────────► │  Flask Segmentation      │
│   Express (port 3001)    │             │  REMBG (port 5001)       │
│   - File management      │             │  - Background removal    │
│   - Session cleanup      │             │  - Returns PNG           │
└──────────────────────────┘             └──────────────────────────┘
```

## Development Tracks

| Track | Owner | Scope | Status |
|-------|-------|-------|--------|
| **A+C** | Agent 1 | Session state machine, frame capture, Agora integration, enforcement UI | ✅ Merged |
| **B** | Agent 2 | Buyer AR overlay, pose detection, garment rendering, size estimation | ✅ Merged |
| **D** | Agent 3 | Express backend, Flask segmentation microservice, file management | ✅ Merged |

## Integration Status

### ✅ Completed
- [x] All 3 feature branches merged into `develop`
- [x] Merge conflict in `App.jsx` resolved (Track A+C role selection kept, Track B integrated)
- [x] `BuyerARPanel` wired into `ARSessionPanel` buyer view
- [x] Vite build passes cleanly
- [x] Role selection UI (Seller / Buyer) — dark glassmorphism theme
- [x] Agora RTC video call working (both tabs see each other's video)
- [x] Agora temp token integrated
- [x] Remote video rendering bug fixed (ref race condition)
- [x] Frame capture engine running — quality checks logging to console
- [x] Backend + Flask segmentation service operational

### 🔧 Recently Fixed
| Issue | Root Cause | Fix |
|-------|-----------|-----|
| No `[FrameCapture]` logs | Stale closure in `useCallback` killed `setInterval` + `console.debug` hidden in Chrome | Rewrote hook, moved analysis inside `useEffect`, used `console.log` |
| Remote video not showing | Conditional rendering unmounted the `<div ref>`, causing play() race condition | Always render container, hide with `display:none` |
| Wrong video analyzed | `useFrameCapture` received `remoteVideoRef` (buyer's face) instead of `localVideoRef` (seller's camera) | Changed to `localVideoRef` |
| Sharpness check never passes | Threshold was 12, but laptop webcams produce values 2–6 | Lowered to 1 |
| Stability too slow | 3s hold with Δ < 8.0 was hard on laptops | Reduced to 1.5s hold, Δ < 12.0 |
| Mannequin detection blocking | MediaPipe Pose CDN load timing uncertain | Auto-pass for hackathon demo |

### 🔄 In Progress
- [ ] **End-to-end capture → segmentation → AR overlay flow**: Sharpness threshold just fixed, needs re-test
- [ ] Verify backend segmentation returns correct PNG URL
- [ ] Verify buyer receives garment URL and renders AR overlay

### ⏳ Not Started
- [ ] RTM signaling for cross-tab state sync (currently local-only)
- [ ] Production token server (using temp token)
- [ ] Deploy to staging

## Configuration (arConfig.js)

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `CAPTURE_INTERVAL_MS` | 500ms | Frame sampling rate |
| `SHARPNESS_THRESHOLD` | 1 | Min edge-delta (laptop: 2–6 typical) |
| `MIN_LUMINANCE` | 80 | Min brightness (0–255) |
| `MAX_LUMINANCE` | 220 | Max brightness (0–255) |
| `STABILITY_DURATION_MS` | 1500ms | Hold-still time before capture |
| `STABILITY_THRESHOLD` | 12.0 | Max frame-to-frame pixel delta |

## Expected End-to-End Flow

1. **Seller** opens app → selects "I'm the Seller" → enters channel `webion-ar-demo` → joins
2. **Buyer** opens app → selects "I'm the Buyer" → enters same channel → joins
3. Both see each other's video via Agora RTC
4. Seller clicks **"Present Garment"** → state transitions to `SELLER_PREPARING` → `SCANNING`
5. Frame capture engine starts checking every 500ms:
   - ✓ Mannequin present (auto-pass for demo)
   - ✓ Lighting in range (80–220)
   - ✓ Frame stability (Δ < 12 for 1.5s)
   - ✓ Sharpness above threshold (> 1)
6. When all checks pass for 1.5s → frame captured as JPEG
7. JPEG sent to `POST /api/ar/segment-live` on Node backend
8. Backend forwards to Flask REMBG service → background removed → PNG returned
9. Session state transitions to `AR_ACTIVE`
10. Buyer sees consent modal → accepts → `BuyerARPanel` activates
11. Buyer's camera + MediaPipe Pose → garment PNG overlaid on buyer's body

## Running the Project

```bash
# Terminal 1 — Python segmentation (port 5001)
cd server/scripts && python segment_service.py

# Terminal 2 — Node backend (port 3001)
cd server && node app.js

# Terminal 3 — React frontend (port 5173)
cd client && npm run dev

# Open two tabs at http://localhost:5173
# Tab 1: Seller | Tab 2: Buyer | Channel: webion-ar-demo
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Video Call | Agora RTC SDK 4.x |
| Pose Detection | MediaPipe Pose (CDN) |
| Segmentation | REMBG (Python/Flask) |
| Backend | Express.js |
| State Management | React Context (SessionContext) |
