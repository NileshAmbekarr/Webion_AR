# Webion Live AR — Project Progress Report

**Last Updated:** 24 March 2026, 04:40 IST  
**Branch:** `develop`  
**Checkpoint:** Real AR with pose detection working

---

## Architecture Overview

```
┌──────────────────────────┐  Agora RTC + Data  ┌──────────────────────────┐
│      SELLER TAB          │ ◄════════════════►  │       BUYER TAB          │
│  - Camera → mannequin    │    Live Video       │  - Sees seller video     │
│  - Frame capture engine  │    Stream Message   │  - MediaPipe Pose (33kp) │
│  - Quality checks        │    (GARMENT_READY)  │  - Body-anchored overlay │
│  - Garment present flow  │                     │  - Screenshot capture    │
└──────────┬───────────────┘                     └──────────────────────────┘
           │ POST /api/ar/segment-live
           ▼
┌──────────────────────────┐  Vite Proxy  ┌──────────────────────────┐
│   Node.js Backend        │ ──────────►  │  Flask Segmentation      │
│   Express (port 3001)    │              │  REMBG u2net_cloth_seg   │
│   - File management      │              │  - Garment extraction    │
│   - Session cleanup      │              │  - Auto-trim edges       │
└──────────────────────────┘              └──────────────────────────┘
```

## Verified End-to-End Flow

| Step | Status | Detail |
|------|--------|--------|
| 1. Seller joins channel | ✅ | Agora RTC + data stream |
| 2. Buyer joins channel | ✅ | Both see each other's video |
| 3. Seller clicks "Present Garment" | ✅ | Frame capture checks run |
| 4. Quality checks pass (1.5s hold) | ✅ | mannequin✓ lighting✓ stability✓ sharp✓ |
| 5. Frame sent to backend | ✅ | Vite proxy → localhost:3001 |
| 6. Backend forwards to Flask | ✅ | REMBG u2net_cloth_seg model |
| 7. Segmented PNG returned | ✅ | Auto-trimmed, no crop |
| 8. Buyer receives garment URL | ✅ | Via Agora data stream |
| 9. MediaPipe Pose detects body | ✅ | 33 keypoints at ~36 FPS |
| 10. Garment anchored to body | ✅ | Centered on shoulders, scales with body |
| 11. Keypoint debug overlay | ✅ | Green=shoulders/hips, orange=arms |
| 12. Screenshot button | ✅ | Composites video + overlay |

## Bugs Fixed (17 total)

| # | Issue | Fix |
|---|-------|-----|
| 1–13 | (see checkpoint 2) | State machine, capture, sync, BuyerARPanel |
| 14 | `ERR_CONNECTION_REFUSED` on seller | Added Vite proxy, relative API URLs |
| 15 | Garment shifted left | Removed canvas `scaleX(-1)`, centered on midShoulder |
| 16 | `img_cropped` reference error | Fixed stale variable after refactor |
| 17 | Duplicate MediaPipe CDN scripts | Removed duplicates from `<head>` |

## MediaPipe Pose Keypoints Used

- **Green (key):** shoulders (11, 12), hips (23, 24) — garment anchoring
- **Orange (arms):** elbows (13, 14), wrists (15, 16) — skeleton viz
- **White (other):** nose, ears, knees, etc. — context
- **Red:** center crosshair at midShoulder — garment placement origin

## Known Limitations

1. **Garment is a flat 2D image** — doesn't warp/deform to body shape
2. **Arms go behind garment** — no depth/occlusion handling
3. **Mannequin parts in segmentation** — REMBG extracts foreground (mannequin + garment), not garment-only

## Running the Project

```bash
# Terminal 1 — Flask segmentation (port 5001)
cd server/scripts && python segment_service.py

# Terminal 2 — Node backend (port 3001)
cd server && node app.js

# Terminal 3 — React frontend (port 5173)
cd client && npm run dev -- --host

# Terminal 4 — Cloudflare tunnel
cloudflared tunnel --url http://localhost:5173
```
