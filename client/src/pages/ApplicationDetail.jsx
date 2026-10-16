import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Building, User, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { applicationAPI } from '../services/api';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const STATUS_OPTIONS = ['sent', 'replied', 'rejected', 'failed'];

const ApplicationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await applicationAPI.getOne(id);
        setApp(res.data.data);
        setNotes(res.data.data.notes || '');
      } catch {
        toast.error('Application not found');
        navigate('/applications');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleStatusUpdate = async (status) => {
    setUpdating(true);
    try {
      const res = await applicationAPI.update(id, { status, notes });
      setApp(res.data.data);
      toast.success(`Status updated to ${status}`);
    } catch { toast.error('Update failed'); }
    finally { setUpdating(false); }
  };

  const handleSaveNotes = async () => {
    setUpdating(true);
    try {
      await applicationAPI.update(id, { notes });
      toast.success('Notes saved');
    } catch { toast.error('Save failed'); }
    finally { setUpdating(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <LoadingSpinner size="xl" className="text-primary-500" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/applications')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{app.company}</h1>
          <p className="text-gray-500 text-sm">{app.recruiterName} • {app.recruiterEmail}</p>
        </div>
        <Badge status={app.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info card */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Details</h3>
          {[
            { icon: User, label: 'Recruiter', value: app.recruiterName },
            { icon: Building, label: 'Company', value: app.company },
            { icon: Mail, label: 'Email', value: app.recruiterEmail },
            { icon: Clock, label: 'Sent', value: format(new Date(app.sentAt), 'PPp') },
            { icon: MessageSquare, label: 'Replied', value: app.repliedAt ? format(new Date(app.repliedAt), 'PPp') : 'No reply yet' }
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{value}</p>
              </div>
            </div>
          ))}
          {app.gmailMessageId && (
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Gmail Message ID</p>
                <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all">{app.gmailMessageId}</p>
              </div>
            </div>
          )}
        </div>

        {/* Status update */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Update Status</h3>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => handleStatusUpdate(s)}
                disabled={updating || app.status === s}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  app.status === s
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input resize-none"
              rows={3}
              placeholder="Add notes about this application..."
            />
            <button onClick={handleSaveNotes} disabled={updating} className="btn-primary text-sm mt-2 w-full justify-center">
              Save Notes
            </button>
          </div>
        </div>
      </div>

      {/* Email content */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Email Sent</h3>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Subject: {app.subject}
          </p>
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed border-t border-gray-200 dark:border-gray-700 pt-3">
            {app.body}
          </div>
        </div>
      </div>

      {/* Timeline */}
      {app.timeline?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Timeline</h3>
          <div className="space-y-3">
            {app.timeline.map((event, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{event.event}</p>
                  <p className="text-xs text-gray-400">{format(new Date(event.timestamp), 'PPp')}</p>
                  {event.details && <p className="text-xs text-gray-500 mt-0.5">{event.details}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationDetail;
