# Track A+C Agent Guide — Session UI + Live Frame Capture Pipeline

**Your role:** You own the "conductor" of the AR system — session state management, all enforcement UI, and the frame capture pipeline from the seller's video.

**Branch:** `feature/track-a-c`

---

## Your Files

You are responsible for implementing or completing these files:

### Hooks (implement from scratch)
- `client/src/hooks/useFrameCapture.js` — seller video frame capture, quality scoring, mannequin detection
- `client/src/hooks/useSessionState.js` — session state machine (extend the existing context shell)

### Components (replace placeholder content)
- `client/src/components/ar/ARSessionPanel.jsx` — main container, seller + buyer panels side by side
- `client/src/components/ar/SellerCapturePanel.jsx` — seller's enforcement UI + capture controls
- `client/src/components/ar/ConsentModal.jsx` — buyer camera consent dialog
- `client/src/components/ar/EnforcementIndicator.jsx` — single rule status indicator (used x3)
- `client/src/components/ar/SessionStatusBanner.jsx` — buyer-facing session status messages

### Context (complete the existing shell)
- `client/src/context/SessionContext.jsx` — already has the basic shape, you add transition validation and full state machine logic

### You also modify
- `client/src/App.jsx` — wrap with SessionProvider, add Agora integration, route to ARSessionPanel

---

## Files You Must NOT Touch

- `client/src/components/ar/BuyerARPanel.jsx` — Agent 2 owns this
- `client/src/components/ar/SizeCard.jsx` — Agent 2 owns this
- `client/src/components/ar/CameraGuide.jsx` — Agent 2 owns this
- `client/src/hooks/useCamera.js` — Agent 2 owns this
- `client/src/hooks/usePoseDetection.js` — Agent 2 owns this
- `client/src/hooks/useGarmentOverlay.js` — Agent 2 owns this
- `server/*` — Agent 3 owns the backend

---

## Shared Files You Consume (read-only)

- `client/src/config/arConfig.js` — all thresholds and constants
- `client/src/utils/frameQuality.js` — `calculateSharpness()`, `calculateLuminance()`, `calculateFrameDelta()`
- `client/src/utils/segmentApi.js` — `segmentLiveFrame()`, `deleteSession()` (mock for now)

---

## Technical Specifications

### Agora 4.x Integration

You must set up the Agora video call using the **4.x Web SDK**. Install `agora-rtc-sdk-ng`:

```bash
cd client
npm install agora-rtc-sdk-ng
```

Basic Agora 4.x setup:
```javascript
import AgoraRTC from 'agora-rtc-sdk-ng';

const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

// Join channel
await client.join(APP_ID, channelName, token, uid);

// Create and publish local video track
const localVideoTrack = await AgoraRTC.createCameraVideoTrack();
await client.publish([localVideoTrack]);

// Subscribe to remote user
client.on('user-published', async (user, mediaType) => {
  await client.subscribe(user, mediaType);
  if (mediaType === 'video') {
    const remoteVideoTrack = user.videoTrack;
    // Play in a container element
    remoteVideoTrack.play(containerElementId);
  }
});
```

**To extract frames from seller's remote video (4.x SDK):**
```javascript
// Option 1: Get the internal <video> element after play()
const videoElement = document.querySelector(`#${containerElementId} video`);
ctx.drawImage(videoElement, 0, 0);

// Option 2: Use getCurrentFrameData() if canvas tainting occurs
const imageData = remoteVideoTrack.getCurrentFrameData();
// imageData is an ImageData object — draw directly to canvas
ctx.putImageData(imageData, 0, 0);
```

### Agora RTM for Session State Sync

Use Agora RTM (Real-Time Messaging) to sync session state between seller and buyer browsers.

```bash
npm install agora-rtm-sdk
```

```javascript
import AgoraRTM from 'agora-rtm-sdk';

const rtmClient = AgoraRTM.createInstance(APP_ID);
await rtmClient.login({ uid: myUserId });
const channel = rtmClient.createChannel(channelName);
await channel.join();

// Send state change to other party
channel.sendMessage({ text: JSON.stringify({ type: 'STATE_CHANGE', state: 'SCANNING' }) });

// Receive state change
channel.on('ChannelMessage', (message, memberId) => {
  const data = JSON.parse(message.text);
  if (data.type === 'STATE_CHANGE') {
    transitionTo(data.state);
  }
});
```

### Session State Machine

```
States:
  IDLE              → AR not active
  SELLER_PREPARING  → Seller pressed "Present Garment"
  SCANNING          → All enforcement rules pass, mannequin detection running
  COUNTING_DOWN     → Mannequin stable, 3-second countdown
  PROCESSING        → Frame sent to backend, waiting for PNG
  AR_ACTIVE         → PNG received, buyer overlay live
  ERROR             → Something failed

