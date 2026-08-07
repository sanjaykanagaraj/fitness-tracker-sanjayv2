export type Goal = 'fat_loss' | 'muscle_gain';

export interface Exercise {
  id: string;
  name: string;
  setsReps: string;
  notes: string;
}

export interface PlanDay {
  day: number;
  focus: string;
  exercises: Exercise[];
}

export type WorkoutPlan = PlanDay[];

export interface UserProfile {
  uid: string;
  name?: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height: number; // cm
  weight: number; // kg
  goal: Goal;
  createdAt: string; // ISO string
  bmr: number;
  estimated_tdee: number;
  target_calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  timestamp: string;
}

export interface AICoachResult {
  estimated_calories_consumed: number;
  estimated_calories_burned: number;
  status: 'on_track' | 'under_eating' | 'over_eating';
  coach_reply: string;
  tomorrow_suggestion: string;
}

export interface LoggedExercise {
  sets: number;
  reps: string;
  prescribed: string;
}

export type CardioType = 'Road Cycling' | 'Running' | 'Swimming' | 'Other';

export interface CardioEntry {
  id: string;
  type: CardioType;
  distanceKm?: number;
  durationMins?: number;
  notes?: string;
  timestamp: string;
}

export interface DayLog {
  date: string; // YYYY-MM-DD
  checks: Record<string, boolean>; // exerciseId -> boolean
  exerciseLogs?: Record<string, LoggedExercise>; // exerciseId -> LoggedExercise
  cardio?: CardioEntry[];
  messages: ChatMessage[];
  lastResult?: AICoachResult;
  updatedAt: string;
}

export interface OnboardingAIResult {
  bmr: number;
  estimated_tdee: number;
  target_calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  summary: string;
}
