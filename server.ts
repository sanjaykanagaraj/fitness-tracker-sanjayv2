import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fhpkmzjxeseneetuoitg.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_5TNNqSBqlZBHUkjM4YsPXQ_nK2F080r';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory usage tracker per user & date for daily cap (max 50 calls/day)
// Key: `${userId}_${dateStr}` -> count
const usageMap = new Map<string, number>();

function getDailyUsage(userId: string): number {
  const dateStr = new Date().toISOString().split('T')[0];
  const key = `${userId}_${dateStr}`;
  return usageMap.get(key) || 0;
}

function incrementDailyUsage(userId: string): number {
  const dateStr = new Date().toISOString().split('T')[0];
  const key = `${userId}_${dateStr}`;
  const current = usageMap.get(key) || 0;
  const updated = current + 1;
  usageMap.set(key, updated);
  return updated;
}

// Lazy Gemini API client initializer
function getGenAIClient(providedApiKey?: string) {
  const apiKey = providedApiKey || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('No Gemini API key provided. Please configure your key in settings.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Check if an email is invited/allowlisted (Server-side check via Supabase)
app.post('/api/check-invite', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ invited: false, message: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ invited: false, message: 'Email is required.' });
    }

    const { data, error } = await supabase
      .from('allowed_users')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error) {
      console.error('Supabase query error in check-invite:', error);
    }

    let isInvited = false;
    if (data) {
      isInvited = data.allowed === true;
    } else if (cleanEmail === 'sanjaykanagaraj106@gmail.com' || cleanEmail === 'sanjaykanagaraj842@gmail.com') {
      isInvited = true;
    }

    return res.json({ invited: isInvited });
  } catch (err: any) {
    console.error('Error in /api/check-invite:', err);
    return res.json({ invited: false, message: 'Failed to verify invitation status.' });
  }
});

// AI Call #1: Onboarding Targets Calculation
app.post('/api/ai/onboarding', async (req, res) => {
  try {
    const { age, gender, height, weight, goal, trainingLoad } = req.body;

    if (!age || !gender || !height || !weight || !goal) {
      return res.status(400).json({ error: 'Missing required onboarding parameters.' });
    }

    const ai = getGenAIClient();

    const systemInstruction =
      "You are a sports nutrition coach. Given a person's stats, goal, and training load, calculate their BMR (Mifflin-St Jeor equation), estimated TDEE, and a daily calorie + macro target appropriate for their goal. For fat_loss, target a moderate 15–20% deficit from TDEE. For muscle_gain, target a 10–15% surplus. Return realistic, safe numbers only.";

    const prompt = `Calculate calories & macros for this athlete:
- Age: ${age}
- Gender: ${gender}
- Height: ${height} cm
- Weight: ${weight} kg
- Primary Goal: ${goal} (fat_loss or muscle_gain)
- Training Schedule: ${trainingLoad || '5 resistance days/week on fixed rotation + daily road cycling'}`;

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

    const result = JSON.parse(responseText);
    return res.json(result);
  } catch (err: any) {
    console.error('Error in /api/ai/onboarding:', err);
    return res.status(500).json({
      error: 'ai_failure',
      message: err.message || 'Failed to compute nutrition plan. Please try again.',
    });
  }
});

// AI Call #2: Daily Coach Chat
app.post('/api/ai/coach-chat', async (req, res) => {
  try {
    const { userId, profile, workoutStatus, workoutBurn, cardioLogs, cardioBurn, messages, newestMessage } = req.body;

    const effectiveUserId = userId || 'anonymous_user';

    // Daily Cap Check (max 50 calls per user per day)
    const currentUsage = getDailyUsage(effectiveUserId);
    if (currentUsage >= 50) {
      return res.status(429).json({
        error: 'daily_limit_reached',
        message: "You've reached your daily limit of 50 coach messages for today. Come back tomorrow!",
      });
    }

    const ai = getGenAIClient();

    const systemInstruction =
      "You are a concise, encouraging daily coach. Given the athlete's profile, daily calorie/macro target, today's workout completion status (including actual logged sets x reps), structured cardio logs, and everything they've told you they ate today, estimate today's total calories consumed and calories burned (BMR + NEAT + calculated strength exercise burn + structured cardio burn). Judge whether they're on track for their stated goal. Reply conversationally to their latest message in 2–4 sentences, warm and direct, no fluff.";

    const formattedMessages = Array.isArray(messages)
      ? messages.map((m: any) => `${m.role === 'user' ? 'Athlete' : 'Coach'}: ${m.text}`).join('\n')
      : '';

    const baselineTdee = profile?.estimated_tdee || 2600;
    const computedWorkoutBurn = typeof workoutBurn === 'number' ? workoutBurn : 0;
    const computedCardioBurn = typeof cardioBurn === 'number' ? cardioBurn : 0;

    const cardioFormatted = Array.isArray(cardioLogs) && cardioLogs.length > 0
      ? cardioLogs.map((c: any) => `- ${c.type}: ${c.distanceKm ? c.distanceKm + ' km' : ''} ${c.durationMins ? c.durationMins + ' mins' : ''} ${c.notes ? '(' + c.notes + ')' : ''}`).join('\n')
      : 'No cardio logged today.';

    const totalSuggestedBurn = baselineTdee + computedWorkoutBurn + computedCardioBurn;

    const prompt = `Athlete Profile & Targets:
- Goal: ${profile?.goal || 'fat_loss'}
- Baseline TDEE (BMR + NEAT): ${baselineTdee} kcal
- Target Calories: ${profile?.target_calories || 2500} kcal
- Target Macros: Protein ${profile?.protein_g || 180}g, Carbs ${profile?.carbs_g || 250}g, Fats ${profile?.fats_g || 70}g

Today's Resistance Workout Completion Status & Actual Logged Sets/Reps:
${workoutStatus || 'No exercises logged yet today.'}
- Calculated Strength Burn: ${computedWorkoutBurn} kcal

Today's Cardio Activity Logged:
${cardioFormatted}
- Calculated Cardio Burn: ${computedCardioBurn} kcal

Calculated Total Day Burn (Baseline + Strength + Cardio): ${totalSuggestedBurn} kcal

All Food & Chat Logs Logged Today So Far:
${formattedMessages}

Athlete's Newest Message:
"${newestMessage}"

Evaluate today's cumulative intake and burn based on all logs above. Make sure estimated_calories_burned reflects the athlete's baseline plus the actual workout burn and cardio burn (${totalSuggestedBurn} kcal total). Respond appropriately.`;

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

    // Increment count on successful AI response
    incrementDailyUsage(effectiveUserId);

    const result = JSON.parse(responseText);
    return res.json({
      ...result,
      remainingCallsToday: 50 - getDailyUsage(effectiveUserId),
    });
  } catch (err: any) {
    console.error('Error in /api/ai/coach-chat:', err);
    return res.status(500).json({
      error: 'ai_failure',
      message: err.message || 'Failed to get coach response. Please try again.',
    });
  }
});

// Start Server with Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[THRESHOLD] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
