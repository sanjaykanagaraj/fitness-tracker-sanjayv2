import React, { useState, useEffect } from 'react';
import { supabase, logoutUser } from './lib/supabase';
import { UserProfile, WorkoutPlan } from './types';
import { Navbar } from './components/Navbar';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { NotAllowlistedScreen } from './components/NotAllowlistedScreen';
import { ApiKeyModal } from './components/ApiKeyModal';
import { Activity } from 'lucide-react';

type AppUser = {
  id: string;
  uid: string;
  email: string | null;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Access Control & Allowlist State
  const [isAllowlisted, setIsAllowlisted] = useState<boolean | null>(null);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

  // User Gemini API Key & Settings Modal
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // User Profile & Plan State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Listen to Supabase Auth State and verify email allowlist + settings
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }

      const user = session?.user
        ? { id: session.user.id, uid: session.user.id, email: session.user.email || null }
        : null;

      setCurrentUser(user);

      if (user) {
        setDataLoading(true);
        const emailLower = (user.email || '').toLowerCase();

        try {
          // 1. Allowlist check via Supabase allowed_users table
          const { data: allowedData } = await supabase
            .from('allowed_users')
            .select('*')
            .eq('email', emailLower)
            .maybeSingle();

          let isAllowed = allowedData?.allowed === true;

          // Self-bootstrapping for primary admin accounts
          if (!allowedData && (emailLower === 'sanjaykanagaraj106@gmail.com' || emailLower === 'sanjaykanagaraj842@gmail.com')) {
            isAllowed = true;
          } else if (emailLower === 'sanjaykanagaraj106@gmail.com' || emailLower === 'sanjaykanagaraj842@gmail.com') {
            isAllowed = true;
          }

          if (!isAllowed) {
            console.warn(`Access denied for ${user.email} - not on allowlist.`);
            setDeniedEmail(user.email);
            setIsAllowlisted(false);
            await logoutUser();
            setProfile(null);
            setPlan(null);
            setUserApiKey(null);
            setDataLoading(false);
            setAuthLoading(false);
            return;
          }

          setIsAllowlisted(true);
          setDeniedEmail(null);

          // 2. Fetch User Profile / Settings / Plan from user_profiles table
          const { data: profileRow } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.uid)
            .maybeSingle();

          if (profileRow) {
            const keyFound = profileRow.gemini_api_key || null;
            setUserApiKey(keyFound);

            if (profileRow.profile) {
              setProfile(profileRow.profile as UserProfile);
            } else {
              setProfile(null);
            }

            if (profileRow.plan) {
              const planData = profileRow.plan;
              if (Array.isArray(planData)) {
                setPlan(planData as WorkoutPlan);
              } else if (planData && Array.isArray((planData as any).days)) {
                setPlan((planData as any).days as WorkoutPlan);
              } else {
                setPlan(null);
              }
            } else {
              setPlan(null);
            }
          } else {
            setUserApiKey(null);
            setProfile(null);
            setPlan(null);
          }
        } catch (err) {
          console.error('Error fetching allowlist or user data:', err);
        } finally {
          setDataLoading(false);
        }
      } else {
        setIsAllowlisted(null);
        setUserApiKey(null);
        setProfile(null);
        setPlan(null);
      }
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSaveApiKey = async (newKey: string) => {
    if (!currentUser) return;

    try {
      const cleanKey = newKey.trim();
      await supabase.from('user_profiles').upsert({
        user_id: currentUser.uid,
        email: currentUser.email || '',
        gemini_api_key: cleanKey,
        updated_at: new Date().toISOString(),
      });

      setUserApiKey(cleanKey);
    } catch (err) {
      console.error('Error saving API Key to Supabase:', err);
      throw err;
    }
  };

  const handleOnboardingComplete = async (newProfile: UserProfile, newPlan: WorkoutPlan) => {
    if (!currentUser) return;

    try {
      await supabase.from('user_profiles').upsert({
        user_id: currentUser.uid,
        email: currentUser.email || '',
        profile: newProfile,
        plan: newPlan,
        gemini_api_key: userApiKey,
        updated_at: new Date().toISOString(),
      });

      setProfile(newProfile);
      setPlan(newPlan);
    } catch (err) {
      console.error('Error saving onboarding data to Supabase:', err);
      throw err;
    }
  };

  const handleResetProfile = () => {
    setProfile(null);
  };

  // Loading Screen
  if (authLoading || (currentUser && isAllowlisted === null && dataLoading)) {
    return (
      <div className="min-h-screen bg-[#070a10] text-slate-100 flex flex-col items-center justify-center p-4 font-mono">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <Activity className="w-6 h-6 animate-pulse" />
        </div>
        <p className="text-xs text-slate-400 tracking-wider uppercase">INITIALIZING TELEMETRY PIPELINE...</p>
      </div>
    );
  }

  // Access Denied Screen (Not on Allowlist)
  if (deniedEmail && isAllowlisted === false) {
    return <NotAllowlistedScreen email={deniedEmail} />;
  }

  // Password Recovery Screen
  if (isPasswordRecovery) {
    return (
      <AuthScreen
        isPasswordRecovery={true}
        onPasswordRecoveryComplete={() => setIsPasswordRecovery(false)}
      />
    );
  }

  // Not logged in
  if (!currentUser) {
    return <AuthScreen />;
  }

  // Logged in & allowlisted, but missing Gemini API key
  if (!userApiKey) {
    return (
      <ApiKeyModal
        currentKey={null}
        userEmail={currentUser.email}
        onSaveKey={handleSaveApiKey}
      />
    );
  }

  // Logged in, allowlisted, has API key, but needs onboarding profile/plan
  if (!profile || !plan) {
    return (
      <div className="min-h-screen bg-[#070a10] text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
        <Navbar
          userEmail={currentUser.email}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
        <OnboardingScreen
          userId={currentUser.uid}
          apiKey={userApiKey}
          onComplete={handleOnboardingComplete}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
        {showSettingsModal && (
          <ApiKeyModal
            isModal
            currentKey={userApiKey}
            userEmail={currentUser.email}
            onSaveKey={handleSaveApiKey}
            onClose={() => setShowSettingsModal(false)}
          />
        )}
      </div>
    );
  }

  // Dashboard Main View
  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      <Navbar
        userEmail={currentUser.email}
        profile={profile}
        onResetProfile={handleResetProfile}
        onOpenSettings={() => setShowSettingsModal(true)}
      />
      <DashboardScreen
        profile={profile}
        plan={plan}
        apiKey={userApiKey}
        onOpenSettings={() => setShowSettingsModal(true)}
      />
      {showSettingsModal && (
        <ApiKeyModal
          isModal
          currentKey={userApiKey}
          userEmail={currentUser.email}
          onSaveKey={handleSaveApiKey}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}
