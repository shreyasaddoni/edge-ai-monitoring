import io
import csv
from flask import Blueprint, request, jsonify, Response
from backend.middleware.auth_middleware import require_auth, get_caretaker_patient_ids
from backend.firebase.firebase_client import db_client

report_bp = Blueprint("reports", __name__, url_prefix="/api/reports")

@report_bp.route("/history", methods=["GET"])
@require_auth
def get_analysis_history():
    """Retrieves filtered historical EEG predictions."""
    patient_id = request.args.get("patientId")
    risk_filter = request.args.get("riskCategory")
    limit = int(request.args.get("limit", 100))

    # HIPAA Isolation: Caretakers can only see history for their assigned patient
    if request.user.get("role") == "Caretaker":
        my_patient_ids = get_caretaker_patient_ids(request.user)
        if patient_id and patient_id not in my_patient_ids:
            return jsonify({"error": "Access denied. You can only view records for your designated dependent patient.", "code": "FORBIDDEN"}), 403
        if not patient_id and len(my_patient_ids) == 1:
            patient_id = next(iter(my_patient_ids))

    filters = []
    if patient_id:
        filters.append(("patientId", "==", patient_id))
    if risk_filter:
        filters.append(("riskCategory", "==", risk_filter))

    preds = db_client.query_collection(
        "predictions",
        filters=filters,
        order_by="timestamp",
        descending=True,
        limit=limit
    )

    if request.user.get("role") == "Caretaker":
        my_patient_ids = get_caretaker_patient_ids(request.user)
        preds = [p for p in preds if p.get("patientId") in my_patient_ids]

    if patient_id and len(preds) == 0:
        discharged = db_client.get_document("discharged_patients", patient_id)
        if discharged and discharged.get("history"):
            preds = discharged.get("history", [])
            if risk_filter:
                preds = [p for p in preds if p.get("riskCategory") == risk_filter]
            preds = preds[:limit]

    return jsonify({"history": preds, "count": len(preds)})

@report_bp.route("/export-csv", methods=["GET"])
@require_auth
def export_csv():
    """Generates downloadable CSV report of historical analysis results."""
    patient_id = request.args.get("patientId")

    # HIPAA Isolation: Caretaker check
    if request.user.get("role") == "Caretaker":
        my_patient_ids = get_caretaker_patient_ids(request.user)
        if not patient_id:
            if len(my_patient_ids) == 1:
                patient_id = next(iter(my_patient_ids))
            else:
                return jsonify({"error": "Access denied. Caretakers must specify their designated patient ID.", "code": "FORBIDDEN"}), 403
        elif patient_id not in my_patient_ids:
            return jsonify({"error": "Access denied. Caretakers can only export records for their designated dependent patient.", "code": "FORBIDDEN"}), 403

    filters = []
    if patient_id:
        filters.append(("patientId", "==", patient_id))


    records = db_client.query_collection(
        "predictions",
        filters=filters,
        order_by="timestamp",
        descending=True,
        limit=500
    )

    if patient_id and len(records) == 0:
        discharged = db_client.get_document("discharged_patients", patient_id)
        if discharged and discharged.get("history"):
            records = discharged.get("history", [])


    output = io.StringIO()
    writer = csv.writer(output)

    # Headers
    writer.writerow([
        "Prediction ID",
        "Patient ID",
        "Timestamp (UTC)",
        "Model Version",
        "Risk Category",
        "Seizure Probability (%)",
        "Delta Power",
        "Theta Power",
        "Alpha Power",
        "Beta Power",
        "RMS",
        "Kurtosis",
        "Signal Quality"
    ])

    for r in records:
        feats = r.get("features", {})
        prob = round(r.get("modelProbability", 0.0) * 100, 2)
        quality = r.get("signalQuality", {}).get("acceptable", True)
        writer.writerow([
            r.get("predictionId", ""),
            r.get("patientId", ""),
            r.get("timestamp", ""),
            r.get("modelVersion", ""),
            r.get("riskCategory", ""),
            prob,
            feats.get("delta_power", ""),
            feats.get("theta_power", ""),
            feats.get("alpha_power", ""),
            feats.get("beta_power", ""),
            feats.get("rms", ""),
            feats.get("kurtosis", ""),
            "Acceptable" if quality else "Artifact Detected"
        ])

    csv_data = output.getvalue()
    filename = f"eeg_monitoring_report_{patient_id or 'all'}.csv"

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@report_bp.route("/export-pdf", methods=["GET"])
@require_auth
def export_pdf():
    """Generates and downloads a clinical PDF report of patient history or cohort surveillance."""
    patient_id = request.args.get("patientId")
    from backend.reports.pdf_generator import generate_patient_pdf, generate_cohort_pdf

    # HIPAA Isolation: Caretaker check
    if request.user.get("role") == "Caretaker":
        my_patient_ids = get_caretaker_patient_ids(request.user)
        if not patient_id:
            if len(my_patient_ids) == 1:
                patient_id = next(iter(my_patient_ids))
            else:
                return jsonify({"error": "Access denied. Caretakers cannot download hospital cohort surveillance reports.", "code": "FORBIDDEN"}), 403
        elif patient_id not in my_patient_ids:
            return jsonify({"error": "Access denied. Caretakers can only download reports for their designated dependent patient.", "code": "FORBIDDEN"}), 403

    if patient_id:

        patient = db_client.get_document("patients", patient_id)
        is_discharged = False
        if not patient:
            patient = db_client.get_document("discharged_patients", patient_id)
            if patient:
                is_discharged = True

        if not patient:
            return jsonify({"error": f"Patient with ID '{patient_id}' not found.", "code": "NOT_FOUND"}), 404

        history = db_client.query_collection(
            "predictions",
            filters=[("patientId", "==", patient_id)],
            order_by="timestamp",
            descending=True,
            limit=200
        )
        if not history and is_discharged and patient.get("history"):
            history = patient.get("history", [])

        alerts = db_client.query_collection(
            "alerts",
            filters=[("patientId", "==", patient_id)],
            order_by="timestamp",
            descending=True,
            limit=50
        )

        pdf_bytes = generate_patient_pdf(patient, history, alerts)
        safe_name = patient.get("name", "patient").replace(" ", "_").lower()
        filename = f"clinical_report_{safe_name}_{patient_id}.pdf"
    else:
        patients = db_client.query_collection("patients", limit=200)
        alerts = db_client.query_collection("alerts", order_by="timestamp", descending=True, limit=50)
        pdf_bytes = generate_cohort_pdf(patients, alerts)
        filename = "clinical_cohort_surveillance_report.pdf"

    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"",
            "Content-Type": "application/pdf"
        }
    )

