import { useState } from 'react';
import { AnalysisResult } from '../lib/analysis';
import { KEPLER_TARGETS, SiblingKoi } from '../lib/keplerTargets';
import { LightCurveTargetInfo, StellarParams } from '../lib/lightcurve';
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

export interface SiblingItem {
  kic: number;
  koi: string | null;
  displayName: string;
  keplerName?: string | null;
  disposition: string;
  period?: number | null;
  depthPpm?: number | null;
  durationHours?: number | null;
  epochBkjd?: number | null;
  stellar: StellarParams;
  siblings?: SiblingKoi[];
  allKois?: any[];
}

interface ResultPanelProps {
  result: AnalysisResult;
  truth?: 'planet' | 'false-positive';
  onSelectTarget?: (target: SiblingItem, mode: 'real' | 'model') => void;
}

export default function ResultPanel({ result, truth, onSelectTarget }: ResultPanelProps) {
  const { classification: c, metrics: m, planet: p, stellar } = result;
  const [open, setOpen] = useState<string | null>(null);
  const verdictColor = c.verdict === 'PLANET' ? 'text-aurora' : c.verdict === 'FALSE POSITIVE' ? 'text-plasma' : 'text-star';
  const verdictBg = c.verdict === 'PLANET' ? 'from-aurora/20 to-transparent border-aurora/30' : c.verdict === 'FALSE POSITIVE' ? 'from-plasma/20 to-transparent border-plasma/30' : 'from-star/20 to-transparent border-star/30';
  const truthMatch = truth ? (truth === 'planet') === (c.verdict === 'PLANET') : undefined;

  // Resolve target & sibling metadata
  const lcInfo: LightCurveTargetInfo | undefined = result.lc.targetInfo;
  const isRealData = lcInfo?.isRealData ?? result.lc.source === 'mast';

  // Fallback to catalogue if targetInfo is not attached
  let kicId = lcInfo?.kic;
  if (!kicId) {
    const matchedCatalog = KEPLER_TARGETS.find(
      (kt) => result.lc.name.includes(kt.displayName) || (kt.keplerName && result.lc.name.includes(kt.keplerName)) || result.lc.name.includes(String(kt.kic)),
    );
    if (matchedCatalog) kicId = matchedCatalog.kic;
  }

  // Find all sibling KOIs for this star
  const matchingCatalogEntries = kicId ? KEPLER_TARGETS.filter((kt) => kt.kic === kicId) : [];
  const rawAllKois = lcInfo?.allKois && lcInfo.allKois.length > 0 ? lcInfo.allKois : matchingCatalogEntries;
  
  // Format sibling list
  const allKois: SiblingItem[] = rawAllKois.map((k) => ({
    kic: k.kic,
    koi: k.koi ?? null,
    displayName: k.displayName,
    keplerName: k.keplerName ?? null,
    disposition: k.disposition,
    period: k.period ?? null,
    depthPpm: k.depthPpm ?? null,
    durationHours: k.durationHours ?? null,
    epochBkjd: k.epochBkjd ?? null,
    stellar: { ...k.stellar },
    siblings: (k as any).siblings,
    allKois: rawAllKois,
  }));

  const hasMultipleSignals = allKois.length > 1 || (lcInfo?.siblings && lcInfo.siblings.length > 0);
  const activeKoiName = lcInfo?.displayName ?? (allKois[0]?.displayName || result.lc.name);
  const activeKoiId = lcInfo?.koi ?? allKois[0]?.koi;
  const deepestKoi = allKois.length > 0 ? [...allKois].sort((a, b) => (b.depthPpm ?? 0) - (a.depthPpm ?? 0))[0] : null;
  const isDeepestSignal = lcInfo?.isDeepest ?? (deepestKoi ? deepestKoi.koi === activeKoiId || (allKois[0]?.depthPpm ?? 0) >= (deepestKoi.depthPpm ?? 0) : true);

  return (
    <div className="space-y-5">
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

      {/* Multi-Planet System & Sibling Group Breakdown Note */}
      {hasMultipleSignals && (
        <div className="glass fade-up rounded-2xl border border-aurora/30 bg-gradient-to-br from-aurora/[0.08] via-black/40 to-black/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🪐</span>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Multi-Planet System & Sibling Group Analysis
                </h3>
                <p className="text-[11px] text-slate-400">
                  Host Star: <span className="font-mono text-white">KIC {kicId ?? lcInfo?.kic}</span> · {allKois.length} candidate exoplanet signal(s) catalogued
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-slate-300">
                {isRealData ? '📡 Real Kepler Photometry' : '📐 Synthesised Archive Model'}
              </span>
            </div>
          </div>

          {/* Contextual Note for Real Photometry vs Archive Model */}
          <div className="mt-3.5">
            {isRealData ? (
              <div className="rounded-xl border border-aurora/25 bg-black/50 p-3.5 text-xs leading-relaxed text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="text-base text-aurora">💡</span>
                  <div className="space-y-1.5">
                    <p>
                      <strong className="text-white">Real Light Curve Analysis:</strong> When vetting real Kepler photometry in a multi-planet system, the superimposed transits of unmasked sibling planets introduce out-of-phase dips into the baseline. This inflates periodogram background noise (σ_power) and degrades Signal Detection Efficiency (<code className="font-mono text-plasma">SDE &lt; 6.0</code>), triggering false positive triage verdicts.
                    </p>
                    {lcInfo?.maskedSiblingsCount && lcInfo.maskedSiblingsCount > 0 ? (
                      <p className="text-aurora">
                        ✓ <strong className="font-semibold">Sibling Transits Masked:</strong> {lcInfo.maskedSiblingsCount} sibling KOI(s) ({lcInfo.maskedCadences?.toLocaleString()} cadences) were masked prior to BLS, allowing <span className="font-semibold text-white">{activeKoiName}</span> to achieve clean baseline noise and pass Robovetter significance tests.
                      </p>
                    ) : (
                      <p className="text-star">
                        ⚠️ <strong className="font-semibold">Unmasked Photometry:</strong> If the signal failed on Transit Significance (SDE), ensure "Mask known sibling KOIs" is checked in the KIC Resolver before analysing real photometry.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/50 p-3.5 text-xs leading-relaxed text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="text-base text-nebula">📐</span>
                  <div className="space-y-1.5">
                    <p>
                      <strong className="text-white">Archive Model Note:</strong> {isDeepestSignal ? (
                        <>
                          This archive model is synthesised from <strong className="text-aurora">{activeKoiName}</strong>, which is the <strong className="text-aurora">deepest signal</strong> in this multi-planet system ({Math.round(deepestKoi?.depthPpm ?? m.depthPpm).toLocaleString()} ppm). Sibling transits are omitted in single-planet synthetic models, yielding clean SDE.
                        </>
                      ) : (
                        <>
                          This archive model is synthesised specifically from <strong className="text-aurora">{activeKoiName}</strong> ({Math.round(m.depthPpm).toLocaleString()} ppm). The deepest signal in this system is <strong className="text-white">{deepestKoi?.displayName}</strong> ({Math.round(deepestKoi?.depthPpm ?? 0).toLocaleString()} ppm).
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sibling Group Disposition Breakdown & Interactive Signal Selector */}
          <div className="mt-4">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                Sibling Group Dispositions in NASA Archive ({allKois.length} Planets):
              </span>
              <span className="text-[10px] text-slate-400">Select any signal below to vet it:</span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {allKois.map((k) => {
                const isCurrent = k.koi === activeKoiId || k.displayName === activeKoiName;
                const isConfirmed = k.disposition === 'CONFIRMED';
                const isFp = k.disposition === 'FALSE POSITIVE';
                return (
                  <div
                    key={k.koi ?? k.displayName}
                    className={`flex flex-col justify-between rounded-xl border p-3 transition ${
                      isCurrent
                        ? 'border-aurora/60 bg-aurora/10 ring-1 ring-aurora/40'
                        : 'border-white/10 bg-black/40 hover:border-white/25 hover:bg-black/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                            <span>{k.displayName}</span>
                            {isCurrent && <span className="rounded bg-aurora/25 px-1 py-0.2 font-mono text-[9px] text-aurora">ACTIVE</span>}
                          </div>
                          {k.koi && <div className="font-mono text-[10px] text-slate-400">{k.koi}</div>}
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wide ${
                            isConfirmed
                              ? 'border-aurora/40 bg-aurora/15 text-aurora'
                              : isFp
                              ? 'border-plasma/40 bg-plasma/15 text-plasma'
                              : 'border-star/40 bg-star/15 text-star'
                          }`}
                        >
                          {k.disposition}
                        </span>
                      </div>

                      <div className="mt-2.5 grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-400">
                        <div>P: <span className="text-slate-200">{k.period ? `${k.period.toFixed(2)}d` : '—'}</span></div>
                        <div>Depth: <span className="text-slate-200">{k.depthPpm ? `${Math.round(k.depthPpm)}ppm` : '—'}</span></div>
                        <div>Dur: <span className="text-slate-200">{k.durationHours ? `${k.durationHours.toFixed(1)}h` : '—'}</span></div>
                        <div>Role: <span className="text-slate-200">{isCurrent ? 'Vetted' : 'Sibling'}</span></div>
                      </div>
                    </div>

                    {onSelectTarget && (
                      <div className="mt-3 flex gap-1.5 border-t border-white/5 pt-2">
                        {isCurrent ? (
                          <span className="w-full text-center font-mono text-[10px] text-aurora">Currently Displayed</span>
                        ) : (
                          <>
                            <button
                              onClick={() => onSelectTarget(k, 'model')}
                              className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-300 transition hover:border-aurora/40 hover:bg-aurora/15 hover:text-aurora"
                              title="Synthesise single-planet archive model for this KOI"
                            >
                              Vet Model
                            </button>
                            <button
                              onClick={() => onSelectTarget(k, 'real')}
                              className="flex-1 rounded border border-aurora/30 bg-aurora/10 px-2 py-1 text-[10px] font-medium text-aurora transition hover:bg-aurora/20 hover:brightness-110"
                              title="Download real Kepler light curve from MAST with siblings masked"
                            >
                              Vet Real LC
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

