from flask import Blueprint, request, jsonify
from backend.middleware.auth_middleware import require_auth
from backend.ml.predict import predictor
from backend.ml.train_model import train_and_evaluate_model

ml_bp = Blueprint("ml", __name__, url_prefix="/api/ml")

@ml_bp.route("/status", methods=["GET"])
@require_auth
def get_model_status():
    """Returns Machine Learning model readiness, version, and performance metrics."""
    status = predictor.get_status()
    return jsonify({"status": status})

@ml_bp.route("/train", methods=["POST"])
@require_auth
def train_model():
    """Triggers local Random Forest training pipeline and hot-reloads model."""
    try:
        metrics = train_and_evaluate_model()
        # Reload predictor with new model
        reloaded = predictor.load_model()
        return jsonify({
            "success": True,
            "message": "Random Forest model successfully trained and calibrated.",
            "metrics": metrics["metrics"],
            "featureImportances": metrics.get("feature_importances", {}),
            "reloaded": reloaded
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@ml_bp.route("/predict", methods=["POST"])
@require_auth
def direct_predict():
    """Executes on-demand inference on uploaded EEG sample array."""
    data = request.get_json() or {}
    samples = data.get("samples")
    if not samples or not isinstance(samples, list):
        return jsonify({"error": "List of EEG numerical samples is required."}), 400

    try:
        result = predictor.predict_window(samples)
        return jsonify({"success": True, "prediction": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
