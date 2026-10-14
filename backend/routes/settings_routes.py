from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from backend.middleware.auth_middleware import require_auth
from backend.firebase.firebase_client import db_client
from backend.alerts.twilio_service import twilio_service
from backend.ml.predict import predictor
from backend.config import Config

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

@settings_bp.route("", methods=["GET"])
@require_auth
def get_settings():
    """Retrieves system and monitoring configuration."""
    current_settings = db_client.get_document("settings", "general") or {}

    return jsonify({
        "settings": current_settings,
        "twilioStatus": twilio_service.get_status(),
        "firebaseStatus": {
            "mode": "Cloud Firestore" if db_client.is_firebase_initialized else "Local SQLite Engine (Zero-Cost Mode)",
            "projectId": Config.FIREBASE_PROJECT_ID or "Local-Offline"
        },
        "modelStatus": predictor.get_status()
    })

@settings_bp.route("", methods=["PUT"])
@require_auth
def update_settings():
    """Updates configurable risk thresholds and alert cooldown."""
    data = request.get_json() or {}
    allowed_updates = {}

    if "riskThresholds" in data:
        thresholds = data["riskThresholds"]
        low = float(thresholds.get("low", Config.RISK_LOW_MAX))
        high = float(thresholds.get("high", Config.RISK_HIGH_MIN))
        if 0.0 < low < high < 1.0:
            allowed_updates["riskThresholds"] = {"low": low, "high": high}
            Config.RISK_LOW_MAX = low
            Config.RISK_HIGH_MIN = high

    if "alertCooldownSeconds" in data:
        cd = int(data["alertCooldownSeconds"])
        if 10 <= cd <= 600:
            allowed_updates["alertCooldownSeconds"] = cd
            Config.ALERT_COOLDOWN_SECONDS = cd

    if "smsTemplate" in data and data["smsTemplate"].strip():
        allowed_updates["smsTemplate"] = data["smsTemplate"].strip()
        Config.DEFAULT_SMS_TEMPLATE = data["smsTemplate"].strip()

    allowed_updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    db_client.set_document("settings", "general", allowed_updates, merge=True)

    updated = db_client.get_document("settings", "general")
    return jsonify({"success": True, "settings": updated})

@settings_bp.route("/reset-database", methods=["POST"])
@require_auth
def reset_database():
    """Wipes all demo patients, alerts, predictions, recordings, and temporary upload files."""
    from pathlib import Path
    from backend.config import BASE_DIR

    db_client.delete_collection("patients")
    db_client.delete_collection("alerts")
    db_client.delete_collection("predictions")
    db_client.delete_collection("eeg_recordings")
    db_client.delete_collection("playback_sessions")
    db_client.delete_collection("monitoring_sessions")

    # Clean out uploaded eeg files
    upload_dir = Path(BASE_DIR) / "uploads" / "eeg"
    if upload_dir.exists():
        for f in upload_dir.iterdir():
            if f.is_file():
                try:
                    f.unlink(missing_ok=True)
                except Exception:
                    pass

    return jsonify({
        "success": True,
        "message": "All demo records, patient entries, alerts, predictions, and files have been permanently cleared."
    })

