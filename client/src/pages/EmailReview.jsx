import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Send, Mail, FileText, Edit3, Check, RefreshCw, Paperclip } from 'lucide-react';
import { toast } from 'react-toastify';
import { draftAPI, gmailAPI, emailTemplateAPI, resumeAPI } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Badge from '../components/ui/Badge';

const EmailReview = () => {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [resume, setResume] = useState(null);
  const [attachResume, setAttachResume] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [signature, setSignature] = useState('');
  const autoSaveRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [draftRes, resumeRes] = await Promise.all([
          draftAPI.getOne(draftId),
          resumeAPI.get()
        ]);
        const d = draftRes.data.data;
        setDraft(d);
        setSubject(d.subject);
        setBody(d.body);
        setSignature(d.signature || '');
        setResume(resumeRes.data.data);
        setAttachResume(d.gmailDraftId ? !!d.resumeAttached : !!resumeRes.data.data);
      } catch {
        toast.error('Draft not found');
        navigate('/bulk-send');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [draftId]);

  // Auto-save every 30 seconds when editing
  useEffect(() => {
    if (!editing) return;
    autoSaveRef.current = setInterval(async () => {
      try {
        await draftAPI.autoSave(draftId, { subject, body, signature });
        toast.info('Auto-saved', { autoClose: 1500 });
      } catch {}
    }, 30000);
    return () => clearInterval(autoSaveRef.current);
  }, [editing, subject, body, signature, draftId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await draftAPI.update(draftId, { subject, body, signature });
      setDraft(res.data.data);
      setEditing(false);
      toast.success('Draft saved');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleCreateGmailDraft = async () => {
    setCreatingDraft(true);
    try {
      // Save first
      await draftAPI.update(draftId, { subject, body, signature });
      const gmailDraftRes = await gmailAPI.createDraft({ draftId, attachResume: !!resume && attachResume });
      toast.success('Gmail draft created! Check your Gmail Drafts folder.');
      setDraft(prev => ({ ...prev, status: 'approved', gmailDraftId: gmailDraftRes.data.data.gmailDraftId, resumeAttached: !!resume && attachResume }));
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create Gmail draft';
      if (msg.includes('Gmail not connected') || msg.includes('connect Gmail')) {
        toast.error('Please connect Gmail first in the Gmail page');
        navigate('/gmail');
      } else {
        toast.error(msg);
      }
    } finally {
      setCreatingDraft(false);
    }
  };

  const handleSend = async () => {
    if (!window.confirm(`Send email to ${draft?.recruiter?.email}?`)) return;
    setSending(true);
    try {
      await draftAPI.update(draftId, { subject, body, signature });
      await gmailAPI.send({ draftId, attachResume: !!resume && attachResume });
      toast.success(`Email sent to ${draft?.recruiter?.email}!`);
      navigate('/applications');
    } catch (err) {
      const code = err.response?.data?.code;
      const msg  = err.response?.data?.message || 'Send failed';

      if (code === 'GMAIL_AUTH_EXPIRED' || code === 'GMAIL_INSUFFICIENT_PERMISSIONS') {
        toast.error(
          <div>
            <p className="font-semibold mb-1">Gmail needs reconnecting</p>
            <p className="text-sm">{msg}</p>
            <button
              onClick={() => navigate('/gmail')}
              className="mt-2 text-sm underline font-medium"
            >
              Go to Gmail settings →
            </button>
          </div>,
          { autoClose: false }
        );
      } else if (msg.includes('Gmail not connected') || msg.includes('connect Gmail')) {
        toast.error('Please connect Gmail first');
        navigate('/gmail');
      } else {
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  };

  // Reload subject+body from the current master template
  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await emailTemplateAPI.get();
      const tpl = res.data.data.template;
      if (!tpl) {
        toast.error('No master template found. Go to Email Template to generate one first.');
        return;
      }
      // Update the draft in DB with the latest master template content
      const updated = await draftAPI.update(draftId, { subject: tpl.subject, body: tpl.body });
      const newDraft = updated.data.data;
      setSubject(newDraft.subject);
      setBody(newDraft.body);
      setDraft(newDraft);
      toast.success('Email reset to current master template.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Regeneration failed');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="xl" className="text-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/bulk-send')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Email Review</h1>
          <p className="text-gray-500 text-sm">
            To: <span className="font-medium">{draft?.recruiter?.name}</span> at{' '}
            <span className="font-medium">{draft?.recruiter?.company}</span>
          </p>
        </div>
        <Badge status={draft?.status} />
      </div>

      {/* IMPORTANT notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
        <Mail className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          <strong>Review before sending.</strong> Read the email carefully, edit if needed, then click Send.
          Gmail will send this directly to {draft?.recruiter?.email}.
        </p>
      </div>

      {/* Recruiter info */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-400 text-xs uppercase">To</p><p className="font-medium mt-0.5">{draft?.recruiter?.name}</p></div>
          <div><p className="text-gray-400 text-xs uppercase">Company</p><p className="font-medium mt-0.5">{draft?.recruiter?.company}</p></div>
          <div><p className="text-gray-400 text-xs uppercase">Email</p><p className="font-medium mt-0.5 truncate">{draft?.recruiter?.email}</p></div>
          <div><p className="text-gray-400 text-xs uppercase">Role</p><p className="font-medium mt-0.5">{draft?.recruiter?.role || '—'}</p></div>
        </div>
      </div>

      {/* Email editor */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">Email Content</h3>
          <button
            onClick={() => setEditing(!editing)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
              editing ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
            }`}
          >
            {editing ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Subject */}
          <div>
            <label className="label">Subject</label>
            {editing ? (
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="input font-medium"
                placeholder="Email subject..."
              />
            ) : (
              <p className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl font-medium text-gray-900 dark:text-white">
                {subject}
              </p>
            )}
          </div>

          {/* Body */}
          <div>
            <label className="label">Message</label>
            {editing ? (
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                className="input min-h-[220px] resize-y leading-relaxed"
                placeholder="Email body..."
              />
            ) : (
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300 text-sm min-h-[220px]">
                {body}
              </div>
            )}
          </div>

          {/* Signature */}
          <div>
            <label className="label">Signature</label>
            {editing ? (
              <textarea
                value={signature}
                onChange={e => setSignature(e.target.value)}
                className="input resize-none"
                rows={3}
                placeholder="Your signature..."
              />
            ) : (
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl whitespace-pre-wrap text-gray-500 text-sm">
                {signature || '—'}
              </div>
            )}
          </div>

          {/* Resume attachment */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <label className={`flex items-center gap-2 text-sm ${resume && !draft?.gmailDraftId ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
              <input
                type="checkbox"
                checked={draft?.gmailDraftId ? !!draft.resumeAttached : !!resume && attachResume}
                disabled={!resume || !!draft?.gmailDraftId}
                onChange={e => setAttachResume(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <Paperclip className="w-4 h-4 text-gray-400" />
              <span>
                <span className="font-medium text-gray-800 dark:text-gray-200">Attach resume</span>
                {resume && <span className="text-gray-500"> — {resume.originalName}</span>}
              </span>
            </label>
            {!resume && (
              <p className="ml-6 mt-1 text-xs text-amber-500">Upload a resume from the Resume page to attach it.</p>
            )}
            {draft?.gmailDraftId && (
              <p className="ml-6 mt-1 text-xs text-gray-500">{draft.resumeAttached ? 'Resume attachment is fixed in this saved Gmail draft.' : 'No resume is attached to this saved Gmail draft.'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Word count */}
      <p className="text-xs text-gray-400 text-right">
        {body.split(/\s+/).filter(Boolean).length} words {body.split(/\s+/).filter(Boolean).length > 180 && (
          <span className="text-amber-500">(recommend under 180)</span>
        )}
      </p>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={handleRegenerate} disabled={regenerating} className="btn-secondary flex-1 justify-center">
          {regenerating ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
          Regenerate
        </button>

        {editing && (
          <button onClick={handleSave} disabled={saving} className="btn-secondary flex-1 justify-center">
            {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
        )}

        <button onClick={handleCreateGmailDraft} disabled={creatingDraft} className="btn-secondary flex-1 justify-center">
          {creatingDraft ? <LoadingSpinner size="sm" /> : <FileText className="w-4 h-4" />}
          Save to Gmail Drafts
        </button>

        <button
          onClick={handleSend}
          disabled={sending}
          className="btn-primary flex-1 justify-center bg-green-600 hover:bg-green-700 text-sm"
        >
          {sending ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
          {sending ? 'Sending...' : 'Send Email'}
        </button>
      </div>
    </div>
  );
};

export default EmailReview;
