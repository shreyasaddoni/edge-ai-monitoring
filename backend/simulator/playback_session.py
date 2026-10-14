import uuid
import math
import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
import numpy as np

from backend.config import Config
from backend.eeg.edf_reader import EEGFileReader
from backend.ml.predict import predictor
from backend.alerts.alert_service import alert_service
from backend.firebase.firebase_client import db_client

logger = logging.getLogger(__name__)

class ContinuousPlaybackSession:
    """
    Manages continuous sequential EEG playback from an uploaded recording.
    Divides recorded samples into sequential packets (e.g. 1-second chunks),
    preserves original sample order and timestamps, maintains a rolling buffer
    for model analysis windows, and triggers Random Forest risk assessment.
    """

    def __init__(
        self,
        session_id: str,
        patient_id: str,
        recording_id: str,
        file_path: Path,
        channel: str = "FP1-F7",
        packet_duration_sec: float = 1.0,
        analysis_window_duration_sec: float = 2.0,
        playback_speed: float = 1.0,
        start_offset_sec: float = 0.0
    ):
        self.session_id = session_id
        self.patient_id = patient_id
        self.recording_id = recording_id
        self.file_path = Path(file_path)
        self.channel = channel
        self.packet_duration_sec = float(packet_duration_sec)
        self.analysis_window_duration_sec = float(analysis_window_duration_sec)
        self.playback_speed = float(playback_speed)
        self.start_offset_sec = float(start_offset_sec)

        # State tracking
        self.status = "stopped"  # stopped, running, paused, completed, file_missing
        self.current_sample_index = 0
        self.current_packet_sequence = 0
        self.started_at = None
        self.last_processed_at = None
        self.is_completed = False

        # Background threading and state synchronization
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._runner_thread = None
        self.latest_packet_data = None

        # Load recording
        self.recording_metadata = {}
        self.channel_data = {}
        self.sampling_frequency = Config.SAMPLING_RATE
        self.total_samples = 0
        self.selected_signal = np.array([], dtype=np.float64)

        # Rolling buffer for analysis window (e.g. 512 samples for 2.0s window at 256 Hz)
        self.rolling_buffer = []
        self.packet_samples = int(self.sampling_frequency * self.packet_duration_sec)
        self.analysis_window_samples = int(self.sampling_frequency * self.analysis_window_duration_sec)

        self._load_file()
        if self.start_offset_sec > 0 and self.total_samples > 0:
            target_index = int(self.start_offset_sec * self.sampling_frequency)
            self.current_sample_index = min(max(0, self.total_samples - self.packet_samples), target_index)
            self.current_packet_sequence = int(self.current_sample_index / self.packet_samples)

    def _load_file(self):
        """Loads EEG file into memory."""
        if not self.file_path.exists():
            logger.error(f"Recording file not found on disk: {self.file_path}")
            self.status = "file_missing"
            return

        try:
            file_info = EEGFileReader.inspect_and_load(
                self.file_path,
                target_sampling_rate=Config.SAMPLING_RATE
            )
            self.recording_metadata = {
                "format": file_info.get("format"),
                "filename": file_info.get("filename"),
                "duration_sec": file_info.get("duration_sec"),
                "channels": file_info.get("channels", []),
                "annotations": file_info.get("annotations", [])
            }
            self.channel_data = file_info.get("channel_data", {})
            self.sampling_frequency = file_info.get("sampling_frequency", Config.SAMPLING_RATE)
            self.packet_samples = max(1, int(self.sampling_frequency * self.packet_duration_sec))
            self.analysis_window_samples = max(1, int(self.sampling_frequency * self.analysis_window_duration_sec))

            # Select channel or fallback to first available
            if self.channel in self.channel_data:
                self.selected_signal = self.channel_data[self.channel]
            elif self.channel_data:
                first_ch = list(self.channel_data.keys())[0]
                self.channel = first_ch
                self.selected_signal = self.channel_data[first_ch]
            else:
                self.selected_signal = np.array([], dtype=np.float64)

            self.total_samples = len(self.selected_signal)
            logger.info(
                f"Loaded recording {self.recording_id} for session {self.session_id}: "
                f"{self.total_samples} samples across channel {self.channel} at {self.sampling_frequency} Hz."
            )
        except Exception as e:
            logger.error(f"Failed to parse EEG file for playback session: {e}")
            self.status = "file_error"

    @property
    def total_packets(self) -> int:
        """Returns total calculated packets in the recording."""
        if self.packet_samples <= 0:
            return 0
        return math.ceil(self.total_samples / self.packet_samples)

    def select_channel(self, channel_name: str):
        """Switches active channel if available."""
        with self._lock:
            if channel_name in self.channel_data:
                self.channel = channel_name
                self.selected_signal = self.channel_data[channel_name]
                self.total_samples = len(self.selected_signal)
                self.rolling_buffer = []
                if self.latest_packet_data:
                    self.latest_packet_data["channel"] = channel_name
                self._sync_to_db()

    def _ensure_thread_running(self):
        """Starts or restarts the background daemon playback thread."""
        if self._runner_thread is None or not self._runner_thread.is_alive():
            self._stop_event.clear()
            self._pause_event.set()
            self._runner_thread = threading.Thread(
                target=self._background_runner,
                name=f"PlaybackRunner-{self.session_id}",
                daemon=True
            )
            self._runner_thread.start()

    def _background_runner(self):
        """
        Background daemon loop that advances continuous playback and runs AI inference
        at the pacing determined by packet_duration_sec and playback_speed.
        Runs persistently on the edge server even when the physician logs out or closes the browser.
        """
        logger.info(f"Background telemetry runner started for session {self.session_id} (Patient: {self.patient_id})")
        while not self._stop_event.is_set():
            if self.status != "running":
                self._pause_event.wait(timeout=0.5)
                continue

            sleep_interval = max(0.05, self.packet_duration_sec / max(0.1, self.playback_speed))
            if self._stop_event.wait(timeout=sleep_interval):
                break

            if self.status != "running":
                continue

            try:
                with self._lock:
                    self._advance_tick()
            except Exception as e:
                logger.error(f"Error in background playback tick for session {self.session_id}: {e}", exc_info=True)
                time.sleep(1.0)
        logger.info(f"Background telemetry runner stopped for session {self.session_id}")

    def _advance_tick(self):
        """
        Advances the EEG simulation by exactly one packet duration:
        - Slices sequential raw EEG samples
        - Appends to rolling feature extraction buffer
        - Runs Random Forest inference & threshold alert evaluation
        - Caches latest packet for connected viewers (Doctor, Caretaker)
        - Continuously loops back when reaching end of file so telemetry stays live until explicitly paused
        """
        if self.total_samples <= 0:
            return

        # Continuous monitoring loop: loop back to beginning if reaching end
        if self.current_sample_index >= self.total_samples:
            self.current_sample_index = 0

        start_idx = self.current_sample_index
        end_idx = min(self.total_samples, start_idx + self.packet_samples)
        packet_samples = self.selected_signal[start_idx:end_idx]

        self.current_packet_sequence += 1
        self.current_sample_index = end_idx
        now_iso = datetime.now(timezone.utc).isoformat()
        self.last_processed_at = now_iso

        # 2. Append newly received samples to rolling buffer
        self.rolling_buffer.extend(packet_samples.tolist())
        max_buffer_len = self.analysis_window_samples * 3
        if len(self.rolling_buffer) > max_buffer_len:
            self.rolling_buffer = self.rolling_buffer[-max_buffer_len:]

        # 3. Check analysis window status
        prediction_result = None
        alert_result = None
        window_status = f"Accumulating Buffer ({len(self.rolling_buffer)}/{self.analysis_window_samples} samples)"

        if len(self.rolling_buffer) >= self.analysis_window_samples:
            window_slice = np.array(self.rolling_buffer[-self.analysis_window_samples:], dtype=np.float64)

            if predictor.is_ready:
                prediction_result = predictor.predict_window(window_slice)
                prediction_id = f"pred_{uuid.uuid4().hex[:8]}"
                prediction_result["predictionId"] = prediction_id
                prediction_result["patientId"] = self.patient_id
                prediction_result["sessionId"] = self.session_id
                prediction_result["packetSequenceNumber"] = self.current_packet_sequence
                prediction_result["timestamp"] = now_iso
                prediction_result["createdAt"] = now_iso

                # Store prediction in Firestore / local DB
                db_client.set_document("predictions", prediction_id, prediction_result)

                # Evaluate alert condition if High Risk
                alert_result = alert_service.evaluate_and_create_alert(
                    patient_id=self.patient_id,
                    prediction_result=prediction_result,
                    session_id=self.session_id
                )
                window_status = "Analysis Window Evaluated"
            else:
                window_status = "Model Not Trained (Ready for Calibration)"

        # 4. Prepare downsampled display waveform (up to 128 points for smooth 60fps graph)
        samples_len = len(packet_samples)
        downsample = max(1, samples_len // 128)
        sim_time_start = start_idx / self.sampling_frequency
        display_points = [
            {
                "time": round(sim_time_start + i / self.sampling_frequency, 3),
                "microvolts": round(float(packet_samples[i]), 2)
            }
            for i in range(0, samples_len, downsample)
        ]

        progress_pct = round((self.current_sample_index / self.total_samples) * 100, 1) if self.total_samples > 0 else 0.0

        packet_data = {
            "sessionId": self.session_id,
            "patientId": self.patient_id,
            "recordingId": self.recording_id,
            "channel": self.channel,
            "packetSequenceNumber": self.current_packet_sequence,
            "currentSampleIndex": self.current_sample_index,
            "totalSamples": self.total_samples,
            "progressPercentage": progress_pct,
            "simulatedRecordingTimestamp": round(self.current_sample_index / self.sampling_frequency, 2),
            "recordingDurationSec": round(self.total_samples / self.sampling_frequency, 2),
            "playbackSpeed": self.playback_speed,
            "playbackStatus": self.status,
            "samplingFrequency": self.sampling_frequency,
            "isCompleted": False,
            "windowStatus": window_status,
            "waveformPoints": display_points,
            "prediction": prediction_result,
            "alert": alert_result
        }
        self.latest_packet_data = packet_data
        self._sync_to_db()

    def start(self):
        """Starts continuous playback session, honoring start_offset_sec if configured."""
        if self.status == "file_missing":
            raise RuntimeError("Recording file is missing from server storage. Please re-upload.")

        now_iso = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self.status = "running"
            if self.start_offset_sec > 0 and self.total_samples > 0:
                target_index = int(self.start_offset_sec * self.sampling_frequency)
                self.current_sample_index = min(max(0, self.total_samples - self.packet_samples), target_index)
                self.current_packet_sequence = int(self.current_sample_index / self.packet_samples)
            else:
                self.current_sample_index = 0
                self.current_packet_sequence = 0
            self.rolling_buffer = []
            self.started_at = now_iso
            self.last_processed_at = now_iso
            self.is_completed = False
            self._stop_event.clear()
            self._pause_event.set()
            self._advance_tick()
        self._ensure_thread_running()

    def pause(self):
        """Pauses packet stream."""
        with self._lock:
            if self.status == "running":
                self.status = "paused"
                self._pause_event.clear()
                self.last_processed_at = datetime.now(timezone.utc).isoformat()
                if self.latest_packet_data:
                    self.latest_packet_data["playbackStatus"] = "paused"
                self._sync_to_db()

    def resume(self):
        """Resumes packet stream from existing sample position."""
        with self._lock:
            if self.status in ["paused", "stopped"]:
                self.status = "running"
                self._stop_event.clear()
                self._pause_event.set()
                self.last_processed_at = datetime.now(timezone.utc).isoformat()
                if self.latest_packet_data:
                    self.latest_packet_data["playbackStatus"] = "running"
                self._sync_to_db()
        self._ensure_thread_running()

    def stop(self):
        """Terminates session."""
        with self._lock:
            self.status = "stopped"
            self._stop_event.set()
            self._pause_event.set()
            self.last_processed_at = datetime.now(timezone.utc).isoformat()
            if self.latest_packet_data:
                self.latest_packet_data["playbackStatus"] = "stopped"
            self._sync_to_db()

    def restart(self):
        """Explicitly resets session back to beginning (sample index 0)."""
        with self._lock:
            self.current_sample_index = 0
            self.current_packet_sequence = 0
            self.rolling_buffer = []
            self.status = "running"
            self.is_completed = False
            self._stop_event.clear()
            self._pause_event.set()
            self.last_processed_at = datetime.now(timezone.utc).isoformat()
            self._advance_tick()
            self._sync_to_db()
        self._ensure_thread_running()

    def set_speed(self, speed: float):
        """Sets playback speed multiplier (e.g. 1.0, 2.0, 4.0, 8.0)."""
        if speed in [1.0, 2.0, 4.0, 8.0]:
            with self._lock:
                self.playback_speed = float(speed)
                if self.latest_packet_data:
                    self.latest_packet_data["playbackSpeed"] = self.playback_speed
                self._sync_to_db()

    def get_next_packet(self) -> dict:
        """
        Retrieves current synchronized real-time packet generated by background daemon runner.
        Multiple clients (Doctor, Caretaker) polling this receive the exact same synchronized
        physiological stream without causing packet skipping or duplication.
        """
        with self._lock:
            if self.latest_packet_data is None:
                if self.status == "running":
                    self._advance_tick()
                else:
                    return {
                        "sessionId": self.session_id,
                        "patientId": self.patient_id,
                        "playbackStatus": self.status,
                        "message": f"Playback is currently {self.status}."
                    }
            resp = dict(self.latest_packet_data)
            resp["playbackStatus"] = self.status
            return resp

    def _sync_to_db(self):
        """Persists session metadata to Firestore/local DB without storing raw EEG samples."""
        session_doc = {
            "sessionId": self.session_id,
            "patientId": self.patient_id,
            "recordingId": self.recording_id,
            "channel": self.channel,
            "status": self.status,
            "currentPacketSequence": self.current_packet_sequence,
            "currentSampleIndex": self.current_sample_index,
            "totalSamples": self.total_samples,
            "playbackSpeed": self.playback_speed,
            "startedAt": self.started_at,
            "lastProcessedAt": self.last_processed_at,
            "isCompleted": self.is_completed,
            "recordingMetadata": self.recording_metadata
        }
        db_client.set_document("monitoring_sessions", self.session_id, session_doc, merge=True)

class PlaybackSessionManager:
    """Singleton session registry managing concurrent playback sessions across patients."""

    def __init__(self):
        self.sessions: dict[str, ContinuousPlaybackSession] = {}

    def create_session(
        self,
        patient_id: str,
        recording_id: str,
        file_path: Path,
        channel: str = "FP1-F7",
        playback_speed: float = 1.0,
        start_offset_sec: float = 0.0
    ) -> ContinuousPlaybackSession:
        # First terminate any previous session specifically for this patient
        self.terminate_session_for_patient(patient_id)

        session_id = f"play_{uuid.uuid4().hex[:8]}"
        session = ContinuousPlaybackSession(
            session_id=session_id,
            patient_id=patient_id,
            recording_id=recording_id,
            file_path=file_path,
            channel=channel,
            playback_speed=playback_speed,
            start_offset_sec=start_offset_sec
        )
        self.sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> ContinuousPlaybackSession | None:
        return self.sessions.get(session_id)

    def get_session_by_patient(self, patient_id: str) -> ContinuousPlaybackSession | None:
        for s in self.sessions.values():
            if s.patient_id == patient_id:
                return s
        return None

    def remove_session(self, session_id: str):
        self.sessions.pop(session_id, None)

    def terminate_session_for_patient(self, patient_id: str):
        """Stops and cleans up any existing playback session for a specific patient."""
        if not patient_id:
            return
        to_remove = [sid for sid, s in self.sessions.items() if s.patient_id == patient_id]
        for sid in to_remove:
            sess = self.sessions.pop(sid, None)
            if sess:
                try:
                    sess.stop()
                    db_client.set_document("monitoring_sessions", sid, {"status": "terminated"}, merge=True)
                except Exception as e:
                    logger.warning(f"Error stopping session {sid}: {e}")
        try:
            db_client.set_document("patients", patient_id, {"monitoringStatus": "inactive"}, merge=True)
        except Exception as e:
            logger.warning(f"Error updating patient monitoring status: {e}")

    def get_all_active_sessions(self) -> dict[str, dict]:
        """Returns dict of active/running sessions keyed by patientId."""
        result = {}
        for s in self.sessions.values():
            if s.status in ["running", "paused", "ready"]:
                result[s.patient_id] = {
                    "sessionId": s.session_id,
                    "patientId": s.patient_id,
                    "recordingId": s.recording_id,
                    "channel": s.channel,
                    "status": s.status,
                    "playbackSpeed": s.playback_speed,
                    "currentPacket": s.current_packet_sequence,
                    "currentSampleIndex": s.current_sample_index,
                    "totalSamples": s.total_samples,
                    "durationSec": round(s.total_samples / s.sampling_frequency, 2) if s.sampling_frequency > 0 else 0,
                    "progressPercentage": round((s.current_sample_index / s.total_samples) * 100, 1) if s.total_samples > 0 else 0
                }
        return result

playback_manager = PlaybackSessionManager()
