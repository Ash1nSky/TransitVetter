import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RESOLVER_EXAMPLES,
  ResolveOutcome,
  ResolvedTarget,
  koiTableUrlFor,
  resolveKic,
  resolverPythonSnippet,
  toSimParams,
} from '../lib/kicResolve';
import { bulkUrl, mastSearchUrl, timeSeriesUrl } from '../lib/keplerTargets';
import { LightCurve, StellarParams, simulateLightCurve } from '../lib/lightcurve';

interface Props {
  setStellar: (s: StellarParams) => void;
  onAnalyse: (lc: LightCurve, stellar: StellarParams) => void;
  busy: boolean;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-xs text-white">{value}</div>
    </div>
  );
}

function DispositionPill({ d }: { d: string }) {
  const cls =
    d === 'CONFIRMED'
      ? 'bg-aurora/15 text-aurora border-aurora/30'
      : d === 'FALSE POSITIVE'
        ? 'bg-plasma/15 text-plasma border-plasma/30'
        : 'bg-star/15 text-star border-star/30';
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${cls}`}>{d}</span>;
}

export default function KicResolver({ setStellar, onAnalyse, busy }: Props) {
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<ResolveOutcome>({ status: 'idle', target: null, message: '' });
  const [autoFill, setAutoFill] = useState(true);
  const [applied, setApplied] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const lookup = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setOutcome({ status: 'loading', target: null, message: 'Looking up the Kepler Input Catalog…' });
      setRevealed(false);
      const res = await resolveKic(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setOutcome(res);
      if (res.target && autoFill) {
        setStellar({ ...res.target.stellar });
        setApplied(true);
        setTimeout(() => setApplied(false), 1800);
      }
    },
    [autoFill, setStellar],
  );

  const t: ResolvedTarget | null = outcome.target;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const analyseModel = () => {
    if (!t) return;
    const lc = simulateLightCurve(toSimParams(t, t.kic % 997), `${t.displayName} (KIC ${t.kic}) — archive model`);
    onAnalyse(lc, t.stellar);
  };

  const hasTransit = !!t && t.period != null && (t.depthPpm ?? 0) > 0;

  return (
    <div className="rounded-xl border border-aurora/25 bg-gradient-to-br from-aurora/[0.07] to-transparent p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-base leading-none">🔭</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">Know the KIC? Let the app fill everything in</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Type a Kepler Input Catalog id — or a KOI number or Kepler name — and TransitVetter looks up the host star’s radius, mass and
            temperature plus the published period, depth and duration, then drops them into the boxes below. Bundled targets resolve
            offline; anything else is fetched live from the NASA Exoplanet Archive.
          </p>
        </div>
      </div>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(query);
        }}
      >
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-slate-500">KIC</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="6922244   ·   Kepler-10 b   ·   KOI-97.01"
            spellCheck={false}
            className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-11 pr-3 font-mono text-sm text-white placeholder:text-slate-600 focus:border-aurora focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={outcome.status === 'loading' || query.trim().length === 0}
          className="rounded-lg bg-gradient-to-r from-aurora to-emerald-400 px-4 py-2 text-sm font-semibold text-void shadow-lg shadow-aurora/20 transition hover:brightness-110 disabled:opacity-40"
        >
          {outcome.status === 'loading' ? 'Resolving…' : 'Resolve'}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-slate-500">Try:</span>
        {RESOLVER_EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQuery(ex);
              lookup(ex);
            }}
            className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 transition hover:border-aurora/40 hover:text-aurora"
          >
            {ex}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-400">
          <input type="checkbox" checked={autoFill} onChange={(e) => setAutoFill(e.target.checked)} className="h-3 w-3 accent-[#35e0c2]" />
          Auto-fill star parameters
        </label>
      </div>

      {outcome.status !== 'idle' && outcome.message && (
        <p
          className={`mt-2 text-[11px] ${
            outcome.status === 'ok' ? 'text-aurora' : outcome.status === 'loading' ? 'text-slate-400' : 'text-plasma'
          }`}
        >
          {outcome.status === 'loading' && <span className="mr-1.5 inline-block animate-pulse">◍</span>}
          {outcome.message}
        </p>
      )}

      {t && (
        <div className="fade-up mt-3 rounded-xl border border-white/10 bg-black/30 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-slate-500">KIC {t.kic}</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span className="text-sm font-semibold text-white">{t.displayName}</span>
            {t.koi && <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{t.koi}</span>}
            <span
              className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                t.source === 'archive' ? 'bg-nebula/20 text-nebula' : 'bg-white/5 text-slate-400'
              }`}
            >
              {t.source === 'archive' ? 'NASA archive · live' : 'bundled catalogue'}
            </span>
          </div>

          {t.notes && <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">{t.notes}</p>}

          <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="R★" value={`${t.stellar.radius.toFixed(3)} R☉`} />
            <Stat label="M★" value={`${t.stellar.mass.toFixed(3)} M☉`} />
            <Stat label="Teff" value={`${Math.round(t.stellar.teff)} K`} />
            <Stat label="Period" value={t.period != null ? `${t.period.toFixed(t.period < 10 ? 4 : 2)} d` : '—'} />
            <Stat label="Depth" value={t.depthPpm != null ? `${Math.round(t.depthPpm).toLocaleString()} ppm` : '—'} />
            <Stat label="Duration" value={t.durationHours != null ? `${t.durationHours.toFixed(2)} h` : '—'} />
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                setStellar({ ...t.stellar });
                setApplied(true);
                setTimeout(() => setApplied(false), 1800);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                applied ? 'bg-aurora text-void' : 'bg-nebula text-white hover:brightness-110'
              }`}
            >
              {applied ? 'Star parameters filled ✓' : 'Fill star parameters →'}
            </button>
            <button
              disabled={busy || !hasTransit}
              onClick={analyseModel}
              title={hasTransit ? undefined : 'This target has no published transit depth to model'}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              Analyse archive model now
            </button>
            <button
              onClick={() => copy(String(t.kic), 'kic')}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
            >
              {copied === 'kic' ? 'Copied ✓' : 'Copy KIC'}
            </button>
            <button
              onClick={() => copy(resolverPythonSnippet(t), 'py')}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
            >
              {copied === 'py' ? 'Copied ✓' : 'Copy Python'}
            </button>
          </div>

          <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
            “Analyse archive model” builds a light curve from the published period, depth and duration so you can see the pipeline run
            instantly. For the genuine photometry, download the real light curve below and drop it in the upload box.
          </p>

          <div className="mt-2.5 grid gap-1.5 sm:grid-cols-3">
            {[
              { href: timeSeriesUrl(t.kic), icon: '👁', title: 'See the real light curve', sub: 'NASA Time Series Viewer' },
              { href: bulkUrl(t.kic), icon: '⬇', title: 'Download the FITS files', sub: 'MAST bulk tree for this KIC' },
              { href: koiTableUrlFor(t), icon: '📋', title: 'Official KOI record', sub: 'Cumulative table row' },
            ].map((l) => (
              <a
                key={l.title}
                href={l.href}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-aurora/30 hover:bg-white/[0.06]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aurora/15 text-aurora">{l.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold text-white group-hover:text-aurora">{l.title}</span>
                  <span className="block truncate text-[10px] text-slate-400">{l.sub}</span>
                </span>
                <span className="text-slate-500">↗</span>
              </a>
            ))}
          </div>

          <div className="mt-2.5">
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="flex w-full items-center justify-between rounded-lg border border-dashed border-white/15 px-3 py-2 text-xs text-slate-300 hover:border-white/25 hover:bg-white/5 hover:text-white"
              >
                <span>🙈 NASA’s official disposition is hidden — vet it yourself first</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">Reveal</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">NASA says</span>
                <DispositionPill d={t.disposition} />
              </div>
            )}
          </div>
        </div>
      )}

      {outcome.status === 'error' && (
        <a
          href={mastSearchUrl(0).replace('kic_kepler_id=0', 'kic_kepler_id=')}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-block text-[11px] text-aurora underline-offset-2 hover:underline"
        >
          Search MAST manually ↗
        </a>
      )}
    </div>
  );
}
