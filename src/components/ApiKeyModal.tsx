import React, { useState } from 'react';
import { changeUserPassword } from '../lib/supabase';
import { Key, ExternalLink, ShieldCheck, Check, Eye, EyeOff, AlertCircle, Lock, Shield, CheckCircle2 } from 'lucide-react';

interface ApiKeyModalProps {
  currentKey?: string | null;
  userEmail?: string | null;
  isModal?: boolean;
  onSaveKey: (key: string) => Promise<void>;
  onClose?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  currentKey,
  userEmail,
  isModal = false,
  onSaveKey,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'key' | 'password'>('key');
  
  // API Key state
  const [keyInput, setKeyInput] = useState(currentKey || '');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Password Change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const maskKey = (k: string) => {
    if (!k) return '';
    if (k.length <= 8) return '••••••••';
    return k.slice(0, 4) + '••••••••' + k.slice(-4);
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = keyInput.trim();
    if (!clean) {
      setKeyError('Please paste a valid Gemini API key.');
      return;
    }

    setSavingKey(true);
    setKeyError(null);
    try {
      await onSaveKey(clean);
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Failed to save API Key:', err);
      setKeyError(err.message || 'Failed to save API key to Supabase.');
    } finally {
      setSavingKey(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPassError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('New password and confirmation do not match.');
      return;
    }

    setSavingPass(true);
    setPassError(null);
    setPassSuccess(null);

    try {
      await changeUserPassword(newPassword);
      setPassSuccess('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Failed to change password:', err);
      setPassError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setSavingPass(false);
    }
  };

  const content = (
    <div className={`bg-slate-900/95 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative font-sans ${isModal ? 'max-w-lg w-full' : 'max-w-md w-full'}`}>
      {/* Settings Navigation Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] shrink-0">
            {activeTab === 'key' ? <Key className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-lg font-extrabold font-mono tracking-wide text-slate-100 uppercase">
              ACCOUNT SETTINGS
            </h2>
            {userEmail && (
              <p className="text-xs font-mono text-slate-400 truncate max-w-[200px]">
                {userEmail}
              </p>
            )}
          </div>
        </div>

        {/* Tab Selector */}
        {isModal && (
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => { setActiveTab('key'); setPassError(null); setPassSuccess(null); }}
              className={`px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                activeTab === 'key'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>API Key</span>
            </button>
            <button
              onClick={() => { setActiveTab('password'); setKeyError(null); }}
              className={`px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                activeTab === 'password'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Password</span>
            </button>
          </div>
        )}
      </div>

      {activeTab === 'key' ? (
        <>
          <div className="space-y-3 mb-6">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1.5 font-sans">
              <p>
                This app uses direct client-side Gemini AI models. Bring your own free API key from Google AI Studio.
              </p>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Quota & Billing:</span>
                <span className="text-emerald-400 font-bold">Free to run (Uses your quota)</span>
              </div>
            </div>

            {/* Get Key Link */}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 p-3 rounded-xl transition text-xs font-mono text-emerald-300"
            >
              <span className="font-bold flex items-center gap-2">
                Get free key from Google AI Studio
              </span>
              <ExternalLink className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition" />
            </a>
          </div>

          {keyError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{keyError}</span>
            </div>
          )}

          {/* Key Form */}
          <form onSubmit={handleSaveKey} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1.5 font-bold flex items-center justify-between">
                <span>Gemini API Key</span>
                {currentKey && (
                  <span className="text-[11px] font-normal text-slate-400">
                    Stored: {maskKey(currentKey)}
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              {isModal && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-xs py-2.5 rounded-xl transition"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={savingKey || !keyInput.trim()}
                className={`${
                  isModal ? 'w-2/3' : 'w-full'
                } bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-mono font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50`}
              >
                {savingKey ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>SAVE API KEY</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed mb-4 font-sans">
            Update your account password. Use at least 6 characters.
          </div>

          {passError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{passError}</span>
            </div>
          )}

          {passSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{passSuccess}</span>
            </div>
          )}

          {/* Change Password Form */}
          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-bold">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-bold">
                Confirm New Password
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              {isModal && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-xs py-2.5 rounded-xl transition"
                >
                  Close
                </button>
              )}

              <button
                type="submit"
                disabled={savingPass || !newPassword || newPassword.length < 6}
                className={`${
                  isModal ? 'w-2/3' : 'w-full'
                } bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-mono font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50`}
              >
                {savingPass ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>UPDATE PASSWORD</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </>
      )}

      <div className="mt-5 text-[11px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Stored securely in your private Supabase user profile</span>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 flex flex-col justify-center items-center p-4 relative font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />
      {content}
    </div>
  );
};
