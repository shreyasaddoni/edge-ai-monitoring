import os
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timezone

from backend.config import Config
from backend.firebase.firebase_client import db_client
from backend.ml.predict import predictor
from backend.alerts.twilio_service import twilio_service

# Route Blueprints
from backend.routes.auth_routes import auth_bp
from backend.routes.patient_routes import patient_bp
from backend.routes.monitoring_routes import monitoring_bp
from backend.routes.ml_routes import ml_bp
from backend.routes.alert_routes import alert_bp
from backend.routes.dashboard_routes import dashboard_bp
from backend.routes.report_routes import report_bp
from backend.routes.settings_routes import settings_bp
from backend.routes.upload_routes import upload_bp, playback_bp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable CORS for React Vite frontend
    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"]
    )

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(patient_bp)
    app.register_blueprint(monitoring_bp)
    app.register_blueprint(ml_bp)
    app.register_blueprint(alert_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(report_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(playback_bp)

    @app.route("/api/health", methods=["GET"])
    def health_check():
        """System health and status inspection endpoint."""
        return jsonify({
            "status": "healthy",
            "service": "EDGE AI BASED EPILEPSY PATIENT MONITORING SYSTEM",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database": {
                "type": "Cloud Firestore" if db_client.is_firebase_initialized else "Local SQLite (Zero-Cost Mode)",
                "active": True
            },
            "mlModel": predictor.get_status(),
            "twilioSms": twilio_service.get_status()
        })

    @app.errorhandler(404)
    def handle_not_found(e):
        return jsonify({"error": "Resource not found", "path": request.path}), 404

    @app.errorhandler(500)
    def handle_server_error(e):
        logger.error(f"Internal server error: {e}")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500

    # Seed demonstration patients and clinical EEG recordings if empty
    try:
        seed_demo_patients()
        from backend.routes.upload_routes import ensure_preset_recordings
        ensure_preset_recordings()
    except Exception as e:
        logger.warning(f"Demo data initialization notice: {e}")

    return app

def seed_demo_patients():
    """Seeds demonstration patients once and never restores them after clinical discharge."""
    setup_doc = db_client.get_document("settings", "initial_setup")
    if setup_doc and setup_doc.get("seed_completed"):
        return

    # Check if any patients or discharged archives already exist
    existing_patients = db_client.query_collection("patients", limit=1)
    existing_discharged = db_client.query_collection("discharged_patients", limit=1)
    if existing_patients or existing_discharged:
        db_client.set_document("settings", "initial_setup", {"seed_completed": True})
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    demo_patients = [
        {
            "patientId": "PAT-CHB01",
            "name": "Aarav Sharma",
            "age": 14,
            "gender": "Male",
            "assignedDoctorId": "doc_demo_01",
            "assignedDoctorName": "Dr. Sarah Jenkins, MD",
            "monitoringStatus": "inactive",
            "clinicalNotes": "Pediatric refractory epilepsy monitoring under CHB-MIT standard protocol.",
            "caretakerName": "Ramesh Sharma",
            "caretakerPhone": "+919876543210",
            "caretakerRelationship": "Father",
            "caretakerSmsConsent": True,
            "caretakerConsentTimestamp": now_iso,
            "caretakerContactUpdatedAt": now_iso,
            "createdAt": now_iso,
            "updatedAt": now_iso
        },
        {
            "patientId": "PAT-CHB02",
            "name": "Pooja Hegde",
            "age": 19,
            "gender": "Female",
            "assignedDoctorId": "doc_demo_01",
            "assignedDoctorName": "Dr. Sarah Jenkins, MD",
            "monitoringStatus": "inactive",
            "clinicalNotes": "Temporal lobe epilepsy with complex partial seizures.",
            "caretakerName": "Sunita Hegde",
            "caretakerPhone": "+919845012345",
            "caretakerRelationship": "Mother",
            "caretakerSmsConsent": True,
            "caretakerConsentTimestamp": now_iso,
            "caretakerContactUpdatedAt": now_iso,
            "createdAt": now_iso,
            "updatedAt": now_iso
        },
        {
            "patientId": "PAT-CHB03",
            "name": "Karthik Verma",
            "age": 28,
            "gender": "Male",
            "assignedDoctorId": "doc_demo_01",
            "assignedDoctorName": "Dr. Sarah Jenkins, MD",
            "monitoringStatus": "inactive",
            "clinicalNotes": "Focal onset seizures with secondary generalization.",
            "caretakerName": "Priya Verma",
            "caretakerPhone": "+919731234567",
            "caretakerRelationship": "Spouse",
            "caretakerSmsConsent": True,
            "caretakerConsentTimestamp": now_iso,
            "caretakerContactUpdatedAt": now_iso,
            "createdAt": now_iso,
            "updatedAt": now_iso
        }
    ]

    for p in demo_patients:
        db_client.set_document("patients", p["patientId"], p)
    db_client.set_document("settings", "initial_setup", {"seed_completed": True, "seededAt": now_iso})
    logger.info(f"Seeded {len(demo_patients)} initial demonstration patient records.")

app = create_app()

if __name__ == "__main__":
    app.run(
        host=Config.FLASK_HOST,
        port=Config.FLASK_PORT,
        debug=(Config.FLASK_ENV == "development")
    )
