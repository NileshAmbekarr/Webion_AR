#!/usr/bin/env python3
"""
Webion AR — Flask Segmentation Microservice
Runs REMBG with model loaded once at startup.
Accepts POST /segment with a JPEG file, returns segmented PNG.
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

# Load REMBG model at startup — this takes ~5 seconds on first run
# but keeps the model warm for all subsequent requests
print("[Webion AR] Loading REMBG model (isnet-general-use)...")
rembg_session = new_session("isnet-general-use")
print("[Webion AR] REMBG model loaded successfully.")

AR_TEMP_DIR = os.environ.get('AR_TEMP_DIR', os.path.join(tempfile.gettempdir(), 'ar_sessions'))


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "webion-ar-segmentation"})


@app.route('/segment', methods=['POST'])
def segment():
    """
    Accept a JPEG image, segment it with REMBG, save PNG to session dir.

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

        # Run REMBG segmentation (model already loaded)
        output_data = remove(input_data, session=rembg_session)

        # Create session directory
        session_dir = os.path.join(AR_TEMP_DIR, session_id)
        os.makedirs(session_dir, exist_ok=True)

        # Save output PNG
        file_uuid = str(uuid.uuid4())
        output_filename = f"{file_uuid}.png"
        output_path = os.path.join(session_dir, output_filename)

        with open(output_path, 'wb') as f:
            f.write(output_data)

        processing_time_ms = int((time.time() - start_time) * 1000)

        return jsonify({
            "success": True,
            "filename": output_filename,
            "session_id": session_id,
            "processing_time_ms": processing_time_ms
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Segmentation failed",
            "message": str(e)
        }), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"[Webion AR] Segmentation service starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
