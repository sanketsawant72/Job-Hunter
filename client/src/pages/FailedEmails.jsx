import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  XCircle, RefreshCw, Search, CheckCircle, ShieldCheck,
  Edit3, Trash2, ArrowLeft, Send
} from 'lucide-react';
import { toast } from 'react-toastify';
import { failedEmailAPI, gmailAPI } from '../services/api';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import SkeletonRow from '../components/ui/SkeletonRow';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// ── Verification status badge ─────────────────────────────────────────────
const VerBadge = ({ status }) => {
  const map = {
    UNDELIVERABLE: 'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
    RISKY:         'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    UNKNOWN:       'bg-gray-100   text-gray-600   dark:bg-gray-800      dark:text-gray-400',
    DELIVERABLE:   'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400',
    PENDING:       'bg-blue-100   text-blue-600   dark:bg-blue-900/30   dark:text-blue-400',
    SKIPPED:       'bg-gray-100   text-gray-500   dark:bg-gray-800      dark:text-gray-400',
  };
  return (
    <span className={`badge text-xs ${map[status] || map.UNKNOWN}`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

// ── Source pill ───────────────────────────────────────────────────────────
const SourcePill = ({ source }) => {
  const map = {
    verification: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    bounce:       'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
    manual:       'bg-gray-100   text-gray-600   dark:bg-gray-700      dark:text-gray-400',
  };
  const labels = { verification: 'Import', bounce: 'Send Failure', manual: 'Manual' };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[source] || map.manual}`}>
      {labels[source] || source}
    </span>
  );
};

// ── Edit / Re-verify modal ────────────────────────────────────────────────
const EditModal = ({ record, onClose, onSaved }) => {
  const [email,     setEmail]     = useState(record?.email    || '');
  const [name,      setName]      = useState(record?.name     || '');
  const [company,   setCompany]   = useState(record?.company  || '');
  const [saving,    setSaving]    = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await failedEmailAPI.update(record._id, { email, name, company });
      toast.success('Record updated');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleReverify = async () => {
    if (email !== record.email) {
      await failedEmailAPI.update(record._id, { email, name, company });
    }
    setVerifying(true);
    try {
      const res = await failedEmailAPI.reverify(record._id);
      const { deliverability, promoted } = res.data.data;
      if (promoted) {
        toast.success(`✅ Verified as ${deliverability} — added to Recruiters!`);
      } else {
        toast.warning(`Still ${deliverability}. Not promoted.`);
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Re-verification failed');
    } finally { setVerifying(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="space-y-1">
        <p className="text-xs text-gray-400">Failure reason</p>
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{record?.failureReason}</p>
      </div>

      <div>
        <label className="label">Email Address</label>
        <input value={email} onChange={e => setEmail(e.target.value)}
          className="input" placeholder="Correct the email address..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Company</label>
          <input value={company} onChange={e => setCompany(e.target.value)} className="input" />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={saving} className="btn-secondary flex-1 justify-center text-sm">
          {saving ? <LoadingSpinner size="sm" /> : <Edit3 className="w-4 h-4" />}
          Save Changes
        </button>
        <button onClick={handleReverify} disabled={verifying} className="btn-primary flex-1 justify-center text-sm">
          {verifying ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
          {verifying ? 'Verifying...' : 'Re-Verify Email'}
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        If the corrected email passes verification it will be added to your Recruiters list.
      </p>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────
const FailedEmails = () => {
  const navigate = useNavigate();
  const [records,       setRecords]       = useState([]);
  const [pagination,    setPagination]    = useState(null);
  const [stats,         setStats]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [filter,        setFilter]        = useState('unresolved');
  const [page,          setPage]          = useState(1);
  const [editRecord,    setEditRecord]    = useState(null);
  const [deleteId,      setDeleteId]      = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resendingId,   setResendingId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search)                   params.search     = search;
      if (filter === 'unresolved')  params.isResolved = 'false';
      if (filter === 'resolved')    params.isResolved = 'true';

      const [listRes, statsRes] = await Promise.all([
        failedEmailAPI.getAll(params),
        failedEmailAPI.getStats()
      ]);
      setRecords(listRes.data.data);
      setPagination(listRes.data.pagination);
      setStats(statsRes.data.data);
    } catch { toast.error('Failed to load failed emails'); }
    finally { setLoading(false); }
  }, [page, search, filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filter]);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await failedEmailAPI.delete(deleteId);
      toast.success('Deleted');
      setDeleteId(null);
      load();
    } catch { toast.error('Delete failed'); }
    finally { setDeleteLoading(false); }
  };

  const handleResolve = async (id) => {
    try {
      await failedEmailAPI.resolve(id, 'Manually resolved by user');
      toast.success('Marked as resolved');
      load();
    } catch { toast.error('Failed to resolve'); }
  };

  // ── Resend a failed-send record ──────────────────────────
  const handleResend = async (record) => {
    if (!record.draftId) {
      toast.error('No draft linked — cannot resend. The draft may have been deleted.');
      return;
    }
    setResendingId(record._id);
    try {
      await gmailAPI.resendFailed(record._id);
      toast.success(`Email resent to ${record.email}!`);
      // Mark as resolved in UI immediately
      await failedEmailAPI.resolve(record._id, 'Resent successfully');
      load();
    } catch (err) {
      const msg = err.response?.data?.message || 'Resend failed';
      toast.error(msg);
      // Reload to show updated failure reason
      load();
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/recruiters/upload')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Failed Emails</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Emails that failed import verification or could not be sent via Gmail
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',         value: stats.total,         color: 'bg-gray-50 dark:bg-gray-800',        text: 'text-gray-700 dark:text-gray-300' },
            { label: 'Undeliverable', value: stats.undeliverable, color: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-600' },
            { label: 'Risky',         value: stats.risky,         color: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600' },
            { label: 'Unresolved',    value: stats.unresolved,    color: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className={`card p-4 ${s.color}`}>
              <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search name, company, email..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['unresolved', 'resolved', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}>
              {f}
            </button>
          ))}
          <button onClick={load}
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-primary-600 transition-colors">
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
                {['Recruiter', 'Company', 'Email', 'Source', 'Reason', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {loading ? (
                Array(5).fill(0).map((_, i) => <SkeletonRow key={i} cols={7} />)
              ) : records.length === 0 ? (
                <tr><td colSpan={7}>
                  <EmptyState
                    icon={ShieldCheck}
                    title="No failed emails"
                    description="All emails passed verification and sent successfully — or none have been imported yet."
                  />
                </td></tr>
              ) : (
                records.map(r => (
                  <tr key={r._id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${r.isResolved ? 'opacity-55' : ''}`}>

                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{r.name || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{r.company || '—'}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300 max-w-[180px] truncate">{r.email}</td>

                    <td className="px-4 py-3">
                      <SourcePill source={r.failureSource} />
                    </td>

                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-xs text-red-600 dark:text-red-400 truncate" title={r.failureReason}>
                        {r.failureReason}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      {r.isResolved
                        ? <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Resolved
                          </span>
                        : <VerBadge status={r.verificationStatus} />
                      }
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">

                        {/* Resend — only for send failures with a linked draft */}
                        {!r.isResolved && r.failureSource === 'bounce' && r.draftId && (
                          <button
                            onClick={() => handleResend(r)}
                            disabled={resendingId === r._id}
                            className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 transition-colors"
                            title="Resend email"
                          >
                            {resendingId === r._id
                              ? <LoadingSpinner size="sm" />
                              : <Send className="w-4 h-4" />
                            }
                          </button>
                        )}

                        {/* Edit & Re-verify — for import failures or unknown status */}
                        {!r.isResolved && (
                          <button
                            onClick={() => setEditRecord(r)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors"
                            title="Edit & Re-verify"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Mark resolved */}
                        {!r.isResolved && (
                          <button
                            onClick={() => handleResolve(r._id)}
                            className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-500 transition-colors"
                            title="Mark as resolved"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteId(r._id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      {/* Edit / Re-verify modal */}
      <Modal
        isOpen={!!editRecord}
        onClose={() => setEditRecord(null)}
        title="Edit & Re-verify Email"
        size="md"
      >
        {editRecord && (
          <EditModal
            record={editRecord}
            onClose={() => setEditRecord(null)}
            onSaved={() => { setEditRecord(null); load(); }}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Failed Email Record"
        message="This will permanently remove this record. It cannot be undone."
        confirmText="Delete"
        danger
        loading={deleteLoading}
      />
    </div>
  );
};

export default FailedEmails;
