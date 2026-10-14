from flask import Blueprint, request, jsonify
from backend.middleware.auth_middleware import require_auth, get_caretaker_patient_ids
from backend.firebase.firebase_client import db_client
from backend.alerts.twilio_service import twilio_service

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

@dashboard_bp.route("/stats", methods=["GET"])
@require_auth
def get_dashboard_stats():
    """
    Returns aggregated metrics for the Doctor Monitoring Dashboard:
    - Total patients, active monitoring sessions
    - Risk category distribution
    - Alert counts & SMS delivery metrics
    - Recent predictions trend
    Strictly isolated for Caretakers to their assigned dependent patient.
    """
    user = getattr(request, "user", {})
    user_role = user.get("role", "Doctor")

    patients = db_client.query_collection("patients")

    # HIPAA Isolation: Caretakers can only see metrics for their assigned dependent patient
    if user_role == "Caretaker":
        allowed_ids = get_caretaker_patient_ids(user)
        patients = [p for p in patients if p.get("patientId") in allowed_ids]

    total_patients = len(patients)

    from backend.simulator.playback_session import playback_manager
    active_playback_pids = {s.patient_id for s in playback_manager.sessions.values() if s.status == "running"}

    for p in patients:
        if p.get("patientId") in active_playback_pids:
            p["monitoringStatus"] = "active"

    active_monitored = sum(1 for p in patients if p.get("monitoringStatus") == "active")

    # Fetch alerts
    all_alerts = db_client.query_collection("alerts", order_by="createdAt", descending=True, limit=50)
    if user_role == "Caretaker":
        all_alerts = [a for a in all_alerts if a.get("patientId") in allowed_ids]

    unacknowledged_alerts = sum(1 for a in all_alerts if a.get("acknowledgedAt") is None)

    # Fetch notifications
    notifications = db_client.query_collection("notifications", limit=100)
    if user_role == "Caretaker":
        notifications = [n for n in notifications if n.get("patientId") in allowed_ids]

    sms_awaiting = sum(1 for n in notifications if n.get("deliveryStatus") in ["submitted", "queued", "sending"])
    sms_delivered = sum(1 for n in notifications if n.get("deliveryStatus") == "delivered")
    sms_failed = sum(1 for n in notifications if n.get("deliveryStatus") in ["failed", "undelivered"])

    # Recent predictions to compute patient risk distribution
    predictions = db_client.query_collection("predictions", order_by="timestamp", descending=True, limit=100)
    if user_role == "Caretaker":
        predictions = [pred for pred in predictions if pred.get("patientId") in allowed_ids]

    # Determine latest risk category per patient
    patient_latest_risk = {}
    for pred in predictions:
        pid = pred.get("patientId")
        if pid and pid not in patient_latest_risk:
            patient_latest_risk[pid] = pred.get("riskCategory", "Low")

    low_risk_count = sum(1 for r in patient_latest_risk.values() if r == "Low")
    med_risk_count = sum(1 for r in patient_latest_risk.values() if r == "Medium")
    high_risk_count = sum(1 for r in patient_latest_risk.values() if r == "High")

    # Remaining patients with no prediction default to Low or Unassessed
    unassessed = max(0, total_patients - len(patient_latest_risk))

    # Format recent alerts with masked phone
    recent_alerts_formatted = []
    for a in all_alerts[:8]:
        a_copy = dict(a)
        recent_alerts_formatted.append(a_copy)

    # Build trend data from predictions (last 25 predictions chronologically)
    trend_data = []
    chronological_preds = list(reversed(predictions[:25]))
    for p in chronological_preds:
        time_str = p.get("timestamp") or p.get("createdAt") or ""
        # Format label like HH:MM:SS
        label = time_str.split("T")[1][:8] if "T" in time_str else time_str
        if not label:
            label = "Live"
        trend_data.append({
            "time": label,
            "patientId": p.get("patientId"),
            "probability": round(p.get("modelProbability", 0.0) * 100, 1),
            "riskCategory": p.get("riskCategory", "Low")
        })

    return jsonify({
        "summary": {
            "totalPatients": total_patients,
            "activeMonitoring": active_monitored,
            "lowRiskPatients": low_risk_count + unassessed,
            "mediumRiskPatients": med_risk_count,
            "highRiskPatients": high_risk_count,
            "unacknowledgedAlerts": unacknowledged_alerts,
            "smsAwaitingStatus": sms_awaiting,
            "smsDelivered": sms_delivered,
            "smsFailed": sms_failed
        },
        "riskDistribution": [
            {"name": "Low Risk (<40%)", "value": low_risk_count + unassessed, "color": "#10B981"},
            {"name": "Medium Risk (40-70%)", "value": med_risk_count, "color": "#F59E0B"},
            {"name": "High Risk (≥70%)", "value": high_risk_count, "color": "#EF4444"}
        ],
        "recentAlerts": recent_alerts_formatted,
        "predictionTrends": trend_data,
        "twilioStatus": twilio_service.get_status()
    })
