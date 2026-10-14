import json
import logging
from pathlib import Path
import numpy as np
import joblib
from datetime import datetime, timezone

from backend.config import Config
from backend.eeg.preprocessing import EEGPreprocessor
from backend.eeg.feature_extraction import EEGFeatureExtractor, FEATURE_NAMES

logger = logging.getLogger(__name__)

class EEGSeizurePredictor:
    """
    Inference service for Edge AI EEG Seizure Risk Classification.
    Loads trained Random Forest model and provides real-time risk assessment.
    """

    def __init__(self, model_path: Path | None = None):
        self.model_path = model_path if model_path else Config.DEFAULT_MODEL_FILE
        self.model = None
        self.metadata = {}
        self.feature_names = FEATURE_NAMES
        self.preprocessor = EEGPreprocessor(sampling_rate=Config.SAMPLING_RATE)
        self.extractor = EEGFeatureExtractor(sampling_rate=Config.SAMPLING_RATE)
        self.load_model()

    def load_model(self) -> bool:
        """Loads model and metadata from disk if available."""
        if self.model_path.exists():
            try:
                self.model = joblib.load(self.model_path)
                meta_path = self.model_path.parent / "model_metadata.json"
                if meta_path.exists():
                    with open(meta_path, "r") as f:
                        self.metadata = json.load(f)
                logger.info(f"Loaded Random Forest model from {self.model_path}")
                return True
            except Exception as e:
                logger.error(f"Failed to load model from {self.model_path}: {e}")
                self.model = None
                return False
        return False

    @property
    def is_ready(self) -> bool:
        return self.model is not None

    def get_status(self) -> dict:
        """Returns model status and metadata."""
        return {
            "is_ready": self.is_ready,
            "model_path": str(self.model_path),
            "model_version": self.metadata.get("version", "unknown"),
            "model_name": self.metadata.get("model_name", "Random Forest Classifier"),
            "features_count": len(self.feature_names),
            "metrics": self.metadata.get("metrics", {}),
            "feature_importances": self.metadata.get("feature_importances", {})
        }

    def classify_risk(self, probability: float) -> str:
        """
        Classifies risk into Low, Medium, High based on configurable thresholds.
        Thresholds:
          Low: < 40%
          Medium: 40% to < 70%
          High: >= 70%
        """
        if probability < Config.RISK_LOW_MAX:
            return "Low"
        elif probability < Config.RISK_HIGH_MIN:
            return "Medium"
        else:
            return "High"

    def predict_window(self, raw_samples: list | np.ndarray) -> dict:
        """
        Full inference pipeline for a single EEG window:
        1. Preprocessing (validation, bandpass filtering, notch)
        2. Feature extraction (time and frequency domain)
        3. Random Forest inference
        4. Risk category mapping
        """
        if not self.is_ready:
            raise RuntimeError(
                "Machine Learning Model is not ready. Please train the model first via the ML service or command."
            )

        # 1. Preprocess
        filtered_signal = self.preprocessor.apply_filters(np.array(raw_samples, dtype=np.float64))
        quality = self.preprocessor.check_signal_quality(filtered_signal)

        # 2. Extract features
        features_dict = self.extractor.extract_features_dict(filtered_signal)
        feature_vector = np.array([[features_dict[k] for k in self.feature_names]], dtype=np.float64)

        # 3. Predict
        predicted_class = int(self.model.predict(feature_vector)[0])
        probabilities = self.model.predict_proba(feature_vector)[0]
        seizure_prob = float(probabilities[1]) if len(probabilities) > 1 else float(predicted_class)

        # 4. Risk classification
        risk_cat = self.classify_risk(seizure_prob)

        return {
            "predictionLabel": "Seizure Pattern Detected" if predicted_class == 1 else "Normal Brain Activity",
            "predictionClass": predicted_class,
            "modelProbability": round(seizure_prob, 4),
            "riskCategory": risk_cat,
            "modelVersion": self.metadata.get("version", "1.0.0"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "signalQuality": quality,
            "features": {k: round(v, 4) if isinstance(v, float) else v for k, v in features_dict.items()},
            "isAlertEligible": risk_cat == "High"
        }

# Global singleton instance
predictor = EEGSeizurePredictor()
