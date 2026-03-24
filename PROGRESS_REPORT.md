# Webion Live AR — Project Progress Report

**Last Updated:** 24 March 2026, 05:43 IST  
**Branch:** `develop`  
**Checkpoint:** Body landmark visualization with x-coordinate mirror fix

---

## Architecture Overview

```
┌──────────────────────────┐  Agora RTC + Data  ┌──────────────────────────┐
│      SELLER TAB          │ ◄════════════════►  │       BUYER TAB          │
│  - Camera → mannequin    │    Live Video       │  - Sees seller video     │
│  - Frame capture engine  │    Stream Message   │  - MediaPipe Pose (33kp) │
│  - Quality checks        │    (GARMENT_READY)  │  - Body-anchored overlay │
│  - Garment present flow  │                     │  - PoseLandmarkOverlay   │
└──────────┬───────────────┘                     └──────────────────────────┘
           │ POST /api/ar/segment-live
           │ (via Vite proxy :5173 → :3001)
           ▼
┌──────────────────────────┐    HTTP     ┌──────────────────────────┐
│   Node.js Backend        │ ─────────►  │  Flask Segmentation      │
│   Express (port 3001)    │             │  REMBG u2net_cloth_seg   │
│   - File management      │             │  - Background removal    │
│   - Session cleanup      │             │  - Auto-trim edges       │
│   - /ar-temp/ serving    │             │  (port 5001)             │
└──────────────────────────┘             └──────────────────────────┘
```

## Verified End-to-End Flow

| Step | Status | Detail |
|------|--------|--------|
| 1. Seller joins channel | ✅ | Agora RTC + data stream |
| 2. Buyer joins channel | ✅ | Both see each other's video |
| 3. Body landmarks on buyer | ✅ | PoseLandmarkOverlay — always-on, no AR needed |
| 4. Seller clicks "Present Garment" | ✅ | Frame capture + quality checks |
| 5. Quality checks pass (1.5s hold) | ✅ | mannequin✓ lighting✓ stability✓ |
| 6. Frame sent to backend | ✅ | Vite proxy → localhost:3001 |
| 7. Backend forwards to Flask | ✅ | REMBG u2net_cloth_seg model |
| 8. Segmented PNG returned | ✅ | Auto-trimmed, served via /ar-temp/ |
| 9. Buyer receives garment URL | ✅ | Via Agora data stream message |
| 10. MediaPipe Pose detects body | ✅ | 33 keypoints at ~40 FPS |
| 11. Garment anchored to body | ✅ | Centered between shoulders, scales with body |
| 12. Screenshot button | ✅ | Composites video + overlay |

## Key Components

### PoseLandmarkOverlay (NEW)
- Standalone component inside buyer's video container
- Renders **immediately on join** — no AR state required
- Full body skeleton: torso (green), arms (orange), legs (cyan)
- Labeled key joints: shoulders, hips, elbows, wrists, nose, ears, knees, ankles
- Center crosshair (red) at midpoint between shoulders
- FPS badge in top-right corner
- X-coordinates flipped to match Agora's mirrored video display

### BuyerARPanel
- Renders only during AR_ACTIVE state (after garment received)
- Uses `usePoseDetection` + `useGarmentOverlay` for body-anchored garment
- Garment centered on torso using `midShoulder.x - scaledWidth/2`
- Fallback mode: positioned `<img>` if pose detection fails within 10s
- Screenshot + size slider (fallback mode)

### Flask Segmentation Service
- REMBG model: `u2net_cloth_seg` (cloth-specific, falls back to `isnet-general-use`)
- Auto-trims transparent edges using `PIL.getbbox()`
- No torso crop (removed — was causing garment to disappear)

## Bugs Fixed (19 total)

| # | Issue | Fix |
|---|-------|-----|
| 1–13 | State machine, capture, sync, BuyerARPanel | (see checkpoint 2) |
| 14 | `ERR_CONNECTION_REFUSED` on seller via tunnel | Added Vite proxy for /api/* and /ar-temp/* |
| 15 | Garment shifted to the left | Removed canvas `scaleX(-1)`, centered on midShoulder |
| 16 | `img_cropped` reference error in Flask | Fixed stale variable after refactor |
| 17 | Duplicate MediaPipe CDN scripts | Removed duplicates from `<head>` |
| 18 | Torso crop destroying garment | Removed crop entirely |
| 19 | Landmark/garment position mismatch | Flipped x-coordinates: `(1-x)*W` to match Agora mirror |

## MediaPipe Pose Keypoints

| Keypoint | ID | Color | Usage |
|----------|----|-------|-------|
| Nose | 0 | White | Head tracking |
| L/R Ear | 7, 8 | White | Head orientation |
| L/R Shoulder | 11, 12 | Green | **Garment width + position anchor** |
| L/R Elbow | 13, 14 | Orange | Arm skeleton visualization |
| L/R Wrist | 15, 16 | Orange | Arm tracking |
| L/R Hip | 23, 24 | Green | **Torso height reference** |
| L/R Knee | 25, 26 | Cyan | Leg skeleton visualization |
| L/R Ankle | 27, 28 | Cyan | Leg tracking |
| Center | — | Red | Midpoint between shoulders (garment origin) |

## Known Limitations

1. **Garment is a flat 2D image** — no warping/deformation to body shape
2. **Arms go behind garment** — no depth/occlusion handling
3. **REMBG extracts full foreground** — mannequin body parts still visible in segmented PNG
4. **Shoulder keypoints slightly low** — MediaPipe detects joint center, not top of shoulder

## Running the Project

```bash
# Terminal 1 — Flask segmentation (port 5001)
cd server/scripts && python segment_service.py

# Terminal 2 — Node backend (port 3001)
cd server && node app.js

# Terminal 3 — React frontend (port 5173)
cd client && npm run dev -- --host

# Terminal 4 — Cloudflare tunnel (for cross-device testing)
cloudflared tunnel --url http://localhost:5173
```
