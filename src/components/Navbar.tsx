import React from 'react';
import { UserProfile } from '../types';
import { logoutUser } from '../lib/supabase';
import { Activity, LogOut, Flame, Target, Calendar, Key } from 'lucide-react';

interface NavbarProps {
  userEmail?: string | null;
  profile?: UserProfile | null;
  onResetProfile?: () => void;
  onOpenSettings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ userEmail, profile, onResetProfile, onOpenSettings }) => {
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  return (
    <header className="bg-[#121214] border-b border-white/10 sticky top-0 z-50 px-4 lg:px-8 py-3.5 font-sans">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#FF4D00] flex items-center justify-center font-black text-black text-xl italic rounded shadow-[0_0_15px_rgba(255,77,0,0.3)]">
            T
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black tracking-tighter text-xl text-white uppercase italic">THRESHOLD</span>
              <span className="text-[10px] font-mono font-bold uppercase bg-[#FF4D00]/10 text-[#FF4D00] px-1.5 py-0.5 rounded border border-[#FF4D00]/30">
                PRO TELEMETRY
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium hidden sm:block">Lift + Road Cycling Nutrition Intelligence</p>
          </div>
        </div>

        {/* Status Strip & Profile Info */}
        <div className="flex items-center gap-3 sm:gap-6">
          {profile && (
            <div className="hidden md:flex items-center gap-4 bg-zinc-900 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Target className="w-3.5 h-3.5 text-[#00FFD1]" />
                <span className="capitalize text-[#00FFD1] font-bold">{profile.goal.replace('_', ' ')}</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Flame className="w-3.5 h-3.5 text-[#FF4D00]" />
                <span className="font-bold">{profile.target_calories} kcal/day</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono bg-zinc-900 px-2.5 py-1 rounded border border-white/10 hidden sm:flex">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>{todayStr}</span>
          </div>

          {/* User, Settings & Logout */}
          <div className="flex items-center gap-2">
            {userEmail && (
              <span className="text-xs text-zinc-400 font-mono max-w-[120px] sm:max-w-[180px] truncate hidden sm:inline">
                {userEmail}
              </span>
            )}
            
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="Account Settings & API Key"
                className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 rounded border border-amber-500/30 transition"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}

            {profile && onResetProfile && (
              <button
                onClick={onResetProfile}
                title="Recalculate Onboarding Targets"
                className="text-xs font-mono font-bold text-zinc-300 hover:text-[#00FFD1] bg-zinc-900 hover:bg-zinc-800 px-2.5 py-1.5 rounded border border-white/10 transition"
              >
                Edit Plan
              </button>
            )}

            <button
              onClick={logoutUser}
              className="flex items-center gap-1 text-xs font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-[#FF4D00] px-2.5 py-1.5 rounded border border-white/10 transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

