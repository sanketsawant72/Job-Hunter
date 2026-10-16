import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, Link, Unlink, ExternalLink, Shield, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import { gmailAPI } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const GmailPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await gmailAPI.getStatus();
      setStatus(res.data.data);
    } catch { toast.error('Failed to load Gmail status'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadStatus();
    // Handle OAuth callback result
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    const email = searchParams.get('email');
    if (connected === 'true') {
      toast.success(`Gmail connected: ${decodeURIComponent(email || '')}`);
    } else if (error) {
      toast.error(`Gmail connection failed: ${decodeURIComponent(error)}`);
    }
  }, [searchParams]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await gmailAPI.getAuthUrl();
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to get auth URL. Check Google OAuth credentials in Settings.');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Gmail? You will need to reconnect to send emails.')) return;
    setDisconnecting(true);
    try {
      await gmailAPI.disconnect();
      setStatus({ connected: false, email: null });
      toast.success('Gmail disconnected');
    } catch { toast.error('Disconnect failed'); }
    finally { setDisconnecting(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <LoadingSpinner size="xl" className="text-primary-500" />
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gmail Integration</h1>
        <p className="text-gray-500 text-sm mt-1">Connect your Gmail to send job application emails</p>
      </div>

      {/* Status card */}
      <div className={`card p-6 ${status?.connected ? 'border-green-200 dark:border-green-800' : ''}`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            status?.connected
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-gray-100 dark:bg-gray-800'
          }`}>
            <Mail className={`w-7 h-7 ${status?.connected ? 'text-green-500' : 'text-gray-400'}`} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {status?.connected ? 'Gmail Connected' : 'Gmail Not Connected'}
            </h2>
            {status?.connected ? (
              <div>
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> {status.email}
                </p>
                {status.tokenExpiry && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Token expires: {new Date(status.tokenExpiry).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Connect your Gmail account to send emails</p>
            )}
          </div>
          <button onClick={loadStatus} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 flex gap-3">
          {status?.connected ? (
            <button onClick={handleDisconnect} disabled={disconnecting} className="btn-danger text-sm flex-1 justify-center">
              {disconnecting ? <LoadingSpinner size="sm" /> : <Unlink className="w-4 h-4" />}
              Disconnect Gmail
            </button>
          ) : (
            <button onClick={handleConnect} disabled={connecting} className="btn-primary flex-1 justify-center">
              {connecting ? <LoadingSpinner size="sm" /> : <Link className="w-4 h-4" />}
              {connecting ? 'Redirecting to Google...' : 'Connect Gmail'}
            </button>
          )}
        </div>
      </div>

      {/* Security info */}
      <div className="card p-5">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm text-gray-900 dark:text-white">Secure OAuth2 Connection</p>
            <ul className="mt-2 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
              <li>• We never see or store your Gmail password</li>
              <li>• Uses Google OAuth2 — you authorize on Google's secure page</li>
              <li>• Only requests permission to compose and send emails</li>
              <li>• You can disconnect at any time</li>
              <li>• Tokens are stored securely and refreshed automatically</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Setup guide */}
      <div className="card p-5">
        <p className="font-medium text-sm text-gray-900 dark:text-white mb-3">Setup Requirements</p>
        <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {[
            'Go to Google Cloud Console (console.cloud.google.com)',
            'Create a new project or select existing',
            'Enable Gmail API for your project',
            'Create OAuth 2.0 credentials (Web Application)',
            'Add redirect URI: ' + (window.location.origin.includes('localhost') ? 'http://localhost:5000/api/gmail/callback' : 'your-backend-url/api/gmail/callback'),
            'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to server .env',
            'Come back and click Connect Gmail'
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <a
          href="https://console.cloud.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-primary-600 hover:underline mt-4"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Open Google Cloud Console
        </a>
      </div>
    </div>
  );
};

export default GmailPage;
