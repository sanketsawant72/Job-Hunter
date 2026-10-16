import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Send, FileText, Sparkles,
  MessageSquare, XCircle, TrendingUp, Clock
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  ArcElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { dashboardAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import { SkeletonCard } from '../components/ui/SkeletonRow';
import { format, parseISO } from 'date-fns';

ChartJS.register(
  CategoryScale, LinearScale,
  PointElement, LineElement,
  ArcElement,
  Title, Tooltip, Legend, Filler
);

// ── helpers ───────────────────────────────────────────────────────────────────

/** Safe date formatter — returns fallback string if date is invalid. */
function safeFormat(dateStr, fmt, fallback = '') {
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    return format(d, fmt);
  } catch {
    return fallback;
  }
}

// ── component ─────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const { user }    = useAuth();
  const { isDark }  = useTheme();
  const navigate    = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await dashboardAPI.get();
        setData(res.data.data);
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── theme-aware colours (re-computed when isDark changes) ─────────────
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';

  // ── line chart ────────────────────────────────────────────────────────
  const lineData = useMemo(() => {
    if (!data?.charts?.weekly?.length) return null;
    return {
      labels: data.charts.weekly.map(d => safeFormat(d.date, 'MMM d', d.date)),
      datasets: [{
        label: 'Applications Sent',
        data:  data.charts.weekly.map(d => d.count),
        fill: true,
        borderColor:     '#6366f1',
        backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.10)',
        tension:     0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#6366f1',
        pointBorderColor:     isDark ? '#1f2937' : '#ffffff',
        pointBorderWidth: 2,
      }],
    };
  }, [data, isDark]);

  const lineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        titleColor:      isDark ? '#f9fafb' : '#111827',
        bodyColor:       isDark ? '#d1d5db' : '#374151',
        borderColor:     isDark ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: ctx => ` ${ctx.parsed.y} application${ctx.parsed.y !== 1 ? 's' : ''}`,
        },
      },
    },
    scales: {
      x: {
        grid:  { color: gridColor },
        ticks: { color: textColor, font: { size: 11 } },
      },
      y: {
        grid:  { color: gridColor },
        ticks: {
          color: textColor,
          font:  { size: 11 },
          stepSize: 1,
          // Only show integers
          callback: v => Number.isInteger(v) ? v : null,
        },
        beginAtZero: true,
        suggestedMax: 5,  // prevents chart from looking huge when values are 0
      },
    },
  }), [isDark, gridColor, textColor]);

  // ── doughnut chart — recruiter pipeline ──────────────────────────────
  const doughnutData = useMemo(() => {
    if (!data?.recruiterStatus) return null;

    const { new: newR, drafted, sent, replied, rejected } = data.recruiterStatus;
    const values = [newR, drafted, sent, replied, rejected];

    // If all zero, show a placeholder "no data" slice so Chart.js renders
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) {
      return {
        labels: ['No recruiters yet'],
        datasets: [{
          data: [1],
          backgroundColor: [isDark ? '#374151' : '#e5e7eb'],
          borderWidth: 0,
        }],
      };
    }

    return {
      labels: ['New', 'Drafted', 'Sent', 'Replied', 'Rejected'],
      datasets: [{
        data:            values,
        backgroundColor: ['#6366f1', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'],
        hoverOffset:     6,
        borderWidth:     isDark ? 2 : 3,
        borderColor:     isDark ? '#111827' : '#ffffff',
      }],
    };
  }, [data, isDark]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color:    textColor,
          padding:  12,
          boxWidth: 12,
          font: { size: 11 },
        },
      },
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        titleColor:      isDark ? '#f9fafb' : '#111827',
        bodyColor:       isDark ? '#d1d5db' : '#374151',
        borderColor:     isDark ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        padding: 10,
      },
    },
  }), [isDark, textColor]);

  // ── greeting ──────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Good {greeting}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Here's your job search overview</p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading
          ? Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)
          : (
            <>
              <StatCard title="Total Recruiters"  value={data?.stats.totalRecruiters}  icon={Users}         color="primary" />
              <StatCard title="Emails Generated"  value={data?.stats.emailsGenerated}  icon={Sparkles}      color="purple" />
              <StatCard title="Drafts"             value={data?.stats.drafts}           icon={FileText}      color="orange" />
              <StatCard title="Emails Sent"        value={data?.stats.emailsSent}       icon={Send}          color="green" />
              <StatCard title="Replies"            value={data?.stats.replies}          icon={MessageSquare} color="blue" />
              <StatCard title="Failed"             value={data?.stats.failed}           icon={XCircle}       color="red" />
            </>
          )
        }
      </div>

      {/* ── Period breakdown ────────────────────────────────────────── */}
      {!loading && data && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Today',      value: data.stats.todayApplications, icon: Clock       },
            { label: 'This Week',  value: data.stats.weekApplications,  icon: TrendingUp  },
            { label: 'This Month', value: data.stats.monthApplications, icon: Send        },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                <Icon className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{value ?? 0}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Charts ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Line chart */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Applications Sent</h3>
          <p className="text-xs text-gray-400 mb-4">Last 7 days</p>
          {loading ? (
            <div className="h-52 skeleton rounded-xl" />
          ) : lineData ? (
            <div className="h-52">
              <Line data={lineData} options={lineOptions} />
            </div>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center gap-2 text-gray-400">
              <Send className="w-8 h-8 opacity-30" />
              <p className="text-sm">No applications sent yet</p>
              <p className="text-xs">Send your first email to see the graph</p>
            </div>
          )}
        </div>

        {/* Doughnut chart */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Recruiter Pipeline</h3>
          <p className="text-xs text-gray-400 mb-4">By status</p>
          {loading ? (
            <div className="h-52 skeleton rounded-xl" />
          ) : doughnutData ? (
            <div className="h-52">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              No data
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Applications ──────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Applications</h3>
          <button onClick={() => navigate('/applications')} className="text-sm text-primary-600 hover:underline">
            View all
          </button>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}
          </div>
        ) : !data?.recentApplications?.length ? (
          <div className="py-12 text-center">
            <Send className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No applications yet</p>
            <p className="text-gray-400 text-xs mt-1">Import recruiters and send your first email to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {data.recentApplications.map(app => (
              <div
                key={app._id}
                onClick={() => navigate(`/applications/${app._id}`)}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-100 to-purple-100 dark:from-primary-900/30 dark:to-purple-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary-600">{app.company?.[0] || '?'}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{app.company}</p>
                    <p className="text-xs text-gray-500 truncate">{app.recruiterName} · {app.recruiterEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge status={app.status} />
                  <span className="text-xs text-gray-400">{safeFormat(app.sentAt, 'MMM d')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
