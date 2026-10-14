import uuid
import logging
from datetime import datetime, timezone
from backend.config import Config
from backend.firebase.firebase_client import db_client
from backend.alerts.twilio_service import twilio_service

logger = logging.getLogger(__name__)

class AlertService:
    """
    Alert and Notification Management Service.
    Handles risk threshold evaluation, alert cooldown, caretaker SMS dispatch,
    acknowledgement workflows, and delivery retry tracking.
    """

    def __init__(self):
        self.cooldown_seconds = Config.ALERT_COOLDOWN_SECONDS

    def evaluate_and_create_alert(
        self,
        patient_id: str,
        prediction_result: dict,
        session_id: str | None = None
    ) -> dict:
        """
        Evaluates model output for qualifying high-risk criteria.
        Checks cooldown to prevent message storm.
        Dispatches SMS to registered caretaker if consented.
        """
        risk_category = prediction_result.get("riskCategory", "Low")
        model_prob = prediction_result.get("modelProbability", 0.0)

        # Only High risk qualifies for immediate emergency alert
        if risk_category != "High":
            return {
                "alertCreated": False,
                "reason": f"Risk category '{risk_category}' below alert threshold ({int(Config.RISK_HIGH_MIN*100)}%)."
            }

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        # Cooldown & Deduplication check
        recent_alerts = db_client.query_collection(
            "alerts",
            filters=[("patientId", "==", patient_id)],
            order_by="createdAt",
            descending=True,
            limit=1
        )

        if recent_alerts:
            last_alert = recent_alerts[0]
            last_time_str = last_alert.get("createdAt")
            if last_time_str:
                try:
                    last_time = datetime.fromisoformat(last_time_str)
                    elapsed = (now - last_time).total_seconds()
                    if elapsed < self.cooldown_seconds:
                        remaining = int(self.cooldown_seconds - elapsed)
                        logger.info(f"Alert suppressed for patient {patient_id}. Cooldown active ({remaining}s left).")
                        return {
                            "alertCreated": False,
                            "cooldownActive": True,
                            "remainingCooldownSec": remaining,
                            "reason": f"Alert cooldown active for {remaining} seconds to prevent duplicate spam."
                        }
                except Exception as e:
                    logger.warning(f"Error parsing last alert time: {e}")

        # Fetch patient and caretaker information
        patient = db_client.get_document("patients", patient_id) or {}
        patient_name = patient.get("name", patient_id)
        caretaker_phone = patient.get("caretakerPhone")
        caretaker_name = patient.get("caretakerName", "Caretaker")
        caretaker_consent = patient.get("caretakerSmsConsent", False)

        alert_id = f"alt_{uuid.uuid4().hex[:8]}"
        notification_id = f"notif_{uuid.uuid4().hex[:8]}"

        # SMS Dispatch
        sms_result = None
        notification_status = "none"

        if caretaker_phone and caretaker_consent:
            sms_body = twilio_service.format_alert_message(
                patient_name=patient_name,
                patient_id=patient_id,
                timestamp_str=now.strftime("%Y-%m-%d %H:%M:%S UTC")
            )

            sms_result = twilio_service.send_sms(
                recipient_phone=caretaker_phone,
                message_body=sms_body,
                patient_id=patient_id,
                alert_id=alert_id
            )

            notification_status = sms_result.get("deliveryStatus", "submitted")

            # Store notification record
            notif_doc = {
                "notificationId": notification_id,
                "alertId": alert_id,
                "patientId": patient_id,
                "caretakerName": caretaker_name,
                "recipientPhoneMasked": twilio_service.mask_phone(caretaker_phone),
                "recipientConsentStatus": caretaker_consent,
                "channel": "SMS",
                "twilioMessageSid": sms_result.get("twilioMessageSid"),
                "submissionStatus": sms_result.get("submissionStatus"),
                "deliveryStatus": sms_result.get("deliveryStatus"),
                "failureCode": sms_result.get("failureCode"),
                "safeErrorDescription": sms_result.get("safeErrorDescription"),
                "retryCount": 0,
                "simulated": sms_result.get("simulated", False),
                "createdAt": now_iso,
                "updatedAt": now_iso
            }
            db_client.set_document("notifications", notification_id, notif_doc)
        elif not caretaker_consent:
            notification_status = "consent_not_granted"
            logger.info(f"SMS suppressed for patient {patient_id}: Caretaker SMS consent not granted.")
        else:
            notification_status = "no_caretaker_contact"
            logger.info(f"SMS suppressed for patient {patient_id}: No caretaker phone on file.")

        # Store alert document
        alert_doc = {
            "alertId": alert_id,
            "patientId": patient_id,
            "patientName": patient_name,
            "predictionId": prediction_result.get("predictionId"),
            "sessionId": session_id,
            "riskCategory": risk_category,
            "modelOutput": model_prob,
            "createdAt": now_iso,
            "acknowledgedAt": None,
            "acknowledgedBy": None,
            "notificationStatus": notification_status,
            "notificationId": notification_id if caretaker_phone else None,
            "caretakerName": caretaker_name
        }
        db_client.set_document("alerts", alert_id, alert_doc)

        logger.info(f"High-risk alert {alert_id} generated for patient {patient_id}. SMS status: {notification_status}")
        return {
            "alertCreated": True,
            "alertId": alert_id,
            "riskCategory": risk_category,
            "notificationStatus": notification_status,
            "smsResult": sms_result
        }

    def acknowledge_alert(self, alert_id: str, doctor_uid: str, doctor_name: str) -> dict:
        """Marks an alert as acknowledged by a physician."""
        alert = db_client.get_document("alerts", alert_id)
        if not alert:
            raise ValueError(f"Alert {alert_id} not found.")

        now_iso = datetime.now(timezone.utc).isoformat()
        update_data = {
            "acknowledgedAt": now_iso,
            "acknowledgedBy": {
                "uid": doctor_uid,
                "name": doctor_name
            }
        }
        db_client.set_document("alerts", alert_id, update_data, merge=True)
        return {**alert, **update_data}

    def retry_failed_notification(self, alert_id: str) -> dict:
        """
        Retries SMS dispatch for an eligible failed notification with backoff/retry limit enforcement.
        """
        alert = db_client.get_document("alerts", alert_id)
        if not alert:
            raise ValueError(f"Alert {alert_id} not found.")

        notif_id = alert.get("notificationId")
        if not notif_id:
            raise ValueError("No notification record associated with this alert.")

        notif = db_client.get_document("notifications", notif_id)
        if not notif:
            raise ValueError("Notification record not found.")

        if notif.get("retryCount", 0) >= Config.MAX_NOTIFICATION_RETRIES:
            raise ValueError(f"Maximum retry limit ({Config.MAX_NOTIFICATION_RETRIES}) exceeded for this alert.")

        patient = db_client.get_document("patients", alert.get("patientId"))
        if not patient or not patient.get("caretakerPhone"):
            raise ValueError("Patient caretaker phone number missing.")

        # Re-send
        sms_body = twilio_service.format_alert_message(
            patient_name=patient.get("name", alert.get("patientId")),
            patient_id=alert.get("patientId"),
            timestamp_str=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        )

        res = twilio_service.send_sms(
            recipient_phone=patient.get("caretakerPhone"),
            message_body=sms_body,
            patient_id=alert.get("patientId"),
            alert_id=alert_id
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        retry_update = {
            "retryCount": notif.get("retryCount", 0) + 1,
            "submissionStatus": res.get("submissionStatus"),
            "deliveryStatus": res.get("deliveryStatus"),
            "twilioMessageSid": res.get("twilioMessageSid"),
            "failureCode": res.get("failureCode"),
            "safeErrorDescription": res.get("safeErrorDescription"),
            "updatedAt": now_iso
        }
        db_client.set_document("notifications", notif_id, retry_update, merge=True)
        db_client.set_document("alerts", alert_id, {"notificationStatus": res.get("deliveryStatus")}, merge=True)

        return {
            "success": res.get("success", False),
            "alertId": alert_id,
            "retryCount": retry_update["retryCount"],
            "deliveryStatus": res.get("deliveryStatus")
        }

# Global service instance
alert_service = AlertService()
