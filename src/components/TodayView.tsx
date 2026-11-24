import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Flame,
  Lock,
  Percent,
  Plus,
  Shield,
  Trash2,
  Unlock,
  Wallet,
} from 'lucide-react';
import {
  balanceNow,
  dayList,
  deadlineLabel,
  getDayStatus,
  goalProgressPct,
  greeting,
  longDate,
  money,
  pad,
  parseKey,
  r2,
  streaks,
  summarizeTrades,
  todayKey,
} from '../lib/domain';
import { DayLockState, ViewTab } from '../types';
import { BarChartItem, SessionBarsChart, TargetRing } from './Charts';

interface Props {
  state: DayLockState;
  onOpenTrade: (date: string) => void;
  onDeleteTrade: (id: string) => void;
  onCloseDay: () => void;
  onReopenDay: () => void;
  onToggleCheck: (idx: number, checked: boolean) => void;
  onLoadSample: () => void;
  onClearDemo: () => void;
  onNavigate: (tab: ViewTab) => void;
  onOpenNewGoal: () => void;
  onToast: (msg: string) => void;
}

const LOCK_TEXT: Record<string, [string, string]> = {
  target: ['Target hit', 'Day locked. You did the job, step away and protect your gains.'],
  stop: ['Max loss hit', 'Day locked. Protect the account and return fresh tomorrow.'],
  limit: ['Trade limit reached', 'Day locked. Maximum daily trades reached.'],
  manual: ['Day closed', 'You closed the session for today. See you tomorrow.'],
};

