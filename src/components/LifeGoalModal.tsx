import React, { useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { GOAL_CATEGORIES, addDays, todayKey, uid } from '../lib/domain';
import { GoalMilestone, GoalPriority, GoalProgressType, LifeGoal } from '../types';

interface Props {
  open: boolean;
  editingGoal: LifeGoal | null;
  defaultCurrency: string;
  onClose: () => void;
  onSave: (goal: Omit<LifeGoal, 'id' | 'createdAt'>, existingId?: string) => void;
}

export const LifeGoalModal: React.FC<Props> = ({ open, editingGoal, defaultCurrency, onClose, onSave }) => {
  const [title, setTitle] = useState(editingGoal?.title || '');
  const [category, setCategory] = useState(editingGoal?.category || GOAL_CATEGORIES[0]);
  const [priority, setPriority] = useState<GoalPriority>(editingGoal?.priority || 'High');
  const [deadline, setDeadline] = useState(editingGoal?.deadline || addDays(todayKey(), 30));
  const [progressType, setProgressType] = useState<GoalProgressType>(editingGoal?.progressType || 'numeric');
  const [currentValue, setCurrentValue] = useState(String(editingGoal?.currentValue ?? 0));
  const [targetValue, setTargetValue] = useState(String(editingGoal?.targetValue ?? 1000));
  const [unit, setUnit] = useState(editingGoal?.unit ?? defaultCurrency);
  const [milestones, setMilestones] = useState<GoalMilestone[]>(
    editingGoal?.milestones?.length
      ? editingGoal.milestones
      : [
          { id: uid(), label: 'Define action plan', done: false },
          { id: uid(), label: 'Hit halfway checkpoint', done: false },
        ]
  );
  const [note, setNote] = useState(editingGoal?.note || '');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const cleanMilestones = milestones.filter((m) => m.label.trim().length > 0);
    const numCur = parseFloat(currentValue) || 0;
    const numTarget = Math.max(1, parseFloat(targetValue) || 1);

    const isAutoCompleted =
      progressType === 'milestones'
        ? cleanMilestones.length > 0 && cleanMilestones.every((m) => m.done)
        : numCur >= numTarget;

    onSave(
      {
        title: cleanTitle,
        category,
        priority,
        deadline,
        progressType,
        currentValue: numCur,
        targetValue: numTarget,
        unit: unit.trim(),
        milestones: cleanMilestones,
        completed: editingGoal ? editingGoal.completed : isAutoCompleted,
        completedAt: editingGoal?.completedAt || (isAutoCompleted ? new Date().toISOString() : null),
        note: note.trim(),
      },
      editingGoal?.id
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#03121e]/65 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-[#eef7fc] border border-white p-6 shadow-2xl text-[#0a1c2e] space-y-4"
        role="dialog"
        aria-modal="true"
        aria-label={editingGoal ? 'Edit life goal' : 'Add life goal'}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{editingGoal ? 'Edit life goal' : 'Add life goal & deadline'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#4d6a80] hover:bg-white/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2 block text-xs font-semibold text-[#2a465c]">
            Goal title
            <input
              type="text"
              required
              maxLength={120}
              placeholder="e.g., Save $10,000 trading reserve, Run marathon, Buy land"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm text-[#0a1c2e]"
            />
          </label>

          <label className="block text-xs font-semibold text-[#2a465c]">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm text-[#0a1c2e]"
            >
              {GOAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-[#2a465c]">
            Deadline date
            <input
              type="date"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm text-[#0a1c2e]"
            />
          </label>

          <div className="text-xs font-semibold text-[#2a465c]">
            Priority
            <div className="mt-1.5 grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0a1c2e]/10">
              {(['High', 'Medium', 'Low'] as GoalPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`h-8 rounded-lg text-xs font-semibold transition-colors ${
                    priority === p ? 'bg-white text-[#0a1c2e] shadow-sm' : 'text-[#2a465c]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs font-semibold text-[#2a465c]">
            Track progress by
            <div className="mt-1.5 grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0a1c2e]/10">
              <button
                type="button"
                onClick={() => setProgressType('numeric')}
                className={`h-8 rounded-lg text-xs font-semibold transition-colors ${
                  progressType === 'numeric' ? 'bg-white text-[#0a1c2e] shadow-sm' : 'text-[#2a465c]'
                }`}
              >
                Number / Amount
              </button>
              <button
                type="button"
                onClick={() => setProgressType('milestones')}
                className={`h-8 rounded-lg text-xs font-semibold transition-colors ${
                  progressType === 'milestones' ? 'bg-white text-[#0a1c2e] shadow-sm' : 'text-[#2a465c]'
                }`}
              >
                Milestones
              </button>
            </div>
          </div>

          {progressType === 'numeric' ? (
            <>
              <label className="block text-xs font-semibold text-[#2a465c]">
                Current progress
                <input
                  type="number"
                  step="any"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num text-[#0a1c2e]"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold text-[#2a465c]">
                  Target
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num text-[#0a1c2e]"
                  />
                </label>
                <label className="block text-xs font-semibold text-[#2a465c]">
                  Unit
                  <input
                    type="text"
                    maxLength={20}
                    placeholder="$, km, books"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm text-[#0a1c2e]"
                  />
                </label>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2a465c]">Milestones</span>
                <button
                  type="button"
                  onClick={() => setMilestones((prev) => [...prev, { id: uid(), label: '', done: false }])}
                  className="text-xs font-semibold text-[#1590f0] inline-flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Add step
                </button>
              </div>
              <div className="space-y-2">
                {milestones.map((m, idx) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Step ${idx + 1}`}
                      value={m.label}
                      onChange={(e) =>
                        setMilestones((prev) =>
                          prev.map((item) => (item.id === m.id ? { ...item, label: e.target.value } : item))
                        )
                      }
                      className="flex-1 h-9 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm text-[#0a1c2e]"
                    />
                    <button
                      type="button"
                      onClick={() => setMilestones((prev) => prev.filter((item) => item.id !== m.id))}
                      aria-label="Remove step"
                      className="h-9 w-9 flex items-center justify-center rounded-xl text-[#4d6a80] hover:text-[#b83a27] hover:bg-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="sm:col-span-2 block text-xs font-semibold text-[#2a465c]">
            Why this goal matters (note)
            <textarea
              rows={2}
              maxLength={600}
              placeholder="Remind yourself why staying disciplined each day funds this goal..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1.5 w-full p-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm text-[#0a1c2e]"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl bg-white border border-[#0a1c2e]/15 text-sm font-semibold text-[#0a1c2e] hover:bg-white/80"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-10 px-5 rounded-xl bg-[#0a1c2e] hover:bg-[#13304a] text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            {editingGoal ? 'Update goal' : 'Save life goal'}
          </button>
        </div>
      </form>
    </div>
  );
};
