import { DayLockState, DayRecord, LifeGoal, Settings, Trade } from '../types';

export const SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'NAS100', 'US30', 'BTCUSD', 'V75'];
export const SETUPS = ['Breakout', 'Pullback', 'Reversal', 'Range', 'News', 'Other'];
export const GOAL_CATEGORIES = [
  'Financial',
  'Trading Milestone',
  'Career & Business',
  'Health & Fitness',
  'Education & Skill',
  'Personal & Family',
];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const pad = (n: number) => String(n).padStart(2, '0');
export const r2 = (n: number) => Math.round(n * 100) / 100;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const dkey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const todayKey = () => dkey(new Date());
export const addDays = (k: string, n: number) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dkey(d);
};

export const longDate = (k: string) => {
  const d = parseKey(k);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const shortLab = (k: string) => {
  const d = parseKey(k);
  return `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()}`;
};

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Late session';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function daysUntil(deadlineKey: string, fromKey = todayKey()): number {
  const a = parseKey(fromKey);
  const b = parseKey(deadlineKey);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function deadlineLabel(goal: LifeGoal): { text: string; tone: 'good' | 'warn' | 'bad' | 'neutral' } {
  if (goal.completed) {
    return {
      text: goal.completedAt ? `Completed ${goal.completedAt.slice(0, 10)}` : 'Completed',
      tone: 'good',
    };
  }
  const diff = daysUntil(goal.deadline);
  if (diff < 0) {
    const abs = Math.abs(diff);
    return { text: `${abs} day${abs === 1 ? '' : 's'} overdue`, tone: 'bad' };
  }
  if (diff === 0) return { text: 'Due today', tone: 'warn' };
  if (diff === 1) return { text: '1 day left', tone: 'warn' };
  if (diff <= 14) return { text: `${diff} days left`, tone: 'warn' };
  return { text: `${diff} days left`, tone: 'neutral' };
}

export function goalProgressPct(goal: LifeGoal): number {
  if (goal.completed) return 100;
  if (goal.progressType === 'milestones') {
    if (!goal.milestones.length) return 0;
    const done = goal.milestones.filter((m) => m.done).length;
    return Math.round((done / goal.milestones.length) * 100);
  }
  if (goal.targetValue <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)));
}

export function defaultSettings(): Settings {
  return {
    displayName: 'Adams Kipkoech',
    currency: '$',
    balance: 1000,
    unit: 'amount',
    target: 30,
    stop: 20,
    maxTrades: 4,
    riskPct: 1,
    pipValue: 10,
    weekGoal: 150,
    monthGoal: 600,
    rules: [
      'Trade only my A+ setups',
      'Risk is within my % per trade',
      'Stop loss is placed before entry',
      'No revenge trades after a loss',
      'No trading around high-impact news',
    ],
    why: 'Hit the target, close the platform, protect the profit.',
  };
}

export function blankState(): DayLockState {
  return {
    v: 2,
    updatedAt: Date.now(),
    demo: false,
    settings: defaultSettings(),
    days: {},
    trades: [],
    lifeGoals: [],
  };
}

