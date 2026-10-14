import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Cpu, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, ArrowLeft } from 'lucide-react';

export const Login = () => {
  const { loginWithEmail, loginWithDemo } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      await loginWithEmail(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError("Login failed. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role) => {
    loginWithDemo(role);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-sky-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-8 text-center bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-teal-500/30">
            <Cpu className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            EDGE AI EPILEPSY MONITOR
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Clinical Seizure Detection & Caretaker Alert System
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Quick Demo Access Bar */}
          <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-3 text-center">
            <span className="text-[11px] font-bold text-teal-900 block mb-2 uppercase tracking-wider">
              One-Click Instant Evaluation
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('Doctor')}
                className="bg-white hover:bg-teal-50 border border-teal-300 text-teal-800 text-xs font-semibold py-1.5 px-2 rounded-lg shadow-xs transition"
              >
                Sign In as Doctor
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('Administrator')}
                className="bg-white hover:bg-purple-50 border border-purple-300 text-purple-800 text-xs font-semibold py-1.5 px-2 rounded-lg shadow-xs transition"
              >
                Sign In as Admin
              </button>
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-slate-400 text-[11px] font-semibold uppercase">Or with Credentials</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="doctor@epilepsycare.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg shadow-md shadow-teal-600/20 transition disabled:opacity-60"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center text-xs text-slate-500 pt-2 space-y-2">
            <div>
              Don't have an account?{' '}
              <Link to="/register" className="text-teal-600 font-semibold hover:underline">
                Register New User
              </Link>
            </div>
            <div>
              <Link to="/" className="inline-flex items-center text-slate-400 hover:text-slate-600 hover:underline">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                <span>Return to Front Page</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
