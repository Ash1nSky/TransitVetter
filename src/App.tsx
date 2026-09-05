import { useCallback, useEffect, useRef, useState } from 'react';
import Starfield from './components/Starfield';
import DataInput, { InputTab } from './components/DataInput';
import ResultPanel, { SiblingItem } from './components/ResultPanel';
import PromptGenerator from './components/PromptGenerator';
import { LightCurveChart, PeriodogramChart, PhaseFoldedChart } from './components/Charts';
import { AnalysisResult, analyze } from './lib/analysis';
import { LightCurve, SAMPLE_TARGETS, SampleTarget, StellarParams, maskSiblingTransits, simulateLightCurve } from './lib/lightcurve';
import { ResolvedTarget, toSimParams } from './lib/kicResolve';
import { fetchRealLightCurve } from './lib/mastLightCurve';
import AnalysisWorker from './lib/analysis.worker?worker&inline';

const PIPELINE_STEPS = ['Normalising flux', 'Detrending stellar variability', 'Running Box Least Squares search', 'Phase-folding on best period', 'Fitting transit model', 'Running vetting tests', 'Computing disposition'];

// Run the pipeline off the main thread when possible; fall back to synchronous execution.
function runAnalysis(lc: LightCurve, stellar: StellarParams): Promise<AnalysisResult> {
  return new Promise((resolve) => {
    let worker: Worker | null = null;
    try {
      worker = new AnalysisWorker();
    } catch {
      worker = null;
    }
    if (!worker) {
      setTimeout(() => resolve(analyze(lc, stellar)), 30);
      return;
    }
    const id = Date.now();
    const fallback = () => {
      worker?.terminate();
      resolve(analyze(lc, stellar));
    };
    worker.onmessage = (e: MessageEvent<{ id: number; result?: AnalysisResult; error?: string }>) => {
      if (e.data.id !== id) return;
      worker?.terminate();
      if (e.data.result) resolve(e.data.result);
      else fallback();
    };
    worker.onerror = fallback;
    worker.postMessage({ lc, stellar, id });
  });
}

