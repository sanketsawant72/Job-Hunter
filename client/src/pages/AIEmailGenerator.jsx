import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Users, Search, CheckCircle, AlertCircle, Send, ChevronLeft, ChevronRight, Calendar, MailCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import { recruiterAPI, aiAPI, emailTemplateAPI } from '../services/api';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const PAGE_SIZE = 50;

// ── Group recruiters by creation date ──────────────────
function groupByDate(recruiters) {
  const groups = {};
  recruiters.forEach(r => {
    const d = new Date(r.createdAt);
    let label;
    if (isToday(d))     label = 'Today';
    else if (isYesterday(d)) label = 'Yesterday';
    else label = format(startOfDay(d), 'MMMM d, yyyy');

    if (!groups[label]) groups[label] = [];
    groups[label].push(r);
  });
  // Preserve order: Today first, Yesterday second, then older dates descending
  const order = ['Today', 'Yesterday'];
  const sorted = [
    ...order.filter(k => groups[k]),
    ...Object.keys(groups).filter(k => !order.includes(k)).sort((a, b) => new Date(b) - new Date(a))
  ];
  return sorted.map(label => ({ label, items: groups[label] }));
}

const AIEmailGenerator = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [recruiters, setRecruiters]     = useState([]);
  const [selected, setSelected]         = useState(new Set());
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [selectingAll, setSelectingAll] = useState(false);
  const [generating, setGenerating]     = useState(false);
  const [progress, setProgress]         = useState({ current: 0, total: 0, estimatedSecsLeft: 0 });
  const progressTimerRef                = useRef(null);
  const [results, setResults]           = useState([]);
  const [pagination, setPagination]     = useState(null);
  const [page, setPage]                 = useState(1);
  const [masterTemplate, setMasterTemplate] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(true);

  useEffect(() => {
    if (location.state?.recruiterId) setSelected(new Set([location.state.recruiterId]));
  }, [location.state]);

  // Load master template status
  useEffect(() => {
    const loadTemplate = async () => {
      setTemplateLoading(true);
      try {
        const res = await emailTemplateAPI.get();
        setMasterTemplate(res.data.data.template);
      } catch {
        // non-fatal
      } finally {
        setTemplateLoading(false);
      }
    };
    loadTemplate();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = { page, limit: PAGE_SIZE, status: 'new' };
        if (search) params.search = search;
        const res = await recruiterAPI.getAll(params);
        setRecruiters(res.data.data);
        setPagination(res.data.pagination);
      } catch { toast.error('Failed to load recruiters'); }
      finally { setLoading(false); }
    };
    load();
  }, [page, search]);

  useEffect(() => { setPage(1); }, [search]);

  const toggleSelect = id => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectPage = () => {
    setSelected(prev => {
      const next = new Set(prev);
      recruiters.forEach(r => next.add(r._id));
      return next;
    });
  };

  const selectGroup = (items) => {
    setSelected(prev => {
      const next = new Set(prev);
      items.forEach(r => next.add(r._id));
      return next;
    });
  };

  const selectAllAcrossPages = async () => {
    setSelectingAll(true);
    try {
      const params = { page: 1, limit: 10000, status: 'new' };
      if (search) params.search = search;
      const res = await recruiterAPI.getAll(params);
      const allIds = res.data.data.map(r => r._id);
      setSelected(new Set(allIds));
      toast.success(`Selected all ${allIds.length} recruiters`);
    } catch { toast.error('Failed to select all recruiters'); }
    finally { setSelectingAll(false); }
  };

  const handleGenerate = async () => {
    if (selected.size === 0) { toast.warning('Please select at least one recruiter'); return; }

    // Guard: master template must exist first
    if (!masterTemplate) {
      toast.error('No master email template found. Please generate one on the Email Template page first.');
      navigate('/email-template');
      return;
    }

    setGenerating(true);
    setResults([]);
    const ids = Array.from(selected);
    const total = ids.length;

    // Batch progress — no AI calls, just DB writes, so it's fast
    if (total > 1) {
      setProgress({ current: 0, total, estimatedSecsLeft: Math.ceil(total * 0.1) });
      progressTimerRef.current = setInterval(() => {
        setProgress(prev => ({
          ...prev,
          current: Math.min(prev.current + 5, total - 1),
        }));
      }, 300);
    }

    try {
      if (ids.length === 1) {
        const res = await aiAPI.generate({ recruiterId: ids[0] });
        toast.success('Draft created!');
        navigate(`/email-review/${res.data.data.draft._id}`);
      } else {
        const res = await aiAPI.generateBatch({ recruiterIds: ids });
        clearInterval(progressTimerRef.current);
        setResults(res.data.data);
        const successful = res.data.data.filter(r => r.success).length;
        const failed     = res.data.data.filter(r => !r.success).length;
        setProgress({ current: total, total, estimatedSecsLeft: 0 });
        if (failed === 0) toast.success(`${successful} drafts created — master template reused, no extra AI calls!`);
        else toast.warning(`Created ${successful}/${total}. ${failed} failed.`);
      }
    } catch (err) {
      clearInterval(progressTimerRef.current);
      if (err.response?.data?.needsTemplate) {
        toast.error('Please generate a master email template first.');
        navigate('/email-template');
      } else {
        toast.error(err.response?.data?.message || 'Draft creation failed.');
      }
    } finally {
      clearInterval(progressTimerRef.current);
      setGenerating(false);
    }
  };

  const totalPages       = pagination ? Math.ceil(pagination.total / PAGE_SIZE) : 1;
  const allOnPageSelected = recruiters.length > 0 && recruiters.every(r => selected.has(r._id));
  const grouped          = groupByDate(recruiters);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Email Generator</h1>
          <p className="text-gray-500 text-sm mt-0.5">Select recruiters and generate personalized emails</p>
        </div>
        {selected.size > 0 && (
          <button onClick={handleGenerate} disabled={generating} className="btn-primary">
            {generating ? <LoadingSpinner size="sm" /> : <Sparkles className="w-4 h-4" />}
            Generate {selected.size > 1 ? `${selected.size} Emails` : 'Email'}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 border border-primary-100 dark:border-primary-800">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-primary-600 dark:text-primary-400">
            Select recruiters → drafts are created instantly from your <strong>master email template</strong> → Review → Send via Gmail.
            <span className="font-semibold"> No extra AI calls per recruiter — 1 template reused for all.</span>
          </p>
        </div>
      </div>

      {/* No-template warning */}
      {!templateLoading && !masterTemplate && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">No master email template yet</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              You need to generate a master email template before creating drafts.
              It only takes one AI call and is reused for all companies.
            </p>
          </div>
          <button onClick={() => navigate('/email-template')} className="btn-primary text-sm flex-shrink-0">
            <MailCheck className="w-4 h-4" /> Set up template
          </button>
        </div>
      )}

      {/* Progress */}
      {generating && progress.total > 1 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
              <LoadingSpinner size="sm" className="text-primary-500" />
              Creating drafts… {progress.current} / {progress.total}
            </div>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">Cloning master template into drafts — no AI calls made.</p>
        </div>
      )}

      {/* Batch results */}
      {results.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">Generation Results</h3>
            <button onClick={() => navigate('/bulk-send')} className="btn-primary text-sm bg-green-600 hover:bg-green-700">
              <Send className="w-4 h-4" /> Send All Now
            </button>
          </div>
          <div className="space-y-2">
            {results.map(r => (
              <div key={r.recruiterId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  {r.success ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                  <span className="text-sm">{r.success ? 'Email generated' : r.reason}</span>
                </div>
                {r.success && (
                  <button onClick={() => navigate(`/email-review/${r.draftId}`)} className="text-xs text-primary-600 hover:underline">
                    Review →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recruiter list */}
      <div className="card">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search recruiters..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <button onClick={selectPage} disabled={selectingAll} className="text-primary-600 hover:underline whitespace-nowrap">
              {allOnPageSelected ? '✓ Page selected' : `Select page (${recruiters.length})`}
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button onClick={selectAllAcrossPages} disabled={selectingAll} className="text-primary-600 hover:underline whitespace-nowrap font-medium">
              {selectingAll
                ? <span className="flex items-center gap-1"><LoadingSpinner size="sm" /> Loading...</span>
                : `Select all ${pagination?.total ?? ''}`}
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:underline">Clear</button>
            {selected.size > 0 && (
              <span className="ml-1 font-semibold text-primary-600 dark:text-primary-400">{selected.size} selected</span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center"><LoadingSpinner size="lg" className="text-primary-500" /></div>
        ) : recruiters.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No recruiters found. Import recruiters first.</p>
            <button onClick={() => navigate('/recruiters/upload')} className="btn-primary mt-4 text-sm">Import Recruiters</button>
          </div>
        ) : (
          <>
            {/* Date-grouped recruiter rows */}
            {grouped.map(({ label, items }) => (
              <div key={label}>
                {/* Date group header */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-y border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className={`text-xs font-semibold uppercase tracking-wide ${
                      label === 'Today'
                        ? 'text-primary-600 dark:text-primary-400'
                        : label === 'Yesterday'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-500'
                    }`}>
                      {label}
                    </span>
                    <span className="text-xs text-gray-400">· {items.length} recruiter{items.length !== 1 ? 's' : ''}</span>
                  </div>
                  <button
                    onClick={() => selectGroup(items)}
                    className="text-xs text-primary-500 hover:underline"
                  >
                    Select all {label.toLowerCase()}
                  </button>
                </div>

                {/* Recruiters in this group */}
                <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {items.map(r => (
                    <div
                      key={r._id}
                      onClick={() => toggleSelect(r._id)}
                      className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors ${
                        selected.has(r._id) ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                        selected.has(r._id) ? 'bg-primary-600 border-primary-600' : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {selected.has(r._id) && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-100 to-purple-100 dark:from-primary-900/30 dark:to-purple-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary-600">{r.company[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{r.name}</p>
                          <Badge status={r.status} />
                        </div>
                        <p className="text-xs text-gray-500 truncate">{r.company}{r.role ? ` · ${r.role}` : ''} · {r.email}</p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                        {format(new Date(r.createdAt), 'h:mm a')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm text-gray-500">
                <span>Page {page} of {totalPages} · {pagination?.total} total</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const n = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                    return (
                      <button key={n} onClick={() => setPage(n)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium ${page === n ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                        {n}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating CTA */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
          <button onClick={handleGenerate} disabled={generating} className="btn-primary shadow-2xl px-6 py-3 text-base">
            {generating ? <LoadingSpinner size="sm" /> : <Sparkles className="w-5 h-5" />}
            {generating ? 'Generating...' : `Generate ${selected.size} Email${selected.size > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default AIEmailGenerator;
