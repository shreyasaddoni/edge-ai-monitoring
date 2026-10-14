import numpy as np
from scipy import signal
import logging

logger = logging.getLogger(__name__)

class EEGPreprocessor:
    """
    Standardized EEG Signal Preprocessor for Edge AI Epilepsy Monitoring.
    Performs channel validation, digital bandpass filtering, notch filtering,
    missing value cleaning, quality checks, and window segmentation.
    """

    def __init__(
        self,
        sampling_rate: int = 256,
        lowcut: float = 0.5,
        highcut: float = 45.0,
        notch_freq: float = 50.0,
        filter_order: int = 4
    ):
        self.sampling_rate = sampling_rate
        self.lowcut = lowcut
        self.highcut = highcut
        self.notch_freq = notch_freq
        self.filter_order = filter_order

        # Validate filter parameters
        nyquist = 0.5 * self.sampling_rate
        if self.highcut >= nyquist:
            self.highcut = nyquist - 1.0

        # Pre-calculate Butterworth bandpass filter coefficients
        low = self.lowcut / nyquist
        high = self.highcut / nyquist
        self.b_band, self.a_band = signal.butter(
            self.filter_order, [low, high], btype="bandpass"
        )

        # Pre-calculate IIR notch filter for powerline hum removal
        if 0 < self.notch_freq < nyquist:
            quality_factor = 30.0
            w0 = self.notch_freq / nyquist
            self.b_notch, self.a_notch = signal.iirnotch(w0, quality_factor)
        else:
            self.b_notch, self.a_notch = None, None

    def validate_signal(self, raw_data: np.ndarray) -> np.ndarray:
        """
        Validates raw input data format, checks for NaNs/Infs, handles empty signals.
        Returns a clean 1D or 2D float64 numpy array.
        """
        if raw_data is None:
            raise ValueError("Signal data cannot be None.")

        data = np.asarray(raw_data, dtype=np.float64)

        if data.size == 0:
            raise ValueError("Signal data cannot be empty.")

        # Ensure finite values
        if not np.all(np.isfinite(data)):
            # Handle NaNs and Infs through interpolation or mean substitution
            mask_nan = np.isnan(data)
            mask_inf = np.isinf(data)
            invalid_mask = mask_nan | mask_inf
            if np.all(invalid_mask):
                raise ValueError("Signal contains only invalid (NaN/Inf) samples.")

            valid_mean = np.mean(data[~invalid_mask])
            data = np.where(invalid_mask, valid_mean, data)
            logger.warning("Replaced NaN/Inf values with valid channel mean.")

        return data

    def apply_filters(self, signal_data: np.ndarray) -> np.ndarray:
        """
        Applies zero-phase Butterworth bandpass filter (0.5 - 45 Hz)
        and Notch filter (50/60 Hz) to eliminate DC offset, slow drift, and powerline noise.
        """
        signal_clean = self.validate_signal(signal_data)

        # Must have enough samples for filtfilt (at least 3 * max(len(a), len(b)))
        min_samples = 3 * max(len(self.a_band), len(self.b_band))
        if signal_clean.shape[-1] <= min_samples:
            # Signal too short for filtfilt; return original cleaned data
            return signal_clean

        # Filter bandpass
        filtered = signal.filtfilt(self.b_band, self.a_band, signal_clean, axis=-1)

        # Filter notch if configured
        if self.b_notch is not None and self.a_notch is not None:
            filtered = signal.filtfilt(self.b_notch, self.a_notch, filtered, axis=-1)

        return filtered

    def segment_windows(
        self,
        signal_data: np.ndarray,
        window_size: int = 512,
        overlap_size: int = 256
    ) -> list[np.ndarray]:
        """
        Segments continuous 1D EEG signal into fixed-length windows.
        window_size=512 at 256 Hz corresponds to 2.0 seconds.
        """
        signal_clean = self.validate_signal(signal_data)
        if signal_clean.ndim > 1:
            signal_clean = signal_clean.flatten()

        total_samples = len(signal_clean)
        if total_samples < window_size:
            # If slightly short, pad with zeros or edge reflect
            pad_width = window_size - total_samples
            padded = np.pad(signal_clean, (0, pad_width), mode='edge')
            return [padded]

        step = window_size - overlap_size
        if step <= 0:
            step = window_size // 2

        windows = []
        for start in range(0, total_samples - window_size + 1, step):
            windows.append(signal_clean[start: start + window_size])

        # If remainder is left over and no windows were created
        if not windows and total_samples >= window_size:
            windows.append(signal_clean[:window_size])

        return windows

    def check_signal_quality(self, window_data: np.ndarray) -> dict:
        """
        Performs basic signal quality check:
        - Amplitude bounds (microvolts typical: 1 uV to 1000 uV)
        - Baseline drift / Flatline detection (near-zero variance)
        """
        data = self.validate_signal(window_data)
        var = float(np.var(data))
        ptp = float(np.ptp(data))
        is_flatline = var < 1e-6
        is_saturated = ptp > 2500.0  # Excessive clipping artifact

        is_acceptable = not is_flatline and not is_saturated
        return {
            "acceptable": is_acceptable,
            "variance": round(var, 4),
            "peak_to_peak": round(ptp, 4),
            "flatline": is_flatline,
            "saturated": is_saturated,
            "samples_count": len(data)
        }
