import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Star, Edit, Trash2, Sparkles, Download, Filter, RefreshCw, SlidersHorizontal, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import { recruiterAPI } from '../services/api';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import SkeletonRow from '../components/ui/SkeletonRow';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import RecruiterForm from '../components/RecruiterForm';

const STATUS_FILTERS = ['all', 'new', 'drafted', 'sent', 'replied', 'rejected'];

const Recruiters = () => {
  const navigate = useNavigate();
  const [recruiters, setRecruiters] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editRecruiter, setEditRecruiter] = useState(null);
  const [favorite, setFavorite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      if (status !== 'all') params.status = status;
      if (favorite) params.favorite = 'true';
      const res = await recruiterAPI.getAll(params);
      setRecruiters(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load recruiters');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, favorite]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status, favorite]);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await recruiterAPI.delete(deleteId);
      toast.success('Recruiter deleted');
      setDeleteId(null);
      load();
    } catch { toast.error('Delete failed'); }
    finally { setDeleteLoading(false); }
  };

  const handleToggleFavorite = async (id, e) => {
    e.stopPropagation();
    try {
      await recruiterAPI.toggleFavorite(id);
      setRecruiters(prev => prev.map(r => r._id === id ? { ...r, isFavorite: !r.isFavorite } : r));
    } catch { toast.error('Failed to update favorite'); }
  };

  const handleExport = async () => {
    try {
      const res = await recruiterAPI.export();
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'recruiters.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recruiters</h1>
          <p className="text-gray-500 text-sm mt-0.5">{pagination?.total ?? 0} total recruiters</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => navigate('/recruiters/upload')} className="btn-secondary text-sm">
            <Download className="w-4 h-4 rotate-180" /> Import
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Add Recruiter
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, company, email..."
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
          <button
            onClick={() => setFavorite(!favorite)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
              favorite ? 'bg-yellow-400 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Star className="w-3 h-3" /> Favorites
          </button>
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
                {['Recruiter', 'Company', 'Role', 'Email', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {loading ? Array(6).fill(0).map((_, i) => <SkeletonRow key={i} cols={6} />) :
                recruiters.length === 0 ? (
                  <tr><td colSpan={6}>
                    <EmptyState icon={Users} title="No recruiters found"
                      description="Import recruiters from CSV/Excel or add them manually"
                      action={<button onClick={() => setShowAdd(true)} className="btn-primary text-sm">Add Recruiter</button>}
                    />
                  </td></tr>
                ) : (
                  recruiters.map(r => (
                    <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={e => handleToggleFavorite(r._id, e)} className="flex-shrink-0">
                            <Star className={`w-4 h-4 ${r.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} />
                          </button>
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-white">{r.name}</p>
                            {r.location && <p className="text-xs text-gray-400">{r.location}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-medium">{r.company}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{r.role || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{r.email}</td>
                      <td className="px-4 py-3"><Badge status={r.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate('/ai-generator', { state: { recruiterId: r._id, recruiterName: r.name, company: r.company } })}
                            className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-500 transition-colors"
                            title="Generate Email"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditRecruiter(r)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(r._id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Add/Edit Modal */}
      <Modal isOpen={showAdd || !!editRecruiter} onClose={() => { setShowAdd(false); setEditRecruiter(null); }}
        title={editRecruiter ? 'Edit Recruiter' : 'Add Recruiter'}>
        <RecruiterForm
          initial={editRecruiter}
          onSuccess={() => { setShowAdd(false); setEditRecruiter(null); load(); }}
        />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Recruiter"
        message="This will permanently delete this recruiter and cannot be undone."
        confirmText="Delete"
        danger
        loading={deleteLoading}
      />
    </div>
  );
};

export default Recruiters;
