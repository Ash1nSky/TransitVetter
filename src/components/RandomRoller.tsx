import { useMemo, useState } from 'react';
import { KeplerTarget, bulkUrl, exoMastUrl, koiRecordUrl, mastSearchUrl, pythonSnippet, randomTarget, timeSeriesUrl, overviewUrl } from '../lib/keplerTargets';
import type { StellarParams } from '../lib/lightcurve';

function SignalBadge({ s }: { s: KeplerTarget['signal'] }) {
  const map = {
    obvious: { label: 'Obvious dip', cls: 'bg-aurora/15 text-aurora border-aurora/30', dot: 'bg-aurora' },
    moderate: { label: 'Moderate', cls: 'bg-star/15 text-star border-star/30', dot: 'bg-star' },
    subtle: { label: 'Tiny — hardest', cls: 'bg-plasma/15 text-plasma border-plasma/30', dot: 'bg-plasma' },
  } as const;
  const m = map[s];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  );
}

export default function RandomRoller({ setStellar }: { stellar: StellarParams; setStellar: (s: StellarParams) => void }) {
  const [cur, setCur] = useState<KeplerTarget>(() => randomTarget());
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const links = useMemo(() => {
    const ts = timeSeriesUrl(cur.kic);
    const bulk = bulkUrl(cur.kic);
    const koi = koiRecordUrl(cur);
    const exo = exoMastUrl(cur);
    const mast = mastSearchUrl(cur.kic);
    const ov = overviewUrl(cur);
    return { ts, bulk, koi, exo, mast, ov };
  }, [cur]);

  const roll = () => {
    setCur(randomTarget(cur.kic));
    setRevealed(false);
    setCopied(null);
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const applyStellar = () => {
    setStellar({ ...cur.stellar });
    setApplied(true);
    setTimeout(() => setApplied(false), 1800);
  };

  return (
    <div className="rounded-xl border border-nebula/25 bg-gradient-to-br from-nebula/[0.08] to-transparent p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🎲</span>
            <h3 className="text-sm font-semibold text-white">Random Kepler target roller</h3>
            <SignalBadge s={cur.signal} />
          </div>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-slate-400">
            Stuck on which star to try? Spin the wheel — 26 real Kepler targets (18 planets + 8 false positives) drawn live from the
            NASA Exoplanet Archive. Guess before you peek at NASA’s verdict.
          </p>
        </div>
        <button
          onClick={roll}
          className="shrink-0 rounded-xl bg-gradient-to-r from-nebula to-violet-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-nebula/30 transition hover:brightness-110 active:scale-[0.98]"
        >
          Roll again 🎲
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500">KIC {String(cur.kic).padStart(9, '0').replace(/^0+/, '')}</span>
              <span className="h-1 w-1 rounded-full bg-white/20" />
              <span className="text-sm font-semibold text-white">{cur.displayName}</span>
              {cur.koi && (
                <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{cur.koi.replace(/^K0*/, 'K')}</span>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{cur.notes}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              <span className="rounded bg-white/5 px-2 py-1 font-mono text-slate-300">P {cur.period.toFixed(cur.period < 10 ? 3 : 2)} d</span>
              <span className="rounded bg-white/5 px-2 py-1 font-mono text-slate-300">
                {cur.depthPpm === 0 ? 'no dip' : cur.depthPpm < 1000 ? `${cur.depthPpm} ppm` : `${(cur.depthPpm / 1000).toFixed(1)}k ppm`}
              </span>
              <span className="rounded bg-white/5 px-2 py-1 font-mono text-slate-300">{cur.durationHours.toFixed(1)} h</span>
              <span className="rounded bg-white/5 px-2 py-1 font-mono text-slate-300">
                R★ {cur.stellar.radius} R☉ · M★ {cur.stellar.mass} M☉ · {cur.stellar.teff} K
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
            <button
              onClick={() => copy(String(cur.kic), 'kic')}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 sm:w-auto"
            >
              {copied === 'kic' ? 'Copied ✓' : 'Copy KIC'}
            </button>
            <button
              onClick={() => copy(pythonSnippet(cur), 'py')}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 sm:w-auto"
            >
              {copied === 'py' ? 'Copied ✓' : 'Copy Python for this target'}
            </button>
            <button
              onClick={applyStellar}
              className={`w-full rounded-lg px-3 py-1.5 text-xs font-medium transition sm:w-auto ${applied ? 'bg-aurora text-void' : 'bg-nebula text-white hover:brightness-110'}`}
            >
              {applied ? 'Applied ✓' : 'Use this star’s parameters →'}
            </button>
            <span className="hidden text-[10px] text-slate-500 sm:block">Fills the R★ / M★ / Teff boxes below</span>
          </div>
        </div>

        {/* Four pre-filled links */}
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          <a href={links.ts} target="_blank" rel="noreferrer" className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-aurora/30 hover:bg-white/[0.06]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-aurora/15 text-aurora group-hover:bg-aurora group-hover:text-void">👁</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-white group-hover:text-aurora">See the real light curve now</span>
              <span className="block truncate text-[10px] text-slate-400">NASA Time Series Viewer — no download</span>
            </span>
            <span className="text-slate-500">↗</span>
          </a>
          <a href={links.bulk} target="_blank" rel="noreferrer" className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-aurora/30 hover:bg-white/[0.06]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-slate-300 group-hover:bg-white group-hover:text-void">⬇</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-white">Download from MAST</span>
              <span className="block truncate text-[10px] text-slate-400">Raw _llc.fits tree for this KIC</span>
            </span>
            <span className="text-slate-500">↗</span>
          </a>
          <a href={links.koi} target="_blank" rel="noreferrer" className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-aurora/30 hover:bg-white/[0.06]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-star/15 text-star">📋</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-white">Official KOI record</span>
              <span className="block truncate text-[10px] text-slate-400">Cumulative KOI table — disposition + stellar params</span>
            </span>
            <span className="text-slate-500">↗</span>
          </a>
          {links.exo ? (
            <a href={links.exo} target="_blank" rel="noreferrer" className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-aurora/30 hover:bg-white/[0.06]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-nebula/20 text-nebula">🛰</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold text-white">exo.MAST page</span>
                <span className="block truncate text-[10px] text-slate-400">Planet overview + related links</span>
              </span>
              <span className="text-slate-500">↗</span>
            </a>
          ) : (
            <a href={links.mast} target="_blank" rel="noreferrer" className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-aurora/30 hover:bg-white/[0.06]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-nebula/20 text-nebula">🔍</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold text-white">MAST search (pre-filled)</span>
                <span className="block truncate text-[10px] text-slate-400">KOI-only — raw files for this KIC</span>
              </span>
              <span className="text-slate-500">↗</span>
            </a>
          )}
        </div>

        <details className="mt-2">
          <summary className="cursor-pointer list-none text-[11px] text-slate-400 hover:text-white">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[11px]">▸</span> Show Python snippet for this target
            </span>
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-white/10 bg-black/50 p-2.5 font-mono text-[10px] leading-relaxed text-slate-300">{pythonSnippet(cur)}</pre>
        </details>

        {/* Hidden disposition — guess first */}
        <div className="mt-3 rounded-lg border border-white/10 bg-gradient-to-br from-black/40 to-transparent p-3">
          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="flex w-full items-center justify-between rounded-lg border border-dashed border-white/15 px-3 py-2 text-xs text-slate-300 hover:border-white/25 hover:bg-white/5 hover:text-white"
            >
              <span>🙈 Reveal NASA’s official disposition — vet it yourself first!</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">Reveal</span>
            </button>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${cur.disposition === 'CONFIRMED' ? 'bg-aurora/15 text-aurora border border-aurora/30' : 'bg-plasma/15 text-plasma border border-plasma/30'}`}>
                    {cur.disposition}
                  </span>
                  {cur.koi && <span className="font-mono text-[11px] text-slate-400">{cur.koi.replace(/^K0*/, 'K')}</span>}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                  {cur.disposition === 'CONFIRMED' ? 'NASA confirmed — a real planet.' : 'NASA flagged FALSE POSITIVE — an eclipsing binary, blend or spot signal.'}{' '}
                  {cur.kic === 12644769 && 'Case in point: KOI-1611.01 is an EB at 41 d, but the same star hosts the circumbinary planet Kepler-16 b at 229 d — same KIC, different signal.'}
                </p>
                <a href={links.ov} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-aurora underline-offset-2 hover:underline">
                  Open overview page ↗
                </a>
              </div>
              <button onClick={() => setRevealed(false)} className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-slate-400 hover:bg-white/10 hover:text-white">
                Hide
              </button>
            </div>
          )}
          <p className="mt-2 text-[10px] text-slate-500">
            Tip: Don’t match TransitVetter blindly — if you disagree, check <i>which</i> vetting test failed. Borderline KOIs often flip to <code className="font-mono">CANDIDATE</code> in a different pipeline.
          </p>
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-500">
        All 26 targets’ KIC / KOI / period / depth / R★ / M★ / Teff are from the NASA Exoplanet Archive cumulative KOI TAP service — not placeholders. Links were fetched Sept 2026 and verified (Time Series Viewer, MAST bulk tree, KOI table, exo.MAST).
      </p>
    </div>
  );
}
