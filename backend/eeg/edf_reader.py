import os
from pathlib import Path
import numpy as np
import pandas as pd
import logging

logger = logging.getLogger(__name__)

# Try importing mne
try:
    import mne
    MNE_AVAILABLE = True
except ImportError:
    MNE_AVAILABLE = False

class EEGFileReader:
    """
    Robust EEG File Reader supporting:
    1. EDF format (European Data Format, CHB-MIT Scalp EEG compatible) using MNE-Python.
    2. CSV / TSV tabular format (timestamp, channel columns).
    3. NumPy array / NPY format.
    """

    @staticmethod
    def inspect_and_load(file_path: Path | str, target_sampling_rate: int = 256) -> dict:
        """
        Loads EEG file and extracts:
        - raw data dictionary {channel_name: numpy_1d_array}
        - metadata: sampling_frequency, duration_sec, channels, total_samples, annotations
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")

        ext = path.suffix.lower()

        if ext == ".edf":
            return EEGFileReader._load_edf(path, target_sampling_rate)
        elif ext in [".csv", ".tsv"]:
            return EEGFileReader._load_csv(path, target_sampling_rate)
        elif ext == ".npy":
            return EEGFileReader._load_npy(path, target_sampling_rate)
        else:
            raise ValueError(f"Unsupported EEG file extension: {ext}. Expected .edf, .csv, or .tsv.")

    @staticmethod
    def _load_edf(path: Path, target_sampling_rate: int) -> dict:
        if not MNE_AVAILABLE:
            raise RuntimeError("MNE-Python is required to read .edf files. Please install mne.")

        # Read EDF file with mne (suppress verbose logs)
        raw = mne.io.read_raw_edf(str(path), preload=True, verbose="ERROR")

        # Extract sampling frequency
        sfreq = int(round(raw.info["sfreq"]))
        channels = raw.ch_names
        total_samples = raw.n_times
        duration_sec = float(total_samples / sfreq) if sfreq > 0 else 0.0

        # Resample if needed to target sampling rate
        if sfreq != target_sampling_rate and target_sampling_rate > 0:
            logger.info(f"Resampling EDF from {sfreq} Hz to {target_sampling_rate} Hz")
            raw.resample(target_sampling_rate, verbose="ERROR")
            sfreq = target_sampling_rate
            total_samples = raw.n_times
            duration_sec = float(total_samples / sfreq)

        # Get channel signals as dictionary (scale from Volts to Microvolts typical in EEG)
        # MNE loads in Volts, so 1 uV = 1e-6 V. Multiply by 1e6 to convert to uV.
        data_matrix = raw.get_data() * 1e6

        channel_dict = {}
        for idx, ch_name in enumerate(channels):
            # Clean channel name (e.g. 'EEG FP1-F7' -> 'FP1-F7')
            clean_name = ch_name.replace("EEG ", "").replace("-REF", "").strip()
            channel_dict[clean_name] = data_matrix[idx].astype(np.float64)

        # Annotations if any
        annotations_list = []
        if raw.annotations:
            for annot in raw.annotations:
                annotations_list.append({
                    "onset_sec": float(annot["onset"]),
                    "duration_sec": float(annot["duration"]),
                    "description": str(annot["description"])
                })

        return {
            "format": "EDF",
            "filename": path.name,
            "sampling_frequency": sfreq,
            "duration_sec": round(duration_sec, 2),
            "total_samples": int(total_samples),
            "channels": list(channel_dict.keys()),
            "channel_data": channel_dict,
            "annotations": annotations_list
        }

    @staticmethod
    def _load_csv(path: Path, target_sampling_rate: int) -> dict:
        from scipy import signal

        sep = "\t" if path.suffix.lower() == ".tsv" else ","
        df = pd.read_csv(path, sep=sep)

        # Check if this is the UCI Epileptic Seizure dataset format (X1, X2, ... X178)
        x_cols = [c for c in df.columns if c.startswith("X") and c[1:].isdigit()]
        if len(x_cols) >= 50:
            # Sort X1..X178 numerically (e.g. X1, X2, ..., X178)
            x_cols.sort(key=lambda c: int(c[1:]))
            orig_sfreq = len(x_cols)  # 178 Hz (178 samples per 1-second segment)

            # Flatten rows sequentially into continuous time-series EEG samples
            raw_matrix = df[x_cols].to_numpy(dtype=np.float64)
            continuous_signal = raw_matrix.flatten()

            # Resample to target model sampling rate (256 Hz)
            num_resampled = int(len(continuous_signal) * (target_sampling_rate / orig_sfreq))
            resampled_signal = signal.resample(continuous_signal, num_resampled)

            # Detect seizure episode annotations if 'y' or 'label' column is present
            annotations = []
            y_col = [c for c in df.columns if c.lower() in ["y", "label", "class"]]
            if y_col:
                labels = df[y_col[0]].values
                for row_idx, lbl in enumerate(labels):
                    if str(lbl).strip() == "1":
                        annotations.append({
                            "onset_sec": float(row_idx),
                            "duration_sec": 1.0,
                            "description": "Ictal Seizure Episode (Class 1)"
                        })

            total_samples = len(resampled_signal)
            duration_sec = float(total_samples / target_sampling_rate)
            channel_name = "EEG_CH1"

            logger.info(
                f"Detected UCI Epileptic Seizure format: {len(df)} 1-sec segments, "
                f"unrolled into {total_samples} samples at {target_sampling_rate} Hz ({duration_sec:.1f}s)."
            )

            return {
                "format": "CSV (UCI Bonn)",
                "filename": path.name,
                "sampling_frequency": target_sampling_rate,
                "duration_sec": round(duration_sec, 2),
                "total_samples": total_samples,
                "channels": [channel_name],
                "channel_data": {channel_name: resampled_signal},
                "annotations": annotations
            }

        # Drop non-numerical timestamp or index column if present
        time_cols = [c for c in df.columns if "time" in c.lower() or "timestamp" in c.lower()]
        if time_cols:
            df = df.drop(columns=time_cols)

        channels = list(df.columns)
        total_samples = len(df)
        sfreq = target_sampling_rate
        duration_sec = float(total_samples / sfreq)

        channel_dict = {}
        for ch in channels:
            channel_dict[ch] = df[ch].to_numpy(dtype=np.float64)

        return {
            "format": "CSV",
            "filename": path.name,
            "sampling_frequency": sfreq,
            "duration_sec": round(duration_sec, 2),
            "total_samples": total_samples,
            "channels": channels,
            "channel_data": channel_dict,
            "annotations": []
        }

    @staticmethod
    def _load_npy(path: Path, target_sampling_rate: int) -> dict:
        arr = np.load(path)
        if arr.ndim == 1:
            arr = arr.reshape(1, -1)
        total_samples = arr.shape[1]
        channels = [f"CH_{i+1}" for i in range(arr.shape[0])]
        sfreq = target_sampling_rate
        duration_sec = float(total_samples / sfreq)

        channel_dict = {}
        for idx, ch in enumerate(channels):
            channel_dict[ch] = arr[idx].astype(np.float64)

        return {
            "format": "NPY",
            "filename": path.name,
            "sampling_frequency": sfreq,
            "duration_sec": round(duration_sec, 2),
            "total_samples": total_samples,
            "channels": channels,
            "channel_data": channel_dict,
            "annotations": []
        }

    @staticmethod
    def create_sample_edf(output_path: Path, duration_sec: float = 60.0, pattern: str = "seizure") -> str:
        """
        Creates a valid CHB-MIT standard EDF recording file for testing and immediate evaluation.
        """
        if not MNE_AVAILABLE:
            raise RuntimeError("MNE is required to create EDF files.")

        sfreq = 256.0
        n_samples = int(duration_sec * sfreq)
        t = np.linspace(0, duration_sec, n_samples, endpoint=False)

        # Create 4 standard CHB-MIT channels
        ch_names = ["FP1-F7", "F7-T7", "T7-P7", "P7-O1"]
        data = np.zeros((len(ch_names), n_samples))

        for idx, ch in enumerate(ch_names):
            # Base rhythm in microvolts
            if pattern == "seizure":
                # Ictal 3Hz spike-and-wave discharges
                delta_slow = 180.0 * np.sin(2 * np.pi * 3.0 * t + idx * 0.2)
                spike = 80.0 * np.sin(2 * np.pi * 6.0 * t)
                noise = np.random.normal(0, 5.0, n_samples)
                sig_uv = delta_slow + spike + noise
            else:
                # Normal 10Hz alpha rhythm
                alpha = 35.0 * np.sin(2 * np.pi * 10.0 * t + idx * 0.3)
                beta = 8.0 * np.sin(2 * np.pi * 20.0 * t)
                noise = np.random.normal(0, 3.0, n_samples)
                sig_uv = alpha + beta + noise

            # Convert uV to V for MNE
            data[idx] = sig_uv * 1e-6

        info = mne.create_info(ch_names=ch_names, sfreq=sfreq, ch_types="eeg")
        raw = mne.io.RawArray(data, info, verbose="ERROR")

        # Add annotation if seizure
        if pattern == "seizure":
            onset = min(2.0, duration_sec * 0.1)
            annot_duration = max(1.0, min(30.0, duration_sec * 0.7))
            annotations = mne.Annotations(onset=[onset], duration=[annot_duration], description=["Seizure Episode"])
            raw.set_annotations(annotations)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        mne.export.export_raw(str(output_path), raw, fmt="edf", overwrite=True, verbose="ERROR")
        return str(output_path)