export default function App() {
  const [tab, setTab] = useState<InputTab>('samples');
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [stellar, setStellar] = useState<StellarParams>({ radius: 1.0, mass: 1.0, teff: 5778 });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [truth, setTruth] = useState<'planet' | 'false-positive' | undefined>();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [history, setHistory] = useState<{ name: string; verdict: string; p: number }[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  const run = useCallback((lc: LightCurve, st: StellarParams, tr?: 'planet' | 'false-positive') => {
    setBusy(true);
    setStep(0);
    setTruth(tr);
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      setStep(Math.min(i, PIPELINE_STEPS.length - 1));
    }, 160);
    const started = performance.now();
    const minVisible = PIPELINE_STEPS.length * 160;
    runAnalysis(lc, st).then((res) => {
      const remaining = Math.max(0, minVisible - (performance.now() - started));
      setTimeout(() => {
        clearInterval(iv);
        setResult(res);
        setHistory((h) => [{ name: lc.name, verdict: res.classification.verdict, p: res.classification.probability }, ...h].slice(0, 6));
        setBusy(false);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }, remaining);
    });
  }, []);

  const onSelectSample = useCallback(
    (s: SampleTarget) => {
      setSelectedSample(s.id);
      setStellar(s.stellar);
      run(simulateLightCurve(s.sim, s.name), s.stellar, s.truth);
    },
    [run],
  );

  const onSelectSiblingTarget = useCallback(
    async (item: SiblingItem, mode: 'real' | 'model') => {
      setStellar({ ...item.stellar });
      const rawSiblings = item.allKois
        ? item.allKois.filter((x) => x.koi !== item.koi && x.period != null && x.durationHours != null)
        : item.siblings ?? [];
      const resolvedT: ResolvedTarget = {
        kic: item.kic,
        koi: item.koi ?? null,
        displayName: item.displayName,
        keplerName: item.keplerName ?? null,
        disposition: item.disposition,
        period: item.period ?? null,
        depthPpm: item.depthPpm ?? null,
        durationHours: item.durationHours ?? null,
        epochBkjd: item.epochBkjd ?? null,
        stellar: item.stellar,
        source: 'catalogue',
        siblings: rawSiblings,
        allKois: item.allKois,
      };

      const deepest = item.allKois && item.allKois.length > 0 ? [...item.allKois].sort((a, b) => (b.depthPpm ?? 0) - (a.depthPpm ?? 0))[0] : null;
      const isDeepest = !deepest || deepest.koi === item.koi || (item.depthPpm ?? 0) >= (deepest.depthPpm ?? 0);

      if (mode === 'model') {
        const lc = simulateLightCurve(toSimParams(resolvedT, item.kic % 997), `${item.displayName} (KIC ${item.kic}) — archive model`);
        lc.targetInfo = {
          kic: item.kic,
          koi: item.koi,
          displayName: item.displayName,
          keplerName: item.keplerName,
          disposition: item.disposition,
          isDeepest,
          deepestKoi: deepest?.displayName ?? item.displayName,
          siblings: rawSiblings,
          allKois: item.allKois,
          isRealData: false,
        };
        run(lc, item.stellar);
      } else {
        setBusy(true);
        try {
          const res = await fetchRealLightCurve(item.kic, item.displayName);
          let finalLc = res.lc;
          let maskedCadences = 0;
          if (rawSiblings.length > 0) {
            const masks = rawSiblings
              .filter((s: any) => s.period > 0 && s.durationHours > 0)
              .map((s: any) => ({
                period: s.period,
                epoch: s.epochBkjd ?? 0,
                durationHours: s.durationHours,
                koi: s.koi,
              }));
            const maskedRes = maskSiblingTransits(res.lc, masks);
            finalLc = maskedRes.lc;
            maskedCadences = maskedRes.maskedCadences;
          }
          finalLc.targetInfo = {
            kic: item.kic,
            koi: item.koi,
            displayName: item.displayName,
            keplerName: item.keplerName,
            disposition: item.disposition,
            isDeepest,
            deepestKoi: deepest?.displayName ?? item.displayName,
            siblings: rawSiblings,
            allKois: item.allKois,
            isRealData: true,
            maskedCadences,
            maskedSiblingsCount: rawSiblings.length,
          };
          run(finalLc, item.stellar);
        } catch (err) {
          setBusy(false);
          alert((err as Error)?.message ?? 'Download failed.');
        }
      }
    },
    [run],
  );

  // auto-load the first target on mount
  useEffect(() => {
    onSelectSample(SAMPLE_TARGETS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-screen">
      <Starfield />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-void/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-nebula to-aurora shadow-lg shadow-nebula/40">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" opacity={0.9} />
                <ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-25 12 12)" />
                <circle cx="20" cy="8" r="1.2" fill="currentColor" stroke="none" />
              </svg>
              <span className="pulse-ring absolute inset-0 rounded-xl border border-aurora/60" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                Transit<span className="text-aurora">Vetter</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Kepler light-curve classifier</p>
            </div>
          </div>
          <div className="hidden items-center gap-4 text-xs text-slate-400 sm:flex">
            <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-aurora shadow-[0_0_8px_#35e0c2]" /> BLS engine online</span>
            <span className="font-mono">{result ? `${result.lc.time.length.toLocaleString()} cadences loaded` : '—'}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-nebula/20 via-transparent to-aurora/10 p-6 sm:p-10">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-nebula/30 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-plasma/20 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-star" /> Mission: Kepler · Field: Cygnus–Lyra · Method: transit photometry
              </span>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                Is that dip a <span className="bg-gradient-to-r from-aurora via-violet-300 to-nebula bg-clip-text text-transparent">planet</span>
                <br className="hidden sm:block" /> or an impostor?
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Feed in a Kepler light curve. TransitVetter detrends it, hunts for periodic transits with a Box Least Squares search, folds the signal, measures its shape — then runs the same vetting tests NASA used to separate confirmed planets from eclipsing binaries and noise.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
                {['Running-median detrend', 'BLS periodogram', 'Trapezoid fit', 'Odd/even test', 'Secondary eclipse test', 'Radius & Teq', 'Image prompt'].map((t) => (
                  <span key={t} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 font-mono text-slate-300">{t}</span>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2">
              <TransitAnimation />
            </div>
          </div>
        </section>

        {/* Input */}
        <section className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DataInput tab={tab} setTab={setTab} selectedSample={selectedSample} onSelectSample={onSelectSample} onUpload={(lc, st) => { setSelectedSample(null); run(lc, st); }} onSimulate={(lc, st) => { setSelectedSample(null); run(lc, st); }} onResolved={(lc, st) => { setSelectedSample(null); setStellar(st); run(lc, st); }} stellar={stellar} setStellar={setStellar} busy={busy} />
          </div>
          <div className="space-y-5">
            {/* Pipeline status */}
            <div className="glass p-5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Pipeline status</div>
              <ul className="mt-3 space-y-2">
                {PIPELINE_STEPS.map((s, i) => {
                  const state = busy ? (i < step ? 'done' : i === step ? 'active' : 'idle') : result ? 'done' : 'idle';
                  return (
                    <li key={s} className="flex items-center gap-3 text-xs">
                      <span className={`relative flex h-4 w-4 items-center justify-center rounded-full border ${state === 'done' ? 'border-aurora bg-aurora/20 text-aurora' : state === 'active' ? 'border-nebula bg-nebula/30' : 'border-white/15'}`}>
                        {state === 'done' && <span className="text-[9px]">✓</span>}
                        {state === 'active' && <span className="h-1.5 w-1.5 animate-ping rounded-full bg-nebula" />}
                      </span>
                      <span className={state === 'idle' ? 'text-slate-500' : state === 'active' ? 'text-white' : 'text-slate-300'}>{s}</span>
                    </li>
                  );
                })}
              </ul>
              {busy && (
                <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="scanline absolute inset-y-0 w-1/4 rounded-full bg-gradient-to-r from-transparent via-aurora to-transparent" />
                </div>
              )}
            </div>
            {/* History */}
            {history.length > 0 && (
              <div className="glass p-5">
                <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Recent dispositions</div>
                <ul className="mt-3 space-y-1.5">
                  {history.map((h, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-1.5 text-xs">
                      <span className="truncate text-slate-300">{h.name}</span>
                      <span className={`ml-2 font-mono ${h.verdict === 'PLANET' ? 'text-aurora' : h.verdict === 'FALSE POSITIVE' ? 'text-plasma' : 'text-star'}`}>
                        {h.verdict} · {(h.p * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Results */}
        <div ref={resultsRef} className="scroll-mt-20" />
        {result && (
          <section className={`space-y-5 transition-opacity duration-500 ${busy ? 'opacity-30' : 'opacity-100'}`}>
            <ResultPanel result={result} truth={truth} onSelectTarget={onSelectSiblingTarget} />
            <div className="grid gap-5 lg:grid-cols-2">
              <LightCurveChart result={result} />
              <PhaseFoldedChart result={result} />
            </div>
            <PeriodogramChart result={result} />
            <PromptGenerator result={result} />
          </section>
        )}

        <footer className="pb-6 pt-4 text-center text-[11px] text-slate-500">
          Sample light curves are synthesised from published parameters of real Kepler objects. Real data: <a className="text-aurora hover:underline" href="https://exoplanetarchive.ipac.caltech.edu/" target="_blank" rel="noreferrer">NASA Exoplanet Archive</a> · <a className="text-aurora hover:underline" href="https://archive.stsci.edu/kepler/" target="_blank" rel="noreferrer">MAST</a> · <a className="text-aurora hover:underline" href="https://github.com/Ash1nSky/TransitVetter#-how-the-classifier-works" target="_blank" rel="noreferrer">How the classifier works</a>
        </footer>
      </main>
    </div>
  );
}

// Decorative animated transit: planet crosses star while a live light curve traces underneath
function TransitAnimation() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setT(((now - start) / 6000) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const starR = 46;
  const planetR = 9;
  const cx = 150;
  const cy = 70;
  const px = 20 + t * 260;
  const d = Math.abs(px - cx);
  // overlap fraction (approx)
  let dip = 0;
  if (d < starR + planetR) {
    const overlap = Math.min(1, (starR + planetR - d) / (2 * planetR));
    dip = overlap * (planetR / starR) ** 2;
  }
  const pts: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const tt = i / 100;
    const xx = 20 + tt * 260;
    const dd = Math.abs(xx - cx);
    let dp = 0;
    if (dd < starR + planetR) dp = Math.min(1, (starR + planetR - dd) / (2 * planetR)) * (planetR / starR) ** 2;
    pts.push(`${i ? 'L' : 'M'}${xx},${165 + dp * 900}`);
  }
  return (
    <svg viewBox="0 0 300 200" className="w-full drop-shadow-[0_0_30px_rgba(255,217,138,0.25)]">
      <defs>
        <radialGradient id="starg">
          <stop offset="0" stopColor="#fff8e1" />
          <stop offset="0.6" stopColor="#ffd98a" />
          <stop offset="1" stopColor="#ff9f4a" />
        </radialGradient>
        <radialGradient id="planetg" cx="0.35" cy="0.35">
          <stop offset="0" stopColor="#8fb4ff" />
          <stop offset="1" stopColor="#0b1a3a" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={starR + 14} fill="rgba(255,217,138,0.12)" />
      <circle cx={cx} cy={cy} r={starR} fill="url(#starg)" />
      <circle cx={px} cy={cy} r={planetR} fill="url(#planetg)" />
      <line x1={20} x2={280} y1={165} y2={165} stroke="rgba(255,255,255,0.08)" />
      <path d={pts.join('')} fill="none" stroke="#35e0c2" strokeWidth={1.8} />
      <circle cx={px} cy={165 + dip * 900} r={3.5} fill="#fff" />
      <text x={20} y={195} fontSize={9} fill="#94a3b8" fontFamily="var(--font-mono)">
        brightness − {(dip * 100).toFixed(2)}%
      </text>
      <text x={280} y={195} fontSize={9} fill="#94a3b8" textAnchor="end" fontFamily="var(--font-mono)">
        time →
      </text>
    </svg>
  );
}
