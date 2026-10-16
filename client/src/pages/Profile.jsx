import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Camera, User, Lock, Save, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const fileRef = useRef();

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: { name: user?.name, email: user?.email }
  });

  const { register: registerPass, handleSubmit: handlePassSubmit, reset: resetPass, formState: { errors: passErrors } } = useForm();

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('email', data.email);
      if (avatarFile) formData.append('avatar', avatarFile);

      const res = await authAPI.updateProfile(formData);
      updateUser(res.data.user);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (data) => {
    setChangingPass(true);
    try {
      await authAPI.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Password changed successfully!');
      resetPass();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed');
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account information</p>
      </div>

      {/* Avatar */}
      <div className="card p-6 flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center overflow-hidden">
            {avatarPreview ? (
              <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-white">{user?.name?.[0]?.toUpperCase()}</span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center shadow-lg transition-colors"
          >
            <Camera className="w-4 h-4 text-white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-900 dark:text-white">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <User className="w-4 h-4" /> Account Information
        </h3>
        <div>
          <label className="label">Full Name</label>
          <input
            className={`input ${errors.name ? 'border-red-500' : ''}`}
            {...register('name', { required: 'Name is required' })}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className={`input ${errors.email ? 'border-red-500' : ''}`}
            {...register('email', { required: 'Email required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </form>

      {/* Password form */}
      <form onSubmit={handlePassSubmit(onChangePassword)} className="card p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Lock className="w-4 h-4" /> Change Password
        </h3>
        <div>
          <label className="label">Current Password</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              className={`input pr-10 ${passErrors.currentPassword ? 'border-red-500' : ''}`}
              placeholder="••••••••"
              {...registerPass('currentPassword', { required: 'Current password required' })}
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">New Password</label>
          <div className="relative">
            <input
              type={showNewPass ? 'text' : 'password'}
              className={`input pr-10 ${passErrors.newPassword ? 'border-red-500' : ''}`}
              placeholder="Min 6 characters"
              {...registerPass('newPassword', { required: 'New password required', minLength: { value: 6, message: 'Min 6 characters' } })}
            />
            <button type="button" onClick={() => setShowNewPass(!showNewPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passErrors.newPassword && <p className="text-red-500 text-xs mt-1">{passErrors.newPassword.message}</p>}
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={changingPass} className="btn-primary">
            {changingPass ? <LoadingSpinner size="sm" /> : <Lock className="w-4 h-4" />}
            Change Password
          </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
