import uuid
import logging
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from backend.firebase.firebase_client import db_client
from backend.middleware.auth_middleware import require_auth, get_caretaker_patient_ids
from backend.alerts.twilio_service import twilio_service

logger = logging.getLogger(__name__)

patient_bp = Blueprint("patients", __name__, url_prefix="/api/patients")
MAX_DISCHARGED_RECORDS = 10


@patient_bp.route("", methods=["GET"])
@require_auth
def list_patients():
    """Lists registered patients with role-based visibility and search."""
    search_query = request.args.get("search", "").strip().lower()
    risk_filter = request.args.get("riskCategory")
    monitoring_filter = request.args.get("monitoringStatus")

    user_role = request.user.get("role", "Doctor")

    patients = db_client.query_collection("patients", order_by="createdAt", descending=True)

    # HIPAA Isolation: Caretakers can strictly ONLY view their assigned patient
    if user_role == "Caretaker":
        allowed_ids = get_caretaker_patient_ids(request.user)
        patients = [p for p in patients if p.get("patientId") in allowed_ids]

    # Doctors and Admins see all assigned patients or clinic cohort
    # Filter

    results = []
    for p in patients:
        # Search match
        if search_query:
            name_match = search_query in p.get("name", "").lower()
            id_match = search_query in p.get("patientId", "").lower()
            if not (name_match or id_match):
                continue

        if monitoring_filter and p.get("monitoringStatus") != monitoring_filter:
            continue

        # Mask caretaker phone in list view for privacy
        p_copy = dict(p)
        if p_copy.get("caretakerPhone"):
            p_copy["caretakerPhoneMasked"] = twilio_service.mask_phone(p_copy["caretakerPhone"])

        results.append(p_copy)

    return jsonify({"patients": results, "count": len(results)})

@patient_bp.route("", methods=["POST"])
@require_auth
def register_patient():
    """
    Registers a new patient with mandatory caretaker contact and verified SMS consent.
    Performs E.164 phone number validation using Google's phonenumbers library.
    """
    data = request.get_json() or {}

    if request.user.get("role") == "Caretaker":
        return jsonify({"error": "Access denied. Only clinicians can register patients.", "code": "FORBIDDEN"}), 403

    # Basic Patient Fields
    name = data.get("name", "").strip()
    age = data.get("age")
    assigned_doctor_id = data.get("assignedDoctorId") or request.user.get("uid")
    gender = data.get("gender", "Not specified")
    clinical_notes = data.get("clinicalNotes", "").strip()

    if not name:
        return jsonify({"error": "Patient full name is required.", "field": "name"}), 400

    # MANDATORY Caretaker Information
    caretaker_name = data.get("caretakerName", "").strip()
    caretaker_phone_raw = data.get("caretakerPhone", "").strip()
    caretaker_relationship = data.get("caretakerRelationship", "").strip()
    caretaker_consent = data.get("caretakerSmsConsent", False)

    if not caretaker_name:
        return jsonify({"error": "Caretaker full name is mandatory.", "field": "caretakerName"}), 400

    if not caretaker_phone_raw:
        return jsonify({"error": "Caretaker mobile number is mandatory.", "field": "caretakerPhone"}), 400

    # Validate phone number via phonenumbers library (E.164 required)
    is_valid, formatted_e164, err_msg = twilio_service.validate_phone_number(caretaker_phone_raw)
    if not is_valid:
        return jsonify({
            "error": err_msg or "Invalid mobile number. Please specify in international format like +919876543210.",
            "field": "caretakerPhone"
        }), 400

    if not caretaker_relationship:
        return jsonify({"error": "Caretaker relationship to patient is mandatory.", "field": "caretakerRelationship"}), 400

    if not caretaker_consent:
        return jsonify({
            "error": "Explicit caretaker SMS consent confirmation is required before registration.",
            "field": "caretakerSmsConsent"
        }), 400

    now_iso = datetime.now(timezone.utc).isoformat()
    patient_id = data.get("patientId") or f"PAT-{uuid.uuid4().hex[:6].upper()}"

    # Check for duplicate patient ID
    if db_client.get_document("patients", patient_id):
        return jsonify({"error": f"Patient with ID {patient_id} already exists."}), 409

    doctor_info = db_client.get_document("users", assigned_doctor_id) or {}

    patient_doc = {
        "patientId": patient_id,
        "name": name,
        "age": int(age) if age is not None and str(age).isdigit() else None,
        "gender": gender,
        "assignedDoctorId": assigned_doctor_id,
        "assignedDoctorName": doctor_info.get("name", request.user.get("name", "Assigned Doctor")),
        "monitoringStatus": "inactive",
        "clinicalNotes": clinical_notes,

        # Caretaker Fields
        "caretakerName": caretaker_name,
        "caretakerPhone": formatted_e164,
        "caretakerRelationship": caretaker_relationship,
        "caretakerSmsConsent": True,
        "caretakerConsentTimestamp": now_iso,
        "caretakerContactUpdatedAt": now_iso,

        "createdAt": now_iso,
        "updatedAt": now_iso
    }

    db_client.set_document("patients", patient_id, patient_doc)

    return jsonify({
        "success": True,
        "message": "Patient and caretaker registered successfully.",
        "patient": patient_doc
    }), 201

