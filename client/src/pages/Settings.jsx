import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { User, Code, Mail, Cpu, Save, Eye, EyeOff, RefreshCw, Wand2 } from 'lucide-react';
import { settingsAPI } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'ai', label: 'AI & OpenAI', icon: Cpu },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'prompt', label: 'AI Prompt', icon: Code }
];

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [fixingSignature, setFixingSignature] = useState(false);
  const [settings, setSettings] = useState(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await settingsAPI.get();
        setSettings(res.data.data);
        reset({
          ...res.data.data,
          skills: Array.isArray(res.data.data.skills) ? res.data.data.skills.join(', ') : res.data.data.skills || '',
          openaiApiKey: '' // Don't prefill masked key
        });
      } catch { toast.error('Failed to load settings'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleFixSignature = async () => {
    setFixingSignature(true);
    try {
      const res = await settingsAPI.fixSignature();
      const newSig = res.data.data.emailSignature;
      reset({ ...watch(), emailSignature: newSig });
      toast.success('Signature rebuilt from your profile');
    } catch {
      toast.error('Failed to rebuild signature');
    } finally {
      setFixingSignature(false);
    }
  };

  const onSubmit = async (data) => {    setSaving(true);
    try {
      // Convert skills string to array
      if (typeof data.skills === 'string') {
        data.skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
      }
      // Only update API key if not empty and not masked
      if (!data.openaiApiKey || data.openaiApiKey.startsWith('••')) {
        delete data.openaiApiKey;
      }
      await settingsAPI.update(data);
      toast.success('Settings saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <LoadingSpinner size="xl" className="text-primary-500" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure your profile, AI settings, and integrations</p>
      </div>

      <div className="flex gap-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="card p-6 space-y-5">
            <h3 className="font-semibold text-gray-900 dark:text-white">Candidate Profile</h3>
            <p className="text-sm text-gray-500">This information is used by AI to write personalized emails.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name</label>
                <input className="input" placeholder="Your full name" {...register('candidateName')} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" placeholder="+1 234 567 8900" {...register('phone')} />
              </div>
              <div>
                <label className="label">College / University</label>
                <input className="input" placeholder="MIT, Stanford..." {...register('college')} />
              </div>
              <div>
                <label className="label">Degree</label>
                <input className="input" placeholder="B.S. Computer Science" {...register('degree')} />
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input" placeholder="New York, NY" {...register('location')} />
              </div>
              <div>
                <label className="label">Years of Experience</label>
                <input className="input" placeholder="3 years of full-stack development" {...register('experience')} />
              </div>
            </div>

            <div>
              <label className="label">Skills (comma separated)</label>
              <input className="input" placeholder="React, Node.js, MongoDB, Python, AWS..."
                {...register('skills')} />
            </div>

            <div>
              <label className="label">Projects</label>
              <textarea className="input resize-none" rows={3}
                placeholder="Describe key projects: e.g., 'Built an e-commerce app with React and Node.js...'"
                {...register('projects')} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">GitHub</label>
                <input className="input" placeholder="https://github.com/you" {...register('github')} />
              </div>
              <div>
                <label className="label">LinkedIn</label>
                <input className="input" placeholder="https://linkedin.com/in/you" {...register('linkedin')} />
              </div>
              <div>
                <label className="label">Portfolio</label>
                <input className="input" placeholder="https://yoursite.com" {...register('portfolio')} />
              </div>
            </div>

            <div>
              <label className="label">Resume Summary</label>
              <textarea className="input resize-none" rows={3}
                placeholder="Brief summary of your professional background for AI context..."
                {...register('resumeSummary')} />
            </div>
          </div>
        )}

        {/* AI Tab */}
        {activeTab === 'ai' && (
          <div className="card p-6 space-y-5">
            <h3 className="font-semibold text-gray-900 dark:text-white">OpenAI Configuration</h3>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
              Your OpenAI API key is used to generate personalized job application emails.
              Get one at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">platform.openai.com</a>.
              {settings?.openaiApiKeySet && <span className="ml-2 font-medium text-green-600 dark:text-green-400">✓ Key is set</span>}
            </div>

            <div>
              <label className="label">OpenAI API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder={settings?.openaiApiKeySet ? 'Leave empty to keep current key' : 'sk-...'}
                  {...register('openaiApiKey')}
                />
                <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Leave blank to use the system key (if available). Your key takes priority.</p>
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Email Signature</h3>
              <button
                type="button"
                onClick={handleFixSignature}
                disabled={fixingSignature}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
              >
                {fixingSignature ? <LoadingSpinner size="sm" /> : <Wand2 className="w-3.5 h-3.5" />}
                Sync from Profile
              </button>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-sm text-blue-700 dark:text-blue-300">
              Click <strong>Sync from Profile</strong> to rebuild the signature from your name, phone, and links — fixes any stale or incorrect data.
            </div>
            <div>
              <label className="label">Signature</label>
              <textarea className="input resize-none font-mono text-sm" rows={6}
                placeholder={"Best regards,\nYour Name\n+1 234 567 8900\nhttps://linkedin.com/in/you\nhttps://github.com/you"}
                {...register('emailSignature')} />
              <p className="text-xs text-gray-400 mt-1">This signature is appended to all emails. It is auto-built from your profile — you can also edit it manually here.</p>
            </div>
          </div>
        )}

        {/* Prompt Tab */}
        {activeTab === 'prompt' && (
          <div className="card p-6 space-y-5">
            <h3 className="font-semibold text-gray-900 dark:text-white">Custom AI Prompt</h3>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300">
              Customize how the AI generates emails. Use variables like{' '}
              <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{'{recruiterName}'}</code>,{' '}
              <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{'{company}'}</code>,{' '}
              <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{'{role}'}</code>,{' '}
              <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{'{candidateName}'}</code>,{' '}
              <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{'{skills}'}</code>,{' '}
              <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{'{experience}'}</code>
            </div>
            <div>
              <label className="label">Prompt Template</label>
              <textarea className="input resize-y font-mono text-sm leading-relaxed" rows={12}
                {...register('aiPromptTemplate')} />
            </div>
            <button type="button" onClick={() => {
              const defaultPrompt = `Write a professional job application email to {recruiterName} at {company} for the {role} position.\nCandidate: {candidateName}\nSkills: {skills}\nExperience: {experience}\nProjects: {projects}\nKeep it under 180 words. Sound natural and human. Mention the company naturally.`;
              reset({ ...watch(), aiPromptTemplate: defaultPrompt });
              toast.info('Prompt reset to default');
            }} className="btn-secondary text-sm">
              <RefreshCw className="w-4 h-4" /> Reset to Default
            </button>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
