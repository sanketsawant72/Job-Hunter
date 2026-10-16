/**
 * Axios API service with interceptors
 */
import axios from 'axios';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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
    const message = error.response?.data?.message || 'Something went wrong';
    
    if (error.response?.status === 401) {
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
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.put(`/auth/reset-password/${token}`, { password })
};

// Recruiters
export const recruiterAPI = {
  getAll: (params) => api.get('/recruiters', { params }),
  getOne: (id) => api.get(`/recruiters/${id}`),
  create: (data) => api.post('/recruiters', data),
  update: (id, data) => api.put(`/recruiters/${id}`, data),
  delete: (id) => api.delete(`/recruiters/${id}`),
  upload: (formData) => api.post('/recruiters/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  toggleFavorite: (id) => api.patch(`/recruiters/${id}/favorite`),
  export: () => api.get('/recruiters/export', { responseType: 'blob' })
};

// Resume
export const resumeAPI = {
  upload: (formData) => api.post('/resume/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  get: () => api.get('/resume'),
  delete: () => api.delete('/resume')
};

// AI
export const aiAPI = {
  generate: (data) => api.post('/ai/generate', data),
  generateBatch: (data) => api.post('/ai/generate-batch', data),
  generateForNew: () => api.post('/ai/generate-for-new'),
};

// Email Template (master email — generated once, reused for all companies)
export const emailTemplateAPI = {
  get:        ()           => api.get('/email-template'),
  generate:   (force = false) => api.post('/email-template/generate', { force }),
  saveManual: (data)       => api.post('/email-template/manual', data),
  update:     (id, data)   => api.put(`/email-template/${id}`, data),
};

// Gmail
export const gmailAPI = {
  getAuthUrl:    ()     => api.get('/gmail/auth-url'),
  getStatus:     ()     => api.get('/gmail/status'),
  disconnect:    ()     => api.post('/gmail/disconnect'),
  createDraft:   (data) => api.post('/gmail/create-draft', data),
  send:          (data) => api.post('/gmail/send', data),
  sendBulk:      (draftIds) => api.post('/gmail/send-bulk', { draftIds }),
  retry:         (data) => api.post('/gmail/retry', data),
  resendFailed:  (failedEmailId) => api.post('/gmail/resend-failed', { failedEmailId }),
};

// Applications
export const applicationAPI = {
  getAll: (params) => api.get('/applications', { params }),
  getOne: (id) => api.get(`/applications/${id}`),
  update: (id, data) => api.put(`/applications/${id}`, data),
  export: (format) => api.get('/applications/export', { params: { format }, responseType: 'blob' })
};

// Drafts
export const draftAPI = {
  getAll:        (params) => api.get('/drafts', { params }),
  getOne:        (id)     => api.get(`/drafts/${id}`),
  update:        (id, data) => api.put(`/drafts/${id}`, data),
  autoSave:      (id, data) => api.patch(`/drafts/${id}/autosave`, data),
  delete:        (id)     => api.delete(`/drafts/${id}`),
  getFailedCount: ()      => api.get('/drafts/failed-count'),
  resetFailed:   ()       => api.post('/drafts/reset-failed'),
};

// Dashboard
export const dashboardAPI = {
  get: () => api.get('/dashboard')
};

// Settings
export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  updateApiKey: (key) => api.put('/settings/api-key', { openaiApiKey: key }),
  fixSignature: () => api.post('/settings/fix-signature')
};

// Failed Emails
export const failedEmailAPI = {
  getAll:   (params) => api.get('/failed-emails', { params }),
  getOne:   (id)     => api.get(`/failed-emails/${id}`),
  update:   (id, data) => api.put(`/failed-emails/${id}`, data),
  reverify: (id)     => api.post(`/failed-emails/${id}/reverify`),
  resolve:  (id, note) => api.post(`/failed-emails/${id}/resolve`, { note }),
  delete:   (id)     => api.delete(`/failed-emails/${id}`),
  getStats: ()       => api.get('/failed-emails/stats')
};

export default api;