@patient_bp.route("/<patient_id>", methods=["GET"])
@require_auth
def get_patient(patient_id: str):
    """Retrieves full details for a patient."""
    patient = db_client.get_document("patients", patient_id)
    if not patient:
        return jsonify({"error": f"Patient {patient_id} not found."}), 404

    # HIPAA Isolation: Caretakers can strictly only view their assigned dependent
    if request.user.get("role") == "Caretaker":
        allowed_ids = get_caretaker_patient_ids(request.user)
        if patient_id not in allowed_ids:
            return jsonify({
                "error": "Access denied. Caretakers can only access records for their designated dependent patient.",
                "code": "FORBIDDEN"
            }), 403


    # Mask phone only if requested or if caller not authorized
    p_data = dict(patient)
    p_data["caretakerPhoneMasked"] = twilio_service.mask_phone(p_data.get("caretakerPhone", ""))

    # Fetch recent monitoring sessions & latest predictions
    recent_preds = db_client.query_collection(
        "predictions",
        filters=[("patientId", "==", patient_id)],
        order_by="timestamp",
        descending=True,
        limit=20
    )
    p_data["recentPredictions"] = recent_preds
    p_data["latestPrediction"] = recent_preds[0] if recent_preds else None

    # Fetch alerts for this patient
    alerts = db_client.query_collection(
        "alerts",
        filters=[("patientId", "==", patient_id)],
        order_by="createdAt",
        descending=True,
        limit=10
    )
    p_data["alerts"] = alerts

    return jsonify({"patient": p_data})

@patient_bp.route("/<patient_id>", methods=["PUT"])
@require_auth
def update_patient(patient_id: str):
    """Updates general patient information."""
    if request.user.get("role") == "Caretaker":
        return jsonify({"error": "Access denied. Caretakers cannot edit clinical patient records.", "code": "FORBIDDEN"}), 403

    patient = db_client.get_document("patients", patient_id)
    if not patient:
        return jsonify({"error": f"Patient {patient_id} not found."}), 404

    data = request.get_json() or {}
    allowed_updates = {}
    if "name" in data and data["name"].strip():
        allowed_updates["name"] = data["name"].strip()
    if "age" in data and data["age"] is not None:
        allowed_updates["age"] = int(data["age"])
    if "clinicalNotes" in data:
        allowed_updates["clinicalNotes"] = data["clinicalNotes"].strip()
    if "assignedDoctorId" in data:
        allowed_updates["assignedDoctorId"] = data["assignedDoctorId"]

    db_client.set_document("patients", patient_id, allowed_updates, merge=True)
    updated = db_client.get_document("patients", patient_id)
    return jsonify({"success": True, "patient": updated})

@patient_bp.route("/<patient_id>/caretaker", methods=["PUT"])
@require_auth
def update_caretaker_contact(patient_id: str):
    """Updates caretaker contact information and SMS consent."""
    if request.user.get("role") == "Caretaker":
        allowed_ids = get_caretaker_patient_ids(request.user)
        if patient_id not in allowed_ids:
            return jsonify({"error": "Access denied. Caretakers can only update contact information for their designated dependent patient.", "code": "FORBIDDEN"}), 403

    patient = db_client.get_document("patients", patient_id)
    if not patient:
        return jsonify({"error": f"Patient {patient_id} not found."}), 404

    data = request.get_json() or {}
    caretaker_name = data.get("caretakerName", "").strip()
    caretaker_phone = data.get("caretakerPhone", "").strip()
    caretaker_rel = data.get("caretakerRelationship", "").strip()
    caretaker_consent = data.get("caretakerSmsConsent")

    updates = {}
    if caretaker_name:
        updates["caretakerName"] = caretaker_name
    if caretaker_rel:
        updates["caretakerRelationship"] = caretaker_rel

    if caretaker_phone:
        is_valid, formatted_e164, err_msg = twilio_service.validate_phone_number(caretaker_phone)
        if not is_valid:
            return jsonify({"error": err_msg}), 400
        updates["caretakerPhone"] = formatted_e164

    if caretaker_consent is not None:
        updates["caretakerSmsConsent"] = bool(caretaker_consent)
        updates["caretakerConsentTimestamp"] = datetime.now(timezone.utc).isoformat()

    updates["caretakerContactUpdatedAt"] = datetime.now(timezone.utc).isoformat()
    db_client.set_document("patients", patient_id, updates, merge=True)

    updated = db_client.get_document("patients", patient_id)
    return jsonify({"success": True, "message": "Caretaker contact updated.", "patient": updated})

