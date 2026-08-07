import React, { useState } from 'react';
import { ColumnMapping, SheetExtractionResult, buildPlanFromMapping, ParseResult } from '../lib/planParser';
import { FileSpreadsheet, Check, ArrowRight, Table, AlertTriangle, X, Sparkles, Layers, SlidersHorizontal } from 'lucide-react';

interface ColumnMappingModalProps {
  extraction: SheetExtractionResult;
  onConfirm: (result: ParseResult, mapping: ColumnMapping) => void;
  onCancel: () => void;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  extraction,
  onConfirm,
  onCancel,
}) => {
  const [mapping, setMapping] = useState<ColumnMapping>(extraction.suggestedMapping);
  const [useSeparateSetsReps, setUseSeparateSetsReps] = useState<boolean>(
    !extraction.suggestedMapping.setsRepsKey &&
    Boolean(extraction.suggestedMapping.setsKey || extraction.suggestedMapping.repsKey)
  );

  const headers = extraction.headers;
  const sampleRows = extraction.rawData.slice(0, 3);

  const handleSelectChange = (field: keyof ColumnMapping, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value }));
  };

  // Validation: Count how many fields are mapped
  const mappedDay = Boolean(mapping.dayKey);
  const mappedFocus = Boolean(mapping.focusKey);
  const mappedExercise = Boolean(mapping.exerciseKey);
  const mappedSetsReps = useSeparateSetsReps
    ? Boolean(mapping.setsKey || mapping.repsKey)
    : Boolean(mapping.setsRepsKey);
  const mappedNotes = Boolean(mapping.notesKey);

  const mappedCount = [mappedDay, mappedFocus, mappedExercise, mappedSetsReps, mappedNotes].filter(Boolean).length;
  const isValidMapping = mappedCount >= 2 && mappedExercise;

  const handleConfirm = () => {
    if (!isValidMapping) return;

    const finalMapping: ColumnMapping = {
      ...mapping,
      // Clear whichever mode is not active
      setsRepsKey: useSeparateSetsReps ? '' : mapping.setsRepsKey,
      setsKey: useSeparateSetsReps ? mapping.setsKey : '',
      repsKey: useSeparateSetsReps ? mapping.repsKey : ''
    };

    const result = buildPlanFromMapping(extraction.rawData, finalMapping);
    onConfirm(result, finalMapping);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-[#121214] border border-white/10 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative text-white my-8">
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          title="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-5 pb-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-[#FF4D00]/10 border border-[#FF4D00]/30 flex items-center justify-center text-[#FF4D00] shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black font-mono tracking-tight text-white uppercase italic">
                MAP WORKOUT SHEET COLUMNS
              </h3>
              <span className="text-[10px] font-mono font-bold bg-[#00FFD1]/10 text-[#00FFD1] px-2 py-0.5 rounded border border-[#00FFD1]/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                DETERMINISTIC
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              File: <span className="text-zinc-200 font-mono font-semibold">{extraction.fileName}</span> ({extraction.rawData.length} rows found)
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-300 mb-4 font-sans leading-relaxed">
          Select which spreadsheet column matches each workout field below. You can accept the pre-filled guesses or pick exact headers from your file.
        </p>

        {/* Column Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
          {/* Day Number Column */}
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-white/5">
            <label className="block text-xs font-mono text-zinc-300 uppercase mb-1.5 font-bold flex items-center justify-between">
              <span>Day Number / Rotation</span>
              {mapping.dayKey ? (
                <span className="text-[10px] text-[#00FFD1] lowercase font-normal">matched</span>
              ) : (
                <span className="text-[10px] text-zinc-500 lowercase">not present</span>
              )}
            </label>
            <select
              value={mapping.dayKey}
              onChange={(e) => handleSelectChange('dayKey', e.target.value)}
              className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4D00] transition"
            >
              <option value="">-- Not present (Auto-Assign 1, 2, 3...) --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          {/* Workout Focus / Split */}
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-white/5">
            <label className="block text-xs font-mono text-zinc-300 uppercase mb-1.5 font-bold flex items-center justify-between">
              <span>Focus / Muscle Group</span>
              {mapping.focusKey ? (
                <span className="text-[10px] text-[#00FFD1] lowercase font-normal">matched</span>
              ) : (
                <span className="text-[10px] text-zinc-500 lowercase">not present</span>
              )}
            </label>
            <select
              value={mapping.focusKey}
              onChange={(e) => handleSelectChange('focusKey', e.target.value)}
              className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4D00] transition"
            >
              <option value="">-- Not present (Default Focus) --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          {/* Exercise Name (Required) */}
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-[#FF4D00]/30 sm:col-span-2">
            <label className="block text-xs font-mono text-[#FF4D00] uppercase mb-1.5 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>Exercise Name / Movement</span>
                <span className="text-[10px] bg-[#FF4D00]/20 text-[#FF4D00] px-1.5 py-0.2 rounded font-bold">REQUIRED</span>
              </span>
              {mapping.exerciseKey ? (
                <span className="text-[10px] text-[#00FFD1] lowercase font-normal">matched</span>
              ) : (
                <span className="text-[10px] text-rose-400 font-normal">unmapped</span>
              )}
            </label>
            <select
              value={mapping.exerciseKey}
              onChange={(e) => handleSelectChange('exerciseKey', e.target.value)}
              className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4D00] transition"
            >
              <option value="">-- Select Column for Exercise Name --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          {/* Sets & Reps Mapping Block */}
          <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-white/5 sm:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-zinc-300 uppercase font-bold flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#00FFD1]" />
                <span>Sets & Reps Mapping Format</span>
              </label>
              <div className="flex items-center bg-[#0A0A0B] p-0.5 rounded-lg border border-white/10 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setUseSeparateSetsReps(false)}
                  className={`px-2.5 py-1 rounded-md transition font-bold ${
                    !useSeparateSetsReps
                      ? 'bg-[#FF4D00] text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Combined (3 x 10)
                </button>
                <button
                  type="button"
                  onClick={() => setUseSeparateSetsReps(true)}
                  className={`px-2.5 py-1 rounded-md transition font-bold ${
                    useSeparateSetsReps
                      ? 'bg-[#FF4D00] text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Separate Sets / Reps
                </button>
              </div>
            </div>

            {!useSeparateSetsReps ? (
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Combined "Sets x Reps" Column (e.g. "3 x 10" or "4x8-10")
                </label>
                <select
                  value={mapping.setsRepsKey}
                  onChange={(e) => handleSelectChange('setsRepsKey', e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4D00] transition"
                >
                  <option value="">-- Not present (Default 3 x 10) --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Sets Column (e.g. "3" or "4")
                  </label>
                  <select
                    value={mapping.setsKey}
                    onChange={(e) => handleSelectChange('setsKey', e.target.value)}
                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4D00] transition"
                  >
                    <option value="">-- Not present (Default 3) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Reps Column (e.g. "10" or "8-12")
                  </label>
                  <select
                    value={mapping.repsKey}
                    onChange={(e) => handleSelectChange('repsKey', e.target.value)}
                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4D00] transition"
                  >
                    <option value="">-- Not present (Default 10) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Coaching Notes / Cues */}
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-white/5 sm:col-span-2">
            <label className="block text-xs font-mono text-zinc-300 uppercase mb-1.5 font-bold flex items-center justify-between">
              <span>Notes / Coaching Form Cues</span>
              {mapping.notesKey ? (
                <span className="text-[10px] text-[#00FFD1] lowercase font-normal">matched</span>
              ) : (
                <span className="text-[10px] text-zinc-500 lowercase">not present</span>
              )}
            </label>
            <select
              value={mapping.notesKey}
              onChange={(e) => handleSelectChange('notesKey', e.target.value)}
              className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4D00] transition"
            >
              <option value="">-- Not present (Default Coaching Cues) --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Validation Error Banner (Graceful failure when < 2 fields mapped) */}
        {!isValidMapping && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-xl text-rose-300 text-xs font-mono mb-5 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase tracking-wide">Insufficient Recognizable Data ({mappedCount}/5 fields mapped)</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                The sheet must have at least 2 mapped fields, including a valid <strong>Exercise Name</strong> column. Select your exercise column above or skip to use Threshold's default plan.
              </p>
            </div>
          </div>
        )}

        {/* Sample Mapping Preview Box */}
        <div className="bg-[#0A0A0B] p-3.5 rounded-xl border border-white/10 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4 text-[#00FFD1]" />
              <h4 className="text-xs font-mono font-bold text-[#00FFD1] uppercase tracking-wider">
                PARSED PREVIEW (FIRST {sampleRows.length} ROWS)
              </h4>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">
              {mappedCount} / 5 fields active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400 text-[11px]">
                  <th className="py-1.5 pr-2">Day</th>
                  <th className="py-1.5 pr-2">Focus</th>
                  <th className="py-1.5 pr-2 text-white">Exercise Name</th>
                  <th className="py-1.5 pr-2">Sets x Reps</th>
                  <th className="py-1.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {sampleRows.map((row, idx) => {
                  const day = mapping.dayKey ? row[mapping.dayKey] ?? (idx + 1) : (idx + 1);
                  const focus = mapping.focusKey ? row[mapping.focusKey] ?? 'Default Focus' : 'Default Focus';
                  const ex = mapping.exerciseKey ? row[mapping.exerciseKey] ?? 'Unmapped' : 'Unmapped';

                  let sr = '3 x 10';
                  if (!useSeparateSetsReps) {
                    sr = mapping.setsRepsKey ? row[mapping.setsRepsKey] ?? '3 x 10' : '3 x 10';
                  } else {
                    const s = mapping.setsKey ? row[mapping.setsKey] ?? '3' : '3';
                    const r = mapping.repsKey ? row[mapping.repsKey] ?? '10' : '10';
                    sr = `${s} x ${r}`;
                  }

                  const notes = mapping.notesKey ? row[mapping.notesKey] ?? 'Standard tempo' : 'Standard tempo';

                  return (
                    <tr key={idx} className="hover:bg-white/5 transition">
                      <td className="py-2 pr-2 text-[#00FFD1] font-bold">{day}</td>
                      <td className="py-2 pr-2 text-zinc-300">{focus}</td>
                      <td className="py-2 pr-2 text-white font-semibold">{ex}</td>
                      <td className="py-2 pr-2 text-zinc-300">{sr}</td>
                      <td className="py-2 text-zinc-400 truncate max-w-[150px]">{notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono font-bold transition"
          >
            Skip & Use Default 5-Day Plan
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isValidMapping}
            className="w-full sm:w-auto bg-[#FF4D00] hover:bg-[#ff6622] active:bg-[#e04400] disabled:opacity-30 disabled:cursor-not-allowed text-black font-mono font-black text-xs py-2.5 px-5 rounded-xl shadow-lg shadow-[#FF4D00]/20 transition flex items-center justify-center gap-2 uppercase tracking-wide"
          >
            <Check className="w-4 h-4" />
            <span>CONFIRM & MAP PLAN</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
