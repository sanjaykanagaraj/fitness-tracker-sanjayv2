import * as XLSX from 'xlsx';
import { WorkoutPlan, PlanDay, Exercise } from '../types';

export const DEFAULT_WORKOUT_PLAN: WorkoutPlan = [
  {
    day: 1,
    focus: 'Upper Power',
    exercises: [
      { id: 'ex_1_1', name: 'Chest Press Machine', setsReps: '4 x 6-8', notes: 'Heavy loaded drive, explosive concentric, controlled 3s eccentric.' },
      { id: 'ex_1_2', name: 'Cable Chest-Supported Row', setsReps: '4 x 6-8', notes: 'Squeeze scapulae hard at peak contraction, pause for 1s.' },
      { id: 'ex_1_3', name: 'Seated Shoulder Press Machine', setsReps: '3 x 8-10', notes: 'Keep elbows slightly tucked 45°, full vertical lockout.' },
      { id: 'ex_1_4', name: 'Lat Pulldown Machine (Wide Grip)', setsReps: '3 x 8-10', notes: 'Pull chest up to bar, drive elbows straight down into hips.' },
      { id: 'ex_1_5', name: 'Heavy Cable Tricep Overhead Extension', setsReps: '3 x 10-12', notes: 'Full deep stretch behind head at bottom position.' }
    ]
  },
  {
    day: 2,
    focus: 'Lower Power',
    exercises: [
      { id: 'ex_2_1', name: '45-Degree Leg Press Machine', setsReps: '4 x 8-10', notes: 'Feet shoulder-width on middle pad, full knee extension without locking out.' },
      { id: 'ex_2_2', name: 'Hack Squat Machine', setsReps: '4 x 6-8', notes: 'Deep squat depth below parallel, stay braced through heels.' },
      { id: 'ex_2_3', name: 'Seated Hamstring Leg Curl', setsReps: '4 x 10-12', notes: 'Slow 3s eccentric cadence, squeeze hamstrings hard at bottom.' },
      { id: 'ex_2_4', name: 'Standing Calf Raise Machine', setsReps: '4 x 12-15', notes: '2s pause at bottom stretch position before exploding up.' },
      { id: 'ex_2_5', name: 'Cable Woodchoppers (Core Rotational)', setsReps: '3 x 12/side', notes: 'Maintain locked arms and pivot hips for explosive oblique drive.' }
    ]
  },
  {
    day: 3,
    focus: 'Push Density',
    exercises: [
      { id: 'ex_3_1', name: 'Incline Chest Press Machine', setsReps: '4 x 10-12', notes: 'Focus upper chest burn, strict 60s rest intervals.' },
      { id: 'ex_3_2', name: 'Pec Fly / Rear Delt Machine (Fly)', setsReps: '3 x 12-15', notes: 'Slight bend in elbows, peak contraction squeeze.' },
      { id: 'ex_3_3', name: 'Lateral Raise Machine', setsReps: '4 x 12-15', notes: 'Constant cable/machine tension, pause at top line.' },
      { id: 'ex_3_4', name: 'Cable Low-to-High Chest Fly', setsReps: '3 x 12-15', notes: 'Crossing hands over at top position for maximum upper inner chest load.' },
      { id: 'ex_3_5', name: 'Cable Rope Tricep Pushdown', setsReps: '4 x 12-15', notes: 'Spread rope handles apart at bottom lockout.' }
    ]
  },
  {
    day: 4,
    focus: 'Pull Density',
    exercises: [
      { id: 'ex_4_1', name: 'High Cable Seated Row (Neutral Grip)', setsReps: '4 x 10-12', notes: 'Lean back slightly on drive, squeeze upper lats.' },
      { id: 'ex_4_2', name: 'Neutral Grip Lat Pulldown Machine', setsReps: '4 x 10-12', notes: 'Full lat stretch overhead, smooth continuous rhythm.' },
      { id: 'ex_4_3', name: 'Pec Fly Machine (Rear Delt Fly)', setsReps: '4 x 15', notes: 'Lead movement with elbows, isolate rear deltoids.' },
      { id: 'ex_4_4', name: 'Standing Cable Bicep Curl (Straight Bar)', setsReps: '4 x 10-12', notes: 'Keep upper arms glued to torso, strict form.' },
      { id: 'ex_4_5', name: 'Cable Rope Hammer Curl', setsReps: '3 x 12-15', notes: 'Targets brachialis and forearm flexors for thickness.' }
    ]
  },
  {
    day: 5,
    focus: 'Legs & Core',
    exercises: [
      { id: 'ex_5_1', name: 'Machine Belt Squat / V-Squat', setsReps: '4 x 10-12', notes: 'Constant tension on quads, upright torso.' },
      { id: 'ex_5_2', name: 'Lying Hamstring Leg Curl Machine', setsReps: '4 x 10-12', notes: 'Keep hips pressed firmly against bench pad.' },
      { id: 'ex_5_3', name: 'Leg Extension Machine', setsReps: '4 x 12-15', notes: '1s hold at full knee extension, strict controlled return.' },
      { id: 'ex_5_4', name: 'Seated Machine Ab Crunch', setsReps: '4 x 15-20', notes: 'Exhale fully as you curl ribcage toward pelvis.' },
      { id: 'ex_5_5', name: 'Kneeling Cable Rope Ab Crunch', setsReps: '3 x 15-20', notes: 'Flex spine at waist line rather than pulling with arms.' }
    ]
  }
];

