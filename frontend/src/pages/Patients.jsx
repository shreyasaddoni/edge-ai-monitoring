import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { usePlayback } from '../context/PlaybackContext';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Phone,
  ShieldCheck,
  ChevronRight,
  Radio,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle2,
  HeartHandshake,
  ClipboardList,
  RotateCcw,
  Eye,
  Clock,
  Database,
  Download,
  AlertTriangle,
  Info,
  FileText
} from 'lucide-react';

export const Patients = () => {
  const { user } = useAuth();
  const isCaretaker = user?.role === 'Caretaker';
  const { clearPatientSession } = usePlayback();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active vs Discharged Sub-tabs
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'discharged' ? 'discharged' : 'active');


  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(searchParams.get('register') === 'true');

  // Discharged Patients State
  const [dischargedPatients, setDischargedPatients] = useState([]);
  const [loadingDischarged, setLoadingDischarged] = useState(false);
  const [selectedDischarged, setSelectedDischarged] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('overview');

  // Discharge Confirmation Modal State
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [patientToDischarge, setPatientToDischarge] = useState(null);
  const [dischargeReason, setDischargeReason] = useState('Treatment Completed / Seizures Stabilized');
  const [discharging, setDischarging] = useState(false);

  // Restore & Purge Action States
  const [restoringId, setRestoringId] = useState(null);
  const [purgingId, setPurgingId] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState({});

  const handleDownloadPdf = async (patientId, name) => {
    try {
      setDownloadingPdf(prev => ({ ...prev, [patientId]: true }));
      const res = await api.exportPdf({ patientId });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `clinical_report_${(name || 'patient').toLowerCase().replace(/\s+/g, '_')}_${patientId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download PDF report:", err);
      alert("Failed to generate PDF report. Please try again.");
    } finally {
      setDownloadingPdf(prev => ({ ...prev, [patientId]: false }));
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Male',
    clinicalNotes: '',
    // MANDATORY CARETAKER DETAILS
    caretakerName: '',
    caretakerPhone: '',
    caretakerRelationship: 'Father',
    caretakerSmsConsent: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const res = await api.getPatients();
      setPatients(res.data.patients || []);
    } catch (err) {
      console.error("Error loading patients:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDischargedPatients = async () => {
    try {
      setLoadingDischarged(true);
      const res = await api.getDischargedPatients();
      setDischargedPatients(res.data.dischargedPatients || []);
    } catch (err) {
      console.error("Error loading discharged patients:", err);
    } finally {
      setLoadingDischarged(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchDischargedPatients();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Frontend validations
    if (!formData.name.trim()) {
      setFormError("Patient full name is required.");
      return;
    }
    if (!formData.caretakerName.trim()) {
      setFormError("Caretaker full name is mandatory.");
      return;
    }
    if (!formData.caretakerPhone.trim()) {
      setFormError("Caretaker mobile number is mandatory (+E.164 international format).");
      return;
    }
    if (!formData.caretakerPhone.startsWith('+')) {
      setFormError("Mobile number must include country code (e.g. +919876543210 or +14155552671).");
      return;
    }
    if (!formData.caretakerSmsConsent) {
      setFormError("Please confirm caretaker SMS consent to receive emergency monitoring alerts.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.registerPatient({
        ...formData,
        age: formData.age ? parseInt(formData.age, 10) : null,
      });

      setSuccessMsg(`Patient ${res.data.patient?.name} registered successfully!`);
      setShowModal(false);
      // Reset form
      setFormData({
        name: '',
        age: '',
        gender: 'Male',
        clinicalNotes: '',
        caretakerName: '',
        caretakerPhone: '',
        caretakerRelationship: 'Father',
        caretakerSmsConsent: false,
      });
      fetchPatients();
    } catch (err) {
      setFormError(err.response?.data?.error || "Registration failed. Please check your inputs.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Discharge Modal
  const handleOpenDischargeModal = (patient) => {
    const pId = patient.patientId || patient.id;
    setPatientToDischarge({
      ...patient,
      patientId: pId,
      name: patient.name || 'Unnamed Patient'
    });
    setDischargeReason('Treatment Completed / Seizures Stabilized');
    setShowDischargeModal(true);
  };

  // Confirm Discharge & Move to Record Tab
  const handleConfirmDischarge = async () => {
    if (!patientToDischarge) return;
    const pId = patientToDischarge.patientId || patientToDischarge.id;
    if (!pId) {
      alert("Error: Cannot discharge a record without an ID.");
      return;
    }
    try {
      setDischarging(true);
      clearPatientSession(pId);
      await api.deletePatient(pId, { reason: dischargeReason });
      setSuccessMsg(`Patient ${patientToDischarge.name || pId} discharged. Full details & EEG telemetry history safely archived to Record Tab.`);
      setShowDischargeModal(false);
      setPatientToDischarge(null);
      fetchPatients();
      fetchDischargedPatients();
    } catch (err) {
      console.error("Discharge failed:", err);
      const msg = err.response?.data?.error || err.message || "Failed to discharge patient.";
      alert(`Discharge Error: ${msg}`);
    } finally {
      setDischarging(false);
    }
  };

  // Restore Patient from Discharged Records back to Active Registry
  const handleRestore = async (patientId, name) => {
    if (!window.confirm(`Restore patient ${name} (${patientId}) back to the Active Patient Registry?`)) {
      return;
    }
    try {
      setRestoringId(patientId);
      await api.restoreDischargedPatient(patientId);
      setSuccessMsg(`Patient ${name} successfully restored to active registry.`);
      fetchPatients();
      fetchDischargedPatients();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to restore patient.");
    } finally {
      setRestoringId(null);
    }
  };

  // Permanently Purge a Discharged Record
  const handlePurge = async (patientId, name) => {
    if (!window.confirm(`Permanently remove archived record for ${name} from the database?`)) {
      return;
    }
    try {
      setPurgingId(patientId);
      await api.deleteDischargedRecord(patientId);
      setSuccessMsg(`Archived record for ${name} permanently removed.`);
      if (selectedDischarged?.patientId === patientId) {
        setSelectedDischarged(null);
      }
      fetchDischargedPatients();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete archived record.");
    } finally {
      setPurgingId(null);
    }
  };

  const filteredPatients = patients.filter((p) => {
    return (
      search === '' ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.patientId?.toLowerCase().includes(search.toLowerCase()) ||
      p.caretakerName?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const filteredDischarged = dischargedPatients.filter((r) => {
    return (
      search === '' ||
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.patientId?.toLowerCase().includes(search.toLowerCase()) ||
      r.caretakerName?.toLowerCase().includes(search.toLowerCase()) ||
      r.dischargeReason?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isCaretaker ? 'Dependent Patient Portal' : 'Patient Management & Caretaker Directory'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isCaretaker
              ? 'View and monitor your designated patient, emergency contact status, and diagnostic reports'
              : 'Manage enrolled epilepsy patients, emergency caretaker contacts, and discharged clinical history records'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/records"
            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-lg shadow-xs transition"
          >
            <ClipboardList className="w-3.5 h-3.5 text-teal-600" />
            <span>Open Dedicated Record Tab</span>
          </Link>

          {!isCaretaker && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm shadow-teal-600/20 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register Patient</span>
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="font-bold text-emerald-900">&times;</button>
        </div>
      )}

      {/* Directory Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="px-5 pt-3 border-b border-slate-200/80 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
                activeTab === 'active'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Active Patients Registry</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'active' ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {patients.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('discharged')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
                activeTab === 'discharged'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Discharged Patient Records (Record Tab)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'discharged' ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {dischargedPatients.length} / 10 Max
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium pb-1.5 flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-teal-600" />
            <span>Strict Retention: Latest 10 Discharged Patients Kept</span>
          </div>
        </div>

        {/* Search header */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
          <div className="relative w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeTab === 'active' ? "Search active patients by name, ID, or caretaker..." : "Search discharged records..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-slate-50/50"
            />
          </div>

          <div className="text-xs text-slate-500">
            {activeTab === 'active' ? (
              <>Total Enrolled: <strong className="text-slate-700">{filteredPatients.length}</strong></>
            ) : (
              <>Archived Discharged: <strong className="text-slate-700">{filteredDischarged.length}</strong> (Max 10 Slots)</>
            )}
          </div>
        </div>

        {/* TAB 1: ACTIVE PATIENTS TABLE */}
        {activeTab === 'active' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-10 text-center text-xs text-slate-400">Loading patients...</div>
            ) : filteredPatients.length === 0 ? (
              <div className="p-10 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No patient records found</p>
                <p className="text-xs text-slate-400 mt-1">Register a patient with verified caretaker contact info.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Patient Profile</th>
                    <th className="py-3 px-4">Demographics</th>
                    <th className="py-3 px-4">Assigned Doctor</th>
                    <th className="py-3 px-4">Caretaker Information</th>
                    <th className="py-3 px-4">SMS Alert Consent</th>
                    <th className="py-3 px-4">Monitoring Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPatients.map((p) => (
                    <tr key={p.patientId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="font-mono text-[11px] text-slate-400">{p.patientId}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div>Age: {p.age || 'N/A'}</div>
                        <div className="text-[11px] text-slate-400">{p.gender || 'Not specified'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {p.assignedDoctorName || 'Dr. Attending'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 flex items-center">
                          <HeartHandshake className="w-3 h-3 text-teal-600 mr-1" />
                          {p.caretakerName} ({p.caretakerRelationship})
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {p.caretakerPhoneMasked || p.caretakerPhone}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {p.caretakerSmsConsent ? (
                          <span className="inline-flex items-center text-emerald-700 text-[11px] font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Consented
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-rose-700 text-[11px] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            Missing Consent
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          p.monitoringStatus === 'active'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {p.monitoringStatus === 'active' ? 'Active Stream' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => navigate(`/monitoring?patientId=${p.patientId}`)}
                            title="Stream Live EEG"
                            className="p-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded transition"
                          >
                            <Radio className="w-4 h-4" />
                          </button>

                          {/* PDF Report Download */}
                          <button
                            onClick={() => handleDownloadPdf(p.patientId, p.name)}
                            disabled={downloadingPdf[p.patientId]}
                            title="Download Clinical History PDF Report"
                            className="inline-flex items-center space-x-1 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded transition cursor-pointer disabled:opacity-50"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{downloadingPdf[p.patientId] ? 'PDF...' : 'PDF Report'}</span>
                          </button>

                          <Link
                            to={`/patients/${p.patientId}`}
                            className="inline-flex items-center text-xs font-semibold text-slate-700 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 px-2.5 py-1 rounded transition"
                          >
                            <span>Full Profile</span>
                            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                          </Link>

                          {/* DELETE / DISCHARGE BUTTON (Clinicians only) */}
                          {!isCaretaker && (
                            <button
                              onClick={() => handleOpenDischargeModal(p)}
                              title="Discharge & Move to Record Tab"
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: DISCHARGED PATIENT RECORDS (RECORD TAB) */}
        {activeTab === 'discharged' && (
          <div>
            {/* Retention Notice Banner */}
            <div className="bg-amber-50/70 border-b border-amber-200/60 p-3.5 px-5 flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center space-x-2.5">
                <Database className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>Database Overflow Protection:</strong> The database maintains strictly the <strong>latest 10 discharged patients</strong>. Older archives are automatically pruned (FIFO) while full historical analysis and diagnostic details are preserved for all listed records.
                </span>
              </div>
              <span className="font-bold text-[11px] px-2 py-0.5 bg-amber-200/60 text-amber-900 rounded">
                {dischargedPatients.length} / 10 Slots
              </span>
            </div>

            <div className="overflow-x-auto">
              {loadingDischarged ? (
                <div className="p-10 text-center text-xs text-slate-400">Loading discharged records...</div>
              ) : filteredDischarged.length === 0 ? (
                <div className="p-10 text-center">
                  <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No Discharged Patients Found</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    When you delete/discharge patients from the active registry, their complete records and historical EEG sessions are preserved here.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Archived Patient</th>
                      <th className="py-3 px-4">Admission & Discharge</th>
                      <th className="py-3 px-4">Discharge Reason</th>
                      <th className="py-3 px-4">Caretaker Information</th>
                      <th className="py-3 px-4">Recorded Activity</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDischarged.map((r) => (
                      <tr key={r.patientId} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{r.name}</div>
                          <div className="font-mono text-[11px] text-slate-400">{r.patientId}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Age: {r.age || 'N/A'} • {r.gender}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          <div className="flex items-center space-x-1 text-slate-700 font-medium">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Discharged: {formatDate(r.dischargedAt)}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Admitted: {formatDate(r.admittedAt || r.createdAt)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            By: {r.dischargedBy || 'Attending Physician'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-700 max-w-xs">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-800 font-medium">
                            {r.dischargeReason || 'Clinical Discharge'}
                          </span>
                          {r.clinicalNotes && (
                            <p className="text-[11px] text-slate-500 truncate mt-1" title={r.clinicalNotes}>
                              {r.clinicalNotes}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900 flex items-center">
                            <HeartHandshake className="w-3 h-3 text-teal-600 mr-1" />
                            {r.caretakerName} ({r.caretakerRelationship})
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {r.caretakerPhoneMasked || r.caretakerPhone || 'Unrecorded'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {r.totalPredictionsCount || r.history?.length || 0} Epochs
                            </span>
                            {r.highRiskCount > 0 && (
                              <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                {r.highRiskCount} High
                              </span>
                            )}
                            {r.mediumRiskCount > 0 && (
                              <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                {r.mediumRiskCount} Med
                              </span>
                            )}
                            {r.totalAlertsCount > 0 && (
                              <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                {r.totalAlertsCount} Alerts
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => { setSelectedDischarged(r); setActiveModalTab('overview'); }}
                              className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-700 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 px-2.5 py-1 rounded transition"
                              title="Inspect Historical Details & Telemetry"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View History</span>
                            </button>

                            {/* PDF Report Download */}
                            <button
                              onClick={() => handleDownloadPdf(r.patientId, r.name)}
                              disabled={downloadingPdf[r.patientId]}
                              title="Download Archived Clinical History PDF"
                              className="inline-flex items-center space-x-1 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded transition cursor-pointer disabled:opacity-50"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>{downloadingPdf[r.patientId] ? 'PDF...' : 'PDF Report'}</span>
                            </button>

                            {!isCaretaker && (
                              <>
                                <button
                                  onClick={() => handleRestore(r.patientId, r.name)}
                                  disabled={restoringId === r.patientId}
                                  className="p-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded transition disabled:opacity-50"
                                  title="Restore to Active Patient Registry"
                                >
                                  <RotateCcw className={`w-3.5 h-3.5 ${restoringId === r.patientId ? 'animate-spin' : ''}`} />
                                </button>

                                <button
                                  onClick={() => handlePurge(r.patientId, r.name)}
                                  disabled={purgingId === r.patientId}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition disabled:opacity-50"
                                  title="Permanently Delete Archived Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DISCHARGE CONFIRMATION MODAL */}
      {showDischargeModal && patientToDischarge && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <h3 className="text-base font-bold">Discharge Patient & Move to Records</h3>
                  <p className="text-xs text-rose-100">Removes from active surveillance and archives history</p>
                </div>
              </div>
              <button
                onClick={() => setShowDischargeModal(false)}
                className="text-rose-200 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs">
                <div className="font-semibold text-slate-800 text-sm">{patientToDischarge.name}</div>
                <div className="text-slate-500 font-mono mt-0.5">ID: {patientToDischarge.patientId} • Age: {patientToDischarge.age || 'N/A'}</div>
                <div className="text-slate-500 mt-1">Caretaker: {patientToDischarge.caretakerName} ({patientToDischarge.caretakerPhone})</div>
              </div>

              {/* Policy Explanation Alert */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start space-x-2.5 leading-relaxed">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold text-amber-950">Record Preservation Guarantee:</strong> All clinical notes, emergency caretaker records, and processed EEG telemetry epochs will be safely transferred to the <strong>Record Tab</strong>.
                  <div className="mt-1 text-[11px] text-amber-800">
                    To prevent database overflow, the database strictly retains the <strong>latest 10 discharged patients</strong> (FIFO retention policy).
                  </div>
                </div>
              </div>

              {/* Discharge Reason Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clinical Discharge Reason / Evaluation:
                </label>
                <select
                  value={dischargeReason}
                  onChange={(e) => setDischargeReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-rose-500 bg-white"
                >
                  <option value="Treatment Completed / Seizures Stabilized">Treatment Completed / Seizures Stabilized</option>
                  <option value="Discharged to Outpatient Care">Discharged to Outpatient Care</option>
                  <option value="Transferred to Specialized Neurological Center">Transferred to Specialized Neurological Center</option>
                  <option value="Family / Caretaker Requested Discharge">Family / Caretaker Requested Discharge</option>
                  <option value="Monitoring Cycle Concluded">Monitoring Cycle Concluded</option>
                  <option value="Administrative Registry Removal">Administrative Registry Removal</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDischargeModal(false)}
                  className="text-xs text-slate-600 hover:text-slate-800 px-4 py-2 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDischarge}
                  disabled={discharging}
                  className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold px-5 py-2 rounded-lg shadow-sm shadow-rose-600/20 disabled:opacity-50"
                >
                  {discharging ? 'Discharging...' : 'Confirm Discharge & Archive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DISCHARGED RECORD DETAILS & HISTORY MODAL */}
      {selectedDischarged && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center font-bold text-base">
                  {selectedDischarged.name?.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white">{selectedDischarged.name}</h3>
                    <span className="font-mono text-xs text-teal-300 bg-slate-800 px-2 py-0.5 rounded">
                      {selectedDischarged.patientId}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Discharged
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Discharged on {formatDate(selectedDischarged.dischargedAt)} • {selectedDischarged.dischargeReason}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDischarged(null)}
                className="text-slate-400 hover:text-white text-xl font-bold leading-none p-1"
              >
                &times;
              </button>
            </div>

            <div className="px-6 border-b border-slate-200 flex space-x-4 bg-slate-50 flex-shrink-0">
              <button
                onClick={() => setActiveModalTab('overview')}
                className={`py-3 text-xs font-semibold border-b-2 transition ${
                  activeModalTab === 'overview'
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Patient Profile & Caretaker
              </button>
              <button
                onClick={() => setActiveModalTab('history')}
                className={`py-3 text-xs font-semibold border-b-2 transition ${
                  activeModalTab === 'history'
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                2. EEG Telemetry History ({selectedDischarged.history?.length || 0})
              </button>
              <button
                onClick={() => setActiveModalTab('alerts')}
                className={`py-3 text-xs font-semibold border-b-2 transition ${
                  activeModalTab === 'alerts'
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                3. Alert Log ({selectedDischarged.alerts?.length || 0})
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {activeModalTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                        Clinical Demographics
                      </h4>
                      <dl className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Age:</dt>
                          <dd className="font-medium text-slate-800">{selectedDischarged.age || 'N/A'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Gender:</dt>
                          <dd className="font-medium text-slate-800">{selectedDischarged.gender || 'Not specified'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Assigned Doctor:</dt>
                          <dd className="font-medium text-slate-800">{selectedDischarged.assignedDoctorName || 'Dr. Attending'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Admission Date:</dt>
                          <dd className="font-medium text-slate-800">{formatDate(selectedDischarged.admittedAt || selectedDischarged.createdAt)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Discharge Date:</dt>
                          <dd className="font-medium text-slate-800">{formatDate(selectedDischarged.dischargedAt)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                        Registered Caretaker
                      </h4>
                      <dl className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Full Name:</dt>
                          <dd className="font-medium text-slate-800">{selectedDischarged.caretakerName || 'N/A'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Relationship:</dt>
                          <dd className="font-medium text-slate-800">{selectedDischarged.caretakerRelationship || 'Family'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Emergency Phone:</dt>
                          <dd className="font-mono font-medium text-slate-800">
                            {selectedDischarged.caretakerPhoneMasked || selectedDischarged.caretakerPhone || 'Unrecorded'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">SMS Consent:</dt>
                          <dd className="font-medium text-emerald-700">Verified & Confirmed</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                      Clinical Diagnostic Notes & Discharge Evaluation
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {selectedDischarged.clinicalNotes || 'No additional clinical diagnosis notes recorded for this patient.'}
                    </p>
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs flex items-center justify-between text-slate-500">
                      <span>Reason: <strong className="text-slate-700">{selectedDischarged.dischargeReason}</strong></span>
                      <span>Evaluated By: <strong className="text-slate-700">{selectedDischarged.dischargedBy || 'Attending Physician'}</strong></span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-100 rounded-lg p-2.5">
                      <span className="text-[11px] text-slate-500">Total Epochs</span>
                      <p className="text-base font-bold text-slate-900 mt-0.5">{selectedDischarged.totalPredictionsCount || selectedDischarged.history?.length || 0}</p>
                    </div>
                    <div className="bg-rose-50 border border-rose-200/60 rounded-lg p-2.5">
                      <span className="text-[11px] text-rose-700">High Risk (Seizure)</span>
                      <p className="text-base font-bold text-rose-800 mt-0.5">{selectedDischarged.highRiskCount || 0}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-2.5">
                      <span className="text-[11px] text-amber-700">Medium Risk</span>
                      <p className="text-base font-bold text-amber-800 mt-0.5">{selectedDischarged.mediumRiskCount || 0}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200/60 rounded-lg p-2.5">
                      <span className="text-[11px] text-emerald-700">Low Risk (Normal)</span>
                      <p className="text-base font-bold text-emerald-800 mt-0.5">{selectedDischarged.lowRiskCount || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'history' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Historical 2.0s EEG epochs preserved for clinical audit:</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDownloadPdf(selectedDischarged.patientId, selectedDischarged.name)}
                        disabled={downloadingPdf[selectedDischarged.patientId]}
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded transition cursor-pointer disabled:opacity-50"
                        title="Download Complete Clinical History PDF Report"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{downloadingPdf[selectedDischarged.patientId] ? 'Generating PDF...' : 'Download PDF Report'}</span>
                      </button>
                      <a
                        href={api.getExportCsvUrl(selectedDischarged.patientId)}
                        download
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 rounded transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download CSV</span>
                      </a>
                    </div>
                  </div>

                  {(!selectedDischarged.history || selectedDischarged.history.length === 0) ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                      No EEG prediction history was logged for this patient before discharge.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[11px] text-slate-500 font-semibold uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Timestamp</th>
                            <th className="py-2.5 px-3">Risk Category</th>
                            <th className="py-2.5 px-3">Probability</th>
                            <th className="py-2.5 px-3">RMS</th>
                            <th className="py-2.5 px-3">Kurtosis</th>
                            <th className="py-2.5 px-3">Signal Quality</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedDischarged.history.map((h, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                                {h.timestamp ? h.timestamp.split('T')[1]?.slice(0, 8) : `Epoch #${idx + 1}`}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  h.riskCategory === 'High'
                                    ? 'bg-rose-100 text-rose-800'
                                    : h.riskCategory === 'Medium'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {h.riskCategory || 'Low'}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-800">
                                {Math.round((h.modelProbability || 0) * 100)}%
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                                {h.features?.rms ? h.features.rms.toFixed(2) : 'N/A'}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                                {h.features?.kurtosis ? h.features.kurtosis.toFixed(2) : 'N/A'}
                              </td>
                              <td className="py-2 px-3 text-[11px]">
                                {h.signalQuality?.acceptable !== false ? (
                                  <span className="text-emerald-600 font-medium">Acceptable</span>
                                ) : (
                                  <span className="text-amber-600 font-medium">Artifact</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeModalTab === 'alerts' && (
                <div className="space-y-3">
                  {(!selectedDischarged.alerts || selectedDischarged.alerts.length === 0) ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                      No emergency alerts were triggered for this patient.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[11px] text-slate-500 font-semibold uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Alert Time</th>
                            <th className="py-2.5 px-3">Risk Level</th>
                            <th className="py-2.5 px-3">Message</th>
                            <th className="py-2.5 px-3">Caretaker SMS</th>
                            <th className="py-2.5 px-3">Doctor Ack</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedDischarged.alerts.map((a, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                                {formatDate(a.createdAt)}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  a.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {a.severity || 'HIGH'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-700 max-w-xs truncate" title={a.message}>
                                {a.message || 'Seizure risk threshold exceeded.'}
                              </td>
                              <td className="py-2 px-3">
                                <span className="text-[11px] font-medium text-emerald-600">
                                  {a.smsDeliveryStatus || 'Delivered'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                {a.acknowledgedAt ? (
                                  <span className="text-emerald-700 font-medium">Acknowledged</span>
                                ) : (
                                  <span className="text-slate-400">Archived</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => handlePurge(selectedDischarged.patientId, selectedDischarged.name)}
                className="flex items-center space-x-1.5 text-xs text-rose-600 hover:text-rose-800 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Permanently Purge Record</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleRestore(selectedDischarged.patientId, selectedDischarged.name)}
                  className="flex items-center space-x-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore to Active Registry</span>
                </button>
                <button
                  onClick={() => setSelectedDischarged(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Caretaker Patient Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Register New Patient</h3>
                <p className="text-xs text-slate-400">Includes mandatory caretaker emergency notification registration</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Patient Basic Info */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  1. Clinical Patient Demographics
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Patient Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Aarav Sharma"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Age (Years)</label>
                    <input
                      type="number"
                      name="age"
                      min="1"
                      max="120"
                      placeholder="e.g. 14"
                      value={formData.age}
                      onChange={handleInputChange}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-teal-500 bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Clinical Diagnostic Notes</label>
                    <textarea
                      name="clinicalNotes"
                      rows="2"
                      placeholder="e.g. Refractory childhood focal epilepsy, under CHB-MIT surveillance protocol."
                      value={formData.clinicalNotes}
                      onChange={handleInputChange}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-teal-500"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* MANDATORY Caretaker Section */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    2. Mandatory Caretaker Emergency Contact
                  </h4>
                </div>

                <div className="bg-teal-50/60 border border-teal-100 rounded-xl p-3.5 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Caretaker Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="caretakerName"
                        required
                        placeholder="e.g. Ramesh Sharma"
                        value={formData.caretakerName}
                        onChange={handleInputChange}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-teal-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Relationship to Patient <span className="text-rose-500">*</span>
                      </label>
                      <select
                        name="caretakerRelationship"
                        value={formData.caretakerRelationship}
                        onChange={handleInputChange}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-teal-500 bg-white"
                      >
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Guardian">Guardian</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Caregiver">Professional Caregiver</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Emergency Phone (+E.164 with Country Code) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        name="caretakerPhone"
                        required
                        placeholder="+919876543210 or +14155552671"
                        value={formData.caretakerPhone}
                        onChange={handleInputChange}
                        className="w-full text-xs pl-8 pr-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-teal-500 bg-white font-mono"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Must begin with '+' followed by country code. Verified by Google Phonenumbers.
                    </p>
                  </div>

                  {/* SMS Consent Checkbox */}
                  <div className="pt-2 border-t border-teal-200/50">
                    <label className="flex items-start space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        name="caretakerSmsConsent"
                        checked={formData.caretakerSmsConsent}
                        onChange={handleInputChange}
                        className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                        required
                      />
                      <span className="text-xs text-slate-700 leading-tight">
                        <strong className="text-teal-900 font-semibold">Consent Confirmation:</strong> The caretaker has explicitly consented to receive automated emergency SMS monitoring alerts when high-risk epileptiform EEG discharges occur.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-xs text-slate-600 hover:text-slate-800 px-4 py-2 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold px-5 py-2 rounded-lg shadow-sm shadow-teal-600/20 disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Complete Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patients;
