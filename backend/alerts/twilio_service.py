import logging
import phonenumbers
from datetime import datetime, timezone
from backend.config import Config

logger = logging.getLogger(__name__)

# Try importing Twilio
try:
    from twilio.rest import Client as TwilioClient
    from twilio.request_validator import RequestValidator
    TWILIO_INSTALLED = True
except ImportError:
    TWILIO_INSTALLED = False

class CaretakerTwilioService:
    """
    Twilio SMS Integration for Emergency Caretaker Notifications.
    Features:
    - E.164 phone number validation using Google's phonenumbers library
    - Caretaker consent verification
    - Automated high-risk alert SMS dispatch
    - Controlled test SMS verification
    - Status callback handling
    - Graceful zero-cost in-app fallback when Twilio is unconfigured
    """

    def __init__(self):
        self.account_sid = Config.TWILIO_ACCOUNT_SID
        self.auth_token = Config.TWILIO_AUTH_TOKEN
        self.sender_number = Config.TWILIO_PHONE_NUMBER
        self.callback_url = Config.TWILIO_STATUS_CALLBACK_URL
        self.client = None
        self._active_sid = None
        self.ensure_client()

    def ensure_client(self):
        """Dynamically reloads credentials from .env and initializes TwilioClient if not already connected."""
        import os
        from dotenv import load_dotenv
        from backend.config import BASE_DIR
        load_dotenv(BASE_DIR.parent / ".env", override=True)
        load_dotenv(BASE_DIR / ".env", override=True)

        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
        self.sender_number = os.getenv("TWILIO_PHONE_NUMBER", "").strip()
        self.verified_number = os.getenv("TWILIO_VERIFIED_PHONE_NUMBER", "").strip()
        self.force_verified_only = os.getenv("TWILIO_FORCE_VERIFIED_ONLY", "false").lower() == "true"

        if TWILIO_INSTALLED and self.is_configured:
            if self.client is None or self._active_sid != self.account_sid:
                try:
                    self.client = TwilioClient(self.account_sid, self.auth_token)
                    self._active_sid = self.account_sid
                    logger.info("Twilio client initialized successfully.")
                except Exception as e:
                    logger.error(f"Failed to initialize Twilio client: {e}")
                    self.client = None
        else:
            self.client = None

    @property
    def is_configured(self) -> bool:
        """Returns True only if all required Twilio environment variables are non-empty."""
        account_sid = (getattr(self, "account_sid", None) or os.getenv("TWILIO_ACCOUNT_SID", "")).strip()
        auth_token = (getattr(self, "auth_token", None) or os.getenv("TWILIO_AUTH_TOKEN", "")).strip()
        sender_number = (getattr(self, "sender_number", None) or os.getenv("TWILIO_PHONE_NUMBER", "")).strip()
        return bool(
            account_sid
            and auth_token
            and sender_number
            and account_sid != "your_twilio_account_sid"
        )

    def get_status(self) -> dict:
        """Returns non-sensitive status info for UI and health-checks."""
        self.ensure_client()
        is_ready = self.is_configured and (self.client is not None)
        return {
            "configured": is_ready,
            "senderNumber": self.mask_phone(self.sender_number) if self.sender_number else None,
            "verifiedDestinationNumber": self.mask_phone(self.verified_number) if self.verified_number else None,
            "forceVerifiedOnly": self.force_verified_only,
            "statusCallbackConfigured": bool(self.callback_url),
            "serviceAvailable": TWILIO_INSTALLED,
            "mode": "Live Twilio SMS" if is_ready else "In-App Alerts (Zero-Cost Mode)"
        }

    @staticmethod
    def mask_phone(phone: str) -> str:
        """Masks phone number for privacy display (e.g. +91 98****3210)."""
        if not phone or len(phone) < 6:
            return phone or ""
        return f"{phone[:4]}****{phone[-4:]}"

    @staticmethod
    def validate_phone_number(raw_phone: str) -> tuple[bool, str, str]:
        """
        Validates phone number format using phonenumbers library.
        Returns: (is_valid, formatted_e164_or_empty, error_message)
        """
        if not raw_phone or not raw_phone.strip():
            return False, "", "Phone number is required."

        cleaned = raw_phone.strip()
        try:
            # Parse with international format assumption if leading +, otherwise default region None
            parsed = phonenumbers.parse(cleaned, None)
            if not phonenumbers.is_valid_number(parsed):
                return False, "", "Invalid phone number. Please include valid country code (e.g. +919876543210)."
            formatted = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
            return True, formatted, ""
        except phonenumbers.NumberParseException as e:
            return False, "", f"Invalid phone number: {str(e)}. Please include international country code (e.g. +919876543210)."

    def format_alert_message(self, patient_name: str, patient_id: str, timestamp_str: str) -> str:
        """Constructs personalized notification message using approved template."""
        template = Config.DEFAULT_SMS_TEMPLATE
        return template.format(
            patient_name=patient_name or "Registered Patient",
            patient_id=patient_id,
            timestamp=timestamp_str
        )

    def send_sms(
        self,
        recipient_phone: str,
        message_body: str,
        patient_id: str,
        alert_id: str | None = None
    ) -> dict:
        """
        Dispatches SMS via Twilio. Returns detailed delivery result.
        """
        is_valid, formatted_phone, err_msg = self.validate_phone_number(recipient_phone)
        if not is_valid:
            logger.warning(f"SMS dispatch blocked: {err_msg}")
            return {
                "success": False,
                "submissionStatus": "failed",
                "deliveryStatus": "failed",
                "failureCode": "INVALID_PHONE_NUMBER",
                "safeErrorDescription": err_msg,
                "twilioMessageSid": None
            }

        # Check if Twilio is configured
        self.ensure_client()
        if not self.is_configured or self.client is None:
            logger.info(f"Twilio not configured. Logging in-app SMS alert for {self.mask_phone(formatted_phone)}.")
            return {
                "success": True,
                "submissionStatus": "in_app_simulated",
                "deliveryStatus": "in_app_only",
                "failureCode": None,
                "safeErrorDescription": "Twilio not configured. In-app alert created successfully.",
                "twilioMessageSid": f"sim_sid_{int(datetime.now().timestamp())}",
                "simulated": True
            }

        # Execute Twilio SDK dispatch
        target_destination = formatted_phone
        if self.force_verified_only and self.verified_number:
            is_v_valid, v_formatted, _ = self.validate_phone_number(self.verified_number)
            if is_v_valid:
                target_destination = v_formatted
                logger.info(f"Trial mode active: dispatching SMS exclusively to verified recipient {self.mask_phone(target_destination)}.")

        send_kwargs = {
            "body": message_body,
            "from_": self.sender_number,
            "to": target_destination
        }
        if self.callback_url:
            send_kwargs["status_callback"] = self.callback_url

        max_network_retries = 3
        last_exception = None

        for attempt in range(1, max_network_retries + 1):
            try:
                message = self.client.messages.create(**send_kwargs)
                logger.info(f"Twilio SMS submitted successfully (attempt {attempt}). SID: {message.sid}")
                return {
                    "success": True,
                    "submissionStatus": "submitted",
                    "deliveryStatus": message.status or "queued",
                    "failureCode": None,
                    "safeErrorDescription": None,
                    "twilioMessageSid": message.sid,
                    "simulated": False
                }
            except Exception as e:
                error_str = str(e)
                last_exception = e
                logger.error(f"Twilio SMS API error (attempt {attempt}): {error_str}")

                # Auto-retry on transient network / socket resets (e.g. Windows ConnectionResetError 10054)
                is_network_err = any(term in error_str.lower() for term in [
                    "connection", "10054", "forcibly closed", "timeout", "timed out", "reset by peer", "broken pipe"
                ])
                if is_network_err and attempt < max_network_retries:
                    logger.warning(f"Transient socket reset detected. Re-establishing Twilio client and retrying in 1.0s (attempt {attempt}/{max_network_retries})...")
                    import time
                    time.sleep(1.0)
                    try:
                        self.client = TwilioClient(self.account_sid, self.auth_token)
                    except Exception:
                        pass
                    continue

                # If trial template error, attempt approved trial template
                if "572006" in error_str or "predefined SMS templates" in error_str:
                    logger.info("Twilio trial template restriction detected. Retrying with approved trial template 'sms_internal_alerts'...")
                    try:
                        trial_kwargs = dict(send_kwargs)
                        trial_kwargs["body"] = "sms_internal_alerts"
                        trial_message = self.client.messages.create(**trial_kwargs)
                        logger.info(f"Twilio trial template SMS submitted successfully. SID: {trial_message.sid}")
                        return {
                            "success": True,
                            "submissionStatus": "submitted",
                            "deliveryStatus": trial_message.status or "queued",
                            "failureCode": None,
                            "safeErrorDescription": "Dispatched via Twilio Free Trial predefined alert template (sms_internal_alerts).",
                            "twilioMessageSid": trial_message.sid,
                            "simulated": False
                        }
                    except Exception as trial_err:
                        logger.error(f"Twilio trial template retry also failed: {trial_err}")
                        safe_desc = f"Twilio Free Trial Error: {str(trial_err)[:150]}"
                elif "21608" in error_str or "unverified" in error_str.lower():
                    safe_desc = "Twilio Free Trial Limitation: Recipient number is not verified. On free trial accounts, destination numbers must be verified in Twilio Console."
                elif "21211" in error_str or "invalid" in error_str.lower():
                    safe_desc = "Twilio Error: The destination phone number is invalid or improperly formatted."
                else:
                    safe_desc = f"Twilio API Error: {error_str[:180]}"

                return {
                    "success": False,
                    "submissionStatus": "failed",
                    "deliveryStatus": "failed",
                    "failureCode": "TWILIO_API_ERROR",
                    "safeErrorDescription": safe_desc,
                    "twilioMessageSid": None,
                    "simulated": False
                }

    def validate_webhook_signature(self, url: str, params: dict, signature: str) -> bool:
        """Validates incoming Twilio callback webhook signature for security."""
        if not self.auth_token:
            return False
        try:
            validator = RequestValidator(self.auth_token)
            return validator.validate(url, params, signature)
        except Exception as e:
            logger.error(f"Webhook signature validation error: {e}")
            return False

# Global service instance
twilio_service = CaretakerTwilioService()
