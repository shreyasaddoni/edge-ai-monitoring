import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardList,
  Search,
  RotateCcw,
  Eye,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  HeartHandshake,
  ShieldAlert,
  ShieldCheck,
  Activity,
  FileText,
  UserCheck,
  ChevronRight,
  Database,
  Info
} from 'lucide-react';

export const Records = () => {
  const { user } = useAuth();
  const isCaretaker = user?.role === 'Caretaker';
  const navigate = useNavigate();


  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('overview');

  const [restoringId, setRestoringId] = useState(null);
  const [purgingId, setPurgingId] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState({});
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

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

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await api.getDischargedPatients();
      setRecords(res.data.dischargedPatients || []);
    } catch (err) {
      console.error("Failed to load discharged records:", err);
      setStatusMsg({ type: 'error', text: 'Failed to retrieve discharged patient records.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleRestore = async (patientId, name) => {
    if (!window.confirm(`Restore patient ${name} (${patientId}) back to the Active Patient Registry?`)) {
      return;
    }
    setRestoringId(patientId);
    setStatusMsg({ type: '', text: '' });
    try {
      await api.restoreDischargedPatient(patientId);
      setStatusMsg({
        type: 'success',
        text: `Patient ${name} successfully restored to active patient registry.`
      });
      fetchRecords();
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to restore patient.'
      });
    } finally {
      setRestoringId(null);
    }
  };

  const handlePurge = async (patientId, name) => {
    if (!window.confirm(`Permanently remove archived record for ${name} (${patientId}) from database? This action cannot be undone.`)) {
      return;
    }
    setPurgingId(patientId);
    setStatusMsg({ type: '', text: '' });
    try {
      await api.deleteDischargedRecord(patientId);
      setStatusMsg({
        type: 'success',
        text: `Archived record for ${name} was permanently removed.`
      });
      if (selectedRecord?.patientId === patientId) {
        setSelectedRecord(null);
      }
      fetchRecords();
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to delete record.'
      });
    } finally {
      setPurgingId(null);
    }
  };

  const filteredRecords = records.filter((r) => {
    const q = search.toLowerCase();
    return (
      search === '' ||
      r.name?.toLowerCase().includes(q) ||
      r.patientId?.toLowerCase().includes(q) ||
      r.caretakerName?.toLowerCase().includes(q) ||
      r.dischargeReason?.toLowerCase().includes(q)
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2.5">
            <ClipboardList className="w-6 h-6 text-teal-600" />
            <span>Discharged Patient Records & Clinical History</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Preserved medical details and historical EEG telemetry for discharged patients
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/patients')}
            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-lg shadow-xs transition"
          >
            <span>Back to Active Registry</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Database Capacity & Retention Policy Callout */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-4 sm:p-5 shadow-sm border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 flex-shrink-0 mt-0.5">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white">Database Overflow Prevention Policy</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Strict FIFO Retention: 10 Records Max
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
              When patients are discharged from the active registry, their complete demographics, clinical notes, and historical EEG epoch records are archived here. To ensure zero-cost edge database stability without memory or disk overflow, the system strictly preserves the <strong>latest 10 discharged patients</strong>, automatically pruning older archives.
            </p>
          </div>
        </div>

        {/* Capacity Meter */}
        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700/50 flex flex-col items-center justify-center min-w-[170px] flex-shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">Archive Slot Utilization</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-teal-400">{records.length}</span>
            <span className="text-xs text-slate-400 font-semibold">/ 10 Slots</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                records.length >= 10 ? 'bg-amber-400' : 'bg-teal-400'
              }`}
              style={{ width: `${Math.min(100, (records.length / 10) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {statusMsg.text && (
        <div className={`border text-xs px-4 py-3 rounded-xl flex items-center justify-between ${
          statusMsg.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center space-x-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg({ type: '', text: '' })} className="font-bold">&times;</button>
        </div>
      )}

      {/* Search & Records Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by patient name, ID, or discharge reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-slate-50/50"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Displaying: <strong className="text-slate-800">{filteredRecords.length}</strong> of {records.length} archived records
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Loading archived patient records...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Discharged Patient Records Yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                When patients are deleted or discharged from the active registry, their full details and EEG history are safely recorded here.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Archived Patient</th>
                  <th className="py-3 px-4">Admission & Discharge</th>
                  <th className="py-3 px-4">Discharge Reason</th>
                  <th className="py-3 px-4">Caretaker Contact</th>
                  <th className="py-3 px-4">Historical Activity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => (
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
                        {(r.highRiskCount > 0) && (
                          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            {r.highRiskCount} High
                          </span>
                        )}
                        {(r.mediumRiskCount > 0) && (
                          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            {r.mediumRiskCount} Med
                          </span>
                        )}
                        {(r.totalAlertsCount > 0) && (
                          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            {r.totalAlertsCount} Alerts
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Inspect Details & History */}
                        <button
                          onClick={() => { setSelectedRecord(r); setActiveModalTab('overview'); }}
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-700 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 px-2.5 py-1 rounded transition"
                          title="Inspect Details & History"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View History</span>
                        </button>

                        {/* Download PDF Report */}
                        <button
                          onClick={() => handleDownloadPdf(r.patientId, r.name)}
                          disabled={downloadingPdf[r.patientId]}
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded transition cursor-pointer disabled:opacity-50"
                          title="Download Patient History PDF Report"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{downloadingPdf[r.patientId] ? 'PDF...' : 'PDF Report'}</span>
                        </button>

                        {!isCaretaker && (
                          <>
                            {/* Restore Patient */}
                            <button
                              onClick={() => handleRestore(r.patientId, r.name)}
                              disabled={restoringId === r.patientId}
                              className="p-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded transition disabled:opacity-50"
                              title="Restore to Active Patient Registry"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${restoringId === r.patientId ? 'animate-spin' : ''}`} />
                            </button>

                            {/* Purge Record */}
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

      {/* Discharged Patient History & Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center font-bold text-base">
                  {selectedRecord.name?.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white">{selectedRecord.name}</h3>
                    <span className="font-mono text-xs text-teal-300 bg-slate-800 px-2 py-0.5 rounded">
                      {selectedRecord.patientId}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Discharged
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Discharged on {formatDate(selectedRecord.dischargedAt)} • {selectedRecord.dischargeReason}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-white text-xl font-bold leading-none p-1"
              >
                &times;
              </button>
            </div>

            {/* Modal Navigation Tabs */}
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
                2. EEG Telemetry History ({selectedRecord.history?.length || 0})
              </button>
              <button
                onClick={() => setActiveModalTab('alerts')}
                className={`py-3 text-xs font-semibold border-b-2 transition ${
                  activeModalTab === 'alerts'
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                3. Alert Log ({selectedRecord.alerts?.length || 0})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {activeModalTab === 'overview' && (
                <div className="space-y-4">
                  {/* Demographics & Clinical Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                        Clinical Demographics
                      </h4>
                      <dl className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Age:</dt>
                          <dd className="font-medium text-slate-800">{selectedRecord.age || 'N/A'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Gender:</dt>
                          <dd className="font-medium text-slate-800">{selectedRecord.gender || 'Not specified'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Assigned Doctor:</dt>
                          <dd className="font-medium text-slate-800">{selectedRecord.assignedDoctorName || 'Dr. Attending'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Admission Date:</dt>
                          <dd className="font-medium text-slate-800">{formatDate(selectedRecord.admittedAt || selectedRecord.createdAt)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Discharge Date:</dt>
                          <dd className="font-medium text-slate-800">{formatDate(selectedRecord.dischargedAt)}</dd>
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
                          <dd className="font-medium text-slate-800">{selectedRecord.caretakerName || 'N/A'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Relationship:</dt>
                          <dd className="font-medium text-slate-800">{selectedRecord.caretakerRelationship || 'Family'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Emergency Phone:</dt>
                          <dd className="font-mono font-medium text-slate-800">
                            {selectedRecord.caretakerPhoneMasked || selectedRecord.caretakerPhone || 'Unrecorded'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">SMS Consent:</dt>
                          <dd className="font-medium text-emerald-700">Verified & Confirmed</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Clinical Notes & Discharge Reason */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                      Clinical Diagnostic Notes & Discharge Evaluation
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {selectedRecord.clinicalNotes || 'No additional clinical diagnosis notes recorded for this patient.'}
                    </p>
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs flex items-center justify-between text-slate-500">
                      <span>Reason: <strong className="text-slate-700">{selectedRecord.dischargeReason}</strong></span>
                      <span>Evaluated By: <strong className="text-slate-700">{selectedRecord.dischargedBy || 'Attending Physician'}</strong></span>
                    </div>
                  </div>

                  {/* Telemetry Summary Stats */}
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-100 rounded-lg p-2.5">
                      <span className="text-[11px] text-slate-500">Total Epochs</span>
                      <p className="text-base font-bold text-slate-900 mt-0.5">{selectedRecord.totalPredictionsCount || selectedRecord.history?.length || 0}</p>
                    </div>
                    <div className="bg-rose-50 border border-rose-200/60 rounded-lg p-2.5">
                      <span className="text-[11px] text-rose-700">High Risk (Seizure)</span>
                      <p className="text-base font-bold text-rose-800 mt-0.5">{selectedRecord.highRiskCount || 0}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-2.5">
                      <span className="text-[11px] text-amber-700">Medium Risk</span>
                      <p className="text-base font-bold text-amber-800 mt-0.5">{selectedRecord.mediumRiskCount || 0}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200/60 rounded-lg p-2.5">
                      <span className="text-[11px] text-emerald-700">Low Risk (Normal)</span>
                      <p className="text-base font-bold text-emerald-800 mt-0.5">{selectedRecord.lowRiskCount || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'history' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Processed 2.0-second EEG epochs preserved in record archive:</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDownloadPdf(selectedRecord.patientId, selectedRecord.name)}
                        disabled={downloadingPdf[selectedRecord.patientId]}
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded transition cursor-pointer disabled:opacity-50"
                        title="Download Complete Clinical History PDF Report"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{downloadingPdf[selectedRecord.patientId] ? 'Generating PDF...' : 'Download PDF Report'}</span>
                      </button>
                      <a
                        href={api.getExportCsvUrl(selectedRecord.patientId)}
                        download
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 rounded transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download CSV</span>
                      </a>
                    </div>
                  </div>

                  {(!selectedRecord.history || selectedRecord.history.length === 0) ? (
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
                          {selectedRecord.history.map((h, idx) => (
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
                  {(!selectedRecord.alerts || selectedRecord.alerts.length === 0) ? (
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
                          {selectedRecord.alerts.map((a, idx) => (
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

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => handlePurge(selectedRecord.patientId, selectedRecord.name)}
                className="flex items-center space-x-1.5 text-xs text-rose-600 hover:text-rose-800 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Permanently Purge Record</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleRestore(selectedRecord.patientId, selectedRecord.name)}
                  className="flex items-center space-x-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore to Active Registry</span>
                </button>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Records;
