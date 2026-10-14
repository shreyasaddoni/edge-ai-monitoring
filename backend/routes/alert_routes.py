import logging
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from backend.middleware.auth_middleware import require_auth
from backend.firebase.firebase_client import db_client
from backend.alerts.alert_service import alert_service
from backend.alerts.twilio_service import twilio_service

logger = logging.getLogger(__name__)

alert_bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")

@alert_bp.route("", methods=["GET"])
@require_auth
def list_alerts():
    """Lists alerts with optional filters."""
    patient_id = request.args.get("patientId")
    risk_filter = request.args.get("riskCategory")
    unack_only = request.args.get("unacknowledged", "false").lower() == "true"

    filters = []
    if patient_id:
        filters.append(("patientId", "==", patient_id))
    if risk_filter:
        filters.append(("riskCategory", "==", risk_filter))

    alerts = db_client.query_collection("alerts", filters=filters, order_by="createdAt", descending=True)

    if unack_only:
        alerts = [a for a in alerts if a.get("acknowledgedAt") is None]

    # HIPAA Isolation: Caretakers can only see alerts for their assigned dependent patient
    if request.user.get("role") == "Caretaker":
        user_email = (request.user.get("email") or "").lower().strip()
        user_name = (request.user.get("name") or "").lower().strip()
        user_phone = request.user.get("phone") or ""
        all_patients = db_client.query_collection("patients")
        my_patient_ids = {
            p.get("patientId") for p in all_patients
            if (user_email and (p.get("caretakerEmail") or "").lower() == user_email) or
               (user_phone and p.get("caretakerPhone") == user_phone) or
               (user_name and (user_name in (p.get("caretakerName") or "").lower() or (p.get("caretakerName") or "").lower() in user_name))
        }
        alerts = [a for a in alerts if a.get("patientId") in my_patient_ids]

    return jsonify({"alerts": alerts, "count": len(alerts)})

@alert_bp.route("/<alert_id>/acknowledge", methods=["POST"])
@require_auth
def acknowledge_alert(alert_id: str):
    """Marks an alert as reviewed and acknowledged by the physician."""
    user = request.user
    doctor_uid = user.get("uid", "unknown")
    doctor_name = user.get("name", "Attending Physician")

    try:
        updated = alert_service.acknowledge_alert(
            alert_id=alert_id,
            doctor_uid=doctor_uid,
            doctor_name=doctor_name
        )
        return jsonify({"success": True, "alert": updated})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@alert_bp.route("/<alert_id>/retry-notification", methods=["POST"])
@require_auth
def retry_notification(alert_id: str):
    """Retries sending SMS notification for an eligible failed alert."""
    try:
        res = alert_service.retry_failed_notification(alert_id)
        return jsonify({"success": True, "result": res})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@alert_bp.route("/clear-all", methods=["DELETE"])
@require_auth
def clear_all_alerts():
    """Clears all historical alert records and associated notification dispatches."""
    try:
        alerts = db_client.query_collection("alerts", limit=500)
        for a in alerts:
            a_id = a.get("alertId")
            if a_id:
                db_client.delete_document("alerts", a_id)

        notifs = db_client.query_collection("notifications", limit=500)
        for n in notifs:
            n_id = n.get("notificationId")
            if n_id:
                db_client.delete_document("notifications", n_id)

        return jsonify({"success": True, "message": "All alert records and notification logs cleared."})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@alert_bp.route("/<alert_id>", methods=["DELETE"])
@require_auth
def delete_alert(alert_id: str):
    """Deletes a specific alert record and its associated notifications."""
    try:
        alert = db_client.get_document("alerts", alert_id)
        if not alert:
            return jsonify({"error": "Alert record not found", "code": "NOT_FOUND"}), 404

        # Delete any linked notification
        notifs = db_client.query_collection("notifications", filters=[("alertId", "==", alert_id)])
        for n in notifs:
            n_id = n.get("notificationId")
            if n_id:
                db_client.delete_document("notifications", n_id)

        db_client.delete_document("alerts", alert_id)
        return jsonify({"success": True, "deletedAlertId": alert_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@alert_bp.route("/notifications", methods=["GET"])
@require_auth
def list_notifications():
    """Lists all SMS caretaker dispatch records."""
    patient_id = request.args.get("patientId")
    filters = []
    if patient_id:
        filters.append(("patientId", "==", patient_id))

    records = db_client.query_collection("notifications", filters=filters, order_by="createdAt", descending=True)
    return jsonify({"notifications": records, "count": len(records)})

@alert_bp.route("/test-sms", methods=["POST"])
@require_auth
def send_test_sms():
    """
    Explicit controlled test SMS action.
    Requires user confirmation of destination number before sending.
    Will never send automatically without explicit initiation.
    """
    data = request.get_json() or {}
    phone_number = data.get("phoneNumber", "").strip()
    confirmed = data.get("confirmed", False)

    if not confirmed:
        return jsonify({
            "error": "Explicit user confirmation is required to prevent accidental Twilio SMS charges.",
            "code": "CONFIRMATION_REQUIRED"
        }), 400

    if not phone_number:
        return jsonify({"error": "Phone number is required."}), 400

    is_valid, formatted_phone, err_msg = twilio_service.validate_phone_number(phone_number)
    if not is_valid:
        return jsonify({"error": err_msg}), 400

    test_message = f"Epilepsy Monitoring System: Test SMS alert dispatched at {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}. System connectivity verified."

    result = twilio_service.send_sms(
        recipient_phone=formatted_phone,
        message_body=test_message,
        patient_id="TEST_VERIFICATION"
    )

    return jsonify({
        "success": result.get("success", False),
        "result": result,
        "recipient": twilio_service.mask_phone(formatted_phone)
    })

@alert_bp.route("/twilio-callback", methods=["POST"])
def twilio_delivery_callback():
    """
    Webhook receiver for Twilio SMS delivery status updates.
    Updates deliveryStatus in database when Twilio reports sent, delivered, or failed.
    """
    sid = request.form.get("MessageSid") or request.json.get("MessageSid") if request.is_json else None
    status = request.form.get("MessageStatus") or request.json.get("MessageStatus") if request.is_json else None
    error_code = request.form.get("ErrorCode")

    if not sid:
        return jsonify({"error": "Missing MessageSid"}), 400

    logger.info(f"Received Twilio Status Callback for {sid}: status={status}, error={error_code}")

    # Find notification record
    notifs = db_client.query_collection("notifications", filters=[("twilioMessageSid", "==", sid)], limit=1)
    if notifs:
        notif = notifs[0]
        notif_id = notif.get("notificationId")
        now_iso = datetime.now(timezone.utc).isoformat()

        update_dict = {
            "deliveryStatus": status,
            "updatedAt": now_iso
        }
        if status == "delivered":
            update_dict["deliveredAt"] = now_iso
        if error_code:
            update_dict["failureCode"] = error_code

        db_client.set_document("notifications", notif_id, update_dict, merge=True)

        # Also update parent alert
        alert_id = notif.get("alertId")
        if alert_id:
            db_client.set_document("alerts", alert_id, {"notificationStatus": status}, merge=True)

    return "<Response></Response>", 200, {"Content-Type": "application/xml"}
