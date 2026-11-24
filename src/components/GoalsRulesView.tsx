import React, { useState } from 'react';
import { Check, Download, Plus, Trash2 } from 'lucide-react';
import { MONTHS, money, parseKey, shortLab, sumRange, todayKey, weekRange } from '../lib/domain';
import { DayLockState, Settings } from '../types';

interface Props {
  state: DayLockState;
  onSaveSettings: (next: Settings) => void;
  onOpenDownloadCenter: () => void;
  onWipeAll: () => void;
  onToast: (msg: string) => void;
}

export const GoalsRulesView: React.FC<Props> = ({
  state,
  onSaveSettings,
  onOpenDownloadCenter,
  onWipeAll,
  onToast,
}) => {
  const s = state.settings;
  const tk = todayKey();
  const c = s.currency || '$';
  const [ws, we] = weekRange(tk);
  const wk = sumRange(state, ws, we);
  const mo = sumRange(state, `${tk.slice(0, 8)}01`, `${tk.slice(0, 8)}31`);

  const [displayName, setDisplayName] = useState(s.displayName);
  const [unit, setUnit] = useState(s.unit);
  const [target, setTarget] = useState(String(s.target));
  const [stop, setStop] = useState(String(s.stop));
  const [maxTrades, setMaxTrades] = useState(String(s.maxTrades));
  const [riskPct, setRiskPct] = useState(String(s.riskPct));
  const [currency, setCurrency] = useState(s.currency);
  const [balance, setBalance] = useState(String(s.balance));
  const [pipValue, setPipValue] = useState(String(s.pipValue));
  const [weekGoal, setWeekGoal] = useState(String(s.weekGoal));
  const [monthGoal, setMonthGoal] = useState(String(s.monthGoal));
  const [rules, setRules] = useState<string[]>(s.rules);
  const [why, setWhy] = useState(s.why);
  const [armedWipe, setArmedWipe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = (val: string, fallback: number) => {
      const p = parseFloat(val);
      return Number.isFinite(p) && p >= 0 ? p : fallback;
    };
    onSaveSettings({
      displayName: displayName.trim() || 'Trader',
      currency: currency.trim() || '$',
      balance: num(balance, s.balance),
      unit: unit === 'pct' ? 'pct' : 'amount',
      target: num(target, s.target),
      stop: num(stop, s.stop),
      maxTrades: Math.floor(num(maxTrades, s.maxTrades)),
      riskPct: num(riskPct, s.riskPct),
      pipValue: num(pipValue, s.pipValue),
      weekGoal: num(weekGoal, s.weekGoal),
      monthGoal: num(monthGoal, s.monthGoal),
      rules: rules.map((r) => r.trim()).filter(Boolean),
      why: why.trim(),
    });
    onToast('Trading rules & targets updated');
  };

  const renderProgress = (val: number, goal: number) => {
    const pct = goal > 0 ? Math.max(0, Math.min(1, val / goal)) : 0;
    return (
      <div>
        <div className="h-2 rounded-full bg-[#0a1c2e]/12 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              pct >= 1 ? 'bg-gradient-to-r from-[#0fa578] to-[#35d6a1]' : 'bg-gradient-to-r from-[#1590f0] to-[#25b6f0]'
            }`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-[#4d6a80] mt-1.5 font-mono-num">
          <span>{money(val, c, { sign: true })} so far</span>
          <span>
            {Math.round(pct * 100)}% of {money(goal, c, { dec: 0 })}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0a1c2e]">Trading rules & targets</h1>
            <p className="mt-1 text-sm text-[#2a465c]">
              Update your daily lock limits anytime — Today recalculates immediately.
            </p>
          </div>
          <button
            type="submit"
            className="h-10 px-5 rounded-xl bg-[#0a1c2e] hover:bg-[#13304a] text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            Save changes
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <section className="glass-card rounded-2xl p-5 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[#0a1c2e]">Daily lock plan</h2>
              <p className="text-xs text-[#4d6a80]">Session locks when any threshold is hit</p>
            </div>
            <div className="text-xs font-semibold text-[#2a465c]">
              Targets are measured in
              <div className="mt-1.5 inline-grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0a1c2e]/10 ml-0 block w-fit">
                {(
                  [
                    ['amount', 'Money'],
                    ['pct', '% of balance'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setUnit(v)}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold ${
                      unit === v ? 'bg-white text-[#0a1c2e] shadow-sm' : 'text-[#2a465c]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-[#2a465c]">
                Daily profit target
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num"
                />
              </label>
              <label className="block text-xs font-semibold text-[#2a465c]">
                Max daily loss
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={stop}
                  onChange={(e) => setStop(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num"
                />
              </label>
              <label className="block text-xs font-semibold text-[#2a465c]">
                Max trades per day (0 = unlimited)
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={maxTrades}
                  onChange={(e) => setMaxTrades(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num"
                />
              </label>
              <label className="block text-xs font-semibold text-[#2a465c]">
                Risk per trade (%)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={riskPct}
                  onChange={(e) => setRiskPct(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num"
                />
              </label>
            </div>
          </section>

          <section className="glass-card rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#0a1c2e]">Profile & account</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="sm:col-span-2 block text-xs font-semibold text-[#2a465c]">
                Your name
                <input
                  type="text"
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-[#2a465c]">
                Currency symbol
                <input
                  type="text"
                  maxLength={4}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-[#2a465c]">
                Starting balance
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num"
                />
              </label>
              <label className="block text-xs font-semibold text-[#2a465c]">
                Weekly goal
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={weekGoal}
                  onChange={(e) => setWeekGoal(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num"
                />
              </label>
              <label className="block text-xs font-semibold text-[#2a465c]">
                Monthly goal
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={monthGoal}
                  onChange={(e) => setMonthGoal(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num"
                />
              </label>
              <label className="sm:col-span-2 block text-xs font-semibold text-[#2a465c]">
                Value per pip (1 lot)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pipValue}
                  onChange={(e) => setPipValue(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num"
                />
              </label>
            </div>
          </section>

          <section className="glass-card rounded-2xl p-5 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-[#0a1c2e]">This week</h2>
              <p className="text-xs text-[#4d6a80] mb-2">
                {shortLab(ws)} to {shortLab(we)}
              </p>
              {renderProgress(wk, Number(weekGoal) || 0)}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#0a1c2e]">This month</h2>
              <p className="text-xs text-[#4d6a80] mb-2">{MONTHS[parseKey(tk).getMonth()]}</p>
              {renderProgress(mo, Number(monthGoal) || 0)}
            </div>
          </section>

          <section className="glass-card rounded-2xl p-5 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[#0a1c2e]">Pre-trade rules</h2>
              <p className="text-xs text-[#4d6a80]">Shown as your daily execution checklist</p>
            </div>
            <div className="space-y-2">
              {rules.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={r}
                    placeholder="Rule you commit to following"
                    onChange={(e) =>
                      setRules((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))
                    }
                    className="flex-1 h-9 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm"
                  />
                  <button
                    type="button"
                    aria-label="Remove rule"
                    onClick={() => setRules((prev) => prev.filter((_, i) => i !== idx))}
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-[#4d6a80] hover:bg-white hover:text-[#b83a27]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRules((prev) => [...prev, ''])}
              className="h-9 px-3 rounded-xl bg-white border border-[#0a1c2e]/15 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add rule
            </button>
            <label className="block text-xs font-semibold text-[#2a465c] pt-2">
              Why I trade this way
              <textarea
                rows={2}
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                className="mt-1 w-full p-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm"
              />
            </label>
          </section>
        </div>
      </form>

      <section className="glass-card rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#0a1c2e]">Memory, App Download & Backups</h2>
          <p className="text-xs text-[#4d6a80]">
            Your data stays saved on this device automatically, and syncs to the cloud when signed in.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenDownloadCenter}
            className="h-10 px-4 rounded-xl bg-white border border-[#0a1c2e]/15 hover:bg-[#eef7fc] text-sm font-semibold inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download & Restore
          </button>
          <button
            type="button"
            onClick={() => {
              if (armedWipe) {
                setArmedWipe(false);
                onWipeAll();
              } else {
                setArmedWipe(true);
                setTimeout(() => setArmedWipe(false), 3500);
              }
            }}
            className={`h-10 px-4 rounded-xl text-sm font-semibold border transition-colors ${
              armedWipe
                ? 'bg-[#e8553f] border-[#e8553f] text-white'
                : 'bg-white border-[#0a1c2e]/15 text-[#b83a27] hover:bg-[#fff5f4]'
            }`}
          >
            {armedWipe ? 'Click again to erase everything' : 'Erase all data'}
          </button>
        </div>
      </section>
    </div>
  );
};
