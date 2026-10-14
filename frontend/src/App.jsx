import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PlaybackProvider } from './context/PlaybackContext';

import DashboardLayout from './layouts/DashboardLayout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import LiveMonitoring from './pages/LiveMonitoring';
import Patients from './pages/Patients';
import PatientDetails from './pages/PatientDetails';
import Records from './pages/Records';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';

// Protected Route Guard
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-teal-400 text-sm">
        Initializing Edge AI Monitoring System...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export function App() {
  return (
    <AuthProvider>
      <PlaybackProvider>
        <BrowserRouter>
          <Routes>
            {/* Front Page with Login / Signup Options */}
            <Route path="/" element={<Landing />} />

            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Clinical Portal */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/monitoring" element={<LiveMonitoring />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/patients/:id" element={<PatientDetails />} />
              <Route path="/records" element={<Records />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/upload" element={<Navigate to="/monitoring" replace />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </PlaybackProvider>
    </AuthProvider>
  );
}

export default App;
