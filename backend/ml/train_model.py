import json
import logging
from pathlib import Path
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)

from backend.config import Config
from backend.eeg.preprocessing import EEGPreprocessor
from backend.eeg.feature_extraction import EEGFeatureExtractor, FEATURE_NAMES
from backend.eeg.dataset_loader import CHBMITDatasetLoader

logger = logging.getLogger(__name__)

def generate_training_dataset(num_samples_per_class: int = 250):
    """
    Generates a balanced feature matrix of normal, interictal, and ictal (seizure) patterns
    using standardized preprocessing and feature extraction.
    """
    loader = CHBMITDatasetLoader(sampling_rate=Config.SAMPLING_RATE)
    preprocessor = EEGPreprocessor(sampling_rate=Config.SAMPLING_RATE)
    extractor = EEGFeatureExtractor(sampling_rate=Config.SAMPLING_RATE)

    X_list = []
    y_list = []

    # 1. Normal signals (label 0)
    for _ in range(num_samples_per_class):
        _, raw, _ = loader.generate_synthetic_eeg(duration_sec=Config.WINDOW_DURATION_SEC, pattern="normal")
        filtered = preprocessor.apply_filters(raw)
        feats = extractor.extract_features_vector(filtered)
        X_list.append(feats)
        y_list.append(0)

    # 2. Interictal signals (label 0, slight transients but non-seizure)
    for _ in range(num_samples_per_class // 2):
        _, raw, _ = loader.generate_synthetic_eeg(duration_sec=Config.WINDOW_DURATION_SEC, pattern="interictal")
        filtered = preprocessor.apply_filters(raw)
        feats = extractor.extract_features_vector(filtered)
        X_list.append(feats)
        y_list.append(0)

    # 3. Seizure / Ictal signals (label 1)
    for _ in range(num_samples_per_class + num_samples_per_class // 2):
        _, raw, _ = loader.generate_synthetic_eeg(duration_sec=Config.WINDOW_DURATION_SEC, pattern="seizure")
        filtered = preprocessor.apply_filters(raw)
        feats = extractor.extract_features_vector(filtered)
        X_list.append(feats)
        y_list.append(1)

    X = np.array(X_list, dtype=np.float64)
    y = np.array(y_list, dtype=np.int32)
    return X, y

def train_and_evaluate_model(output_dir: Path | None = None) -> dict:
    """
    Trains a Random Forest Classifier on EEG features, evaluates performance metrics,
    and saves the model and metadata to disk.
    """
    if output_dir is None:
        output_dir = Config.MODEL_DIR

    output_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Generating training data...")
    X, y = generate_training_dataset(num_samples_per_class=300)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        min_samples_split=4,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )

    logger.info("Training Random Forest Classifier...")
    clf.fit(X_train, y_train)

    # Evaluate
    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0)) # Sensitivity
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    cm = confusion_matrix(y_test, y_pred).tolist()

    # Specificity = TN / (TN + FP)
    tn = cm[0][0]
    fp = cm[0][1]
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0

    # Feature importances
    importances = {
        name: round(float(imp), 4)
        for name, imp in zip(FEATURE_NAMES, clf.feature_importances_)
    }
    # Sort by importance descending
    sorted_importances = dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))

    metadata = {
        "model_name": "Random Forest Seizure Classifier",
        "algorithm": "RandomForestClassifier",
        "version": "1.0.0",
        "features": FEATURE_NAMES,
        "n_estimators": 100,
        "metrics": {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall_sensitivity": round(rec, 4),
            "specificity": round(specificity, 4),
            "f1_score": round(f1, 4),
            "confusion_matrix": cm,
            "train_samples": len(X_train),
            "test_samples": len(X_test)
        },
        "feature_importances": sorted_importances,
        "sampling_rate": Config.SAMPLING_RATE,
        "window_duration_sec": Config.WINDOW_DURATION_SEC,
        "trained_at": "2026-10-11T14:30:00Z"
    }

    # Save artifacts
    model_path = output_dir / "random_forest_seizure_detector.joblib"
    meta_path = output_dir / "model_metadata.json"
    feat_path = output_dir / "feature_columns.json"

    joblib.dump(clf, model_path)
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    with open(feat_path, "w") as f:
        json.dump({"features": FEATURE_NAMES}, f, indent=2)

    logger.info(f"Model successfully saved to {model_path}")
    return metadata

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    res = train_and_evaluate_model()
    print("Training Complete. Metrics:")
    print(json.dumps(res["metrics"], indent=2))
