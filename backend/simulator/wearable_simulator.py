import uuid
import logging
from datetime import datetime, timezone
from backend.config import Config
from backend.eeg.dataset_loader import CHBMITDatasetLoader
from backend.ml.predict import predictor
from backend.alerts.alert_service import alert_service
from backend.firebase.firebase_client import db_client

logger = logging.getLogger(__name__)

class WearableSimulator:
    """
    Simulates a wearable EEG patch / smartwatch streaming live EEG batches
    to the Edge AI inference pipeline.
    """

    def __init__(self):
        self.loader = CHBMITDatasetLoader(
            dataset_path=Config.EEG_DATASET_PATH,
            sampling_rate=Config.SAMPLING_RATE
        )
        # Active in-memory session tracking
        self.active_sessions: dict[str, dict] = {}

    def get_available_recordings(self) -> list[dict]:
        """Returns list of selectable recordings."""
        return self.loader.list_available_recordings()

    def start_session(
        self,
        patient_id: str,
        recording_id: str = "demo_chb01_normal",
        channel: str = "FP1-F7"
    ) -> dict:
        """
        Initializes and starts a continuous streaming monitoring session for a patient.
        """
        # Validate patient
        patient = db_client.get_document("patients", patient_id)
        if not patient:
            raise ValueError(f"Patient with ID {patient_id} does not exist.")

        session_id = f"sess_{uuid.uuid4().hex[:8]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        session_data = {
            "sessionId": session_id,
            "patientId": patient_id,
            "patientName": patient.get("name", patient_id),
            "recordingId": recording_id,
            "channel": channel,
            "status": "running",
            "currentBatch": 0,
            "currentTimeSec": 0.0,
            "startedAt": now_iso,
            "lastProcessedAt": now_iso,
            "totalAlertsCount": 0
        }

        self.active_sessions[session_id] = session_data

        # Update patient status
        db_client.set_document("patients", patient_id, {"monitoringStatus": "active"}, merge=True)
        # Store session
        db_client.set_document("monitoring_sessions", session_id, session_data)

        logger.info(f"Monitoring session {session_id} started for patient {patient_id}.")
        return session_data

    def pause_session(self, session_id: str) -> dict:
        """Pauses stream processing."""
        session = self.active_sessions.get(session_id)
        if not session:
            # Check db
            session = db_client.get_document("monitoring_sessions", session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found.")

        session["status"] = "paused"
        self.active_sessions[session_id] = session
        db_client.set_document("monitoring_sessions", session_id, {"status": "paused"}, merge=True)
        return session

    def resume_session(self, session_id: str) -> dict:
        """Resumes stream processing."""
        session = self.active_sessions.get(session_id)
        if not session:
            session = db_client.get_document("monitoring_sessions", session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found.")

        session["status"] = "running"
        self.active_sessions[session_id] = session
        db_client.set_document("monitoring_sessions", session_id, {"status": "running"}, merge=True)
        return session

    def stop_session(self, session_id: str) -> dict:
        """Stops stream processing and updates records."""
        session = self.active_sessions.get(session_id)
        if not session:
            session = db_client.get_document("monitoring_sessions", session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found.")

        now_iso = datetime.now(timezone.utc).isoformat()
        session["status"] = "stopped"
        session["endedAt"] = now_iso
        self.active_sessions.pop(session_id, None)

        db_client.set_document("monitoring_sessions", session_id, {
            "status": "stopped",
            "endedAt": now_iso
        }, merge=True)

        patient_id = session.get("patientId")
        if patient_id:
            db_client.set_document("patients", patient_id, {"monitoringStatus": "inactive"}, merge=True)

        logger.info(f"Monitoring session {session_id} stopped.")
        return session

    def get_session_status(self, session_id: str) -> dict:
        """Gets current state of session."""
        session = self.active_sessions.get(session_id)
        if not session:
            session = db_client.get_document("monitoring_sessions", session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found.")
        return session

    def process_next_batch(self, session_id: str) -> dict:
        """
        Core streaming engine:
        1. Loads next batch from recording
        2. Executes real-time preprocessing & feature extraction
        3. Runs Random Forest risk model
        4. Triggers alert service if high risk
        5. Saves prediction history
        6. Returns visualization data to dashboard
        """
        session = self.active_sessions.get(session_id)
        if not session:
            session = db_client.get_document("monitoring_sessions", session_id)
            if not session:
                raise ValueError(f"Monitoring session {session_id} not found.")
            self.active_sessions[session_id] = session

        if session.get("status") != "running":
            return {
                "sessionStatus": session.get("status"),
                "message": f"Session is currently {session.get('status')}."
            }

        patient_id = session["patientId"]
        recording_id = session["recordingId"]
        channel = session.get("channel", "FP1-F7")
        current_time = session.get("currentTimeSec", 0.0)
        batch_index = session.get("currentBatch", 0) + 1

        # 1. Fetch signal batch
        batch_data = self.loader.load_recording_batch(
            recording_id=recording_id,
            start_time_sec=current_time,
            duration_sec=Config.WINDOW_DURATION_SEC,
            channel=channel
        )

        samples = batch_data["samples"]
        display_points = batch_data["display_points"]

        # 2. ML Prediction & Risk Assessment
        prediction_result = predictor.predict_window(samples)
        prediction_id = f"pred_{uuid.uuid4().hex[:8]}"
        prediction_result["predictionId"] = prediction_id
        prediction_result["patientId"] = patient_id
        prediction_result["sessionId"] = session_id
        prediction_result["batchNumber"] = batch_index

        # 3. Store prediction in database
        db_client.set_document("predictions", prediction_id, prediction_result)

        # 4. Evaluate high-risk alerts & SMS
        alert_result = alert_service.evaluate_and_create_alert(
            patient_id=patient_id,
            prediction_result=prediction_result,
            session_id=session_id
        )

        # Update session tracking
        new_time = round(current_time + Config.WINDOW_DURATION_SEC, 2)
        session["currentBatch"] = batch_index
        session["currentTimeSec"] = new_time
        session["lastProcessedAt"] = datetime.now(timezone.utc).isoformat()
        if alert_result.get("alertCreated"):
            session["totalAlertsCount"] = session.get("totalAlertsCount", 0) + 1

        db_client.set_document("monitoring_sessions", session_id, {
            "currentBatch": batch_index,
            "currentTimeSec": new_time,
            "lastProcessedAt": session["lastProcessedAt"],
            "totalAlertsCount": session["totalAlertsCount"]
        }, merge=True)

        return {
            "sessionId": session_id,
            "patientId": patient_id,
            "channel": channel,
            "batchNumber": batch_index,
            "recordingTime": new_time,
            "sessionStatus": "running",
            "waveformPoints": display_points,
            "prediction": {
                "predictionId": prediction_id,
                "label": prediction_result["predictionLabel"],
                "probability": prediction_result["modelProbability"],
                "riskCategory": prediction_result["riskCategory"],
                "timestamp": prediction_result["timestamp"]
            },
            "features": prediction_result["features"],
            "signalQuality": prediction_result["signalQuality"],
            "alert": alert_result
        }

# Global simulator instance
simulator = WearableSimulator()
