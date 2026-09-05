import { useMemo, useState } from 'react';
import { AnalysisResult } from '../lib/analysis';
import { trapezoid } from '../lib/lightcurve';

const W = 800;

function niceTicks(min: number, max: number, n = 5): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const raw = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(v);
  return ticks;
}

function fmt(v: number, digits = 3) {
  return Number.isInteger(v) ? v.toString() : v.toFixed(digits).replace(/\.?0+$/, '');
}

interface FrameProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}
export function ChartFrame({ title, subtitle, children, right }: FrameProps) {
  return (
    <div className="glass p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-white/90">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------
export function LightCurveChart({ result }: { result: AnalysisResult }) {
  const [mode, setMode] = useState<'raw' | 'detrended'>('raw');
  const H = 260;
  const pad = { l: 56, r: 14, t: 10, b: 30 };
  const { lc, detrended, trend, metrics } = result;

  const data = useMemo(() => {
    const n = lc.time.length;
    const step = Math.max(1, Math.ceil(n / 3500));
    const pts: { x: number; y: number; inTransit: boolean }[] = [];
    const tr: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i += step) {
      const t = lc.time[i];
      let ph = ((t - metrics.epoch) / metrics.period) % 1;
      if (ph < 0) ph += 1;
      if (ph > 0.5) ph -= 1;
      const inTransit = Math.abs(ph * metrics.period) < metrics.duration / 2;
      pts.push({ x: t, y: mode === 'raw' ? lc.flux[i] : detrended[i], inTransit });
      if (mode === 'raw') tr.push({ x: t, y: trend[i] });
    }
    return { pts, tr };
  }, [lc, detrended, trend, metrics, mode]);

  const xMin = lc.time[0];
  const xMax = lc.time[lc.time.length - 1];
  const ys = data.pts.map((p) => p.y);
  const sorted = [...ys].sort((a, b) => a - b);
  const yLo = sorted[Math.floor(sorted.length * 0.001)];
  const yHi = sorted[Math.floor(sorted.length * 0.999)];
  const yPad = (yHi - yLo) * 0.15 || 0.001;
  const yMin = yLo - yPad;
  const yMax = yHi + yPad;
  const sx = (x: number) => pad.l + ((x - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const xt = niceTicks(xMin, xMax, 6);
  const yt = niceTicks(yMin, yMax, 4);

  // transit markers
  const markers: number[] = [];
  const n0 = Math.ceil((xMin - metrics.epoch) / metrics.period);
  const n1 = Math.floor((xMax - metrics.epoch) / metrics.period);
  if (n1 - n0 < 400) for (let k = n0; k <= n1; k++) markers.push(metrics.epoch + k * metrics.period);

  return (
    <ChartFrame
      title="Light curve"
      subtitle={`${lc.name} · ${lc.time.length.toLocaleString()} cadences · ${(xMax - xMin).toFixed(1)} day baseline`}
      right={
        <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5 text-xs">
          {(['raw', 'detrended'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-md px-2.5 py-1 capitalize transition ${mode === m ? 'bg-nebula/80 text-white' : 'text-slate-400 hover:text-white'}`}>
              {m}
            </button>
          ))}
        </div>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: H }}>
        <defs>
          <linearGradient id="lcbg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="rgba(109,93,252,0.10)" />
            <stop offset="1" stopColor="rgba(109,93,252,0)" />
          </linearGradient>
        </defs>
        <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="url(#lcbg)" rx={6} />
        {yt.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke="rgba(255,255,255,0.06)" />
            <text x={pad.l - 6} y={sy(v) + 3} fontSize={10} fill="#94a3b8" textAnchor="end" fontFamily="var(--font-mono)">
              {fmt(v, 4)}
            </text>
          </g>
        ))}
        {xt.map((v) => (
          <g key={v}>
            <line x1={sx(v)} x2={sx(v)} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.05)" />
            <text x={sx(v)} y={H - pad.b + 14} fontSize={10} fill="#94a3b8" textAnchor="middle" fontFamily="var(--font-mono)">
              {fmt(v, 1)}
            </text>
          </g>
        ))}
        {markers.map((m) => (
          <line key={m} x1={sx(m)} x2={sx(m)} y1={pad.t} y2={H - pad.b} stroke="rgba(53,224,194,0.25)" strokeDasharray="2 3" />
        ))}
        {data.pts.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={p.inTransit ? 1.8 : 1.1} fill={p.inTransit ? '#35e0c2' : 'rgba(200,210,255,0.55)'} />
        ))}
        {mode === 'raw' && data.tr.length > 1 && (
          <path d={data.tr.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')} fill="none" stroke="#ff6a3d" strokeWidth={1.4} opacity={0.9} />
        )}
        <text x={W - pad.r} y={H - 4} fontSize={10} fill="#64748b" textAnchor="end">
          Time (BKJD days)
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full bg-slate-300/60" /> Flux</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full bg-aurora" /> In-transit points</span>
        {mode === 'raw' && <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3 bg-plasma" /> Running-median trend</span>}
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-px border-l border-dashed border-aurora/60" /> Predicted transit times</span>
      </div>
    </ChartFrame>
  );
}

// ------------------------------------------------------------------
export function PeriodogramChart({ result, onSelectPeriod }: { result: AnalysisResult; onSelectPeriod?: (p: number) => void }) {
  const H = 200;
  const pad = { l: 44, r: 14, t: 10, b: 30 };
  const { periodogram: pg } = result;
  const xs = pg.periods.map((p) => Math.log10(p));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMax = Math.max(...pg.power) * 1.1 || 1;
  const sx = (x: number) => pad.l + ((x - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - y / yMax) * (H - pad.t - pad.b);
  const path = pg.periods.map((p, i) => `${i ? 'L' : 'M'}${sx(Math.log10(p)).toFixed(1)},${sy(pg.power[i]).toFixed(1)}`).join('');
  const tickVals = [0.3, 0.5, 1, 2, 5, 10, 20, 50].filter((v) => Math.log10(v) >= xMin && Math.log10(v) <= xMax);
  const harmonics = [0.5, 2, 3].map((k) => pg.bestPeriod * k).filter((p) => Math.log10(p) >= xMin && Math.log10(p) <= xMax);

  return (
    <ChartFrame title="BLS periodogram" subtitle={`Box Least Squares over ${pg.periods.length.toLocaleString()} trial periods · peak at ${pg.bestPeriod.toFixed(4)} d · SDE ${pg.sde.toFixed(1)}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: H }}>
        <defs>
          <linearGradient id="pgfill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="rgba(53,224,194,0.45)" />
            <stop offset="1" stopColor="rgba(53,224,194,0)" />
          </linearGradient>
        </defs>
        {tickVals.map((v) => (
          <g key={v}>
            <line x1={sx(Math.log10(v))} x2={sx(Math.log10(v))} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.05)" />
            <text x={sx(Math.log10(v))} y={H - pad.b + 14} fontSize={10} fill="#94a3b8" textAnchor="middle" fontFamily="var(--font-mono)">
              {v}
            </text>
          </g>
        ))}
        {harmonics.map((p) => (
          <line key={p} x1={sx(Math.log10(p))} x2={sx(Math.log10(p))} y1={pad.t} y2={H - pad.b} stroke="rgba(255,106,61,0.35)" strokeDasharray="3 3" />
        ))}
        <path d={`${path}L${sx(xMax)},${sy(0)}L${sx(xMin)},${sy(0)}Z`} fill="url(#pgfill)" />
        <path d={path} fill="none" stroke="#35e0c2" strokeWidth={1.3} />
        <line x1={sx(Math.log10(pg.bestPeriod))} x2={sx(Math.log10(pg.bestPeriod))} y1={pad.t} y2={H - pad.b} stroke="#fff" strokeWidth={1} strokeDasharray="4 2" />
        <text x={Math.min(sx(Math.log10(pg.bestPeriod)) + 6, W - 120)} y={pad.t + 12} fontSize={11} fill="#fff" fontFamily="var(--font-mono)">
          P = {pg.bestPeriod.toFixed(4)} d
        </text>
        <text x={W - pad.r} y={H - 4} fontSize={10} fill="#64748b" textAnchor="end">
          Trial period (days, log scale)
        </text>
        <text x={12} y={pad.t + 8} fontSize={10} fill="#64748b" transform={`rotate(-90 12 ${pad.t + 8})`} textAnchor="end">
          BLS power
        </text>
        {onSelectPeriod && (
          <rect
            x={pad.l}
            y={pad.t}
            width={W - pad.l - pad.r}
            height={H - pad.t - pad.b}
            fill="transparent"
            className="cursor-crosshair"
            onClick={(e) => {
              const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
              const fx = (e.clientX - rect.left) / rect.width;
              onSelectPeriod(Math.pow(10, xMin + fx * (xMax - xMin)));
            }}
          />
        )}
      </svg>
      <p className="mt-1 text-[11px] text-slate-500">Dashed orange lines mark ½×, 2× and 3× harmonics of the best period.</p>
    </ChartFrame>
  );
}

// ------------------------------------------------------------------
export function PhaseFoldedChart({ result }: { result: AnalysisResult }) {
  const [zoom, setZoom] = useState(true);
  const H = 280;
  const pad = { l: 56, r: 14, t: 10, b: 30 };
  const { phase, detrended, binned, fit, metrics } = result;
  const durPhase = metrics.duration / metrics.period;
  const xLim = zoom ? Math.min(0.5, Math.max(durPhase * 2.5, 0.02)) : 0.5;

  const pts = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    const n = phase.length;
    const step = Math.max(1, Math.ceil(n / 5000));
    for (let i = 0; i < n; i += step) if (Math.abs(phase[i]) <= xLim) out.push({ x: phase[i], y: detrended[i] });
    return out;
  }, [phase, detrended, xLim]);

  const ys = pts.map((p) => p.y).sort((a, b) => a - b);
  const yLo = Math.min(ys[Math.floor(ys.length * 0.002)] ?? 0.99, 1 - fit.depth * 1.3);
  const yHi = ys[Math.floor(ys.length * 0.998)] ?? 1.01;
  const yPad = (yHi - yLo) * 0.12 || 0.001;
  const yMin = yLo - yPad;
  const yMax = yHi + yPad;
  const sx = (x: number) => pad.l + ((x + xLim) / (2 * xLim)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const yt = niceTicks(yMin, yMax, 4);
  const xt = niceTicks(-xLim, xLim, 6);

  // model curve
  const model: string[] = [];
  for (let i = 0; i <= 300; i++) {
    const ph = -xLim + (i / 300) * 2 * xLim;
    const y = 1 - fit.depth * trapezoid(ph * metrics.period, fit.duration, fit.ingressFrac);
    model.push(`${i ? 'L' : 'M'}${sx(ph).toFixed(1)},${sy(y).toFixed(1)}`);
  }
  const bin = binned.phase.map((p, i) => ({ x: p, y: binned.flux[i] })).filter((p) => Math.abs(p.x) <= xLim);

  return (
    <ChartFrame
      title="Phase-folded transit"
      subtitle={`Folded on P = ${metrics.period.toFixed(4)} d · depth ${metrics.depthPpm.toFixed(0)} ppm · duration ${(metrics.duration * 24).toFixed(2)} h · ${metrics.shape}-shaped`}
      right={
        <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5 text-xs">
          <button onClick={() => setZoom(true)} className={`rounded-md px-2.5 py-1 transition ${zoom ? 'bg-nebula/80 text-white' : 'text-slate-400 hover:text-white'}`}>Transit</button>
          <button onClick={() => setZoom(false)} className={`rounded-md px-2.5 py-1 transition ${!zoom ? 'bg-nebula/80 text-white' : 'text-slate-400 hover:text-white'}`}>Full phase</button>
        </div>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: H }}>
        {yt.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke="rgba(255,255,255,0.06)" />
            <text x={pad.l - 6} y={sy(v) + 3} fontSize={10} fill="#94a3b8" textAnchor="end" fontFamily="var(--font-mono)">
              {fmt(v, 5)}
            </text>
          </g>
        ))}
        {xt.map((v) => (
          <g key={v}>
            <line x1={sx(v)} x2={sx(v)} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.05)" />
            <text x={sx(v)} y={H - pad.b + 14} fontSize={10} fill="#94a3b8" textAnchor="middle" fontFamily="var(--font-mono)">
              {fmt(v, 3)}
            </text>
          </g>
        ))}
        {!zoom && (
          <>
            <rect x={sx(0.5 - durPhase / 2)} y={pad.t} width={Math.max(2, sx(0.5) - sx(0.5 - durPhase / 2))} height={H - pad.t - pad.b} fill="rgba(255,106,61,0.12)" />
            <rect x={sx(-0.5)} y={pad.t} width={Math.max(2, sx(-0.5 + durPhase / 2) - sx(-0.5))} height={H - pad.t - pad.b} fill="rgba(255,106,61,0.12)" />
            <text x={sx(-0.5) + 4} y={pad.t + 12} fontSize={10} fill="#ff6a3d">secondary (φ=0.5)</text>
          </>
        )}
        {pts.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={1.1} fill="rgba(200,210,255,0.35)" />
        ))}
        {bin.map((p, i) => (
          <circle key={`b${i}`} cx={sx(p.x)} cy={sy(p.y)} r={2.6} fill="#ffd98a" />
        ))}
        <path d={model.join('')} fill="none" stroke="#6d5dfc" strokeWidth={2.2} />
        <text x={W - pad.r} y={H - 4} fontSize={10} fill="#64748b" textAnchor="end">
          Orbital phase
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full bg-slate-300/40" /> Folded data</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full bg-star" /> Binned</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3 bg-nebula" /> Trapezoid model fit</span>
      </div>
    </ChartFrame>
  );
}
