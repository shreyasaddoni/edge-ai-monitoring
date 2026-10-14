import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  UploadCloud,
  FileCheck,
  Play,
  Pause,
  RotateCcw,
  Square,
  Radio,
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
  Info
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

export const DatasetUpload = () => {
  // Data states
  const [patients, setPatients] = useState([]);
  const [uploadedRecordings, setUploadedRecordings] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedRecordingId, setSelectedRecordingId] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');

  // Upload Form states
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [sampleGenerating, setSampleGenerating] = useState(false);

  // Playback Session states
  const [session, setSession] = useState(null);
  const [playbackStatus, setPlaybackStatus] = useState('stopped'); // stopped, running, paused, completed
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [packetData, setPacketData] = useState(null);
  const [waveformData, setWaveformData] = useState([]);
  const [alertNotice, setAlertNotice] = useState(null);
  const [playbackError, setPlaybackError] = useState('');

  // Continuous timer ref
  const playbackTimerRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    fetchInitialData();
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, []);

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

      if (patList.length > 0) {
        setSelectedPatientId(patList[0].patientId);
      }
      if (recList.length > 0) {
        setSelectedRecordingId(recList[0].recordingId);
        if (recList[0].channels?.length > 0) {
          setSelectedChannel(recList[0].channels[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load upload & playback data:", err);
    }
  };

  // Switch selected recording details
  const currentRecording = uploadedRecordings.find(r => r.recordingId === selectedRecordingId);
  const currentPatient = patients.find(p => p.patientId === selectedPatientId);

  useEffect(() => {
    if (currentRecording && currentRecording.channels?.length > 0 && !selectedChannel) {
      setSelectedChannel(currentRecording.channels[0]);
    }
  }, [currentRecording]);

  // Handle File Upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select an EEG file to upload (.edf, .csv, .tsv).");
      return;
    }
    if (!selectedPatientId) {
      setUploadError("Please select a target patient for this recording.");
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('patientId', selectedPatientId);
    formData.append('description', uploadDescription || uploadFile.name);

    try {
      const res = await api.uploadEegFile(formData);
      setUploadSuccess(`Uploaded & Verified: ${res.data.recording?.originalFilename} (${res.data.recording?.durationSec}s, ${res.data.recording?.format})`);
      setUploadFile(null);
      setUploadDescription('');
      // Reload recordings list
      const updatedRecs = await api.getUploadedRecordings();
      setUploadedRecordings(updatedRecs.data.recordings || []);
      setSelectedRecordingId(res.data.recording?.recordingId);
      if (res.data.recording?.channels?.length > 0) {
        setSelectedChannel(res.data.recording.channels[0]);
      }
    } catch (err) {
      setUploadError(err.response?.data?.error || "EEG file upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // Generate Sample CHB-MIT EDF
  const handleGenerateSample = async (pattern = 'seizure') => {
    setSampleGenerating(true);
    setUploadError('');
    setUploadSuccess('');
    try {
      const res = await api.generateSampleEdf(pattern, selectedPatientId || 'PAT-CHB01');
      setUploadSuccess(`Generated benchmark ${res.data.recording?.format} recording with ${pattern} discharges.`);
      const updatedRecs = await api.getUploadedRecordings();
      setUploadedRecordings(updatedRecs.data.recordings || []);
      setSelectedRecordingId(res.data.recording?.recordingId);
      if (res.data.recording?.channels?.length > 0) {
        setSelectedChannel(res.data.recording.channels[0]);
      }
    } catch (err) {
      setUploadError("Sample generation failed.");
    } finally {
      setSampleGenerating(false);
    }
  };

  // Stream next packet
  const pullNextPacket = async (sessionId) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const res = await api.getPlaybackPacket(sessionId);
      const data = res.data;
      if (data) {
        setPacketData(data);
        if (data.waveformPoints) {
          setWaveformData(data.waveformPoints);
        }
        if (data.alert && data.alert.alertCreated) {
          setAlertNotice(data.alert);
        }
        if (data.isCompleted) {
          setPlaybackStatus('completed');
          if (playbackTimerRef.current) {
            clearInterval(playbackTimerRef.current);
            playbackTimerRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error("Packet transmission error:", err);
    } finally {
      inFlightRef.current = false;
    }
  };

  // Playback Controls
  const handleStartPlayback = async () => {
    if (!selectedRecordingId) {
      setPlaybackError("Please select an uploaded recording first.");
      return;
    }
    setPlaybackError('');
    setAlertNotice(null);

    try {
      // 1. Initialize session
      const initRes = await api.initPlayback({
        recordingId: selectedRecordingId,
        patientId: selectedPatientId,
        channel: selectedChannel || currentRecording?.channels?.[0] || 'FP1-F7',
        playbackSpeed: playbackSpeed
      });

      const newSession = initRes.data;
      setSession(newSession);

      // 2. Start session
      await api.startPlayback(newSession.sessionId);
      setPlaybackStatus('running');

      // 3. Pull first packet immediately
      await pullNextPacket(newSession.sessionId);

      // 4. Set interval according to speed:
      // Base packet duration = 1.0s (1000ms). At 1x = 1000ms interval, 2x = 500ms, 4x = 250ms, 8x = 125ms
      const intervalMs = Math.max(100, Math.round(1000 / playbackSpeed));
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = setInterval(() => {
        pullNextPacket(newSession.sessionId);
      }, intervalMs);

    } catch (err) {
      setPlaybackError(err.response?.data?.error || "Failed to initialize playback session.");
    }
  };

  const handlePausePlayback = async () => {
    if (!session) return;
    try {
      await api.pausePlayback(session.sessionId);
      setPlaybackStatus('paused');
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    } catch (err) {
      console.error("Pause error:", err);
    }
  };

  const handleResumePlayback = async () => {
    if (!session) return;
    try {
      await api.resumePlayback(session.sessionId);
      setPlaybackStatus('running');
      const intervalMs = Math.max(100, Math.round(1000 / playbackSpeed));
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = setInterval(() => {
        pullNextPacket(session.sessionId);
      }, intervalMs);
    } catch (err) {
      console.error("Resume error:", err);
    }
  };

  const handleStopPlayback = async () => {
    if (!session) return;
    try {
      await api.stopPlayback(session.sessionId);
      setPlaybackStatus('stopped');
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    } catch (err) {
      console.error("Stop error:", err);
    }
  };

  const handleRestartPlayback = async () => {
    if (!session) return;
    try {
      await api.restartPlayback(session.sessionId);
      setPlaybackStatus('running');
      setWaveformData([]);
      setAlertNotice(null);
      await pullNextPacket(session.sessionId);

      const intervalMs = Math.max(100, Math.round(1000 / playbackSpeed));
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = setInterval(() => {
        pullNextPacket(session.sessionId);
      }, intervalMs);
    } catch (err) {
      console.error("Restart error:", err);
    }
  };

  const handleSpeedChange = async (newSpeed) => {
    setPlaybackSpeed(newSpeed);
    if (session) {
      try {
        await api.setPlaybackSpeed(session.sessionId, newSpeed);
        if (playbackStatus === 'running') {
          const intervalMs = Math.max(100, Math.round(1000 / newSpeed));
          if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
          playbackTimerRef.current = setInterval(() => {
            pullNextPacket(session.sessionId);
          }, intervalMs);
        }
      } catch (err) {
        console.error("Speed change error:", err);
      }
    }
  };

  const handleChannelChange = async (ch) => {
    setSelectedChannel(ch);
    if (session) {
      try {
        await api.setPlaybackChannel(session.sessionId, ch);
      } catch (err) {
        console.error("Channel change error:", err);
      }
    }
  };

  const pred = packetData?.prediction;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              EEG Dataset Upload & Continuous Playback Simulator
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
              Hardware-Free Wearable Simulation
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload PhysioNet CHB-MIT standard EDF/CSV files, configure sequential packet streaming, and execute rolling window inference
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs shadow-xs">
          <span className={`w-2 h-2 rounded-full ${
            playbackStatus === 'running' ? 'bg-emerald-500 pulse-indicator' :
            playbackStatus === 'paused' ? 'bg-amber-500' :
            playbackStatus === 'completed' ? 'bg-blue-500' : 'bg-slate-300'
          }`}></span>
          <span className="font-semibold text-slate-700 uppercase tracking-wider">
            Status: {playbackStatus}
          </span>
        </div>
      </div>

      {/* Upload Notification Messages */}
      {uploadSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
          <button onClick={() => setUploadSuccess('')} className="font-bold">&times;</button>
        </div>
      )}

      {uploadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError('')} className="font-bold">&times;</button>
        </div>
      )}

      {/* High-Risk Emergency Notice Banner */}
      {alertNotice && (
        <div className="bg-red-600 text-white rounded-xl p-4 shadow-lg shadow-red-500/20 border border-red-500 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-bounce-short">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-red-700 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                HIGH-RISK SEIZURE PATTERN DETECTED FROM UPLOADED RECORDING
              </h3>
              <p className="text-xs text-red-100 mt-0.5">
                Alert ID: {alertNotice.alertId} • Patient: {currentPatient?.name || selectedPatientId} • Cooldown Active (90s)
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs bg-red-700/80 px-3.5 py-1.5 rounded-lg border border-red-500">
            <PhoneCall className="w-4 h-4 text-emerald-300" />
            <span>Caretaker SMS Status: <strong className="uppercase">{alertNotice.notificationStatus}</strong></span>
          </div>
        </div>
      )}

      {/* Grid: 1. Upload Deck | 2. Recording Metadata Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <UploadCloud className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Upload Recorded EEG File</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">EDF / CSV / TSV</span>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Associate with Patient <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-slate-50/50"
                  required
                >
                  {patients.map((p) => (
                    <option key={p.patientId} value={p.patientId}>
                      {p.name} ({p.patientId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Select EEG Recording File (.edf, .csv) <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-xl p-4 text-center cursor-pointer bg-slate-50/50 transition">
                  <input
                    type="file"
                    accept=".edf,.csv,.tsv,.npy"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    CHB-MIT Scalp EEG format supported. File stored locally; samples never sent to Firestore.
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Recording Clinical Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. CHB-MIT chb01_03 Seizure Recording"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="w-full flex items-center justify-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 rounded-lg shadow-sm shadow-teal-600/20 transition disabled:opacity-50"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{uploading ? 'Validating & Uploading...' : 'Upload & Verify Recording'}</span>
              </button>
            </form>
          </div>

          {/* Quick Benchmark Generator */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold text-slate-700 flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
                Zero-Barrier Evaluation:
              </span>
              <span className="text-[10px] text-slate-400">Generate Standard EDF File</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleGenerateSample('seizure')}
                disabled={sampleGenerating}
                className="bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 py-1.5 px-2 rounded-lg font-semibold transition"
              >
                + Ictal Seizure EDF (60s)
              </button>
              <button
                type="button"
                onClick={() => handleGenerateSample('normal')}
                disabled={sampleGenerating}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-1.5 px-2 rounded-lg font-semibold transition"
              >
                + Normal Alpha EDF (60s)
              </button>
            </div>
          </div>
        </div>

        {/* Recording Metadata Inspector Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Recording Metadata Inspector</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {uploadedRecordings.length} Recorded Files Available
              </span>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Recording to Inspect & Play
              </label>
              <select
                value={selectedRecordingId}
                onChange={(e) => setSelectedRecordingId(e.target.value)}
                disabled={playbackStatus === 'running'}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-slate-50/50 font-medium"
              >
                {uploadedRecordings.map((r) => (
                  <option key={r.recordingId} value={r.recordingId}>
                    {r.description || r.originalFilename} ({r.format || 'EDF'}, {r.durationSec || 60}s)
                  </option>
                ))}
              </select>
            </div>

            {currentRecording ? (
              <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Original Filename:</span>
                  <span className="font-semibold text-slate-800 font-mono">{currentRecording.originalFilename}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">File Format:</span>
                  <span className="font-bold text-teal-700">{currentRecording.format}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Sampling Rate:</span>
                  <span className="font-semibold text-slate-800">{currentRecording.samplingFrequency} Hz</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Total Duration:</span>
                  <span className="font-semibold text-slate-800">{currentRecording.durationSec} seconds</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Total Samples:</span>
                  <span className="font-mono text-slate-800">{currentRecording.totalSamples?.toLocaleString()} samples</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Channels ({currentRecording.channels?.length || 0}):</span>
                  <span className="font-mono text-[11px] text-slate-700 truncate max-w-xs">
                    {currentRecording.channels?.join(', ')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No recording selected. Upload an EDF file or generate a benchmark sample.
              </div>
            )}
          </div>

          {currentRecording && (
            <div className="mt-4 pt-2 flex items-center justify-between text-xs">
              <a
                href={api.getDownloadUrl(currentRecording.recordingId)}
                download
                className="flex items-center space-x-1.5 text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 px-3 py-1.5 rounded-lg border border-slate-200 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Original EDF</span>
              </a>
              <span className="text-[11px] text-slate-400">
                Associated: <strong>{currentRecording.patientId}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CONTINUOUS PLAYBACK SIMULATION CONTROL DECK */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Continuous Playback Engine Controls
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Streams sequential packets without repeating the file, maintains rolling analysis buffer & updates model
            </p>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center space-x-1.5 text-xs bg-slate-100 p-1 rounded-lg">
            <span className="text-slate-500 font-semibold px-2">Speed:</span>
            {[1.0, 2.0, 4.0, 8.0].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-2.5 py-1 rounded-md font-bold transition ${
                  playbackSpeed === s ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {playbackError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg mb-4">
            {playbackError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Channel selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Active Montage Channel
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => handleChannelChange(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-slate-50/50 font-mono font-medium"
            >
              {currentRecording?.channels?.map((ch) => (
                <option key={ch} value={ch}>{ch}</option>
              )) || <option value="FP1-F7">FP1-F7</option>}
            </select>
          </div>

          {/* Target Patient */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Streaming For Patient
            </label>
            <div className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium truncate">
              {currentPatient ? `${currentPatient.name} (${currentPatient.patientId})` : 'Select Patient'}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="md:col-span-2 flex items-center space-x-2">
            {playbackStatus !== 'running' ? (
              <button
                onClick={playbackStatus === 'paused' ? handleResumePlayback : handleStartPlayback}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold py-2 px-3.5 rounded-lg shadow-sm shadow-teal-600/20 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{playbackStatus === 'paused' ? 'Resume Playback' : 'Start Playback'}</span>
              </button>
            ) : (
              <button
                onClick={handlePausePlayback}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-2 px-3.5 rounded-lg transition"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </button>
            )}

            <button
              onClick={handleRestartPlayback}
              disabled={!session}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold py-2 px-3.5 rounded-lg transition disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart (0s)</span>
            </button>

            <button
              onClick={handleStopPlayback}
              disabled={!session || playbackStatus === 'stopped'}
              className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold py-2 px-3.5 rounded-lg transition disabled:opacity-40"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          </div>
        </div>

        {/* Playback Progress Indicator */}
        <div className="mt-5 pt-3 border-t border-slate-100 space-y-1.5">
          <div className="flex justify-between text-xs text-slate-600 font-medium">
            <span>
              Simulated Recording Time: <strong className="font-mono text-slate-900">{packetData?.simulatedRecordingTimestamp || '0.0'}s</strong> / {currentRecording?.durationSec || 60}s
            </span>
            <span>
              Position: <strong className="font-mono text-slate-900">{packetData?.progressPercentage || 0}%</strong> ({packetData?.currentSampleIndex || 0} / {packetData?.totalSamples || currentRecording?.totalSamples || 0} samples)
            </span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-teal-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${packetData?.progressPercentage || 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* LIVE WAVEFORM VISUALIZER FROM ACTUAL RECORDED SAMPLES */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Continuous EEG Waveform (Actual Uploaded Samples)
              </h3>
              <p className="text-xs text-slate-400">
                Channel: <strong className="text-slate-700 font-mono">{packetData?.channel || selectedChannel}</strong> • Packet #{packetData?.packetSequenceNumber || 0} • Speed: {playbackSpeed}x
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 font-medium">
              Window Status: <strong className="text-teal-700">{packetData?.windowStatus || 'Buffer Standby'}</strong>
            </span>
            <span className="px-2.5 py-1 rounded bg-teal-50 text-teal-700 font-medium border border-teal-200">
              Sampling Rate: 256 Hz
            </span>
          </div>
        </div>

        {/* Waveform Canvas */}
        <div className="h-64 bg-slate-950 rounded-xl p-3 border border-slate-800 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none"></div>

          {waveformData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={waveformData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="time" hide />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  unit=" µV"
                  stroke="#334155"
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC', fontSize: '11px' }}
                  formatter={(val) => [`${val} µV`, 'Amplitude']}
                  labelFormatter={(l) => `Time: ${l}s`}
                />
                <Line
                  type="monotone"
                  dataKey="microvolts"
                  stroke={pred?.riskCategory === 'High' ? '#EF4444' : '#14B8A6'}
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
              <Radio className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
              <span>Simulator Standby. Select recording and click "Start Playback".</span>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Rolling Inference Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900">Random Forest Seizure Risk</h3>
            <Cpu className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-xs text-slate-400 mb-3">Model output on rolling 2.0s EEG analysis window</p>

          <div className="text-center py-2">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {pred ? `${(pred.modelProbability * 100).toFixed(1)}%` : '--%'}
            </div>
            <div className="mt-2">
              {pred?.riskCategory === 'High' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1" /> High Risk (≥70%)
                </span>
              )}
              {pred?.riskCategory === 'Medium' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Medium Risk (40-70%)
                </span>
              )}
              {pred?.riskCategory === 'Low' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Low Risk (&lt;40%)
                </span>
              )}
              {!pred && <span className="text-xs text-slate-400">Waiting for 2.0s buffer...</span>}
            </div>
          </div>
        </div>

        {/* Feature telemetry */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Extracted Features on Current Window</h3>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-slate-400 text-[10px]">Delta Power</span>
              <p className="font-mono font-bold text-slate-800 mt-0.5">{pred?.features?.delta_power?.toFixed(2) || '--'}</p>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-slate-400 text-[10px]">Theta Power</span>
              <p className="font-mono font-bold text-slate-800 mt-0.5">{pred?.features?.theta_power?.toFixed(2) || '--'}</p>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-slate-400 text-[10px]">Alpha Power</span>
              <p className="font-mono font-bold text-slate-800 mt-0.5">{pred?.features?.alpha_power?.toFixed(2) || '--'}</p>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-slate-400 text-[10px]">Slowing Ratio</span>
              <p className="font-mono font-bold text-teal-700 mt-0.5">{pred?.features?.spectral_slowing_ratio?.toFixed(2) || '--'}</p>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-400 flex items-center">
            <Info className="w-3.5 h-3.5 mr-1 text-slate-400" />
            <span>Simulated wearable acquisition using recorded EEG data. Not a physical wearable connection.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatasetUpload;
