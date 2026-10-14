import axios from 'axios';

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || '';
const API_BASE = RAW_BASE ? `${RAW_BASE.replace(/\/$/, '')}/api` : '/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach Firebase or demo token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token') || 'demo_doctor_token';
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export const api = {
  // Auth
  verifyToken: (token) => apiClient.post('/auth/verify', { token }),
  getCurrentUser: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.post('/auth/profile', data),
  login: (data) => apiClient.post('/auth/login', data),
  register: (data) => apiClient.post('/auth/register', data),


  // Patients
  getPatients: (params) => apiClient.get('/patients', { params }),
  getPatient: (id) => apiClient.get(`/patients/${id}`),
  registerPatient: (data) => apiClient.post('/patients', data),
  updatePatient: (id, data) => apiClient.put(`/patients/${id}`, data),
  updateCaretaker: (id, data) => apiClient.put(`/patients/${id}/caretaker`, data),
  deletePatient: (id, data) => apiClient.delete(`/patients/${id}`, { data }),
  getDischargedPatients: () => apiClient.get('/patients/discharged'),
  getDischargedPatient: (id) => apiClient.get(`/patients/discharged/${id}`),
  restoreDischargedPatient: (id) => apiClient.post(`/patients/discharged/${id}/restore`),
  deleteDischargedRecord: (id) => apiClient.delete(`/patients/discharged/${id}`),


  // Monitoring & Simulator
  getRecordings: () => apiClient.get('/monitoring/recordings'),
  startMonitoring: (data) => apiClient.post('/monitoring/start', data),
  pauseMonitoring: (sessionId) => apiClient.post('/monitoring/pause', { sessionId }),
  resumeMonitoring: (sessionId) => apiClient.post('/monitoring/resume', { sessionId }),
  stopMonitoring: (sessionId) => apiClient.post('/monitoring/stop', { sessionId }),
  processBatch: (sessionId) => apiClient.post('/monitoring/batch', { sessionId }),
  getSessionStatus: (sessionId) => apiClient.get(`/monitoring/status/${sessionId}`),

  // EEG Dataset Upload & Continuous Playback Simulator
  uploadEegFile: (formData) => apiClient.post('/upload/eeg', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getUploadedRecordings: (params) => apiClient.get('/upload/recordings', { params }),
  generateSampleEdf: (pattern, patientId) => apiClient.post('/upload/generate-sample', { pattern, patientId }),
  getDownloadUrl: (recordingId) => `${API_BASE}/upload/download/${recordingId}`,

  // Continuous Playback Engine
  getActivePlayback: (params) => apiClient.get('/playback/active', { params }),
  initPlayback: (data) => apiClient.post('/playback/init', data),
  startPlayback: (sessionId, extra = {}) => apiClient.post('/playback/start', typeof sessionId === 'object' ? sessionId : { sessionId, ...extra }),
  pausePlayback: (sessionId) => apiClient.post('/playback/pause', { sessionId }),
  resumePlayback: (sessionId) => apiClient.post('/playback/resume', { sessionId }),
  stopPlayback: (sessionId, extra = {}) => apiClient.post('/playback/stop', typeof sessionId === 'object' ? sessionId : { sessionId, ...extra }),
  restartPlayback: (sessionId) => apiClient.post('/playback/restart', { sessionId }),
  getPlaybackPacket: (sessionId) => apiClient.post('/playback/packet', { sessionId }),
  setPlaybackSpeed: (sessionId, playbackSpeed) => apiClient.post('/playback/speed', { sessionId, playbackSpeed }),
  setPlaybackChannel: (sessionId, channel) => apiClient.post('/playback/channel', { sessionId, channel }),

  // Machine Learning
  getMlStatus: () => apiClient.get('/ml/status'),
  trainModel: () => apiClient.post('/ml/train'),
  predictWindow: (samples) => apiClient.post('/ml/predict', { samples }),

  // Alerts & Notifications
  getAlerts: (params) => apiClient.get('/alerts', { params }),
  acknowledgeAlert: (alertId) => apiClient.post(`/alerts/${alertId}/acknowledge`),
  retryNotification: (alertId) => apiClient.post(`/alerts/${alertId}/retry-notification`),
  deleteAlert: (alertId) => apiClient.delete(`/alerts/${alertId}`),
  clearAllAlerts: () => apiClient.delete('/alerts/clear-all'),
  getNotifications: (params) => apiClient.get('/alerts/notifications', { params }),
  sendTestSms: (phoneNumber, confirmed) => apiClient.post('/alerts/test-sms', { phoneNumber, confirmed }),

  // Dashboard & Analytics
  getDashboardStats: () => apiClient.get('/dashboard/stats'),
  getHistory: (params) => apiClient.get('/reports/history', { params }),
  exportCsv: (params) => apiClient.get('/reports/export-csv', { params, responseType: 'blob' }),
  getExportCsvUrl: (patientId) => `${API_BASE}/reports/export-csv${patientId ? `?patientId=${patientId}` : ''}`,
  exportPdf: (params) => apiClient.get('/reports/export-pdf', { params, responseType: 'blob' }),
  getExportPdfUrl: (patientId) => `${API_BASE}/reports/export-pdf${patientId ? `?patientId=${patientId}` : ''}`,

  // Settings & System
  getSettings: () => apiClient.get('/settings'),
  updateSettings: (data) => apiClient.put('/settings', data),
  getHealth: () => apiClient.get('/health'),
};

export default api;