export interface ParseResult {
  plan: WorkoutPlan;
  isFallback: boolean;
  message?: string;
}

export async function parseWorkoutSheet(file: File): Promise<ParseResult> {
  const extracted = await extractSheetData(file);
  if (extracted.isError || !extracted.rawData.length) {
    return {
      plan: DEFAULT_WORKOUT_PLAN,
      isFallback: true,
      message: extracted.errorMessage || 'Failed to parse file. Using default 5-day rotation.'
    };
  }
  return buildPlanFromMapping(extracted.rawData, extracted.suggestedMapping);
}

export interface ColumnMapping {
  dayKey: string;
  focusKey: string;
  exerciseKey: string;
  setsRepsKey: string; // Combined sets x reps column
  setsKey: string;     // Separate Sets column
  repsKey: string;     // Separate Reps column
  notesKey: string;
}

export interface SheetExtractionResult {
  fileName: string;
  headers: string[];
  rawData: Record<string, any>[];
  suggestedMapping: ColumnMapping;
  isError?: boolean;
  errorMessage?: string;
}

// 1. Normalize headers: trim, lowercase, strip punctuation/underscores/spaces
export function normalizeHeader(str: string): string {
  if (!str) return '';
  return String(str).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// 2. Synonyms for each field
const SYNONYMS: Record<string, string[]> = {
  day: ['day', 'day#', 'dayno', 'daynum', 'daynumber', 'workoutday', 'session', 'sessionday', 'rotation', 'splitday', 'dayid'],
  focus: ['focus', 'musclegroup', 'target', 'bodypart', 'theme', 'category', 'split', 'focusarea', 'dayfocus', 'targetmuscle'],
  exercise: ['exercise', 'exercisename', 'movement', 'lift', 'activity', 'name', 'title', 'action', 'exercisetitle'],
  setsReps: ['setsxreps', 'setsreps', 'setreps', 'setsrepsformat', 'volume', 'targetsetsreps'],
  sets: ['sets', 'set', 'numsets', 'targetsets', 'noofsets', 'numberofsets'],
  reps: ['reps', 'rep', 'numreps', 'targetreps', 'repcount', 'repetition', 'repetitions'],
  notes: ['notes', 'cue', 'tip', 'coachingcue', 'instructions', 'comment', 'comments', 'coachingnotes', 'tempo', 'remark', 'remarks']
};

// 3. Fuzzy matching via Levenshtein Distance
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function calcSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}

function findBestMatchingHeader(headers: string[], category: string): { header: string; score: number } {
  const synonyms = SYNONYMS[category] || [];
  let bestHeader = '';
  let maxScore = 0;

  for (const rawHeader of headers) {
    const norm = normalizeHeader(rawHeader);
    if (!norm) continue;

    for (const syn of synonyms) {
      if (norm === syn) {
        return { header: rawHeader, score: 1.0 }; // Exact match!
      }
      const sim = calcSimilarity(norm, syn);
      if (sim > maxScore) {
        maxScore = sim;
        bestHeader = rawHeader;
      }
    }
  }

  if (maxScore >= 0.60) {
    return { header: bestHeader, score: maxScore };
  }

  return { header: '', score: 0 };
}

