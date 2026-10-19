import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, Sun, Moon, Bell, Send, Users, Sparkles } from 'lucide-react';
import Sidebar from './Sidebar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getAssetUrl } from '../../services/api';

// Quick activity-log style notification center
const MOCK_TIPS = [
  { icon: Users,    text: 'Import recruiters via CSV or Excel',       path: '/recruiters/upload' },
  { icon: Sparkles, text: 'Generate AI emails for your recruiters',   path: '/ai-generator' },
  { icon: Send,     text: 'Review & send emails from Applications',   path: '/applications' },
];

const NotificationPanel = ({ onClose }) => {
  const navigate = useNavigate();
  return (
    <div className="absolute right-0 top-10 w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Quick Tips</p>
        <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 text-xs">
          {MOCK_TIPS.length}
        </span>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-gray-800">
        {MOCK_TIPS.map(({ icon: Icon, text, path }, i) => (
          <button
            key={i}
            onClick={() => { navigate(path); onClose(); }}
            className="flex items-start gap-3 px-4 py-3 w-full hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
          >
            <div className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex-shrink-0 mt-0.5">
              <Icon className="w-3.5 h-3.5 text-primary-600" />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{text}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

const DashboardLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();

  // Close notif panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(prev => !prev)}
                className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full" />
              </button>
              {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
            </div>

            {/* User avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-gray-100 dark:border-gray-800 ml-1">
              {user?.avatar ? (
                <img src={getAssetUrl(user.avatar)} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
              )}
              <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-300">
                {user?.name}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
