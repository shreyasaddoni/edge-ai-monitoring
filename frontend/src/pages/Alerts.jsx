import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  PhoneCall,
  Clock,
  ExternalLink,
  ShieldAlert,
  Send,
  XCircle,
  Radio,
  Trash2
} from 'lucide-react';

export const Alerts = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('alerts'); // 'alerts' or 'smsHistory'

  // Filters
  const [riskFilter, setRiskFilter] = useState('');
  const [unackOnly, setUnackOnly] = useState(false);
  const [search, setSearch] = useState('');

  // Action states
  const [actionLoading, setActionLoading] = useState({});
  const [statusMsg, setStatusMsg] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [alertsRes, notifsRes] = await Promise.all([
        api.getAlerts({
          riskCategory: riskFilter || undefined,
          unacknowledged: unackOnly ? 'true' : undefined
        }),
        api.getNotifications()
      ]);
      setAlerts(alertsRes.data.alerts || []);
      setNotifications(notifsRes.data.notifications || []);
    } catch (err) {
      console.error("Failed to load alerts data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [riskFilter, unackOnly]);

  const handleAcknowledge = async (alertId) => {
    setActionLoading(prev => ({ ...prev, [alertId]: true }));
    setStatusMsg('');
    try {
      await api.acknowledgeAlert(alertId);
      setStatusMsg(`Alert ${alertId} acknowledged successfully.`);
      fetchData();
    } catch (err) {
      setStatusMsg(err.response?.data?.error || "Failed to acknowledge alert.");
    } finally {
      setActionLoading(prev => ({ ...prev, [alertId]: false }));
    }
  };

  const handleRetrySMS = async (alertId) => {
    setActionLoading(prev => ({ ...prev, [alertId]: true }));
    setStatusMsg('');
    try {
      const res = await api.retryNotification(alertId);
      setStatusMsg(`SMS notification retry executed: Status '${res.data.result?.deliveryStatus}'.`);
      fetchData();
    } catch (err) {
      setStatusMsg(err.response?.data?.error || "SMS retry failed.");
    } finally {
      setActionLoading(prev => ({ ...prev, [alertId]: false }));
    }
  };

  const handleDeleteAlert = async (alertId) => {
    if (!window.confirm(`Are you sure you want to permanently delete alert ${alertId}?`)) {
      return;
    }
    setActionLoading(prev => ({ ...prev, [alertId]: true }));
    setStatusMsg('');
    try {
      await api.deleteAlert(alertId);
      setStatusMsg(`Alert ${alertId} deleted successfully.`);
      fetchData();
    } catch (err) {
      setStatusMsg(err.response?.data?.error || "Failed to delete alert.");
    } finally {
      setActionLoading(prev => ({ ...prev, [alertId]: false }));
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to permanently clear all alert records and notification logs? This action cannot be undone.")) {
      return;
    }
    setStatusMsg('');
    try {
      await api.clearAllAlerts();
      setStatusMsg("All alert records and notification logs cleared.");
      fetchData();
    } catch (err) {
      setStatusMsg(err.response?.data?.error || "Failed to clear alerts.");
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      a.alertId?.toLowerCase().includes(term) ||
      a.patientName?.toLowerCase().includes(term) ||
      a.patientId?.toLowerCase().includes(term)
    );
  });

  const getSmsBadge = (status) => {
    switch (status) {
      case 'delivered':
        return <span className="inline-flex items-center text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">Delivered</span>;
      case 'submitted':
      case 'queued':
      case 'sent':
        return <span className="inline-flex items-center text-xs font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">Submitted / In-Flight</span>;
      case 'in_app_only':
      case 'in_app_simulated':
        return <span className="inline-flex items-center text-xs font-semibold text-purple-800 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">In-App Simulated (Zero-Cost)</span>;
      case 'failed':
      case 'undelivered':
        return <span className="inline-flex items-center text-xs font-semibold text-red-800 bg-red-100 px-2 py-0.5 rounded border border-red-200">Delivery Failed</span>;
      default:
        return <span className="inline-flex items-center text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{status || 'None'}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            High-Risk Seizure Alerts & Caretaker SMS Dispatch
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit high-risk event detection, physician acknowledgements, and Twilio SMS notification status
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Switcher */}
          <div className="flex items-center space-x-1 bg-slate-200/80 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveView('alerts')}
              className={`px-3 py-1.5 rounded-md transition ${
                activeView === 'alerts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Clinical Alerts ({alerts.length})
            </button>
            <button
              onClick={() => setActiveView('smsHistory')}
              className={`px-3 py-1.5 rounded-md transition ${
                activeView === 'smsHistory' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Caretaker SMS Dispatches ({notifications.length})
            </button>
          </div>

          {alerts.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center space-x-1.5 text-xs text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shadow-xs"
              title="Clear all alerts and dispatch logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg('')} className="font-bold">&times;</button>
        </div>
      )}

      {/* Main Alerts Table */}
      {activeView === 'alerts' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search alert, patient name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-slate-50/50"
              />
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={unackOnly}
                  onChange={(e) => setUnackOnly(e.target.checked)}
                  className="rounded text-teal-600"
                />
                <span>Pending Review Only</span>
              </label>

              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-slate-50/50 text-slate-700"
              >
                <option value="">All Risk Levels</option>
                <option value="High">High Risk Only</option>
                <option value="Medium">Medium Risk</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredAlerts.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No alert records match the selected criteria.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                    <th className="py-3 px-4">Alert ID</th>
                    <th className="py-3 px-4">Patient Profile</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Model Output</th>
                    <th className="py-3 px-4">Risk Level</th>
                    <th className="py-3 px-4">Caretaker SMS Status</th>
                    <th className="py-3 px-4">Physician Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAlerts.map((alt) => {
                    const isFailed = alt.notificationStatus === 'failed' || alt.notificationStatus === 'undelivered';
                    return (
                      <tr key={alt.alertId} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                          {alt.alertId}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{alt.patientName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{alt.patientId}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {alt.createdAt?.replace('T', ' ').slice(0, 19)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {alt.modelOutput ? `${(alt.modelOutput * 100).toFixed(1)}%` : '--'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            {alt.riskCategory}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {getSmsBadge(alt.notificationStatus)}
                        </td>
                        <td className="py-3.5 px-4">
                          {alt.acknowledgedAt ? (
                            <div className="text-emerald-700 text-xs font-semibold flex items-center">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              <span>Acknowledged</span>
                            </div>
                          ) : (
                            <span className="text-amber-700 text-xs font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Requires Sign-off
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {isFailed && (
                              <button
                                onClick={() => handleRetrySMS(alt.alertId)}
                                disabled={actionLoading[alt.alertId]}
                                title="Retry Caretaker SMS"
                                className="flex items-center space-x-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 px-2.5 py-1 rounded border border-rose-200 transition"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Retry SMS</span>
                              </button>
                            )}

                            {!alt.acknowledgedAt && (
                              <button
                                onClick={() => handleAcknowledge(alt.alertId)}
                                disabled={actionLoading[alt.alertId]}
                                className="text-[11px] bg-teal-600 hover:bg-teal-700 text-white font-medium px-2.5 py-1 rounded transition disabled:opacity-50"
                              >
                                {actionLoading[alt.alertId] ? 'Signing...' : 'Acknowledge'}
                              </button>
                            )}

                            <Link
                              to={`/patients/${alt.patientId}`}
                              className="text-slate-500 hover:text-slate-800 p-1"
                              title="View Patient Record"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>

                            <button
                              onClick={() => handleDeleteAlert(alt.alertId)}
                              disabled={actionLoading[alt.alertId]}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer disabled:opacity-40"
                              title="Delete Alert Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* SMS Caretaker Dispatch History View */}
      {activeView === 'smsHistory' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80">
            <h3 className="text-sm font-bold text-slate-900">Twilio Caretaker SMS Notification Ledger</h3>
            <p className="text-xs text-slate-400 mt-0.5">Full audit trail of automated emergency caretaker messages</p>
          </div>

          <div className="overflow-x-auto">
            {notifications.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                No caretaker SMS messages logged yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                    <th className="py-3 px-4">Notification ID</th>
                    <th className="py-3 px-4">Caretaker Recipient</th>
                    <th className="py-3 px-4">Twilio Message SID</th>
                    <th className="py-3 px-4">Submission Status</th>
                    <th className="py-3 px-4">Delivery Status</th>
                    <th className="py-3 px-4">Dispatched At</th>
                    <th className="py-3 px-4">Retries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {notifications.map((n) => (
                    <tr key={n.notificationId} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-slate-700">{n.notificationId}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{n.caretakerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{n.recipientPhoneMasked}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {n.twilioMessageSid || 'N/A'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {n.submissionStatus}
                      </td>
                      <td className="py-3 px-4">
                        {getSmsBadge(n.deliveryStatus)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {n.createdAt?.replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="py-3 px-4 font-mono">{n.retryCount || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Alerts;
