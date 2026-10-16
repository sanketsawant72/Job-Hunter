import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, Eye, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { resumeAPI } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const ResumePage = () => {
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await resumeAPI.get();
        setResume(res.data.data);
      } catch { toast.error('Failed to load resume'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleFile = async (file) => {
    const allowed = ['.pdf', '.docx', '.doc'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      toast.error('Only PDF and DOCX files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await resumeAPI.upload(formData);
      setResume(res.data.data);
      toast.success('Resume uploaded successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await resumeAPI.delete();
      setResume(null);
      setShowDelete(false);
      toast.success('Resume deleted');
    } catch { toast.error('Delete failed'); }
    finally { setDeleteLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <LoadingSpinner size="xl" className="text-primary-500" />
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Resume</h1>
        <p className="text-gray-500 text-sm mt-1">Upload your resume to attach it to job application emails</p>
      </div>

      {/* Status banner */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${
        resume ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800'
               : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800'
      }`}>
        {resume
          ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
        }
        <p className={`text-sm ${resume ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
          {resume ? `Active resume: ${resume.originalName}` : 'No resume uploaded. Upload one to attach it to emails.'}
        </p>
      </div>

      {/* Current resume */}
      {resume && (
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">{resume.originalName}</p>
              <p className="text-sm text-gray-500 mt-0.5">{resume.sizeFormatted} • Uploaded {new Date(resume.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <a
                href={resume.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                title="Preview"
              >
                <Eye className="w-4 h-4" />
              </a>
              <button
                onClick={() => setShowDelete(true)}
                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload area */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
          dragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
            : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.doc"
          className="hidden"
          onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="xl" className="text-primary-500" />
            <p className="text-gray-500">Uploading...</p>
          </div>
        ) : (
          <div>
            <Upload className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="font-semibold text-gray-700 dark:text-gray-300">
              {resume ? 'Replace Resume' : 'Upload Resume'}
            </p>
            <p className="text-sm text-gray-400 mt-1">Drop here or click to browse</p>
            <p className="text-xs text-gray-400 mt-2">PDF, DOCX • Max 5MB • Only one active resume</p>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="card p-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tips</p>
        <ul className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
          <li>• Keep your resume under 2 pages for best results</li>
          <li>• PDF format is recommended for consistent formatting</li>
          <li>• Ensure your resume is ATS-friendly (no graphics, tables)</li>
          <li>• Update skills and experience in Settings to improve AI emails</li>
        </ul>
      </div>

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Resume"
        message="This will remove your active resume. Emails sent without a resume won't have an attachment."
        confirmText="Delete"
        danger
        loading={deleteLoading}
      />
    </div>
  );
};

export default ResumePage;
