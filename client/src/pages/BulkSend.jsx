import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, CheckCircle, XCircle, Eye, Search,
  RefreshCw, MailCheck, Mail, FileText, ChevronDown, ChevronUp,
  Loader, Info, ArrowLeft, Calendar, AlertTriangle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import { draftAPI, gmailAPI } from '../services/api';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Modal from '../components/ui/Modal';

// ── Group drafts by date ──────────────────────────────────────────────────
function groupByDate(drafts) {
  const groups = {};
  drafts.forEach(d => {
    const date = new Date(d.generatedAt || d.createdAt);
    let label;
    if (isToday(date))          label = 'Today';
    else if (isYesterday(date)) label = 'Yesterday';
    else                        label = format(startOfDay(date), 'MMMM d, yyyy');
    if (!groups[label]) groups[label] = [];
    groups[label].push(d);
  });
  const order = ['Today', 'Yesterday'];
  const sorted = [
    ...order.filter(k => groups[k]),
    ...Object.keys(groups).filter(k => !order.includes(k)).sort((a, b) => new Date(b) - new Date(a))
  ];
  return sorted.map(label => ({ label, items: groups[label] }));
}

// ── Inline email preview ──────────────────────────────────────────────────
const DraftPreview = ({ draft }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary-600">{draft.recruiter?.company?.[0] || '?'}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {draft.recruiter?.name} — {draft.recruiter?.company}
            </p>
            <p className="text-xs text-gray-400 truncate">{draft.recruiter?.email} · {draft.subject}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
          {draft.lastError && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mt-2 mb-3">
              ⚠ Last error: {draft.lastError}
            </p>
          )}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2 mb-1">Subject</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">{draft.subject}</p>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">Body</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {draft.body}
          </p>
        </div>
      )}
    </div>
  );
};

