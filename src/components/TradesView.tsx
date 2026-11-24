import React, { useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { MONTHS, exportTradesCsv, getDayStatus, money, summarizeTrades, todayKey } from '../lib/domain';
import { DayLockState, TradeFilter } from '../types';

interface Props {
  state: DayLockState;
  filter: TradeFilter;
  onChangeFilter: (f: TradeFilter) => void;
  onOpenTrade: (date: string) => void;
  onDeleteTrade: (id: string) => void;
  onToast: (msg: string) => void;
}

export const TradesView: React.FC<Props> = ({
  state,
  filter,
  onChangeFilter,
  onOpenTrade,
  onDeleteTrade,
  onToast,
}) => {
  const tk = todayKey();
  const c = state.settings.currency || '$';
  const [armedId, setArmedId] = useState<string | null>(null);

  const months = Array.from(new Set(state.trades.map((t) => t.date.slice(0, 7)))).sort().reverse();

  let list = state.trades.slice();
  if (filter.month !== 'all') list = list.filter((t) => t.date.slice(0, 7) === filter.month);
  if (filter.result === 'win') list = list.filter((t) => t.pnl > 0);
  if (filter.result === 'loss') list = list.filter((t) => t.pnl < 0);
  if (filter.result === 'be') list = list.filter((t) => t.pnl === 0);
  const q = filter.query.trim().toLowerCase();
  if (q) {
    list = list.filter((t) =>
      `${t.symbol} ${t.setup} ${t.note} ${t.side}`.toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => (a.date === b.date ? (a.time < b.time ? 1 : -1) : a.date < b.date ? 1 : -1));

  const sum = summarizeTrades(list);
  const todayLocked = getDayStatus(state, tk).locked;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0a1c2e]">Trade log</h1>
          <p className="mt-1 text-sm text-[#2a465c]">Every execution stored in memory, searchable and exportable.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              exportTradesCsv(state);
              onToast('Trades CSV downloaded');
            }}
            className="h-10 px-4 rounded-xl bg-white/80 hover:bg-white border border-white text-sm font-semibold text-[#0a1c2e] inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            type="button"
            disabled={todayLocked}
            onClick={() => onOpenTrade(tk)}
            className="h-10 px-4 rounded-xl bg-[#0a1c2e] hover:bg-[#13304a] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Log trade
          </button>
        </div>
      </div>

      <section className="glass-card rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block text-xs font-semibold text-[#2a465c]">
            Month
            <select
              value={filter.month}
              onChange={(e) => onChangeFilter({ ...filter, month: e.target.value })}
              className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm text-[#0a1c2e]"
            >
              <option value="all">All time</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {MONTHS[Number(m.slice(5)) - 1]} {m.slice(0, 4)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-[#2a465c]">
            Result
            <select
              value={filter.result}
              onChange={(e) =>
                onChangeFilter({ ...filter, result: e.target.value as TradeFilter['result'] })
              }
              className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm text-[#0a1c2e]"
            >
              <option value="all">All</option>
              <option value="win">Wins</option>
              <option value="loss">Losses</option>
              <option value="be">Break-even</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-[#2a465c]">
            Search
            <input
              type="search"
              placeholder="Symbol, setup, note"
              value={filter.query}
              onChange={(e) => onChangeFilter({ ...filter, query: e.target.value })}
              className="mt-1 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm text-[#0a1c2e]"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2 border-t border-[#0a1c2e]/10">
          <h2 className="text-sm font-semibold text-[#0a1c2e]">
            {list.length} trade{list.length === 1 ? '' : 's'}
          </h2>
          <p className="text-xs text-[#4d6a80]">
            Net{' '}
            <strong
              className={`font-mono-num ${
                sum.net > 0 ? 'text-[#0a7a5a]' : sum.net < 0 ? 'text-[#b83a27]' : 'text-[#0a1c2e]'
              }`}
            >
              {money(sum.net, c, { sign: true })}
            </strong>{' '}
            · win rate {list.length ? `${Math.round(sum.wr * 100)}%` : '--'}
          </p>
        </div>

        {list.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[#4d6a80]">
                  <th className="py-2 px-2">Date</th>
                  <th className="py-2 px-2">Time</th>
                  <th className="py-2 px-2">Symbol</th>
                  <th className="py-2 px-2">Side</th>
                  <th className="py-2 px-2 text-right">Lots</th>
                  <th className="py-2 px-2 text-right">Result</th>
                  <th className="py-2 px-2">Setup</th>
                  <th className="py-2 px-2">Note</th>
                  <th className="py-2 px-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} className="border-t border-[#0a1c2e]/10 hover:bg-white/40">
                    <td className="py-2.5 px-2 font-mono-num text-xs text-[#2a465c] whitespace-nowrap">{t.date}</td>
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
                      className={`py-2.5 px-2 text-right font-semibold font-mono-num whitespace-nowrap ${
                        t.pnl > 0 ? 'text-[#0a7a5a]' : t.pnl < 0 ? 'text-[#b83a27]' : 'text-[#2a465c]'
                      }`}
                    >
                      {money(t.pnl, c, { sign: true })}
                    </td>
                    <td className="py-2.5 px-2 text-xs text-[#2a465c]">{t.setup}</td>
                    <td className="py-2.5 px-2 text-xs text-[#4d6a80] max-w-[240px]">{t.note}</td>
                    <td className="py-2.5 px-2 text-right">
                      {armedId === t.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            setArmedId(null);
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
                            setArmedId(t.id);
                            setTimeout(() => setArmedId((cur) => (cur === t.id ? null : cur)), 2800);
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
        ) : (
          <div className="py-10 text-center text-sm text-[#4d6a80]">
            <p className="font-semibold text-[#0a1c2e]">No trades match</p>
            <p className="mt-1 text-xs">Adjust the filters or log a new trade.</p>
          </div>
        )}
      </section>
    </div>
  );
};
