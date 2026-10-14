import numpy as np
from scipy import stats, signal
import json
from pathlib import Path

FEATURE_NAMES = [
    "mean",
    "std",
    "rms",
    "kurtosis",
    "ptp_amplitude",
    "line_length",
    "delta_power",
    "theta_power",
    "alpha_power",
    "beta_power",
    "gamma_power",
    "spectral_slowing_ratio",
    "total_power"
]

class EEGFeatureExtractor:
    """
    Standardized Feature Extractor for EEG Window Analysis.
    Extracts time-domain and frequency-domain biometric indicators for Random Forest seizure risk estimation.
    """

    def __init__(self, sampling_rate: int = 256):
        self.sampling_rate = sampling_rate
        self.feature_names = FEATURE_NAMES

    def extract_time_domain(self, window: np.ndarray) -> dict:
        """
        Calculates time-domain statistical metrics.
        """
        arr = np.asarray(window, dtype=np.float64)
        mean_val = float(np.mean(arr))
        std_val = float(np.std(arr))
        rms_val = float(np.sqrt(np.mean(arr ** 2)))
        kurt_val = float(stats.kurtosis(arr))
        ptp_val = float(np.ptp(arr))
        # Line length: sum of absolute differences between consecutive samples
        line_length_val = float(np.sum(np.abs(np.diff(arr))))

        return {
            "mean": mean_val,
            "std": std_val,
            "rms": rms_val,
            "kurtosis": kurt_val,
            "ptp_amplitude": ptp_val,
            "line_length": line_length_val
        }

    def extract_frequency_domain(self, window: np.ndarray) -> dict:
        """
        Calculates frequency-domain spectral band powers using Welch's Power Spectral Density.
        Bands:
          Delta: 0.5 - 4 Hz
          Theta: 4 - 8 Hz
          Alpha: 8 - 12 Hz
          Beta: 12 - 30 Hz
          Gamma: 30 - 45 Hz
        """
        arr = np.asarray(window, dtype=np.float64)
        nperseg = min(len(arr), self.sampling_rate)
        if nperseg < 8:
            nperseg = len(arr)

        freqs, psd = signal.welch(arr, fs=self.sampling_rate, nperseg=nperseg)

        def band_power(f_min, f_max):
            mask = (freqs >= f_min) & (freqs <= f_max)
            if not np.any(mask):
                return 0.0
            return float(np.trapezoid(psd[mask], freqs[mask])) if hasattr(np, 'trapezoid') else float(np.trapz(psd[mask], freqs[mask]))

        delta_p = band_power(0.5, 4.0)
        theta_p = band_power(4.0, 8.0)
        alpha_p = band_power(8.0, 12.0)
        beta_p = band_power(12.0, 30.0)
        gamma_p = band_power(30.0, 45.0)

        total_p = delta_p + theta_p + alpha_p + beta_p + gamma_p + 1e-9
        # Spectral slowing ratio: (Delta + Theta) / (Alpha + Beta)
        fast_p = alpha_p + beta_p + 1e-9
        slowing_ratio = float((delta_p + theta_p) / fast_p)

        return {
            "delta_power": delta_p,
            "theta_power": theta_p,
            "alpha_power": alpha_p,
            "beta_power": beta_p,
            "gamma_power": gamma_p,
            "spectral_slowing_ratio": slowing_ratio,
            "total_power": total_p
        }

    def extract_features_dict(self, window: np.ndarray) -> dict:
        """
        Extracts both time and frequency domain features as a dictionary.
        """
        time_feats = self.extract_time_domain(window)
        freq_feats = self.extract_frequency_domain(window)
        combined = {**time_feats, **freq_feats}
        return combined

    def extract_features_vector(self, window: np.ndarray) -> np.ndarray:
        """
        Extracts features and returns a 1D numpy array in guaranteed consistent order.
        """
        feat_dict = self.extract_features_dict(window)
        vector = [feat_dict[k] for k in self.feature_names]
        return np.array(vector, dtype=np.float64)

    def extract_features_batch(self, windows: list[np.ndarray]) -> np.ndarray:
        """
        Extracts features for a list of windows. Returns 2D array of shape (N, num_features).
        """
        vectors = [self.extract_features_vector(w) for w in windows]
        return np.array(vectors, dtype=np.float64)

    def save_feature_names(self, filepath: Path):
        """
        Saves feature names to JSON to maintain consistency between training and inference.
        """
        with open(filepath, "w") as f:
            json.dump({"feature_names": self.feature_names}, f, indent=2)