export async function extractSheetData(file: File): Promise<SheetExtractionResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook.SheetNames.length) {
      return {
        fileName: file.name,
        headers: [],
        rawData: [],
        suggestedMapping: { dayKey: '', focusKey: '', exerciseKey: '', setsRepsKey: '', setsKey: '', repsKey: '', notesKey: '' },
        isError: true,
        errorMessage: 'No sheets found in uploaded file.'
      };
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    // 4. Header Row Detection: Scan first 10 rows to find row with most field matches
    const sheetMatrix = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });

    if (!sheetMatrix || !sheetMatrix.length) {
      return {
        fileName: file.name,
        headers: [],
        rawData: [],
        suggestedMapping: { dayKey: '', focusKey: '', exerciseKey: '', setsRepsKey: '', setsKey: '', repsKey: '', notesKey: '' },
        isError: true,
        errorMessage: 'Uploaded spreadsheet is completely empty.'
      };
    }

    let bestRowIndex = 0;
    let maxMatchCount = 0;
    const maxScanRows = Math.min(sheetMatrix.length, 10);

    for (let r = 0; r < maxScanRows; r++) {
      const rowCells = sheetMatrix[r];
      if (!Array.isArray(rowCells) || rowCells.length === 0) continue;

      let currentMatches = 0;
      const normalizedCells = rowCells.map(c => normalizeHeader(String(c ?? '')));

      for (const normCell of normalizedCells) {
        if (!normCell) continue;
        let cellMatched = false;
        for (const cat of Object.keys(SYNONYMS)) {
          for (const syn of SYNONYMS[cat]) {
            if (normCell === syn || calcSimilarity(normCell, syn) >= 0.7) {
              cellMatched = true;
              break;
            }
          }
          if (cellMatched) break;
        }
        if (cellMatched) currentMatches++;
      }

      if (currentMatches > maxMatchCount) {
        maxMatchCount = currentMatches;
        bestRowIndex = r;
      }
    }

    // Extract headers from bestRowIndex
    const headerRowArray = sheetMatrix[bestRowIndex] || [];
    const rawHeaders: string[] = headerRowArray
      .map((val: any, idx: number) => {
        const s = String(val ?? '').trim();
        return s ? s : `Column_${idx + 1}`;
      });

    // Extract raw data starting from bestRowIndex + 1
    const rawData: Record<string, any>[] = [];
    for (let i = bestRowIndex + 1; i < sheetMatrix.length; i++) {
      const rowArr = sheetMatrix[i];
      if (!Array.isArray(rowArr) || rowArr.every(cell => cell === undefined || cell === null || String(cell).trim() === '')) {
        continue;
      }

      const rowObj: Record<string, any> = {};
      rawHeaders.forEach((h, colIdx) => {
        rowObj[h] = rowArr[colIdx] !== undefined ? rowArr[colIdx] : '';
      });
      rawData.push(rowObj);
    }

    if (!rawData.length) {
      return {
        fileName: file.name,
        headers: rawHeaders,
        rawData: [],
        suggestedMapping: { dayKey: '', focusKey: '', exerciseKey: '', setsRepsKey: '', setsKey: '', repsKey: '', notesKey: '' },
        isError: true,
        errorMessage: 'Spreadsheet has headers but contains no data rows.'
      };
    }

    // Best-guess column mapping
    const dayMatch = findBestMatchingHeader(rawHeaders, 'day');
    const focusMatch = findBestMatchingHeader(rawHeaders, 'focus');
    const exMatch = findBestMatchingHeader(rawHeaders, 'exercise');
    const setsRepsMatch = findBestMatchingHeader(rawHeaders, 'setsReps');
    const setsMatch = findBestMatchingHeader(rawHeaders, 'sets');
    const repsMatch = findBestMatchingHeader(rawHeaders, 'reps');
    const notesMatch = findBestMatchingHeader(rawHeaders, 'notes');

    // Handle combined vs separate sets/reps
    let finalSetsRepsKey = setsRepsMatch.header;
    let finalSetsKey = '';
    let finalRepsKey = '';

    if (!finalSetsRepsKey && (setsMatch.header || repsMatch.header)) {
      finalSetsKey = setsMatch.header;
      finalRepsKey = repsMatch.header;
    }

    const suggestedMapping: ColumnMapping = {
      dayKey: dayMatch.header,
      focusKey: focusMatch.header,
      exerciseKey: exMatch.header,
      setsRepsKey: finalSetsRepsKey,
      setsKey: finalSetsKey,
      repsKey: finalRepsKey,
      notesKey: notesMatch.header
    };

    return {
      fileName: file.name,
      headers: rawHeaders,
      rawData,
      suggestedMapping
    };
  } catch (err: any) {
    console.error('Error extracting sheet columns:', err);
    return {
      fileName: file.name,
      headers: [],
      rawData: [],
      suggestedMapping: { dayKey: '', focusKey: '', exerciseKey: '', setsRepsKey: '', setsKey: '', repsKey: '', notesKey: '' },
      isError: true,
      errorMessage: err.message || 'Failed to read file format.'
    };
  }
}

