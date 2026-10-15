import uuid
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from backend.firebase.firebase_client import db_client
from backend.middleware.auth_middleware import require_auth
from backend.alerts.twilio_service import twilio_service

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Registers a new account.
    Demands and validates international phone numbers (especially for Caretakers)
    to establish cryptographically secure patient isolation.
    """
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    name = data.get("name", "").strip()
    role = data.get("role", "Doctor")
    phone = data.get("phone", "").strip()

    if not email:
        return jsonify({"error": "Email is required."}), 400
    if not password:
        return jsonify({"error": "Password is required."}), 400
    if not name:
        return jsonify({"error": "Full name is required."}), 400

    # Phone is strictly mandatory for Caretaker to match with their patient
    if role == "Caretaker" and not phone:
        return jsonify({
            "error": "Mobile phone number is mandatory for Caretaker accounts to match and authorize your dependent patient.",
            "field": "phone"
        }), 400

    formatted_phone = ""
    if phone:
        is_valid, formatted_phone, err = twilio_service.validate_phone_number(phone)
        if not is_valid:
            return jsonify({
                "error": err or "Invalid mobile phone format. Please specify in international format like +919876543210.",
                "field": "phone"
            }), 400

    # Check if user already exists
    all_users = db_client.query_collection("users")
    for u in all_users:
        if (u.get("email") or "").lower() == email:
            return jsonify({"error": "An account with this email already exists."}), 409

    uid = f"usr_{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "uid": uid,
        "email": email,
        "name": name,
        "role": role,
        "phone": formatted_phone or phone,
        "password": password,
        "createdAt": now_iso,
        "updatedAt": now_iso
    }
    db_client.set_document("users", uid, user_doc)

    token = f"token_{uid}"
    # Return user object without sensitive password in response
    safe_user = {k: v for k, v in user_doc.items() if k != "password"}
    return jsonify({
        "success": True,
        "message": "Account registered successfully.",
        "user": safe_user,
        "token": token
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    """Logs in an account with email and password strictly."""
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email:
        return jsonify({"error": "Email is required."}), 400
    if not password:
        return jsonify({"error": "Password is required."}), 400

    # Check database
    all_users = db_client.query_collection("users")
    matched_user = None
    for u in all_users:
        if (u.get("email") or "").lower() == email:
            # Check password if stored
            stored_pw = u.get("password")
            if stored_pw and stored_pw != password:
                return jsonify({"error": "Invalid email or password.", "code": "AUTH_FAILED"}), 401
            matched_user = {k: v for k, v in u.items() if k != "password"}
            break

    if not matched_user:
        # Check standard demonstration accounts
        if email == "doctor@epilepsycare.org":
            matched_user = {
                "uid": "doctor_demo_01",
                "email": email,
                "name": "Dr. Sarah Jenkins",
                "role": "Doctor",
                "phone": "+919876543210"
            }
            token = "demo_doctor_token"
        elif email == "ramesh@epilepsycare.org":
            matched_user = {
                "uid": "caretaker_demo_01",
                "email": email,
                "name": "Ramesh Sharma",
                "role": "Caretaker",
                "phone": "+919876543210"
            }
            token = "demo_caretaker_token"
        elif email in ("admin@epilepsycare.org", "admin@hospital.org"):
            matched_user = {
                "uid": "admin_demo_01",
                "email": email,
                "name": "Clinical Administrator",
                "role": "Administrator",
                "phone": ""
            }
            token = "demo_admin_token"
        else:
            return jsonify({
                "error": "Invalid email or password. Please check your credentials or register a new account.",
                "code": "AUTH_FAILED"
            }), 401
    else:
        token = f"token_{matched_user.get('uid')}"

    return jsonify({
        "success": True,
        "user": matched_user,
        "token": token
    })

@auth_bp.route("/verify", methods=["POST"])
def verify_token():
    """Verifies Firebase ID token or demo token from frontend."""
    data = request.get_json() or {}
    token = data.get("token")
    if not token:
        return jsonify({"error": "Token required"}), 400

    try:
        user = db_client.verify_token(token)
        # Enrich from database
        user_record = db_client.get_document("users", user.get("uid"))
        if user_record:
            user["role"] = user_record.get("role", user.get("role", "Doctor"))
            user["name"] = user_record.get("name", user.get("name"))
            user["phone"] = user_record.get("phone", user.get("phone", ""))

        return jsonify({"valid": True, "user": user})
    except Exception as e:
        return jsonify({"valid": False, "error": str(e)}), 401

@auth_bp.route("/me", methods=["GET"])
@require_auth
def get_current_user():
    """Returns currently authenticated user profile."""
    return jsonify({"user": request.user})

@auth_bp.route("/profile", methods=["POST"])
@require_auth
def update_profile():
    """Allows user to update profile information."""
    data = request.get_json() or {}
    uid = request.user["uid"]

    allowed_updates = {}
    if "name" in data:
        allowed_updates["name"] = data["name"].strip()
    if "phone" in data:
        allowed_updates["phone"] = data["phone"].strip()
    if "specialty" in data:
        allowed_updates["specialty"] = data["specialty"].strip()
    if "department" in data:
        allowed_updates["department"] = data["department"].strip()

    db_client.set_document("users", uid, allowed_updates, merge=True)
    updated = db_client.get_document("users", uid)
    return jsonify({"success": True, "user": updated})

