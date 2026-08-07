import { GoogleGenAI, Type } from '@google/genai';
import { UserProfile, AICoachResult, OnboardingAIResult } from '../types';

export interface OnboardingParams {
  age: number;
  gender: string;
  height: number;
  weight: number;
  goal: string;
  trainingLoad?: string;
}

export interface CoachChatParams {
  profile: UserProfile;
  workoutStatus: string;
  workoutBurn: number;
  cardioLogs: any[];
  cardioBurn: number;
  messages: any[];
  newestMessage: string;
}

export function isApiKeyOrQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = (err?.message || String(err)).toLowerCase();
  const status = err?.status;
  const code = err?.code;
  return (
    msg.includes('api_key_invalid') ||
    msg.includes('api key') ||
    msg.includes('invalid key') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('not_found') ||
    msg.includes('400') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('429') ||
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 429 ||
    code === 400 ||
    code === 401 ||
    code === 403 ||
    code === 429
  );
}

export async function computeOnboardingTargetsAI(
  apiKey: string,
  params: OnboardingParams
): Promise<OnboardingAIResult> {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) {
    throw new Error('NO_API_KEY');
  }

  const ai = new GoogleGenAI({ apiKey: cleanKey });

  const systemInstruction =
    "You are a sports nutrition coach. Given a person's stats, goal, and training load, calculate their BMR (Mifflin-St Jeor equation), estimated TDEE, and a daily calorie + macro target appropriate for their goal. For fat_loss, target a moderate 15–20% deficit from TDEE. For muscle_gain, target a 10–15% surplus. Return realistic, safe numbers only.";

  const prompt = `Calculate calories & macros for this athlete:
- Age: ${params.age}
- Gender: ${params.gender}
- Height: ${params.height} cm
- Weight: ${params.weight} kg
- Primary Goal: ${params.goal} (fat_loss or muscle_gain)
- Training Schedule: ${params.trainingLoad || '5 resistance days/week on fixed rotation + daily road cycling'}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bmr: { type: Type.NUMBER, description: 'BMR in kcal' },
            estimated_tdee: { type: Type.NUMBER, description: 'Estimated TDEE in kcal' },
            target_calories: { type: Type.NUMBER, description: 'Daily target calories in kcal' },
            protein_g: { type: Type.NUMBER, description: 'Daily protein target in grams' },
            carbs_g: { type: Type.NUMBER, description: 'Daily carbs target in grams' },
            fats_g: { type: Type.NUMBER, description: 'Daily fats target in grams' },
            summary: { type: Type.STRING, description: '2-3 sentence plain-language explanation of the numbers, no jargon' },
          },
          required: ['bmr', 'estimated_tdee', 'target_calories', 'protein_g', 'carbs_g', 'fats_g', 'summary'],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Received empty response from Gemini model.');
    }

    return JSON.parse(responseText);
  } catch (err: any) {
    console.error('Onboarding Gemini Call Error:', err);
    if (isApiKeyOrQuotaError(err)) {
      throw new Error('Your Gemini API key looks invalid or has hit its limit — check it in Settings');
    }
    throw err;
  }
}

export async function computeCoachChatAI(
  apiKey: string,
  params: CoachChatParams
): Promise<AICoachResult> {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) {
    throw new Error('NO_API_KEY');
  }

  const ai = new GoogleGenAI({ apiKey: cleanKey });

  const systemInstruction =
    "You are a concise, encouraging daily coach. Given the athlete's profile, daily calorie/macro target, today's workout completion status (including actual logged sets x reps), structured cardio logs, and everything they've told you they ate today, estimate today's total calories consumed and calories burned (BMR + NEAT + calculated strength exercise burn + structured cardio burn). Judge whether they're on track for their stated goal. Reply conversationally to their latest message in 2–4 sentences, warm and direct, no fluff.";

  const formattedMessages = Array.isArray(params.messages)
    ? params.messages.map((m: any) => `${m.role === 'user' ? 'Athlete' : 'Coach'}: ${m.text}`).join('\n')
    : '';

  const baselineTdee = params.profile?.estimated_tdee || 2600;
  const computedWorkoutBurn = typeof params.workoutBurn === 'number' ? params.workoutBurn : 0;
  const computedCardioBurn = typeof params.cardioBurn === 'number' ? params.cardioBurn : 0;

  const cardioFormatted = Array.isArray(params.cardioLogs) && params.cardioLogs.length > 0
    ? params.cardioLogs.map((c: any) => `- ${c.type}: ${c.distanceKm ? c.distanceKm + ' km' : ''} ${c.durationMins ? c.durationMins + ' mins' : ''} ${c.notes ? '(' + c.notes + ')' : ''}`).join('\n')
    : 'No cardio logged today.';

  const totalSuggestedBurn = baselineTdee + computedWorkoutBurn + computedCardioBurn;

  const prompt = `Athlete Profile & Targets:
- Goal: ${params.profile?.goal || 'fat_loss'}
- Baseline TDEE (BMR + NEAT): ${baselineTdee} kcal
- Target Calories: ${params.profile?.target_calories || 2500} kcal
- Target Macros: Protein ${params.profile?.protein_g || 180}g, Carbs ${params.profile?.carbs_g || 250}g, Fats ${params.profile?.fats_g || 70}g

Today's Resistance Workout Completion Status & Actual Logged Sets/Reps:
${params.workoutStatus || 'No exercises logged yet today.'}
- Calculated Strength Burn: ${computedWorkoutBurn} kcal

Today's Cardio Activity Logged:
${cardioFormatted}
- Calculated Cardio Burn: ${computedCardioBurn} kcal

Calculated Total Day Burn (Baseline + Strength + Cardio): ${totalSuggestedBurn} kcal

All Food & Chat Logs Logged Today So Far:
${formattedMessages}

Athlete's Newest Message:
"${params.newestMessage}"

Evaluate today's cumulative intake and burn based on all logs above. Make sure estimated_calories_burned reflects the athlete's baseline plus the actual workout burn and cardio burn (${totalSuggestedBurn} kcal total). Respond appropriately.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimated_calories_consumed: {
              type: Type.NUMBER,
              description: 'Total estimated calories consumed today based on all messages',
            },
            estimated_calories_burned: {
              type: Type.NUMBER,
              description: 'Total estimated calories burned today including BMR + NEAT + workout + cycling',
            },
            status: {
              type: Type.STRING,
              enum: ['on_track', 'under_eating', 'over_eating'],
              description: "Status relative to daily target calories and athlete's goal",
            },
            coach_reply: {
              type: Type.STRING,
              description: 'Conversational reply in 2-4 sentences, warm and direct, no fluff',
            },
            tomorrow_suggestion: {
              type: Type.STRING,
              description: 'Concise 1-2 sentence actionable tip for tomorrow',
            },
          },
          required: [
            'estimated_calories_consumed',
            'estimated_calories_burned',
            'status',
            'coach_reply',
            'tomorrow_suggestion',
          ],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Received empty response from Gemini coach.');
    }

    return JSON.parse(responseText);
  } catch (err: any) {
    console.error('Coach Gemini Call Error:', err);
    if (isApiKeyOrQuotaError(err)) {
      throw new Error('Your Gemini API key looks invalid or has hit its limit — check it in Settings');
    }
    throw err;
  }
}
