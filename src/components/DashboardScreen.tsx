import React, { useState, useEffect } from 'react';
import { UserProfile, WorkoutPlan, DayLog, ChatMessage, AICoachResult, CardioEntry, CardioType } from '../types';
import { supabase } from '../lib/supabase';
import { computeCoachChatAI } from '../lib/gemini';
import {
  CheckSquare,
  Square,
  Send,
  Flame,
  Dumbbell,
  Sparkles,
  RefreshCw,
  Lightbulb,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Bike,
  Pencil,
  Check,
  Plus,
  Trash2,
  X
} from 'lucide-react';

interface DashboardScreenProps {
  profile: UserProfile;
  plan: WorkoutPlan;
  apiKey: string;
  onOpenSettings?: () => void;
}

// Helper: Parse prescribed "sets x reps" string into numerical sets & reps
export function parseSetsReps(str: string): { sets: number; reps: string } {
  if (!str) return { sets: 3, reps: '10' };
  const parts = str.toLowerCase().split(/x|×|&|\//);
  if (parts.length >= 2) {
    const s = parseInt(parts[0].replace(/\D/g, ''), 10);
    const r = parts[1].trim();
    return {
      sets: isNaN(s) || s <= 0 ? 3 : s,
      reps: r || '10',
    };
  }
  const singleNum = parseInt(str.replace(/\D/g, ''), 10);
  return {
    sets: isNaN(singleNum) || singleNum <= 0 ? 3 : singleNum,
    reps: '10',
  };
}

// Helper: Estimate Cardio Burn per entry based on activity type, duration/distance, and intensity notes
export function computeCardioEntryBurn(entry: CardioEntry): number {
  const type = entry.type || 'Road Cycling';
  const duration = entry.durationMins || 0;
  const distance = entry.distanceKm || 0;
  const notes = (entry.notes || '').toLowerCase();

  let ratePerMin = 10;
  let ratePerKm = 30;

  if (type === 'Road Cycling') {
    ratePerMin = 10;
    ratePerKm = 30;
  } else if (type === 'Running') {
    ratePerMin = 11.5;
    ratePerKm = 65;
  } else if (type === 'Swimming') {
    ratePerMin = 9.5;
    ratePerKm = 45;
  } else {
    ratePerMin = 8;
    ratePerKm = 25;
  }

  let baseBurn = 0;
  if (duration > 0) {
    baseBurn = duration * ratePerMin;
  } else if (distance > 0) {
    baseBurn = distance * ratePerKm;
  }

  // Adjust for intensity notes
  if (
    notes.includes('hard') ||
    notes.includes('hilly') ||
    notes.includes('sprint') ||
    notes.includes('fast') ||
    notes.includes('high') ||
    notes.includes('intense')
  ) {
    baseBurn *= 1.25;
  } else if (
    notes.includes('easy') ||
    notes.includes('light') ||
    notes.includes('recovery') ||
    notes.includes('slow') ||
    notes.includes('flat')
  ) {
    baseBurn *= 0.85;
  }

  return Math.round(baseBurn);
}

export function computeTotalCardioBurn(entries?: CardioEntry[]): number {
  if (!entries || entries.length === 0) return 0;
  return entries.reduce((sum, entry) => sum + computeCardioEntryBurn(entry), 0);
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ profile, plan, apiKey, onOpenSettings }) => {
  const todayDateStr = new Date().toISOString().split('T')[0];

  // Calculate rotation day index based on profile creation date
  const createdTime = new Date(profile.createdAt).getTime();
  const nowTime = new Date().getTime();
  const daysDiff = Math.max(0, Math.floor((nowTime - createdTime) / (1000 * 60 * 60 * 24)));
  const defaultDayIndex = plan.length > 0 ? daysDiff % plan.length : 0;

  const [activeDayIndex, setActiveDayIndex] = useState<number>(defaultDayIndex);
  const activePlanDay = plan[activeDayIndex] || plan[0];

  // DayLog State
  const [dayLog, setDayLog] = useState<DayLog>({
    date: todayDateStr,
    checks: {},
    exerciseLogs: {},
    cardio: [],
    messages: [],
    updatedAt: new Date().toISOString(),
  });

  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [dailyCapReached, setDailyCapReached] = useState(false);

  // Track which exercise ID is currently being edited for sets/reps
  const [editingExId, setEditingExId] = useState<string | null>(null);

  // Cardio Form State
  const [cardioType, setCardioType] = useState<CardioType>('Road Cycling');
  const [cardioDist, setCardioDist] = useState<string>('');
  const [cardioDur, setCardioDur] = useState<string>('');
  const [cardioNotes, setCardioNotes] = useState<string>('');
  const [editingCardioId, setEditingCardioId] = useState<string | null>(null);

  // Load today's log from Supabase table user_day_logs
  useEffect(() => {
    let isMounted = true;
    const loadDayLog = async () => {
      try {
        const { data, error } = await supabase
          .from('user_day_logs')
          .select('*')
          .eq('user_id', profile.uid)
          .eq('log_date', todayDateStr)
          .maybeSingle();

        if (error) {
          console.error('Failed to query user_day_logs from Supabase:', error);
        }

        if (data && isMounted) {
          setDayLog({
            date: todayDateStr,
            checks: data.checks || {},
            exerciseLogs: data.exercise_logs || data.exerciseLogs || {},
            cardio: data.cardio || [],
            messages: data.messages || [],
            lastResult: data.last_result || data.lastResult,
            updatedAt: data.updated_at || data.updatedAt || new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed to load dayLog:', err);
      }
    };
    loadDayLog();
    return () => {
      isMounted = false;
    };
  }, [profile.uid, todayDateStr]);

  // Persist day log to Supabase table user_day_logs
  const saveDayLog = async (updatedLog: DayLog) => {
    setDayLog(updatedLog);
    try {
      const payload = {
        user_id: profile.uid,
        log_date: todayDateStr,
        checks: updatedLog.checks,
        exercise_logs: updatedLog.exerciseLogs,
        cardio: updatedLog.cardio,
        messages: updatedLog.messages,
        last_result: updatedLog.lastResult,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('user_day_logs')
        .upsert(payload);
    } catch (err) {
      console.error('Failed to save dayLog to Supabase:', err);
    }
  };

  // Toggle exercise checkbox
  const toggleCheck = (exerciseId: string, prescribed: string) => {
    const isNowChecked = !dayLog.checks[exerciseId];
    const updatedChecks = {
      ...dayLog.checks,
      [exerciseId]: isNowChecked,
    };

    const updatedLogs = { ...(dayLog.exerciseLogs || {}) };
    if (isNowChecked && !updatedLogs[exerciseId]) {
      const parsed = parseSetsReps(prescribed);
      updatedLogs[exerciseId] = {
        sets: parsed.sets,
        reps: parsed.reps,
        prescribed,
      };
    }

    saveDayLog({
      ...dayLog,
      checks: updatedChecks,
      exerciseLogs: updatedLogs,
      updatedAt: new Date().toISOString(),
    });
  };

  // Update sets/reps for a specific exercise
  const updateExerciseLog = (exerciseId: string, prescribed: string, sets: number, reps: string) => {
    const updatedLogs = {
      ...(dayLog.exerciseLogs || {}),
      [exerciseId]: {
        sets: Math.max(1, sets),
        reps: reps || '10',
        prescribed,
      },
    };

    saveDayLog({
      ...dayLog,
      exerciseLogs: updatedLogs,
      updatedAt: new Date().toISOString(),
    });
  };

  // Cardio Handlers
  const handleSaveCardio = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const distNum = cardioDist ? parseFloat(cardioDist) : undefined;
    const durNum = cardioDur ? parseInt(cardioDur, 10) : undefined;

    if ((!distNum || distNum <= 0) && (!durNum || durNum <= 0)) {
      return;
    }

    const currentCardioList = dayLog.cardio || [];
    let updatedCardioList: CardioEntry[];

    if (editingCardioId) {
      updatedCardioList = currentCardioList.map((item) =>
        item.id === editingCardioId
          ? {
              ...item,
              type: cardioType,
              distanceKm: distNum && distNum > 0 ? distNum : undefined,
              durationMins: durNum && durNum > 0 ? durNum : undefined,
              notes: cardioNotes.trim() || undefined,
            }
          : item
      );
      setEditingCardioId(null);
    } else {
      const newEntry: CardioEntry = {
        id: `cardio_${Date.now()}`,
        type: cardioType,
        distanceKm: distNum && distNum > 0 ? distNum : undefined,
        durationMins: durNum && durNum > 0 ? durNum : undefined,
        notes: cardioNotes.trim() || undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      updatedCardioList = [...currentCardioList, newEntry];
    }

    saveDayLog({
      ...dayLog,
      cardio: updatedCardioList,
      updatedAt: new Date().toISOString(),
    });

    // Reset Form
    setCardioDist('');
    setCardioDur('');
    setCardioNotes('');
  };

  const handleDeleteCardio = (id: string) => {
    const updatedCardioList = (dayLog.cardio || []).filter((item) => item.id !== id);
    if (editingCardioId === id) {
      setEditingCardioId(null);
      setCardioDist('');
      setCardioDur('');
      setCardioNotes('');
    }
    saveDayLog({
      ...dayLog,
      cardio: updatedCardioList,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleStartEditCardio = (entry: CardioEntry) => {
    setEditingCardioId(entry.id);
    setCardioType(entry.type);
    setCardioDist(entry.distanceKm ? String(entry.distanceKm) : '');
    setCardioDur(entry.durationMins ? String(entry.durationMins) : '');
    setCardioNotes(entry.notes || '');
  };

  const handleCancelEditCardio = () => {
    setEditingCardioId(null);
    setCardioDist('');
    setCardioDur('');
    setCardioNotes('');
  };

  // Compute Workout Calorie Burn based on ACTUAL logged sets & reps for completed exercises
  const computeWorkoutBurn = (): number => {
    let totalBurn = 0;
    if (!activePlanDay || !activePlanDay.exercises) return 0;

    for (const ex of activePlanDay.exercises) {
      if (dayLog.checks[ex.id]) {
        const logged = dayLog.exerciseLogs?.[ex.id] || {
          ...parseSetsReps(ex.setsReps),
          prescribed: ex.setsReps,
        };
        const setsNum = Number(logged.sets) || 3;
        const repsNum = parseInt(String(logged.reps).split('-')[0].replace(/\D/g, ''), 10) || 10;
        const exBurn = Math.round(setsNum * (10 + repsNum * 0.5));
        totalBurn += exBurn;
      }
    }
    return totalBurn;
  };

  const workoutBurn = computeWorkoutBurn();
  const cardioBurn = computeTotalCardioBurn(dayLog.cardio);
  const baselineBurn = profile.estimated_tdee || Math.round((profile.bmr || 1800) * 1.35) || 2600;
  const totalBurned = baselineBurn + workoutBurn + cardioBurn;

  const consumed = dayLog.lastResult?.estimated_calories_consumed || 0;
  const target = profile.target_calories || 2500;
  const pct = Math.min(100, Math.round((consumed / target) * 100));

  // Net arithmetic calculation
  const netDiff = totalBurned - consumed; // Positive = Deficit, Negative = Surplus
  const isDeficit = netDiff >= 0;

  let targetFormatted = '';
  if (profile.goal === 'fat_loss') {
    const targetDeficit = Math.max(0, baselineBurn - target) || 500;
    targetFormatted = `target: ${targetDeficit} deficit`;
  } else {
    const targetSurplus = Math.max(0, target - baselineBurn) || 300;
    targetFormatted = `target: ${targetSurplus} surplus`;
  }

  const netLineText = `Burned ${totalBurned.toLocaleString()} · Ate ${consumed.toLocaleString()} · Net ${
    isDeficit ? 'deficit' : 'surplus'
  } ${Math.abs(netDiff).toLocaleString()} (${targetFormatted})`;

  const currentStatus = dayLog.lastResult?.status || 'on_track';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_track':
        return {
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-400',
          border: 'border-emerald-500/30',
          bar: 'bg-emerald-500',
          label: 'ON TRACK',
        };
      case 'under_eating':
        return {
          bg: 'bg-amber-500/10',
          text: 'text-amber-400',
          border: 'border-amber-500/30',
          bar: 'bg-amber-500',
          label: 'UNDER EATING',
        };
      case 'over_eating':
        return {
          bg: 'bg-rose-500/10',
          text: 'text-rose-400',
          border: 'border-rose-500/30',
          bar: 'bg-rose-500',
          label: 'OVER EATING',
        };
      default:
        return {
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-400',
          border: 'border-emerald-500/30',
          bar: 'bg-emerald-500',
          label: 'ON TRACK',
        };
    }
  };

  const statusStyle = getStatusColor(currentStatus);

  // AI Call #2: Direct Client-Side Coach Chat Submission with detailed exercise and cardio logs
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || chatInput.trim();
    if (!text || sendingMsg) return;

    if (!apiKey || !apiKey.trim()) {
      setChatError('No Gemini API key found. Please enter your key in Settings.');
      if (onOpenSettings) onOpenSettings();
      return;
    }

    setSendingMsg(true);
    setChatError(null);
    setDailyCapReached(false);

    // Append user message locally
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...dayLog.messages, userMsg];
    setChatInput('');

    // Format detailed workout status with actual logged sets and reps
    const workoutStatusStr = (activePlanDay.exercises || [])
      .map((ex) => {
        const isChecked = !!dayLog.checks[ex.id];
        const logged = dayLog.exerciseLogs?.[ex.id] || {
          ...parseSetsReps(ex.setsReps),
          prescribed: ex.setsReps,
        };
        const status = isChecked ? 'COMPLETED' : 'PENDING';
        return `${ex.name}: ${status} (Logged: ${logged.sets} sets x ${logged.reps} reps | Prescribed: ${ex.setsReps})`;
      })
      .join(', ');

    try {
      const data: AICoachResult = await computeCoachChatAI(apiKey, {
        profile,
        workoutStatus: workoutStatusStr,
        workoutBurn,
        cardioLogs: dayLog.cardio || [],
        cardioBurn,
        messages: updatedMessages,
        newestMessage: text,
      });

      const aiResult: AICoachResult = {
        estimated_calories_consumed: data.estimated_calories_consumed,
        estimated_calories_burned: data.estimated_calories_burned || totalBurned,
        status: data.status,
        coach_reply: data.coach_reply,
        tomorrow_suggestion: data.tomorrow_suggestion,
      };

      const coachMsg: ChatMessage = {
        id: `msg_coach_${Date.now()}`,
        role: 'coach',
        text: aiResult.coach_reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMessages = [...updatedMessages, coachMsg];
      const newLog: DayLog = {
        ...dayLog,
        messages: finalMessages,
        lastResult: aiResult,
        updatedAt: new Date().toISOString(),
      };

      await saveDayLog(newLog);
    } catch (err: any) {
      console.error('Error sending message to coach:', err);
      setChatError(err.message || 'Network error analyzing meal log. Click retry to try again.');
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#070a10] text-slate-100 p-4 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Profile Summary Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 lg:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-emerald-400">
              {profile.name ? profile.name[0].toUpperCase() : 'A'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono font-bold text-slate-100 text-sm sm:text-base">
                  {profile.name || 'Athlete'} ({profile.gender}, {profile.age}y, {profile.weight}kg)
                </h2>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  {profile.goal.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{profile.summary}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-300 flex-wrap">
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-500">BMR:</span> <span className="font-bold">{profile.bmr}</span> kcal
            </div>
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-500">TDEE:</span> <span className="font-bold">{profile.estimated_tdee}</span> kcal
            </div>
            <div className="bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-300">
              <span className="text-emerald-500/80">TARGET:</span> <span className="font-bold">{profile.target_calories}</span> kcal
            </div>
          </div>
        </div>

        {/* CONSOLIDATED END-OF-DAY CALORIE SUMMARY CARD */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-wide">
                  DAILY ENERGY & RECOVERY SUMMARY
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Consolidated baseline expenditure, workout burn, cardio, and calorie intake.
                </p>
              </div>
            </div>

            <span className={`text-[11px] font-mono font-bold px-3 py-1 rounded-lg border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
              {statusStyle.label}
            </span>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
            {/* Total Calories Burned */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-cyan-400" /> TOTAL CALORIES BURNED
              </span>
              <div className="mt-2">
                <span className="text-2xl font-black text-slate-100">{totalBurned.toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-normal"> kcal</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Base {baselineBurn.toLocaleString()} + Strength {workoutBurn.toLocaleString()} + Cardio {cardioBurn.toLocaleString()}
              </p>
            </div>

            {/* Calories Consumed */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" /> CALORIES CONSUMED
              </span>
              <div className="mt-2">
                <span className="text-2xl font-black text-slate-100">{consumed.toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-normal"> / {target} kcal</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                From food log estimations
              </p>
            </div>

            {/* Net Calorie Balance */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> NET BALANCE
              </span>
              <div className="mt-2">
                <span className={`text-2xl font-black ${isDeficit ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isDeficit ? '-' : '+'}{Math.abs(netDiff).toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 font-normal"> kcal</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {isDeficit ? 'Net Deficit' : 'Net Surplus'}
              </p>
            </div>
          </div>

          {/* Consolidated Arithmetic Net Line */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl text-xs font-mono text-emerald-300 font-bold flex flex-wrap items-center justify-between gap-2">
            <span>{netLineText}</span>
            {(workoutBurn > 0 || cardioBurn > 0) && (
              <span className="text-[11px] text-emerald-400/80 font-normal">
                Strength: ~{workoutBurn} kcal · Cardio: ~{cardioBurn} kcal
              </span>
            )}
          </div>

          {/* Status + Tomorrow's Suggestion */}
          {dayLog.lastResult?.tomorrow_suggestion && (
            <div className="bg-slate-950/90 border border-slate-800/80 p-3.5 rounded-xl flex items-start gap-3 text-xs">
              <Lightbulb className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-mono text-[11px] font-bold uppercase text-emerald-400 block mb-0.5">
                  TOMORROW'S COACHING CUE
                </span>
                <p className="text-slate-300 leading-relaxed font-sans">
                  {dayLog.lastResult.tomorrow_suggestion}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Three-Column / Grid Layout for Session, Cardio, and Coach Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* COLUMN 1: RESISTANCE WORKOUT SESSION (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              {/* Header with Rotation Navigation */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-xs">
                    D{activePlanDay.day}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-emerald-400">
                      DAY {activePlanDay.day} OF {plan.length} ROTATION
                    </span>
                    <h3 className="font-mono font-bold text-sm sm:text-base text-slate-100 uppercase">
                      {activePlanDay.focus}
                    </h3>
                  </div>
                </div>

                {/* Day Switcher */}
                <div className="flex items-center gap-1 bg-slate-950 rounded-lg p-1 border border-slate-800">
                  <button
                    onClick={() => setActiveDayIndex((prev) => (prev > 0 ? prev - 1 : plan.length - 1))}
                    className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded transition"
                    title="Previous Day"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-slate-400 px-1.5">
                    {activeDayIndex + 1}/{plan.length}
                  </span>
                  <button
                    onClick={() => setActiveDayIndex((prev) => (prev < plan.length - 1 ? prev + 1 : 0))}
                    className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded transition"
                    title="Next Day"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Exercise Checklist with Editable Sets & Reps */}
              <div className="space-y-3">
                {activePlanDay.exercises.map((ex) => {
                  const isChecked = !!dayLog.checks[ex.id];
                  const logged = dayLog.exerciseLogs?.[ex.id] || {
                    ...parseSetsReps(ex.setsReps),
                    prescribed: ex.setsReps,
                  };
                  const isEditingThis = editingExId === ex.id;

                  return (
                    <div
                      key={ex.id}
                      className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isChecked
                          ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-200'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      {/* Checkbox and Exercise Details */}
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleCheck(ex.id, ex.setsReps)}
                          className="mt-0.5 text-emerald-400 hover:text-emerald-300 transition shrink-0"
                          title={isChecked ? 'Mark pending' : 'Mark completed'}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-600" />
                          )}
                        </button>
                        <div>
                          <p className={`text-sm font-semibold font-mono ${isChecked ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                            {ex.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed font-sans">{ex.notes}</p>
                        </div>
                      </div>

                      {/* Editable Sets x Reps Control */}
                      <div className="shrink-0 flex items-center justify-end gap-2">
                        {isEditingThis ? (
                          <div
                            className="flex items-center gap-1.5 bg-slate-900 border border-emerald-500/50 p-1.5 rounded-lg text-xs font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={logged.sets}
                                onChange={(e) => {
                                  const s = parseInt(e.target.value, 10) || 1;
                                  updateExerciseLog(ex.id, ex.setsReps, s, logged.reps);
                                }}
                                className="w-10 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                              />
                              <span className="text-slate-400 font-bold">sets ×</span>
                              <input
                                type="text"
                                value={logged.reps}
                                onChange={(e) => {
                                  updateExerciseLog(ex.id, ex.setsReps, logged.sets, e.target.value);
                                }}
                                className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                              />
                              <span className="text-slate-400 font-bold">reps</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingExId(null)}
                              className="bg-emerald-500 text-slate-950 p-1 rounded hover:bg-emerald-400 transition"
                              title="Done Editing"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingExId(ex.id);
                            }}
                            className="group flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono transition"
                            title="Click to edit logged sets & reps"
                          >
                            <span className="font-bold text-emerald-400">
                              {logged.sets} sets × {logged.reps} reps
                            </span>
                            <Pencil className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition ml-0.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COLUMN 2: CARDIO & ACTIVITY LOG CARD (3 Cols) */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Bike className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-sm text-slate-100 uppercase">
                        CARDIO & ACTIVITY
                      </h3>
                      <p className="text-[11px] text-slate-400">Log cycling, running, or swimming.</p>
                    </div>
                  </div>
                  {cardioBurn > 0 && (
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      +{cardioBurn} kcal
                    </span>
                  )}
                </div>

                {/* Cardio Log Form */}
                <form onSubmit={handleSaveCardio} className="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold uppercase text-slate-400">
                      {editingCardioId ? 'Edit Cardio Entry' : 'New Cardio Entry'}
                    </span>
                    {editingCardioId && (
                      <button
                        type="button"
                        onClick={handleCancelEditCardio}
                        className="text-slate-500 hover:text-slate-300"
                        title="Cancel editing"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Activity Type Dropdown */}
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                      Activity Type
                    </label>
                    <select
                      value={cardioType}
                      onChange={(e) => setCardioType(e.target.value as CardioType)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Road Cycling">Road Cycling</option>
                      <option value="Running">Running</option>
                      <option value="Swimming">Swimming</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Distance & Duration Inputs */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                        Distance (km)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="e.g. 25"
                          value={cardioDist}
                          onChange={(e) => setCardioDist(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                        Duration (mins)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 60"
                          value={cardioDur}
                          onChange={(e) => setCardioDur(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes / Intensity Input */}
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                      Intensity / Pace Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. flat, easy pace or hilly road"
                      value={cardioNotes}
                      onChange={(e) => setCardioNotes(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-sans focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                    />
                  </div>

                  {/* Save Button */}
                  <button
                    type="submit"
                    disabled={(!cardioDist || parseFloat(cardioDist) <= 0) && (!cardioDur || parseInt(cardioDur, 10) <= 0)}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs py-2 rounded-lg transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {editingCardioId ? 'Update Cardio Entry' : 'Log Cardio Session'}
                  </button>
                </form>

                {/* Logged Cardio Entries List */}
                <div className="mt-4 space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">
                    TODAY'S LOGGED CARDIO ({dayLog.cardio?.length || 0})
                  </span>

                  {(!dayLog.cardio || dayLog.cardio.length === 0) ? (
                    <div className="bg-slate-950/50 border border-dashed border-slate-800 p-4 rounded-xl text-center text-xs font-mono text-slate-500">
                      No cardio logged yet today.
                    </div>
                  ) : (
                    dayLog.cardio.map((entry) => {
                      const entryBurn = computeCardioEntryBurn(entry);
                      return (
                        <div
                          key={entry.id}
                          className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-start justify-between gap-2 group"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-cyan-400">{entry.type}</span>
                              <span className="text-[10px] font-mono text-slate-500">· {entry.timestamp}</span>
                            </div>
                            <div className="text-xs font-mono text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                              {entry.distanceKm && <span>{entry.distanceKm} km</span>}
                              {entry.durationMins && <span>{entry.durationMins} mins</span>}
                              <span className="text-emerald-400 font-bold">~{entryBurn} kcal</span>
                            </div>
                            {entry.notes && (
                              <p className="text-[11px] text-slate-400 mt-0.5 italic">{entry.notes}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStartEditCardio(entry)}
                              className="text-slate-500 hover:text-cyan-400 p-1 rounded transition"
                              title="Edit Entry"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteCardio(entry.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 3: MEAL & RECOVERY COACH CHAT (4 Cols) */}
          <div className="lg:col-span-4 space-y-6 flex flex-col">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex-1 flex flex-col justify-between shadow-xl min-h-[520px]">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-sm text-slate-100 uppercase">
                      DAILY MEAL & RECOVERY COACH
                    </h3>
                    <p className="text-[11px] text-slate-400">Log meals naturally to sync calorie telemetry.</p>
                  </div>
                </div>
              </div>

              {/* Chat Log Window */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[380px] mb-4">
                {dayLog.messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 font-mono text-xs">
                    <Dumbbell className="w-8 h-8 text-slate-700 mb-2" />
                    <p>No meals logged for today yet.</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Type what you ate (e.g. "Had 3 eggs, 2 slices toast, coffee with milk").
                    </p>
                  </div>
                ) : (
                  dayLog.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[88%] p-3.5 rounded-2xl text-xs font-sans leading-relaxed shadow ${
                          m.role === 'user'
                            ? 'bg-emerald-500 text-slate-950 font-medium rounded-br-none'
                            : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'
                        }`}
                      >
                        {m.text}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 mt-1 px-1">{m.timestamp}</span>
                    </div>
                  ))
                )}

                {sendingMsg && (
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-slate-950 p-3 rounded-xl border border-slate-800 animate-pulse">
                    <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing intake & computing total day telemetry...</span>
                  </div>
                )}
              </div>

              {/* Error Banner / Daily Limit Banner */}
              {chatError && (
                <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-mono text-amber-300 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{chatError}</span>
                  </div>
                  {!dailyCapReached && (
                    <button
                      onClick={() => handleSendMessage()}
                      className="flex items-center gap-1 text-[11px] underline text-amber-300 hover:text-amber-100 font-bold shrink-0"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  )}
                </div>
              )}

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2 border-t border-slate-800 pt-3"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="e.g. Had 2 eggs, 1 toast, and coffee..."
                  disabled={sendingMsg || dailyCapReached}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 font-sans focus:outline-none focus:border-emerald-500 transition disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || sendingMsg || dailyCapReached}
                  className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 p-2.5 rounded-xl font-mono font-bold transition disabled:opacity-40 shrink-0"
                  title="Send to Coach"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
