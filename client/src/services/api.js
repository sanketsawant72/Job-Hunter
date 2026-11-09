/**
 * Axios API service with interceptors
 */
import axios from 'axios';
import { toast } from 'react-toastify';

const configuredApiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const API_URL = /^https?:\/\//i.test(configuredApiUrl) && !configuredApiUrl.endsWith('/api')
  ? `${configuredApiUrl}/api`
  : configuredApiUrl;

export const getGmailCallbackUrl = () => {
  if (!/^https?:\/\//i.test(API_URL)) return 'http://localhost:5000/api/gmail/callback';
  return `${new URL(API_URL).origin}/api/gmail/callback`;
};

export const getAssetUrl = (url) => {
  if (!url || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) return url;
  if (!/^https?:\/\//i.test(API_URL)) return url;
  return `${new URL(API_URL).origin}${url.startsWith('/') ? url : `/${url}`}`;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor - attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const authErrorCodes = [
      'AUTH_REQUIRED',
      'AUTH_USER_NOT_FOUND',
      'AUTH_TOKEN_INVALID',
      'AUTH_TOKEN_EXPIRED',
    ];
    const isAppAuthError = authErrorCodes.includes(error.response?.data?.code);
    // Allow requests to opt out of the hard redirect on auth errors
    const skipAuthRedirect = error.config?.skipAuthRedirect === true;

    if (error.response?.status === 401 && isAppAuthError && !skipAuthRedirect) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please slow down.');
    }

    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: (options = {}) => api.post('/auth/logout', {}, options),
  getProfile: (options = {}) => api.get('/auth/profile', options),
  updateProfile: (data, options = {}) => api.put('/auth/profile', data, options),
  changePassword: (data, options = {}) => api.put('/auth/change-password', data, options),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.put(`/auth/reset-password/${token}`, { password })
};

// Recruiters
export const recruiterAPI = {
  getAll: (params, options = {}) => api.get('/recruiters', { params, ...options }),
  getOne: (id, options = {}) => api.get(`/recruiters/${id}`, options),
  create: (data, options = {}) => api.post('/recruiters', data, options),
  update: (id, data, options = {}) => api.put(`/recruiters/${id}`, data, options),
  delete: (id, options = {}) => api.delete(`/recruiters/${id}`, options),
  upload: (formData, options = {}) => api.post('/recruiters/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...options
  }),
  toggleFavorite: (id, options = {}) => api.patch(`/recruiters/${id}/favorite`, {}, options),
  export: (options = {}) => api.get('/recruiters/export', { responseType: 'blob', ...options })
};

// Resume
export const resumeAPI = {
  upload: (formData, options = {}) => api.post('/resume/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...options
  }),
  get: (options = {}) => api.get('/resume', options),
  delete: (options = {}) => api.delete('/resume', options)
};

// AI
export const aiAPI = {
  generate: (data, options = {}) => api.post('/ai/generate', data, options),
  generateBatch: (data, options = {}) => api.post('/ai/generate-batch', data, options),
  getDraftableCount: (options = {}) => api.get('/ai/draftable-count', options),
  generateForNew: (options = {}) => api.post('/ai/generate-for-new', {}, options),
};

// One adaptable master template is used as guidance for recruiter-specific drafts.
export const emailTemplateAPI = {
  get:        (options = {})           => api.get('/email-template', options),
  generate:   (force = false, options = {}) => api.post('/email-template/generate', { force }, options),
  saveManual: (data, options = {})     => api.post('/email-template/manual', data, options),
  update:     (id, data, options = {}) => api.put(`/email-template/${id}`, data, options),
};

// Gmail
export const gmailAPI = {
  getAuthUrl:    (options = {}) => api.get('/gmail/auth-url', options),
  getStatus:     (options = {}) => api.get('/gmail/status', options),
  disconnect:    (options = {}) => api.post('/gmail/disconnect', {}, options),
  createDraft:   (data, options = {}) => api.post('/gmail/create-draft', data, options),
  send:          (data, options = {}) => api.post('/gmail/send', data, options),
  sendBulk:      (draftIds, options = {}) => api.post('/gmail/send-bulk', { draftIds }, options),
  retry:         (data, options = {}) => api.post('/gmail/retry', data, options),
  resendFailed:  (failedEmailId, options = {}) => api.post('/gmail/resend-failed', { failedEmailId }, options),
};

// Applications
export const applicationAPI = {
  getAll: (params, options = {}) => api.get('/applications', { params, ...options }),
  getOne: (id, options = {}) => api.get(`/applications/${id}`, options),
  update: (id, data, options = {}) => api.put(`/applications/${id}`, data, options),
  export: (format, options = {}) => api.get('/applications/export', { params: { format }, responseType: 'blob', ...options })
};

// Drafts
export const draftAPI = {
  getAll:        (params, options = {}) => api.get('/drafts', { params, ...options }),
  getOne:        (id, options = {})     => api.get(`/drafts/${id}`, options),
  update:        (id, data, options = {}) => api.put(`/drafts/${id}`, data, options),
  autoSave:      (id, data, options = {}) => api.patch(`/drafts/${id}/autosave`, data, options),
  delete:        (id, options = {})     => api.delete(`/drafts/${id}`, options),
  getFailedCount: (options = {})        => api.get('/drafts/failed-count', options),
  resetFailed:   (options = {})         => api.post('/drafts/reset-failed', {}, options),
};

// Dashboard
export const dashboardAPI = {
  get: (options = {}) => api.get('/dashboard', options)
};

// Settings
export const settingsAPI = {
  get: (options = {}) => api.get('/settings', options),
  update: (data, options = {}) => api.put('/settings', data, options),
  updateApiKey: (key, options = {}) => api.put('/settings/api-key', { openaiApiKey: key }, options),
  fixSignature: (options = {}) => api.post('/settings/fix-signature', {}, options)
};

// Failed Emails
export const failedEmailAPI = {
  getAll:   (params, options = {}) => api.get('/failed-emails', { params, ...options }),
  getOne:   (id, options = {})     => api.get(`/failed-emails/${id}`, options),
  update:   (id, data, options = {}) => api.put(`/failed-emails/${id}`, data, options),
  reverify: (id, options = {})     => api.post(`/failed-emails/${id}/reverify`, {}, options),
  resolve:  (id, note, options = {}) => api.post(`/failed-emails/${id}/resolve`, { note }, options),
  delete:   (id, options = {})     => api.delete(`/failed-emails/${id}`, options),
  getStats: (options = {})         => api.get('/failed-emails/stats', options)
};

export default api;
