import os
import re
from pathlib import Path
import numpy as np
import pandas as pd
import logging

logger = logging.getLogger(__name__)

# Standard 18-channel bipolar montage from CHB-MIT
STANDARD_CHANNELS = [
    "FP1-F7", "F7-T7", "T7-P7", "P7-O1",
    "FP1-F3", "F3-C3", "C3-P3", "P3-O1",
    "FP2-F4", "F4-C4", "C4-P4", "P4-O2",
    "FP2-F8", "F8-T8", "T8-P8", "P8-O2",
    "FZ-CZ", "CZ-PZ"
]

class CHBMITDatasetLoader:
    """
    Dataset loader for CHB-MIT Scalp EEG and synthetic biometric generation.
    Supports local .edf, .csv, and demo streams for live wearable simulator.
    """

    def __init__(self, dataset_path: str | Path | None = None, sampling_rate: int = 256):
        self.dataset_path = Path(dataset_path) if dataset_path else Path("backend/data/chbmit")
        self.sampling_rate = sampling_rate

    def parse_summary_file(self, summary_path: Path) -> dict:
        """
        Parses CHB-MIT summary text files for seizure onset and offset timestamps.
        Example format:
        File Name: chb01_03.edf
        Number of Seizures in File: 1
        Seizure 1 Start Time: 2996 seconds
        Seizure 1 End Time: 3036 seconds
        """
        if not summary_path.exists():
            return {}

        records = {}
        current_file = None

        with open(summary_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if line.startswith("File Name:"):
                    current_file = line.split(":", 1)[1].strip()
                    if current_file not in records:
                        records[current_file] = {
                            "seizures": [],
                            "duration_sec": 3600
                        }
                elif "Seizure" in line and "Start Time:" in line:
                    match = re.search(r"Start Time:\s*(\d+)", line)
                    if match and current_file:
                        start_t = int(match.group(1))
                        records[current_file]["seizures"].append({"start": start_t, "end": start_t + 40})
                elif "Seizure" in line and "End Time:" in line:
                    match = re.search(r"End Time:\s*(\d+)", line)
                    if match and current_file and records[current_file]["seizures"]:
                        records[current_file]["seizures"][-1]["end"] = int(match.group(1))

        return records

    def generate_synthetic_eeg(
        self,
        duration_sec: float = 60.0,
        pattern: str = "normal",
        channel_name: str = "FP1-F7"
    ) -> tuple[np.ndarray, np.ndarray, int]:
        """
        Generates realistic EEG signal patterns for demonstration and zero-cost simulation:
        - 'normal': Dominant posterior alpha rhythm (8-12 Hz) + low-amplitude beta (18-24 Hz) + pink noise. Amplitude 20-50 uV.
        - 'seizure': High amplitude (150-300 uV), rhythmic delta/theta slowing (2-4 Hz), sharp spike waves, high synchrony.
        - 'interictal': Mostly normal with occasional paroxysmal sharp bursts.
        Returns: (time_array, signal_data, label)
          label: 0 for normal/interictal, 1 for seizure
        """
        num_samples = int(duration_sec * self.sampling_rate)
        t = np.linspace(0, duration_sec, num_samples, endpoint=False)

        # Baseline noise (1/f approximation via cumulative sum or AR process)
        white_noise = np.random.normal(0, 1.5, num_samples)
        pink_noise = np.convolve(white_noise, np.ones(5) / 5, mode='same') * 4.0

        if pattern == "normal":
            # Normal awake EEG: 10 Hz Alpha (35 uV) + 20 Hz Beta (10 uV) + slow baseline wander
            alpha = 35.0 * np.sin(2 * np.pi * 10.0 * t + np.random.uniform(0, 2 * np.pi))
            beta = 10.0 * np.sin(2 * np.pi * 20.0 * t)
            drift = 5.0 * np.sin(2 * np.pi * 0.2 * t)
            eeg = alpha + beta + drift + pink_noise
            label = 0

        elif pattern == "seizure":
            # Ictal discharge: High amplitude (200 uV), 3 Hz Spike-and-wave complex + harmonic bursts
            delta_slow = 160.0 * np.sin(2 * np.pi * 3.0 * t)
            # Add sharp spikes (higher harmonic series with asymmetric phase)
            spike = 90.0 * np.sin(2 * np.pi * 6.0 * t) + 40.0 * np.sin(2 * np.pi * 9.0 * t)
            # Modulation envelope to simulate evolving ictal pattern
            envelope = 1.0 + 0.3 * np.sin(2 * np.pi * 0.1 * t)
            eeg = (delta_slow + spike) * envelope + pink_noise * 1.5
            label = 1

        elif pattern == "interictal":
            # Normal background with intermittent spikes every ~8-12 seconds
            alpha = 35.0 * np.sin(2 * np.pi * 9.5 * t)
            eeg = alpha + pink_noise
            # Inject isolated sharp spikes
            for spike_center in np.arange(8.0, duration_sec, 10.0):
                center_idx = int(spike_center * self.sampling_rate)
                if 0 <= center_idx < num_samples - 50:
                    spike_width = 30
                    spike_shape = 120.0 * np.exp(-0.5 * ((np.arange(spike_width) - 15) / 4) ** 2)
                    eeg[center_idx: center_idx + spike_width] += spike_shape
            label = 0
        else:
            eeg = pink_noise
            label = 0

        return t, eeg, label

    def list_available_recordings(self) -> list[dict]:
        """
        Lists available recordings:
        1. Built-in zero-cost demonstration streams (normal, seizure episode, interictal)
        2. Any real CHB-MIT .edf or .csv files found in dataset_path
        """
        recordings = [
            {
                "recordingId": "demo_chb01_normal",
                "datasetName": "CHB-MIT Demonstration Stream",
                "pseudonymousDatasetIdentifier": "chb01_01_simulated",
                "filename": "chb01_01_normal_epoch.sim",
                "description": "Baseline Normal Alpha EEG (Resting State, Interictal Non-Seizure)",
                "samplingFrequency": self.sampling_rate,
                "channelMetadata": STANDARD_CHANNELS[:4],
                "recordingDuration": 120.0,
                "isSynthetic": True,
                "groundTruthLabel": "Normal (Low Risk)"
            },
            {
                "recordingId": "demo_chb01_ictal",
                "datasetName": "CHB-MIT Demonstration Stream",
                "pseudonymousDatasetIdentifier": "chb01_03_simulated",
                "filename": "chb01_03_ictal_episode.sim",
                "description": "Epileptic Seizure Discharge (Ictal 3Hz Spike-and-Wave Activity)",
                "samplingFrequency": self.sampling_rate,
                "channelMetadata": STANDARD_CHANNELS[:4],
                "recordingDuration": 120.0,
                "isSynthetic": True,
                "groundTruthLabel": "Seizure Discharge (High Risk)"
            },
            {
                "recordingId": "demo_chb02_interictal",
                "datasetName": "CHB-MIT Demonstration Stream",
                "pseudonymousDatasetIdentifier": "chb02_01_simulated",
                "filename": "chb02_01_interictal_spikes.sim",
                "description": "Interictal Transient Activity (Occasional Epileptiform Bursts)",
                "samplingFrequency": self.sampling_rate,
                "channelMetadata": STANDARD_CHANNELS[:4],
                "recordingDuration": 120.0,
                "isSynthetic": True,
                "groundTruthLabel": "Interictal Transients (Moderate Risk)"
            }
        ]

        # Scan for real CHB-MIT files if directory exists
        if self.dataset_path.exists():
            for edf_path in self.dataset_path.glob("**/*.edf"):
                recordings.append({
                    "recordingId": edf_path.stem,
                    "datasetName": "CHB-MIT Scalp EEG",
                    "pseudonymousDatasetIdentifier": edf_path.parent.name,
                    "filename": edf_path.name,
                    "description": f"PhysioNet Recording {edf_path.name}",
                    "samplingFrequency": self.sampling_rate,
                    "channelMetadata": STANDARD_CHANNELS,
                    "recordingDuration": 3600.0,
                    "isSynthetic": False,
                    "groundTruthLabel": "Annotated File"
                })

        # Include user-uploaded recordings from Firestore/DB
        try:
            from backend.firebase.firebase_client import db_client
            uploaded_recs = db_client.query_collection("eeg_recordings", limit=50)
            for u in uploaded_recs:
                recordings.append({
                    "recordingId": u.get("recordingId"),
                    "datasetName": f"Uploaded ({u.get('format', 'EDF')})",
                    "pseudonymousDatasetIdentifier": u.get("patientId", "Patient File"),
                    "filename": u.get("originalFilename", "recording.edf"),
                    "description": f"Uploaded: {u.get('description', u.get('originalFilename'))}",
                    "samplingFrequency": u.get("samplingFrequency", self.sampling_rate),
                    "channelMetadata": u.get("channels", STANDARD_CHANNELS[:4]),
                    "recordingDuration": u.get("durationSec", 60.0),
                    "isSynthetic": False,
                    "isUploaded": True,
                    "groundTruthLabel": "Uploaded Recording"
                })
        except Exception as e:
            logger.debug(f"Could not load uploaded recordings: {e}")

        return recordings

    def load_recording_batch(
        self,
        recording_id: str,
        start_time_sec: float,
        duration_sec: float = 2.0,
        channel: str = "FP1-F7"
    ) -> dict:
        """
        Loads a specific batch/epoch for wearable streaming.
        Returns EEG samples, timestamps, channel, and simulated sample data.
        """
        from backend.firebase.firebase_client import db_client
        from backend.eeg.edf_reader import EEGFileReader

        # Check if this is an uploaded recording
        rec_doc = db_client.get_document("eeg_recordings", recording_id)
        if rec_doc and rec_doc.get("localFilePath") and Path(rec_doc["localFilePath"]).exists():
            file_path = Path(rec_doc["localFilePath"])
            file_data = EEGFileReader.inspect_and_load(file_path, target_sampling_rate=self.sampling_rate)
            ch_data = file_data["channel_data"]
            selected_sig = ch_data.get(channel)
            if selected_sig is None and ch_data:
                selected_sig = list(ch_data.values())[0]

            sfreq = file_data["sampling_frequency"]
            start_sample = int(start_time_sec * sfreq)
            batch_samples_count = int(duration_sec * sfreq)
            total_samples = len(selected_sig)

            # Slice with looping if exceeds duration
            if total_samples > 0:
                s_idx = start_sample % total_samples
                e_idx = s_idx + batch_samples_count
                if e_idx <= total_samples:
                    batch_samples = selected_sig[s_idx:e_idx]
                else:
                    batch_samples = np.concatenate([selected_sig[s_idx:], selected_sig[:e_idx - total_samples]])
            else:
                batch_samples = np.zeros(batch_samples_count)

            time_axis = [round(start_time_sec + i / sfreq, 4) for i in range(len(batch_samples))]
            downsample_factor = max(1, len(batch_samples) // 128)
            display_points = [
                {"time": time_axis[i], "microvolts": round(float(batch_samples[i]), 2)}
                for i in range(0, len(batch_samples), downsample_factor)
            ]

            return {
                "recording_id": recording_id,
                "channel": channel,
                "start_time_sec": start_time_sec,
                "duration_sec": duration_sec,
                "sampling_rate": sfreq,
                "samples": batch_samples.tolist(),
                "display_points": display_points,
                "ground_truth_label": "Uploaded Recording"
            }

        # If synthetic or demo
        if "demo_" in recording_id or not self.dataset_path.exists():
            pattern = "normal"
            if "ictal" in recording_id:
                pattern = "seizure"
            elif "interictal" in recording_id:
                pattern = "interictal"

            _, full_signal, ground_truth = self.generate_synthetic_eeg(
                duration_sec=duration_sec,
                pattern=pattern,
                channel_name=channel
            )
            sample_count = len(full_signal)
            time_axis = [round(start_time_sec + i / self.sampling_rate, 4) for i in range(sample_count)]

            # Downsample slightly for frontend display graph (e.g. 128 points for smooth 60fps rendering)
            downsample_factor = max(1, sample_count // 128)
            display_points = [
                {"time": time_axis[i], "microvolts": round(float(full_signal[i]), 2)}
                for i in range(0, sample_count, downsample_factor)
            ]

            return {
                "recording_id": recording_id,
                "channel": channel,
                "start_time_sec": start_time_sec,
                "duration_sec": duration_sec,
                "sampling_rate": self.sampling_rate,
                "samples": full_signal.tolist(),
                "display_points": display_points,
                "ground_truth_label": ground_truth
            }

        raise NotImplementedError("EDF file loading encountered an unknown error.")

