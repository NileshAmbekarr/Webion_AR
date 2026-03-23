# Track D Agent Guide — Backend Segmentation Service

**Your role:** You own everything server-side — the Node.js Express routes, the Flask Python segmentation microservice, ephemeral file management, and session cleanup.

**Branch:** `feature/track-d`

---

## Your Files

### Node.js Backend (implement/complete)
- `server/controllers/ar.controller.js` — implement the 3 controller stubs (currently return 501)
- `server/scripts/cleanup.js` — already implemented, review and integrate into app.js startup

### Python Microservice (review and enhance)
- `server/scripts/segment_service.py` — already implemented, test and optimize
- `server/scripts/requirements.txt` — add dependencies if needed

### You also modify
- `server/app.js` — integrate cleanup job startup, add any middleware needed
- `server/routes/ar.routes.js` — already implemented, modify if needed

---

## Files You Must NOT Touch

- `client/*` — Agents 1 and 2 own the frontend
- `docs/*` — Guide documents are finalized
- `server/migrations/*` — Migration is already written (run it manually if testing with MySQL)

---

## Shared Files You Consume

- `server/.env` — all environment variables
- `server/routes/ar.routes.js` — already set up with multer, you just need to implement the controllers

---

## Architecture Overview

```
Browser (Track A)                    Node.js (you)                Python Flask (you)
     │                                  │                              │
     │ POST /api/ar/segment-live       │                              │
     │ (multipart: frame JPEG +        │                              │
     │  session_id string)             │                              │
     ├─────────────────────────────────►│                              │
     │                                  │ POST http://localhost:5001   │
     │                                  │ /segment                     │
     │                                  │ (multipart: frame +          │
     │                                  │  session_id)                 │
     │                                  ├─────────────────────────────►│
     │                                  │                              │ REMBG segmentation
     │                                  │                              │ Save PNG to
     │                                  │                              │ /tmp/ar_sessions/{session_id}/{uuid}.png
     │                                  │◄─────────────────────────────┤
     │                                  │ { success, filename,         │
     │                                  │   session_id,                │
     │                                  │   processing_time_ms }       │
     │◄─────────────────────────────────┤                              │
     │ { success: true,                 │                              │
     │   png_url: "/ar-temp/            │                              │
     │     {session_id}/{uuid}.png",    │                              │
     │   session_id, processing_time_ms}│                              │
```

---

## Technical Specifications

### `ar.controller.js` — `segmentLive` Implementation

```javascript
// POST /api/ar/segment-live
// The route (ar.routes.js) already handles multer upload and validation.
// By the time this controller runs:
//   req.file = { path, filename, mimetype, size }
//   req.body.session_id = string

exports.segmentLive = async (req, res) => {
  const startTime = Date.now();

  // 1. Validate that req.file exists and req.body.session_id exists
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No frame uploaded' });
  }
  const sessionId = req.body.session_id;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'No session_id provided' });
  }

  try {
    // 2. Forward the uploaded file to the Python Flask service
    const FormData = require('form-data');
    const fs = require('fs');
    const formData = new FormData();
    formData.append('frame', fs.createReadStream(req.file.path));
    formData.append('session_id', sessionId);

    const pythonRes = await axios.post(
      `${PYTHON_SERVICE_URL}/segment`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 15000,  // 15 second timeout
      }
    );

    // 3. Delete the uploaded JPEG (no longer needed)
    fs.unlinkSync(req.file.path);

    // 4. Return the PNG URL to the browser
    if (pythonRes.data.success) {
      const pngUrl = `/ar-temp/${sessionId}/${pythonRes.data.filename}`;
      return res.json({
        success: true,
        png_url: pngUrl,
        session_id: sessionId,
        processing_time_ms: Date.now() - startTime,
      });
    } else {
      throw new Error(pythonRes.data.message || 'Segmentation failed');
    }
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Handle timeout
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        error: 'Segmentation timeout',
        message: 'Processing took too long. Please try again.',
        retry: true,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Segmentation failed',
      message: error.message || 'Could not isolate garment from background. Ask seller to improve positioning.',
      retry: true,
    });
  }
};
```

### `ar.controller.js` — `deleteSession` Implementation

