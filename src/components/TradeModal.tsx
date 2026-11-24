import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { SETUPS, SYMBOLS, pad, r2, todayKey } from '../lib/domain';
import { Side, Trade, TradeResult } from '../types';

interface Props {
  open: boolean;
  defaultDate: string;
  currency: string;
  onClose: () => void;
  onSave: (trade: Omit<Trade, 'id'>) => void;
  onToast: (msg: string) => void;
}

export const TradeModal: React.FC<Props> = ({ open, defaultDate, currency, onClose, onSave, onToast }) => {
  const tk = todayKey();
  const now = new Date();
  const [symbol, setSymbol] = useState(() => {
    try {
      return localStorage.getItem('daylock.sym') || 'XAUUSD';
    } catch {
      return 'XAUUSD';
    }
  });
  const [side, setSide] = useState<Side>('Buy');
  const [result, setResult] = useState<TradeResult>('win');
  const [amount, setAmount] = useState('');
  const [lots, setLots] = useState('');
  const [setup, setSetup] = useState(SETUPS[0]);
  const [entry, setEntry] = useState('');
  const [exit, setExit] = useState('');
  const [date, setDate] = useState(defaultDate || tk);
  const [time, setTime] = useState(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
  const [note, setNote] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.abs(parseFloat(amount) || 0);
    if (result !== 'be' && amt <= 0) {
      onToast('Enter the win or loss amount');
      return;
    }
    if (date > tk) {
      onToast('Trade date cannot be in the future');
      return;
    }
    const cleanSym = symbol.trim().toUpperCase() || 'TRADE';
    try {
      localStorage.setItem('daylock.sym', cleanSym);
    } catch {
      // ignore
    }
    const toNum = (val: string) => {
      const parsed = parseFloat(val);
      return Number.isFinite(parsed) ? parsed : null;
    };

    onSave({
      date,
      time,
      symbol: cleanSym,
      side,
      lots: toNum(lots),
      entry: toNum(entry),
      exit: toNum(exit),
      pnl: result === 'win' ? r2(amt) : result === 'loss' ? -r2(amt) : 0,
      setup,
      note: note.trim(),
    });
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
        aria-label="Log a trade"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Log a trade</h2>
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
          <label className="block text-xs font-semibold text-[#2a465c]">
            Symbol
            <input
              list="daylock-syms"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              required
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-medium text-[#0a1c2e]"
            />
            <datalist id="daylock-syms">
              {SYMBOLS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>

          <div className="text-xs font-semibold text-[#2a465c]">
            Side
            <div className="mt-1.5 grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0a1c2e]/10">
              {(['Buy', 'Sell'] as Side[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={`h-8 rounded-lg text-xs font-semibold transition-colors ${
                    side === s ? 'bg-white text-[#0a1c2e] shadow-sm' : 'text-[#2a465c]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 text-xs font-semibold text-[#2a465c]">
            Result
            <div className="mt-1.5 grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0a1c2e]/10">
              {(
                [
                  ['win', 'Win', 'bg-[#12b886] text-white'],
                  ['loss', 'Loss', 'bg-[#e8553f] text-white'],
                  ['be', 'Break-even', 'bg-[#5c7285] text-white'],
                ] as const
              ).map(([val, label, activeCls]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setResult(val)}
                  className={`h-8 rounded-lg text-xs font-semibold transition-colors ${
                    result === val ? `${activeCls} shadow-sm` : 'text-[#2a465c]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="sm:col-span-2 block text-xs font-semibold text-[#2a465c]">
            Amount ({currency})
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required={result !== 'be'}
              disabled={result === 'be'}
              autoFocus
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num text-[#0a1c2e] disabled:opacity-50"
            />
          </label>

          <label className="block text-xs font-semibold text-[#2a465c]">
            Lot size
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.10"
              value={lots}
              onChange={(e) => setLots(e.target.value)}
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num text-[#0a1c2e]"
            />
          </label>

          <label className="block text-xs font-semibold text-[#2a465c]">
            Setup
            <select
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-medium text-[#0a1c2e]"
            >
              {SETUPS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-[#2a465c]">
            Entry price
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num text-[#0a1c2e]"
            />
          </label>

          <label className="block text-xs font-semibold text-[#2a465c]">
            Exit price
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={exit}
              onChange={(e) => setExit(e.target.value)}
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm font-mono-num text-[#0a1c2e]"
            />
          </label>

          <label className="block text-xs font-semibold text-[#2a465c]">
            Date
            <input
              type="date"
              max={tk}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm text-[#0a1c2e]"
            />
          </label>

          <label className="block text-xs font-semibold text-[#2a465c]">
            Time
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-[#0a1c2e]/15 bg-white text-sm text-[#0a1c2e]"
            />
          </label>

          <label className="sm:col-span-2 block text-xs font-semibold text-[#2a465c]">
            Note
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why did you take this setup?"
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
            Save trade
          </button>
        </div>
      </form>
    </div>
  );
};
