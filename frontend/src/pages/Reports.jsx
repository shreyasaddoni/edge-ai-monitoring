import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  FileText,
  Download,
  Filter,
  Users,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Search,
  Activity,
  ClipboardList
} from 'lucide-react';


export const Reports = () => {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInit = async () => {
      try {
        const pRes = await api.getPatients();
        setPatients(pRes.data.patients || []);
        fetchHistory('');
      } catch (err) {
        console.error("Reports init error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadInit();
  }, []);

  const fetchHistory = async (patientId, risk) => {
    try {
      setLoading(true);
      const res = await api.getHistory({
        patientId: patientId || undefined,
        riskCategory: risk || undefined,
        limit: 100
      });
      setHistory(res.data.history || []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientChange = (pId) => {
    setSelectedPatientId(pId);
    fetchHistory(pId, riskFilter);
  };

  const handleRiskChange = (risk) => {
    setRiskFilter(risk);
    fetchHistory(selectedPatientId, risk);
  };

  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      const res = await api.exportPdf({ patientId: selectedPatientId || undefined });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `clinical_report_${selectedPatientId || 'cohort'}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF Export error:", err);
      alert("Failed to export PDF report. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const res = await api.exportCsv({ patientId: selectedPatientId || undefined });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `eeg_monitoring_report_${selectedPatientId || 'cohort'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export CSV report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const totalWindows = history.length;
  const highRiskWindows = history.filter(h => h.riskCategory === 'High').length;
  const medRiskWindows = history.filter(h => h.riskCategory === 'Medium').length;
  const lowRiskWindows = history.filter(h => h.riskCategory === 'Low').length;

  return (
    <div className="space-y-6">
      {/* Title & Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Clinical EEG Analysis & Seizure Surveillance Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit historical processed windows, feature extractions, and export compliance reports
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto flex-wrap gap-y-2">
          <Link
            to="/records"
            className="flex items-center space-x-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs transition"
          >
            <ClipboardList className="w-4 h-4 text-teal-600" />
            <span>Discharged Records (Latest 10)</span>
          </Link>

          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="flex items-center space-x-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm shadow-teal-600/20 transition disabled:opacity-50 cursor-pointer"
            title="Export official clinical PDF report"
          >
            <FileText className="w-4 h-4" />
            <span>{exportingPdf ? 'Generating PDF...' : (selectedPatientId ? 'Export Patient PDF' : 'Export Cohort PDF')}</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center space-x-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? 'Generating CSV...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>


      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Analyzed Windows</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalWindows}</p>
          <span className="text-[11px] text-slate-400">2.0s EEG epochs</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">High-Risk Events</span>
          <p className="text-2xl font-bold text-red-600 mt-1">{highRiskWindows}</p>
          <span className="text-[11px] text-red-500 font-medium">Likelihood &ge; 70%</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Medium-Risk Events</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{medRiskWindows}</p>
          <span className="text-[11px] text-amber-500 font-medium">40% - 70% likelihood</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Normal / Low-Risk</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{lowRiskWindows}</p>
          <span className="text-[11px] text-emerald-500 font-medium">&lt; 40% likelihood</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-700">Filter by Patient:</span>
          <select
            value={selectedPatientId}
            onChange={(e) => handlePatientChange(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-slate-50/50"
          >
            <option value="">All Cohort Patients</option>
            {patients.map((p) => (
              <option key={p.patientId} value={p.patientId}>
                {p.name} ({p.patientId})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-700">Filter by Risk:</span>
          <select
            value={riskFilter}
            onChange={(e) => handleRiskChange(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-slate-50/50"
          >
            <option value="">All Risk Tiers</option>
            <option value="High">High Risk Only</option>
            <option value="Medium">Medium Risk</option>
            <option value="Low">Low Risk</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/80">
          <h3 className="text-sm font-bold text-slate-900">Analyzed EEG Epoch Records</h3>
        </div>

        <div className="overflow-x-auto">
          {history.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              No historical records found for this criteria. Start a streaming session to log epochs.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-3 px-4">Prediction ID</th>
                  <th className="py-3 px-4">Patient ID</th>
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-4">Model Output</th>
                  <th className="py-3 px-4">Risk Category</th>
                  <th className="py-3 px-4">Delta Power</th>
                  <th className="py-3 px-4">Theta Power</th>
                  <th className="py-3 px-4">Alpha Power</th>
                  <th className="py-3 px-4">Beta Power</th>
                  <th className="py-3 px-4">RMS (µV)</th>
                  <th className="py-3 px-4">Signal Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => {
                  const prob = (h.modelProbability * 100).toFixed(1);
                  const isHigh = h.riskCategory === 'High';
                  const isMed = h.riskCategory === 'Medium';
                  return (
                    <tr key={h.predictionId} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-slate-800">{h.predictionId}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{h.patientId}</td>
                      <td className="py-3 px-4 text-slate-500">{h.timestamp?.replace('T', ' ').slice(0, 19)}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{prob}%</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isHigh ? 'bg-red-100 text-red-800' :
                          isMed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {h.riskCategory}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{h.features?.delta_power?.toFixed(2) || '--'}</td>
                      <td className="py-3 px-4 font-mono">{h.features?.theta_power?.toFixed(2) || '--'}</td>
                      <td className="py-3 px-4 font-mono">{h.features?.alpha_power?.toFixed(2) || '--'}</td>
                      <td className="py-3 px-4 font-mono">{h.features?.beta_power?.toFixed(2) || '--'}</td>
                      <td className="py-3 px-4 font-mono">{h.features?.rms?.toFixed(2) || '--'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          h.signalQuality?.acceptable ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {h.signalQuality?.acceptable ? 'Clean' : 'Artifact'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
