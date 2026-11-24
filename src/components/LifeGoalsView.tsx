import React, { useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Circle,
  Download,
  Edit3,
  Flag,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  GOAL_CATEGORIES,
  daysUntil,
  deadlineLabel,
  exportLifeGoalsCsv,
  goalProgressPct,
} from '../lib/domain';
import { DayLockState, LifeGoal } from '../types';

interface Props {
  state: DayLockState;
  onAddGoal: () => void;
  onEditGoal: (goal: LifeGoal) => void;
  onUpdateGoal: (goal: LifeGoal) => void;
  onDeleteGoal: (id: string) => void;
  onToast: (msg: string) => void;
}

export const LifeGoalsView: React.FC<Props> = ({
  state,
  onAddGoal,
  onEditGoal,
  onUpdateGoal,
  onDeleteGoal,
  onToast,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'due_soon' | 'completed'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'deadline' | 'priority' | 'progress'>('deadline');
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const [quickIncrement, setQuickIncrement] = useState<Record<string, string>>({});

  const allGoals = state.lifeGoals;
  const activeCount = allGoals.filter((g) => !g.completed).length;
  const completedCount = allGoals.filter((g) => g.completed).length;
  const dueSoonCount = allGoals.filter((g) => !g.completed && daysUntil(g.deadline) >= 0 && daysUntil(g.deadline) <= 14).length;
  const overdueCount = allGoals.filter((g) => !g.completed && daysUntil(g.deadline) < 0).length;

  let filtered = allGoals.slice();
  if (statusFilter === 'active') filtered = filtered.filter((g) => !g.completed);
  if (statusFilter === 'completed') filtered = filtered.filter((g) => g.completed);
  if (statusFilter === 'due_soon') {
    filtered = filtered.filter((g) => !g.completed && daysUntil(g.deadline) <= 14);
  }
  if (categoryFilter !== 'all') {
    filtered = filtered.filter((g) => g.category === categoryFilter);
  }

  const priorityRank = { High: 0, Medium: 1, Low: 2 };
  filtered.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (sortBy === 'priority') return priorityRank[a.priority] - priorityRank[b.priority];
    if (sortBy === 'progress') return goalProgressPct(b) - goalProgressPct(a);
    return a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0;
  });

  const handleToggleMilestone = (goal: LifeGoal, milestoneId: string) => {
    const updatedMilestones = goal.milestones.map((m) =>
      m.id === milestoneId ? { ...m, done: !m.done } : m
    );
    const allDone = updatedMilestones.length > 0 && updatedMilestones.every((m) => m.done);
    onUpdateGoal({
      ...goal,
      milestones: updatedMilestones,
      completed: allDone,
      completedAt: allDone ? new Date().toISOString() : null,
    });
  };

  const handleApplyNumericDelta = (goal: LifeGoal, delta: number) => {
    const nextVal = Math.max(0, goal.currentValue + delta);
    const hit = nextVal >= goal.targetValue && goal.targetValue > 0;
    onUpdateGoal({
      ...goal,
      currentValue: nextVal,
      completed: hit ? true : goal.completed,
      completedAt: hit ? new Date().toISOString() : goal.completedAt,
    });
  };

  const handleToggleComplete = (goal: LifeGoal) => {
    const nextCompleted = !goal.completed;
    onUpdateGoal({
      ...goal,
      completed: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString() : null,
    });
    onToast(nextCompleted ? 'Goal marked completed!' : 'Goal reopened');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#0a1c2e]">
            Life goals & deadlines
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#2a465c]">
            Set clear deadlines for your financial, personal, and career targets — saved in your memory.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              exportLifeGoalsCsv(state);
              onToast('Life goals CSV downloaded');
            }}
            className="h-11 sm:h-10 px-4 rounded-xl bg-white/85 hover:bg-white border border-white text-sm font-semibold text-[#0a1c2e] inline-flex items-center justify-center gap-2 whitespace-nowrap tap-press"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={onAddGoal}
            className="h-11 sm:h-10 px-4 rounded-xl bg-[#0a1c2e] hover:bg-[#13304a] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap tap-press"
          >
            <Plus className="w-4 h-4" />
            Add life goal
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Flag, label: 'Active goals', big: String(activeCount), note: 'In progress' },
          { icon: CalendarClock, label: 'Due within 14d', big: String(dueSoonCount), note: 'Upcoming deadlines' },
          {
            icon: AlertTriangle,
            label: 'Overdue',
            big: String(overdueCount),
            note: overdueCount ? 'Needs attention' : 'All on schedule',
          },
          { icon: CheckCircle2, label: 'Completed', big: String(completedCount), note: 'Achieved' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <section key={item.label} className="glass-card rounded-2xl p-4">
              <div className="w-8 h-8 rounded-xl bg-white/80 border border-white flex items-center justify-center text-[#2a465c] mb-2">
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold font-mono-num text-[#0a1c2e]">{item.big}</p>
              <p className="text-xs font-medium text-[#2a465c]">{item.label}</p>
              <p className="text-[11px] text-[#4d6a80]">{item.note}</p>
            </section>
          );
        })}
      </div>

      {/* Filter & Sort Toolbar */}
      <section className="glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0a1c2e]/10">
          {(
            [
              ['active', 'Active'],
              ['due_soon', 'Due Soon'],
              ['completed', 'Completed'],
              ['all', 'All'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setStatusFilter(val)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === val ? 'bg-white text-[#0a1c2e] shadow-sm' : 'text-[#2a465c] hover:text-[#0a1c2e]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-xs font-semibold text-[#0a1c2e]"
          >
            <option value="all">All categories</option>
            {GOAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort goals"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'deadline' | 'priority' | 'progress')}
            className="h-9 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-xs font-semibold text-[#0a1c2e]"
          >
            <option value="deadline">Sort: Closest deadline</option>
            <option value="priority">Sort: Highest priority</option>
            <option value="progress">Sort: Most progress</option>
          </select>
        </div>
      </section>

      {/* Goals Grid */}
      {filtered.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map((goal) => {
            const pct = goalProgressPct(goal);
            const dlInfo = deadlineLabel(goal);
            const stepInput = quickIncrement[goal.id] ?? '';

            return (
              <section key={goal.id} className="glass-card rounded-2xl p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#4d6a80]">
                        <span>{goal.category}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            goal.priority === 'High'
                              ? 'text-[#b83a27]'
                              : goal.priority === 'Medium'
                              ? 'text-[#0b62ad]'
                              : 'text-[#4d6a80]'
                          }`}
                        >
                          {goal.priority} priority
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            dlInfo.tone === 'good'
                              ? 'text-[#0a7a5a]'
                              : dlInfo.tone === 'bad'
                              ? 'text-[#b83a27]'
                              : dlInfo.tone === 'warn'
                              ? 'text-[#b24a0b]'
                              : 'text-[#2a465c]'
                          }`}
                        >
                          {dlInfo.text}
                        </span>
                      </div>
                      <h2
                        className={`mt-1.5 text-base font-semibold text-[#0a1c2e] ${
                          goal.completed ? 'line-through opacity-70' : ''
                        }`}
                      >
                        {goal.title}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(goal)}
                        title={goal.completed ? 'Reopen goal' : 'Mark complete'}
                        aria-label={goal.completed ? 'Reopen goal' : 'Mark complete'}
                        className="h-9 w-9 rounded-xl flex items-center justify-center text-[#2a465c] hover:bg-white"
                      >
                        {goal.completed ? (
                          <RotateCcw className="w-4 h-4 text-[#0a7a5a]" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 hover:text-[#0a7a5a]" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditGoal(goal)}
                        aria-label="Edit goal"
                        className="h-9 w-9 rounded-xl flex items-center justify-center text-[#4d6a80] hover:bg-white hover:text-[#0a1c2e]"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {armedDeleteId === goal.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            setArmedDeleteId(null);
                            onDeleteGoal(goal.id);
                          }}
                          className="h-9 px-2.5 rounded-xl bg-[#e8553f] text-white text-xs font-semibold"
                        >
                          Delete?
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label="Delete goal"
                          onClick={() => {
                            setArmedDeleteId(goal.id);
                            setTimeout(() => setArmedDeleteId((cur) => (cur === goal.id ? null : cur)), 2800);
                          }}
                          className="h-9 w-9 rounded-xl flex items-center justify-center text-[#4d6a80] hover:bg-white hover:text-[#b83a27]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {goal.note && <p className="mt-2 text-xs text-[#4d6a80] leading-relaxed">{goal.note}</p>}
                </div>

                {/* Progress section */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#2a465c] inline-flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5" />
                        Deadline: <strong className="font-mono-num text-[#0a1c2e]">{goal.deadline}</strong>
                      </span>
                      <span className="font-mono-num font-bold text-[#0a1c2e]">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#0a1c2e]/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct >= 100
                            ? 'bg-gradient-to-r from-[#0fa578] to-[#35d6a1]'
                            : 'bg-gradient-to-r from-[#1590f0] to-[#25b6f0]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {goal.progressType === 'numeric' ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#0a1c2e]/10">
                      <span className="text-xs font-mono-num text-[#2a465c]">
                        <strong className="text-[#0a1c2e]">
                          {goal.unit === '$' ? `$${goal.currentValue.toLocaleString()}` : `${goal.currentValue} ${goal.unit}`}
                        </strong>{' '}
                        of{' '}
                        {goal.unit === '$' ? `$${goal.targetValue.toLocaleString()}` : `${goal.targetValue} ${goal.unit}`}
                      </span>
                      {!goal.completed && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const val = parseFloat(stepInput);
                            if (!Number.isFinite(val) || val === 0) return;
                            handleApplyNumericDelta(goal, val);
                            setQuickIncrement((prev) => ({ ...prev, [goal.id]: '' }));
                            onToast('Progress updated');
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            type="number"
                            step="any"
                            placeholder="+Amount"
                            aria-label="Add progress amount"
                            value={stepInput}
                            onChange={(e) =>
                              setQuickIncrement((prev) => ({ ...prev, [goal.id]: e.target.value }))
                            }
                            className="w-24 h-8 px-2.5 rounded-lg border border-[#0a1c2e]/15 bg-white text-xs font-mono-num text-[#0a1c2e]"
                          />
                          <button
                            type="submit"
                            className="h-8 px-3 rounded-lg bg-[#0a1c2e] text-white text-xs font-semibold hover:bg-[#13304a]"
                          >
                            Add
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    <ul className="space-y-1.5 pt-2 border-t border-[#0a1c2e]/10">
                      {goal.milestones.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => handleToggleMilestone(goal, m.id)}
                            className="w-full text-left flex items-center gap-2.5 py-1 text-xs text-[#0a1c2e] hover:text-[#0b62ad]"
                          >
                            {m.done ? (
                              <CheckCircle2 className="w-4 h-4 text-[#0fa578] shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-[#4d6a80] shrink-0" />
                            )}
                            <span className={m.done ? 'line-through text-[#4d6a80]' : ''}>{m.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="glass-card rounded-2xl p-10 text-center">
          <p className="text-base font-semibold text-[#0a1c2e]">No life goals match this view</p>
          <p className="mt-1 text-xs text-[#4d6a80]">
            Create a financial target, trading milestone, or personal goal with a clear deadline.
          </p>
          <button
            type="button"
            onClick={onAddGoal}
            className="mt-4 h-10 px-4 rounded-xl bg-[#0a1c2e] text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add your first life goal
          </button>
        </section>
      )}
    </div>
  );
};
