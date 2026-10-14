import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  Users,
  Radio,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  BellRing,
  Send,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  PieChart as PieIcon,
  CheckCircle2,
  Clock,
  PhoneCall
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { usePlayback } from '../context/PlaybackContext';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { playbackStatus, packetData, riskTrends, setRiskTrends } = usePlayback();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async (showSpinner = false) => {
    try {
      if (showSpinner) setRefreshing(true);
      const [statsRes, patientsRes] = await Promise.all([
        api.getDashboardStats(),
        api.getPatients()
      ]);
      setStats(statsRes.data);
      setPatients(patientsRes.data.patients || []);

      // If live trends haven't accumulated yet, seed from database trends
      if (statsRes.data?.predictionTrends?.length > 0 && riskTrends.length === 0) {
        setRiskTrends(statsRes.data.predictionTrends);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      if (showSpinner) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchDashboardData(true);
    // Background polling every 2.5s keeps active session counters and alert lists continuously live
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Filtered patients for the main table
  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      search === '' ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.patientId?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === '' || p.monitoringStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getRiskBadge = (category) => {
    switch (category) {
      case 'High':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">High Risk (≥70%)</span>;
      case 'Medium':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Medium Risk (40-70%)</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Low Risk (&lt;40%)</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Loading Clinical Dashboard Data...</p>
        </div>
      </div>
    );
  }

  const s = stats?.summary || {};
  const riskDistribution = stats?.riskDistribution || [];
  const displayTrends = riskTrends.length > 0 ? riskTrends : (stats?.predictionTrends || []);
  const recentAlerts = stats?.recentAlerts || [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Doctor Monitoring Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time continuous EEG seizure risk surveillance, wearable telemetry & caretaker alert status
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="flex items-center space-x-2 text-xs bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg font-medium transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
          </button>
          <button
            onClick={() => navigate('/patients?register=true')}
            className="flex items-center space-x-2 text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm shadow-teal-600/20 transition"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Register New Patient</span>
          </button>
        </div>
      </div>

      {/* 8 Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Patients */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Patients</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{s.totalPatients || 0}</p>
          <div className="flex items-center text-[11px] text-slate-400 mt-1">
            <span>Registered in Clinic</span>
          </div>
        </div>

        {/* Patients Monitored */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Live Monitored</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-teal-700 mt-2">{s.activeMonitoring || 0}</p>
          <div className="flex items-center text-[11px] text-teal-600 font-medium mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-1.5 pulse-indicator"></span>
            Streaming Batches
          </div>
        </div>

        {/* High-Risk Patients */}
        <div className="bg-white rounded-xl p-4 border border-red-100 shadow-xs hover:border-red-200 transition bg-gradient-to-br from-white to-red-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">High-Risk Patients</span>
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-2">{s.highRiskPatients || 0}</p>
          <div className="flex items-center text-[11px] text-red-600 font-medium mt-1">
            <span>Threshold &ge; 70%</span>
          </div>
        </div>

        {/* Unacknowledged Alerts */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pending Alerts</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <BellRing className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">{s.unacknowledgedAlerts || 0}</p>
          <div className="flex items-center text-[11px] text-slate-400 mt-1">
            <span>Requires Doctor Sign-off</span>
          </div>
        </div>

        {/* Low-Risk Patients */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Low-Risk Patients</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{s.lowRiskPatients || 0}</p>
          <div className="flex items-center text-[11px] text-emerald-600 mt-1">
            <span>&lt; 40% probability</span>
          </div>
        </div>

        {/* Medium-Risk Patients */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Medium-Risk</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">{s.mediumRiskPatients || 0}</p>
          <div className="flex items-center text-[11px] text-amber-600 mt-1">
            <span>40% - 70% range</span>
          </div>
        </div>

        {/* SMS Awaiting Status */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">SMS Queued/Sent</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-2">
            {(s.smsAwaitingStatus || 0) + (s.smsDelivered || 0)}
          </p>
          <div className="flex items-center text-[11px] text-slate-400 mt-1">
            <span>Caretaker Dispatches</span>
          </div>
        </div>

        {/* Failed SMS */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Failed SMS Alerts</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">{s.smsFailed || 0}</p>
          <div className="flex items-center text-[11px] text-slate-400 mt-1">
            <span>Eligible for Retry</span>
          </div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart: Patient Risk Distribution */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Patient Risk Distribution</h3>
              <p className="text-xs text-slate-400">Current cohort risk category split</p>
            </div>
            <PieIcon className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val, name) => [`${val} Patients`, name]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Area Chart: Real-time Seizure Risk Trends */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">EEG Seizure Risk Estimation Trends</h3>
                {playbackStatus === 'running' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                    LIVE STREAM ACTIVE
                  </span>
                ) : displayTrends.length > 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    {displayTrends.length} Windows
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Random Forest probability output (%) across consecutive 2.0s EEG analysis windows
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>Low (&lt;40%)</span>
                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-1"></span>Medium (40-70%)</span>
                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-rose-500 mr-1"></span>High (≥70%)</span>
              </div>
              <TrendingUp className="w-4 h-4 text-teal-600 shrink-0" />
            </div>
          </div>

          <div className="h-56">
            {displayTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayTrends}>
                  <defs>
                    <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} unit="%" />
                  <ReferenceLine
                    y={70}
                    stroke="#EF4444"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                    label={{ value: 'High Alert (70%)', position: 'insideTopRight', fill: '#EF4444', fontSize: 10 }}
                  />
                  <ReferenceLine
                    y={40}
                    stroke="#F59E0B"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    label={{ value: 'Elevated (40%)', position: 'insideTopLeft', fill: '#F59E0B', fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(val, name, item) => [
                      `${val}% (${item.payload?.riskCategory || 'Risk'})`,
                      'Seizure Probability'
                    ]}
                    labelFormatter={(label, items) => {
                      const item = items?.[0]?.payload;
                      return item?.clockTime
                        ? `Time: ${item.clockTime} (Recorded: ${item.time})`
                        : `Window: ${label}`;
                    }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="probability"
                    stroke="#0D9488"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#riskGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs space-y-1">
                <TrendingUp className="w-7 h-7 text-slate-300 animate-pulse" />
                <p>No recent prediction telemetry points.</p>
                <p className="text-[11px] text-slate-400">
                  Open <Link to="/monitoring" className="text-teal-600 font-semibold underline">Live EEG Monitoring</Link> and click "Start Playback" to stream real-time predictions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patient Monitoring Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Patient Monitoring Roster</h3>
            <p className="text-xs text-slate-400">Active patients, assigned doctors, and emergency caretaker configuration</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-slate-50/50"
              />
            </div>

            {/* Monitoring Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-slate-50/50 text-slate-700"
            >
              <option value="">All Monitoring</option>
              <option value="active">Active Monitoring</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {filteredPatients.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No matching patient records</p>
              <p className="text-xs text-slate-400 mt-1">Register a patient to begin monitoring EEG data.</p>
              <button
                onClick={() => navigate('/patients?register=true')}
                className="mt-4 text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium px-3.5 py-1.5 rounded-lg"
              >
                Register Patient
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Patient ID</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Assigned Doctor</th>
                  <th className="py-3 px-4">Monitoring Status</th>
                  <th className="py-3 px-4">Caretaker Contact</th>
                  <th className="py-3 px-4">SMS Consent</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map((patient) => {
                  const isActive = patient.monitoringStatus === 'active';
                  return (
                    <tr key={patient.patientId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {patient.patientId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{patient.name}</div>
                        <div className="text-[11px] text-slate-400">Age: {patient.age || 'N/A'} • {patient.gender || 'Unknown'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {patient.assignedDoctorName || 'Dr. Attending'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 pulse-indicator"></span>}
                          {isActive ? 'Active Stream' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{patient.caretakerName || 'Not configured'}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center mt-0.5">
                          <PhoneCall className="w-3 h-3 mr-1 text-slate-400" />
                          {patient.caretakerPhoneMasked || patient.caretakerPhone || 'No phone'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {patient.caretakerSmsConsent ? (
                          <span className="inline-flex items-center text-emerald-700 text-[11px] font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-slate-500 text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => navigate(`/monitoring?patientId=${patient.patientId}`)}
                            title="Open Wearable Telemetry"
                            className="p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded transition"
                          >
                            <Radio className="w-4 h-4" />
                          </button>
                          <Link
                            to={`/patients/${patient.patientId}`}
                            className="inline-flex items-center text-xs font-semibold text-slate-700 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 px-2.5 py-1 rounded transition"
                          >
                            <span>Details</span>
                            <ChevronRight className="w-3 h-3 ml-0.5" />
                          </Link>
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
    </div>
  );
};

export default Dashboard;
