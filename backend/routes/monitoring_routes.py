from flask import Blueprint, request, jsonify
from backend.middleware.auth_middleware import require_auth
from backend.simulator.wearable_simulator import simulator

monitoring_bp = Blueprint("monitoring", __name__, url_prefix="/api/monitoring")

@monitoring_bp.route("/recordings", methods=["GET"])
@require_auth
def get_recordings():
    """Lists available EEG recordings for simulation and testing."""
    records = simulator.get_available_recordings()
    return jsonify({"recordings": records, "count": len(records)})

@monitoring_bp.route("/start", methods=["POST"])
@require_auth
def start_monitoring():
    """Initializes a wearable streaming monitoring session."""
    data = request.get_json() or {}
    patient_id = data.get("patientId")
    recording_id = data.get("recordingId", "demo_chb01_normal")
    channel = data.get("channel", "FP1-F7")

    if not patient_id:
        return jsonify({"error": "patientId is required."}), 400

    try:
        session = simulator.start_session(
            patient_id=patient_id,
            recording_id=recording_id,
            channel=channel
        )
        return jsonify({"success": True, "session": session})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@monitoring_bp.route("/pause", methods=["POST"])
@require_auth
def pause_monitoring():
    """Pauses an active monitoring session."""
    data = request.get_json() or {}
    session_id = data.get("sessionId")
    if not session_id:
        return jsonify({"error": "sessionId is required."}), 400

    try:
        session = simulator.pause_session(session_id)
        return jsonify({"success": True, "session": session})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@monitoring_bp.route("/resume", methods=["POST"])
@require_auth
def resume_monitoring():
    """Resumes a paused monitoring session."""
    data = request.get_json() or {}
    session_id = data.get("sessionId")
    if not session_id:
        return jsonify({"error": "sessionId is required."}), 400

    try:
        session = simulator.resume_session(session_id)
        return jsonify({"success": True, "session": session})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@monitoring_bp.route("/stop", methods=["POST"])
@require_auth
def stop_monitoring():
    """Stops an active monitoring session."""
    data = request.get_json() or {}
    session_id = data.get("sessionId")
    if not session_id:
        return jsonify({"error": "sessionId is required."}), 400

    try:
        session = simulator.stop_session(session_id)
        return jsonify({"success": True, "session": session})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@monitoring_bp.route("/batch", methods=["POST"])
@require_auth
def process_batch():
    """
    Processes the next streaming batch from the wearable simulator:
    Preprocesses -> Feature Extraction -> Random Forest -> Alert/SMS -> Display Points
    """
    data = request.get_json() or {}
    session_id = data.get("sessionId")
    if not session_id:
        return jsonify({"error": "sessionId is required."}), 400

    try:
        result = simulator.process_next_batch(session_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@monitoring_bp.route("/status/<session_id>", methods=["GET"])
@require_auth
def get_session_status(session_id: str):
    """Retrieves current session state."""
    try:
        status = simulator.get_session_status(session_id)
        return jsonify({"session": status})
    except Exception as e:
        return jsonify({"error": str(e)}), 404
