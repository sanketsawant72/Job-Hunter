import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// App pages
import Dashboard from './pages/Dashboard';
import Recruiters from './pages/Recruiters';
import UploadRecruiters from './pages/UploadRecruiters';
import EmailReview from './pages/EmailReview';
import ResumePage from './pages/ResumePage';
import GmailPage from './pages/GmailPage';
import Applications from './pages/Applications';
import ApplicationDetail from './pages/ApplicationDetail';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

import BulkSend from './pages/BulkSend';
import FailedEmails from './pages/FailedEmails';
import EmailTemplate from './pages/EmailTemplate';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/recruiters" element={<Recruiters />} />
                <Route path="/recruiters/upload" element={<UploadRecruiters />} />
                <Route path="/email-template" element={<EmailTemplate />} />
                <Route path="/bulk-send" element={<BulkSend />} />
                <Route path="/email-review/:draftId" element={<EmailReview />} />
                <Route path="/resume" element={<ResumePage />} />
                <Route path="/gmail" element={<GmailPage />} />
                <Route path="/applications" element={<Applications />} />
                <Route path="/applications/:id" element={<ApplicationDetail />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/failed-emails" element={<FailedEmails />} />
              </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>

        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