export function buildPlanFromMapping(
  rawData: Record<string, any>[],
  mapping: ColumnMapping
): ParseResult {
  if (!rawData || !rawData.length) {
    return {
      plan: DEFAULT_WORKOUT_PLAN,
      isFallback: true,
      message: 'No data rows found. Using default 5-day rotation.'
    };
  }

  const { dayKey, focusKey, exerciseKey, setsRepsKey, setsKey, repsKey, notesKey } = mapping;

  if (!exerciseKey) {
    return {
      plan: DEFAULT_WORKOUT_PLAN,
      isFallback: true,
      message: 'Exercise Name column was not mapped. Using default 5-day rotation.'
    };
  }

  const daysMap = new Map<number, { focus: string; exercises: Exercise[] }>();

  rawData.forEach((row, idx) => {
    let dayVal = dayKey && row[dayKey] !== undefined ? parseInt(String(row[dayKey]).replace(/\D/g, ''), 10) : NaN;
    if (isNaN(dayVal) || dayVal < 1) dayVal = Math.floor(idx / 5) + 1;

    const focusVal = (focusKey && row[focusKey] !== undefined) ? String(row[focusKey]).trim() : `Day ${dayVal} Focus`;
    const exName = (exerciseKey && row[exerciseKey] !== undefined) ? String(row[exerciseKey]).trim() : '';

    // Sets x Reps resolution
    let setsRepsVal = '3 x 10';
    if (setsRepsKey && row[setsRepsKey] !== undefined && String(row[setsRepsKey]).trim() !== '') {
      setsRepsVal = String(row[setsRepsKey]).trim();
    } else if ((setsKey && row[setsKey] !== undefined) || (repsKey && row[repsKey] !== undefined)) {
      const s = setsKey && row[setsKey] !== undefined ? String(row[setsKey]).trim() : '3';
      const r = repsKey && row[repsKey] !== undefined ? String(row[repsKey]).trim() : '10';
      setsRepsVal = `${s} x ${r}`;
    }

    const notesVal = (notesKey && row[notesKey] !== undefined && String(row[notesKey]).trim() !== '')
      ? String(row[notesKey]).trim()
      : 'Maintain strict form and control.';

    if (!exName) return;

    if (!daysMap.has(dayVal)) {
      daysMap.set(dayVal, { focus: focusVal, exercises: [] });
    }

    const dayGroup = daysMap.get(dayVal)!;
    if (focusVal && focusVal !== `Day ${dayVal} Focus`) {
      dayGroup.focus = focusVal;
    }

    dayGroup.exercises.push({
      id: `mapped_ex_${dayVal}_${dayGroup.exercises.length + 1}`,
      name: exName,
      setsReps: setsRepsVal,
      notes: notesVal
    });
  });

  const parsedDays: PlanDay[] = Array.from(daysMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([dayNum, data]) => ({
      day: dayNum,
      focus: data.focus,
      exercises: data.exercises
    }));

  if (!parsedDays.length || !parsedDays.some(d => d.exercises.length > 0)) {
    return {
      plan: DEFAULT_WORKOUT_PLAN,
      isFallback: true,
      message: 'No valid exercises extracted with chosen column mapping. Using default 5-day rotation.'
    };
  }

  return {
    plan: parsedDays,
    isFallback: false,
    message: `Successfully mapped and loaded ${parsedDays.length} training days from your custom sheet!`
  };
}
