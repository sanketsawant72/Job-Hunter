import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, FileText, RefreshCw, Save, AlertCircle,
  CheckCircle, Clock, Info, ChevronRight, Users, Send,
  PenLine, Bot
} from 'lucide-react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { emailTemplateAPI, aiAPI, recruiterAPI } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// ── tab identifiers ───────────────────────────────────────────────────────
const TAB_AI     = 'ai';
const TAB_MANUAL = 'manual';

// ── starter template the user can fill in ────────────────────────────────
const MANUAL_STARTER = `Dear Hiring Team,

I am writing to express my interest in software development opportunities within your organisation.

[Write 2–3 sentences about your background, skills, and what you bring to the role.]

[Optional: mention a specific technology, project, or achievement.]

I would welcome the opportunity to discuss how I can contribute to your team. Please find my resume attached for your consideration.

Thank you for your time.`;

const EmailTemplate = () => {
  const navigate = useNavigate();

  // ── shared state ──────────────────────────────────────────────────────
  const [loading, setLoading]               = useState(true);
  const [template, setTemplate]             = useState(null);
  const [resume, setResume]                 = useState(null);
  const [resumeChanged, setResumeChanged]   = useState(false);
  const [newCount, setNewCount]             = useState(0);
  const [activeTab, setActiveTab]           = useState(TAB_AI);

  // ── editor state (shared between AI + manual tabs) ────────────────────
  const [subject, setSubject]               = useState('');
  const [body, setBody]                     = useState('');
  const [isDirty, setIsDirty]               = useState(false);
  const [saving, setSaving]                 = useState(false);

  // ── AI tab state ──────────────────────────────────────────────────────
  const [generating, setGenerating]         = useState(false);

  // ── manual tab state ──────────────────────────────────────────────────
  const [manualSubject, setManualSubject]   = useState('Application for Software Development Opportunity');
  const [manualBody, setManualBody]         = useState(MANUAL_STARTER);
  const [savingManual, setSavingManual]     = useState(false);

  // ── create-drafts state ───────────────────────────────────────────────
  const [creatingDrafts, setCreatingDrafts] = useState(false);

  // ── load ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRes, recruitersRes] = await Promise.all([
        emailTemplateAPI.get(),
        recruiterAPI.getAll({ status: 'new', limit: 1 }),
      ]);
      const { template: tpl, resume: rsm, resumeChanged: changed } = tplRes.data.data;
      setTemplate(tpl);
      setResume(rsm);
      setResumeChanged(changed);
      setNewCount(recruitersRes.data.pagination?.total ?? 0);

      if (tpl) { setSubject(tpl.subject); setBody(tpl.body); }
      setIsDirty(false);
    } catch {
      toast.error('Failed to load template data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── AI: generate ─────────────────────────────────────────────────────
  const handleGenerate = async (force = false) => {
    if (!resume) {
      toast.warning('Please upload a resume first — the email is generated from your resume file.');
      return;
    }
    setGenerating(true);
    try {
      const res = await emailTemplateAPI.generate(force);
      const { data: tpl, generated } = res.data;
      setTemplate(tpl);
      setSubject(tpl.subject);
      setBody(tpl.body);
      setResumeChanged(false);
      setIsDirty(false);
      toast.success(generated ? `Template v${tpl.version} generated from resume!` : 'Template is already up-to-date.');
    } catch (err) {
      const msg = err.response?.data?.message || 'Generation failed';
      // 503 = provider busy — suggest manual fallback
      if (err.response?.status === 503 || err.response?.status === 429) {
        toast.error(
          <div>
            <p className="font-semibold">{msg}</p>
            <p className="text-xs mt-1">Switch to the <strong>Write Manually</strong> tab to write your email without AI.</p>
          </div>,
          { autoClose: 8000 }
        );
        setActiveTab(TAB_MANUAL);
      } else {
        toast.error(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  // ── AI: save edits to existing template ──────────────────────────────
  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      const res = await emailTemplateAPI.update(template._id, { subject, body });
      setTemplate(res.data.data);
      setIsDirty(false);
      toast.success('Template saved');
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // ── Manual: save new template ─────────────────────────────────────────
  const handleSaveManual = async () => {
    if (!manualSubject.trim() || !manualBody.trim()) {
      toast.warning('Please fill in both subject and body.');
      return;
    }
    setSavingManual(true);
    try {
      const res = await emailTemplateAPI.saveManual({ subject: manualSubject, body: manualBody });
      const tpl = res.data.data;
      setTemplate(tpl);
      setSubject(tpl.subject);
      setBody(tpl.body);
      setIsDirty(false);
      toast.success(`Manual template v${tpl.version} saved! Switch to the AI tab to create drafts.`);
      // Switch to AI tab so user can see the result and create drafts
      setActiveTab(TAB_AI);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSavingManual(false);
    }
  };

  // ── Create drafts for new recruiters ─────────────────────────────────
  const handleCreateDrafts = async () => {
    if (!template) { toast.error('Save a template first.'); return; }
    setCreatingDrafts(true);
    try {
      const res = await aiAPI.generateForNew();
      const { created } = res.data.data;
      setNewCount(0);
      toast.success(created > 0
        ? `${created} draft${created !== 1 ? 's' : ''} created! Go to Bulk Send.`
        : res.data.message
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create drafts');
    } finally {
      setCreatingDrafts(false);
    }
  };

  const onSubjectChange = (v) => { setSubject(v); setIsDirty(true); };
  const onBodyChange    = (v) => { setBody(v);    setIsDirty(true); };

  // ── render ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <LoadingSpinner size="xl" className="text-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Template</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          One master email reused for every application — write it yourself or generate it from your resume.
        </p>
      </div>

      {/* ── Status cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Resume */}
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Resume</p>
            {resume ? (
              <>
                <p className="font-semibold text-sm text-gray-900 dark:text-white truncate" title={resume.originalName}>
                  {resume.originalName}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{format(new Date(resume.createdAt), 'MMM d, yyyy')}</p>
              </>
            ) : (
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Not uploaded</p>
            )}
          </div>
          <button onClick={() => navigate('/resume')} className="text-gray-400 hover:text-primary-600 transition-colors flex-shrink-0">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Template version */}
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Template</p>
            {template ? (
              <>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">v{template.version}</p>
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(template.updatedAt), 'MMM d · h:mm a')}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">Not created yet</p>
            )}
          </div>
        </div>

        {/* New recruiters */}
        <div className="card p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            newCount > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800/40'
          }`}>
            <Users className={`w-5 h-5 ${newCount > 0 ? 'text-green-500' : 'text-gray-400'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">New Recruiters</p>
            <p className={`font-semibold text-sm ${newCount > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
              {newCount > 0 ? `${newCount} ready` : 'None pending'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">waiting for drafts</p>
          </div>
          <button onClick={() => navigate('/recruiters')} className="text-gray-400 hover:text-primary-600 transition-colors flex-shrink-0">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Create Drafts CTA ────────────────────────────────────────── */}
      {newCount > 0 && template && (
        <div className="card p-5 flex items-center justify-between gap-4 border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
              <Send className="w-5 h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                {newCount} recruiter{newCount !== 1 ? 's' : ''} uploaded — ready to draft
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Template copied for each one. No AI calls.</p>
            </div>
          </div>
          <button onClick={handleCreateDrafts} disabled={creatingDrafts} className="btn-primary bg-green-600 hover:bg-green-700 flex-shrink-0">
            {creatingDrafts ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
            {creatingDrafts ? 'Creating…' : 'Create Drafts'}
          </button>
        </div>
      )}

      {/* All caught up nudge */}
      {newCount === 0 && template && (
        <div className="card p-4 flex items-center gap-3 bg-gray-50 dark:bg-gray-800/40">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            All recruiters have drafts.{' '}
            <button onClick={() => navigate('/bulk-send')} className="text-primary-600 hover:underline font-medium">
              Go to Bulk Send →
            </button>
          </p>
        </div>
      )}

      {/* Resume stale warning */}
      {resumeChanged && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Resume has changed</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              A new resume was uploaded after this template was generated.
              Regenerate on the AI tab, or update the template manually.
            </p>
          </div>
        </div>
      )}

      {/* ── TABS ────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setActiveTab(TAB_AI)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === TAB_AI
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Bot className="w-4 h-4" />
            AI Generate
          </button>
          <button
            onClick={() => setActiveTab(TAB_MANUAL)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === TAB_MANUAL
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <PenLine className="w-4 h-4" />
            Write Manually
          </button>
        </div>

        {/* ── AI tab ──────────────────────────────────────────────── */}
        {activeTab === TAB_AI && (
          <div className="p-6 space-y-5">

            {/* Generate / Regenerate button row */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {template ? 'Edit or regenerate your AI-written template' : 'Generate from your resume'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  AI reads your resume file and writes the email. No profile fields are used.
                </p>
              </div>
              <button
                onClick={() => handleGenerate(true)}
                disabled={generating || !resume}
                className="btn-primary flex-shrink-0"
                title={!resume ? 'Upload a resume first' : 'Regenerate from current resume'}
              >
                {generating ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
                {template ? 'Regenerate' : 'Generate'}
              </button>
            </div>

            {/* Generating spinner */}
            {generating && (
              <div className="flex flex-col items-center gap-3 py-8">
                <LoadingSpinner size="xl" className="text-primary-500" />
                <p className="text-gray-500 text-sm">Reading your resume and writing the email…</p>
                <p className="text-xs text-gray-400">This is the only AI call. The result is reused for all companies.</p>
              </div>
            )}

            {/* No template yet */}
            {!template && !generating && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                  <Bot className="w-7 h-7 text-primary-400" />
                </div>
                <p className="text-gray-500 text-sm max-w-sm">
                  {resume
                    ? 'Click Generate to create your master application email from your resume. Or switch to Write Manually if you prefer full control.'
                    : 'Upload a resume first, then come back to generate your email.'}
                </p>
                {!resume && (
                  <button onClick={() => navigate('/resume')} className="btn-primary text-sm">
                    <FileText className="w-4 h-4" /> Upload Resume
                  </button>
                )}
              </div>
            )}

            {/* Template editor */}
            {template && !generating && (
              <>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
                  <Info className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <p className="text-xs text-primary-600 dark:text-primary-400">
                    No company or recruiter names included — generic enough for any employer.
                    Edits here never trigger another AI call.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => onSubjectChange(e.target.value)}
                    className="input w-full"
                    placeholder="Email subject line"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Body</label>
                  <textarea
                    value={body}
                    onChange={e => onBodyChange(e.target.value)}
                    rows={16}
                    className="input w-full font-mono text-sm resize-y leading-relaxed"
                  />
                  <p className="text-xs text-gray-400 mt-1">{body.split(/\s+/).filter(Boolean).length} words</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span className={`text-xs flex items-center gap-1 ${isDirty ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                    {isDirty
                      ? <><AlertCircle className="w-3.5 h-3.5" /> Unsaved changes</>
                      : <><CheckCircle className="w-3.5 h-3.5" /> Saved</>
                    }
                  </span>
                  <button onClick={handleSave} disabled={saving || !isDirty} className="btn-primary">
                    {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Manual tab ──────────────────────────────────────────── */}
        {activeTab === TAB_MANUAL && (
          <div className="p-6 space-y-5">

            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
              <PenLine className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <p className="font-semibold">Write your own email — no AI required</p>
                <p>Use this when the AI provider is unavailable, or when you simply prefer to write it yourself. Your email will be saved as the master template and reused for all companies.</p>
              </div>
            </div>

            {/* Tips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
              {[
                '✓  Start with "Dear Hiring Team," — no recruiter names',
                '✓  No company names in the body',
                '✓  Mention your tech stack and key skills',
                '✓  Keep it under 160 words for best results',
                '✓  End with a call to action',
                '✓  Your signature is added automatically on send',
              ].map(tip => (
                <div key={tip} className="flex items-start gap-1.5">
                  <span>{tip}</span>
                </div>
              ))}
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Subject</label>
              <input
                type="text"
                value={manualSubject}
                onChange={e => setManualSubject(e.target.value)}
                className="input w-full"
                placeholder="Application for Software Development Opportunity"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email Body
                <span className="ml-2 text-xs text-gray-400 font-normal">(your signature is appended automatically when the email is sent)</span>
              </label>
              <textarea
                value={manualBody}
                onChange={e => setManualBody(e.target.value)}
                rows={18}
                className="input w-full font-mono text-sm resize-y leading-relaxed"
                placeholder={MANUAL_STARTER}
              />
              <p className="text-xs text-gray-400 mt-1">
                {manualBody.split(/\s+/).filter(Boolean).length} words
                {manualBody.split(/\s+/).filter(Boolean).length > 160 && (
                  <span className="text-amber-500 ml-2">Consider trimming to under 160 words</span>
                )}
              </p>
            </div>

            {/* Save */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-400">
                Saving will replace the current template (v{template?.version ?? 0}).
              </p>
              <button
                onClick={handleSaveManual}
                disabled={savingManual || !manualSubject.trim() || !manualBody.trim()}
                className="btn-primary"
              >
                {savingManual ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
                Save as Master Template
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailTemplate;
