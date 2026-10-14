import os
from pathlib import Path
import pytest
import numpy as np
from backend.app import create_app
from backend.simulator.playback_session import playback_manager, ContinuousPlaybackSession
from backend.eeg.edf_reader import EEGFileReader
from backend.config import Config, BASE_DIR

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client

def test_generate_sample_edf():
    """Test generating a synthetic CHB-MIT compatible EDF file and inspecting it."""
    test_dir = Path(BASE_DIR) / "uploads" / "eeg"
    test_dir.mkdir(parents=True, exist_ok=True)
    out_file = test_dir / "test_benchmark_sample.edf"

    created_path = EEGFileReader.create_sample_edf(out_file, duration_sec=10.0, pattern="seizure")
    assert os.path.exists(created_path)

    # Test inspection of the generated EDF file
    info = EEGFileReader.inspect_and_load(created_path, target_sampling_rate=256)
    assert info["sampling_frequency"] == 256
    assert info["duration_sec"] == 10.0
    assert "channels" in info
    assert len(info["channels"]) == 4
    assert info["total_samples"] == 2560
    assert "channel_data" in info
    assert "FP1-F7" in info["channel_data"]

def test_playback_session_lifecycle():
    """Test sequential packet slicing, rolling window accumulation, pause, resume, restart, and stop."""
    test_dir = Path(BASE_DIR) / "uploads" / "eeg"
    out_file = test_dir / "test_playback_lifecycle.edf"
    EEGFileReader.create_sample_edf(out_file, duration_sec=6.0, pattern="normal")

    session = playback_manager.create_session(
        patient_id="PAT-CHB01",
        recording_id="rec_test_lifecycle",
        file_path=out_file,
        channel="FP1-F7",
        playback_speed=2.0
    )
    assert session is not None
    assert session.total_packets == 6
    assert session.status == "stopped"

    # Start playback
    session.start()
    assert session.status == "running"

    # Packet 1 (1.0 sec = 256 samples, buffer needs 512 for model inference):
    # Should accumulate in buffer without crashing
    pkt1 = session.get_next_packet()
    assert pkt1["packetSequenceNumber"] == 1
    assert pkt1["prediction"] is None
    assert "Accumulating Buffer" in pkt1["windowStatus"]

    # Packet 2 (256 more samples = 512 total in rolling buffer):
    # Should now trigger model inference
    pkt2 = session.get_next_packet()
    assert pkt2["packetSequenceNumber"] == 2
    assert pkt2["prediction"] is not None
    assert "riskCategory" in pkt2["prediction"]
    assert "Analysis Window Evaluated" in pkt2["windowStatus"]

    # Pause
    session.pause()
    assert session.status == "paused"

    # Resume
    session.resume()
    assert session.status == "running"

    # Change speed
    session.set_speed(4.0)
    assert session.playback_speed == 4.0

    # Restart
    session.restart()
    assert session.current_sample_index == 0
    assert session.status == "running"

    # Stop
    session.stop()
    assert session.status == "stopped"

def test_playback_api_routes(client):
    """Test the Flask API routes for sample generation, playback init, start, packet, and stop."""
    headers = {"Authorization": "Bearer demo_doctor_token"}

    # 1. Generate sample recording via API
    gen_res = client.post("/api/upload/generate-sample", json={
        "pattern": "seizure",
        "patientId": "PAT-CHB01"
    }, headers=headers)
    assert gen_res.status_code == 200
    gen_data = gen_res.get_json()
    assert gen_data["success"] is True
    rec_meta = gen_data["recording"]
    recording_id = rec_meta["recordingId"]
    assert recording_id is not None

    # 2. List recordings
    list_res = client.get("/api/upload/recordings", headers=headers)
    assert list_res.status_code == 200
    recordings = list_res.get_json()["recordings"]
    assert any(r["recordingId"] == recording_id for r in recordings)

    # 3. Initialize playback session
    init_res = client.post("/api/playback/init", json={
        "recordingId": recording_id,
        "patientId": "PAT-CHB01",
        "channel": "FP1-F7",
        "playbackSpeed": 1.0
    }, headers=headers)
    assert init_res.status_code == 200
    session_id = init_res.get_json()["sessionId"]
    assert session_id is not None

    # 4. Start session
    start_res = client.post("/api/playback/start", json={"sessionId": session_id}, headers=headers)
    assert start_res.status_code == 200
    assert start_res.get_json()["status"] == "running"

    # 5. Fetch next packet
    pkt_res = client.post("/api/playback/packet", json={"sessionId": session_id}, headers=headers)
    assert pkt_res.status_code == 200
    pkt_data = pkt_res.get_json()
    assert pkt_data["packetSequenceNumber"] == 1
    assert len(pkt_data["waveformPoints"]) > 0

    # 6. Stop session
    stop_res = client.post("/api/playback/stop", json={"sessionId": session_id}, headers=headers)
    assert stop_res.status_code == 200
    assert stop_res.get_json()["status"] == "stopped"
