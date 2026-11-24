import React from 'react';
import { money, r2 } from '../lib/domain';

function niceTicks(min: number, max: number, n: number) {
  let hi = max;
  let lo = min;
  if (hi - lo < 1e-9) hi = lo + 1;
  const raw = (hi - lo) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  const step = nf * p;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(r2(v));
  return { ticks, lo, hi };
}

function fmtTick(v: number, currency: string) {
  const sign = v < 0 ? '−' : '';
  const abs = Math.abs(v);
  return `${sign}${currency}${abs >= 1000 ? `${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k` : abs}`;
}

export const TargetRing: React.FC<{
  net: number;
  target: number;
  currency: string;
  hit: boolean;
}> = ({ net, target, currency, hit }) => {
  const pct = target > 0 ? Math.max(0, Math.min(1, net / target)) : 0;
  const r = 60;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);

  return (
    <div className="relative w-[150px] h-[150px] shrink-0">
      <svg viewBox="0 0 150 150" className="w-full h-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="dlRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={hit ? '#35d6a1' : '#5ee0ff'} />
            <stop offset="100%" stopColor={hit ? '#0f9a75' : '#1590f0'} />
          </linearGradient>
        </defs>
        <circle cx="75" cy="75" r={r} fill="none" stroke="rgba(10,28,46,0.12)" strokeWidth="14" />
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          stroke="url(#dlRingGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={c.toFixed(1)}
          strokeDashoffset={off.toFixed(1)}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <span
          className={`text-2xl font-bold tracking-tight font-mono-num leading-none ${
            net > 0 ? 'text-[#0a7a5a]' : net < 0 ? 'text-[#b83a27]' : 'text-[#0a1c2e]'
          }`}
        >
          {money(net, currency, { sign: true, dec: 0 })}
        </span>
        <span className="mt-1 text-[11px] text-[#4d6a80]">of {money(target, currency, { dec: 0 })}</span>
      </div>
    </div>
  );
};

export interface BarChartItem {
  v: number;
  label: string;
  title: string;
  cls: 'hit' | 'loss' | 'now' | 'plain';
}

export const SessionBarsChart: React.FC<{
  items: BarChartItem[];
  target: number | null;
  currency: string;
  ariaLabel: string;
}> = ({ items, target, currency, ariaLabel }) => {
  if (!items.length) {
    return (
      <div className="py-8 text-center text-sm text-[#4d6a80]">
        <p className="font-semibold text-[#0a1c2e]">No sessions yet</p>
        <p className="mt-1 text-xs">Your daily results will chart here once you log trades.</p>
      </div>
    );
  }

  const W = 640;
  const H = 225;
  const L = 56;
  const R = target != null && target > 0 ? 54 : 14;
  const T = 14;
  const B = 28;
  const vals = items.map((i) => i.v);
  const hiVal = Math.max(...vals, target || 0, 1);
  const loVal = Math.min(...vals, 0);
  const nt = niceTicks(loVal, hiVal, 4);
  const y = (v: number) => T + ((nt.hi - v) / (nt.hi - nt.lo)) * (H - T - B);
  const slot = (W - L - R) / Math.max(items.length, 1);
  const bw = Math.min(36, slot * 0.62);

  return (
    <svg className="w-full h-auto block" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      {nt.ticks.map((v) => (
        <g key={v}>
          <line
            x1={L}
            x2={W - R}
            y1={y(v)}
            y2={y(v)}
            stroke={v === 0 ? 'rgba(10,28,46,0.32)' : 'rgba(10,28,46,0.1)'}
            strokeWidth="1"
          />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" className="text-[12px] fill-[#4d6a80]">
            {fmtTick(v, currency)}
          </text>
        </g>
      ))}
      {items.map((it, i) => {
        const cx = L + slot * i + slot / 2;
        const y1 = y(Math.max(it.v, 0));
        const y2 = y(Math.min(it.v, 0));
        const h = Math.max(Math.abs(y2 - y1), 3);
        const fill =
          it.cls === 'hit'
            ? '#12b886'
            : it.cls === 'loss'
            ? '#e8553f'
            : it.cls === 'now'
            ? '#25b6f0'
            : '#7fc9ee';
        return (
          <g key={`${it.label}-${i}`}>
            <rect x={cx - bw / 2} y={it.v >= 0 ? y1 : y(0)} width={bw} height={h} rx="5" fill={fill}>
              <title>{it.title}</title>
            </rect>
            <text x={cx} y={H - 8} textAnchor="middle" className="text-[12px] fill-[#4d6a80]">
              {it.label}
            </text>
          </g>
        );
      })}
      {target != null && target > 0 && (
        <g>
          <line
            x1={L}
            x2={W - R}
            y1={y(target)}
            y2={y(target)}
            stroke="#ff6a1a"
            strokeWidth="1.6"
            strokeDasharray="5 4"
          />
          <text x={W - R + 6} y={y(target) + 4} className="text-[12px] font-semibold fill-[#ff6a1a]">
            Target
          </text>
        </g>
      )}
    </svg>
  );
};

export const EquityCurveChart: React.FC<{
  pts: { v: number; label: string }[];
  base: number;
  currency: string;
}> = ({ pts, base, currency }) => {
  if (pts.length < 2) {
    return (
      <div className="py-8 text-center text-sm text-[#4d6a80]">
        <p className="font-semibold text-[#0a1c2e]">Not enough days yet</p>
        <p className="mt-1 text-xs">Log trades on at least two days to view your balance curve.</p>
      </div>
    );
  }

  const W = 640;
  const H = 225;
  const L = 56;
  const R = 16;
  const T = 14;
  const B = 28;
  const vals = pts.map((p) => p.v);
  const nt = niceTicks(Math.min(...vals, base), Math.max(...vals, base), 4);
  const x = (i: number) => L + (W - L - R) * (i / (pts.length - 1));
  const y = (v: number) => T + ((nt.hi - v) / (nt.hi - nt.lo)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const last = pts.length - 1;
  const labelIndices = Array.from(new Set([0, Math.floor(last / 2), last]));

  return (
    <svg className="w-full h-auto block" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Account balance over time">
      <defs>
        <linearGradient id="dlEqGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1590f0" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#1590f0" stopOpacity="0" />
        </linearGradient>
      </defs>
      {nt.ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgba(10,28,46,0.1)" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" className="text-[12px] fill-[#4d6a80]">
            {fmtTick(v, currency)}
          </text>
        </g>
      ))}
      <path d={`${line} L${x(last)} ${H - B} L${x(0)} ${H - B}Z`} fill="url(#dlEqGrad)" />
      <line x1={L} x2={W - R} y1={y(base)} y2={y(base)} stroke="#ff6a1a" strokeDasharray="5 4" strokeWidth="1.4" />
      <path d={line} fill="none" stroke="#1590f0" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(pts[last].v)} r="5" fill="#1590f0" stroke="#fff" strokeWidth="2" />
      {labelIndices.map((idx, pos) => (
        <text
          key={idx}
          x={x(idx)}
          y={H - 8}
          textAnchor={pos === 0 ? 'start' : pos === labelIndices.length - 1 ? 'end' : 'middle'}
          className="text-[12px] fill-[#4d6a80]"
        >
          {pts[idx].label}
        </text>
      ))}
    </svg>
  );
};
