import pytest
import numpy as np
from datetime import datetime, timezone

from backend.config import Config
from backend.eeg.preprocessing import EEGPreprocessor
from backend.eeg.feature_extraction import EEGFeatureExtractor, FEATURE_NAMES
from backend.eeg.dataset_loader import CHBMITDatasetLoader
from backend.ml.predict import predictor
from backend.alerts.twilio_service import twilio_service
from backend.alerts.alert_service import alert_service
from backend.simulator.wearable_simulator import simulator
from backend.app import create_app
from backend.firebase.firebase_client import db_client

@pytest.fixture
def test_client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_preprocessing_filters_and_cleaning():
    preprocessor = EEGPreprocessor(sampling_rate=256)

    # Test invalid signal handling
    with pytest.raises(ValueError):
        preprocessor.validate_signal([])

    # Test NaN replacement
    noisy = np.array([10.0, np.nan, 20.0, np.inf, 30.0] * 50)
    cleaned = preprocessor.validate_signal(noisy)
    assert np.all(np.isfinite(cleaned))

    # Test digital filtering
    t = np.linspace(0, 2.0, 512)
    sig = 30.0 * np.sin(2 * np.pi * 10.0 * t) + 15.0 * np.sin(2 * np.pi * 50.0 * t) # 10Hz alpha + 50Hz noise
    filtered = preprocessor.apply_filters(sig)
    assert len(filtered) == 512
    assert np.all(np.isfinite(filtered))

    # Test window segmentation
    long_sig = np.random.randn(1024)
    windows = preprocessor.segment_windows(long_sig, window_size=512, overlap_size=256)
    assert len(windows) >= 2
    assert len(windows[0]) == 512

def test_feature_extraction_consistency():
    extractor = EEGFeatureExtractor(sampling_rate=256)
    sig = np.random.randn(512)

    feats = extractor.extract_features_dict(sig)
    assert set(feats.keys()) == set(FEATURE_NAMES)

    vec = extractor.extract_features_vector(sig)
    assert len(vec) == len(FEATURE_NAMES)
    assert np.all(np.isfinite(vec))

def test_phone_number_validation_e164():
    # Valid Indian format
    valid, formatted, err = twilio_service.validate_phone_number("+919876543210")
    assert valid is True
    assert formatted == "+919876543210"

    # Valid US format
    valid, formatted, err = twilio_service.validate_phone_number("+14155552671")
    assert valid is True
    assert formatted == "+14155552671"

    # Invalid phone numbers
    valid, _, err = twilio_service.validate_phone_number("12345")
    assert valid is False
    assert "Invalid phone number" in err

    valid, _, err = twilio_service.validate_phone_number("")
    assert valid is False

def test_risk_classification():
    assert predictor.classify_risk(0.20) == "Low"
    assert predictor.classify_risk(0.40) == "Medium"
    assert predictor.classify_risk(0.65) == "Medium"
    assert predictor.classify_risk(0.70) == "High"
    assert predictor.classify_risk(0.95) == "High"

def test_model_inference():
    assert predictor.is_ready is True
    loader = CHBMITDatasetLoader(sampling_rate=256)

    # Normal signal
    _, normal_sig, _ = loader.generate_synthetic_eeg(duration_sec=2.0, pattern="normal")
    pred_normal = predictor.predict_window(normal_sig)
    assert "modelProbability" in pred_normal
    assert pred_normal["riskCategory"] in ["Low", "Medium", "High"]

    # Seizure signal
    _, seizure_sig, _ = loader.generate_synthetic_eeg(duration_sec=2.0, pattern="seizure")
    pred_seizure = predictor.predict_window(seizure_sig)
    assert pred_seizure["riskCategory"] == "High"
    assert pred_seizure["isAlertEligible"] is True

def test_alert_cooldown():
    import uuid
    patient_id = f"PAT-TEST-COOLDOWN-{uuid.uuid4().hex[:6]}"

    # 1. Trigger high risk prediction
    high_pred = {
        "predictionId": "pred_test_1",
        "riskCategory": "High",
        "modelProbability": 0.88,
        "predictionLabel": "Seizure Pattern Detected"
    }
    res1 = alert_service.evaluate_and_create_alert(patient_id, high_pred)
    assert res1["alertCreated"] is True

    # 2. Trigger immediate second high risk prediction (should be suppressed by cooldown)
    res2 = alert_service.evaluate_and_create_alert(patient_id, high_pred)
    assert res2["alertCreated"] is False
    assert res2.get("cooldownActive") is True

def test_simulator_batch_processing():
    patient_id = "PAT-TEST-SIM-01"
    db_client.set_document("patients", patient_id, {
        "patientId": patient_id,
        "name": "Sim Test Patient",
        "caretakerName": "Test Caretaker",
        "caretakerPhone": "+919876543210",
        "caretakerSmsConsent": True
    })
    session = simulator.start_session(patient_id, recording_id="demo_chb01_normal")
    sess_id = session["sessionId"]

    batch_res = simulator.process_next_batch(sess_id)
    assert batch_res["batchNumber"] == 1
    assert len(batch_res["waveformPoints"]) > 0
    assert "prediction" in batch_res

    simulator.stop_session(sess_id)

def test_api_endpoints(test_client):
    headers = {"Authorization": "Bearer demo_doctor_token"}
    # Health endpoint
    h_res = test_client.get("/api/health")
    assert h_res.status_code == 200

    # Create isolated test patient for listing
    db_client.set_document("patients", "PAT-API-TEST", {
        "patientId": "PAT-API-TEST",
        "name": "API Test Patient",
        "caretakerName": "API Caretaker",
        "caretakerPhone": "+919876543210",
        "caretakerSmsConsent": True
    })

    # Patients list with auth header
    p_res = test_client.get("/api/patients", headers=headers)
    assert p_res.status_code == 200
    patients = p_res.get_json()["patients"]
    assert len(patients) >= 1

    # Patient registration validation (missing caretaker)
    bad_reg = test_client.post("/api/patients", json={
        "name": "Test Missing Caretaker"
    }, headers=headers)
    assert bad_reg.status_code == 400

    # Successful patient registration
    good_reg = test_client.post("/api/patients", json={
        "name": "Dev Test Patient",
        "age": 22,
        "caretakerName": "Sunita Test",
        "caretakerPhone": "+919876500000",
        "caretakerRelationship": "Mother",
        "caretakerSmsConsent": True
    }, headers=headers)
    assert good_reg.status_code == 201
    created_pat_id = good_reg.get_json()["patient"]["patientId"]

    # Dashboard stats
    dash_res = test_client.get("/api/dashboard/stats", headers=headers)
    assert dash_res.status_code == 200
    stats = dash_res.get_json()
    assert "summary" in stats
    assert "riskDistribution" in stats

    # ML Status
    ml_res = test_client.get("/api/ml/status", headers=headers)
    assert ml_res.status_code == 200
    assert ml_res.get_json()["status"]["is_ready"] is True