export function normalizeState(raw: unknown): DayLockState {
  const base = blankState();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  const rawSettings = (obj.settings && typeof obj.settings === 'object' ? obj.settings : {}) as Partial<Settings>;
  const settings: Settings = {
    ...base.settings,
    ...rawSettings,
    rules: Array.isArray(rawSettings.rules)
      ? rawSettings.rules.map((r) => String(r).trim()).filter(Boolean).slice(0, 20)
      : base.settings.rules,
  };

  // Migrate legacy v1 top-level `checks` map into `days[date].checks`
  const days: Record<string, DayRecord> = {};
  if (obj.days && typeof obj.days === 'object') {
    for (const [k, val] of Object.entries(obj.days as Record<string, DayRecord>)) {
      if (val && typeof val === 'object') {
        days[k] = {
          target: val.target ?? null,
          stop: val.stop ?? null,
          closed: !!val.closed,
          reopened: !!val.reopened,
          note: typeof val.note === 'string' ? val.note : '',
          checks: Array.isArray(val.checks) ? val.checks.filter((x) => typeof x === 'number') : [],
        };
      }
    }
  }
  if (obj.checks && typeof obj.checks === 'object') {
    for (const [k, arr] of Object.entries(obj.checks as Record<string, unknown>)) {
      if (Array.isArray(arr)) {
        days[k] = {
          ...(days[k] || {}),
          checks: arr.filter((x): x is number => typeof x === 'number'),
        };
      }
    }
  }

  const trades: Trade[] = Array.isArray(obj.trades)
    ? obj.trades
        .filter((t): t is Trade => !!t && typeof t === 'object' && typeof (t as Trade).date === 'string')
        .map((t) => ({
          id: String(t.id || uid()),
          date: String(t.date),
          time: String(t.time || ''),
          symbol: String(t.symbol || 'TRADE').toUpperCase(),
          side: t.side === 'Sell' ? 'Sell' : 'Buy',
          lots: typeof t.lots === 'number' && isFinite(t.lots) ? t.lots : null,
          entry: typeof t.entry === 'number' && isFinite(t.entry) ? t.entry : null,
          exit: typeof t.exit === 'number' && isFinite(t.exit) ? t.exit : null,
          pnl: typeof t.pnl === 'number' && isFinite(t.pnl) ? r2(t.pnl) : 0,
          setup: String(t.setup || 'Other'),
          note: String(t.note || ''),
        }))
    : [];

  const lifeGoals: LifeGoal[] = Array.isArray(obj.lifeGoals)
    ? obj.lifeGoals
        .filter((g): g is LifeGoal => !!g && typeof g === 'object' && typeof (g as LifeGoal).title === 'string')
        .map((g) => ({
          id: String(g.id || uid()),
          title: String(g.title),
          category: String(g.category || 'Financial'),
          priority: g.priority === 'High' || g.priority === 'Low' ? g.priority : 'Medium',
          deadline: String(g.deadline || addDays(todayKey(), 30)),
          progressType: g.progressType === 'milestones' ? 'milestones' : 'numeric',
          currentValue: typeof g.currentValue === 'number' && isFinite(g.currentValue) ? g.currentValue : 0,
          targetValue: typeof g.targetValue === 'number' && isFinite(g.targetValue) ? g.targetValue : 100,
          unit: String(g.unit || '$'),
          milestones: Array.isArray(g.milestones)
            ? g.milestones.map((m) => ({
                id: String(m.id || uid()),
                label: String(m.label || ''),
                done: !!m.done,
              }))
            : [],
          completed: !!g.completed,
          completedAt: g.completedAt ? String(g.completedAt) : null,
          note: String(g.note || ''),
          createdAt: String(g.createdAt || new Date().toISOString()),
        }))
    : [];

  return {
    v: 2,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
    demo: !!obj.demo,
    settings,
    days,
    trades,
    lifeGoals,
  };
}

export function createSampleState(baseSettings?: Settings): DayLockState {
  const s = blankState();
  if (baseSettings) s.settings = { ...baseSettings };
  s.demo = true;
  let seed = 7;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tk = todayKey();
  for (let i = 28; i >= 1; i--) {
    const k = addDays(tk, -i);
    const dow = parseKey(k).getDay();
    if (dow === 0 || dow === 6) continue;
    let net = 0;
    let n = 0;
    let min = 8 * 60 + rnd() * 90;
    const target = s.settings.target;
    const stop = s.settings.stop;
    s.days[k] = { target, stop, closed: false, reopened: false, note: '', checks: [0, 1, 2, 3, 4] };
    while (net < target && net > -stop && n < s.settings.maxTrades) {
      const win = rnd() < 0.62;
      const amt = r2(win ? 11 + rnd() * 22 : 6 + rnd() * 12);
      const pnl = win ? amt : -amt;
      const sym = SYMBOLS[Math.floor(rnd() * 5)];
      min += 15 + rnd() * 50;
      s.trades.push({
        id: `sample_${k}_${n}`,
        date: k,
        time: `${pad(Math.floor(min / 60) % 24)}:${pad(Math.floor(min % 60))}`,
        symbol: sym,
        side: rnd() < 0.5 ? 'Buy' : 'Sell',
        lots: r2(0.05 + rnd() * 0.2),
        entry: null,
        exit: null,
        pnl,
        setup: SETUPS[Math.floor(rnd() * 5)],
        note: '',
      });
      net = r2(net + pnl);
      n++;
    }
  }

  s.days[tk] = { target: s.settings.target, stop: s.settings.stop, closed: false, reopened: false, note: '', checks: [0, 1, 2] };
  s.trades.push(
    {
      id: `sample_${tk}_a`,
      date: tk,
      time: '07:05',
      symbol: 'XAUUSD',
      side: 'Buy',
      lots: 0.1,
      entry: null,
      exit: null,
      pnl: 21.5,
      setup: 'Pullback',
      note: 'Waited for the retest, clean entry.',
    },
    {
      id: `sample_${tk}_b`,
      date: tk,
      time: '07:48',
      symbol: 'EURUSD',
      side: 'Sell',
      lots: 0.15,
      entry: null,
      exit: null,
      pnl: -8.0,
      setup: 'Breakout',
      note: 'Cut quickly at planned stop.',
    }
  );

  s.lifeGoals = [
    {
      id: 'goal_emergency_fund',
      title: 'Build 6-Month Emergency Reserve',
      category: 'Financial',
      priority: 'High',
      deadline: addDays(tk, 90),
      progressType: 'numeric',
      currentValue: 3200,
      targetValue: 6000,
      unit: '$',
      milestones: [],
      completed: false,
      completedAt: null,
      note: 'Keep trading profits compounding outside my risk account.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'goal_prop_eval',
      title: 'Pass Funded Account Evaluation Without Rule Breaks',
      category: 'Trading Milestone',
      priority: 'High',
      deadline: addDays(tk, 21),
      progressType: 'milestones',
      currentValue: 0,
      targetValue: 0,
      unit: '',
      milestones: [
        { id: 'm1', label: '20 consecutive days respecting max daily loss', done: true },
        { id: 'm2', label: 'Reach 8% Phase 1 profit target', done: true },
        { id: 'm3', label: 'Complete Phase 2 verification cleanly', done: false },
      ],
      completed: false,
      completedAt: null,
      note: 'No overtrading after hitting daily lock.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'goal_half_marathon',
      title: 'Run Sub-1:50 Half Marathon',
      category: 'Health & Fitness',
      priority: 'Medium',
      deadline: addDays(tk, 55),
      progressType: 'numeric',
      currentValue: 14,
      targetValue: 21.1,
      unit: 'km',
      milestones: [],
      completed: false,
      completedAt: null,
      note: 'Morning runs before London session.',
      createdAt: new Date().toISOString(),
    },
  ];
  return s;
}

