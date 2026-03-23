# Webion Live AR Try-On — Product Requirements Document
**Version:** 2.0  
**Status:** Approved for Development  
**Company:** Webon Ecomm Pvt. Ltd. (Patent No. 570792)  
**Platform:** Web (React JS + Node.js + MySQL on Unix)  
**Date:** March 2025

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [What Is and Is Not Being Built](#4-what-is-and-is-not-being-built)
5. [System Architecture](#5-system-architecture)
6. [Parallel Development Tracks](#6-parallel-development-tracks)
7. [Sprint Plan](#7-sprint-plan)
8. [Track A — Live Frame Capture Pipeline](#8-track-a--live-frame-capture-pipeline)
9. [Track B — Buyer AR Overlay Engine](#9-track-b--buyer-ar-overlay-engine)
10. [Track C — Enforcement Rules and Session UI](#10-track-c--enforcement-rules-and-session-ui)
11. [Track D — Backend Segmentation Service](#11-track-d--backend-segmentation-service)
12. [API Contracts](#12-api-contracts)
13. [Data Models](#13-data-models)
14. [Enforcement Rules Specification](#14-enforcement-rules-specification)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Definition of Done](#16-definition-of-done)
17. [Risk Register](#17-risk-register)
18. [Environment Setup](#18-environment-setup)
19. [File Structure](#19-file-structure)
20. [Hackathon Demo Script](#20-hackathon-demo-script)

---

## 1. Executive Summary

Webion Live is a patented real-time live e-commerce platform where buyers virtually enter shops and speak with salespersons over live video. The platform uses Agora RTC for video calling and is already in production.

This document specifies the requirements for the **Live AR Try-On feature**: during an active video call between a buyer and a salesperson, the buyer can see any garment the salesperson holds up on a mannequin — overlaid in real-time on their own body via their front camera — without any pre-stored product database, catalog, or setup.

### Core Concept in One Sentence
> The seller shows a garment on a mannequin via their camera during a live video call. The platform captures that live frame, segments the garment, and overlays it on the buyer's body in real-time.

### Why This Approach
- **No product database required.** The seller does not pre-upload anything. Any garment shown on camera can be tried on.
- **Works for any garment type.** Kurtas, sarees, jackets, dresses — if it can be shown on a mannequin, it can be tried on.
- **Genuinely live.** The buyer sees the garment from the seller's real camera, not a stock photo. Color, texture, and drape are authentic.
- **Ephemeral by design.** No garment images are stored after the call. No permanent product data. No inventory management.

---

## 2. Problem Statement

### The existing problem with traditional e-commerce
When a buyer orders apparel online, they receive a product photographed under studio lighting on a size-zero model. The actual garment — its color under real light, how it falls on a real body, whether the size matches — is unknown until delivery. Return rates for apparel in India are 30–40%.

### The partial solution Webion already built
Webion's live shopping platform solves the information gap by letting buyers video-call salespersons inside real shops. The buyer can see the actual garment, ask questions, and negotiate — all live. This is already built and in production.

### The remaining gap this feature solves
Even on a live video call, the buyer can see the garment but still cannot answer: **will this look good on MY body?** The salesperson cannot try the garment on the buyer. The buyer cannot try it on themselves. This feature closes that gap.

---

## 3. Solution Overview

### The user experience flow

```
SELLER                                    BUYER
  |                                         |
  |  ← Both on active Agora video call →   |
  |                                         |
  | Presses "Present Garment"              |
  | Platform UI guides positioning         |
  | (distance, angle, stability)           |
  |                                         |
  | Holds mannequin steady in frame        |
  | Platform detects mannequin             |
  | 3-second stability countdown           |
  |                                         |
  | Best frame auto-captured ────────────► Backend: REMBG segmentation
  |                                         (~3 seconds)
  |                                         |
  |                                    ◄── Segmented garment PNG ready
  |                                         |
  |                                    Buyer presses "Try On"
  |                                    Front camera activates
  |                                    MediaPipe detects buyer body
  |                                    Garment overlaid on buyer ← LIVE
  |                                         |
  | Presses "Show New Garment"             |
  | New capture cycle begins               | Previous overlay disappears
  |                                         |
  | Call ends                              |
  └── Segmented PNGs deleted from /tmp ───┘
```

### What makes this technically novel
Most AR try-on systems work from pre-stored product images. This system captures the garment in real-time from a live video stream, segments it on the fly, and renders it on the buyer's body — all within a single live call with no pre-preparation from the seller.

---

## 4. What Is and Is Not Being Built

### In Scope
| Feature | Track | Sprint |
|---|---|---|
| Frame capture from Agora seller video stream | A | 1 |
| Motion blur detection and best-frame selection | A | 1 |
| Mannequin presence detection on seller stream | A | 1 |
| POST /api/ar/segment-live endpoint | D | 1 |
| REMBG segmentation microservice | D | 1 |
| Ephemeral PNG storage in /tmp with auto-cleanup | D | 1 |
| Buyer body pose detection via MediaPipe | B | 1 |
| Canvas 2D garment overlay on buyer camera | B | 1 |
| Real-time keypoint smoothing (EMA) | B | 1 |
| Size estimation card with disclaimer | B | 1 |
| Screenshot / save try-on image | B | 1 |
| Seller positioning enforcement UI | C | 1 |
| Stability countdown (3-second hold) | C | 1 |
| Session lifecycle management | C | 1 |
| Buyer AR activation consent flow | C | 1 |
| Camera guidance overlay for buyer | C | 1 |
| Garment dimension display from mannequin frame | A | 2 |
| Seller lighting quality detection | A | 2 |
| Improved vertical garment alignment using hips | B | 2 |
| Multi-garment session (switch without ending call) | C | 2 |
| Session analytics (try-ons per call, screenshot rate) | D | 2 |

### Explicitly Out of Scope
- Rebuilding the Agora video call itself (already exists)
- Product catalog, inventory, or garment database
- Permanent storage of any garment images
- Payment, cart, or order management
- Seller onboarding (already exists on Android app)
- WebGL or GPU-based fabric physics simulation
- Real-time per-frame segmentation (garment is captured once per session, not every frame)
- The Android salesperson app (modifications out of scope — web seller panel for AR controls only)
- iOS ARKit or Android ARCore native features

---

## 5. System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUYER'S BROWSER                              │
│                                                                 │
│  ┌──────────────────┐    ┌───────────────────────────────────┐ │
│  │ Agora Video Call │    │       AR Overlay Layer            │ │
│  │                  │    │                                   │ │
│  │  ┌────────────┐  │    │  ┌──────────┐  ┌──────────────┐  │ │
│  │  │ Seller     │  │    │  │  <video> │  │  <canvas>    │  │ │
│  │  │ Remote     │  │    │  │  Buyer   │  │  Garment PNG │  │ │
│  │  │ Video      │  │    │  │  Camera  │  │  overlaid    │  │ │
│  │  └────────────┘  │    │  └──────────┘  └──────────────┘  │ │
│  │  ┌────────────┐  │    │                                   │ │
│  │  │ Buyer      │  │    │  MediaPipe Pose (WASM)            │ │
│  │  │ Local      │  │    │  Runs in browser, no server call  │ │
│  │  │ Video      │  │    └───────────────────────────────────┘ │
│  │  └────────────┘  │                                          │
│  └──────────────────┘    ┌───────────────────────────────────┐ │
│                           │  Frame Capture Module             │ │
│  Hidden canvas reads      │  Draws seller stream to canvas    │ │
│  seller video frames ────►│  every 500ms when capture active  │ │
│                           │  Sends best frame to backend      │ │
│                           └────────────────┬──────────────────┘ │
└────────────────────────────────────────────│────────────────────┘
                                             │ JPEG blob via
                                             │ POST /api/ar/segment-live
┌────────────────────────────────────────────▼────────────────────┐
│                    NODE.JS BACKEND                               │
│                                                                  │
│  ar.routes.js ──► ar.controller.js ──► child_process            │
│                                              │                   │
│                                              ▼                   │
│                                    Python: segment.py (REMBG)    │
│                                              │                   │
│                                    Output: /tmp/{uuid}.png       │
│                                              │                   │
│                                    Served at /ar-temp/{uuid}.png │
│                                              │                   │
│                                    Deleted on: call end / 1hr    │
└──────────────────────────────────────────────────────────────────┘
                                             │
                                             │ { png_url, session_id }
                                             ▼
                               Buyer browser loads PNG
                               AR overlay activates
```

### Key Design Decisions

**Decision 1: Segmentation happens once per garment, not per frame.**
Running REMBG on every video frame in real-time is not feasible on CPU (it takes 2–3 seconds per frame). Instead, the platform captures one best-quality frame when the seller holds the garment steady, segments it once, and the resulting PNG is rendered per-frame on the buyer's canvas. This means the garment overlay does not change as the buyer moves — the garment image is fixed, and only its position/scale changes with the buyer's body.

**Decision 2: Garment PNGs are session-ephemeral.**
Segmented PNGs are stored in `/tmp/ar_sessions/{session_id}/` on the server. A cleanup job deletes them when the call session ends (detected via Agora webhook or a timeout of 1 hour, whichever comes first). No garment image persists between sessions.

**Decision 3: Frame capture uses canvas drawImage, not MediaRecorder.**
The seller's Agora remote video track is rendered to a `<video>` element. The buyer's browser draws that video element onto a hidden `<canvas>` every 500ms using `ctx.drawImage()`. This approach works across Chrome, Firefox, and Safari without requiring the MediaRecorder API (which has cross-browser issues).

**Decision 4: Buyer AR overlay runs entirely client-side.**
MediaPipe Pose, the canvas overlay, keypoint smoothing, and size estimation all run in the buyer's browser. No buyer video frames are ever sent to the server. This is a hard privacy constraint.

---

## 6. Parallel Development Tracks

The work is divided into four tracks that can run simultaneously with minimal dependencies. Tracks A, B, C, and D can all start on Day 1.

```
Day 1                                              Day 21
│                                                      │
│ TRACK A  ──────────────────────────────────────────► │
│ Frame Capture Pipeline                               │
│                                                      │
│ TRACK B  ──────────────────────────────────────────► │
│ Buyer AR Overlay Engine                              │
│                                                      │
│ TRACK C  ──────────────────────────────────────────► │
│ Enforcement Rules + Session UI                       │
│                                                      │
│ TRACK D  ──────────────────────────────────────────► │
│ Backend Segmentation Service                         │
│                                                      │
│         INTEGRATION POINT (Day 8–10)                │
│         Tracks connect: A sends frames to D          │
│         D returns PNG to B via C's session state     │
```

### Track Dependencies and Handoffs

| From | To | Handoff | When |
|---|---|---|---|
| Track D | Track A | `POST /api/ar/segment-live` is live and accepts JPEG | Day 4 |
| Track D | Track B | Segmented PNG URL format confirmed | Day 4 |
| Track A | Track B | `capturedGarmentUrl` state populated in session context | Day 8 |
| Track C | All | `useSessionState` hook and session context schema | Day 3 |

### Mock Contract for Day 1

All tracks start on Day 1 using these mocks:

**Track A** uses a static test JPEG instead of a live Agora frame for the first 3 days.

**Track B** uses a pre-segmented PNG from `/public/test_garment.png` instead of waiting for Track D.

**Track C** mocks the session state with a fixed `sessionId = "test-session-001"`.

**Track D** can be tested independently via Postman with a sample garment JPEG before any browser integration.

---

## 7. Sprint Plan

### Sprint Overview

| Sprint | Days | Goal | End State |
|---|---|---|---|
| Sprint 1 | 1–7 | Core pipeline working end-to-end | Seller captures garment → buyer sees it on their body in one live call demo |
| Sprint 2 | 8–14 | Quality, reliability, multi-garment | Multiple garments per call, accurate dimensions, production-ready |
| Sprint 3 | 15–21 | Polish, edge cases, hackathon prep | Demo-proof, all enforcement rules working, slide-deck ready |

### Day-by-Day Breakdown

| Day | Track A | Track B | Track C | Track D |
|---|---|---|---|---|
| 1 | Set up canvas capture from `<video>` element using static test video. Confirm `ctx.drawImage()` produces readable frames. | Set up React project. Implement `useCamera` hook — `getUserMedia`, video ref, stream cleanup. | Define `useSessionState` hook schema. Implement `SessionContext` provider. | Set up Python environment. `pip install rembg Pillow`. Run REMBG on 5 test garment photos. Verify PNG transparency. |
| 2 | Implement frame quality scoring: calculate mean absolute pixel difference between consecutive frames (motion blur proxy). Low delta = sharp frame. | Implement `usePoseDetection` hook. Load MediaPipe Pose via CDN. Draw debug skeleton on test video. Confirm 17 keypoints detected. | Build seller enforcement panel UI component (skeleton — no logic yet). Three status indicators: Distance, Stability, Lighting. | Write `segment.py` CLI script. Accepts `--input` and `--output` args. Test on 10 garment images. Document edge cases (patterned fabric, lace). |
| 3 | Implement mannequin presence check: run MediaPipe Pose on seller video frames. Check if keypoints 11,12 (shoulders) and 23,24 (hips) detected with visibility > 0.5. | Implement `useGarmentOverlay` hook. Load garment PNG, draw on canvas over buyer video. Manual position/scale controls for testing. | Wire enforcement rule logic into panel. Distance rule (stub), Stability rule (frame delta from Track A mock), Lighting rule (stub). Emit `onAllRulesMet` callback. | Write `POST /api/ar/segment-live` Node.js route. Accepts `multipart/form-data` with `frame` field (JPEG). Calls `segment.py`. Returns `{ png_url, session_id }`. |
| 4 | Implement 3-second stability countdown: once mannequin detected, start timer. If frame delta stays below threshold for 3 seconds, emit `onCaptureTrigger` with best frame. | Implement keypoint-based garment positioning. Extract shoulder keypoints 11 and 12. Calculate garment scale and position. Garment now follows buyer body. | Implement buyer-side UI: consent modal, camera guide overlay ("stand 1.5m back, full body visible"), body detection status indicator. | Deploy `segment-live` endpoint to dev server. Verify end-to-end: Postman sends JPEG, receives PNG URL, PNG file exists in `/tmp/`. |
| 5 | Implement frame capture: when `onCaptureTrigger` fires, encode canvas contents as JPEG blob (`canvas.toBlob('image/jpeg', 0.85)`). Send to `POST /api/ar/segment-live`. | Implement EMA smoothing on keypoints. Alpha = 0.6. Verify jitter is eliminated. Add hip keypoints (23, 24) for vertical garment alignment. | Wire buyer and seller UIs into a unified `ARSessionPanel` component. Seller panel on left. Buyer AR view on right. Manage shared session state. | Implement session cleanup: on `DELETE /api/ar/sessions/:id`, delete all files in `/tmp/ar_sessions/{session_id}/`. Write scheduled cleanup job (delete sessions older than 1 hour). |
| 6 | Integration: connect Track A frame capture output to Track D endpoint. Receive PNG URL. Place in session context for Track B to consume. | Integration: consume `capturedGarmentUrl` from session context. Load PNG, render overlay. Handle loading state (spinner while PNG fetches). | Integration test of full flow using static test call (no real Agora): simulate seller capture → Track D processes → Track B renders on buyer. | Performance test segmentation: measure time per image on dev server CPU. Document result. If > 8 seconds, investigate optimization options. |
| 7 | End-to-end test in real Agora call. Seller (one laptop) shares mannequin on camera. Buyer (another device) sees overlay. Fix any canvas capture issues. | Full buyer UX test on real Android phone. Verify MediaPipe performs at ≥15fps. Fix any mobile-specific issues. | Full UI flow test. Simulate complete session: connect → seller presents → buyer tries on → screenshot → call ends. Fix all UX gaps. | Load test: 5 concurrent segmentation requests. Verify server handles them without crash. Document queue behavior. |

**Sprint 1 Deliverable:** A real video call between two browsers where the seller shows a garment on a mannequin, the platform captures and segments it, and the buyer sees it overlaid on their own body in real-time. Demonstrated on real devices, not a simulation.

---

| Day | Track A | Track B | Track C | Track D |
|---|---|---|---|---|
| 8 | Implement garment dimension estimation from seller frame: use mannequin shoulder keypoints and a known average (mannequin shoulder = 36cm) to calculate px-per-cm. Extract garment bounding box width and height. | Implement vertical alignment using hip keypoints: garment bottom edge aligns with mid-hip point. Test on 3 different body heights. | Implement multi-garment flow: "Show New Garment" button resets capture state, clears buyer overlay, starts new capture cycle without ending the call. | Add segmentation status polling: `GET /api/ar/sessions/:id/status` returns `{ status: 'processing' | 'ready', png_url }`. Frontend polls every 500ms until ready. |
| 9 | Add lighting quality detection: compute average luminance of seller frame. If mean pixel brightness < 80 or > 220 (out of 255), flag lighting as poor. Expose as enforcement rule. | Implement size recommendation card. Logic: compare buyer estimated shoulder vs garment shoulder_cm. Display fit badge (good/loose/tight) with disclaimer text. | Implement session timer display: show how long the current garment capture has been active. Show "Garment captured X seconds ago" to both parties. | Implement error handling for segmentation failures: if REMBG throws, return HTTP 500 with structured error. Frontend shows "Capture failed — please try again" and resets to capture mode. |
| 10 | Refine mannequin detection: test on varied backgrounds (shop shelves, fabric walls, poor lighting). Tune confidence threshold so false positives are minimized. | Add screenshot feature: `compositeCanvas.toDataURL('image/jpeg', 0.85)`. Composite draws buyer video frame first, then garment overlay, then size card text. One button, one download. | Add Agora session integration: detect when Agora call ends (Agora `user-left` event). Trigger `DELETE /api/ar/sessions/:id` on call end. Clear all AR state. | Test ephemeral cleanup: verify that after `DELETE /api/ar/sessions/:id`, the PNG files are gone from `/tmp/`. Verify after 1-hour timeout too. |
| 11 | Edge case testing: seller moves camera during capture attempt. Seller's video is low resolution. Seller has bad network (low FPS stream). Document behavior and set fallback for each. | Edge case testing: buyer is in very dark room. Buyer too close to camera (partial body). Multiple people in buyer frame. Document behavior and set fallback. | Edge case testing: call drops mid-capture. Seller dismisses garment before buyer tries it on. Poor network causes PNG URL to 404. Add fallback UX for each case. | Optimize REMBG: test `rembg` with `--model` flag to select smaller model (`isnet-general-use` vs `u2net`). Compare quality and speed. Document recommendation. |
| 12 | Performance audit: how many ms does canvas frame capture + quality scoring + mannequin detection take per 500ms tick? Target: < 100ms total. Profile and optimize. | Performance audit: MediaPipe fps on Redmi Note 10, iPhone SE, Chrome desktop. Document results. Optimize if < 15fps on target device. | UX audit: time entire flow from "seller presses Present Garment" to "buyer sees overlay." Target < 20 seconds total. Identify slowest step. | Performance audit: segmentation time per image on production server. If > 5 seconds, explore parallel workers or async queue. |
| 13 | Cross-browser test: Chrome Android, Safari iOS, Firefox desktop, Chrome desktop. Specifically test canvas capture of Agora remote video on each. Document any browser-specific workarounds. | Cross-browser test: getUserMedia on HTTP vs HTTPS. MediaPipe WASM on Firefox. Canvas rendering on Safari. Fix all issues. | Cross-browser test: session state persistence across page refresh. Consent modal on iOS. Screenshot download on Android. Fix all issues. | Security audit: ensure `/tmp/ar_sessions/` is not publicly browseable. Ensure PNG URLs contain UUIDs (not predictable). Ensure cleanup is irreversible. |
| 14 | Sprint 2 integration test: full multi-garment session with two real devices. Seller shows 3 different garments. Each triggers capture, segment, overlay cycle. All 3 work without call restart. | Sprint 2 integration test: buyer tries all 3 garments. Size cards accurate for each. Screenshots taken. Session ends cleanly. | Sprint 2 integration test: enforcement rules active. Seller cannot capture if lighting fails. Stability countdown visible. All session state transitions correct. | Sprint 2 integration test: all 3 garment PNGs cleaned up after session ends. No leftover files. Segmentation service still responsive for a new call immediately after. |

**Sprint 2 Deliverable:** Full multi-garment live AR session working reliably. Seller shows 3 different garments in one call. Buyer tries all 3 with accurate size cards. Session cleans up correctly. All enforcement rules enforced.

---

Days 15–21 (Sprint 3) focus on polish and demo hardening. Specific tasks assigned at Sprint 3 kickoff based on outstanding issues from Sprint 2 retrospective. Mandatory Sprint 3 items:

- Hackathon demo run-through (minimum 3 dry runs on real devices)
- All enforcement rule copy finalized and user-tested
- Loading states, error states, and empty states all implemented (no raw errors visible to user)
- Demo URL deployed to HTTPS (Vercel or equivalent)
- Judge-facing one-pager prepared

---

## 8. Track A — Live Frame Capture Pipeline

**Owner:** Frontend developer (can be same as Track C)  
**Primary language:** JavaScript (React)  
**Depends on:** Track D endpoint being live by Day 4 (mock until then)

### Responsibility
Track A owns everything between "the seller's Agora video is playing in the buyer's browser" and "a JPEG frame is sent to the backend." It does not own the backend (Track D) or the AR overlay (Track B).

### Components

#### `useFrameCapture` hook

```
Inputs:
  sellerVideoRef   — React ref to the <video> element playing seller's Agora stream
  isCapturing      — boolean, true when seller has pressed "Present Garment"

Outputs:
  captureStatus    — 'idle' | 'scanning' | 'mannequin_detected' | 'counting_down' | 'capturing' | 'sent'
  countdown        — number 0–3 (only meaningful when captureStatus === 'counting_down')
  qualityWarnings  — string[] (e.g. ['poor_lighting', 'low_sharpness'])

Internal logic:
  1. Every 500ms (setInterval), draw sellerVideoRef to a hidden canvas using ctx.drawImage()
  2. Calculate frame sharpness: compute mean of abs(pixel[i] - pixel[i-1]) across a 50x50 center crop
  3. Calculate luminance: compute average of (R*0.299 + G*0.587 + B*0.114) across full frame
  4. Run MannequinPresenceCheck (see below)
  5. If mannequin detected AND sharpness > SHARPNESS_THRESHOLD AND luminance in [80, 220]:
     - Start 3-second countdown
     - On each tick, re-evaluate all conditions
     - If any condition fails during countdown, reset countdown to 0
  6. After 3 successful seconds: encode canvas to JPEG blob, send to POST /api/ar/segment-live
  7. Set captureStatus = 'sent', stop interval
```

#### `MannequinPresenceCheck` (internal utility)

```
Input:  ImageData from canvas (hidden canvas containing seller video frame)
Output: boolean — true if mannequin-shaped object detected

Method:
  - Load @mediapipe/pose (same CDN as buyer pose detection)
  - Run pose.send({ image: hiddenCanvas }) on the seller video frame
  - Check if landmarks[11] (LEFT_SHOULDER) and landmarks[12] (RIGHT_SHOULDER) are detected
    with visibility > 0.5
  - Check if landmarks[23] (LEFT_HIP) and landmarks[24] (RIGHT_HIP) are detected
    with visibility > 0.4
  - Return true only if all four are satisfied

Performance note:
  MediaPipe Pose WASM runs on a separate thread (web worker). Running it on BOTH
  seller frames (for detection) and buyer frames (for overlay) simultaneously is possible
  but may cause fps drops on low-end devices. In Sprint 1, run sequentially.
  In Sprint 2, investigate running on separate workers.
```

#### Frame quality constants (configurable, not hardcoded)

```javascript
const AR_CONFIG = {
  CAPTURE_INTERVAL_MS: 500,
  SHARPNESS_THRESHOLD: 12,       // mean pixel delta, higher = sharper
  MIN_LUMINANCE: 80,             // 0–255 scale
  MAX_LUMINANCE: 220,
  STABILITY_DURATION_MS: 3000,   // how long conditions must hold before capture
  JPEG_QUALITY: 0.85,            // canvas.toBlob quality
};
```

### Deliverables — Track A

| Sprint | Deliverable | Acceptance Criteria |
|---|---|---|
| Sprint 1 | `useFrameCapture` hook | Hook correctly identifies a mannequin held in front of a laptop camera and triggers capture after 3 stable seconds |
| Sprint 1 | `MannequinPresenceCheck` utility | Returns true for mannequin, false for empty frame, false for human face close-up |
| Sprint 1 | Frame JPEG sent to backend | `POST /api/ar/segment-live` receives a valid JPEG. PNG URL returned. No console errors. |
| Sprint 2 | Lighting detection rule | `qualityWarnings` includes `'poor_lighting'` in a dark room, cleared when lighting improves |
| Sprint 2 | Dimension estimation from seller frame | Returns `{ garment_width_cm: number, garment_height_cm: number }` with ±10cm accuracy vs physical measurement |
| Sprint 2 | Cross-browser canvas capture | `ctx.drawImage(videoEl)` works on Chrome Android, Safari iOS, Firefox desktop without workarounds |

---

## 9. Track B — Buyer AR Overlay Engine

**Owner:** Frontend developer  
**Primary language:** JavaScript (React)  
**Depends on:** `capturedGarmentUrl` from session context (Track C), can use static PNG until Day 8

### Responsibility
Track B owns everything from "a garment PNG URL is available" to "the garment is rendered on the buyer's body in real-time." It does not own how the PNG was produced (Track A/D) or the session state management (Track C).

### Components

#### `useCamera` hook

```
Outputs:
  videoRef         — React ref to <video> element showing buyer's front camera
  stream           — MediaStream | null
  isLoading        — boolean
  error            — 'denied' | 'not_supported' | null

Implementation:
  navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  })

  On unmount: stream.getTracks().forEach(track => track.stop())
  On error: map DOMException names to typed error values above
```

#### `usePoseDetection` hook

```
Input:
  videoRef         — ref to buyer's <video> element

Outputs:
  keypoints        — MediaPipe NormalizedLandmarkList | null
  isModelLoaded    — boolean
  fps              — number (calculated over last 30 frames)

MediaPipe config:
  modelComplexity: 1
  smoothLandmarks: true
  enableSegmentation: false
  minDetectionConfidence: 0.5
  minTrackingConfidence: 0.5

CDN:
  https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js

EMA Smoothing (applied per keypoint, per axis):
  smoothed[i].x = 0.6 * current[i].x + 0.4 * prev[i].x
  smoothed[i].y = 0.6 * current[i].y + 0.4 * prev[i].y

Body visibility check:
  Returns null (not useble) if any of keypoints 11, 12, 23, 24
  have visibility < 0.5
```

#### `useGarmentOverlay` hook

```
Inputs:
  canvasRef        — ref to overlay <canvas> (positioned absolute over video)
  videoRef         — ref to buyer <video>
  keypoints        — from usePoseDetection
  garmentUrl       — URL of segmented garment PNG

Internal state:
  garmentImage     — HTMLImageElement, loaded once when garmentUrl changes

Per-frame rendering (requestAnimationFrame loop):
  1. ctx.clearRect(0, 0, canvas.width, canvas.height)
  2. If keypoints null or garmentImage not loaded: return
  3. Extract in pixel coordinates (multiply by canvas width/height):
       LS = keypoints[11]  (LEFT_SHOULDER)
       RS = keypoints[12]  (RIGHT_SHOULDER)
       LH = keypoints[23]  (LEFT_HIP)
       RH = keypoints[24]  (RIGHT_HIP)
  4. shoulderWidth_px = distance(LS, RS)
  5. torsoHeight_px = distance(midShoulder, midHip)
     where midShoulder = avg(LS, RS), midHip = avg(LH, RH)
  6. scaledWidth  = shoulderWidth_px * 1.15  // 15% padding for body beyond shoulders
  7. scaledHeight = garmentImage.naturalHeight * (scaledWidth / garmentImage.naturalWidth)
  8. xPos = LS.x_px - (scaledWidth * 0.075)  // slight left overhang
  9. yPos = midShoulder.y_px - (scaledHeight * 0.08)  // neckline alignment
  10. ctx.drawImage(garmentImage, xPos, yPos, scaledWidth, scaledHeight)

Output: screenshotFn — captures composite (video frame + garment + size text) as JPEG blob
```

#### `SizeCard` component

```
Props:
  garmentShoulderCm   — from Track D response or manual entry
  garmentChestCm      — from Track D response or manual entry
  garmentLengthCm     — from Track D response or manual entry
  buyerShoulderPx     — shoulder width in pixels from keypoints
  videoWidthPx        — canvas width in pixels

Size estimation:
  ASSUMED_SHOULDER_CM = 38  (average Indian adult shoulder width)
  pxPerCm = buyerShoulderPx / ASSUMED_SHOULDER_CM
  estimatedBuyerShoulder = buyerShoulderPx / pxPerCm  (always = 38, honest estimate)

  NOTE: Without depth data, we cannot measure the buyer accurately.
  The size card shows garment dimensions accurately (from Track D) and
  the buyer's estimated shoulder as a reference point only.

Fit recommendation logic:
  diff = garmentShoulderCm - ASSUMED_SHOULDER_CM
  if diff > 3:  "Garment runs large — consider sizing down"
  if diff < -3: "Garment runs small — consider sizing up"
  else:         "Standard fit for average build"

  Always show disclaimer: "Measurements are estimates. Confirm with salesperson."

Display: garment chest, garment length, garment shoulder, fit recommendation badge
```

### Deliverables — Track B

| Sprint | Deliverable | Acceptance Criteria |
|---|---|---|
| Sprint 1 | `useCamera` | Camera activates, video plays, stream stops on unmount, error states all handled |
| Sprint 1 | `usePoseDetection` | Skeleton visible in debug mode at ≥15fps on Redmi Note 10 Chrome |
| Sprint 1 | `useGarmentOverlay` | Garment PNG scales with buyer movement, stays anchored to shoulders, no jitter |
| Sprint 1 | EMA smoothing | Visual jitter eliminated. Garment overlay is visually smooth. |
| Sprint 1 | `SizeCard` | Displays 3 garment dimensions + fit badge + disclaimer. Updates when new garment loaded. |
| Sprint 1 | Screenshot | `screenshotFn()` produces a JPEG with garment visible on buyer. Downloads on desktop, shows modal on mobile. |
| Sprint 2 | Hip alignment | Garment length extends to correct position on buyer's body. Tested on 5 different heights. |
| Sprint 2 | Body visibility detection | Overlay pauses with warning when buyer moves too close (< 8 keypoints visible) |

---

## 10. Track C — Enforcement Rules and Session UI

**Owner:** Frontend developer (can be same as Track A)  
**Primary language:** JavaScript (React)  
**Depends on:** Nothing — starts Day 1 independently

### Responsibility
Track C owns the session state machine, all enforcement UI, all user-facing guidance overlays, and the Agora session lifecycle integration. It is the "conductor" that coordinates Tracks A and B.

### Session State Machine

```
States:
  IDLE              — AR not active. Video call may be ongoing.
  SELLER_PREPARING  — Seller pressed "Present Garment." Enforcement rules checking.
  SCANNING          — Rules met. Mannequin detection running.
  COUNTING_DOWN     — Mannequin stable. 3-second countdown active.
  PROCESSING        — Frame sent to backend. Waiting for PNG.
  AR_ACTIVE         — PNG received. Buyer overlay live.
  ERROR             — Something failed. Recovery options shown.

Transitions:
  IDLE → SELLER_PREPARING     : seller clicks "Present Garment"
  SELLER_PREPARING → SCANNING  : all enforcement rules pass
  SCANNING → COUNTING_DOWN     : mannequin detected
  COUNTING_DOWN → SCANNING     : stability broken (seller moved)
  COUNTING_DOWN → PROCESSING   : 3 seconds stable
  PROCESSING → AR_ACTIVE       : PNG URL received from backend
  PROCESSING → ERROR           : backend returns error
  AR_ACTIVE → SELLER_PREPARING : seller clicks "Show New Garment"
  ANY → IDLE                   : call ends (Agora user-left event)
  ERROR → SELLER_PREPARING     : user clicks "Try Again"
```

#### `useSessionState` hook

```
Exports:
  sessionId          — string (UUID, generated on call start)
  sessionState       — one of the states above
  capturedGarmentUrl — string | null (PNG URL, set when PROCESSING → AR_ACTIVE)
  enforcementStatus  — { distance: bool, lighting: bool, stability: bool }
  transitionTo       — (state: string) => void
  endSession         — () => void (triggers backend cleanup + resets all state)
```

### Enforcement Rules UI

#### Seller-side panel (shown in seller's browser when AR mode active)

```
┌─────────────────────────────────────────┐
│  PRESENT GARMENT                        │
│                                         │
│  ✓  Distance     Camera 1.2–2m away     │
│  ✓  Lighting     Good visibility        │
│  ⟳  Stability   Hold steady...  2s     │
│                                         │
│  [HOLD STEADY — Capturing in 1s]        │
│                                         │
│  Rules:                                 │
│  · Full mannequin must be visible       │
│  · Hold still for 3 seconds             │
│  · Ensure good lighting                 │
└─────────────────────────────────────────┘
```

#### Buyer-side panel (shown on buyer's screen)

```
┌─────────────────────────────────────────┐
│  TRY ON AR                              │
│                                         │
│  Status: Salesperson is presenting...   │
│  [Animated progress indicator]          │
│                                         │
│  ─── Once garment is ready ───          │
│                                         │
│  [ ACTIVATE TRY ON ]  (button, greyed   │
│  until PROCESSING → AR_ACTIVE)          │
│                                         │
│  Stand 1.5m from your camera            │
│  Keep your full body visible            │
└─────────────────────────────────────────┘
```

### Enforcement Rule Specifications

See Section 14 for full enforcement rule specs. Track C owns the UI feedback for all rules. The detection logic lives in Track A (seller camera analysis) and Track B (buyer camera analysis).

### Deliverables — Track C

| Sprint | Deliverable | Acceptance Criteria |
|---|---|---|
| Sprint 1 | `useSessionState` hook | All state transitions work. State is correct at each step of the flow. |
| Sprint 1 | `SessionContext` provider | Wraps AR component tree. All child components can read session state. |
| Sprint 1 | Seller enforcement panel | 3 rule indicators update in real-time. Panel only shows "Ready" when all 3 are green. |
| Sprint 1 | Buyer consent modal | DPDP-compliant text. Cannot be dismissed without explicit Accept/Decline. Decision stored in localStorage. |
| Sprint 1 | Buyer camera guide | Instruction overlay appears before AR activates. Disappears after 3 seconds or user taps dismiss. |
| Sprint 1 | Session end cleanup | When Agora `user-left` fires, `endSession()` is called, all AR state resets, `DELETE /api/ar/sessions/:id` is called. |
| Sprint 2 | Multi-garment flow | "Show New Garment" resets to SELLER_PREPARING state. Previous PNG cleared from buyer overlay. New cycle completes successfully. |
| Sprint 2 | Error recovery UI | All error states have recovery options. No raw error messages shown to user. |
| Sprint 2 | Session timer | Shows "Garment presented Xs ago" to both parties. |

---

## 11. Track D — Backend Segmentation Service

**Owner:** Backend developer  
**Primary language:** Node.js + Python  
**Depends on:** Nothing — starts Day 1 independently

### Responsibility
Track D owns everything that happens on the server: receiving frames, running REMBG, returning PNGs, managing ephemeral storage, and cleaning up after sessions.

### `segment.py` — Python segmentation script

```python
#!/usr/bin/env python3
"""
Webion AR Garment Segmentation Script
Usage: python segment.py --input /tmp/frame_abc123.jpg --output /tmp/ar_sessions/sess_xyz/garment.png
"""
import argparse
import sys
from pathlib import Path
from PIL import Image
from rembg import remove

def segment(input_path: str, output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(input_path, 'rb') as f:
        input_data = f.read()
    output_data = remove(input_data)
    with open(output_path, 'wb') as f:
        f.write(output_data)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        segment(args.input, args.output)
        print('OK')
        sys.exit(0)
    except Exception as e:
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)
```

**Important:** REMBG downloads its AI model (~170MB) on first run. Run `python segment.py` once after deployment to pre-download. Subsequent calls are fast.

**Model selection:** Use `isnet-general-use` for better edge quality on patterned fabric:
```python
from rembg import remove, new_session
session = new_session("isnet-general-use")
output_data = remove(input_data, session=session)
```

### Node.js routes and controllers

#### `POST /api/ar/segment-live`

```
Purpose:    Accept a JPEG frame from buyer browser, run segmentation, return PNG URL
Auth:       Buyer JWT required (existing Webion auth middleware)
Content-Type: multipart/form-data

Form fields:
  frame       File    Required. JPEG image captured from seller video canvas.
                      Max size: 2MB. Rejected if > 2MB.
  session_id  string  Required. Agora channel/session ID for this call.
                      Used as directory name in /tmp/ar_sessions/{session_id}/

Processing:
  1. Validate fields. Return 400 if missing.
  2. Validate MIME type: must be image/jpeg or image/png. Return 415 if not.
  3. Validate file size: must be < 2MB. Return 413 if over.
  4. Save uploaded file to /tmp/frames/{uuid}.jpg
  5. Generate output path: /tmp/ar_sessions/{session_id}/{uuid}.png
  6. Spawn child process: python3 {PYTHON_PATH}/segment.py --input {input} --output {output}
  7. On success: insert row into ar_sessions table (if not exists), update with png path.
  8. Delete input JPEG from /tmp/frames/
  9. Return:
     {
       "success": true,
       "png_url": "/ar-temp/{session_id}/{uuid}.png",
       "session_id": "...",
       "processing_time_ms": 2341
     }

On segmentation failure:
     HTTP 500
     {
       "success": false,
       "error": "Segmentation failed",
       "message": "Could not isolate garment from background. Ask seller to improve positioning.",
       "retry": true
     }

Timeout: If Python process runs > 15 seconds, kill it and return 504.
```

#### `DELETE /api/ar/sessions/:session_id`

```
Purpose:    Clean up all files for a session. Called on call end.
Auth:       Buyer or Seller JWT (either party can end session)

Processing:
  1. Verify session_id exists in ar_sessions table.
  2. Delete directory: rimraf /tmp/ar_sessions/{session_id}/
  3. Update ar_sessions row: set ended_at = NOW(), files_deleted = true
  4. Return: { "deleted": true, "session_id": "..." }

If session not found: return 404 (not an error — session may already be cleaned up)
```

#### `GET /api/ar/sessions/:session_id/status`

```
Purpose:    Polling endpoint for processing status (used if segmentation is async)
Auth:       Buyer or Seller JWT

Returns:
  { "status": "processing" }   — still running
  { "status": "ready", "png_url": "..." }  — complete
  { "status": "failed", "message": "..." }  — error
```

### Ephemeral file serving

PNG files in `/tmp/ar_sessions/` must be served as static files via Express:

```javascript
// In app.js / server.js — add this middleware:
app.use('/ar-temp', (req, res, next) => {
  // Security: only serve files with UUID-based paths
  const uuidPattern = /^\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.png$/;
  if (!uuidPattern.test(req.path)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}, express.static('/tmp/ar_sessions', {
  maxAge: '1h',
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
    res.set('Cache-Control', 'private, max-age=3600');
  }
}));
```

### Cleanup job

```javascript
// cleanup.js — run via cron every 15 minutes OR via node-cron
// Deletes session directories older than 1 hour

const fs = require('fs');
const path = require('path');
const SESSION_DIR = '/tmp/ar_sessions';
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

function cleanup() {
  if (!fs.existsSync(SESSION_DIR)) return;
  const sessions = fs.readdirSync(SESSION_DIR);
  const now = Date.now();
  sessions.forEach(sessionId => {
    const dirPath = path.join(SESSION_DIR, sessionId);
    const stat = fs.statSync(dirPath);
    if (now - stat.mtimeMs > MAX_AGE_MS) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`[AR Cleanup] Deleted expired session: ${sessionId}`);
    }
  });
}
```

### Deliverables — Track D

| Sprint | Deliverable | Acceptance Criteria |
|---|---|---|
| Sprint 1 | `segment.py` script | Accepts any JPEG, returns clean transparent PNG. Tested on 10 garment photos including patterned and dark fabrics. |
| Sprint 1 | `POST /api/ar/segment-live` | Postman test: send JPEG, receive `{ success: true, png_url }` in < 10 seconds on dev server. |
| Sprint 1 | PNG file serving | PNG URL from API response loads correctly in browser with correct CORS headers. |
| Sprint 1 | Input validation | Sending wrong MIME type returns 415. Sending file > 2MB returns 413. Missing session_id returns 400. |
| Sprint 1 | `DELETE /api/ar/sessions/:id` | After deletion, PNG URL returns 404. Database row updated. |
| Sprint 1 | Cleanup job | Running cleanup manually deletes sessions older than 1 hour. Verified via filesystem. |
| Sprint 2 | `GET /api/ar/sessions/:id/status` | Polling endpoint returns correct status at each processing stage. |
| Sprint 2 | Session analytics | `ar_sessions` table populated correctly for every segmentation request. |
| Sprint 2 | Concurrent load | 5 simultaneous POST requests all complete without crash. Processing times logged. |

---

## 12. API Contracts

### Summary Table

| Endpoint | Method | Owner | Called By | Sprint |
|---|---|---|---|---|
| `/api/ar/segment-live` | POST | Track D | Track A (buyer browser) | 1 |
| `/api/ar/sessions/:id` | DELETE | Track D | Track C (on call end) | 1 |
| `/api/ar/sessions/:id/status` | GET | Track D | Track C (polling) | 2 |
| `/ar-temp/:session_id/:uuid.png` | GET | Track D static | Track B (loads PNG) | 1 |

### Mock Response for Track A (Day 1–3 before Track D is ready)

```javascript
// mockSegmentResponse.js — use this in Track A during Sprint 1 development
// Replace with real API call once Track D endpoint is live

export async function segmentLiveFrame(jpegBlob, sessionId) {
  // MOCK — remove this block and uncomment real call below for integration
  await new Promise(resolve => setTimeout(resolve, 2000)); // simulate 2s processing
  return {
    success: true,
    png_url: '/test_garment.png', // pre-segmented test asset in /public
    session_id: sessionId,
    processing_time_ms: 2134
  };

  // REAL CALL (uncomment for integration):
  // const formData = new FormData();
  // formData.append('frame', jpegBlob, 'frame.jpg');
  // formData.append('session_id', sessionId);
  // const res = await fetch('/api/ar/segment-live', {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${getToken()}` },
  //   body: formData
  // });
  // return res.json();
}
```

---

## 13. Data Models

### New Table: `ar_sessions`

Tracks each AR session. One row per Agora call where AR was used. Not a product database — purely session metadata.

```sql
CREATE TABLE ar_sessions (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  session_id      VARCHAR(100) NOT NULL UNIQUE,  -- Agora channel ID
  buyer_user_id   INT NOT NULL,
  seller_user_id  INT NULL,
  started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at        DATETIME NULL,
  files_deleted   TINYINT(1) DEFAULT 0,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### New Table: `ar_session_events`

Tracks each garment capture event within a session. Multiple rows per session (one per garment shown).

```sql
CREATE TABLE ar_session_events (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  session_id          VARCHAR(100) NOT NULL,
  event_type          ENUM('capture_started','capture_complete','capture_failed',
                           'overlay_activated','screenshot_taken') NOT NULL,
  processing_time_ms  INT NULL,
  screenshot_taken    TINYINT(1) DEFAULT 0,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES ar_sessions(session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### No changes to existing tables

The existing `products`, `users`, `orders`, and `categories` tables are NOT modified. No `has_ar_asset` column, no `garment_ar_assets` table. The previous PRD's schema additions are **cancelled** in favor of this ephemeral approach.

### Migration file

```sql
-- File: migrations/003_add_ar_session_tables.sql

CREATE TABLE ar_sessions (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  session_id      VARCHAR(100) NOT NULL UNIQUE,
  buyer_user_id   INT NOT NULL,
  seller_user_id  INT NULL,
  started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at        DATETIME NULL,
  files_deleted   TINYINT(1) DEFAULT 0,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ar_session_events (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  session_id          VARCHAR(100) NOT NULL,
  event_type          ENUM('capture_started','capture_complete','capture_failed',
                           'overlay_activated','screenshot_taken') NOT NULL,
  processing_time_ms  INT NULL,
  screenshot_taken    TINYINT(1) DEFAULT 0,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES ar_sessions(session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 14. Enforcement Rules Specification

These rules exist to ensure the system can reliably segment the garment and produce a useful AR overlay. Rules are enforced in the UI — they cannot be bypassed by the user.

### Seller-Side Rules (enforced on seller's video feed)

#### Rule S-01: Mannequin Visibility
- **What:** Full mannequin torso must be visible — both shoulders and both hips detected by MediaPipe Pose.
- **Threshold:** Keypoints 11, 12, 23, 24 all with visibility > 0.5.
- **Why:** Without the full torso, garment dimensions cannot be estimated and segmentation quality degrades.
- **Enforcement:** "Show Garment" capture button greyed out. Status indicator shows red. Message: "Adjust camera until full mannequin torso is visible."
- **Fallback:** If mannequin is unavailable, seller can hold garment flat against a plain wall. Document this as an accepted alternate positioning.

#### Rule S-02: Camera Stability
- **What:** Seller's camera must not be moving during capture.
- **Threshold:** Mean absolute pixel difference between consecutive 500ms frames must be < 8.0 (on a 0–255 scale across a 100×100 center crop).
- **Why:** Motion blur in the captured frame severely degrades REMBG segmentation quality.
- **Enforcement:** 3-second countdown resets to 0 if frame delta exceeds threshold during countdown.
- **UI:** Animated stability bar shows current stability level in real-time.

#### Rule S-03: Lighting Adequacy
- **What:** Frame must not be too dark or too bright.
- **Threshold:** Average frame luminance must be between 80 and 220 (0–255 scale).
- **Why:** Dark frames produce poor REMBG output. Overexposed frames lose garment edge detail.
- **Enforcement:** Warning shown: "Improve lighting before capture." Capture button remains greyed.
- **Practical guidance shown to seller:** "Move near a window or turn on room lights. Avoid direct sunlight behind the mannequin."

#### Rule S-04: Minimum Hold Duration
- **What:** All three above rules must be satisfied for a continuous 3 seconds before capture triggers.
- **Why:** Prevents accidental capture of a blurred or poorly-lit frame.
- **Enforcement:** Countdown is visible to seller. Any rule failure resets countdown. Countdown is not adjustable by the user.

### Buyer-Side Rules (enforced on buyer's camera)

#### Rule B-01: Full Body Visibility
- **What:** Buyer must have both shoulders and both hips visible in frame.
- **Threshold:** Keypoints 11, 12, 23, 24 all with visibility > 0.5.
- **Why:** Without hip keypoints, vertical garment alignment fails.
- **Enforcement:** Overlay pauses. Message: "Step back — full body not visible."
- **UI:** Yellow border appears on buyer video with directional guidance.

#### Rule B-02: Adequate Distance
- **What:** Buyer must not be too close or too far from camera.
- **Detection:** Estimate using inter-shoulder distance. If shoulder distance > 45% of frame width: too close. If < 15% of frame width: too far.
- **Enforcement:** Overlay pauses. Message: "Move further back" or "Move closer to camera."

#### Rule B-03: Camera Must Be HTTPS
- **What:** This is a technical constraint, not a user rule — `getUserMedia` requires a secure context.
- **Enforcement:** If page is not HTTPS, show error before any camera request: "AR Try-On requires a secure connection (HTTPS). Contact your administrator."
- **No workaround for HTTP — HTTPS is mandatory.**

### Rules That Are Intentionally NOT Enforced
- Garment type (the system does not check if the object is actually a garment)
- Number of garments on the mannequin (seller's responsibility)
- Background color (REMBG works on any background, though plain backgrounds produce better results)
- Buyer's clothing (the overlay appears on top regardless)

---

## 15. Non-Functional Requirements

### Performance Targets

| Metric | Target | Measurement Method |
|---|---|---|
| End-to-end latency (Present Garment → overlay visible) | < 20 seconds | Stopwatch on real devices |
| Buyer overlay frame rate | ≥ 15fps on Redmi Note 10, Chrome | DevTools Performance panel |
| MediaPipe model load time (first load) | < 6 seconds on 4G | Chrome Network tab |
| Segmentation time per frame | < 8 seconds on CPU server | Node.js `Date.now()` before/after Python call |
| PNG file size (segmented garment) | < 800KB | `ls -lh` on output files |
| Canvas capture tick duration | < 80ms per 500ms tick | `performance.now()` in hook |

### Browser Support

| Browser | Support | Notes |
|---|---|---|
| Chrome Android 90+ | Full — primary target | All APIs supported |
| Chrome Desktop 90+ | Full — demo target | All APIs supported |
| Safari iOS 14.5+ | Full — secondary target | Requires HTTPS. Test `ctx.drawImage(video)` explicitly — known quirks. |
| Firefox Desktop 80+ | Should work | Test MediaPipe WASM loading |
| Samsung Internet | Best effort | Test canvas capture of video |
| Any HTTP context | Not supported | getUserMedia blocked by browser |

### Security Requirements

1. **No buyer video leaves the browser.** MediaPipe runs via WASM. No video frame is transmitted to any server. This is a hard, non-negotiable constraint.
2. **Seller frames are transmitted only for segmentation and immediately deleted.** Input JPEG is deleted from `/tmp/frames/` immediately after segmentation completes.
3. **PNG URLs contain UUIDs.** URLs are not guessable (`/ar-temp/{session_uuid}/{file_uuid}.png`).
4. **PNG files are served only to authenticated users.** The static file middleware must check JWT before serving. (Add auth middleware to `/ar-temp` route.)
5. **All AR endpoints require existing Webion JWT auth.** No new auth system.
6. **HTTPS mandatory.** Document in deployment checklist. Development can use `localhost` (which counts as a secure context for `getUserMedia`).

### Privacy Requirements

1. Display consent modal before any camera activation on buyer's device.
2. Consent text must state: "Your camera is used only on your device. No video is sent to our servers."
3. Consent decision stored in `localStorage`. Key: `webion_ar_consent_v1`. Value: `"accepted"` or `"declined"`.
4. If consent was previously given, do not show modal again in the same browser.
5. Seller frames (used for segmentation) are not biometric data and do not require special consent, but must be deleted after use per standard data minimization practice.

---

## 16. Definition of Done

### Sprint 1 — Done When All of the Following Are True

1. On a real device (physical Android phone or laptop), a person acting as seller opens a browser, starts an Agora video call, and presses "Present Garment."
2. The seller's enforcement panel shows real-time status for stability, mannequin detection, and lighting.
3. When the seller holds a mannequin steady with a garment on it for 3 seconds, the platform automatically captures the frame and sends it to the backend.
4. The backend segments the garment and returns a PNG URL within 10 seconds.
5. On a second device acting as buyer, the buyer presses "Try On AR," allows camera access, and sees the segmented garment overlaid on their own torso.
6. The garment overlay resizes and repositions as the buyer moves closer/further from the camera.
7. The size card is visible alongside the overlay showing garment dimensions and a fit recommendation.
8. The buyer can take a screenshot showing the garment on their body.
9. When the Agora call ends, the segmented PNG is deleted from the server and the buyer's overlay disappears.
10. No raw error messages or stack traces appear in the browser UI at any point in this flow.

### Sprint 2 — Done When All of the Following Are True

1. All Sprint 1 criteria still pass.
2. Seller can show 3 different garments in the same call without ending and restarting. Each garment replaces the previous overlay on the buyer's screen.
3. Lighting enforcement rule is live and prevents capture in a dark room (tested by covering the camera with a hand).
4. `ar_sessions` and `ar_session_events` tables are populated correctly for a full session.
5. After call ends, all PNG files for the session are confirmed deleted (verified by checking `/tmp/ar_sessions/`).
6. The flow works on Safari iOS (tested on a real iPhone, not a simulator).
7. Segmentation completes in < 8 seconds in 4 out of 5 attempts on the production server.

### Sprint 3 — Done When All of the Following Are True

1. All Sprint 2 criteria still pass.
2. The hackathon demo runs cleanly 3 times in a row without any error, on real devices, with a non-developer operating the seller side.
3. Every user-facing string has been reviewed for clarity and correctness.
4. All loading states, error states, and edge cases have visible fallback UI.
5. Demo URL is deployed to HTTPS and shareable via WhatsApp link.

---

## 17. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `ctx.drawImage(videoEl)` doesn't capture Agora frames on Safari | Medium | High | Test on Day 1 with a simple HTML page. Safari has known issues with drawing DRM-protected video streams. Agora is not DRM but test explicitly. Fallback: use `videoTrack.getMediaStreamTrack()` to create a new MediaStream for capture. |
| REMBG produces poor results for patterned garments (prints, checks) | High | Medium | Test REMBG with `isnet-general-use` model which handles patterns better. Add seller guidance: "Plain or solid-colored garments work best." For hackathon demo, pre-select a solid-color garment. |
| 20-second latency feels broken in a live sales conversation | Medium | High | Build strong UI narrative: progress indicator with explicit stages ("Detecting garment…", "Processing…", "Ready!"). The wait must feel intentional, not broken. |
| MediaPipe on seller stream + buyer stream simultaneously drops fps | Medium | Medium | Run mannequin detection at 500ms intervals (not every frame). If fps drops below 10 on buyer overlay, pause seller detection temporarily. |
| `/tmp` fills up on server if cleanup job fails | Low | High | Add monitoring: if `/tmp/ar_sessions/` exceeds 500MB, send alert. Cleanup job runs every 15 minutes, not just hourly. |
| Seller uses phone instead of laptop — camera angle is bad | High | Medium | Enforce Rule S-01 (mannequin visibility) which implicitly rejects bad angles. Add positioning guide image in seller UI showing correct camera setup. |
| HTTPS not set up on dev/staging server | Medium | High | Document as Day 1 blocker. Use `ngrok` for local HTTPS in development. Vercel provides HTTPS automatically for demo. |
| Buyer has slow network — 800KB PNG takes too long to load | Medium | Medium | Compress PNG output. REMBG output can be re-encoded with `Pillow` to reduce size. Target < 500KB. Show spinner while PNG loads. |

---

## 18. Environment Setup

### Frontend Dependencies

```bash
# No new npm packages needed beyond existing React project.
# MediaPipe loads via CDN (add to index.html):
# <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"></script>
```

### Backend — Python Environment

```bash
# Python 3.8+ required
python3 --version

# Install dependencies
pip install rembg==2.0.50 Pillow==10.0.0 onnxruntime==1.16.0

# Pre-download REMBG model (run once after deployment — downloads ~170MB)
python3 -c "from rembg import remove; remove(open('/dev/null','rb').read())"

# Create required directories
mkdir -p /tmp/ar_sessions
mkdir -p /tmp/frames
chmod 755 /tmp/ar_sessions /tmp/frames
```

### Backend — Node.js Dependencies

```bash
# Only multer is new — add to existing package.json
npm install multer@1.4.5-lts.1
```

### Environment Variables

```bash
# Add to existing .env file:
AR_TEMP_DIR=/tmp/ar_sessions         # Where segmented PNGs are stored
AR_FRAMES_DIR=/tmp/frames             # Where uploaded frames are temporarily stored
PYTHON_EXECUTABLE=/usr/bin/python3    # Path to python3 on server
AR_SESSION_TTL_HOURS=1                # How long before session files expire
AR_MAX_UPLOAD_SIZE_MB=2               # Max JPEG frame size
FRONTEND_URL=https://your-domain.com  # For CORS on /ar-temp static serving
```

### Development HTTPS (required for getUserMedia)

```bash
# Option 1: Use ngrok (recommended for local dev)
ngrok http 3000
# Use the https://xxxx.ngrok.io URL on mobile devices

# Option 2: Create local self-signed cert for React dev server
# In React project, set HTTPS=true in .env.local:
HTTPS=true
# Browser will show cert warning — accept it for development only

# Option 3: Deploy to Vercel for automatic HTTPS
vercel --prod
```

---

## 19. File Structure

```
src/                                   # React frontend
  components/
    ar/
      ARSessionPanel.jsx               # Main container — seller + buyer panels side by side
      SellerCapurePanel.jsx            # Seller's enforcement UI + capture controls
      BuyerARPanel.jsx                 # Buyer's camera + garment overlay + size card
      ConsentModal.jsx                 # Camera consent dialog (DPDP compliant)
      CameraGuide.jsx                  # "Stand 1.5m back" instruction overlay
      SizeCard.jsx                     # Garment dimensions + fit recommendation
      EnforcementIndicator.jsx         # Single rule status indicator (used x3 in seller panel)
      SessionStatusBanner.jsx          # "Salesperson is presenting..." / "Garment ready" etc.
  hooks/
    useCamera.js                       # getUserMedia, stream cleanup
    usePoseDetection.js                # MediaPipe Pose, keypoints, fps
    useGarmentOverlay.js               # Canvas rendering, garment positioning
    useFrameCapture.js                 # Seller video frame capture, quality scoring
    useSessionState.js                 # Session state machine, transitions
  context/
    SessionContext.jsx                 # React context for session state (Track C)
  utils/
    frameQuality.js                    # Sharpness and luminance calculation utilities
    sizeRecommendation.js              # Fit badge logic (pure function, unit testable)
    measurements.js                    # Pixel-to-cm conversion helpers
    segmentApi.js                      # API call to POST /api/ar/segment-live (+ mock)
  config/
    arConfig.js                        # AR_CONFIG constants (all thresholds in one place)

# Backend — new files only
routes/
  ar.routes.js                         # All /api/ar/* routes
controllers/
  ar.controller.js                     # Route handlers
models/
  ArSession.js                         # MySQL queries for ar_sessions table
  ArSessionEvent.js                    # MySQL queries for ar_session_events table
scripts/
  segment.py                           # REMBG segmentation script
  requirements.txt                     # rembg, Pillow, onnxruntime
  cleanup.js                           # Hourly session file cleanup job
migrations/
  003_add_ar_session_tables.sql        # Schema migration

public/
  test_garment.png                     # Pre-segmented test PNG for Track B development
```

---

## 20. Hackathon Demo Script

**Total time: 4 minutes. Rehearse minimum 5 times on real devices before the event.**

### Setup (before entering the room)
- Device 1 (seller): laptop or Android phone with front camera, Agora call active, logged in as seller
- Device 2 (buyer): separate phone (ideally given to the judge), logged in as buyer, same Agora call
- Garment pre-positioned on mannequin or dress form
- Room has decent lighting (not too dark, no backlight)
- Both devices on HTTPS URL

### Minute 1 — The Problem (no demo, verbal only)
> "Every e-commerce platform has the same problem. The buyer can see a product photo but cannot answer one question: will this look good on me? Return rates for apparel are 30–40% in India. Webion already solves half of this — buyers can video call a salesperson inside a real shop. But the buyer still can't try the garment on themselves."

### Minute 2 — The Core Demo
1. Hand Device 2 to the judge. "This is you — the buyer."
2. On Device 1: press "Present Garment." Show the enforcement panel. "The platform guides the salesperson — distance, lighting, stability."
3. Hold mannequin steady. Countdown visible. "Three seconds of stability."
4. Capture triggers automatically. "The platform has captured the frame."
5. On Device 2: "Try On AR" button activates. Judge taps it. Camera opens. Garment appears on judge's body.
6. Judge moves. Garment follows. "It's tracking your body in real time."

### Minute 3 — The Differentiation
> "Notice what we didn't do. The seller didn't upload a product photo. There's no garment database. The platform captured the garment live from the call, segmented it in real time, and placed it on the buyer's body. Any garment the seller picks up — in any shop, anywhere — can be tried on."

Show "Show New Garment" → switch to a different garment → repeat. Two garments in one call.

### Minute 4 — The Technology and Vision
> "This runs in a browser. No app download. MediaPipe body detection runs entirely on the buyer's device — no video is ever sent to our server. The garment image is deleted the moment the call ends."

> "Webion has a patent on the live shopping platform. This AR layer is what makes the platform complete. The buyer's last question — does it look good on me — now has a live answer."

---

*Document version: 2.0 — Live AR Try-On (Ephemeral, No Product Database)*  
*Previous version: 1.0 — Pre-stored product AR (deprecated)*  
*Webon Ecomm Pvt. Ltd. | info@webion.live | +91 9423 127 047*  
*MMCIII, MMCOE Campus, Karvenagar, Pune 411052, Maharashtra, India*
