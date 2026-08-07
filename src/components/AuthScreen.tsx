import React, { useState } from 'react';
import { loginWithEmail, registerWithEmail, sendResetPasswordEmail, changeUserPassword, resendConfirmationEmail } from '../lib/supabase';
import { Activity, Dumbbell, Bike, MessageSquareCode, ShieldCheck, ArrowRight, Mail, Lock, KeyRound, CheckCircle2, AlertCircle, UserPlus, Check, Send } from 'lucide-react';

type ScreenMode = 'signin' | 'reset' | 'setup';

interface AuthScreenProps {
  isPasswordRecovery?: boolean;
  onPasswordRecoveryComplete?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  isPasswordRecovery = false,
  onPasswordRecoveryComplete,
}) => {
  const [mode, setMode] = useState<ScreenMode>('signin');

  // Password Recovery State
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Sign In State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Unconfirmed Email State
  const [isUnconfirmedEmail, setIsUnconfirmedEmail] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [resending, setResending] = useState(false);

  // Setup State
  const [setupStep, setSetupStep] = useState<'email' | 'password'>('email');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [checkingInvite, setCheckingInvite] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);

  // General Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const switchMode = (newMode: ScreenMode, prefillEmail?: string) => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
    setAlreadyExists(false);
    setIsUnconfirmedEmail(false);

    if (prefillEmail) {
      setEmail(prefillEmail);
      setSetupEmail(prefillEmail);
    }

    if (newMode === 'setup') {
      setSetupStep('email');
      setSetupPassword('');
      setSetupConfirmPassword('');
    }
  };

  const handleResendConfirmation = async (targetEmail: string) => {
    if (!targetEmail) return;
    setResending(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await resendConfirmationEmail(targetEmail);
      setSuccessMessage(`Confirmation link resent to ${targetEmail}! Please check your inbox and spam folder.`);
    } catch (err: any) {
      console.error('Failed to resend confirmation email:', err);
      setError(err?.message || 'Failed to resend confirmation email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setIsUnconfirmedEmail(false);

    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Email not confirmed. Please check your inbox for the confirmation link sent by Supabase.');
        setIsUnconfirmedEmail(true);
        setUnconfirmedEmail(email.trim());
      } else {
        setError(msg || 'Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address to receive a password reset link.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await sendResetPasswordEmail(email);
      setSuccessMessage(`Password reset link sent to ${email.trim()}. Please check your inbox.`);
    } catch (err: any) {
      console.error('Password reset failed:', err);
      setError(err?.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await changeUserPassword(newPassword);
      setResetSuccess(true);
      setSuccessMessage('Password updated successfully! Redirecting...');
      setTimeout(() => {
        if (onPasswordRecoveryComplete) {
          onPasswordRecoveryComplete();
        }
      }, 1500);
    } catch (err: any) {
      console.error('Failed to update password:', err);
      setError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = setupEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    setCheckingInvite(true);
    setError(null);
    setAlreadyExists(false);

    try {
      const res = await fetch('/api/check-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok || !data.invited) {
        setError("This email hasn't been invited yet — contact the app owner.");
        setSetupStep('email');
        return;
      }

      // Invited! Reveal password fields
      setSetupStep('password');
    } catch (err: any) {
      console.error('Failed to verify invite:', err);
      setError('Unable to verify invitation status. Please try again.');
    } finally {
      setCheckingInvite(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAlreadyExists(false);

    if (!setupPassword || setupPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (setupPassword !== setupConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await registerWithEmail(setupEmail.trim(), setupPassword);
      if (data?.user && !data?.session) {
        setSuccessMessage(`Account created! A confirmation link has been sent to ${setupEmail.trim()}. Please check your inbox/spam folder and confirm your email before signing in.`);
        setIsUnconfirmedEmail(true);
        setUnconfirmedEmail(setupEmail.trim());
        switchMode('signin', setupEmail.trim());
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      const msg = (err?.message || '').toLowerCase();

      if (msg.includes('already registered') || msg.includes('already in use') || msg.includes('user_already_exists')) {
        setAlreadyExists(true);
        setError('An account already exists for this email — sign in instead.');
      } else {
        setError(err?.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Instrument Grid Lines */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Header Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <Activity className="w-8 h-8 animate-pulse" />
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold font-mono tracking-wider text-slate-100 mb-1">
            THRESHOLD
          </h1>
          <p className="text-xs text-emerald-400 font-mono tracking-wide uppercase font-bold">
            Precision Lifting & Cycling Nutrition AI
          </p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Tailored nutrition telemetry for 5-day rotation lifters and daily road cyclists.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="space-y-2.5 mb-6">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex items-start gap-3">
            <Dumbbell className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-200">Fixed 5-Day Workout Rotation</p>
              <p className="text-[11px] text-slate-400">Track machine & cable movements across your rotation.</p>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex items-start gap-3">
            <Bike className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-200">Daily Cycling Calorie Telemetry</p>
              <p className="text-[11px] text-slate-400">Factoring high road cycling expenditure into real-time macros.</p>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex items-start gap-3">
            <MessageSquareCode className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-200">Gemini 3.6 Daily AI Coach</p>
              <p className="text-[11px] text-slate-400">Log meals naturally to get instant calorie & macro guidance.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{error}</p>
                {isUnconfirmedEmail && unconfirmedEmail && (
                  <button
                    type="button"
                    onClick={() => handleResendConfirmation(unconfirmedEmail)}
                    disabled={resending}
                    className="mt-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1.5 underline disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>{resending ? 'Resending...' : `Resend confirmation link to ${unconfirmedEmail}`}</span>
                  </button>
                )}
              </div>
            </div>
            {alreadyExists && (
              <button
                type="button"
                onClick={() => switchMode('signin', setupEmail)}
                className="mt-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition underline self-start"
              >
                Sign in with {setupEmail} →
              </button>
            )}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* PASSWORD RECOVERY MODE */}
        {isPasswordRecovery ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="text-left mb-2">
              <h3 className="text-sm font-mono font-bold text-slate-200 uppercase flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>Create New Password</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter your new account password below.
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-bold">
                New Password (min 8 chars)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-bold">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmNewPassword || resetSuccess}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold font-mono text-xs py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>UPDATE PASSWORD</span>
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <>
            {/* Mode 1: SIGN IN */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-bold">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="athlete@example.com"
                  required
                  autoComplete="email"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-mono text-slate-300 uppercase font-bold">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-xs font-mono text-emerald-400 hover:text-emerald-300 transition hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold font-mono text-xs py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>SIGN IN TO THRESHOLD</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Link to invited user self-service account setup */}
            <div className="pt-3 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={() => switchMode('setup', email)}
                className="text-xs font-mono text-emerald-400 hover:text-emerald-300 transition hover:underline font-semibold flex items-center justify-center gap-1.5 mx-auto"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>First time here? Set up your account</span>
              </button>
            </div>
          </form>
        )}

        {/* Mode 2: SETUP (Invited user self-service flow) */}
        {mode === 'setup' && (
          <div className="space-y-4">
            <div className="text-left mb-1">
              <h3 className="text-sm font-mono font-bold text-slate-200 uppercase flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>Invited Account Setup</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter your invited email address to choose your password.
              </p>
            </div>

            {setupStep === 'email' ? (
              <form onSubmit={handleCheckInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-bold">
                    Invited Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={setupEmail}
                      onChange={(e) => {
                        setSetupEmail(e.target.value);
                        setError(null);
                      }}
                      placeholder="athlete@example.com"
                      required
                      autoComplete="email"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => switchMode('signin', setupEmail)}
                    className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-xs py-2.5 rounded-xl transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={checkingInvite || !setupEmail.trim()}
                    className="w-2/3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold font-mono text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {checkingInvite ? (
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>CONTINUE</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateAccount} className="space-y-3.5">
                {/* Verified Email Indicator */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl flex items-center justify-between text-xs font-mono text-emerald-300">
                  <span className="truncate max-w-[220px]">{setupEmail}</span>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Invited</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-bold">
                    Choose Password (min 8 chars)
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-bold">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={setupConfirmPassword}
                      onChange={(e) => setSetupConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSetupStep('email');
                      setError(null);
                      setAlreadyExists(false);
                    }}
                    className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-xs py-2.5 rounded-xl transition"
                  >
                    Change Email
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !setupPassword || !setupConfirmPassword}
                    className="w-2/3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold font-mono text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>CREATE ACCOUNT & SIGN IN</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => switchMode('signin', setupEmail)}
                className="text-xs font-mono text-slate-400 hover:text-slate-200 transition underline"
              >
                Already have an account? Sign in
              </button>
            </div>
          </div>
        )}

        {/* Mode 3: RESET PASSWORD */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="text-left mb-2">
              <h3 className="text-sm font-mono font-bold text-slate-200 uppercase flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Reset Password</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter your email address and we'll send you a password reset link.
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-bold">
                Account Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="athlete@example.com"
                  required
                  autoComplete="email"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-xs py-2.5 rounded-xl transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-2/3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold font-mono text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>SEND RESET LINK</span>
                )}
              </button>
            </div>
          </form>
        )}
      </>
    )}

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
          <span>Scoped Supabase Data Security Enforced</span>
        </div>
      </div>
    </div>
  );
};