export function money(v: number, currency = '$', opts: { sign?: boolean; dec?: number } = {}): string {
  const a = Math.abs(v);
  const dec = opts.dec === 0 ? 0 : 2;
  const s =
    currency +
    a.toLocaleString('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  if (opts.sign) return (v > 0 ? '+' : v < 0 ? '−' : '') + s;
  return (v < 0 ? '−' : '') + s;
}

export const tradesOn = (state: DayLockState, k: string) => state.trades.filter((t) => t.date === k);
export const netOn = (state: DayLockState, k: string) => r2(tradesOn(state, k).reduce((a, t) => a + t.pnl, 0));

export const balanceBefore = (state: DayLockState, k: string) =>
  r2(state.settings.balance + state.trades.filter((t) => t.date < k).reduce((a, t) => a + t.pnl, 0));

export const balanceNow = (state: DayLockState) =>
  r2(state.settings.balance + state.trades.reduce((a, t) => a + t.pnl, 0));

export function resolveUnit(state: DayLockState, v: number, k: string): number {
  return state.settings.unit === 'pct' ? r2((balanceBefore(state, k) * v) / 100) : Number(v);
}

export function targetFor(state: DayLockState, k: string): number {
  const d = state.days[k];
  return d && d.target != null ? d.target : resolveUnit(state, state.settings.target, k);
}

export function stopFor(state: DayLockState, k: string): number {
  const d = state.days[k];
  return d && d.stop != null ? d.stop : resolveUnit(state, state.settings.stop, k);
}

export type LockStateKind = 'open' | 'target' | 'stop' | 'limit' | 'manual';

export function getDayStatus(state: DayLockState, k: string) {
  const d = state.days[k] || {};
  const tr = tradesOn(state, k);
  const net = netOn(state, k);
  const target = targetFor(state, k);
  const stop = stopFor(state, k);
  const max = Number(state.settings.maxTrades) || 0;
  let lockState: LockStateKind = 'open';
  if (d.closed) lockState = 'manual';
  else if (!d.reopened) {
    if (target > 0 && net >= target) lockState = 'target';
    else if (stop > 0 && net <= -stop) lockState = 'stop';
    else if (max > 0 && tr.length >= max) lockState = 'limit';
  }
  return {
    net,
    target,
    stop,
    n: tr.length,
    max,
    state: lockState,
    locked: lockState !== 'open',
    trades: tr,
  };
}

export function dayList(state: DayLockState) {
  const m: Record<string, number> = {};
  state.trades.forEach((t) => {
    m[t.date] = (m[t.date] || 0) + t.pnl;
  });
  return Object.keys(m)
    .sort()
    .map((k) => ({ k, net: r2(m[k]), target: targetFor(state, k) }));
}

export function summarizeTrades(tr: Trade[]) {
  const w = tr.filter((t) => t.pnl > 0);
  const l = tr.filter((t) => t.pnl < 0);
  const gp = w.reduce((a, t) => a + t.pnl, 0);
  const gl = Math.abs(l.reduce((a, t) => a + t.pnl, 0));
  const dec = w.length + l.length;
  return {
    n: tr.length,
    net: r2(gp - gl),
    wins: w.length,
    losses: l.length,
    wr: dec ? w.length / dec : 0,
    gp,
    gl,
    pf: gl ? gp / gl : gp ? Infinity : 0,
    avgW: w.length ? gp / w.length : 0,
    avgL: l.length ? gl / l.length : 0,
    exp: tr.length ? (gp - gl) / tr.length : 0,
  };
}

export function streaks(state: DayLockState) {
  const dl = dayList(state);
  let cur = 0;
  let best = 0;
  let run = 0;
  dl.forEach((d) => {
    if (d.net >= d.target && d.target > 0) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  });
  for (let i = dl.length - 1; i >= 0; i--) {
    if (dl[i].net >= dl[i].target && dl[i].target > 0) cur++;
    else break;
  }
  return { cur, best };
}

export function weekRange(k: string): [string, string] {
  const d = parseKey(k);
  const off = (d.getDay() + 6) % 7;
  const s = addDays(k, -off);
  return [s, addDays(s, 6)];
}

export const sumRange = (state: DayLockState, a: string, b: string) =>
  r2(state.trades.filter((t) => t.date >= a && t.date <= b).reduce((x, t) => x + t.pnl, 0));

/* ---------- Browser Download & Export Helpers ---------- */
export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportTradesCsv(state: DayLockState) {
  const headers = ['date', 'time', 'symbol', 'side', 'lots', 'entry', 'exit', 'pnl', 'setup', 'note'];
  const q = (v: unknown) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const rows = state.trades
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((t) => headers.map((k) => q(t[k as keyof Trade])).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  downloadFile(`daylock-trades-${todayKey()}.csv`, csv, 'text/csv;charset=utf-8');
}

export function exportLifeGoalsCsv(state: DayLockState) {
  const headers = ['title', 'category', 'priority', 'deadline', 'progressType', 'currentValue', 'targetValue', 'unit', 'progressPct', 'completed', 'note'];
  const q = (v: unknown) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const rows = state.lifeGoals
    .slice()
    .sort((a, b) => (a.deadline < b.deadline ? -1 : 1))
    .map((g) =>
      [
        q(g.title),
        q(g.category),
        q(g.priority),
        q(g.deadline),
        q(g.progressType),
        q(g.currentValue),
        q(g.targetValue),
        q(g.unit),
        q(goalProgressPct(g)),
        q(g.completed ? 'Yes' : 'No'),
        q(g.note),
      ].join(',')
    );
  const csv = [headers.join(','), ...rows].join('\n');
  downloadFile(`daylock-life-goals-${todayKey()}.csv`, csv, 'text/csv;charset=utf-8');
}

export function exportFullBackupJson(state: DayLockState) {
  const payload = JSON.stringify(state, null, 2);
  downloadFile(`daylock-memory-backup-${todayKey()}.json`, payload, 'application/json;charset=utf-8');
}

export function exportSummaryReportTxt(state: DayLockState) {
  const c = state.settings.currency;
  const sum = summarizeTrades(state.trades);
  const bal = balanceNow(state);
  const sk = streaks(state);
  const activeGoals = state.lifeGoals.filter((g) => !g.completed).sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
  const completedGoals = state.lifeGoals.filter((g) => g.completed);

  const lines = [
    `DAYLOCK PERFORMANCE & LIFE GOALS REPORT`,
    `Generated: ${new Date().toLocaleString()}`,
    `Trader: ${state.settings.displayName}`,
    `========================================`,
    ``,
    `TRADING SUMMARY`,
    `Current Balance: ${money(bal, c)} (Started: ${money(state.settings.balance, c)})`,
    `Total Net P/L:   ${money(sum.net, c, { sign: true })}`,
    `Total Trades:    ${sum.n} (${sum.wins} wins / ${sum.losses} losses)`,
    `Win Rate:        ${sum.n ? Math.round(sum.wr * 100) + '%' : '--'}`,
    `Profit Factor:   ${sum.pf === Infinity ? 'Infinite' : sum.pf.toFixed(2)}`,
    `Target Streak:   ${sk.cur} day(s) (Best: ${sk.best})`,
    ``,
    `ACTIVE LIFE GOALS (${activeGoals.length})`,
    ...activeGoals.map(
      (g, idx) =>
        `${idx + 1}. [${g.priority}] ${g.title} — Deadline: ${g.deadline} (${deadlineLabel(g).text}) — Progress: ${goalProgressPct(g)}%`
    ),
    ``,
    `COMPLETED LIFE GOALS (${completedGoals.length})`,
    ...completedGoals.map((g, idx) => `${idx + 1}. ${g.title} (${g.category})`),
    ``,
    `TRADING RULES`,
    ...state.settings.rules.map((r, idx) => `${idx + 1}. ${r}`),
    ``,
    `Why I trade this way: ${state.settings.why}`,
  ];
  downloadFile(`daylock-report-${todayKey()}.txt`, lines.join('\n'), 'text/plain;charset=utf-8');
}