Valid Transitions:
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

### `useFrameCapture` Hook Specification

```
Inputs:
  sellerVideoRef   — React ref to <video> element playing seller's Agora stream
  isCapturing      — boolean, true when seller has pressed "Present Garment"

Outputs:
  captureStatus    — 'idle' | 'scanning' | 'mannequin_detected' | 'counting_down' | 'capturing' | 'sent'
  countdown        — number 0–3
  qualityWarnings  — string[] (e.g. ['poor_lighting', 'low_sharpness'])

Internal logic:
  1. Every 500ms (setInterval), draw sellerVideoRef to a hidden canvas using ctx.drawImage()
  2. Calculate frame sharpness using calculateSharpness() from utils/frameQuality.js
  3. Calculate luminance using calculateLuminance() from utils/frameQuality.js
  4. Run mannequin detection: Load @mediapipe/pose, run on the hidden canvas,
     check if keypoints 11,12 (shoulders) and 23,24 (hips) all have visibility > 0.5
  5. If mannequin detected AND sharpness > SHARPNESS_THRESHOLD AND luminance in [MIN_LUMINANCE, MAX_LUMINANCE]:
     - Start 3-second countdown
     - On each 500ms tick, re-evaluate all conditions
     - If any condition fails during countdown, reset countdown to 0
  6. After 3 stable seconds: encode canvas to JPEG blob (canvas.toBlob('image/jpeg', 0.85))
     Send to POST /api/ar/segment-live via segmentLiveFrame()
  7. Set captureStatus = 'sent', stop the interval

IMPORTANT:
  - Stop MediaPipe Pose on seller frames once capture is complete (PROCESSING state)
  - Use constants from AR_CONFIG, do not hardcode thresholds
  - All frame analysis runs on a HIDDEN canvas, not visible in the UI
```

### Enforcement Rules UI

**Seller-side panel** (shown when AR mode active):
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

**Buyer-side panel** (shows in buyer's screen):
```
┌─────────────────────────────────────────┐
│  TRY ON AR                              │
│                                         │
│  Status: Salesperson is presenting...   │
│  [Animated progress indicator]          │
│                                         │
│  ─── Once garment is ready ───          │
│                                         │
│  [ ACTIVATE TRY ON ]  (greyed until     │
│    state = AR_ACTIVE)                   │
│                                         │
│  Stand 1.5m from your camera            │
│  Keep your full body visible            │
└─────────────────────────────────────────┘
```

### ConsentModal Specification

- Must show before buyer's camera activates
- Text: "Your camera is used only on your device. No video is sent to our servers."
- Two buttons: "Accept" and "Decline"
- Store decision in `localStorage` key: `webion_ar_consent_v1`
- If consent was previously given (value = "accepted"), skip the modal
- If user declines, show a message: "Camera access is required for AR Try-On" and do not activate the camera

### Session Lifecycle

1. When Agora call starts → generate `sessionId` (UUID)
2. When Agora `user-left` event fires → call `endSession()`:
   - Call `deleteSession(sessionId)` from segmentApi.js
   - Reset all state to IDLE
   - Clear `capturedGarmentUrl`
3. When seller presses "Show New Garment" (only in AR_ACTIVE state):
   - Transition to SELLER_PREPARING
   - Clear `capturedGarmentUrl` (previous garment disappears from buyer)
   - Start new capture cycle

---

## Definition of Done

Your track is done when:
1. Two browser tabs can join the same Agora video call
2. Seller sees "Present Garment" button, pressing it shows enforcement panel
3. Three enforcement indicators (mannequin visibility, lighting, stability) update in real-time
4. When all rules pass for 3 seconds, frame is auto-captured and sent to backend (or mock)
5. Session state transitions are correct and synced between seller and buyer via RTM
6. Buyer sees "Salesperson is presenting..." status, then "Try On" button activates
7. ConsentModal appears before camera activation, respects localStorage
8. "Show New Garment" resets to capture mode
9. Agora call end triggers full cleanup

---

## Styling

Use clean, modern CSS. The UI should feel premium — dark semi-transparent panels, smooth transitions, clear iconography. Create a CSS file `client/src/components/ar/ar.css` for all AR styles. Use CSS variables for colors.
