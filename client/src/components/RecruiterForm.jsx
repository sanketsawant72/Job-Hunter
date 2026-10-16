import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { recruiterAPI } from '../services/api';
import LoadingSpinner from './ui/LoadingSpinner';

const RecruiterForm = ({ initial, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: initial || {}
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      // Convert tags string to array
      if (typeof data.tags === 'string') {
        data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
      }
      if (initial) {
        await recruiterAPI.update(initial._id, data);
        toast.success('Recruiter updated');
      } else {
        await recruiterAPI.create(data);
        toast.success('Recruiter added');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Recruiter Name *</label>
          <input className={`input ${errors.name ? 'border-red-500' : ''}`}
            placeholder="Jane Smith"
            {...register('name', { required: 'Name is required' })} />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">Company *</label>
          <input className={`input ${errors.company ? 'border-red-500' : ''}`}
            placeholder="Google Inc."
            {...register('company', { required: 'Company is required' })} />
          {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company.message}</p>}
        </div>
      </div>

      <div>
        <label className="label">Email *</label>
        <input type="email" className={`input ${errors.email ? 'border-red-500' : ''}`}
          placeholder="jane@company.com"
          {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })} />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Role / Position</label>
          <input className="input" placeholder="Software Engineer" {...register('role')} />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" placeholder="New York, NY" {...register('location')} />
        </div>
      </div>

      <div>
        <label className="label">LinkedIn URL</label>
        <input className="input" placeholder="https://linkedin.com/in/..." {...register('linkedin')} />
      </div>

      <div>
        <label className="label">Tags (comma separated)</label>
        <input className="input" placeholder="frontend, startup, remote"
          defaultValue={initial?.tags?.join(', ')} {...register('tags')} />
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none" rows={2} placeholder="Any notes about this recruiter..."
          {...register('notes')} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <LoadingSpinner size="sm" /> : initial ? 'Update Recruiter' : 'Add Recruiter'}
        </button>
      </div>
    </form>
  );
};

export default RecruiterForm;
