import React from 'react';
import { ShieldX, LogOut, Mail, Lock } from 'lucide-react';
import { logoutUser } from '../lib/supabase';

interface NotAllowlistedScreenProps {
  email: string | null;
}

export const NotAllowlistedScreen: React.FC<NotAllowlistedScreenProps> = ({ email }) => {
  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Subtle Background Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/95 backdrop-blur-md rounded-2xl border border-rose-500/30 p-6 sm:p-8 shadow-2xl relative z-10 text-center">
        {/* Warning Icon Header */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
            <ShieldX className="w-9 h-9" />
          </div>
        </div>

        <h1 className="text-2xl font-extrabold font-mono tracking-tight text-slate-100 mb-2 uppercase">
          ACCESS RESTRICTED
        </h1>
        
        <p className="text-xs font-mono text-rose-400 uppercase tracking-wide font-bold mb-4 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          <span>EMAIL NOT ON ALLOWLIST</span>
        </p>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6 space-y-2">
          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            You don't have access to this app — contact the owner to be added.
          </p>
          {email && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-2 text-xs font-mono text-slate-400">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-200">{email}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => logoutUser()}
          className="w-full bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-mono font-bold text-xs py-3 px-4 rounded-xl border border-slate-700 transition flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4 text-slate-400" />
          <span>SIGN OUT & TRY ANOTHER ACCOUNT</span>
        </button>
      </div>
    </div>
  );
};
