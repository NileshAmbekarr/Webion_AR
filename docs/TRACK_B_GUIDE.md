# Track B Agent Guide — Buyer AR Overlay Engine

**Your role:** You own everything that happens on the buyer's side — camera access, body pose detection, garment overlay rendering, size estimation card, and screenshot capture.

**Branch:** `feature/track-b`

---

## Your Files

### Hooks (implement from scratch)
- `client/src/hooks/useCamera.js` — getUserMedia, video stream, cleanup
- `client/src/hooks/usePoseDetection.js` — MediaPipe Pose, keypoint smoothing, fps tracking
- `client/src/hooks/useGarmentOverlay.js` — canvas rendering, garment positioning, screenshot

### Components (replace placeholder content)
- `client/src/components/ar/BuyerARPanel.jsx` — buyer's camera view + garment overlay + size card
- `client/src/components/ar/SizeCard.jsx` — garment dimensions + fit recommendation badge
- `client/src/components/ar/CameraGuide.jsx` — "Stand 1.5m back" instruction overlay

---

## Files You Must NOT Touch

- `client/src/components/ar/ARSessionPanel.jsx` — Agent 1 (Track A+C)
- `client/src/components/ar/SellerCapturePanel.jsx` — Agent 1
- `client/src/components/ar/ConsentModal.jsx` — Agent 1
- `client/src/components/ar/EnforcementIndicator.jsx` — Agent 1
- `client/src/components/ar/SessionStatusBanner.jsx` — Agent 1
- `client/src/hooks/useFrameCapture.js` — Agent 1
- `client/src/hooks/useSessionState.js` — Agent 1
- `client/src/context/SessionContext.jsx` — Agent 1
- `server/*` — Agent 3

---

## Shared Files You Consume (read-only)

- `client/src/config/arConfig.js` — all thresholds (EMA_ALPHA, MIN_KEYPOINT_VISIBILITY, GARMENT_SHOULDER_PADDING, etc.)
- `client/src/utils/sizeRecommendation.js` — `getFitRecommendation()`, `pixelsToCm()`
- `client/src/utils/measurements.js` — `keypointDistance()`
- `client/src/context/SessionContext.jsx` — consume `capturedGarmentUrl` and `sessionState` from context

---

## How Your Track Gets the Garment PNG

You consume `capturedGarmentUrl` from SessionContext. In your development phase, this will be `null` until integration. **For development, use a static test PNG:**

1. Place a pre-segmented garment PNG at `client/public/test_garment.png`
2. In `BuyerARPanel.jsx`, use this for development:
```javascript
const { capturedGarmentUrl } = useSessionState();
const garmentUrl = capturedGarmentUrl || '/test_garment.png'; // fallback for dev
```

You can find sample segmented garment PNGs online (transparent background). Or create one by manually background-removing a garment photo.

---

## Technical Specifications

### `useCamera` Hook

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
  On error: map DOMException names to typed error values:
    - 'NotAllowedError' → 'denied'
    - 'NotFoundError' → 'not_supported'
    - Others → 'not_supported'
```

### `usePoseDetection` Hook

```
Input:
  videoRef         — ref to buyer's <video> element

Outputs:
  keypoints        — MediaPipe NormalizedLandmarkList | null
  isModelLoaded    — boolean
  fps              — number (calculated over last 30 frames)

MediaPipe Pose Setup:
  Load via CDN (add to client/index.html):
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>

  Configuration:
    modelComplexity: 1
    smoothLandmarks: true
    enableSegmentation: false
    minDetectionConfidence: 0.5
    minTrackingConfidence: 0.5

EMA Smoothing (applied per keypoint, per axis):
  smoothed[i].x = EMA_ALPHA * current[i].x + (1 - EMA_ALPHA) * prev[i].x
  smoothed[i].y = EMA_ALPHA * current[i].y + (1 - EMA_ALPHA) * prev[i].y
  (EMA_ALPHA = 0.6 from AR_CONFIG)

Body visibility check:
  Returns null (not usable) if ANY of keypoints 11, 12, 23, 24
  have visibility < MIN_KEYPOINT_VISIBILITY (0.5)
