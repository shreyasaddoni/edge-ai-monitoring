import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  Users,
  Bell,
  BarChart3,
  Settings,
  Cpu,
  LogOut,
  ShieldAlert,
  Radio,
  FileText,
  UserCheck,
  ChevronDown,
  UploadCloud,
  ClipboardList
} from 'lucide-react';

export const DashboardLayout = () => {
  const { user, logout, loginWithDemo } = useAuth();
  const navigate = useNavigate();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const userRole = user?.role || 'Doctor';

  const allNavItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Activity, roles: ['Doctor', 'Administrator', 'Caretaker'] },
    {
      name: userRole === 'Caretaker' ? 'Live Telemetry (View Only)' : 'Live EEG & Dataset Monitoring',
      path: '/monitoring',
      icon: Radio,
      roles: ['Doctor', 'Administrator', 'Caretaker']
    },
    {
      name: userRole === 'Caretaker' ? 'Dependent Patient Profile' : 'Patient Management',
      path: '/patients',
      icon: Users,
      roles: ['Doctor', 'Administrator', 'Caretaker']
    },
    { name: 'Patient Records & History', path: '/records', icon: ClipboardList, roles: ['Doctor', 'Administrator', 'Caretaker'] },
    { name: 'Alerts & Twilio SMS', path: '/alerts', icon: Bell, roles: ['Doctor', 'Administrator', 'Caretaker'] },
    { name: 'Reports & Analytics', path: '/reports', icon: FileText, roles: ['Doctor', 'Administrator', 'Caretaker'] },
    { name: 'System Settings', path: '/settings', icon: Settings, roles: ['Administrator'] },
  ];

  const navItems = allNavItems.filter((item) => item.roles.includes(userRole));


  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Dark Navy-Blue Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between flex-shrink-0 z-20">
        <div>
          {/* Brand & Hospital Logo Header */}
          <div className="p-5 border-b border-slate-800/80">
            <NavLink to="/" title="Return to Front Page" className="flex items-center space-x-3 hover:opacity-90 transition">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white leading-tight">
                  EDGE AI MONITOR
                </h1>
                <p className="text-[11px] font-medium text-teal-400">
                  Epilepsy Seizure Care
                </p>
              </div>
            </NavLink>
            <div className="mt-3 px-2 py-1 rounded bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">System</span>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 inline-block animate-pulse"></span>
                Clinical Telemetry
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30 font-semibold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Hardware & Model Status */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/40 mb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400 font-medium">Edge Inference</span>
              <span className="flex items-center text-emerald-400 font-semibold text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 pulse-indicator"></span>
                Active
              </span>
            </div>
            <div className="text-[11px] text-slate-300 font-mono">
              Model: Random Forest v1.0
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Sampling: 256 Hz • SciPy Filter
            </div>
          </div>

          {/* User Profile Card */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-teal-500/30 flex items-center justify-center text-teal-400 text-xs font-bold">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'D'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">
                  {user?.name || 'Dr. Attending'}
                </p>
                <span className={`inline-block text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  user?.role === 'Administrator' ? 'bg-purple-900/60 text-purple-300' :
                  user?.role === 'Caretaker' ? 'bg-amber-900/60 text-amber-300' :
                  'bg-teal-950 text-teal-300'
                }`}>
                  {user?.role || 'Doctor'}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0 z-10 shadow-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded bg-teal-50 text-teal-800 text-xs font-semibold tracking-wide border border-teal-200">
                CLINICAL TELEMETRY SYSTEM
              </span>
              <span className="text-slate-300">|</span>
              <h2 className="text-sm font-semibold text-slate-800">
                Edge AI Based Epilepsy Patient Monitoring System
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Quick Demo Role Switcher */}
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center space-x-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>Role: <strong className="font-semibold">{user?.role}</strong></span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-30">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Switch Active Role
                  </div>
                  <button
                    onClick={() => { loginWithDemo('Doctor'); setRoleMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-800 flex items-center justify-between"
                  >
                    <span>Doctor Portal</span>
                    {user?.role === 'Doctor' && <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>}
                  </button>
                  <button
                    onClick={() => { loginWithDemo('Administrator'); setRoleMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-800 flex items-center justify-between"
                  >
                    <span>Administrator Portal</span>
                    {user?.role === 'Administrator' && <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>}
                  </button>
                </div>
              )}
            </div>

            {user?.role !== 'Caretaker' && (
              <NavLink
                to="/monitoring"
                className="flex items-center space-x-1.5 text-xs bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium px-3.5 py-1.5 rounded-lg shadow-sm shadow-teal-500/20 transition"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Launch Simulator</span>
              </NavLink>
            )}
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
