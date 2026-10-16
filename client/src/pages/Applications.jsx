import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, RefreshCw, SendHorizonal, Eye, RotateCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { applicationAPI, gmailAPI } from '../services/api';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import SkeletonRow from '../components/ui/SkeletonRow';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const STATUS_FILTERS = ['all', 'sent', 'replied', 'rejected', 'failed'];

const Applications = () => {
  const navigate = useNavigate();
  const [apps, setApps] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [retrying, setRetrying] = useState(null); // draftId being retried

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      if (status !== 'all') params.status = status;
      const res = await applicationAPI.getAll(params);
      setApps(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load applications'); }
    finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status]);

  const handleRetry = async (app) => {
    if (!app.draft) {
      toast.error('No draft found to retry');
      return;
    }
    setRetrying(app.draft);
    try {
      await gmailAPI.retry({ draftId: app.draft });
      toast.success(`Email resent to ${app.recruiterEmail}!`);
      load();
    } catch (err) {
      const code = err.response?.data?.code;
      const msg  = err.response?.data?.message || 'Retry failed';
      if (code === 'GMAIL_AUTH_EXPIRED' || code === 'GMAIL_INSUFFICIENT_PERMISSIONS') {
        toast.error('Gmail needs reconnecting — go to Gmail page and reconnect', { autoClose: 8000 });
        navigate('/gmail');
      } else {
        toast.error(msg);
      }
    } finally {
      setRetrying(null);
    }
  };

  const handleExport = async (fmt) => {
    try {
      const res = await applicationAPI.export(fmt);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `applications.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Applications</h1>
          <p className="text-gray-500 text-sm mt-0.5">{pagination?.total ?? 0} total applications sent</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport('csv')} className="btn-secondary text-sm">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => handleExport('xlsx')} className="btn-secondary text-sm">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search applications..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                status === s ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <button onClick={load} className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-primary-600 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-800">
                {['Recruiter', 'Company', 'Subject', 'Status', 'Sent', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {loading ? Array(6).fill(0).map((_, i) => <SkeletonRow key={i} cols={6} />) :
                apps.length === 0 ? (
                  <tr><td colSpan={6}>
                    <EmptyState icon={SendHorizonal} title="No applications yet"
                      description="Send job application emails to see them here"
                    />
                  </td></tr>
                ) : (
                  apps.map(app => (
                    <tr key={app._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{app.recruiterName}</p>
                        <p className="text-xs text-gray-400">{app.recruiterEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary-600">{app.company[0]}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{app.company}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{app.subject}</p>
                      </td>
                      <td className="px-4 py-3"><Badge status={app.status} /></td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {format(new Date(app.sentAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/applications/${app._id}`)}
                            className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-500 transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {app.status === 'failed' && app.draft && (
                            <button
                              onClick={() => handleRetry(app)}
                              disabled={retrying === app.draft}
                              className="p-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-500 transition-colors"
                              title="Retry sending"
                            >
                              {retrying === app.draft
                                ? <LoadingSpinner size="sm" />
                                : <RotateCcw className="w-4 h-4" />
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )
              }
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default Applications;