```javascript
// DELETE /api/ar/sessions/:sessionId
exports.deleteSession = async (req, res) => {
  const { sessionId } = req.params;
  const sessionDir = path.join(AR_TEMP_DIR, sessionId);

  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    return res.json({ deleted: true, session_id: sessionId });
  } catch (error) {
    return res.status(500).json({
      deleted: false,
      error: error.message,
    });
  }
};
```

### `ar.controller.js` — `getSessionStatus` Implementation

```javascript
// GET /api/ar/sessions/:sessionId/status
exports.getSessionStatus = async (req, res) => {
  const { sessionId } = req.params;
  const sessionDir = path.join(AR_TEMP_DIR, sessionId);

  if (!fs.existsSync(sessionDir)) {
    return res.json({ status: 'not_found' });
  }

  // Check if any PNG exists in the session directory
  const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.png'));

  if (files.length > 0) {
    const latestPng = files[files.length - 1];
    return res.json({
      status: 'ready',
      png_url: `/ar-temp/${sessionId}/${latestPng}`,
    });
  }

  return res.json({ status: 'processing' });
};
```

### Python Flask Service

The file `server/scripts/segment_service.py` is already implemented. Your job is to:

1. **Test it**: Run it, send test images, verify PNG output
2. **Optimize**: Try different REMBG models if needed
3. **Handle edge cases**: Very dark images, images with no clear foreground

To test locally:
```bash
cd server/scripts
pip install -r requirements.txt
python segment_service.py    # Starts on port 5001
```

Then test with curl:
```bash
curl -X POST http://localhost:5001/segment \
  -F "frame=@test_garment.jpg" \
  -F "session_id=test-session-001"
```

Expected response:
```json
{
  "success": true,
  "filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
  "session_id": "test-session-001",
  "processing_time_ms": 2341
}
```

### Integrate Cleanup Job

In `server/app.js`, add at the bottom (BEFORE `app.listen`):
```javascript
const { startCleanupJob } = require('./scripts/cleanup');
startCleanupJob();
```

### Install form-data in server

The controller uses `form-data` to forward files to the Python service:
```bash
cd server
npm install form-data
```

---

## Testing Checklist

Test each endpoint with Postman or curl:

| Test | Command | Expected |
|---|---|---|
| Health check (Node) | `GET http://localhost:3001/health` | `{ status: "ok" }` |
| Health check (Python) | `GET http://localhost:5001/health` | `{ status: "ok" }` |
| Segment (valid JPEG) | `POST /api/ar/segment-live` with JPEG + session_id | 200, `{ success: true, png_url: "..." }` |
| Segment (no file) | `POST /api/ar/segment-live` without frame | 400 |
| Segment (wrong mime) | `POST /api/ar/segment-live` with text file | 415 |
| Segment (large file) | `POST /api/ar/segment-live` with 5MB image | 413 |
| PNG serving | `GET /ar-temp/{session_id}/{uuid}.png` | PNG image loads |
| PNG forbidden | `GET /ar-temp/../../etc/passwd` | 403 |
| Delete session | `DELETE /api/ar/sessions/{sessionId}` | 200, PNG returns 404 after |
| Session status (ready) | `GET /api/ar/sessions/{sessionId}/status` | `{ status: "ready", png_url: "..." }` |
| Session status (none) | `GET /api/ar/sessions/nonexistent/status` | `{ status: "not_found" }` |

---

## Definition of Done

Your track is done when:
1. Python Flask service starts, loads REMBG model, and responds to `/health`
2. Sending a garment JPEG to `POST /api/ar/segment-live` returns a PNG URL within 10 seconds
3. The PNG at the returned URL loads correctly in a browser
4. Wrong MIME type → 415, oversized file → 413, missing fields → 400
5. `DELETE /api/ar/sessions/:id` deletes the PNG files, subsequent GET returns 404
6. Cleanup job runs every 15 minutes and removes sessions older than 1 hour
7. The `/ar-temp/` static serving only allows UUID-patterned paths (403 for others)
8. Both Node.js and Python services can run simultaneously on different ports

---

## Important Notes

- **Python service must be running** for the Node.js backend to work. Start it first.
- **REMBG model download**: First run of the Python service downloads ~170MB model. Be patient.
- **Windows paths**: If developing on Windows, `/tmp/ar_sessions` won't work. The code already uses `os.tmpdir()` as fallback — verify this works on your OS.
- **CORS**: Already configured in `app.js` for `http://localhost:5173` (Vite dev server).
