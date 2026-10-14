import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const PlaybackContext = createContext(null);

const DEFAULT_PATIENT_SESSION = {
  session: null,
  playbackStatus: 'stopped', // 'stopped', 'ready', 'running', 'paused', 'completed'
  recordingId: '',
  selectedChannel: 'FP1-F7',
  playbackSpeed: 1.0,
  startOffsetSec: 0,
  packetData: null,
  waveformData: [],
  riskTrends: [],
  alertNotice: null,
  playbackError: ''
};

export const PlaybackProvider = ({ children }) => {
  // Map of patientId -> session state object
  const [patientSessions, setPatientSessions] = useState({});
  const [activePatientId, setActivePatientId] = useState('');
  const [globalLatestAlert, setGlobalLatestAlert] = useState(null);

  // Per-patient polling timer references: { [patientId]: intervalId }
  const activeTimersRef = useRef({});
  const inFlightRef = useRef({});

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(activeTimersRef.current).forEach(t => {
        if (t) clearInterval(t);
      });
      activeTimersRef.current = {};
    };
  }, []);

  // Helper to query and sync active playback sessions
  const refreshActiveSessions = async (targetPid = null) => {
    try {
      const res = await api.getActivePlayback(targetPid ? { patientId: targetPid } : undefined);
      const allActive = res.data?.allActiveSessions || {};
      
      Object.entries(allActive).forEach(([pId, act]) => {
        if (!pId) return;
        setPatientSessions(prev => ({
          ...prev,
          [pId]: {
            ...(prev[pId] || DEFAULT_PATIENT_SESSION),
            session: {
              sessionId: act.sessionId,
              patientId: pId,
              recordingId: act.recordingId,
              selectedChannel: act.channel,
              totalSamples: act.totalSamples,
              playbackSpeed: act.playbackSpeed || 1.0
            },
            playbackStatus: act.status,
            recordingId: act.recordingId,
            selectedChannel: act.channel,
            playbackSpeed: act.playbackSpeed || 1.0
          }
        }));

        if (act.status === 'running') {
          startLoop(pId, act.sessionId, act.playbackSpeed || 1.0);
        }
      });
      return res.data;
    } catch (err) {
      // Non-blocking on network error
    }
  };

  // Check backend for existing active playback sessions on initial mount
  useEffect(() => {
    refreshActiveSessions();
  }, []);

  // Helper to get or initialize a patient's state
  const getPatientState = (pId) => {
    if (!pId) return DEFAULT_PATIENT_SESSION;
    return patientSessions[pId] || DEFAULT_PATIENT_SESSION;
  };

  // Dedicated loop per patient session
  const startLoop = (pId, sessionId, speed = 1.0) => {
    if (!pId || !sessionId) return;

    // Clear previous timer for this patient if any
    if (activeTimersRef.current[pId]) {
      clearInterval(activeTimersRef.current[pId]);
      delete activeTimersRef.current[pId];
    }

    const intervalMs = Math.max(150, Math.round(1000 / speed));

    activeTimersRef.current[pId] = setInterval(async () => {
      if (inFlightRef.current[pId]) return;
      inFlightRef.current[pId] = true;

      try {
        const res = await api.getPlaybackPacket(sessionId);
        const data = res.data;

        if (data.isCompleted || data.playbackStatus === 'completed') {
          if (activeTimersRef.current[pId]) {
            clearInterval(activeTimersRef.current[pId]);
            delete activeTimersRef.current[pId];
          }
        }

        setPatientSessions(prev => {
          const current = prev[pId] || DEFAULT_PATIENT_SESSION;
          const isDone = data.isCompleted || data.playbackStatus === 'completed';

          let updatedTrends = current.riskTrends;
          if (data.prediction) {
            const nowLabel = new Date().toTimeString().split(' ')[0];
            const newPoint = {
              time: `${Math.round(data.simulatedRecordingTimestamp || 0)}s`,
              clockTime: nowLabel,
              patientId: pId,
              probability: Math.round(data.prediction.modelProbability * 100 * 10) / 10,
              riskCategory: data.prediction.riskCategory || 'Low',
              isSeizureRisk: !!data.prediction.isSeizureRisk,
              features: data.prediction.features || {},
              packetSequence: data.packetSequenceNumber
            };

            if (!current.riskTrends.length || current.riskTrends[current.riskTrends.length - 1].packetSequence !== newPoint.packetSequence) {
              updatedTrends = [...current.riskTrends, newPoint].slice(-30);
            }
          }

          const alertCreated = data.alert?.alertCreated ? data.alert : current.alertNotice;
          if (data.alert?.alertCreated) {
            setGlobalLatestAlert({ ...data.alert, patientId: pId });
          }

          return {
            ...prev,
            [pId]: {
              ...current,
              playbackStatus: isDone ? 'completed' : (current.playbackStatus === 'paused' ? 'paused' : 'running'),
              packetData: data,
              waveformData: data.waveformPoints?.length > 0 ? data.waveformPoints : current.waveformData,
              riskTrends: updatedTrends,
              alertNotice: alertCreated
            }
          };
        });
      } catch (err) {
        console.error(`Playback packet fetch error for patient ${pId}:`, err);
      } finally {
        inFlightRef.current[pId] = false;
      }
    }, intervalMs);
  };

  // Configure chosen dataset and parameters for a specific patient
  const selectPatientRecording = (pId, recordingId, recommendedChannel = 'FP1-F7', startOffsetSec = 0) => {
    if (!pId) return;
    setPatientSessions(prev => {
      const current = prev[pId] || DEFAULT_PATIENT_SESSION;
      return {
        ...prev,
        [pId]: {
          ...current,
          recordingId,
          selectedChannel: recommendedChannel || current.selectedChannel || 'FP1-F7',
          startOffsetSec: startOffsetSec || 0,
          playbackError: ''
        }
      };
    });
  };

  // Initialize playback session for a patient
  const initPatientSession = async (pId, initData) => {
    const targetPatientId = pId || initData.patientId || activePatientId;
    if (!targetPatientId) throw new Error("patientId is required for initialization.");

    // Clear previous loop for this patient if any
    if (activeTimersRef.current[targetPatientId]) {
      clearInterval(activeTimersRef.current[targetPatientId]);
      delete activeTimersRef.current[targetPatientId];
    }

    try {
      const payload = {
        ...initData,
        patientId: targetPatientId
      };
      const res = await api.initPlayback(payload);
      if (res.data.success) {
        setPatientSessions(prev => {
          const current = prev[targetPatientId] || DEFAULT_PATIENT_SESSION;
          return {
            ...prev,
            [targetPatientId]: {
              ...current,
              session: res.data,
              playbackStatus: 'ready',
              recordingId: initData.recordingId || res.data.recordingId,
              selectedChannel: initData.channel || res.data.selectedChannel || 'FP1-F7',
              playbackSpeed: initData.playbackSpeed || 1.0,
              startOffsetSec: initData.startOffsetSec || 0,
              packetData: null,
              waveformData: [],
              riskTrends: [],
              alertNotice: null,
              playbackError: ''
            }
          };
        });
        return res.data;
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to initialize playback session.";
      setPatientSessions(prev => ({
        ...prev,
        [targetPatientId]: {
          ...(prev[targetPatientId] || DEFAULT_PATIENT_SESSION),
          playbackError: msg
        }
      }));
      throw new Error(msg);
    }
  };

  // Start playback for a patient
  const startPatientPlayback = async (pId, sessionId = null) => {
    const targetPatientId = pId || activePatientId;
    const pState = getPatientState(targetPatientId);
    const sid = sessionId || pState.session?.sessionId;
    if (!sid) throw new Error("No active session initialized for this patient.");

    try {
      const res = await api.startPlayback(sid);
      if (res.data.success) {
        setPatientSessions(prev => ({
          ...prev,
          [targetPatientId]: {
            ...(prev[targetPatientId] || DEFAULT_PATIENT_SESSION),
            playbackStatus: 'running'
          }
        }));
        startLoop(targetPatientId, sid, pState.playbackSpeed || 1.0);
        return res.data;
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to start playback.";
      setPatientSessions(prev => ({
        ...prev,
        [targetPatientId]: {
          ...(prev[targetPatientId] || DEFAULT_PATIENT_SESSION),
          playbackError: msg
        }
      }));
      throw new Error(msg);
    }
  };

  // Pause playback for a patient
  const pausePatientPlayback = async (pId) => {
    const targetPatientId = pId || activePatientId;
    const pState = getPatientState(targetPatientId);
    const sid = pState.session?.sessionId;
    if (!sid) return;

    if (activeTimersRef.current[targetPatientId]) {
      clearInterval(activeTimersRef.current[targetPatientId]);
      delete activeTimersRef.current[targetPatientId];
    }

    try {
      await api.pausePlayback(sid);
      setPatientSessions(prev => ({
        ...prev,
        [targetPatientId]: {
          ...(prev[targetPatientId] || DEFAULT_PATIENT_SESSION),
          playbackStatus: 'paused'
        }
      }));
    } catch (err) {
      console.error(`Pause error for patient ${targetPatientId}:`, err);
    }
  };

  // Resume playback for a patient
  const resumePatientPlayback = async (pId) => {
    const targetPatientId = pId || activePatientId;
    const pState = getPatientState(targetPatientId);
    const sid = pState.session?.sessionId;
    if (!sid) return;

    try {
      const res = await api.resumePlayback(sid);
      if (res.data.success) {
        setPatientSessions(prev => ({
          ...prev,
          [targetPatientId]: {
            ...(prev[targetPatientId] || DEFAULT_PATIENT_SESSION),
            playbackStatus: 'running'
          }
        }));
        startLoop(targetPatientId, sid, pState.playbackSpeed || 1.0);
      }
    } catch (err) {
      console.error(`Resume error for patient ${targetPatientId}:`, err);
    }
  };

  // Stop playback for a patient
  const stopPatientPlayback = async (pId) => {
    const targetPatientId = pId || activePatientId;
    const pState = getPatientState(targetPatientId);
    const sid = pState.session?.sessionId;

    if (activeTimersRef.current[targetPatientId]) {
      clearInterval(activeTimersRef.current[targetPatientId]);
      delete activeTimersRef.current[targetPatientId];
    }

    try {
      if (sid) {
        await api.stopPlayback(sid);
      } else {
        await api.stopPlayback(null, { patientId: targetPatientId });
      }
    } catch (err) {
      console.error(`Stop error for patient ${targetPatientId}:`, err);
    } finally {
      setPatientSessions(prev => ({
        ...prev,
        [targetPatientId]: {
          ...(prev[targetPatientId] || DEFAULT_PATIENT_SESSION),
          playbackStatus: 'stopped',
          packetData: null,
          waveformData: [],
          riskTrends: [],
          alertNotice: null
        }
      }));
    }
  };

  // Restart playback for a patient
  const restartPatientPlayback = async (pId) => {
    const targetPatientId = pId || activePatientId;
    const pState = getPatientState(targetPatientId);
    const sid = pState.session?.sessionId;
    if (!sid) return;

    try {
      const res = await api.restartPlayback(sid);
      if (res.data.success) {
        setPatientSessions(prev => ({
          ...prev,
          [targetPatientId]: {
            ...(prev[targetPatientId] || DEFAULT_PATIENT_SESSION),
            playbackStatus: 'running',
            packetData: null,
            waveformData: [],
            riskTrends: [],
            alertNotice: null
          }
        }));
        startLoop(targetPatientId, sid, pState.playbackSpeed || 1.0);
      }
    } catch (err) {
      console.error(`Restart error for patient ${targetPatientId}:`, err);
    }
  };

  // Complete cleanup when a patient is deleted or discharged
  const clearPatientSession = (pId) => {
    if (!pId) return;

    // 1. Immediately kill local polling interval
    if (activeTimersRef.current[pId]) {
      clearInterval(activeTimersRef.current[pId]);
      delete activeTimersRef.current[pId];
    }
    delete inFlightRef.current[pId];

    // 2. Terminate on backend
    api.stopPlayback(null, { patientId: pId }).catch(() => {});

    // 3. Remove from local state
    setPatientSessions(prev => {
      const next = { ...prev };
      delete next[pId];
      return next;
    });
  };

  // Change speed for a patient
  const changePatientSpeed = async (pId, newSpeed) => {
    const targetPatientId = pId || activePatientId;
    const pState = getPatientState(targetPatientId);
    const sid = pState.session?.sessionId;

    setPatientSessions(prev => ({
      ...prev,
      [targetPatientId]: {
        ...(prev[targetPatientId] || DEFAULT_PATIENT_SESSION),
        playbackSpeed: newSpeed
      }
    }));

    if (sid) {
      try {
        await api.setPlaybackSpeed(sid, newSpeed);
        if (pState.playbackStatus === 'running') {
          startLoop(targetPatientId, sid, newSpeed);
        }
      } catch (err) {
        console.error("Speed change failed:", err);
      }
    }
  };

  // Change channel for a patient
  const changePatientChannel = async (pId, newChannel) => {
    const targetPatientId = pId || activePatientId;
    const pState = getPatientState(targetPatientId);
    const sid = pState.session?.sessionId;

    setPatientSessions(prev => ({
      ...prev,
      [targetPatientId]: {
        ...(prev[targetPatientId] || DEFAULT_PATIENT_SESSION),
        selectedChannel: newChannel
      }
    }));

    if (sid) {
      try {
        await api.setPlaybackChannel(sid, newChannel);
      } catch (err) {
        console.error("Channel change failed:", err);
      }
    }
  };

  // Current active patient state for simple direct consumption
  const activeState = getPatientState(activePatientId);

  return (
    <PlaybackContext.Provider
      value={{
        // Multi-patient states
        patientSessions,
        activePatientId,
        setActivePatientId,
        getPatientState,
        globalLatestAlert,

        // Direct getters for currently active patient
        session: activeState.session,
        playbackStatus: activeState.playbackStatus,
        playbackSpeed: activeState.playbackSpeed,
        selectedChannel: activeState.selectedChannel,
        selectedRecordingId: activeState.recordingId,
        packetData: activeState.packetData,
        waveformData: activeState.waveformData,
        riskTrends: activeState.riskTrends,
        alertNotice: activeState.alertNotice,
        playbackError: activeState.playbackError,
        setPlaybackError: (msg) => {
          if (activePatientId) {
            setPatientSessions(prev => ({
              ...prev,
              [activePatientId]: {
                ...(prev[activePatientId] || DEFAULT_PATIENT_SESSION),
                playbackError: msg
              }
            }));
          }
        },

        // Per-patient explicit methods
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

        // Backward compatibility signatures targeting active patient
        initSession: (initData) => initPatientSession(activePatientId, initData),
        startPlayback: (sessionId) => startPatientPlayback(activePatientId, sessionId),
        pausePlayback: () => pausePatientPlayback(activePatientId),
        resumePlayback: () => resumePatientPlayback(activePatientId),
        stopPlayback: () => stopPatientPlayback(activePatientId),
        restartPlayback: () => restartPatientPlayback(activePatientId),
        changeSpeed: (speed) => changePatientSpeed(activePatientId, speed),
        changeChannel: (channel) => changePatientChannel(activePatientId, channel),
        setRiskTrends: (trends) => {
          if (activePatientId) {
            setPatientSessions(prev => ({
              ...prev,
              [activePatientId]: {
                ...(prev[activePatientId] || DEFAULT_PATIENT_SESSION),
                riskTrends: typeof trends === 'function' ? trends(prev[activePatientId]?.riskTrends || []) : trends
              }
            }));
          }
        }
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
};

export const usePlayback = () => {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
};
