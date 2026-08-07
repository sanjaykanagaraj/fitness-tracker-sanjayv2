import React, { useState } from 'react';
import { Goal, UserProfile, WorkoutPlan, OnboardingAIResult } from '../types';
import { extractSheetData, buildPlanFromMapping, SheetExtractionResult, ParseResult, ColumnMapping } from '../lib/planParser';
import { ColumnMappingModal } from './ColumnMappingModal';
import { computeOnboardingTargetsAI } from '../lib/gemini';
import { Upload, FileSpreadsheet, AlertCircle, ArrowRight, CheckCircle2, ShieldAlert, Settings2, Key } from 'lucide-react';

interface OnboardingScreenProps {
  userId: string;
  apiKey: string;
  onComplete: (profile: UserProfile, plan: WorkoutPlan) => Promise<void>;
  onOpenSettings?: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ userId, apiKey, onComplete, onOpenSettings }) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | ''>(28);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [height, setHeight] = useState<number | ''>(178);
  const [weight, setWeight] = useState<number | ''>(78);
  const [goal, setGoal] = useState<Goal>('fat_loss');

  // Workout sheet upload & mapping state
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<SheetExtractionResult | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [sheetParseStatus, setSheetParseStatus] = useState<ParseResult | null>(null);

  // Form errors and submission state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSheetFile(file);
    const result = await extractSheetData(file);
    setExtraction(result);

    if (result.isError) {
      setSheetParseStatus({
        plan: [],
        isFallback: true,
        message: result.errorMessage || 'Failed to read sheet format.'
      });
    } else {
      setShowMappingModal(true);
    }
  };

  const handleMappingConfirm = (result: ParseResult, _mapping: ColumnMapping) => {
    setSheetParseStatus(result);
    setShowMappingModal(false);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!age || Number(age) < 14 || Number(age) > 100) {
      newErrors.age = 'Enter a valid age between 14 and 100.';
    }
    if (!height || Number(height) < 100 || Number(height) > 250) {
      newErrors.height = 'Enter a valid height between 100 and 250 cm.';
    }
    if (!weight || Number(weight) < 30 || Number(weight) > 250) {
      newErrors.weight = 'Enter a valid weight between 30 and 250 kg.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!apiKey || !apiKey.trim()) {
      setServerError('No Gemini API key provided. Please add your key in settings first.');
      if (onOpenSettings) onOpenSettings();
      return;
    }

    setLoading(true);
    setServerError(null);

    const trainingLoad = '5 resistance lifting days/week on fixed rotation + daily outdoor road cycling';

    try {
      // AI Call #1: Direct Client-Side Onboarding Calculation using user's Gemini API key
      const aiResult: OnboardingAIResult = await computeOnboardingTargetsAI(apiKey, {
        age: Number(age),
        gender,
        height: Number(height),
        weight: Number(weight),
        goal,
        trainingLoad,
      });

      const profile: UserProfile = {
        uid: userId,
        name: name.trim() || undefined,
        age: Number(age),
        gender,
        height: Number(height),
        weight: Number(weight),
        goal,
        createdAt: new Date().toISOString(),
        bmr: aiResult.bmr,
        estimated_tdee: aiResult.estimated_tdee,
        target_calories: aiResult.target_calories,
        protein_g: aiResult.protein_g,
        carbs_g: aiResult.carbs_g,
        fats_g: aiResult.fats_g,
        summary: aiResult.summary,
      };

      // Determine final plan
      let finalPlan: WorkoutPlan;
      if (sheetParseStatus && sheetParseStatus.plan && sheetParseStatus.plan.length > 0) {
        finalPlan = sheetParseStatus.plan;
      } else {
        const dummyFile = new File([], 'dummy.csv');
        const fallbackExtraction = await extractSheetData(dummyFile);
        const fallbackResult = buildPlanFromMapping(fallbackExtraction.rawData, fallbackExtraction.suggestedMapping);
        finalPlan = fallbackResult.plan;
      }

      await onComplete(profile, finalPlan);
    } catch (err: any) {
      console.error('Onboarding Error:', err);
      setServerError(err.message || 'Failed to generate target profile. Please check your Gemini API key and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-100 py-10 px-4 font-sans flex items-center justify-center relative">
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Column Mapping Popup Modal */}
      {showMappingModal && extraction && !extraction.isError && (
        <ColumnMappingModal
          extraction={extraction}
          onConfirm={handleMappingConfirm}
          onCancel={() => setShowMappingModal(false)}
        />
      )}

      <div className="max-w-2xl w-full bg-[#121214] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 backdrop-blur-sm">
        {/* Step Indicator / Header */}
        <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-[#FF4D00]/10 border border-[#FF4D00]/30 flex items-center justify-center text-[#FF4D00] font-mono font-black text-lg">
            01
          </div>
          <div>
            <h2 className="text-xl font-black font-mono tracking-tight text-white uppercase italic">
              ATHLETE TELEMETRY ONBOARDING
            </h2>
            <p className="text-xs text-zinc-400">
              Calculate baseline BMR, TDEE & macro targets for 5-day lifting + daily cycling.
            </p>
          </div>
        </div>

        {serverError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Initialization Error</p>
                <p className="mt-0.5">{serverError}</p>
              </div>
            </div>
            <button
              onClick={() => setServerError(null)}
              className="text-xs underline text-rose-400 hover:text-rose-200"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Athlete Name & Gender Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-300 uppercase mb-1.5 font-bold">
                Athlete Name <span className="text-zinc-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF4D00] transition font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-zinc-300 uppercase mb-1.5 font-bold">Gender</label>
              <div className="grid grid-cols-3 gap-2">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`py-2 px-2 text-xs font-mono font-bold rounded-xl border capitalize transition ${
                      gender === g
                        ? 'bg-[#00FFD1]/10 border-[#00FFD1] text-[#00FFD1]'
                        : 'bg-[#0A0A0B] border-white/10 text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Age, Height, Weight Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-300 uppercase mb-1.5 font-bold">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="28"
                className={`w-full bg-[#0A0A0B] border rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none transition ${
                  errors.age ? 'border-rose-500' : 'border-white/10 focus:border-[#FF4D00]'
                }`}
              />
              {errors.age && <p className="text-[11px] text-rose-400 mt-1 font-mono">{errors.age}</p>}
            </div>

            <div>
              <label className="block text-xs font-mono text-zinc-300 uppercase mb-1.5 font-bold">Height (cm)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="178"
                className={`w-full bg-[#0A0A0B] border rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none transition ${
                  errors.height ? 'border-rose-500' : 'border-white/10 focus:border-[#FF4D00]'
                }`}
              />
              {errors.height && <p className="text-[11px] text-rose-400 mt-1 font-mono">{errors.height}</p>}
            </div>

            <div>
              <label className="block text-xs font-mono text-zinc-300 uppercase mb-1.5 font-bold">Weight (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="78"
                className={`w-full bg-[#0A0A0B] border rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none transition ${
                  errors.weight ? 'border-rose-500' : 'border-white/10 focus:border-[#FF4D00]'
                }`}
              />
              {errors.weight && <p className="text-[11px] text-rose-400 mt-1 font-mono">{errors.weight}</p>}
            </div>
          </div>

          {/* Primary Goal Selection */}
          <div>
            <label className="block text-xs font-mono text-zinc-300 uppercase mb-2 font-bold">Primary Goal</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGoal('fat_loss')}
                className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
                  goal === 'fat_loss'
                    ? 'bg-[#FF4D00]/10 border-[#FF4D00] text-white shadow-[0_0_15px_rgba(255,77,0,0.15)]'
                    : 'bg-[#0A0A0B] border-white/10 text-zinc-400 hover:border-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    goal === 'fat_loss' ? 'border-[#FF4D00] bg-[#FF4D00]' : 'border-zinc-600'
                  }`}
                >
                  {goal === 'fat_loss' && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                </div>
                <div>
                  <p className="text-sm font-bold font-mono text-white uppercase">Fat Loss (Cut)</p>
                  <p className="text-xs text-zinc-400 mt-0.5">15–20% TDEE deficit preserving muscle power.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setGoal('muscle_gain')}
                className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
                  goal === 'muscle_gain'
                    ? 'bg-[#FF4D00]/10 border-[#FF4D00] text-white shadow-[0_0_15px_rgba(255,77,0,0.15)]'
                    : 'bg-[#0A0A0B] border-white/10 text-zinc-400 hover:border-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    goal === 'muscle_gain' ? 'border-[#FF4D00] bg-[#FF4D00]' : 'border-zinc-600'
                  }`}
                >
                  {goal === 'muscle_gain' && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                </div>
                <div>
                  <p className="text-sm font-bold font-mono text-white uppercase">Muscle Gain (Surplus)</p>
                  <p className="text-xs text-zinc-400 mt-0.5">10–15% TDEE surplus fueling hypertrophy & recovery.</p>
                </div>
              </button>
            </div>
          </div>

          {/* Workout Sheet Upload (.xlsx or .csv) */}
          <div className="bg-[#0A0A0B] p-4 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono text-zinc-300 uppercase font-bold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#00FFD1]" />
                <span>Workout Sheet Upload (.xlsx or .csv)</span>
              </label>
              <span className="text-[11px] font-mono text-zinc-500">Optional</span>
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              Upload custom spreadsheet. Any column names work — you can map custom headers via popup!
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="workout-sheet-upload"
                />
                <label
                  htmlFor="workout-sheet-upload"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border border-dashed border-white/20 bg-zinc-900/60 hover:bg-zinc-800 hover:border-white/30 text-zinc-300 text-xs font-mono cursor-pointer transition"
                >
                  <Upload className="w-4 h-4 text-[#FF4D00]" />
                  <span className="truncate">{sheetFile ? sheetFile.name : 'Click to select .xlsx or .csv file'}</span>
                </label>
              </div>

              {extraction && !extraction.isError && (
                <button
                  type="button"
                  onClick={() => setShowMappingModal(true)}
                  className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-[#00FFD1]/30 bg-[#00FFD1]/10 hover:bg-[#00FFD1]/20 text-[#00FFD1] text-xs font-mono font-bold transition shrink-0"
                >
                  <Settings2 className="w-4 h-4" />
                  <span>Map Columns</span>
                </button>
              )}
            </div>

            {sheetParseStatus && (
              <div
                className={`mt-3 p-3 rounded-lg border text-xs font-mono flex items-start gap-2.5 ${
                  sheetParseStatus.isFallback
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-[#00FFD1]/10 border-[#00FFD1]/30 text-[#00FFD1]'
                }`}
              >
                {sheetParseStatus.isFallback ? (
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#00FFD1] shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{sheetParseStatus.message}</p>
                  {sheetParseStatus.isFallback && (
                    <p className="text-[11px] opacity-80 mt-1">
                      Defaulting to Threshold's built-in 5-Day Machine & Cable Rotation Split.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF4D00] hover:bg-[#ff6622] active:bg-[#e04400] text-black font-mono font-black text-sm py-3.5 px-6 rounded-xl shadow-lg shadow-[#FF4D00]/20 transition flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-wide"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>COMPUTING BMR & TDEE TARGETS (GEMINI 3.6)...</span>
              </div>
            ) : (
              <>
                <span>INITIALIZE COACHING PROFILE & DASHBOARD</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

