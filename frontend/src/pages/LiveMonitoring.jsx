import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePlayback } from '../context/PlaybackContext';
import {
  Radio,
  UploadCloud,
  FileCheck,
  Play,
  Pause,
  RotateCcw,
  Square,
  Activity,
  Layers,
  Cpu,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  Sparkles,
  Download,
  AlertCircle,
  PhoneCall,
  Zap,
  Info,
  Plus,
  UserPlus,
  X,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Database,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

export const LiveMonitoring = () => {
  const { user } = useAuth();
  const isCaretaker = user?.role === 'Caretaker';

  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId') || '';

  // Playback Context (Persistent background streaming across tabs & parallel patients)
  const {
    patientSessions,
    setActivePatientId,
    getPatientState,
    selectPatientRecording,
    initPatientSession,
    startPatientPlayback,
    pausePatientPlayback,
    resumePatientPlayback,
    stopPatientPlayback,
    restartPatientPlayback,
    clearPatientSession,
    changePatientSpeed,
    changePatientChannel,
    refreshActiveSessions,
    setPlaybackError
  } = usePlayback();

  const [monitoringTab, setMonitoringTab] = useState('waveform'); // 'waveform' | 'trend' | 'dual'

  // Data states
  const [patients, setPatients] = useState([]);
  const [uploadedRecordings, setUploadedRecordings] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId);
  const [patientLocalRecording, setPatientLocalRecording] = useState({});

  useEffect(() => {
    if (selectedPatientId) {
      setActivePatientId(selectedPatientId);
    }
  }, [selectedPatientId, setActivePatientId]);

  const patientState = getPatientState(selectedPatientId);
  const session = patientState.session;
  const playbackStatus = patientState.playbackStatus;
  const playbackSpeed = patientState.playbackSpeed;
  const selectedChannel = patientState.selectedChannel;
  const packetData = patientState.packetData;
  const waveformData = patientState.waveformData;
  const riskTrends = patientState.riskTrends;
  const alertNotice = patientState.alertNotice;
  const playbackError = patientState.playbackError;
  const selectedRecordingId = patientState.recordingId || patientLocalRecording[selectedPatientId] || (uploadedRecordings[0]?.recordingId || '');

  // Upload Form states
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [sampleGenerating, setSampleGenerating] = useState(false);

  // Quick Register Patient Modal state
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '',
    gender: 'Male',
    clinicalNotes: '',
    caretakerName: '',
    caretakerPhone: '',
    caretakerRelationship: 'Parent',
    caretakerSmsConsent: true
  });
  const [patientSubmitting, setPatientSubmitting] = useState(false);
  const [patientModalError, setPatientModalError] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, [preselectedPatientId]);

  const fetchInitialData = async () => {
    try {
      const [patRes, recRes] = await Promise.all([
        api.getPatients(),
        api.getUploadedRecordings()
      ]);
      const patList = patRes.data.patients || [];
      const recList = recRes.data.recordings || [];
      setPatients(patList);
      setUploadedRecordings(recList);

      let targetPid = preselectedPatientId;
      if (!targetPid && patList.length > 0) {
        targetPid = patList[0].patientId;
      }
      if (targetPid) {
        setSelectedPatientId(targetPid);
        setActivePatientId(targetPid);

        if (refreshActiveSessions) {
          await refreshActiveSessions(targetPid);
        }

        if (recList.length > 0) {
          const existingState = getPatientState(targetPid);
          if (!existingState.recordingId && !patientLocalRecording[targetPid]) {
            const defaultRec = recList.find(r => r.recordingId === 'rec_chb01_03') || recList[0];
            setPatientLocalRecording(prev => ({ ...prev, [targetPid]: defaultRec.recordingId }));
            selectPatientRecording(
              targetPid,
              defaultRec.recordingId,
              defaultRec.recommendedChannel || 'FP1-F7',
              defaultRec.startOffsetSec || 0
            );
          }
        }
      }
    } catch (err) {
      console.error("Failed to load initial monitoring and recording data:", err);
    }
  };

  const handleSelectScenario = (rec) => {
    if (!rec || !selectedPatientId) return;
    const targetChannel = rec.recommendedChannel || (rec.channels?.length > 0 ? rec.channels[0] : 'FP1-F7');
    setPatientLocalRecording(prev => ({ ...prev, [selectedPatientId]: rec.recordingId }));
    selectPatientRecording(
      selectedPatientId,
      rec.recordingId,
      targetChannel,
      rec.startOffsetSec || 0
    );
    // If THIS specific patient had an active session on a different recording, stop it
    if (session?.sessionId && session?.recordingId !== rec.recordingId) {
      stopPatientPlayback(selectedPatientId);
    }
  };

  const currentRecording = uploadedRecordings.find(r => r.recordingId === selectedRecordingId);
  const currentPatient = patients.find(p => p.patientId === selectedPatientId);

  // Upload handler
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select an EEG recording file (.edf, .csv, or .tsv).");
      return;
    }
    if (!selectedPatientId) {
      setUploadError("Please select or register a patient to associate with this recording.");
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('patientId', selectedPatientId);
      formData.append('description', uploadDescription || 'Recorded EEG File');

      const res = await api.uploadEegFile(formData);
      if (res.data.success && res.data.recording) {
        const newRec = res.data.recording;
        setUploadSuccess(`Uploaded & validated successfully: ${newRec.originalFilename} (${newRec.durationSec}s, ${newRec.samplingFrequency}Hz)`);
        setUploadedRecordings(prev => [newRec, ...prev]);
        setSelectedRecordingId(newRec.recordingId);
        if (newRec.channels?.length > 0) {
          setSelectedChannel(newRec.channels[0]);
        }
        setUploadFile(null);
        setUploadDescription('');
      }
    } catch (err) {
      setUploadError(err.response?.data?.error || "Upload failed. Please ensure the file is a valid EDF or CSV.");
    } finally {
      setUploading(false);
    }
  };

  // On-demand Benchmark Generator
  const handleGenerateSample = async (pattern = "seizure") => {
    setSampleGenerating(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const targetPatId = selectedPatientId || (patients.length > 0 ? patients[0].patientId : "PAT-NEW");
      const res = await api.generateSampleEdf(pattern, targetPatId);
      if (res.data.success && res.data.recording) {
        const sampleRec = res.data.recording;
        setUploadSuccess(`Benchmark EDF generated: ${sampleRec.originalFilename} (${sampleRec.description})`);
        setUploadedRecordings(prev => [sampleRec, ...prev]);
        setSelectedRecordingId(sampleRec.recordingId);
        if (sampleRec.channels?.length > 0) {
          setSelectedChannel(sampleRec.channels[0]);
        }
      }
    } catch (err) {
      setUploadError(err.response?.data?.error || "Failed to generate benchmark sample.");
    } finally {
      setSampleGenerating(false);
    }
  };

  // Quick Register Patient
  const handleCreatePatient = async (e) => {
    e.preventDefault();
    if (!newPatient.name.trim()) {
      setPatientModalError("Patient name is required.");
      return;
    }
    if (!newPatient.caretakerName.trim() || !newPatient.caretakerPhone.trim()) {
      setPatientModalError("Caretaker name and emergency phone are required.");
      return;
    }

    setPatientSubmitting(true);
    setPatientModalError('');

    try {
      const res = await api.registerPatient({
        name: newPatient.name.trim(),
        age: parseInt(newPatient.age) || 25,
        gender: newPatient.gender,
        clinicalNotes: newPatient.clinicalNotes.trim() || 'Continuous EEG Surveillance',
        caretakerName: newPatient.caretakerName.trim(),
        caretakerPhone: newPatient.caretakerPhone.trim(),
        caretakerRelationship: newPatient.caretakerRelationship,
        caretakerSmsConsent: newPatient.caretakerSmsConsent
      });

      if (res.data.patient) {
        const created = res.data.patient;
        setPatients(prev => [created, ...prev]);
        setSelectedPatientId(created.patientId);
        setActivePatientId(created.patientId);
        if (uploadedRecordings.length > 0) {
          const defaultRec = uploadedRecordings.find(r => r.recordingId === 'rec_chb01_03') || uploadedRecordings[0];
          setPatientLocalRecording(prev => ({ ...prev, [created.patientId]: defaultRec.recordingId }));
          selectPatientRecording(
            created.patientId,
            defaultRec.recordingId,
            defaultRec.recommendedChannel || 'FP1-F7',
            defaultRec.startOffsetSec || 0
          );
        }
        setShowAddPatientModal(false);
        setNewPatient({
          name: '',
          age: '',
          gender: 'Male',
          clinicalNotes: '',
          caretakerName: '',
          caretakerPhone: '',
          caretakerRelationship: 'Parent',
          caretakerSmsConsent: true
        });
      }
    } catch (err) {
      setPatientModalError(err.response?.data?.error || "Failed to register patient.");
    } finally {
      setPatientSubmitting(false);
    }
  };

  // Playback Control Handlers per selected patient
  const handleInitPlayback = async () => {
    if (!selectedRecordingId) {
      setPlaybackError("Please select an EEG recording first.");
      return null;
    }
    const currentRec = uploadedRecordings.find(r => r.recordingId === selectedRecordingId);
    return await initPatientSession(selectedPatientId, {
      recordingId: selectedRecordingId,
      patientId: selectedPatientId,
      channel: selectedChannel || currentRec?.recommendedChannel || 'FP1-F7',
      playbackSpeed: playbackSpeed,
      startOffsetSec: currentRec?.startOffsetSec || 0
    });
  };

  const handleStartPlayback = async () => {
    if (!selectedPatientId) {
      setPlaybackError("Please select an active patient first.");
      return;
    }
    let activeSessionId = session?.sessionId;
    if (!activeSessionId || session?.recordingId !== selectedRecordingId) {
      const initRes = await handleInitPlayback();
      activeSessionId = initRes?.sessionId;
    }
    if (activeSessionId) {
      await startPatientPlayback(selectedPatientId, activeSessionId);
    }
  };

  const handlePausePlayback = () => pausePatientPlayback(selectedPatientId);
  const handleResumePlayback = () => resumePatientPlayback(selectedPatientId);
  const handleStopPlayback = () => stopPatientPlayback(selectedPatientId);
  const handleRestartPlayback = () => restartPatientPlayback(selectedPatientId);
  const handleSpeedChange = (speed) => changePatientSpeed(selectedPatientId, speed);
  const handleChannelSwitch = (channel) => changePatientChannel(selectedPatientId, channel);

  // Risk display calculations
  const prediction = packetData?.prediction;
  const riskCategory = prediction?.riskCategory || 'Pending';
  const seizureProb = prediction ? Math.round(prediction.modelProbability * 100) : 0;
  const windowStatus = packetData?.windowStatus || (session ? "Ready to stream" : "Awaiting recording upload");

  const peakRisk = (riskTrends && riskTrends.length > 0)
    ? Math.max(...riskTrends.map(t => t.probability))
    : seizureProb;
  const avgRisk = (riskTrends && riskTrends.length > 0)
    ? Math.round((riskTrends.reduce((acc, t) => acc + t.probability, 0) / riskTrends.length) * 10) / 10
    : seizureProb;
  const highRiskCount = (riskTrends && riskTrends.length > 0)
    ? riskTrends.filter(t => t.probability >= 70).length
    : (seizureProb >= 70 ? 1 : 0);

  const getRiskColor = (cat) => {
    switch (cat) {
      case 'High': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'Medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'Low': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      default: return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* 1. Academic Disclaimer & Simulated Wearable Banner */}
      <div className="bg-slate-900 border border-teal-500/30 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-white tracking-tight">
                Live EEG Monitoring & Continuous Dataset Simulator
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulated Wearable Acquisition using Recorded EEG Data (CHB-MIT Standard / Bonn UCI Format)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {!isCaretaker && (
            <button
              onClick={() => setShowAddPatientModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-400 border border-teal-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Register Patient</span>
            </button>
          )}
          <button
            onClick={fetchInitialData}
            title="Refresh recordings and patients"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Emergency Alert Banner if Active */}
      {alertNotice && (
        <div className="bg-rose-950/80 border-2 border-rose-500 rounded-2xl p-4 shadow-2xl flex items-center justify-between animate-bounce">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-white">
                EMERGENCY ALERT TRIGGERED — High Seizure Risk Detected ({seizureProb}%)
              </p>
              <p className="text-xs text-rose-200 mt-0.5">
                Target Patient: <strong className="text-white">{currentPatient?.name || selectedPatientId}</strong> • Caretaker: {currentPatient?.caretakerName} ({currentPatient?.caretakerPhone})
              </p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-lg bg-rose-500/30 border border-rose-400 text-xs font-semibold text-rose-100 flex items-center space-x-1.5">
            <PhoneCall className="w-3.5 h-3.5" />
            <span>SMS Dispatched</span>
          </div>
        </div>
      )}

      {/* 2. Main Hero: Clinical Controls for Doctors OR Read-Only Observation for Caretakers */}
      {isCaretaker ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 border border-teal-500/20 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Live Patient Telemetry & Alert Stream
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200/60">
                    Caretaker Read-Only Portal
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time physiological EEG waveform and AI seizure probability for your authorized dependent.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
                playbackStatus === 'running'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : playbackStatus === 'paused'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <span className={`w-2 h-2 rounded-full ${playbackStatus === 'running' ? 'bg-emerald-500 animate-pulse' : playbackStatus === 'paused' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                <span>Status: {playbackStatus === 'running' ? 'Active Real-Time Telemetry' : playbackStatus === 'paused' ? 'Paused by Physician' : 'Standby / Ready'}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Assigned Dependent</span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">{currentPatient?.name || selectedPatientId}</span>
              <span className="text-[11px] text-slate-500">{currentPatient?.gender}, {currentPatient?.age} years • Patient ID: {selectedPatientId}</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Attending Physician</span>
              <span className="text-sm font-semibold text-slate-800 mt-0.5 block">{currentPatient?.assignedDoctorName || 'Dr. Sarah Jenkins, MD'}</span>
              <span className="text-[11px] text-slate-500">Neurology & Clinical Neurophysiology</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Active Channel & Telemetry Control</span>
              <span className="text-sm font-semibold text-teal-700 mt-0.5 block">Electrode {selectedChannel || 'FP1-F7'}</span>
              <span className="text-[11px] text-slate-500">Simulation controls locked (Attending physician managed)</span>
            </div>
          </div>
        </div>
      ) : (
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 border border-teal-500/20 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Clinical EEG Dataset Library
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  Pre-Loaded in Database
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Select any clinical recording below to stream real physiological telemetry and run real-time AI seizure analysis. No manual file uploads required.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-semibold flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{uploadedRecordings.length} Curated Datasets Ready</span>
            </span>
          </div>
        </div>

        {/* Clinical Scenario Quick-Select Cards (Grid of 4) */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Quick Test Scenarios (Instant AI Demonstration)
            </label>
            <span className="text-[11px] text-teal-600 font-semibold">1-Click Auto Config</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {(() => {
              const featuredIds = ['rec_chb01_03', 'rec_chb01_04', 'rec_chb01_01', 'rec_chb01_02'];
              const featured = featuredIds
                .map(id => uploadedRecordings.find(r => r.recordingId === id))
                .filter(Boolean);
              const displayCards = featured.length === 4 ? featured : uploadedRecordings.slice(0, 4);

              return displayCards.map((rec) => {
                const isSelected = selectedRecordingId === rec.recordingId;
                const isSeizure = rec.recordingId.includes('seizure') || (rec.clinicalScenario && rec.clinicalScenario.toLowerCase().includes('seizure'));
                const isNormal = rec.recordingId.includes('normal') || (rec.clinicalScenario && rec.clinicalScenario.toLowerCase().includes('normal'));

                return (
                  <div
                    key={rec.recordingId}
                    onClick={() => handleSelectScenario(rec)}
                    className={`relative rounded-2xl p-4 cursor-pointer transition-all border text-left flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-teal-500 shadow-md ring-2 ring-teal-500/20'
                        : 'bg-slate-50 hover:bg-slate-100/80 text-slate-800 border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isSelected
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                            : isSeizure
                            ? 'bg-rose-100 text-rose-800'
                            : isNormal
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {rec.clinicalScenario || (isSeizure ? "Ictal Seizure" : isNormal ? "Normal Baseline" : "Clinical EEG")}
                        </span>
                        {isSelected && (
                          <span className="flex items-center text-teal-400 text-[11px] font-bold space-x-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        )}
                      </div>

                      <h3 className={`text-xs font-bold line-clamp-2 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {rec.description || rec.originalFilename}
                      </h3>

                      <p className={`text-[11px] line-clamp-2 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {rec.expectedOutcome || `${rec.durationSec}s continuous recording • ${rec.samplingFrequency} Hz`}
                      </p>
                    </div>

                    <div className={`pt-2 border-t flex items-center justify-between text-[10px] font-mono ${
                      isSelected ? 'border-slate-800 text-teal-300' : 'border-slate-200 text-slate-500'
                    }`}>
                      <span>Duration: {rec.durationSec}s</span>
                      <span>Channels: {rec.channels?.length || 1}</span>
                      <span>Sampling: {rec.samplingFrequency || 256} Hz</span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Dropdowns Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
          {/* 1. EEG Dataset Selector Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Choose Stored EEG Recording
            </label>
            <select
              value={selectedRecordingId}
              onChange={(e) => {
                const found = uploadedRecordings.find(r => r.recordingId === e.target.value);
                if (found) handleSelectScenario(found);
              }}
              className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800 font-semibold focus:ring-2 focus:ring-teal-500 shadow-2xs"
            >
              {uploadedRecordings.map(r => (
                <option key={r.recordingId} value={r.recordingId}>
                  {r.clinicalScenario ? `[${r.clinicalScenario}] ` : ''}{r.originalFilename} ({r.durationSec}s)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Target Patient Dropdown */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Assigned Patient
              </label>
              <button
                type="button"
                onClick={() => setShowAddPatientModal(true)}
                className="text-[10px] font-bold text-teal-600 hover:text-teal-700"
              >
                + New Patient
              </button>
            </div>
            <select
              value={selectedPatientId}
              onChange={(e) => {
                const nextPid = e.target.value;
                setSelectedPatientId(nextPid);
                setActivePatientId(nextPid);
                const pState = getPatientState(nextPid);
                if (!pState.recordingId && !patientLocalRecording[nextPid] && uploadedRecordings.length > 0) {
                  const defaultRec = uploadedRecordings.find(r => r.recordingId === 'rec_chb01_03') || uploadedRecordings[0];
                  setPatientLocalRecording(prev => ({ ...prev, [nextPid]: defaultRec.recordingId }));
                  selectPatientRecording(
                    nextPid,
                    defaultRec.recordingId,
                    defaultRec.recommendedChannel || 'FP1-F7',
                    defaultRec.startOffsetSec || 0
                  );
                }
              }}
              className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800 font-semibold focus:ring-2 focus:ring-teal-500 shadow-2xs"
            >
              {patients.map(p => {
                const isStreaming = patientSessions[p.patientId]?.playbackStatus === 'running';
                return (
                  <option key={p.patientId} value={p.patientId}>
                    {p.patientId} - {p.name} ({p.age}y, {p.gender}){isStreaming ? ' • [Streaming Live]' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 3. Montage Channel Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Active Montage Channel (10-20 Standard)
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => handleChannelSwitch(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800 font-semibold focus:ring-2 focus:ring-teal-500 shadow-2xs"
            >
              {currentRecording?.channels?.map(ch => (
                <option key={ch} value={ch}>Electrode: {ch}</option>
              )) || <option value="FP1-F7">Electrode: FP1-F7 (Default)</option>}
            </select>
          </div>
        </div>

        {/* Selected Recording Specs & Action Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-2">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-medium border border-slate-200">
              Format: <strong className="text-slate-900">{currentRecording?.format || 'EDF'}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-medium border border-slate-200">
              Duration: <strong className="text-slate-900">{currentRecording?.durationSec || 60}s</strong>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-medium border border-slate-200">
              Sampling Rate: <strong className="text-slate-900">{currentRecording?.samplingFrequency || 256} Hz</strong>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-medium border border-slate-200">
              Total Samples: <strong className="text-slate-900">{currentRecording?.totalSamples?.toLocaleString() || '15,360'}</strong>
            </span>
          </div>

          {/* Controls: Play/Pause/Stop & Speed */}
          <div className="flex flex-wrap items-center space-x-3">
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Speed:</span>
              {[1.0, 2.0, 4.0, 8.0].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSpeedChange(s)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    playbackSpeed === s
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {playbackStatus === 'running' ? (
              <button
                type="button"
                onClick={handlePausePlayback}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center space-x-2 shadow-sm transition-all"
              >
                <Pause className="w-4 h-4" />
                <span>Pause Monitoring</span>
              </button>
            ) : playbackStatus === 'paused' ? (
              <button
                type="button"
                onClick={handleResumePlayback}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-2 shadow-sm transition-all"
              >
                <Play className="w-4 h-4" />
                <span>Resume Monitoring</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartPlayback}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95"
              >
                <Play className="w-4 h-4" />
                <span>Run AI Model & Start Monitoring</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRestartPlayback}
              disabled={playbackStatus === 'stopped' && !session}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1 transition-all disabled:opacity-50"
              title="Restart from beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleStopPlayback}
              disabled={playbackStatus === 'stopped'}
              className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center space-x-1 transition-all disabled:opacity-50"
              title="Stop playback"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        </div>

        {playbackError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{playbackError}</span>
          </div>
        )}

        {/* Collapsible Custom File Upload Drawer (Optional) */}
        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowUploadSection(!showUploadSection)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center space-x-2 transition-colors"
          >
            {showUploadSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>Looking to test a custom EEG file (.edf / .csv)? Click to {showUploadSection ? "collapse" : "expand uploader"}</span>
          </button>

          {showUploadSection && (
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <UploadCloud className="w-4 h-4 text-teal-600" />
                  <span>Upload Custom Recorded EEG File</span>
                </span>
                <span className="text-[11px] text-slate-500">CHB-MIT EDF • CSV • TSV (Max 150MB)</span>
              </div>

              <form onSubmit={handleFileUpload} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Select File (.edf, .csv, or .tsv)
                  </label>
                  <input
                    type="file"
                    accept=".edf,.csv,.tsv"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer border border-slate-300 rounded-xl p-1 bg-white"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Patient Clinical Recording"
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>

                <div className="md:col-span-3">
                  <button
                    type="submit"
                    disabled={uploading || !uploadFile}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-white shadow-sm flex items-center justify-center space-x-1.5 transition-all ${
                      uploading || !uploadFile
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-teal-600 hover:bg-teal-700'
                    }`}
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{uploading ? "Validating..." : "Upload & Validate"}</span>
                  </button>
                </div>
              </form>

              {/* On-demand generator buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                <span className="text-[11px] text-slate-600 font-medium">Generate Synthetic Benchmark:</span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    disabled={sampleGenerating}
                    onClick={() => handleGenerateSample("seizure")}
                    className="py-1 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-semibold transition-colors"
                  >
                    {sampleGenerating ? "Generating..." : "Generate Seizure Spike-Wave Benchmark (60s)"}
                  </button>
                  <button
                    type="button"
                    disabled={sampleGenerating}
                    onClick={() => handleGenerateSample("normal")}
                    className="py-1 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-semibold transition-colors"
                  >
                    {sampleGenerating ? "Generating..." : "Generate Normal Alpha Rhythm Benchmark (60s)"}
                  </button>
                </div>
              </div>

              {uploadError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
              {uploadSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 3. Monitoring Telemetry View Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setMonitoringTab('waveform')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              monitoringTab === 'waveform'
                ? 'bg-slate-900 text-teal-400 shadow-sm shadow-slate-900/20'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Continuous Oscilloscope Waveform</span>
          </button>

          <button
            type="button"
            onClick={() => setMonitoringTab('trend')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              monitoringTab === 'trend'
                ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30 ring-2 ring-teal-500/20'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Seizure Risk Estimation Trajectory</span>
            {riskTrends.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                monitoringTab === 'trend' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'
              }`}>
                {riskTrends.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMonitoringTab('dual')}
            className={`hidden sm:flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              monitoringTab === 'dual'
                ? 'bg-slate-900 text-teal-400 shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Dual Telemetry Display</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {playbackStatus === 'running' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              STREAMING LIVE
            </span>
          )}
          {riskTrends.length > 0 && (
            <span className="text-[11px] text-slate-500 font-medium">
              Current: <strong className={seizureProb >= 70 ? 'text-rose-600' : seizureProb >= 40 ? 'text-amber-600' : 'text-emerald-600'}>{seizureProb}%</strong> ({riskCategory})
            </span>
          )}
        </div>
      </div>

      {/* KPI Stats Bar when in Trend or Dual Tab */}
      {monitoringTab !== 'waveform' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500">Current Risk Probability</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-slate-900 font-mono">{seizureProb}%</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getRiskColor(riskCategory)}`}>
                {riskCategory}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Latest 2.0s Analysis Window</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500">Peak Risk in Session</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-rose-600 font-mono">{peakRisk}%</span>
              <span className="text-[10px] font-semibold text-rose-500">Maximum</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Highest spike recorded</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500">Rolling Window Average</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-teal-600 font-mono">{avgRisk}%</span>
              <span className="text-[10px] font-semibold text-teal-600">Smoothed</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Trajectory mean (last {riskTrends.length} windows)</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500">Alert Triggers (≥70%)</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-amber-600 font-mono">{highRiskCount}</span>
              <span className="text-[10px] font-semibold text-amber-600">Windows</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Emergency SMS candidate events</p>
          </div>
        </div>
      )}

      {/* Main Telemetry Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Waveform, Trend, or Dual (8 Cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* 1. Oscilloscope (Shown in 'waveform' and 'dual' tabs) */}
          {(monitoringTab === 'waveform' || monitoringTab === 'dual') && (
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 shadow-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
                      <span>LIVE EEG WAVEFORM OSCILLOSCOPE</span>
                      <span className="text-xs font-normal text-slate-400">({selectedChannel || 'FP1-F7'})</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {packetData ? `Packet #${packetData.packetSequenceNumber} • Simulated Time: ${packetData.simulatedRecordingTimestamp}s / ${packetData.recordingDurationSec}s` : 'Waiting for playback stream...'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-teal-400 border border-teal-500/20 font-mono text-[11px]">
                    {currentRecording ? `${currentRecording.samplingFrequency} Hz` : '256 Hz'}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    playbackStatus === 'running' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    playbackStatus === 'paused' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    playbackStatus === 'completed' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {playbackStatus}
                  </span>
                </div>
              </div>

              {/* Waveform Graph Area */}
              <div className="h-60 w-full bg-slate-900/60 rounded-xl p-2 border border-slate-800/50">
                {waveformData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={waveformData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis
                        dataKey="time"
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `${v}s`}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                        domain={[-250, 250]}
                        tickFormatter={(v) => `${v}µV`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                        labelFormatter={(label) => `Time: ${label}s`}
                        formatter={(value) => [`${value} µV`, 'Voltage']}
                      />
                      <Line
                        type="monotone"
                        dataKey="microvolts"
                        stroke="#2dd4bf"
                        strokeWidth={1.8}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
                    <Activity className="w-8 h-8 opacity-30 animate-pulse text-teal-400" />
                    <p>No active samples in buffer. Click "Start Playback" to stream real recorded EEG points.</p>
                  </div>
                )}
              </div>

              {/* Playback Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Progress: {packetData ? `${packetData.progressPercentage}%` : '0%'}</span>
                  <span>{packetData ? `${packetData.currentSampleIndex?.toLocaleString()} / ${packetData.totalSamples?.toLocaleString()} samples` : '0 samples'}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300"
                    style={{ width: `${packetData?.progressPercentage || 0}%` }}
                  />
                </div>
              </div>

              {/* Compact Mini-Trend Strip inside Waveform View */}
              {monitoringTab === 'waveform' && (
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                      <span>Live Seizure Risk Estimation Trajectory</span>
                      {playbackStatus === 'running' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMonitoringTab('trend')}
                      className="text-[11px] text-teal-400 hover:text-teal-300 font-semibold underline"
                    >
                      Open Full Risk Trend Tab →
                    </button>
                  </div>
                  <div className="h-28 w-full bg-slate-900/60 rounded-xl p-2 border border-slate-800/50">
                    {riskTrends.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={riskTrends}>
                          <defs>
                            <linearGradient id="miniRiskGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0D9488" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                          <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 9 }} />
                          <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 9 }} unit="%" />
                          <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="2 2" />
                          <ReferenceLine y={40} stroke="#F59E0B" strokeDasharray="2 2" />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '11px', color: '#fff' }}
                            formatter={(val) => [`${val}%`, 'Risk Probability']}
                          />
                          <Area
                            type="monotone"
                            dataKey="probability"
                            stroke="#2dd4bf"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#miniRiskGradient)"
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                        Start playback to generate real-time risk trajectory points.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Full Dedicated Risk Estimation Trend Chart (Shown in 'trend' and 'dual' tabs) */}
          {(monitoringTab === 'trend' || monitoringTab === 'dual') && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-teal-600" />
                    <h3 className="text-sm font-bold text-slate-800">
                      Continuous EEG Seizure Risk Estimation Trend
                    </h3>
                    {playbackStatus === 'running' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                        LIVE ESTIMATION
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        {riskTrends.length} Windows Recorded
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time Random Forest inference probability trajectory across sliding 2.0s windows
                  </p>
                </div>

                <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                  <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5"></span>Low (&lt;40%)</span>
                  <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5"></span>Medium (40-70%)</span>
                  <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1.5"></span>High Alert (≥70%)</span>
                </div>
              </div>

              {/* Main Area Chart */}
              <div className="h-72 w-full">
                {riskTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={riskTrends}>
                      <defs>
                        <linearGradient id="mainRiskGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0D9488" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        unit="%"
                      />
                      <ReferenceLine
                        y={70}
                        stroke="#EF4444"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{ value: 'Alert Threshold (70%)', position: 'insideTopRight', fill: '#EF4444', fontSize: 10 }}
                      />
                      <ReferenceLine
                        y={40}
                        stroke="#F59E0B"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        label={{ value: 'Elevated Risk (40%)', position: 'insideTopLeft', fill: '#F59E0B', fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px', color: '#fff' }}
                        formatter={(val, name, item) => [
                          `${val}% (${item.payload?.riskCategory || 'Risk Tier'})`,
                          'Seizure Probability'
                        ]}
                        labelFormatter={(label, items) => {
                          const item = items?.[0]?.payload;
                          return item?.clockTime
                            ? `Clock Time: ${item.clockTime} • Simulated: ${item.time}`
                            : `Recorded Window: ${label}`;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="probability"
                        stroke="#0D9488"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#mainRiskGradient)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
                    <TrendingUp className="w-8 h-8 text-slate-300 animate-pulse" />
                    <p className="font-semibold text-slate-600">No Risk Telemetry Points Streamed Yet</p>
                    <p className="text-[11px] text-slate-400">
                      Click "Start Playback" above to initiate continuous EEG processing and populate the live trend.
                    </p>
                  </div>
                )}
              </div>

              {/* Edge AI Engine Details Strip */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2 text-slate-600">
                  <Cpu className="w-4 h-4 text-teal-600" />
                  <span className="font-semibold">Model Architecture:</span>
                  <span className="font-mono text-slate-800">Random Forest Classifier (50 Estimators)</span>
                </div>
                <div className="flex items-center space-x-4 text-[11px] text-slate-500">
                  <span>Window: <strong className="text-slate-700">2.0s (512 samples)</strong></span>
                  <span>Overlap: <strong className="text-slate-700">50% Rolling</strong></span>
                  <span>Feature Extraction: <strong className="text-slate-700">Welch PSD + Band Powers</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* 3. Prediction Sequence Audit Trail Table (Shown when in 'trend' tab) */}
          {monitoringTab === 'trend' && riskTrends.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-teal-600" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Recent Evaluated Windows Audit Trail
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">
                  Showing last {Math.min(10, riskTrends.length)} analysis windows
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                      <th className="py-2 px-3">Window #</th>
                      <th className="py-2 px-3">Simulated Time</th>
                      <th className="py-2 px-3">Clock Time</th>
                      <th className="py-2 px-3">Risk Probability</th>
                      <th className="py-2 px-3">Risk Tier</th>
                      <th className="py-2 px-3">Emergency Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...riskTrends].reverse().slice(0, 8).map((pt, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-mono font-medium text-slate-700">
                          #{pt.packetSequence || (riskTrends.length - idx)}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-mono">
                          {pt.time}
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          {pt.clockTime || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">
                          {pt.probability}%
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${getRiskColor(pt.riskCategory)}`}>
                            {pt.riskCategory}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {pt.probability >= 70 ? (
                            <span className="inline-flex items-center text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <PhoneCall className="w-3 h-3 mr-1" />
                              SMS Dispatched
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">
                              Normal Telemetry
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Chart of Risk & AI Intelligence Matrix (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-800">Seizure Risk Assessment</h3>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Random Forest
            </span>
          </div>

          {/* Prominent Risk Category Gauge */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${getRiskColor(riskCategory)}`}>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold opacity-75">
                Current Risk Tier
              </p>
              <h4 className="text-2xl font-black tracking-tight mt-0.5">
                {riskCategory}
              </h4>
              <p className="text-[11px] mt-1 font-medium opacity-90">
                {riskCategory === 'High' ? 'Critical Seizure Pattern Detected' :
                 riskCategory === 'Medium' ? 'Elevated Slowing Activity' :
                 riskCategory === 'Low' ? 'Normal Baseline Rhythm' :
                 'Buffer Initializing'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center font-bold text-lg">
              <Gauge className="w-6 h-6" />
            </div>
          </div>

          {/* Seizure Probability Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700">Seizure Probability</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{seizureProb}%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden relative">
              {/* Threshold markers */}
              <div className="absolute left-[40%] top-0 bottom-0 w-0.5 bg-slate-300 z-10" title="Low threshold (40%)" />
              <div className="absolute left-[70%] top-0 bottom-0 w-0.5 bg-rose-400 z-10" title="High alert threshold (70%)" />
              <div
                className={`h-full transition-all duration-300 ${
                  seizureProb >= 70 ? 'bg-rose-500' :
                  seizureProb >= 40 ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`}
                style={{ width: `${seizureProb}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0% (Low)</span>
              <span>40% (Medium)</span>
              <span>70% (High Alert)</span>
              <span>100%</span>
            </div>
          </div>

          {/* Rolling Analysis Window Status */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-semibold">Analysis Window:</span>
              <span className="font-mono text-teal-600 font-bold">2.0s (512 samples)</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${prediction ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
              <span>{windowStatus}</span>
            </p>
          </div>

          {/* Spectral Biomarkers Matrix */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              EEG Spectral Features (Welch PSD)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400">Delta (0.5-4Hz):</span>
                <p className="font-bold text-slate-800">{prediction?.features?.delta_power?.toFixed(3) || '—'}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400">Theta (4-8Hz):</span>
                <p className="font-bold text-slate-800">{prediction?.features?.theta_power?.toFixed(3) || '—'}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400">Alpha (8-12Hz):</span>
                <p className="font-bold text-slate-800">{prediction?.features?.alpha_power?.toFixed(3) || '—'}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400">Slowing Ratio:</span>
                <p className="font-bold text-slate-800">{prediction?.features?.spectral_slowing_ratio?.toFixed(3) || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Quick Add Patient Modal */}
      {showAddPatientModal && !isCaretaker && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">Register New Patient</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPatientModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Patient Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newPatient.name}
                  onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
                  <input
                    type="number"
                    min="1"
                    max="110"
                    placeholder="25"
                    value={newPatient.age}
                    onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={newPatient.gender}
                    onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Caretaker Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mary Doe"
                  value={newPatient.caretakerName}
                  onChange={(e) => setNewPatient({ ...newPatient, caretakerName: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Caretaker Phone (+E.164) *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +919876543210 or +14155552671"
                  value={newPatient.caretakerPhone}
                  onChange={(e) => setNewPatient({ ...newPatient, caretakerPhone: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-teal-500 font-mono"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="smsConsentModal"
                  checked={newPatient.caretakerSmsConsent}
                  onChange={(e) => setNewPatient({ ...newPatient, caretakerSmsConsent: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="smsConsentModal" className="text-xs text-slate-600">
                  Consent for automated emergency Twilio SMS alerts
                </label>
              </div>

              {patientModalError && (
                <p className="text-xs text-rose-600 font-medium">{patientModalError}</p>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPatientModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={patientSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm"
                >
                  {patientSubmitting ? "Registering..." : "Save Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMonitoring;