```

### `useGarmentOverlay` Hook

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
  3. Extract pixel coordinates (multiply normalized coords by canvas width/height):
       LS = keypoints[11]  (LEFT_SHOULDER)
       RS = keypoints[12]  (RIGHT_SHOULDER)
       LH = keypoints[23]  (LEFT_HIP)
       RH = keypoints[24]  (RIGHT_HIP)
  4. shoulderWidth_px = distance(LS, RS)
  5. torsoHeight_px = distance(midShoulder, midHip)
     where midShoulder = avg(LS, RS), midHip = avg(LH, RH)
  6. scaledWidth  = shoulderWidth_px * GARMENT_SHOULDER_PADDING  (1.15)
  7. scaledHeight = garmentImage.naturalHeight * (scaledWidth / garmentImage.naturalWidth)
  8. xPos = LS.x_px - (scaledWidth * GARMENT_X_OVERHANG)  (0.075)
  9. yPos = midShoulder.y_px - (scaledHeight * GARMENT_Y_NECKLINE)  (0.08)
  10. ctx.drawImage(garmentImage, xPos, yPos, scaledWidth, scaledHeight)

Output: screenshotFn — captures composite image:
  1. Create a temporary canvas same size as video
  2. Draw video frame: tempCtx.drawImage(videoEl, 0, 0)
  3. Draw garment overlay: tempCtx.drawImage(overlayCanvas, 0, 0)
  4. Convert to JPEG blob: tempCanvas.toBlob(blob => { ... }, 'image/jpeg', 0.85)
  5. Download on desktop: create <a> element with download attribute
  6. On mobile: use navigator.share() if available, else show modal with image
```

### Buyer Distance Detection

In `BuyerARPanel.jsx`, use the keypoints to check if the buyer is at an appropriate distance:

```javascript
const shoulderWidthRatio = shoulderWidth_px / canvasWidth;

if (shoulderWidthRatio > BUYER_TOO_CLOSE_THRESHOLD) {
  // Show: "Move further back"
} else if (shoulderWidthRatio < BUYER_TOO_FAR_THRESHOLD) {
  // Show: "Move closer to camera"
}
```

### `SizeCard` Component

```
Props:
  garmentShoulderCm   — from Track D response or manual entry (default: null)
  garmentChestCm      — from Track D response or manual entry (default: null)
  garmentLengthCm     — from Track D response or manual entry (default: null)
  buyerShoulderPx     — shoulder width in pixels from keypoints
  videoWidthPx        — canvas width in pixels

Display:
  ┌─────────────────────────────────┐
  │  Size Estimate                  │
  │                                 │
  │  Garment Shoulder: 42 cm       │
  │  Garment Chest:    104 cm      │
  │  Garment Length:   72 cm       │
  │                                 │
  │  [STANDARD FIT] ← badge        │
  │  Standard fit for average build │
  │                                 │
  │  ⚠ Measurements are estimates. │
  │    Confirm with salesperson.   │
  └─────────────────────────────────┘

Use getFitRecommendation() from utils/sizeRecommendation.js
```

### `CameraGuide` Component

An overlay shown briefly when the buyer's camera first activates:
- Semi-transparent dark overlay over the video
- Text: "Stand about 1.5m from your camera"
- Text: "Keep your full body visible"
- Outline showing ideal body position
- Auto-dismiss after 3 seconds OR on user tap

---

## BuyerARPanel Layout

```
┌────────────────────────────────────┐
│  BUYER AR PANEL                    │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ <video> — buyer camera       │  │
│  │                              │  │
│  │ <canvas> — garment overlay   │  │
│  │ (position: absolute, on top) │  │
│  │                              │  │
│  │ [CameraGuide overlay]       │  │
│  └──────────────────────────────┘  │
│                                    │
│  [SizeCard]                        │
│                                    │
│  Distance warning (if applicable)  │
│                                    │
│  [📷 Screenshot] button            │
│                                    │
│  Debug: keypoints=17, fps=24      │
│  (only in development mode)       │
└────────────────────────────────────┘
```

The `<canvas>` element must be:
- Same dimensions as the `<video>` element
- `position: absolute; top: 0; left: 0;`
- `pointer-events: none;` (so video controls still work)

---

## Definition of Done

Your track is done when:
1. `useCamera` — buyer's front camera activates, video plays, stream stops on unmount
2. `usePoseDetection` — debug skeleton renders on buyer video at ≥15fps, 17 keypoints visible
3. `useGarmentOverlay` — garment PNG (test image) scales with buyer movement, anchored to shoulders, no visible jitter
4. EMA smoothing — garment overlay is visually smooth, no flickering
5. `SizeCard` — displays fit badge + disclaimer, updates when new garment loaded
6. Screenshot — produces a JPEG with garment visible on buyer, downloads correctly
7. `CameraGuide` — appears on first activation, auto-dismisses
8. Distance warning — shows "move back" / "move closer" appropriately
9. Body visibility — overlay pauses with warning when buyer too close (< 4 visible keypoints)

---

## Styling

Create `client/src/components/ar/buyer-ar.css`. Use a modern, premium aesthetic:
- Semi-transparent dark panels with `backdrop-filter: blur()`
- Smooth fade-in transitions for the garment overlay
- Size card with rounded corners, subtle shadow
- Screenshot button with clear icon
- Warning messages with amber/yellow accent color