// ── Send result row ───────────────────────────────────────────────────────
const ResultRow = ({ result, onNavigate }) => {
  const isAuthError = result.reason?.includes('Insufficient Permission')
    || result.reason?.includes('invalid_grant')
    || result.reason?.includes('Gmail token expired')
    || result.reason?.includes('Gmail needs reconnecting');

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
      result.success
        ? 'bg-green-50 dark:bg-green-900/20'
        : isAuthError
          ? 'bg-orange-50 dark:bg-orange-900/20'
          : 'bg-red-50 dark:bg-red-900/20'
    }`}>
      {result.success
        ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        : <XCircle className={`w-4 h-4 flex-shrink-0 ${isAuthError ? 'text-orange-400' : 'text-red-400'}`} />
      }
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {result.recruiterName} — {result.company}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {result.success ? `Sent to ${result.email}` : result.reason}
        </p>
      </div>
      {result.success && (
        <span className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">✓ Sent</span>
      )}
      {!result.success && isAuthError && (
        <button onClick={() => onNavigate('/gmail')} className="text-xs text-orange-600 underline flex-shrink-0">
          Reconnect →
        </button>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────
const BulkSend = () => {
  const navigate = useNavigate();
  const [drafts,        setDrafts]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState(new Set());
  const [search,        setSearch]        = useState('');
  const [sending,       setSending]       = useState(false);
  const [sendProgress,  setSendProgress]  = useState(0);
  const [results,       setResults]       = useState(null);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [statusFilter,  setStatusFilter]  = useState('draft');
  const [failedCount,   setFailedCount]   = useState(0);
  const [resetting,     setResetting]     = useState(false);

  // ── Load drafts + failed count ──────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 500 };
      if (statusFilter !== 'all') params.status = statusFilter;

      const [draftsRes, failedRes] = await Promise.all([
        draftAPI.getAll(params),
        draftAPI.getFailedCount(),
      ]);

      const list = draftsRes.data.data || [];
      setDrafts(list);
      setFailedCount(failedRes.data.data.count);

      // Auto-select all non-sent drafts
      setSelected(new Set(list.filter(d => d.status !== 'sent').map(d => d._id)));
    } catch {
      toast.error('Failed to load drafts');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Reset all failed drafts → draft, then switch to draft tab ──
  const handleResetFailed = async () => {
    setResetting(true);
    try {
      const res = await draftAPI.resetFailed();
      toast.success(res.data.message);
      setStatusFilter('draft'); // will trigger reload via useEffect
    } catch {
      toast.error('Failed to reset drafts');
    } finally {
      setResetting(false);
    }
  };

  // ── Filtering / selection helpers ───────────────────────
  const filtered = drafts.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.recruiter?.name?.toLowerCase().includes(q) ||
      d.recruiter?.company?.toLowerCase().includes(q) ||
      d.recruiter?.email?.toLowerCase().includes(q) ||
      d.subject?.toLowerCase().includes(q)
    );
  });

  const toggleOne   = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll   = () => setSelected(new Set(filtered.map(d => d._id)));
  const clearAll    = () => setSelected(new Set());
  const selectGroup = (items) => setSelected(prev => {
    const n = new Set(prev);
    items.filter(d => d.status !== 'sent').forEach(d => n.add(d._id));
    return n;
  });

  const grouped        = groupByDate(filtered);
  const selectedDrafts = filtered.filter(d => selected.has(d._id));

  // ── Bulk send ───────────────────────────────────────────
  const handleSendAll = async () => {
    if (selected.size === 0) { toast.warning('No drafts selected'); return; }
    setShowConfirm(false);
    setSending(true);
    setResults(null);
    setSendProgress(0);

    try {
      const ids = Array.from(selected);
      let fakeProgress = 0;
      const tick = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + (90 / ids.length), 85);
        setSendProgress(Math.round(fakeProgress));
      }, 600);

      const res = await gmailAPI.sendBulk(ids);
      clearInterval(tick);
      setSendProgress(100);

      const data = res.data.data;
      setResults(data.results);

      if (data.sent > 0)   toast.success(`✅ ${data.sent} email${data.sent > 1 ? 's' : ''} sent!`);
      if (data.failed > 0) toast.warning(`⚠️ ${data.failed} failed — check Failed Emails to retry.`);

      load();
    } catch (err) {
      const code = err.response?.data?.code;
      const msg  = err.response?.data?.message || 'Bulk send failed';

      if (code === 'GMAIL_AUTH_EXPIRED' || code === 'GMAIL_INSUFFICIENT_PERMISSIONS' || msg.includes('not connected')) {
        toast.error(
          <div>
            <p className="font-semibold mb-1">Gmail not connected</p>
            <p className="text-sm mb-2">{msg}</p>
            <button onClick={() => navigate('/gmail')} className="text-sm underline font-medium">
              Reconnect Gmail →
            </button>
          </div>,
          { autoClose: false }
        );
      } else {
        toast.error(msg);
      }
      // Reload so any drafts that changed status show correctly
      load();
    } finally {
      setSending(false);
    }
  };

  const FILTER_TABS = ['draft', 'failed', 'approved', 'all'];

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/email-template')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Send</h1>
          <p className="text-gray-500 text-sm mt-0.5">Review drafts and send all at once</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── RECOVERY BANNER — shown when there are failed drafts ── */}
      {failedCount > 0 && (
        <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4 flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-700 dark:text-red-300 text-sm">
              {failedCount} email{failedCount !== 1 ? 's' : ''} failed to send
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              This usually happens when Gmail is disconnected. Reconnect Gmail, then click
              <strong> Reset &amp; Retry</strong> to move them back to the draft queue.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => navigate('/gmail')}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium">
              Reconnect Gmail
            </button>
            <button onClick={handleResetFailed} disabled={resetting}
              className="btn-primary text-xs bg-red-600 hover:bg-red-700 px-3 py-1.5">
              {resetting ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Reset &amp; Retry
            </button>
          </div>
        </div>
      )}

      {/* Warning banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          <strong>Read before sending.</strong> Expand each row to read the email.
          Once you click "Send All", emails go out immediately via Gmail with your resume attached.
        </p>
      </div>

      {/* Send results */}
      {results && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Send Results</h3>
            <div className="flex gap-3 text-sm">
              <span className="text-green-600 font-medium">{results.filter(r => r.success).length} sent</span>
              {results.filter(r => !r.success).length > 0 && (
                <span className="text-red-500 font-medium">{results.filter(r => !r.success).length} failed</span>
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.map((r, i) => <ResultRow key={i} result={r} onNavigate={navigate} />)}
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/applications')} className="btn-primary flex-1 justify-center text-sm">
              View Applications →
            </button>
            {results.filter(r => !r.success).length > 0 && (
              <button onClick={() => navigate('/failed-emails')} className="btn-secondary flex-1 justify-center text-sm">
                View Failed Emails →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters + search */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, company, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors relative ${
                statusFilter === s
                  ? 'bg-primary-600 text-white'
                  : s === 'failed' && failedCount > 0
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {s === 'all' ? 'All' : s}
              {s === 'failed' && failedCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0 leading-5">
                  {failedCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Draft list */}
      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <button onClick={selectAll}  className="text-primary-600 hover:underline font-medium">Select All</button>
            <span>·</span>
            <button onClick={clearAll}   className="text-gray-400 hover:underline">Clear</button>
            <span>·</span>
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {selected.size} of {filtered.length} selected
            </span>
          </div>
          <span className="text-xs text-gray-400">{filtered.length} drafts</span>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner size="xl" className="text-primary-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-500">
              {statusFilter === 'failed' ? 'No failed drafts' : 'No drafts found'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {statusFilter === 'failed'
                ? 'All emails sent successfully.'
                : 'Go to Email Template to create drafts for your recruiters.'}
            </p>
            {statusFilter !== 'failed' && (
              <button onClick={() => navigate('/email-template')} className="btn-primary mt-4 text-sm">
                <MailCheck className="w-4 h-4" /> Email Template
              </button>
            )}
          </div>
        ) : (
          <div>
            {grouped.map(({ label, items }) => (
              <div key={label}>
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-y border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className={`text-xs font-semibold uppercase tracking-wide ${
                      label === 'Today'     ? 'text-primary-600 dark:text-primary-400' :
                      label === 'Yesterday' ? 'text-amber-600 dark:text-amber-400'     : 'text-gray-500'
                    }`}>{label}</span>
                    <span className="text-xs text-gray-400">· {items.length} draft{items.length !== 1 ? 's' : ''}</span>
                  </div>
                  <button onClick={() => selectGroup(items)} className="text-xs text-primary-500 hover:underline">
                    Select {label.toLowerCase()}
                  </button>
                </div>

                <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {items.map(draft => (
                    <div key={draft._id} className={`transition-colors ${selected.has(draft._id) ? 'bg-primary-50/40 dark:bg-primary-900/10' : ''}`}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleOne(draft._id)}
                          disabled={draft.status === 'sent'}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                            draft.status === 'sent'
                              ? 'border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800 cursor-not-allowed'
                              : selected.has(draft._id)
                                ? 'bg-primary-600 border-primary-600'
                                : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                          }`}
                        >
                          {draft.status === 'sent' ? (
                            <CheckCircle className="w-3 h-3 text-green-400" />
                          ) : selected.has(draft._id) ? (
                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ) : null}
                        </button>

                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          draft.status === 'failed'
                            ? 'bg-red-100 dark:bg-red-900/30'
                            : 'bg-gradient-to-br from-primary-100 to-purple-100 dark:from-primary-900/30 dark:to-purple-900/30'
                        }`}>
                          <span className={`text-sm font-bold ${draft.status === 'failed' ? 'text-red-500' : 'text-primary-600'}`}>
                            {draft.recruiter?.company?.[0] || '?'}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{draft.recruiter?.name}</p>
                            <span className="text-gray-400 text-xs">·</span>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{draft.recruiter?.company}</p>
                            <Badge status={draft.status} />
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {draft.recruiter?.email} · {draft.subject}
                          </p>
                          {draft.status === 'failed' && draft.lastError && (
                            <p className="text-xs text-red-500 truncate mt-0.5" title={draft.lastError}>
                              ⚠ {draft.lastError}
                            </p>
                          )}
                        </div>

                        <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                          {format(new Date(draft.generatedAt || draft.createdAt), 'h:mm a')}
                        </span>
                        <button
                          onClick={() => navigate(`/email-review/${draft._id}`)}
                          className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-500 flex-shrink-0"
                          title="Full Review"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="px-4 pb-3">
                        <DraftPreview draft={draft} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sending progress */}
      {sending && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Loader className="w-5 h-5 text-primary-500 animate-spin flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Sending {selected.size} email{selected.size > 1 ? 's' : ''}…
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Keep this tab open.</p>
            </div>
            <span className="text-sm font-bold text-primary-600">{sendProgress}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
            <div className="bg-primary-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${sendProgress}%` }} />
          </div>
        </div>
      )}

      {/* Floating Send button */}
      {selected.size > 0 && !sending && !results && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => setShowConfirm(true)}
            className="btn-primary shadow-2xl px-8 py-3.5 text-base bg-green-600 hover:bg-green-700"
          >
            <Send className="w-5 h-5" />
            Send {selected.size} Email{selected.size > 1 ? 's' : ''} Now
          </button>
        </div>
      )}

      {/* Confirm modal */}
      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Confirm Bulk Send" size="md">
        <div className="p-6 space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
            <Mail className="w-6 h-6 text-green-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">
                You are about to send {selected.size} email{selected.size > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-0.5">
                Your resume will be attached to each email.
              </p>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recipients</p>
            {selectedDrafts.map(d => (
              <div key={d._id} className="flex items-center gap-2 text-sm px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="w-6 h-6 rounded bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600 flex-shrink-0">
                  {d.recruiter?.company?.[0]}
                </div>
                <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{d.recruiter?.name}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500 truncate">{d.recruiter?.email}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 text-center">⚠️ Emails go out immediately. This cannot be undone.</p>

          <div className="flex gap-3">
            <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button onClick={handleSendAll} className="flex-1 btn-primary justify-center bg-green-600 hover:bg-green-700">
              <Send className="w-4 h-4" /> Yes, Send All
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BulkSend;