@patient_bp.route("/discharged", methods=["GET"])
@require_auth
def list_discharged_patients():
    """Lists discharged patients kept in history (strictly capped at latest 10)."""
    discharged = db_client.query_collection(
        "discharged_patients",
        order_by="dischargedAt",
        descending=True,
        limit=MAX_DISCHARGED_RECORDS
    )

    if request.user.get("role") == "Caretaker":
        allowed_ids = get_caretaker_patient_ids(request.user)
        discharged = [d for d in discharged if d.get("patientId") in allowed_ids]

    results = []
    for d in discharged:
        d_copy = dict(d)
        if d_copy.get("caretakerPhone"):
            d_copy["caretakerPhoneMasked"] = twilio_service.mask_phone(d_copy["caretakerPhone"])
        results.append(d_copy)
    return jsonify({
        "dischargedPatients": results,
        "count": len(results),
        "maxLimit": MAX_DISCHARGED_RECORDS
    })

@patient_bp.route("/discharged/<patient_id>", methods=["GET"])
@require_auth
def get_discharged_patient(patient_id: str):
    """Retrieves full details and historical analysis for a discharged patient."""
    if request.user.get("role") == "Caretaker":
        allowed_ids = get_caretaker_patient_ids(request.user)
        if patient_id not in allowed_ids:
            return jsonify({"error": "Access denied. Caretakers can only access records for their designated dependent patient.", "code": "FORBIDDEN"}), 403

    patient = db_client.get_document("discharged_patients", patient_id)
    if not patient:
        return jsonify({"error": f"Discharged patient record {patient_id} not found."}), 404
    p_data = dict(patient)
    p_data["caretakerPhoneMasked"] = twilio_service.mask_phone(p_data.get("caretakerPhone", ""))
    return jsonify({"patient": p_data})


@patient_bp.route("/discharged/<patient_id>/restore", methods=["POST"])
@require_auth
def restore_discharged_patient(patient_id: str):
    """Restores a discharged patient record back into the active patient registry."""
    if request.user.get("role") == "Caretaker":
        return jsonify({"error": "Access denied. Caretakers cannot restore patient records.", "code": "FORBIDDEN"}), 403

    discharged = db_client.get_document("discharged_patients", patient_id)
    if not discharged:
        return jsonify({"error": f"Discharged record {patient_id} not found."}), 404

    if db_client.get_document("patients", patient_id):
        return jsonify({"error": f"Patient {patient_id} is already in the active registry."}), 409

    now_iso = datetime.now(timezone.utc).isoformat()
    restored_patient = {
        "patientId": discharged.get("patientId"),
        "name": discharged.get("name"),
        "age": discharged.get("age"),
        "gender": discharged.get("gender"),
        "assignedDoctorId": discharged.get("assignedDoctorId") or request.user.get("uid"),
        "assignedDoctorName": discharged.get("assignedDoctorName") or request.user.get("name", "Assigned Doctor"),
        "monitoringStatus": "inactive",
        "clinicalNotes": discharged.get("clinicalNotes", ""),
        "caretakerName": discharged.get("caretakerName"),
        "caretakerPhone": discharged.get("caretakerPhone"),
        "caretakerRelationship": discharged.get("caretakerRelationship"),
        "caretakerSmsConsent": discharged.get("caretakerSmsConsent", True),
        "caretakerConsentTimestamp": discharged.get("caretakerConsentTimestamp", now_iso),
        "caretakerContactUpdatedAt": discharged.get("caretakerContactUpdatedAt", now_iso),
        "createdAt": discharged.get("admittedAt") or discharged.get("createdAt", now_iso),
        "updatedAt": now_iso
    }

    db_client.set_document("patients", patient_id, restored_patient)
    db_client.delete_document("discharged_patients", patient_id)

    return jsonify({
        "success": True,
        "message": f"Patient {discharged.get('name')} successfully restored to active registry.",
        "patient": restored_patient
    })

@patient_bp.route("/discharged/<patient_id>", methods=["DELETE"])
@require_auth
def delete_discharged_record(patient_id: str):
    """Permanently purges a specific discharged patient record from the archive."""
    if request.user.get("role") == "Caretaker":
        return jsonify({"error": "Access denied. Caretakers cannot purge patient records.", "code": "FORBIDDEN"}), 403

    discharged = db_client.get_document("discharged_patients", patient_id)
    if not discharged:
        return jsonify({"error": f"Discharged record {patient_id} not found."}), 404
    db_client.delete_document("discharged_patients", patient_id)
    return jsonify({"success": True, "message": f"Discharged record {patient_id} permanently removed."})


