import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  Users,
  Activity,
  Radio,
  Bell,
  HeartHandshake,
  FileText,
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  Save,
  Send,
  AlertOctagon,
  ChevronLeft,
  Trash2
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export const PatientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Edit Caretaker State
  const [caretakerForm, setCaretakerForm] = useState({
    caretakerName: '',
    caretakerPhone: '',
    caretakerRelationship: 'Father',
    caretakerSmsConsent: true,
  });
  const [savingCaretaker, setSavingCaretaker] = useState(false);
  const [caretakerMsg, setCaretakerMsg] = useState('');

  // Discharge State & Handler
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeReason, setDischargeReason] = useState('Treatment Completed / Seizures Stabilized');
  const [discharging, setDischarging] = useState(false);

  const handleConfirmDischarge = async () => {
    try {
      setDischarging(true);
      await api.deletePatient(id, { reason: dischargeReason });
      navigate('/patients?tab=discharged');
    } catch (err) {
      alert(err.response?.data?.error || "Failed to discharge patient.");
    } finally {
      setDischarging(false);
    }
  };

  // Alerts acknowledge
  const [ackLoading, setAckLoading] = useState({});
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!patient) return;
    try {
      setDownloadingPdf(true);
      const res = await api.exportPdf({ patientId: patient.patientId });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `clinical_report_${(patient.name || 'patient').toLowerCase().replace(/\s+/g, '_')}_${patient.patientId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download PDF report:", err);
      alert("Failed to generate PDF report. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };


  const fetchPatient = async () => {
    try {
      setLoading(true);
      const res = await api.getPatient(id);
      const p = res.data.patient;
      setPatient(p);
      setCaretakerForm({
        caretakerName: p.caretakerName || '',
        caretakerPhone: p.caretakerPhone || '',
        caretakerRelationship: p.caretakerRelationship || 'Father',
        caretakerSmsConsent: p.caretakerSmsConsent ?? true,
      });
    } catch (err) {
      console.error("Failed to fetch patient:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatient();
  }, [id]);

  const handleCaretakerSave = async (e) => {
    e.preventDefault();
    setSavingCaretaker(true);
    setCaretakerMsg('');
    try {
      await api.updateCaretaker(id, caretakerForm);
      setCaretakerMsg("Caretaker details & emergency phone updated successfully.");
      fetchPatient();
    } catch (err) {
      setCaretakerMsg(err.response?.data?.error || "Failed to update caretaker details.");
    } finally {
      setSavingCaretaker(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    setAckLoading(prev => ({ ...prev, [alertId]: true }));
    try {
      await api.acknowledgeAlert(alertId);
      fetchPatient();
    } catch (err) {
      console.error("Error acknowledging alert:", err);
    } finally {
      setAckLoading(prev => ({ ...prev, [alertId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <p className="text-sm text-slate-500 font-medium">Loading patient clinical file...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="bg-white p-8 rounded-xl text-center border border-slate-200">
        <p className="text-slate-600 font-medium">Patient record not found.</p>
        <button
          onClick={() => navigate('/patients')}
          className="mt-3 text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: '1. Overview' },
    { id: 'monitoring', label: '2. EEG Telemetry' },
    { id: 'analysis', label: '3. Risk Analysis' },
    { id: 'history', label: '4. Prediction History' },
    { id: 'alerts', label: '5. Alerts & SMS' },
    { id: 'caretaker', label: '6. Caretaker Details' },
    { id: 'clinical', label: '7. Patient Info' },
  ];

  const recentPreds = patient.recentPredictions || [];
  const latestPred = patient.latestPrediction;

  // Chart data for historical risk trend
  const trendData = [...recentPreds].reverse().map((p) => ({
    time: p.timestamp ? p.timestamp.split('T')[1]?.slice(0, 8) : '',
    probability: roundPct(p.modelProbability),
    risk: p.riskCategory
  }));

  function roundPct(val) {
    return val ? Math.round(val * 100) : 0;
  }

  return (
    <div className="space-y-6">
      {/* Patient Header Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/patients')}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center text-lg font-bold">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {patient.patientId}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  patient.monitoringStatus === 'active'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {patient.monitoringStatus === 'active' ? '● Streaming' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Age: {patient.age || 'N/A'} • {patient.gender} • Doctor: {patient.assignedDoctorName}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
              title="Download Complete Patient Clinical History Report (PDF)"
            >
              <FileText className="w-4 h-4 text-teal-600" />
              <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
            </button>

            <button
              onClick={() => navigate(`/monitoring?patientId=${patient.patientId}`)}
              className="flex items-center space-x-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm shadow-teal-600/20 transition"
            >
              <Radio className="w-4 h-4" />
              <span>Launch Live Telemetry</span>
            </button>

            <button
              onClick={() => setShowDischargeModal(true)}
              className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-3 py-2 rounded-lg transition"
              title="Discharge patient and archive details to Record Tab"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discharge Patient</span>
            </button>
          </div>

        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto space-x-1 border-b border-slate-200 mt-6 pt-1 text-xs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Latest Risk Estimation */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Latest Risk Estimation
              </span>
              <div className="mt-3 text-3xl font-extrabold text-slate-900">
                {latestPred ? `${(latestPred.modelProbability * 100).toFixed(1)}%` : 'No Analysis'}
              </div>
              <div className="mt-2">
                {latestPred?.riskCategory === 'High' && (
                  <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-full border border-red-200">
                    <ShieldAlert className="w-3.5 h-3.5 mr-1" /> High Risk (≥70%)
                  </span>
                )}
                {latestPred?.riskCategory === 'Medium' && (
                  <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Medium Risk (40-70%)
                  </span>
                )}
                {latestPred?.riskCategory === 'Low' && (
                  <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Low Risk (&lt;40%)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-3">
                Timestamp: {latestPred?.timestamp ? latestPred.timestamp.replace('T', ' ').slice(0, 19) : 'None'}
              </p>
            </div>

            {/* Caretaker Notification Info */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Emergency Caretaker
              </span>
              <p className="text-lg font-bold text-slate-900 mt-2">
                {patient.caretakerName}
              </p>
              <p className="text-xs text-slate-600 font-mono mt-0.5">
                {patient.caretakerPhoneMasked || patient.caretakerPhone}
              </p>
              <div className="mt-3">
                <span className="inline-flex items-center text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  SMS Alerts Authorized
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Relationship: {patient.caretakerRelationship}
              </p>
            </div>

            {/* Quick Stream Launch */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
                  Edge AI Telemetry
                </span>
                <p className="text-sm font-semibold mt-1">Simulate Wearable Patch Streaming</p>
                <p className="text-xs text-slate-300 mt-1">
                  Processes 2.0s epochs using 4th order Butterworth bandpass filter and Welch PSD.
                </p>
              </div>
              <button
                onClick={() => navigate(`/monitoring?patientId=${patient.patientId}`)}
                className="mt-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs py-2 px-3.5 rounded-lg transition"
              >
                Start Telemetry Stream
              </button>
            </div>
          </div>

          {/* Historical Trend Chart */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Patient Seizure Risk Trajectory (Recent Epochs)
            </h3>
            <div className="h-56">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} unit="%" />
                    <Tooltip
                      formatter={(v) => [`${v}%`, 'Risk Probability']}
                      contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#fff', fontSize: '11px' }}
                    />
                    <Area type="monotone" dataKey="probability" stroke="#0D9488" fill="#0D9488" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  No prediction history recorded yet. Run a monitoring session.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: EEG Telemetry */}
      {activeTab === 'monitoring' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center shadow-xs">
          <Radio className="w-12 h-12 text-teal-600 mx-auto mb-3 animate-pulse" />
          <h3 className="text-base font-bold text-slate-900">Dedicated Telemetry Console</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Switch to the Live EEG Monitoring interface to configure EEG recordings, select channels, and stream real-time batches.
          </p>
          <button
            onClick={() => navigate(`/monitoring?patientId=${patient.patientId}`)}
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-sm"
          >
            Open Live EEG Telemetry
          </button>
        </div>
      )}

      {/* Tab 3: Risk Analysis */}
      {activeTab === 'analysis' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Clinical Risk Classification Metrics</h3>
          <p className="text-xs text-slate-500">
            Model estimates are generated using a 100-tree Scikit-learn Random Forest model trained on time-domain statistics and frequency-domain band powers.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="border border-emerald-200 bg-emerald-50/50 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-emerald-800 uppercase">Low Risk (&lt; 40%)</h4>
              <p className="text-xs text-slate-600 mt-1">Normal background rhythm (predominant alpha/beta, low delta amplitude).</p>
            </div>
            <div className="border border-amber-200 bg-amber-50/50 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-amber-800 uppercase">Medium Risk (40% - 70%)</h4>
              <p className="text-xs text-slate-600 mt-1">Interictal transients, moderate slowing, elevated theta/delta ratio.</p>
            </div>
            <div className="border border-red-200 bg-red-50/50 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-red-800 uppercase">High Risk (&ge; 70%)</h4>
              <p className="text-xs text-slate-600 mt-1">Ictal spike-wave complex, polymorphic slowing, automatic caretaker SMS trigger.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Prediction History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Analyzed EEG Window History</h3>
              <p className="text-xs text-slate-400 mt-0.5">Total Analyzed Windows: {recentPreds.length}</p>
            </div>
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex items-center space-x-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
              title="Download Complete Patient History Report"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{downloadingPdf ? 'Exporting PDF...' : 'Export History (PDF)'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-2.5 px-4">Prediction ID</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Model Output</th>
                  <th className="py-2.5 px-4">Risk Category</th>
                  <th className="py-2.5 px-4">Delta Power</th>
                  <th className="py-2.5 px-4">Slowing Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPreds.map((p) => (
                  <tr key={p.predictionId} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-700">{p.predictionId}</td>
                    <td className="py-2.5 px-4 text-slate-500">{p.timestamp?.split('T')[1]?.slice(0, 8)}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{roundPct(p.modelProbability)}%</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.riskCategory === 'High' ? 'bg-red-100 text-red-800' :
                        p.riskCategory === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {p.riskCategory}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono">{p.features?.delta_power?.toFixed(2) || '--'}</td>
                    <td className="py-2.5 px-4 font-mono">{p.features?.spectral_slowing_ratio?.toFixed(2) || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Alerts & SMS */}
      {activeTab === 'alerts' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80">
            <h3 className="text-sm font-bold text-slate-900">Alerts & Caretaker Notification History</h3>
          </div>

          <div className="overflow-x-auto">
            {patient.alerts?.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No alerts recorded for this patient.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                    <th className="py-2.5 px-4">Alert ID</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Risk Category</th>
                    <th className="py-2.5 px-4">SMS Status</th>
                    <th className="py-2.5 px-4">Physician Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patient.alerts?.map((alt) => (
                    <tr key={alt.alertId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{alt.alertId}</td>
                      <td className="py-2.5 px-4 text-slate-500">{alt.createdAt?.replace('T', ' ').slice(0, 19)}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                          {alt.riskCategory}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {alt.notificationStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {alt.acknowledgedAt ? (
                          <span className="text-emerald-700 text-[11px] font-medium flex items-center">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Acknowledged
                          </span>
                        ) : (
                          <span className="text-amber-700 text-[11px] font-medium">Pending Review</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {!alt.acknowledgedAt && (
                          <button
                            onClick={() => handleAcknowledge(alt.alertId)}
                            disabled={ackLoading[alt.alertId]}
                            className="bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-medium px-2.5 py-1 rounded transition disabled:opacity-50"
                          >
                            {ackLoading[alt.alertId] ? 'Signing...' : 'Acknowledge'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Caretaker Details */}
      {activeTab === 'caretaker' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs max-w-xl">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Emergency Caretaker Contact Configuration
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Manage the designated recipient and SMS consent for real-time seizure alerts.
          </p>

          {caretakerMsg && (
            <div className="mb-4 bg-teal-50 border border-teal-200 text-teal-800 text-xs p-3 rounded-lg">
              {caretakerMsg}
            </div>
          )}

          <form onSubmit={handleCaretakerSave} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Caretaker Name</label>
              <input
                type="text"
                value={caretakerForm.caretakerName}
                onChange={(e) => setCaretakerForm({ ...caretakerForm, caretakerName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Relationship</label>
              <select
                value={caretakerForm.caretakerRelationship}
                onChange={(e) => setCaretakerForm({ ...caretakerForm, caretakerRelationship: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Spouse">Spouse</option>
                <option value="Sibling">Sibling</option>
                <option value="Guardian">Legal Guardian</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Mobile Number (+E.164 Format)</label>
              <input
                type="tel"
                value={caretakerForm.caretakerPhone}
                onChange={(e) => setCaretakerForm({ ...caretakerForm, caretakerPhone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Example: +919876543210</span>
            </div>

            <div className="pt-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={caretakerForm.caretakerSmsConsent}
                  onChange={(e) => setCaretakerForm({ ...caretakerForm, caretakerSmsConsent: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="text-slate-700 font-medium">
                  Caretaker has granted explicit consent to receive automated SMS notifications
                </span>
              </label>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={savingCaretaker}
                className="flex items-center space-x-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingCaretaker ? 'Saving...' : 'Update Caretaker Information'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 7: Clinical Patient Info */}
      {activeTab === 'clinical' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs max-w-xl text-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Clinical Patient Profile</h3>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Patient ID:</span>
              <span className="font-mono font-semibold text-slate-800">{patient.patientId}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Full Name:</span>
              <span className="font-semibold text-slate-800">{patient.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Age & Gender:</span>
              <span className="text-slate-800">{patient.age} yrs • {patient.gender}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Assigned Neurologist:</span>
              <span className="text-slate-800 font-medium">{patient.assignedDoctorName}</span>
            </div>
            <div className="py-2">
              <span className="text-slate-500 block mb-1">Clinical Assessment Notes:</span>
              <p className="bg-slate-50 p-3 rounded-lg text-slate-700 border border-slate-100">
                {patient.clinicalNotes || 'No specific clinical notes documented.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Discharge Confirmation Modal */}
      {showDischargeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <h3 className="text-base font-bold">Discharge Patient & Move to Records</h3>
                  <p className="text-xs text-rose-100">Preserves full history in Record Tab</p>
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
                <div className="font-semibold text-slate-800 text-sm">{patient.name}</div>
                <div className="text-slate-500 font-mono mt-0.5">ID: {patient.patientId} • Age: {patient.age || 'N/A'}</div>
                <div className="text-slate-500 mt-1">Caretaker: {patient.caretakerName} ({patient.caretakerPhone})</div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start space-x-2.5 leading-relaxed">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold text-amber-950">Record Retention Safeguard:</strong> This patient's complete diagnostic details and historical EEG epochs will be safely archived to the <strong>Record Tab</strong>.
                  <div className="mt-1 text-[11px] text-amber-800">
                    To prevent database bloat, the system strictly retains the <strong>latest 10 discharged patients</strong> (FIFO retention).
                  </div>
                </div>
              </div>

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
    </div>
  );
};

export default PatientDetails;
