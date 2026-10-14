import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from root or backend .env if present
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR.parent / ".env", override=True)
load_dotenv(BASE_DIR / ".env", override=True)


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "edge-ai-epilepsy-monitoring-secret-key-2026")
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0" if (os.getenv("PORT") or os.getenv("RENDER")) else "127.0.0.1")
    FLASK_PORT = int(os.getenv("PORT", os.getenv("FLASK_PORT", 5000)))
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Firebase Configuration
    FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
    GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    # If credentials are not provided or Firebase Admin fails, enable fallback local store
    USE_LOCAL_FALLBACK_DB = os.getenv("USE_LOCAL_FALLBACK_DB", "true").lower() == "true"
    LOCAL_DB_PATH = os.getenv("LOCAL_DB_PATH", str(BASE_DIR / "local_database.sqlite"))

    # Twilio Configuration
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")
    TWILIO_STATUS_CALLBACK_URL = os.getenv("TWILIO_STATUS_CALLBACK_URL", "")
    TWILIO_VERIFIED_PHONE_NUMBER = os.getenv("TWILIO_VERIFIED_PHONE_NUMBER", "")
    TWILIO_FORCE_VERIFIED_ONLY = os.getenv("TWILIO_FORCE_VERIFIED_ONLY", "false").lower() == "true"
    TWILIO_ENABLED = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER)

    # EEG & Signal Processing Defaults (aligned with CHB-MIT Scalp EEG)
    SAMPLING_RATE = int(os.getenv("SAMPLING_RATE", 256))  # 256 Hz
    WINDOW_DURATION_SEC = float(os.getenv("WINDOW_DURATION_SEC", 2.0))  # 2.0 seconds window
    WINDOW_SIZE_SAMPLES = int(SAMPLING_RATE * WINDOW_DURATION_SEC)  # 512 samples
    WINDOW_OVERLAP_RATIO = float(os.getenv("WINDOW_OVERLAP_RATIO", 0.5))  # 50% overlap

    FILTER_LOWCUT = float(os.getenv("FILTER_LOWCUT", 0.5))
    FILTER_HIGHCUT = float(os.getenv("FILTER_HIGHCUT", 45.0))
    NOTCH_FREQ = float(os.getenv("NOTCH_FREQ", 50.0))  # 50 Hz powerline (or 60 Hz)

    # Machine Learning Settings
    MODEL_DIR = BASE_DIR / "ml" / "saved_models"
    DEFAULT_MODEL_FILE = MODEL_DIR / "random_forest_seizure_detector.joblib"
    FEATURE_CONFIG_FILE = MODEL_DIR / "feature_columns.json"
    MODEL_METADATA_FILE = MODEL_DIR / "model_metadata.json"

    # Risk Classification Thresholds (Configurable demonstration thresholds)
    # Low Risk: < 40%, Medium Risk: 40% - 70%, High Risk: >= 70%
    RISK_LOW_MAX = float(os.getenv("RISK_LOW_MAX", 0.40))
    RISK_HIGH_MIN = float(os.getenv("RISK_HIGH_MIN", 0.70))

    # Alert Cooldown & Deduplication
    ALERT_COOLDOWN_SECONDS = int(os.getenv("ALERT_COOLDOWN_SECONDS", 90))
    MAX_NOTIFICATION_RETRIES = int(os.getenv("MAX_NOTIFICATION_RETRIES", 3))

    # Dataset Directory
    EEG_DATASET_PATH = os.getenv("EEG_DATASET_PATH", str(BASE_DIR / "data" / "chbmit"))

    # SMS Template
    DEFAULT_SMS_TEMPLATE = os.getenv(
        "DEFAULT_SMS_TEMPLATE",
        "Monitoring Alert: A high-risk EEG analysis event has been detected for {patient_name} (ID: {patient_id}) at {timestamp}. Please contact the patient and follow the agreed care plan. This is an automated monitoring alert, not a medical diagnosis."
    )
