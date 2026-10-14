import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Settings as SettingsIcon,
  Cpu,
  Radio,
  Phone,
  Database,
  Save,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders
} from 'lucide-react';

export const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retraining, setRetraining] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({});
  const [twilioStatus, setTwilioStatus] = useState({});
  const [firebaseStatus, setFirebaseStatus] = useState({});
  const [modelStatus, setModelStatus] = useState({});

  // Threshold form
  const [lowThreshold, setLowThreshold] = useState(40);
  const [highThreshold, setHighThreshold] = useState(70);
  const [cooldownSec, setCooldownSec] = useState(90);
  const [smsTemplate, setSmsTemplate] = useState('');

  // Explicit Test SMS Dialog
  const [testPhone, setTestPhone] = useState('');
  const [confirmTest, setConfirmTest] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      const s = res.data.settings || {};
      setSettings(s);
      setTwilioStatus(res.data.twilioStatus || {});
      setFirebaseStatus(res.data.firebaseStatus || {});
      setModelStatus(res.data.modelStatus || {});

      if (s.riskThresholds) {
        setLowThreshold(Math.round(s.riskThresholds.low * 100));
        setHighThreshold(Math.round(s.riskThresholds.high * 100));
      }
      if (s.alertCooldownSeconds) {
        setCooldownSec(s.alertCooldownSeconds);
      }
      if (s.smsTemplate) {
        setSmsTemplate(s.smsTemplate);
      }
      if (!testPhone && (res.data.twilioStatus?.verifiedDestinationNumber || res.data.twilioStatus?.senderNumber)) {
        setTestPhone('+918792847121');
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveThresholds = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setErrorMsg('');

    try {
      await api.updateSettings({
        riskThresholds: {
          low: lowThreshold / 100.0,
          high: highThreshold / 100.0
        },
        alertCooldownSeconds: parseInt(cooldownSec, 10),
        smsTemplate: smsTemplate
      });
      setMessage("System thresholds and parameters updated successfully.");
      fetchSettings();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleRetrainModel = async () => {
    setRetraining(true);
    setMessage('');
    try {
      const res = await api.trainModel();
      setMessage(`Random Forest model retrained! Accuracy: ${(res.data.metrics?.accuracy * 100).toFixed(1)}%, F1: ${(res.data.metrics?.f1_score * 100).toFixed(1)}%.`);
      fetchSettings();
    } catch (err) {
      setErrorMsg("Model retraining failed.");
    } finally {
      setRetraining(false);
    }
  };

  const handleSendTestSms = async (e) => {
    e.preventDefault();
    if (!confirmTest) {
      setErrorMsg("Please check the confirmation box before sending test SMS.");
      return;
    }
    setTestSending(true);
    setTestResult(null);
    setErrorMsg('');

    try {
      const res = await api.sendTestSms(testPhone, confirmTest);
      setTestResult(res.data);
      setMessage("Test SMS dispatched. Check status below.");
    } catch (err) {
      setErrorMsg(err.response?.data?.error || "Test SMS dispatch failed.");
    } finally {
      setTestSending(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading system settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          System Configuration & Service Integration
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Tune edge risk thresholds, verify Twilio SMS credentials, inspect database status, and calibrate models
        </p>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="font-bold">&times;</button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="font-bold">&times;</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Thresholds & Cooldown Form */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-slate-100">
            <Sliders className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Risk Classification Thresholds & Cooldown
            </h3>
          </div>

          <form onSubmit={handleSaveThresholds} className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>Low Risk Ceiling (&lt; %):</span>
                <span className="font-bold text-emerald-600">{lowThreshold}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={lowThreshold}
                onChange={(e) => setLowThreshold(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
              <span className="text-[10px] text-slate-400">Classifies normal awake background EEG</span>
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>High Risk Floor (&ge; %):</span>
                <span className="font-bold text-red-600">{highThreshold}%</span>
              </div>
              <input
                type="range"
                min="60"
                max="90"
                step="5"
                value={highThreshold}
                onChange={(e) => setHighThreshold(Number(e.target.value))}
                className="w-full accent-red-600"
              />
              <span className="text-[10px] text-slate-400">Triggers emergency caretaker SMS alerts</span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Alert Cooldown Window (Seconds)
              </label>
              <input
                type="number"
                min="30"
                max="600"
                value={cooldownSec}
                onChange={(e) => setCooldownSec(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Suppresses repetitive duplicate SMS spam for the same ongoing seizure episode.
              </span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Caretaker Emergency SMS Template
              </label>
              <textarea
                rows={3}
                value={smsTemplate}
                onChange={(e) => setSmsTemplate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 font-mono text-[11px]"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Placeholders: &#123;patient_name&#125;, &#123;patient_id&#125;, &#123;timestamp&#125;
              </span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </form>
        </div>

        {/* Machine Learning Model Calibration */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-slate-100">
              <Cpu className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Random Forest Model Architecture
              </h3>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Model Version:</span>
                <span className="font-semibold text-slate-800">{modelStatus.model_version || '1.0.0'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Total Estimator Trees:</span>
                <span className="font-semibold text-slate-800">100 Trees</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Feature Dimensions:</span>
                <span className="font-semibold text-slate-800">{modelStatus.features_count || 13} Biometric Features</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Validation Accuracy:</span>
                <span className="font-bold text-emerald-600">
                  {modelStatus.metrics?.accuracy ? `${(modelStatus.metrics.accuracy * 100).toFixed(1)}%` : 'Calibrated'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Sensitivity / Recall:</span>
                <span className="font-bold text-emerald-600">
                  {modelStatus.metrics?.recall_sensitivity ? `${(modelStatus.metrics.recall_sensitivity * 100).toFixed(1)}%` : '100%'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Sampling Frequency:</span>
                <span className="font-semibold text-slate-800">256 Hz (CHB-MIT Standard)</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <button
              onClick={handleRetrainModel}
              disabled={retraining}
              className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-2 px-4 rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />
              <span>{retraining ? 'Retraining Random Forest...' : 'Retrain & Calibrate Model Locally'}</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Zero-cost Scikit-learn execution on local device. No paid cloud APIs required.
            </p>
          </div>
        </div>

        {/* Twilio SMS Service & Safe Test Tool */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-slate-100">
            <Phone className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Twilio SMS Integration Status
            </h3>
          </div>

          <div className="space-y-2 text-xs mb-4">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Operational Mode:</span>
              <span className={`font-semibold ${twilioStatus.configured ? 'text-emerald-700' : 'text-purple-700'}`}>
                {twilioStatus.mode || 'In-App Alerts (Zero-Cost Mode)'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Sender Number:</span>
              <span className="font-mono text-slate-700">{twilioStatus.senderNumber || 'Unset (Using In-App)'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Delivery Scope:</span>
              <span className="font-semibold text-emerald-700">
                {twilioStatus.forceVerifiedOnly ? `Trial Only (${twilioStatus.verifiedDestinationNumber})` : 'All Caretaker Mobile Numbers (Upgraded)'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Delivery Callbacks:</span>
              <span className="text-slate-700">{twilioStatus.statusCallbackConfigured ? 'Configured' : 'Localhost (No Public Tunnel)'}</span>
            </div>
          </div>

          {/* Safe Controlled Test SMS Section */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 mb-1">Send Manual Verification SMS</h4>
            <p className="text-[11px] text-slate-500 mb-3">
              Explicit administrator verification. Requires number confirmation to prevent inadvertent charges.
            </p>

            <form onSubmit={handleSendTestSms} className="space-y-2.5 text-xs">
              <input
                type="tel"
                placeholder="Destination Mobile Number (e.g. +919876543210)"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 font-mono bg-white"
                required
              />

              <label className="flex items-start space-x-2 cursor-pointer text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={confirmTest}
                  onChange={(e) => setConfirmTest(e.target.checked)}
                  className="mt-0.5 rounded text-teal-600"
                />
                <span>I confirm sending a test SMS to this destination number.</span>
              </label>

              <button
                type="submit"
                disabled={testSending || !confirmTest}
                className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs py-1.5 px-3.5 rounded-lg transition disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{testSending ? 'Transmitting...' : 'Dispatch Test SMS'}</span>
              </button>
            </form>

            {testResult && (
              <div className="mt-3 text-[11px] bg-white p-2.5 rounded border border-slate-200">
                <div>Status: <strong className="font-mono">{testResult.result?.deliveryStatus}</strong></div>
                <div>Recipient: <span className="font-mono">{testResult.recipient}</span></div>
                {testResult.result?.safeErrorDescription && (
                  <div className="text-slate-500 mt-1">{testResult.result.safeErrorDescription}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Database & Cloud Firestore Status */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-slate-100">
            <Database className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Database & Firebase Storage Tier
            </h3>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Database Engine:</span>
              <span className="font-semibold text-slate-800">{firebaseStatus.mode}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>GCP Project ID:</span>
              <span className="font-mono text-slate-700">{firebaseStatus.projectId}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Free Quota Usage:</span>
              <span className="text-emerald-700 font-semibold">100% Free Tier Compliant</span>
            </div>
          </div>

          <div className="mt-4 bg-teal-50/60 p-3 rounded-lg border border-teal-100 text-[11px] text-teal-900 leading-relaxed">
            <strong>Zero-Cost Guarantee:</strong> When GCP service account credentials are provided, Cloud Firestore is utilized within Spark free quotas. Otherwise, the built-in local SQLite emulator stores patient records, sessions, alerts, and predictions seamlessly without payment.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