const LockCountdown: React.FC = React.memo(() => {
  const [countdown, setCountdown] = useState('--:--:--');

  useEffect(() => {
    const update = () => {
      const n = new Date();
      const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
      const sec = Math.max(0, Math.floor((m.getTime() - n.getTime()) / 1000));
      setCountdown(`${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="font-display text-2xl sm:text-3xl tracking-wider font-mono-num">{countdown}</span>;
});

export const TodayView: React.FC<Props> = ({
  state,
  onOpenTrade,
  onDeleteTrade,
  onCloseDay,
  onReopenDay,
  onToggleCheck,
  onLoadSample,
  onClearDemo,
  onNavigate,
  onOpenNewGoal,
  onToast,
}) => {
  const tk = todayKey();
  const c = state.settings.currency || '$';
  const st = useMemo(() => getDayStatus(state, tk), [state, tk]);
  const bal = useMemo(() => balanceNow(state), [state]);
  const sm = useMemo(() => summarizeTrades(st.trades), [st.trades]);
  const sk = useMemo(() => streaks(state), [state]);
  const hit = st.state === 'target';
  const risk = r2((bal * (Number(state.settings.riskPct) || 0)) / 100);

  const [reopenInput, setReopenInput] = useState('');
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  const [calcRisk, setCalcRisk] = useState(String(state.settings.riskPct || 1));
  const [calcSl, setCalcSl] = useState('10');
  const [calcPv, setCalcPv] = useState(String(state.settings.pipValue || 10));
  const [calcRr, setCalcRr] = useState('2');

  const items: BarChartItem[] = useMemo(() => {
    const dl = dayList(state)
      .filter((d) => d.k !== tk)
      .slice(-9);
    const out: BarChartItem[] = dl.map((d) => ({
      v: d.net,
      label: String(parseKey(d.k).getDate()),
      title: `${longDate(d.k)}: ${money(d.net, c, { sign: true })}`,
      cls: d.net >= d.target && d.target > 0 ? 'hit' : d.net < 0 ? 'loss' : 'plain',
    }));
    if (st.trades.length) {
      out.push({
        v: st.net,
        label: 'Today',
        title: `Today: ${money(st.net, c, { sign: true })}`,
        cls: hit ? 'hit' : st.net < 0 ? 'loss' : 'now',
      });
    }
    return out;
  }, [state, tk, c, st.trades.length, st.net, hit]);

  const checks = state.days[tk]?.checks || [];
  const rules = state.settings.rules || [];
  const sortedTrades = useMemo(
    () => st.trades.slice().sort((a, b) => (a.time < b.time ? 1 : -1)),
    [st.trades]
  );

  const rp = parseFloat(calcRisk) || 0;
  const sl = parseFloat(calcSl) || 0;
  const pv = parseFloat(calcPv) || 0;
  const rr = parseFloat(calcRr) || 0;
  const calcRiskAmt = (bal * rp) / 100;
  const calcLots = sl > 0 && pv > 0 ? calcRiskAmt / (sl * pv) : 0;

  const upcomingGoals = useMemo(
    () =>
      state.lifeGoals
        .filter((g) => !g.completed)
        .slice()
        .sort((a, b) => (a.deadline < b.deadline ? -1 : 1))
        .slice(0, 3),
    [state.lifeGoals]
  );

  const isBlankWorkspace = state.trades.length === 0 && state.lifeGoals.length === 0;

  return (
    <div className="space-y-4">
      {state.demo && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#ff6a1a]/15 border border-[#ff6a1a]/40 text-xs sm:text-sm text-[#6b2a04]">
          <span>
            <strong>Sample mode active.</strong> Explore these example trades & life goals, then clear them anytime.
          </span>
          <button
            type="button"
            onClick={onClearDemo}
            className="h-9 px-3.5 rounded-xl bg-[#ff6a1a] hover:bg-[#e85a0d] text-white text-xs font-semibold whitespace-nowrap tap-press"
          >
            Clear sample data
          </button>
        </div>
      )}

      {isBlankWorkspace && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-white/85 border border-white text-sm text-[#0a1c2e]">
          <div>
            <p className="font-semibold">DayLock is ready to use — your memory is saved automatically.</p>
            <p className="text-xs text-[#4d6a80] mt-0.5">
              Log your first real trade, add a life goal with a deadline, or preview sample data.
            </p>
          </div>
          <button
            type="button"
            onClick={onLoadSample}
            className="h-10 px-3.5 rounded-xl bg-white border border-[#0a1c2e]/15 hover:bg-[#eef7fc] text-xs font-semibold whitespace-nowrap tap-press"
          >
            Load sample data
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-[28px] font-semibold tracking-tight text-[#0a1c2e] leading-tight">
            {greeting()}, {state.settings.displayName.split(' ')[0] || 'Trader'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#2a465c]">
            {longDate(tk)} · {st.locked ? 'Day locked' : 'Trading open'} ·{' '}
            {sk.cur ? `${sk.cur} day target streak` : 'Start your target streak today'}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <button
            type="button"
            disabled={st.locked}
            onClick={onCloseDay}
            className="h-11 sm:h-10 px-4 rounded-xl bg-white/85 hover:bg-white border border-white text-sm font-semibold text-[#0a1c2e] inline-flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap tap-press"
          >
            <Lock className="w-4 h-4" />
            Close day
          </button>
          <button
            type="button"
            disabled={st.locked}
            onClick={() => onOpenTrade(tk)}
            className="h-11 sm:h-10 px-4 rounded-xl bg-[#0a1c2e] hover:bg-[#13304a] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap tap-press"
          >
            <Plus className="w-4 h-4" />
            Log trade
          </button>
        </div>
      </div>

      {/* Lock Banner */}
      {st.locked && (
        <div className="rounded-2xl p-4 sm:p-5 text-white bg-gradient-to-br from-[#0a1c2e] via-[#0f4b6b] to-[#0b7aa0] border border-white/25 shadow-lg space-y-3.5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 border border-white/30 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight leading-none">
                {LOCK_TEXT[st.state]?.[0] || 'Day locked'}{' '}
                <span className="text-[#ff6a1a]">· Locked</span>
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#eaf6fb]/85">
                {LOCK_TEXT[st.state]?.[1]} Net today{' '}
                <strong className="text-white font-mono-num">{money(st.net, c, { sign: true })}</strong> from {st.n}{' '}
                trade{st.n === 1 ? '' : 's'}.
              </p>
            </div>
            <div className="w-full sm:w-auto flex sm:block items-center justify-between pt-2 sm:pt-0 border-t sm:border-t-0 border-white/15 sm:text-right">
              <span className="text-[11px] tracking-wider uppercase text-[#eaf6fb]/70 block">Next session in</span>
              <LockCountdown />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/15 text-xs text-[#eaf6fb]/85">
            <span>Type REOPEN to unlock:</span>
            <input
              type="text"
              aria-label="Type REOPEN to unlock day"
              placeholder="REOPEN"
              value={reopenInput}
              onChange={(e) => setReopenInput(e.target.value)}
              className="h-10 w-28 px-3 rounded-lg bg-white/10 border border-white/30 text-white placeholder:text-white/40 text-xs font-mono-num"
            />
            <button
              type="button"
              onClick={() => {
                if (reopenInput.trim().toUpperCase() === 'REOPEN') {
                  setReopenInput('');
                  onReopenDay();
                } else {
                  onToast('Type REOPEN to confirm unlocking the day');
                }
              }}
              className="h-10 px-3.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap tap-press"
            >
              <Unlock className="w-3.5 h-3.5" />
              Unlock day
            </button>
          </div>
        </div>
      )}

      {/* Hero Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        <section className="glass-card rounded-2xl p-4 sm:p-5 lg:col-span-7">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#0a1c2e]">Today&apos;s target</h2>
              <p className="text-xs text-[#4d6a80]">Hit it, then the day locks automatically</p>
            </div>
            <span
              className={`text-xs font-semibold whitespace-nowrap ${
                hit ? 'text-[#0a7a5a]' : st.state === 'stop' ? 'text-[#b83a27]' : 'text-[#0b62ad]'
              }`}
            >
              {hit ? 'Target hit' : st.state === 'stop' ? 'Stopped out' : 'Session active'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
            <TargetRing net={st.net} target={st.target} currency={c} hit={hit} />
            <div className="w-full flex-1 space-y-2.5 text-sm">
              <div className="flex justify-between pb-2 border-b border-[#0a1c2e]/10">
                <span className="text-[#2a465c]">Net P/L</span>
                <strong
                  className={`font-mono-num ${
                    st.net > 0 ? 'text-[#0a7a5a]' : st.net < 0 ? 'text-[#b83a27]' : 'text-[#0a1c2e]'
                  }`}
                >
                  {money(st.net, c, { sign: true })}
                </strong>
              </div>
              <div className="flex justify-between pb-2 border-b border-[#0a1c2e]/10">
                <span className="text-[#2a465c]">Remaining to target</span>
                <strong className="font-mono-num">{money(Math.max(0, r2(st.target - st.net)), c)}</strong>
              </div>
              <div className="flex justify-between pb-2 border-b border-[#0a1c2e]/10">
                <span className="text-[#2a465c]">Loss room left</span>
                <strong className="font-mono-num">{money(Math.max(0, r2(st.stop + st.net)), c)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#2a465c]">Trades left</span>
                <strong className="font-mono-num">
                  {st.max > 0 ? `${Math.max(0, st.max - st.n)} of ${st.max}` : `${st.n} taken`}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-4 sm:p-5 lg:col-span-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0a1c2e]">Recent sessions</h2>
            <p className="text-xs text-[#4d6a80]">Daily P/L against your target line</p>
          </div>
          <SessionBarsChart items={items} target={st.target} currency={c} ariaLabel="Recent daily P/L" />
        </section>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {[
          {
            icon: Wallet,
            label: 'Account balance',
            big: money(bal, c),
            note: `Start ${money(state.settings.balance, c, { dec: 0 })}`,
          },
          {
            icon: Activity,
            label: 'Trades today',
            big: st.max > 0 ? `${st.n} / ${st.max}` : String(st.n),
            note: st.n ? `${sm.wins} won · ${sm.losses} lost` : 'Nothing logged yet',
          },
          {
            icon: Percent,
            label: 'Win rate today',
            big: st.n ? `${Math.round(sm.wr * 100)}%` : '--',
            note: st.n ? `PF ${sm.pf === Infinity ? '∞' : sm.pf.toFixed(2)}` : 'Waiting for trades',
          },
          {
            icon: Shield,
            label: 'Risk per trade',
            big: money(risk, c),
            note: `${state.settings.riskPct || 0}% of balance`,
          },
          {
            icon: Flame,
            label: 'Target streak',
            big: `${sk.cur} ${sk.cur === 1 ? 'day' : 'days'}`,
            note: `Best ${sk.best} ${sk.best === 1 ? 'day' : 'days'}`,
          },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <section
              key={item.label}
              className={`glass-card rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between ${
                idx === 4 ? 'col-span-2 sm:col-span-1' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-white/90 border border-white flex items-center justify-center text-[#2a465c] mb-2">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold tracking-tight font-mono-num text-[#0a1c2e] truncate">
                  {item.big}
                </p>
                <p className="text-xs font-medium text-[#2a465c] mt-0.5">{item.label}</p>
                <p className="text-[11px] text-[#4d6a80] mt-0.5 truncate">{item.note}</p>
              </div>
            </section>
          );
        })}
      </div>

      {/* Life Goals & Upcoming Deadlines Spotlight */}
      <section className="glass-card rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#0a1c2e]">Life goals & upcoming deadlines</h2>
            <p className="text-xs text-[#4d6a80]">Stay locked in today to fund what matters long term</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenNewGoal}
              className="h-10 sm:h-9 px-3 rounded-xl bg-white border border-[#0a1c2e]/15 hover:bg-[#eef7fc] text-xs font-semibold text-[#0a1c2e] inline-flex items-center gap-1.5 whitespace-nowrap tap-press"
            >
              <Plus className="w-3.5 h-3.5" /> Add goal
            </button>
            <button
              type="button"
              onClick={() => onNavigate('lifegoals')}
              className="h-10 sm:h-9 px-3 rounded-xl bg-[#0a1c2e] hover:bg-[#13304a] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap tap-press"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {upcomingGoals.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
            {upcomingGoals.map((goal) => {
              const dlInfo = deadlineLabel(goal);
              const pct = goalProgressPct(goal);
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => onNavigate('lifegoals')}
                  className="text-left p-3.5 sm:p-4 rounded-xl bg-white/80 hover:bg-white border border-white tap-press flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-[#4d6a80]">
                      <span className="truncate">{goal.category}</span>
                      <span
                        className={`font-semibold whitespace-nowrap ${
                          dlInfo.tone === 'bad'
                            ? 'text-[#b83a27]'
                            : dlInfo.tone === 'warn'
                            ? 'text-[#b24a0b]'
                            : 'text-[#0b62ad]'
                        }`}
                      >
                        {dlInfo.text}
                      </span>
                    </div>
                    <p className="mt-1 font-semibold text-sm text-[#0a1c2e] line-clamp-2">{goal.title}</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-[#4d6a80] mb-1">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5" /> {goal.deadline}
                      </span>
                      <span className="font-mono-num font-semibold text-[#0a1c2e]">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#0a1c2e]/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1590f0] to-[#25b6f0]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-5 text-center text-sm text-[#4d6a80]">
            <p className="font-semibold text-[#0a1c2e]">No active life goals yet</p>
            <p className="text-xs mt-1">
              Add your personal milestones and deadlines so every trading target connects to your bigger vision.
            </p>
          </div>
        )}
      </section>

      {/* Bottom 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        <section className="glass-card rounded-2xl p-4 sm:p-5 lg:col-span-7">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0a1c2e]">Today&apos;s trades</h2>
            <p className="text-xs text-[#4d6a80]">Newest first</p>
          </div>

          {sortedTrades.length ? (
            <>
              {/* Phone card list (no horizontal scroll!) */}
              <div className="sm:hidden divide-y divide-[#0a1c2e]/10">
                {sortedTrades.map((t) => (
                  <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#0a1c2e]">{t.symbol}</span>
                        <span
                          className={`text-xs font-semibold ${
                            t.side === 'Buy' ? 'text-[#0b62ad]' : 'text-[#b24a0b]'
                          }`}
                        >
                          {t.side}
                        </span>
                        {t.lots != null && (
                          <span className="text-xs font-mono-num text-[#4d6a80]">{t.lots} lots</span>
                        )}
                      </div>
                      <p className="text-xs text-[#4d6a80] mt-0.5">
                        {t.time || '--'} · {t.setup}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-sm font-bold font-mono-num ${
                          t.pnl > 0 ? 'text-[#0a7a5a]' : t.pnl < 0 ? 'text-[#b83a27]' : 'text-[#2a465c]'
                        }`}
                      >
                        {money(t.pnl, c, { sign: true })}
                      </span>
                      {armedDeleteId === t.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            setArmedDeleteId(null);
                            onDeleteTrade(t.id);
                          }}
                          className="min-h-[40px] px-2.5 rounded-lg bg-[#e8553f] text-white text-xs font-semibold"
                        >
                          Delete?
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label="Delete trade"
                          onClick={() => {
                            setArmedDeleteId(t.id);
                            setTimeout(() => setArmedDeleteId((cur) => (cur === t.id ? null : cur)), 2800);
                          }}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4d6a80] hover:bg-white hover:text-[#b83a27]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop / Tablet table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[#4d6a80]">
                      <th className="py-2 px-2">Time</th>
                      <th className="py-2 px-2">Symbol</th>
                      <th className="py-2 px-2">Side</th>
                      <th className="py-2 px-2 text-right">Lots</th>
                      <th className="py-2 px-2 text-right">Result</th>
                      <th className="py-2 px-2">Setup</th>
                      <th className="py-2 px-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTrades.map((t) => (
                      <tr key={t.id} className="border-t border-[#0a1c2e]/10 hover:bg-white/40">
                        <td className="py-2.5 px-2 font-mono-num text-xs text-[#2a465c]">{t.time || '--'}</td>
                        <td className="py-2.5 px-2 font-semibold">{t.symbol}</td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`text-xs font-semibold ${
                              t.side === 'Buy' ? 'text-[#0b62ad]' : 'text-[#b24a0b]'
                            }`}
                          >
                            {t.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono-num">{t.lots ?? ''}</td>
                        <td
                          className={`py-2.5 px-2 text-right font-semibold font-mono-num ${
                            t.pnl > 0 ? 'text-[#0a7a5a]' : t.pnl < 0 ? 'text-[#b83a27]' : 'text-[#2a465c]'
                          }`}
                        >
                          {money(t.pnl, c, { sign: true })}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-[#2a465c]">{t.setup}</td>
                        <td className="py-2.5 px-2 text-right">
                          {armedDeleteId === t.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setArmedDeleteId(null);
                                onDeleteTrade(t.id);
                              }}
                              className="h-8 px-2.5 rounded-lg bg-[#e8553f] text-white text-xs font-semibold"
                            >
                              Delete?
                            </button>
                          ) : (
                            <button
                              type="button"
                              aria-label="Delete trade"
                              onClick={() => {
                                setArmedDeleteId(t.id);
                                setTimeout(() => setArmedDeleteId((cur) => (cur === t.id ? null : cur)), 2800);
                              }}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#4d6a80] hover:bg-white hover:text-[#b83a27]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-sm text-[#4d6a80]">
              <p className="font-semibold text-[#0a1c2e]">No trades yet today</p>
              <p className="mt-1 text-xs">Run through your checklist, then log your first execution.</p>
            </div>
          )}
        </section>

        <div className="lg:col-span-5 space-y-3.5">
          <section className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-[#0a1c2e]">Pre-trade checklist</h2>
              <p className="text-xs text-[#4d6a80]">
                {checks.length} of {rules.length} ready
              </p>
            </div>
            <ul className="space-y-2">
              {rules.map((r, i) => {
                const checked = checks.includes(i);
                return (
                  <li key={`${i}-${r}`}>
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/75 border border-white cursor-pointer text-sm min-h-[46px] tap-press">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onToggleCheck(i, e.target.checked)}
                        className="w-4 h-4 accent-[#1590f0] rounded shrink-0"
                      />
                      <span className={checked ? 'line-through text-[#4d6a80]' : 'text-[#0a1c2e]'}>{r}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-[#0a1c2e]">Position size</h2>
              <p className="text-xs text-[#4d6a80]">Lots for your stop loss distance</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block text-xs font-semibold text-[#2a465c]">
                Risk %
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={calcRisk}
                  onChange={(e) => setCalcRisk(e.target.value)}
                  className="mt-1 w-full h-10 px-2.5 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num"
                />
              </label>
              <label className="block text-xs font-semibold text-[#2a465c]">
                Stop loss (pips)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={calcSl}
                  onChange={(e) => setCalcSl(e.target.value)}
                  className="mt-1 w-full h-10 px-2.5 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num"
                />
              </label>
              <label className="block text-xs font-semibold text-[#2a465c]">
                Pip value (1 lot)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={calcPv}
                  onChange={(e) => setCalcPv(e.target.value)}
                  className="mt-1 w-full h-10 px-2.5 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num"
                />
              </label>
              <label className="block text-xs font-semibold text-[#2a465c]">
                Reward : risk
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={calcRr}
                  onChange={(e) => setCalcRr(e.target.value)}
                  className="mt-1 w-full h-10 px-2.5 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="p-2.5 rounded-xl bg-white/80 border border-white">
                <span className="block text-[11px] text-[#4d6a80]">Risk amount</span>
                <strong className="text-base font-mono-num">{money(calcRiskAmt, c)}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 border border-white">
                <span className="block text-[11px] text-[#4d6a80]">Lot size</span>
                <strong className="text-base font-mono-num">
                  {calcLots ? (Math.floor(calcLots * 100) / 100).toFixed(2) : '--'}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 border border-white">
                <span className="block text-[11px] text-[#4d6a80]">Take profit (pips)</span>
                <strong className="text-base font-mono-num">{sl && rr ? (sl * rr).toFixed(1) : '--'}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 border border-white">
                <span className="block text-[11px] text-[#4d6a80]">Potential profit</span>
                <strong className="text-base font-mono-num text-[#0a7a5a]">{money(calcRiskAmt * rr, c)}</strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
