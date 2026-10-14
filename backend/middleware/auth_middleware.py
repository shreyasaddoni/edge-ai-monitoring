from functools import wraps
from flask import request, jsonify
import logging
from backend.firebase.firebase_client import db_client

logger = logging.getLogger(__name__)

def require_auth(f):
    """
    Decorator to enforce Firebase ID token verification.
    Expects header: Authorization: Bearer <token>
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        token = None
        if auth_header:
            parts = auth_header.split(" ")
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token = parts[1]
        elif request.args.get("token"):
            token = request.args.get("token")

        if not token:
            return jsonify({"error": "Authorization token missing", "code": "UNAUTHORIZED"}), 401
        try:
            decoded_user = db_client.verify_token(token)
            # Ensure user role is enriched
            user_record = db_client.get_document("users", decoded_user.get("uid"))
            if user_record:
                decoded_user["role"] = user_record.get("role", decoded_user.get("role", "Doctor"))
                decoded_user["name"] = user_record.get("name", decoded_user.get("name", "Medical Professional"))
                decoded_user["phone"] = user_record.get("phone", decoded_user.get("phone", ""))

            request.user = decoded_user
        except Exception as e:
            logger.warning(f"Authentication token rejection: {e}")
            return jsonify({"error": "Invalid or expired token", "details": str(e), "code": "INVALID_TOKEN"}), 401

        return f(*args, **kwargs)
    return decorated_function

def require_role(allowed_roles: list[str] | str):
    """
    Decorator to enforce role-based access control (Doctor, Administrator).
    """
    if isinstance(allowed_roles, str):
        allowed_roles = [allowed_roles]

    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            user = getattr(request, "user", None)
            if not user:
                return jsonify({"error": "User context missing", "code": "UNAUTHORIZED"}), 401

            user_role = user.get("role", "Doctor")
            if user_role not in allowed_roles:
                return jsonify({
                    "error": f"Access denied. Requires one of roles: {', '.join(allowed_roles)}",
                    "code": "FORBIDDEN",
                    "currentRole": user_role
                }), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def get_caretaker_patient_ids(user) -> set[str]:
    """
    Returns the set of patient IDs assigned to this caretaker.
    Matches by verified caretakerEmail, caretakerPhone, or caretakerName.
    """
    if not user or user.get("role") != "Caretaker":
        return set()

    user_email = (user.get("email") or "").lower().strip()
    user_name = (user.get("name") or "").lower().strip()
    user_phone = user.get("phone") or ""

    matched_ids = set()
    # Check active patients
    active_patients = db_client.query_collection("patients")
    for p in active_patients:
        c_name = (p.get("caretakerName") or "").lower()
        c_phone = p.get("caretakerPhone") or ""
        c_email = (p.get("caretakerEmail") or "").lower()
        if (user_email and c_email and user_email == c_email) or \
           (user_phone and c_phone and user_phone == c_phone) or \
           (user_name and (user_name in c_name or c_name in user_name)):
            if p.get("patientId"):
                matched_ids.add(p.get("patientId"))

    # Check discharged patient records
    discharged_patients = db_client.query_collection("discharged_patients")
    for p in discharged_patients:
        c_name = (p.get("caretakerName") or "").lower()
        c_phone = p.get("caretakerPhone") or ""
        c_email = (p.get("caretakerEmail") or "").lower()
        if (user_email and c_email and user_email == c_email) or \
           (user_phone and c_phone and user_phone == c_phone) or \
           (user_name and (user_name in c_name or c_name in user_name)):
            if p.get("patientId"):
                matched_ids.add(p.get("patientId"))

    return matched_ids


def is_caretaker_authorized_for_patient(user, patient_id: str) -> bool:
    """Returns True if user is non-caretaker (Doctor/Admin) OR assigned to this patient."""
    if not user:
        return False
    if user.get("role") != "Caretaker":
        return True
    allowed_ids = get_caretaker_patient_ids(user)
    return patient_id in allowed_ids

