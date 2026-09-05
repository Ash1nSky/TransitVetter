import { useState } from 'react';
import { AnalysisResult } from '../lib/analysis';
import PlanetVisual from './PlanetVisual';

function Gauge({ p }: { p: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0.005, Math.min(0.995, p));
  const color = p >= 0.62 ? '#35e0c2' : p <= 0.4 ? '#ff6a3d' : '#ffd98a';
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dasharray 1s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold text-white">{(p * 100).toFixed(0)}%</span>
        <span className="text-[10px] uppercase tracking-widest text-slate-400">P(planet)</span>
      </div>
    </div>
  );
}

function Stat({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5" title={hint}>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-white">
        {value} {unit && <span className="text-xs text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

export default function ResultPanel({ result, truth }: { result: AnalysisResult; truth?: 'planet' | 'false-positive' }) {
  const { classification: c, metrics: m, planet: p, stellar } = result;
  const [open, setOpen] = useState<string | null>(null);
  const verdictColor = c.verdict === 'PLANET' ? 'text-aurora' : c.verdict === 'FALSE POSITIVE' ? 'text-plasma' : 'text-star';
  const verdictBg = c.verdict === 'PLANET' ? 'from-aurora/20 to-transparent border-aurora/30' : c.verdict === 'FALSE POSITIVE' ? 'from-plasma/20 to-transparent border-plasma/30' : 'from-star/20 to-transparent border-star/30';
  const truthMatch = truth ? (truth === 'planet') === (c.verdict === 'PLANET') : undefined;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Verdict card */}
      <div className={`glass fade-up border bg-gradient-to-br p-5 lg:col-span-2 ${verdictBg}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Disposition</div>
            <h2 className={`mt-1 text-3xl font-bold tracking-tight ${verdictColor} glow-text`}>{c.verdict}</h2>
            {c.fpType && <p className="mt-1 text-sm text-slate-300">{c.fpType}</p>}
          </div>
          <Gauge p={c.probability} />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{c.summary}</p>
        {truth && (
          <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${truthMatch ? 'bg-aurora/15 text-aurora' : 'bg-plasma/15 text-plasma'}`}>
            <span>{truthMatch ? '✓' : '✗'}</span>
            Catalogue truth: {truth === 'planet' ? 'confirmed planet' : 'false positive'} — {truthMatch ? 'classifier agrees' : 'classifier disagrees'}
          </div>
        )}

        <div className="mt-5">
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">Vetting tests</div>
          <ul className="space-y-1.5">
            {c.tests.map((t) => {
              const dot = t.severity === 'pass' ? 'bg-aurora' : t.severity === 'warn' ? 'bg-star' : 'bg-plasma';
              const isOpen = open === t.id;
              return (
                <li key={t.id} className="rounded-lg border border-white/8 bg-black/20">
                  <button onClick={() => setOpen(isOpen ? null : t.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm">
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dot} shadow-[0_0_8px_currentColor]`} />
                    <span className="flex-1 text-slate-200">{t.name}</span>
                    <span className={`font-mono text-[11px] ${t.weight >= 0 ? 'text-aurora' : 'text-plasma'}`}>{t.weight >= 0 ? '+' : ''}{t.weight.toFixed(1)}</span>
                    <span className={`text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {isOpen && <p className="border-t border-white/5 px-3 py-2 text-xs leading-relaxed text-slate-400">{t.detail}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Planet card */}
      <div className="glass fade-up p-5 lg:col-span-3" style={{ animationDelay: '0.1s' }}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Derived companion properties</div>
            <h3 className="text-lg font-semibold text-white">{p.planetClass}</h3>
          </div>
          <div className="text-right text-xs text-slate-400">
            host: {p.starClass}
            <br />
            R★ {stellar.radius} R☉ · M★ {stellar.mass} M☉ · {stellar.teff} K
          </div>
        </div>
        <PlanetVisual planet={p} stellar={stellar} verdict={c.verdict} />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Orbital period" value={m.period.toFixed(4)} unit="d" />
          <Stat label="Radius" value={p.radiusEarth.toFixed(2)} unit="R⊕" hint={`${p.radiusJupiter.toFixed(2)} Jupiter radii`} />
          <Stat label="Semi-major axis" value={p.semiMajorAxisAU.toFixed(4)} unit="AU" />
          <Stat label="Equilibrium temp" value={Math.round(p.equilibriumTempK).toString()} unit="K" hint="Bond albedo 0.3, full redistribution" />
          <Stat label="Transit depth" value={m.depthPpm >= 10000 ? (m.depth * 100).toFixed(2) + '%' : m.depthPpm.toFixed(0)} unit={m.depthPpm >= 10000 ? '' : 'ppm'} />
          <Stat label="Duration" value={(m.duration * 24).toFixed(2)} unit="h" />
          <Stat label="Insolation" value={p.insolationEarth < 100 ? p.insolationEarth.toFixed(2) : p.insolationEarth.toFixed(0)} unit="S⊕" />
          <Stat label="Signal-to-noise" value={m.snr.toFixed(1)} unit="σ" />
          <Stat label="Odd/even Δ" value={m.oddEvenSigma.toFixed(1)} unit="σ" />
          <Stat label="Secondary" value={m.secondarySigma.toFixed(1)} unit="σ" />
          <Stat label="Ingress fraction" value={(m.ingressFrac * 100).toFixed(0)} unit="%" />
          <Stat label="Habitable zone" value={p.habitableZone} />
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Pipeline ran in {result.elapsedMs.toFixed(0)} ms · {m.nTransits} transits · noise σ = {(m.noiseSigma * 1e6).toFixed(0)} ppm per cadence · epoch BKJD {m.epoch.toFixed(4)}</p>
      </div>
    </div>
  );
}
