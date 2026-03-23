#!/usr/bin/env python3
"""
Webion AR — Flask Segmentation Microservice
Runs REMBG with cloth-specific model loaded once at startup.
Accepts POST /segment with a JPEG file, returns garment-only PNG.
"""

from flask import Flask, request, jsonify, send_file
from rembg import remove, new_session
from PIL import Image
import io
import os
import uuid
import time
import tempfile

app = Flask(__name__)

# Use u2net_cloth_seg for garment-focused segmentation
# Falls back to isnet-general-use if cloth model fails
MODEL_NAME = os.environ.get('REMBG_MODEL', 'u2net_cloth_seg')
print(f"[Webion AR] Loading REMBG model ({MODEL_NAME})...")
try:
    rembg_session = new_session(MODEL_NAME)
    print(f"[Webion AR] REMBG model ({MODEL_NAME}) loaded successfully.")
except Exception as e:
    print(f"[Webion AR] ⚠️ Failed to load {MODEL_NAME}: {e}")
    print("[Webion AR] Falling back to isnet-general-use...")
    MODEL_NAME = "isnet-general-use"
    rembg_session = new_session(MODEL_NAME)
    print("[Webion AR] Fallback model loaded.")

AR_TEMP_DIR = os.environ.get('AR_TEMP_DIR', os.path.join(tempfile.gettempdir(), 'ar_sessions'))

# Crop ratios — remove head and legs from the segmented image
CROP_TOP_RATIO = 0.01    # Remove top 18% (head/neck)
CROP_BOTTOM_RATIO = 0.30  # Remove bottom 25% (legs/feet)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "webion-ar-segmentation", "model": MODEL_NAME})


@app.route('/segment', methods=['POST'])
def segment():
    """
    Accept a JPEG image, segment it with REMBG, crop to torso, save PNG.

    Expected form data:
      - frame: JPEG file
      - session_id: string (used as subdirectory name)

    Returns:
      - { success: true, filename: "uuid.png", processing_time_ms: N }
    """
    start_time = time.time()

    # Validate input
    if 'frame' not in request.files:
        return jsonify({"success": False, "error": "No 'frame' file provided"}), 400

    session_id = request.form.get('session_id')
    if not session_id:
        return jsonify({"success": False, "error": "No 'session_id' provided"}), 400

    frame_file = request.files['frame']

    try:
        # Read the input image
        input_data = frame_file.read()
        print(f"[Webion AR] Processing frame ({len(input_data) / 1024:.1f}KB) for session {session_id[:8]}...")

        # Run REMBG segmentation (model already loaded)
        output_data = remove(input_data, session=rembg_session)

        # Post-process: crop to torso region (remove head & legs)
        img = Image.open(io.BytesIO(output_data))
        w, h = img.size

        crop_top = int(h * CROP_TOP_RATIO)
        crop_bottom = int(h * (1 - CROP_BOTTOM_RATIO))
        img_cropped = img.crop((0, crop_top, w, crop_bottom))

        # Auto-trim transparent edges
        bbox = img_cropped.getbbox()
        if bbox:
            img_cropped = img_cropped.crop(bbox)

        print(f"[Webion AR] Segmented: {w}x{h} → cropped to {img_cropped.size[0]}x{img_cropped.size[1]}")

        # Create session directory
        session_dir = os.path.join(AR_TEMP_DIR, session_id)
        os.makedirs(session_dir, exist_ok=True)

        # Save output PNG
        file_uuid = str(uuid.uuid4())
        output_filename = f"{file_uuid}.png"
        output_path = os.path.join(session_dir, output_filename)

        img_cropped.save(output_path, 'PNG')

        processing_time_ms = int((time.time() - start_time) * 1000)
        print(f"[Webion AR] ✅ Done in {processing_time_ms}ms → {output_filename}")

        return jsonify({
            "success": True,
            "filename": output_filename,
            "session_id": session_id,
            "processing_time_ms": processing_time_ms
        })

    except Exception as e:
        print(f"[Webion AR] ❌ Segmentation error: {e}")
        return jsonify({
            "success": False,
            "error": "Segmentation failed",
            "message": str(e)
        }), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"[Webion AR] Segmentation service starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
