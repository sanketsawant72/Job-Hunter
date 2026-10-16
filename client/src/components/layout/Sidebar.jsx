import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Upload, FileText,
  Mail, Send, Settings, LogOut, ChevronLeft, ChevronRight,
  Briefcase, User, SendHorizonal, XCircle, MailCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/recruiters',         icon: Users,           label: 'Recruiters' },
  { path: '/recruiters/upload',  icon: Upload,          label: 'Upload Recruiters' },
  { path: '/email-template',     icon: MailCheck,       label: 'Email Template' },
  { path: '/bulk-send',          icon: SendHorizonal,   label: 'Bulk Send',     highlight: true },
  { path: '/failed-emails',      icon: XCircle,         label: 'Failed Emails', highlightRed: true },
  { path: '/resume',             icon: FileText,        label: 'Resume' },
  { path: '/gmail',              icon: Mail,            label: 'Gmail' },
  { path: '/applications',       icon: Send,            label: 'Applications' },
  { path: '/settings',           icon: Settings,        label: 'Settings' },
];

const Sidebar = ({ mobileOpen, onCloseMobile }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">AI Job</p>
            <p className="font-bold text-primary-600 text-sm leading-tight">Manager</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label, highlight, highlightRed }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center' : ''}
               ${highlight    && !collapsed ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20' : ''}
               ${highlightRed && !collapsed ? 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' : ''}`
            }
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${highlight ? 'text-green-500' : ''} ${highlightRed ? 'text-red-400' : ''}`} />
            {!collapsed && <span>{label}</span>}
            {!collapsed && highlight && (
              <span className="ml-auto text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-md font-medium">NEW</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Section */}
      <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800 space-y-1">
        <NavLink
          to="/profile"
          onClick={onCloseMobile}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center' : ''}`
          }
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="avatar" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-primary-600" />
            </div>
          )}
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          )}
        </NavLink>

        <button
          onClick={logout}
          className={`sidebar-link w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center w-full py-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 border-t border-gray-100 dark:border-gray-800 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col h-screen bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transition-all duration-300 flex-shrink-0 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transform transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;
