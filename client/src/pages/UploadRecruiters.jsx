import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle,
  ArrowLeft, Download, ShieldCheck, ShieldAlert, HelpCircle, Info
} from 'lucide-react';
import { toast } from 'react-toastify';
import { recruiterAPI } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// ── Stat chip ────────────────────────────────────────────
const StatChip = ({ icon: Icon, count, label, color }) => {
  const colors = {
    green:  'bg-green-50 dark:bg-green-900/20 text-green-600',
    red:    'bg-red-50   dark:bg-red-900/20   text-red-600',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600',
    blue:   'bg-blue-50  dark:bg-blue-900/20  text-blue-600',
    gray:   'bg-gray-50  dark:bg-gray-800      text-gray-500'
  };
  return (
    <div className={`flex items-center gap-2 p-3 rounded-xl ${colors[color]}`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <div>
        <p className="text-lg font-bold leading-none">{count}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
};

const UploadRecruiters = () => {
  const [file, setFile]       = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase]     = useState(''); // 'parsing' | 'verifying' | 'done'
  const fileRef  = useRef();
  const navigate = useNavigate();

  const handleFile = (f) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) { toast.error('Only CSV and Excel files are supported'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
    setFile(f);
    setResult(null);
    setPhase('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(0);
    setPhase('parsing');

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Animate progress bar through two phases
      let tick = 0;
      const interval = setInterval(() => {
        tick++;
        if (tick < 10) {
          setProgress(tick * 5);          // 0–50% = parsing
        } else {
          setPhase('verifying');
          setProgress(Math.min(50 + (tick - 10) * 4, 90)); // 50–90% = verifying
        }
      }, 600);

      const res = await recruiterAPI.upload(formData);
      clearInterval(interval);
      setProgress(100);
      setPhase('done');
      setResult(res.data);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
      setPhase('');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = [
      'Recruiter Name,Company,Email,Role,LinkedIn,Location,Notes',
      'Jane Smith,Google,jane@google.com,Software Engineer,https://linkedin.com/in/jane,Mountain View CA,Hiring for ML team',
      'John Doe,Microsoft,john.doe@microsoft.com,Frontend Dev,,Hyderabad,'
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'recruiter_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const phaseLabel = { parsing: 'Parsing file...', verifying: 'Verifying email addresses...', done: 'Complete!' };

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/recruiters')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Recruiters</h1>
          <p className="text-gray-500 text-sm">Upload CSV or Excel — emails are automatically verified</p>
        </div>
      </div>

      {/* Template */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-sm text-gray-900 dark:text-white">Need a template?</p>
          <p className="text-xs text-gray-500">Download the CSV template with required columns</p>
        </div>
        <button onClick={downloadTemplate} className="btn-secondary text-sm">
          <Download className="w-4 h-4" /> Template
        </button>
      </div>

      {/* Columns info */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Supported Columns</p>
        <div className="flex flex-wrap gap-2">
          {['Recruiter Name', 'Company *', 'Email *', 'Role', 'LinkedIn', 'Location', 'Notes'].map(col => (
            <span key={col} className={`badge ${col.endsWith('*') ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
              {col}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400">* Required columns — Recruiter Name is optional (falls back to email prefix)</p>
        {/* Verification note */}
        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            After import, each email is verified using the <strong>Abstract Email Verification API</strong>.
            Undeliverable emails are moved to <strong>Failed Emails</strong> automatically.
          </span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
          dragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
            : file
              ? 'border-green-400 bg-green-50 dark:bg-green-900/10'
              : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }`}
      >
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
          onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />

        {file ? (
          <div>
            <FileSpreadsheet className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-900 dark:text-white">{file.name}</p>
            <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            <button type="button"
              onClick={e => { e.stopPropagation(); setFile(null); setResult(null); }}
              className="text-xs text-red-400 hover:text-red-500 mt-2">
              Remove file
            </button>
          </div>
        ) : (
          <div>
            <Upload className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="font-semibold text-gray-700 dark:text-gray-300">Drop your file here</p>
            <p className="text-sm text-gray-400 mt-1">or click to browse</p>
            <p className="text-xs text-gray-400 mt-2">CSV, XLSX, XLS • Max 10MB</p>
          </div>
        )}
      </div>

      {/* Progress */}
      {loading && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <LoadingSpinner size="sm" className="text-primary-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {phaseLabel[phase] || 'Processing...'}
            </span>
            <span className="ml-auto text-sm font-bold text-primary-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
            <div className="bg-primary-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
          {phase === 'verifying' && (
            <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Checking email deliverability via Abstract API...
            </p>
          )}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────── */}
      {result && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Import Results</h3>
            {result.verificationEnabled
              ? <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" /> Email verification enabled
                </span>
              : <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                  <Info className="w-3.5 h-3.5" /> Verification skipped (no API key)
                </span>
            }
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatChip icon={CheckCircle}  count={result.data.imported}      label="Imported"            color="green" />
            <StatChip icon={ShieldCheck}  count={result.data.deliverable}   label="Deliverable"         color="blue"  />
            <StatChip icon={XCircle}      count={result.data.undeliverable} label="Moved to Failed"     color="red"   />
            <StatChip icon={ShieldAlert}  count={result.data.needsReview}   label="Needs Review"        color="yellow"/>
            <StatChip icon={AlertTriangle}count={result.data.duplicates}    label="Duplicates Skipped"  color="gray"  />
            <StatChip icon={XCircle}      count={result.data.invalid}       label="Invalid Format"      color="gray"  />
          </div>

          {/* Human-readable summary */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {result.message}
          </div>

          {/* Error details */}
          {result.data.errors?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Details ({result.data.errors.length})
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.data.errors.map((e, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
                    e.reason.includes('Undeliverable')
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500'
                  }`}>
                    <XCircle className="w-3 h-3 flex-shrink-0" />
                    <span className="font-medium">{e.row}</span>
                    <span>— {e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => navigate('/recruiters')} className="btn-primary flex-1 justify-center">
              View Recruiters
            </button>
            {result.data.undeliverable > 0 && (
              <button onClick={() => navigate('/failed-emails')} className="btn-danger flex-1 justify-center">
                <XCircle className="w-4 h-4" />
                Review {result.data.undeliverable} Failed Email{result.data.undeliverable > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload button */}
      {file && !result && !loading && (
        <button onClick={handleUpload} className="btn-primary w-full justify-center py-3">
          <Upload className="w-4 h-4" />
          Import & Verify — {file.name}
        </button>
      )}
    </div>
  );
};

export default UploadRecruiters;
