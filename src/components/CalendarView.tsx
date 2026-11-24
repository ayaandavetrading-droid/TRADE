import React, { useEffect, useState } from 'react';
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

  const monthTrades = state.trades.filter((t) => t.date.slice(0, 7) === calMonth);
  const ms = summarizeTrades(monthTrades);
  const days = dayList(state).filter((d) => d.k.slice(0, 7) === calMonth);
  const hitDays = days.filter((d) => d.net >= d.target && d.target > 0).length;
  const greenDays = days.filter((d) => d.net > 0).length;
  const redDays = days.filter((d) => d.net < 0).length;
  const bestDay = days.reduce((a, d) => (d.net > a ? d.net : a), 0);

  const selectedStatus = getDayStatus(state, selectedDay);
  const selectedTrades = selectedStatus.trades.slice().sort((a, b) => (a.time < b.time ? -1 : 1));

  const shiftMonth = (delta: number) => {
    const d = new Date(Y, M - 1 + delta, 1);
    setCalMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0a1c2e]">Calendar</h1>
        <p className="mt-1 text-sm text-[#2a465c]">Every session where you hit your target locks in green.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            <section key={item.label} className="glass-card rounded-2xl p-4">
              <div className="w-8 h-8 rounded-xl bg-white/80 border border-white flex items-center justify-center text-[#2a465c] mb-2">
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold font-mono-num text-[#0a1c2e]">{item.big}</p>
              <p className="text-xs font-medium text-[#2a465c]">{item.label}</p>
              <p className="text-[11px] text-[#4d6a80]">{item.note}</p>
            </section>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        <section className="glass-card rounded-2xl p-5 lg:col-span-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-[#0a1c2e] mr-2">
              {MONTHS[M - 1]} {Y}
            </h2>
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="h-9 w-9 rounded-xl bg-white/80 border border-white flex items-center justify-center hover:bg-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCalMonth(tk.slice(0, 7));
                setSelectedDay(tk);
              }}
              className="h-9 px-3 rounded-xl bg-white/80 border border-white text-xs font-semibold hover:bg-white"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="h-9 w-9 rounded-xl bg-white/80 border border-white flex items-center justify-center hover:bg-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#4d6a80] mb-1.5">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: total }).map((_, i) => {
              const dn = i - lead + 1;
              const inM = dn >= 1 && dn <= dim;
              const d = new Date(Y, M - 1, dn);
              const k = dkey(d);

              if (!inM) {
                return (
                  <div key={`out-${i}`} className="min-h-[68px] p-2 rounded-xl bg-white/25 opacity-35 text-xs font-semibold">
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
                  className={`relative min-h-[68px] p-2 rounded-xl border text-left flex flex-col justify-between transition-colors ${
                    isHit
                      ? 'bg-gradient-to-br from-[#27c79a] to-[#0f9a75] border-[#0f9a75] text-white'
                      : isWin
                      ? 'bg-[#12b886]/20 border-[#12b886]/40 text-[#0a1c2e]'
                      : isLoss
                      ? 'bg-[#e8553f]/20 border-[#e8553f]/40 text-[#0a1c2e]'
                      : 'bg-white/50 border-white/80 text-[#0a1c2e] hover:bg-white/75'
                  } ${k === tk ? 'ring-2 ring-[#ff6a1a]' : ''} ${
                    k === selectedDay ? 'outline-2 outline-[#1590f0] outline-offset-1' : ''
                  } ${k > tk ? 'opacity-55' : ''}`}
                >
                  <span className="text-xs font-semibold">{dn}</span>
                  {isHit && <Check className="w-3.5 h-3.5 absolute top-2 right-2" />}
                  {tr.length > 0 && (
                    <div>
                      <span
                        className={`block text-xs font-bold font-mono-num ${
                          isHit ? 'text-white' : net > 0 ? 'text-[#0a7a5a]' : net < 0 ? 'text-[#b83a27]' : ''
                        }`}
                      >
                        {money(net, c, { sign: true, dec: Math.abs(net) >= 1000 ? 0 : undefined })}
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

          <div className="flex flex-wrap gap-4 mt-4 text-xs text-[#2a465c]">
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

        <section className="glass-card rounded-2xl p-5 lg:col-span-4 space-y-3">
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
                        className="h-7 px-2 rounded bg-[#e8553f] text-white text-xs font-semibold"
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
                        <Trash2 className="w-3.5 h-3.5" />
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
            className="w-full h-10 rounded-xl bg-[#0a1c2e] hover:bg-[#13304a] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Add trade to this day
          </button>
        </section>
      </div>
    </div>
  );
};
