import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  Cpu,
  Radio,
  Bell,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Lock,
  UserPlus,
  Users,
  ChevronRight,
  LogOut,
  Clock,
  Server,
  Zap,
  Sliders
} from 'lucide-react';

export const Landing = () => {
  const { user, loginWithDemo, logout } = useAuth();
  const navigate = useNavigate();

  const handleDemoAccess = (role) => {
    loginWithDemo(role);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-teal-600 selection:text-white">
      {/* Top Clinical Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo / Title */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-slate-900 block leading-tight">
                EDGE AI MONITOR
              </span>
              <span className="text-[11px] text-teal-700 font-medium">
                Epilepsy Seizure Care
              </span>
            </div>
          </Link>

          {/* Header Actions */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="hidden md:inline-flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Signed in as <strong className="text-slate-900">{user.name}</strong> ({user.role})</span>
                </span>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center space-x-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-xs transition cursor-pointer"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={logout}
                  className="text-xs text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2.5">
                <Link
                  to="/login"
                  className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg shadow-xs transition"
                >
                  <Lock className="w-3.5 h-3.5 text-teal-600" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  className="flex items-center space-x-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg shadow-xs transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Band 1: Hero Section with Light Gradient Band */}
      <section className="bg-gradient-to-b from-sky-50/50 via-slate-50/70 to-white border-b border-slate-200 pt-12 pb-16 lg:pt-16 lg:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-5">
            {/* Clinical Identification Pill */}
            <div className="inline-flex items-center space-x-2 bg-white border border-teal-200 text-teal-800 px-3.5 py-1 rounded-full text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-teal-600"></span>
              <span>Clinical Edge AI Telemetry • 256Hz Real-Time Inference</span>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Edge AI Based Epilepsy <br />
              <span className="text-teal-700 block mt-1">Patient Monitoring System</span>
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Autonomous physiological seizure surveillance combining continuous multi-channel EEG telemetry,
              low-latency Random Forest classification, and automated caretaker emergency SMS notification.
            </p>

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {user ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm transition cursor-pointer text-xs sm:text-sm"
                >
                  <Activity className="w-4 h-4" />
                  <span>Enter Clinical Dashboard</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm transition text-xs sm:text-sm"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Clinician Sign In</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                  <Link
                    to="/register"
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-5 py-2.5 rounded-lg shadow-xs transition text-xs sm:text-sm"
                  >
                    <UserPlus className="w-4 h-4 text-teal-600" />
                    <span>Register Account</span>
                  </Link>
                </>
              )}
            </div>

            {/* Clinician Demonstration Access Box */}
            <div className="pt-3 max-w-md mx-auto">
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl text-left shadow-xs">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Clinician Demonstration Portals
                  </span>
                  <span className="text-[11px] text-slate-400">Direct Evaluation</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleDemoAccess('Doctor')}
                    className="bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-700 hover:text-teal-900 text-xs font-semibold py-2 px-3 rounded-lg transition text-left flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-[10px] text-teal-700 font-mono font-bold uppercase">Doctor Portal</div>
                      <div className="text-xs font-bold text-slate-900">Dr. Sarah Jenkins</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                  <button
                    onClick={() => handleDemoAccess('Administrator')}
                    className="bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-slate-700 hover:text-purple-900 text-xs font-semibold py-2 px-3 rounded-lg transition text-left flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-[10px] text-purple-700 font-mono font-bold uppercase">Admin Portal</div>
                      <div className="text-xs font-bold text-slate-900">Clinical Administrator</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Clinical Security & Protected Health Information (PHI) Notice */}
          <div className="mt-12 max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-slate-900">
                    Protected Clinical Telemetry Environment
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Patient records, continuous EEG telemetry streams, and caretaker contact directories require authenticated clinical access.
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Protected Health Data (HIPAA)</span>
              </div>
            </div>

            {/* 3 Core System Security Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 mb-1.5">
                  <Lock className="w-4 h-4 text-teal-700" />
                  <span>Role-Based Authentication</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Strict access control for attending neurologists and system administrators to review patient cohorts and audit trails.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 mb-1.5">
                  <Activity className="w-4 h-4 text-teal-700" />
                  <span>Real-Time Edge Inference</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  256Hz multi-channel EEG signal acquisition and localized Random Forest classification under 50ms latency.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 mb-1.5">
                  <Bell className="w-4 h-4 text-teal-700" />
                  <span>Automated Caretaker Dispatch</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Encrypted emergency notification protocol dispatched to consented caretakers during verified seizure events.
                </p>
              </div>
            </div>

            {/* Direct Access Footer Bar */}
            <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-3">
              <span className="text-left">Sign in with authorized clinician credentials to inspect active patient monitoring and EEG telemetry.</span>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <Link
                  to="/login"
                  className="font-semibold text-teal-700 hover:text-teal-800 hover:underline inline-flex items-center"
                >
                  <span>Go to Clinician Login</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Band 2: Clinical Architecture & Technical Specifications */}
      <section className="py-16 bg-slate-50/70 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-xs uppercase tracking-wider text-teal-700 font-bold">
              Clinical System Architecture
            </h2>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              Edge AI Seizure Surveillance Telemetry
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
              Specifications for real-time EEG analysis, classification, caretaker notification, and clinical record retention.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-teal-400 transition shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center mb-3">
                <Cpu className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Edge AI Classifier</h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                100-tree Scikit-learn Random Forest model extracting 13 time and frequency domain features with inference latency under 50ms.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-teal-400 transition shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 flex items-center justify-center mb-3">
                <Radio className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Continuous EEG Telemetry</h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Continuous 256Hz EDF stream simulator with speed scaling (1x to 8x) and 10-20 standard bipolar montage channel selection.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-teal-400 transition shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <Bell className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Automated SMS Dispatch</h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Emergency Twilio notifications dispatched to consented caretakers during high-risk events with complete delivery audit logging.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-teal-400 transition shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Clinical PDF Reports</h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Automated generation of vector clinical PDF audit reports with band power metrics and physician signature blocks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Band 3: Clinical Protocol & Pipeline Standards */}
      <section className="py-14 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-xs uppercase tracking-wider text-teal-700 font-bold">
              Surveillance Protocols
            </h2>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              Validated Signal Processing Pipeline
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 mb-2">
                <Sliders className="w-4 h-4 text-teal-700" />
                <span>1. Signal Preprocessing</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                SciPy 4th-order Butterworth bandpass filtering (0.5–45.0 Hz) and IIR Notch filtering at 50 Hz to eliminate electrical artifacts and powerline hum.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 mb-2">
                <Activity className="w-4 h-4 text-teal-700" />
                <span>2. Feature Extraction</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Computes time-domain (RMS, line length, kurtosis) and Welch spectral power densities across Delta, Theta, Alpha, and Beta physiological frequency bands.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 mb-2">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                <span>3. Caretaker Safety Logic</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                90-second cooldown interval prevents repeated notification storms while maintaining high-risk alert verification via Twilio REST webhooks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Band 4: Clinical Portal Access Section */}
      <section className="py-14 bg-gradient-to-b from-slate-50 via-teal-50/20 to-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <h3 className="text-xl font-bold text-slate-900">
            Access the Clinical Monitoring Console
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
            Sign in with clinician credentials or launch direct evaluation to inspect live telemetry, patient registries, and alert ledgers.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/login"
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-xs transition"
            >
              Sign In to Clinician Console
            </Link>
            <button
              onClick={() => handleDemoAccess('Doctor')}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-5 py-2.5 rounded-lg shadow-xs transition cursor-pointer"
            >
              Direct Evaluation (Doctor)
            </button>
          </div>
        </div>
      </section>

      {/* Band 5: Institutional Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-slate-50 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-700">Edge AI Based Epilepsy Patient Monitoring System</span>
          </div>
          <div>
            <span>Random Forest Classifier v1.0.0 • Scipy 256Hz Filter • Twilio REST API</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/login" className="hover:text-slate-800">Sign In</Link>
            <Link to="/register" className="hover:text-slate-800">Register</Link>
            {user && <Link to="/dashboard" className="text-teal-700 hover:underline font-medium">Dashboard</Link>}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
