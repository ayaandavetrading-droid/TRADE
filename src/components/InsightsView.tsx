import React from 'react';
import { Activity, Flame, Layers, Percent, Target, Wallet } from 'lucide-react';
import { dayList, money, parseKey, r2, shortLab, streaks, summarizeTrades } from '../lib/domain';
import { DayLockState, Trade } from '../types';
import { BarChartItem, EquityCurveChart, SessionBarsChart } from './Charts';

interface Props {
  state: DayLockState;
}

export const InsightsView: React.FC<Props> = ({ state }) => {
  const c = state.settings.currency || '$';
  const sum = summarizeTrades(state.trades);
  const sk = streaks(state);
  const dl = dayList(state);
  const targetDays = dl.filter((d) => d.net >= d.target && d.target > 0).length;

  let running = state.settings.balance;
  const pts = dl.map((d) => {
    running = r2(running + d.net);
    return { v: running, label: shortLab(d.k) };
  });

  const wd = [0, 0, 0, 0, 0, 0, 0];
  dl.forEach((d) => {
    wd[(parseKey(d.k).getDay() + 6) % 7] += d.net;
  });
  const wl = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const wItems: BarChartItem[] = wl.map((label, i) => ({
    v: r2(wd[i]),
    label,
    title: `${label}: ${money(wd[i], c, { sign: true })}`,
    cls: wd[i] < 0 ? 'loss' : 'plain',
  }));

  const groupBy = (fn: (t: Trade) => string) => {
    const map: Record<string, Trade[]> = {};
    state.trades.forEach((t) => {
      const k = fn(t) || 'Other';
      (map[k] = map[k] || []).push(t);
    });
    return Object.keys(map)
      .map((k) => ({ k, ...summarizeTrades(map[k]) }))
      .sort((a, b) => b.net - a.net);
  };

  const renderGroupList = (rows: ReturnType<typeof groupBy>) =>
    rows.length ? (
      <div className="divide-y divide-[#0a1c2e]/10">
        {rows.map((r) => (
          <div key={r.k} className="py-2.5 flex items-center justify-between gap-2 text-sm">
            <div>
              <strong className="font-semibold text-[#0a1c2e]">{r.k}</strong>{' '}
              <span className="text-xs text-[#4d6a80]">
                {r.n} trades · {Math.round(r.wr * 100)}% wins
              </span>
            </div>
            <strong
              className={`font-mono-num ${
                r.net > 0 ? 'text-[#0a7a5a]' : r.net < 0 ? 'text-[#b83a27]' : 'text-[#0a1c2e]'
              }`}
            >
              {money(r.net, c, { sign: true })}
            </strong>
          </div>
        ))}
      </div>
    ) : (
      <div className="py-8 text-center text-xs text-[#4d6a80]">No data logged yet</div>
    );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0a1c2e]">Insights</h1>
        <p className="mt-1 text-sm text-[#2a465c]">What is working in your edge, and what is costing you.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Wallet, label: 'Total net', big: money(sum.net, c, { sign: true }), note: `${sum.n} trades` },
          {
            icon: Percent,
            label: 'Win rate',
            big: sum.n ? `${Math.round(sum.wr * 100)}%` : '--',
            note: `${sum.wins}W · ${sum.losses}L`,
          },
          {
            icon: Layers,
            label: 'Profit factor',
            big: sum.pf === Infinity ? '∞' : sum.pf.toFixed(2),
            note: 'Gross win ÷ loss',
          },
          {
            icon: Activity,
            label: 'Avg win / loss',
            big: `${money(sum.avgW, c, { dec: 0 })} / ${money(sum.avgL, c, { dec: 0 })}`,
            note: `Exp ${money(sum.exp, c, { sign: true })}`,
          },
          {
            icon: Target,
            label: 'Target days',
            big: dl.length ? `${Math.round((targetDays / dl.length) * 100)}%` : '--',
            note: `${targetDays} of ${dl.length} days`,
          },
          { icon: Flame, label: 'Best streak', big: `${sk.best}d`, note: `Current ${sk.cur}d` },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <section key={item.label} className="glass-card rounded-2xl p-4">
              <div className="w-8 h-8 rounded-xl bg-white/80 border border-white flex items-center justify-center text-[#2a465c] mb-2">
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-lg font-bold font-mono-num text-[#0a1c2e] truncate">{item.big}</p>
              <p className="text-xs font-medium text-[#2a465c]">{item.label}</p>
              <p className="text-[11px] text-[#4d6a80] truncate">{item.note}</p>
            </section>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        <section className="glass-card rounded-2xl p-5 lg:col-span-7">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0a1c2e]">Account balance</h2>
            <p className="text-xs text-[#4d6a80]">End of each trading day. Dashed line is starting balance.</p>
          </div>
          <EquityCurveChart pts={pts} base={state.settings.balance} currency={c} />
        </section>

        <section className="glass-card rounded-2xl p-5 lg:col-span-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0a1c2e]">Net by weekday</h2>
            <p className="text-xs text-[#4d6a80]">Which sessions pay you best</p>
          </div>
          {dl.length ? (
            <SessionBarsChart items={wItems} target={null} currency={c} ariaLabel="Net profit by weekday" />
          ) : (
            <div className="py-8 text-center text-xs text-[#4d6a80]">No sessions logged yet</div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <section className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-[#0a1c2e] mb-2">By symbol</h2>
          {renderGroupList(groupBy((t) => t.symbol))}
        </section>
        <section className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-[#0a1c2e] mb-2">By setup</h2>
          {renderGroupList(groupBy((t) => t.setup))}
        </section>
      </div>
    </div>
  );
};
