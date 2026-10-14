import os
import io
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def _get_base_styles():
    styles = getSampleStyleSheet()
    primary_color = colors.HexColor("#0D9488") # Teal
    dark_slate = colors.HexColor("#0F172A")
    muted_slate = colors.HexColor("#475569")
    light_bg = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=dark_slate,
        spaceAfter=2
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=muted_slate
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=primary_color,
        spaceBefore=8,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'ReportBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=dark_slate
    )

    bold_label = ParagraphStyle(
        'BoldLabel',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=dark_slate
    )

    return {
        'primary_color': primary_color,
        'dark_slate': dark_slate,
        'muted_slate': muted_slate,
        'light_bg': light_bg,
        'border_color': border_color,
        'title_style': title_style,
        'subtitle_style': subtitle_style,
        'section_heading': section_heading,
        'body_style': body_style,
        'bold_label': bold_label,
        'table_header_style': table_header_style,
        'table_cell_style': table_cell_style,
    }


def generate_patient_pdf(patient_data: dict, history_records: list, alerts_records: list = None) -> bytes:
    """
    Generates a professional clinical PDF report for a patient's history.
    Returns bytes of the generated PDF.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    cfg = _get_base_styles()
    story = []

    # 1. Header Banner
    header_data = [
        [
            Paragraph("<b>EDGE AI PATIENT MONITORING SYSTEM</b><br/><font size=7 color='#64748B'>EPILEPSY CLINICAL TELEMETRY & SEIZURE SURVEILLANCE</font>", cfg['body_style']),
            Paragraph(f"<b>REPORT:</b> PATIENT CLINICAL HISTORY<br/><b>GENERATED:</b> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", cfg['body_style'])
        ]
    ]
    header_table = Table(header_data, colWidths=[320, 203])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, 0), (-1, -1), cfg['light_bg']),
        ('LINEBELOW', (0, 0), (-1, -1), 1.5, cfg['primary_color']),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))

    # Title
    p_name = patient_data.get("name", "Unknown Patient")
    p_id = patient_data.get("patientId", "N/A")
    story.append(Paragraph(f"Patient Clinical Record: {p_name} ({p_id})", cfg['title_style']))
    is_discharged = bool(patient_data.get("dischargedAt") or "discharged" in str(patient_data.get("status", "")).lower())
    status_label = f"Discharged Record (Discharged: {patient_data.get('dischargedAt', 'N/A')[:10]})" if is_discharged else "Active Monitored Patient"
    story.append(Paragraph(f"Registry Status: <b>{status_label}</b> | Attending Physician: <b>{patient_data.get('assignedDoctorName', 'Dr. Sarah Jenkins, MD')}</b>", cfg['subtitle_style']))
    story.append(Spacer(1, 8))

    # 2. Patient Demographics & Caretaker Table
    story.append(Paragraph("1. Patient Profile & Emergency Contact", cfg['section_heading']))
    profile_data = [
        [
            Paragraph("<b>Patient Name:</b>", cfg['bold_label']), Paragraph(p_name, cfg['body_style']),
            Paragraph("<b>Patient ID:</b>", cfg['bold_label']), Paragraph(p_id, cfg['body_style'])
        ],
        [
            Paragraph("<b>Age:</b>", cfg['bold_label']), Paragraph(str(patient_data.get("age", "N/A")), cfg['body_style']),
            Paragraph("<b>Gender:</b>", cfg['bold_label']), Paragraph(str(patient_data.get("gender", "N/A")), cfg['body_style'])
        ],
        [
            Paragraph("<b>Assigned Physician:</b>", cfg['bold_label']), Paragraph(str(patient_data.get("assignedDoctorName", "Dr. Sarah Jenkins, MD")), cfg['body_style']),
            Paragraph("<b>Monitoring Status:</b>", cfg['bold_label']), Paragraph(str(patient_data.get("monitoringStatus", "Inactive")), cfg['body_style'])
        ],
        [
            Paragraph("<b>Caretaker Name:</b>", cfg['bold_label']), Paragraph(f"{patient_data.get('caretakerName', 'N/A')} ({patient_data.get('caretakerRelationship', 'Family')})", cfg['body_style']),
            Paragraph("<b>Caretaker Phone:</b>", cfg['bold_label']), Paragraph(str(patient_data.get("caretakerPhone", "N/A")), cfg['body_style'])
        ],
        [
            Paragraph("<b>SMS Alert Consent:</b>", cfg['bold_label']), Paragraph("Consented (Emergency Dispatches Authorized)" if patient_data.get("caretakerSmsConsent", True) else "Consent Not Granted", cfg['body_style']),
            Paragraph("<b>Enrolled On:</b>", cfg['bold_label']), Paragraph(str(patient_data.get("createdAt", "N/A"))[:19].replace('T', ' '), cfg['body_style'])
        ]
    ]

    if is_discharged:
        profile_data.append([
            Paragraph("<b>Discharge Reason:</b>", cfg['bold_label']), Paragraph(str(patient_data.get("dischargeReason", "Treatment Completed")), cfg['body_style']),
            Paragraph("<b>Discharge Date:</b>", cfg['bold_label']), Paragraph(str(patient_data.get("dischargedAt", "N/A"))[:19].replace('T', ' '), cfg['body_style'])
        ])

    notes = patient_data.get("clinicalNotes")
    if notes:
        profile_data.append([
            Paragraph("<b>Clinical Notes:</b>", cfg['bold_label']), Paragraph(str(notes), cfg['body_style']),
            Paragraph("", cfg['bold_label']), Paragraph("", cfg['body_style'])
        ])

    profile_table = Table(profile_data, colWidths=[110, 150, 110, 153])
    profile_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, cfg['border_color']),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, cfg['border_color']),
        ('BACKGROUND', (0, 0), (0, -1), cfg['light_bg']),
        ('BACKGROUND', (2, 0), (2, -1), cfg['light_bg']),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(profile_table)
    story.append(Spacer(1, 8))

    # 3. Surveillance & Risk Analytics Summary
    total_epochs = len(history_records)
    high_risks = [h for h in history_records if h.get("riskCategory") == "High"]
    med_risks = [h for h in history_records if h.get("riskCategory") == "Medium"]
    low_risks = [h for h in history_records if h.get("riskCategory") == "Low"]

    probs = [float(h.get("modelProbability", 0.0)) for h in history_records if h.get("modelProbability") is not None]
    avg_prob = (sum(probs) / len(probs) * 100) if probs else 0.0
    peak_prob = (max(probs) * 100) if probs else 0.0

    story.append(Paragraph("2. Edge AI Seizure Surveillance Analytics", cfg['section_heading']))
    metrics_data = [
        [
            Paragraph("<b>Total Analyzed Epochs:</b>", cfg['bold_label']), Paragraph(f"<b>{total_epochs}</b> windows (2.0s)", cfg['body_style']),
            Paragraph("<b>High Risk Seizure Epochs:</b>", cfg['bold_label']), Paragraph(f"<font color='#B91C1C'><b>{len(high_risks)}</b></font>", cfg['body_style'])
        ],
        [
            Paragraph("<b>Medium Risk Epochs:</b>", cfg['bold_label']), Paragraph(f"<font color='#B45309'><b>{len(med_risks)}</b></font>", cfg['body_style']),
            Paragraph("<b>Low Risk (Normal) Epochs:</b>", cfg['bold_label']), Paragraph(f"<font color='#047857'><b>{len(low_risks)}</b></font>", cfg['body_style'])
        ],
        [
            Paragraph("<b>Peak Seizure Probability:</b>", cfg['bold_label']), Paragraph(f"<b>{peak_prob:.1f}%</b>", cfg['body_style']),
            Paragraph("<b>Mean Seizure Probability:</b>", cfg['bold_label']), Paragraph(f"<b>{avg_prob:.1f}%</b>", cfg['body_style'])
        ]
    ]
    metrics_table = Table(metrics_data, colWidths=[130, 130, 130, 133])
    metrics_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, cfg['border_color']),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, cfg['border_color']),
        ('BACKGROUND', (0, 0), (0, -1), cfg['light_bg']),
        ('BACKGROUND', (2, 0), (2, -1), cfg['light_bg']),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(metrics_table)
    story.append(Spacer(1, 8))

    # 4. Clinical Seizure Alerts & Caretaker SMS Dispatch Ledger
    if alerts_records:
        story.append(Paragraph("3. Emergency Seizure Alerts & Caretaker SMS Log", cfg['section_heading']))
        alert_headers = ["Alert ID", "Timestamp (UTC)", "Model Output", "Risk Level", "Caretaker SMS Status", "Physician Status"]
        alert_rows = [[Paragraph(h, cfg['table_header_style']) for h in alert_headers]]

        for a in alerts_records[:15]:
            prob_txt = f"{round(float(a.get('probability', 0.0)) * 100, 1)}%"
            sms_status = a.get("smsStatus", "In-Flight")
            ack_status = "Acknowledged" if a.get("acknowledgedAt") else "Requires Sign-off"
            alert_rows.append([
                Paragraph(str(a.get("alertId", ""))[:12], cfg['table_cell_style']),
                Paragraph(str(a.get("timestamp", ""))[:19].replace('T', ' '), cfg['table_cell_style']),
                Paragraph(prob_txt, cfg['table_cell_style']),
                Paragraph(f"<font color='#B91C1C'><b>{a.get('riskLevel', 'High')}</b></font>", cfg['table_cell_style']),
                Paragraph(sms_status, cfg['table_cell_style']),
                Paragraph(ack_status, cfg['table_cell_style']),
            ])

        alert_table = Table(alert_rows, colWidths=[70, 95, 65, 55, 120, 118])
        alert_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), cfg['primary_color']),
            ('BOX', (0, 0), (-1, -1), 0.5, cfg['border_color']),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, cfg['border_color']),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(alert_table)
        story.append(Spacer(1, 8))

    # 5. EEG Epoch History Table
    story.append(Paragraph("4. Historical EEG Epoch Prediction Ledger", cfg['section_heading']))
    if not history_records:
        story.append(Paragraph("<i>No continuous EEG prediction records logged for this patient yet.</i>", cfg['body_style']))
    else:
        epoch_headers = ["Epoch / Time", "Risk Category", "Probability", "Delta Power", "Theta Power", "Alpha Power", "RMS", "Quality"]
        epoch_rows = [[Paragraph(h, cfg['table_header_style']) for h in epoch_headers]]

        for r in history_records[:35]:
            feats = r.get("features", {})
            prob_pct = f"{round(float(r.get('modelProbability', 0.0)) * 100, 1)}%"
            risk = r.get("riskCategory", "Low")
            risk_color = "#B91C1C" if risk == "High" else "#B45309" if risk == "Medium" else "#047857"
            
            ts = r.get("timestamp", "")
            ts_display = ts.split("T")[1][:8] if "T" in ts else ts[:12] or "Epoch"
            
            delta_val = f"{feats.get('delta_power', 0.0):.2e}" if isinstance(feats.get('delta_power'), (int, float)) else "N/A"
            theta_val = f"{feats.get('theta_power', 0.0):.2e}" if isinstance(feats.get('theta_power'), (int, float)) else "N/A"
            alpha_val = f"{feats.get('alpha_power', 0.0):.2e}" if isinstance(feats.get('alpha_power'), (int, float)) else "N/A"
            rms_val = f"{feats.get('rms', 0.0):.2f}" if isinstance(feats.get('rms'), (int, float)) else "N/A"

            quality = "Acceptable" if r.get("signalQuality", {}).get("acceptable", True) else "Artifact"

            epoch_rows.append([
                Paragraph(ts_display, cfg['table_cell_style']),
                Paragraph(f"<font color='{risk_color}'><b>{risk}</b></font>", cfg['table_cell_style']),
                Paragraph(prob_pct, cfg['table_cell_style']),
                Paragraph(delta_val, cfg['table_cell_style']),
                Paragraph(theta_val, cfg['table_cell_style']),
                Paragraph(alpha_val, cfg['table_cell_style']),
                Paragraph(rms_val, cfg['table_cell_style']),
                Paragraph(quality, cfg['table_cell_style']),
            ])

        epoch_table = Table(epoch_rows, colWidths=[65, 65, 58, 65, 65, 65, 65, 75])
        epoch_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), cfg['dark_slate']),
            ('BOX', (0, 0), (-1, -1), 0.5, cfg['border_color']),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, cfg['border_color']),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(epoch_table)

    story.append(Spacer(1, 12))

    # 6. Attestation & Sign-off Block
    sign_block = [
        [
            Paragraph("<b>Clinical Attestation:</b><br/><font size=7 color='#64748B'>This report summarizes continuous automated edge-AI inference using a 100-tree Random Forest classifier v1.0.0. Real-time telemetry is designed for supportive clinical surveillance and caretaker alert notification.</font>", cfg['body_style']),
            Paragraph("<b>Physician Signature:</b> ___________________________<br/><br/><b>Date:</b> ___________________________", cfg['body_style'])
        ]
    ]
    sign_table = Table(sign_block, colWidths=[310, 213])
    sign_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, cfg['border_color']),
        ('BACKGROUND', (0, 0), (-1, -1), cfg['light_bg']),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(KeepTogether([sign_table]))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def generate_cohort_pdf(patients: list, alerts: list = None, recent_history: list = None) -> bytes:
    """
    Generates a cohort-wide clinical summary report of all monitored epilepsy patients.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    cfg = _get_base_styles()
    story = []

    # Header Banner
    header_data = [
        [
            Paragraph("<b>EDGE AI PATIENT MONITORING SYSTEM</b><br/><font size=7 color='#64748B'>EPILEPSY CLINICAL TELEMETRY & SEIZURE SURVEILLANCE</font>", cfg['body_style']),
            Paragraph(f"<b>REPORT:</b> CLINICAL COHORT SUMMARY<br/><b>GENERATED:</b> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", cfg['body_style'])
        ]
    ]
    header_table = Table(header_data, colWidths=[320, 203])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, 0), (-1, -1), cfg['light_bg']),
        ('LINEBELOW', (0, 0), (-1, -1), 1.5, cfg['primary_color']),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Clinical Patient Cohort Surveillance Audit", cfg['title_style']))
    story.append(Paragraph(f"Active Monitoring Registry: <b>{len(patients)} Patients Enrolled</b> | High-Risk Seizure Alerts: <b>{len(alerts or [])}</b>", cfg['subtitle_style']))
    story.append(Spacer(1, 8))

    # Patients Overview Table
    story.append(Paragraph("1. Active Patients Registry & Caretaker Information", cfg['section_heading']))
    p_headers = ["Patient ID", "Name", "Demographics", "Assigned Doctor", "Caretaker Contact", "Status"]
    p_rows = [[Paragraph(h, cfg['table_header_style']) for h in p_headers]]

    for p in patients:
        p_rows.append([
            Paragraph(str(p.get("patientId", "")), cfg['table_cell_style']),
            Paragraph(f"<b>{p.get('name', '')}</b>", cfg['table_cell_style']),
            Paragraph(f"Age: {p.get('age', 'N/A')}<br/>{p.get('gender', 'N/A')}", cfg['table_cell_style']),
            Paragraph(str(p.get("assignedDoctorName", "Dr. Sarah Jenkins, MD")), cfg['table_cell_style']),
            Paragraph(f"{p.get('caretakerName', 'N/A')}<br/>{p.get('caretakerPhone', 'N/A')}", cfg['table_cell_style']),
            Paragraph(str(p.get("monitoringStatus", "Inactive")), cfg['table_cell_style']),
        ])

    pt_table = Table(p_rows, colWidths=[75, 95, 75, 110, 110, 58])
    pt_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), cfg['primary_color']),
        ('BOX', (0, 0), (-1, -1), 0.5, cfg['border_color']),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, cfg['border_color']),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(pt_table)
    story.append(Spacer(1, 10))

    # Recent Alerts Ledger
    if alerts:
        story.append(Paragraph("2. Seizure Alert Dispatches & Physician Acknowledgement Log", cfg['section_heading']))
        alert_headers = ["Alert ID", "Patient", "Timestamp (UTC)", "Model Output", "Risk Level", "Physician Status"]
        alert_rows = [[Paragraph(h, cfg['table_header_style']) for h in alert_headers]]

        for a in alerts[:20]:
            prob_txt = f"{round(float(a.get('probability', 0.0)) * 100, 1)}%"
            ack_status = "Acknowledged" if a.get("acknowledgedAt") else "Requires Sign-off"
            alert_rows.append([
                Paragraph(str(a.get("alertId", ""))[:12], cfg['table_cell_style']),
                Paragraph(f"{a.get('patientName', '')}<br/><font size=6 color='#64748B'>{a.get('patientId', '')}</font>", cfg['table_cell_style']),
                Paragraph(str(a.get("timestamp", ""))[:19].replace('T', ' '), cfg['table_cell_style']),
                Paragraph(prob_txt, cfg['table_cell_style']),
                Paragraph(f"<font color='#B91C1C'><b>{a.get('riskLevel', 'High')}</b></font>", cfg['table_cell_style']),
                Paragraph(ack_status, cfg['table_cell_style']),
            ])

        alert_table = Table(alert_rows, colWidths=[70, 100, 95, 65, 65, 128])
        alert_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), cfg['dark_slate']),
            ('BOX', (0, 0), (-1, -1), 0.5, cfg['border_color']),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, cfg['border_color']),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(alert_table)

    story.append(Spacer(1, 15))

    # Attestation
    sign_block = [
        [
            Paragraph("<b>Clinical Attestation:</b><br/><font size=7 color='#64748B'>This report summarizes cohort-level clinical surveillance and emergency caretaker notification readiness across all enrolled epilepsy patients.</font>", cfg['body_style']),
            Paragraph("<b>Chief Clinician Signature:</b> ___________________________<br/><br/><b>Date:</b> ___________________________", cfg['body_style'])
        ]
    ]
    sign_table = Table(sign_block, colWidths=[310, 213])
    sign_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, cfg['border_color']),
        ('BACKGROUND', (0, 0), (-1, -1), cfg['light_bg']),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(KeepTogether([sign_table]))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