@patient_bp.route("/<patient_id>", methods=["DELETE"])
@require_auth
def delete_patient(patient_id: str):
    """
    Discharges/deletes a patient from the active registry.
    Preserves their full details, clinical notes, and EEG history in the discharged records.
    Enforces a strict FIFO retention policy of keeping strictly the latest 10 discharged patients
    to prevent database overflow.
    """
    if request.user.get("role") == "Caretaker":
        return jsonify({"error": "Access denied. Caretakers cannot discharge or delete patients.", "code": "FORBIDDEN"}), 403

    patient = db_client.get_document("patients", patient_id)
    if not patient:
        return jsonify({"error": f"Patient {patient_id} not found."}), 404

    # Stop and terminate any active streaming playback for this patient
    try:
        from backend.simulator.playback_session import playback_manager
        playback_manager.terminate_session_for_patient(patient_id)
    except Exception as e:
        logger.warning(f"Error stopping playback sessions for patient {patient_id}: {e}")

    req_data = request.get_json(silent=True) or {}
    discharge_reason = req_data.get("reason", "").strip() or "Standard Clinical Discharge / Care Completed"

    # Fetch predictions history to preserve in the discharged record
    predictions = db_client.query_collection(
        "predictions",
        filters=[("patientId", "==", patient_id)],
        order_by="timestamp",
        descending=True,
        limit=100
    )

    # Fetch alerts history
    alerts = db_client.query_collection(
        "alerts",
        filters=[("patientId", "==", patient_id)],
        order_by="createdAt",
        descending=True,
        limit=50
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    high_count = sum(1 for p in predictions if p.get("riskCategory") == "High")
    med_count = sum(1 for p in predictions if p.get("riskCategory") == "Medium")
    low_count = sum(1 for p in predictions if p.get("riskCategory") == "Low")

    # Build discharged archive record safely
    p_id = patient.get("patientId") or patient.get("id") or patient_id
    p_name = patient.get("name") or "Unnamed Patient"

    discharged_doc = {
        "patientId": p_id,
        "name": p_name,
        "age": patient.get("age"),
        "gender": patient.get("gender", "Not specified"),
        "assignedDoctorId": patient.get("assignedDoctorId"),
        "assignedDoctorName": patient.get("assignedDoctorName", "Attending Physician"),
        "clinicalNotes": patient.get("clinicalNotes", ""),
        "caretakerName": patient.get("caretakerName", "Unspecified Caretaker"),
        "caretakerPhone": patient.get("caretakerPhone", ""),
        "caretakerRelationship": patient.get("caretakerRelationship", "Family"),
        "caretakerSmsConsent": patient.get("caretakerSmsConsent", True),
        "admittedAt": patient.get("createdAt", now_iso),
        "dischargedAt": now_iso,
        "dischargeReason": discharge_reason,
        "dischargedBy": request.user.get("name", "Attending Doctor"),
        "totalPredictionsCount": len(predictions),
        "totalAlertsCount": len(alerts),
        "highRiskCount": high_count,
        "mediumRiskCount": med_count,
        "lowRiskCount": low_count,
        "latestPrediction": predictions[0] if predictions else None,
        "history": predictions,
        "alerts": alerts,
        "createdAt": patient.get("createdAt", now_iso),
        "updatedAt": now_iso
    }

    # Save to discharged_patients collection
    db_client.set_document("discharged_patients", p_id, discharged_doc)

    # Remove from active patients registry
    db_client.delete_document("patients", patient_id)
    if p_id != patient_id:
        db_client.delete_document("patients", p_id)

    # Strict FIFO pruning: Retain only the latest 10 discharged patients
    all_discharged = db_client.query_collection(
        "discharged_patients",
        order_by="dischargedAt",
        descending=True,
        limit=50
    )

    pruned_count = 0
    if len(all_discharged) > MAX_DISCHARGED_RECORDS:
        overflow_records = all_discharged[MAX_DISCHARGED_RECORDS:]
        for overflow in overflow_records:
            overflow_id = overflow.get("patientId")
            if overflow_id:
                db_client.delete_document("discharged_patients", overflow_id)
                pruned_count += 1
        logger.info(f"Pruned {pruned_count} older discharged patient records to maintain {MAX_DISCHARGED_RECORDS} limit.")

    return jsonify({
        "success": True,
        "message": f"Patient {p_name} discharged. Historical records preserved in Record tab (capped at latest {MAX_DISCHARGED_RECORDS}).",
        "patientId": p_id,
        "dischargedAt": now_iso,
        "retainedCount": min(len(all_discharged), MAX_DISCHARGED_RECORDS),
        "prunedCount": pruned_count
    })


