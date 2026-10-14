import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Cpu, Lock, Mail, User, ArrowRight, ShieldCheck, ArrowLeft, Phone, HeartHandshake } from 'lucide-react';

export const Register = () => {
  const { registerWithEmail } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Doctor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please complete all required fields.");
      return;
    }
    if (role === 'Caretaker' && !phone.trim()) {
      setError("Mobile phone number is mandatory for Caretakers to match and authorize your dependent patient.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      await registerWithEmail(email, password, name, role, phone.trim());
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || "Registration error. Please check your information.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-sky-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-8 text-center bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-teal-500/30">
            {role === 'Caretaker' ? <HeartHandshake className="w-7 h-7" /> : <Cpu className="w-7 h-7" />}
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {role === 'Caretaker' ? 'Register Patient Caretaker Account' : 'Register Account'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {role === 'Caretaker'
              ? 'Connect your phone number to access your dependent patient records'
              : 'Edge AI Based Epilepsy Patient Monitoring System'}
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Account Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-white font-medium"
              >
                <option value="Doctor">Doctor / Neurologist</option>
                <option value="Administrator">Clinical Administrator</option>
                <option value="Caretaker">Patient Caretaker / Guardian</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={role === 'Caretaker' ? "e.g. Ramesh Sharma" : "e.g. Dr. Ramesh Rao"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder={role === 'Caretaker' ? "caretaker@gmail.com" : "doctor@hospital.org"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-medium text-slate-700">Mobile Phone Number</label>
                {role === 'Caretaker' ? (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    Mandatory for Caretakers
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">Optional</span>
                )}
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="+919876543210 (International E.164)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 font-mono text-xs"
                  required={role === 'Caretaker'}
                />
              </div>
              {role === 'Caretaker' && (
                <p className="text-[11px] text-amber-700/90 mt-1 leading-tight">
                  Enter the exact mobile number given during patient admission. This verifies and unlocks your patient records.
                </p>
              )}
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
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg shadow-md shadow-teal-600/20 transition disabled:opacity-60"
            >
              <span>{loading ? 'Creating...' : 'Register Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center text-xs text-slate-500 pt-2 space-y-2">
            <div>
              Already registered?{' '}
              <Link to="/login" className="text-teal-600 font-semibold hover:underline">
                Sign In
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

export default Register;
