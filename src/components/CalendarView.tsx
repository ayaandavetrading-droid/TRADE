import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Percent, Plus, Trash2, Wallet } from 'lucide-react';
import {
  MONTHS,
  dayList,
  dkey,
  getDayStatus,
  longDate,
  money,
  netOn,
  pad,
  summarizeTrades,
  targetFor,
  todayKey,
  tradesOn,
} from '../lib/domain';
import { DayLockState } from '../types';

interface Props {
  state: DayLockState;
  onOpenTrade: (date: string) => void;
  onDeleteTrade: (id: string) => void;
  onSaveDayNote: (date: string, note: string) => void;
}

export const CalendarView: React.FC<Props> = ({ state, onOpenTrade, onDeleteTrade, onSaveDayNote }) => {
  const tk = todayKey();
  const c = state.settings.currency || '$';
  const [calMonth, setCalMonth] = useState(tk.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(tk);
  const [noteDraft, setNoteDraft] = useState(state.days[tk]?.note || '');
  const [armedId, setArmedId] = useState<string | null>(null);

  useEffect(() => {
    setNoteDraft(state.days[selectedDay]?.note || '');
  }, [selectedDay, state.days]);

  const [Y, M] = calMonth.split('-').map(Number);
  const first = new Date(Y, M - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const dim = new Date(Y, M, 0).getDate();
  const total = Math.ceil((lead + dim) / 7) * 7;

  const { ms, days, hitDays, greenDays, redDays, bestDay } = useMemo(() => {
    const mTrades = state.trades.filter((t) => t.date.slice(0, 7) === calMonth);
    const mDays = dayList(state).filter((d) => d.k.slice(0, 7) === calMonth);
    return {
      ms: summarizeTrades(mTrades),
      days: mDays,
      hitDays: mDays.filter((d) => d.net >= d.target && d.target > 0).length,
      greenDays: mDays.filter((d) => d.net > 0).length,
      redDays: mDays.filter((d) => d.net < 0).length,
      bestDay: mDays.reduce((a, d) => (d.net > a ? d.net : a), 0),
    };
  }, [state, calMonth]);

  const selectedStatus = getDayStatus(state, selectedDay);
  const selectedTrades = selectedStatus.trades.slice().sort((a, b) => (a.time < b.time ? -1 : 1));

  const shiftMonth = (delta: number) => {
    const d = new Date(Y, M - 1 + delta, 1);
    setCalMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#0a1c2e]">Calendar</h1>
        <p className="mt-1 text-xs sm:text-sm text-[#2a465c]">
          Every session where you hit your target locks in green.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {[
          { icon: Wallet, label: 'Month net', big: money(ms.net, c, { sign: true }), note: `${days.length} trading days` },
          { icon: Check, label: 'Target days', big: String(hitDays), note: `of ${days.length} traded` },
          {
            icon: ArrowUpRight,
            label: 'Green / red days',
            big: `${greenDays} / ${redDays}`,
            note: `Best ${money(bestDay, c, { sign: true, dec: 0 })}`,
          },
          { icon: Percent, label: 'Win rate', big: ms.n ? `${Math.round(ms.wr * 100)}%` : '--', note: `${ms.n} trades` },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <section key={item.label} className="glass-card rounded-2xl p-3.5 sm:p-4">
              <div className="w-8 h-8 rounded-xl bg-white/90 border border-white flex items-center justify-center text-[#2a465c] mb-2">
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-lg sm:text-xl font-bold font-mono-num text-[#0a1c2e] truncate">{item.big}</p>
              <p className="text-xs font-medium text-[#2a465c]">{item.label}</p>
              <p className="text-[11px] text-[#4d6a80]">{item.note}</p>
            </section>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        <section className="glass-card rounded-2xl p-3.5 sm:p-5 lg:col-span-8">
          <div className="flex flex-wrap items-center gap-2 mb-3.5">
            <h2 className="text-base sm:text-lg font-semibold text-[#0a1c2e] mr-auto sm:mr-2">
              {MONTHS[M - 1]} {Y}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="h-10 w-10 sm:h-9 sm:w-9 rounded-xl bg-white/85 border border-white flex items-center justify-center hover:bg-white tap-press"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalMonth(tk.slice(0, 7));
                  setSelectedDay(tk);
                }}
                className="h-10 sm:h-9 px-3 rounded-xl bg-white/85 border border-white text-xs font-semibold hover:bg-white tap-press"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="h-10 sm:h-9 w-10 sm:w-9 rounded-xl bg-white/85 border border-white flex items-center justify-center hover:bg-white tap-press"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#4d6a80] mb-1.5">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {Array.from({ length: total }).map((_, i) => {
              const dn = i - lead + 1;
              const inM = dn >= 1 && dn <= dim;
              const d = new Date(Y, M - 1, dn);
              const k = dkey(d);

              if (!inM) {
                return (
                  <div
                    key={`out-${i}`}
                    className="min-h-[54px] sm:min-h-[68px] p-1.5 sm:p-2 rounded-xl bg-white/25 opacity-35 text-[11px] sm:text-xs font-semibold"
                  >
                    {d.getDate()}
                  </div>
                );
              }

              const tr = tradesOn(state, k);
              const net = netOn(state, k);
              const tg = targetFor(state, k);
              const isHit = tr.length > 0 && net >= tg && tg > 0;
              const isWin = tr.length > 0 && !isHit && net > 0;
              const isLoss = tr.length > 0 && net < 0;

              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedDay(k)}
                  className={`relative min-h-[54px] sm:min-h-[68px] p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between tap-press ${
                    isHit
                      ? 'bg-gradient-to-br from-[#27c79a] to-[#0f9a75] border-[#0f9a75] text-white'
                      : isWin
                      ? 'bg-[#12b886]/20 border-[#12b886]/40 text-[#0a1c2e]'
                      : isLoss
                      ? 'bg-[#e8553f]/20 border-[#e8553f]/40 text-[#0a1c2e]'
                      : 'bg-white/60 border-white/85 text-[#0a1c2e] hover:bg-white/85'
                  } ${k === tk ? 'ring-2 ring-[#ff6a1a]' : ''} ${
                    k === selectedDay ? 'outline-2 outline-[#1590f0] outline-offset-1' : ''
                  } ${k > tk ? 'opacity-55' : ''}`}
                >
                  <span className="text-[11px] sm:text-xs font-semibold leading-none">{dn}</span>
                  {isHit && <Check className="hidden sm:block w-3.5 h-3.5 absolute top-2 right-2" />}
                  {tr.length > 0 && (
                    <div className="min-w-0">
                      <span
                        className={`block text-[10px] sm:text-xs font-bold font-mono-num truncate ${
                          isHit ? 'text-white' : net > 0 ? 'text-[#0a7a5a]' : net < 0 ? 'text-[#b83a27]' : ''
                        }`}
                      >
                        {money(net, c, { sign: true, dec: Math.abs(net) >= 100 ? 0 : undefined })}
                      </span>
                      <span className={`hidden sm:block text-[10px] ${isHit ? 'text-white/90' : 'text-[#4d6a80]'}`}>
                        {tr.length} trade{tr.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 sm:gap-4 mt-4 text-xs text-[#2a465c]">
            <span className="inline-flex items-center gap-1.5">
              <i className="w-3 h-3 rounded bg-[#12b886] inline-block" /> Target hit
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-3 h-3 rounded bg-[#12b886]/40 inline-block" /> Profit
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-3 h-3 rounded bg-[#e8553f]/40 inline-block" /> Loss
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-3 h-3 rounded bg-white ring-2 ring-[#ff6a1a] inline-block" /> Today
            </span>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-4 sm:p-5 lg:col-span-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#0a1c2e]">{longDate(selectedDay)}</h2>
              <p className="text-xs text-[#4d6a80]">
                {selectedStatus.n
                  ? `${selectedStatus.n} trade${selectedStatus.n > 1 ? 's' : ''} · target ${money(
                      selectedStatus.target,
                      c,
                      { dec: 0 }
                    )}`
                  : 'No trades logged'}
              </p>
            </div>
            {selectedStatus.n > 0 && (
              <span
                className={`text-xs font-bold font-mono-num ${
                  selectedStatus.net >= selectedStatus.target && selectedStatus.target > 0
                    ? 'text-[#0a7a5a]'
                    : selectedStatus.net < 0
                    ? 'text-[#b83a27]'
                    : 'text-[#0b62ad]'
                }`}
              >
                {money(selectedStatus.net, c, { sign: true })}
              </span>
            )}
          </div>

          {selectedTrades.length ? (
            <div className="divide-y divide-[#0a1c2e]/10">
              {selectedTrades.map((t) => (
                <div key={t.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                  <div>
                    <span className="font-semibold">{t.symbol}</span>{' '}
                    <span className={`text-xs font-semibold ${t.side === 'Buy' ? 'text-[#0b62ad]' : 'text-[#b24a0b]'}`}>
                      {t.side}
                    </span>{' '}
                    <span className="text-xs text-[#4d6a80] font-mono-num">{t.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-semibold font-mono-num ${
                        t.pnl > 0 ? 'text-[#0a7a5a]' : t.pnl < 0 ? 'text-[#b83a27]' : 'text-[#2a465c]'
                      }`}
                    >
                      {money(t.pnl, c, { sign: true })}
                    </span>
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
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-[#4d6a80] hover:bg-white hover:text-[#b83a27]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-[#4d6a80]">
              {selectedDay > tk ? 'This day has not happened yet.' : 'No trades logged on this date.'}
            </div>
          )}

          <label className="block text-xs font-semibold text-[#2a465c]">
            Day journal note
            <textarea
              rows={3}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => onSaveDayNote(selectedDay, noteDraft.trim())}
              placeholder="What went well? What would you refine?"
              className="mt-1.5 w-full p-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm text-[#0a1c2e]"
            />
          </label>

          <button
            type="button"
            disabled={selectedDay > tk}
            onClick={() => onOpenTrade(selectedDay)}
            className="w-full h-11 rounded-xl bg-[#0a1c2e] hover:bg-[#13304a] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed tap-press"
          >
            <Plus className="w-4 h-4" /> Add trade to this day
          </button>
        </section>
      </div>
    </div>
  );
};
