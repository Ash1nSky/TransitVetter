import { useRef, useState } from 'react';
import { DEFAULT_SIM, LightCurve, SAMPLE_TARGETS, SampleTarget, SimParams, StellarParams, lightCurveToCSV, parseLightCurveText, simulateLightCurve } from '../lib/lightcurve';

export type InputTab = 'samples' | 'upload' | 'simulate';

interface Props {
  tab: InputTab;
  setTab: (t: InputTab) => void;
  selectedSample: string | null;
  onSelectSample: (s: SampleTarget) => void;
  onUpload: (lc: LightCurve, stellar: StellarParams) => void;
  onSimulate: (lc: LightCurve, stellar: StellarParams) => void;
  stellar: StellarParams;
  setStellar: (s: StellarParams) => void;
  busy: boolean;
}

function Slider({ label, value, min, max, step, onChange, fmt, log }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string; log?: boolean }) {
  const toSlider = (v: number) => (log ? Math.log10(v) : v);
  const fromSlider = (v: number) => (log ? Math.pow(10, v) : v);
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-200">{fmt(value)}</span>
      </div>
      <input type="range" min={toSlider(min)} max={toSlider(max)} step={log ? 0.01 : step} value={toSlider(value)} onChange={(e) => onChange(fromSlider(parseFloat(e.target.value)))} />
    </label>
  );
}

const LK_SNIPPET = `# pip install lightkurve
import lightkurve as lk

lc = (lk.search_lightcurve("Kepler-8", mission="Kepler", cadence="long")
        .download_all()
        .stitch()
        .remove_nans())

lc.to_csv("kepler8.csv")   # -> time, flux  (drop straight into TransitVetter)`;

const DATA_SOURCES: { name: string; href: string; blurb: string; tag: string }[] = [
  {
    name: 'MAST — Kepler Data Search',
    href: 'https://archive.stsci.edu/kepler/data_search/search.php',
    blurb: 'The official archive. Search by KIC ID, target name or coordinates and grab the quarterly light-curve files.',
    tag: 'FITS',
  },
  {
    name: 'exo.MAST',
    href: 'https://exo.mast.stsci.edu/',
    blurb: 'Type a planet name (“Kepler-7 b”), preview the light curve in the browser and export the time series.',
    tag: 'Browse + export',
  },
  {
    name: 'NASA Exoplanet Archive — KOI table',
    href: 'https://exoplanetarchive.ipac.caltech.edu/cgi-bin/TblView/nph-tblView?app=ExoTbls&config=cumulative',
    blurb: 'All ~9,500 Kepler Objects of Interest with official dispositions plus the stellar radius, mass and Teff for the boxes below.',
    tag: 'CSV',
  },
  {
    name: 'Lightkurve (Python)',
    href: 'https://lightkurve.github.io/lightkurve/',
    blurb: 'Easiest route: download, stitch and export any Kepler/K2/TESS target to CSV in four lines — snippet below.',
    tag: 'Recommended',
  },
  {
    name: 'MAST bulk directory',
    href: 'https://archive.stsci.edu/pub/kepler/lightcurves/',
    blurb: 'Raw HTTP tree of every public Kepler light curve, organised by KIC ID. Good for wget/scripted downloads.',
    tag: 'Bulk',
  },
  {
    name: 'Kaggle — Kepler exoplanet search results',
    href: 'https://www.kaggle.com/datasets/nasa/kepler-exoplanet-search-results',
    blurb: 'A ready-made offline mirror of the KOI catalogue if you just want labelled parameters without an archive query.',
    tag: 'Mirror',
  },
];

function DataSourceTip() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(LK_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="rounded-xl border border-aurora/25 bg-aurora/[0.06] p-3">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-2.5 text-left">
        <span className="mt-0.5 text-base leading-none">💡</span>
        <span className="flex-1">
          <span className="block text-xs font-semibold text-aurora">Tip — where to find real Kepler light curves</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
            Every Kepler observation is public and free. {open ? 'Six good starting points:' : 'Tap for six archives, direct links and a 4-line Python snippet that exports a target to CSV.'}
          </span>
        </span>
        <span className={`mt-0.5 text-slate-400 transition ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="fade-up mt-3 space-y-2.5">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {DATA_SOURCES.map((s) => (
              <li key={s.name}>
                <a href={s.href} target="_blank" rel="noreferrer" className="group block h-full rounded-lg border border-white/10 bg-black/25 p-2.5 transition hover:border-aurora/40 hover:bg-black/40">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-white group-hover:text-aurora">{s.name} ↗</span>
                    <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-400">{s.tag}</span>
                  </span>
                  <span className="mt-1 block text-[10px] leading-snug text-slate-400">{s.blurb}</span>
                </a>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-white/10 bg-black/40 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Archive files are FITS — convert them to CSV first</span>
              <button onClick={copySnippet} className="rounded border border-white/15 px-2 py-0.5 text-[10px] text-slate-200 transition hover:bg-white/10">
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <pre className="overflow-x-auto font-mono text-[10px] leading-relaxed text-slate-300">{LK_SNIPPET}</pre>
          </div>

          <p className="text-[10px] leading-snug text-slate-500">
            Prefer PDCSAP flux (systematics removed), long cadence (29.4 min) and at least ~30 days of baseline so three or more transits land in the window — the pipeline needs three to trust a period. Don’t forget to enter the host star’s radius, mass and Teff below; the KOI table lists them.
          </p>
        </div>
      )}
    </div>
  );
}

function StellarEditor({ stellar, setStellar }: { stellar: StellarParams; setStellar: (s: StellarParams) => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-slate-400">Host star parameters (from Kepler Input Catalog)</div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { k: 'radius' as const, l: 'Radius (R☉)', step: 0.01 },
          { k: 'mass' as const, l: 'Mass (M☉)', step: 0.01 },
          { k: 'teff' as const, l: 'Teff (K)', step: 10 },
        ].map((f) => (
          <label key={f.k} className="text-[11px] text-slate-400">
            {f.l}
            <input type="number" step={f.step} value={stellar[f.k]} onChange={(e) => setStellar({ ...stellar, [f.k]: parseFloat(e.target.value) || 0 })} className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-white focus:border-nebula focus:outline-none" />
          </label>
        ))}
      </div>
    </div>
  );
}

export default function DataInput({ tab, setTab, selectedSample, onSelectSample, onUpload, onSimulate, stellar, setStellar, busy }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState('');
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sim, setSim] = useState<SimParams>({ ...DEFAULT_SIM });
  const [dragOver, setDragOver] = useState(false);

  const handleText = (text: string, name: string) => {
    const r = parseLightCurveText(text, name);
    if (r.error) {
      setUploadMsg({ ok: false, text: r.error });
      return;
    }
    setUploadMsg({ ok: true, text: r.info ?? 'Parsed' });
    if (r.lc) onUpload(r.lc, stellar);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => handleText(String(reader.result), file.name.replace(/\.[^.]+$/, ''));
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const lc = simulateLightCurve({ ...DEFAULT_SIM, span: 30 }, 'template');
    const blob = new Blob([lightCurveToCSV(lc)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kepler_lightcurve_template.csv';
    a.click();
  };

  const tabs: { id: InputTab; label: string; icon: string }[] = [
    { id: 'samples', label: 'Kepler targets', icon: '✦' },
    { id: 'upload', label: 'Upload / paste', icon: '⇪' },
    { id: 'simulate', label: 'Transit simulator', icon: '⚙' },
  ];

  return (
    <div className="glass p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${tab === t.id ? 'bg-gradient-to-r from-nebula to-violet-500 text-white shadow-lg shadow-nebula/30' : 'text-slate-400 hover:text-white'}`}>
            <span className="mr-1.5 opacity-80">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'samples' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Realistic light curves synthesised from the published parameters of real Kepler objects of interest. Four are confirmed planets, four are catalogued false positives. Can you spot which is which?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SAMPLE_TARGETS.map((s) => {
              const active = selectedSample === s.id;
              return (
                <button key={s.id} disabled={busy} onClick={() => onSelectSample(s)} className={`group relative overflow-hidden rounded-xl border p-3 text-left transition ${active ? 'border-nebula bg-nebula/15 shadow-[0_0_30px_-8px_rgba(109,93,252,0.8)]' : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]'} disabled:opacity-60`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{s.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">{s.kic}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-400">{s.description}</p>
                  <div className="mt-2 flex gap-2 text-[10px] text-slate-500">
                    <span className="rounded bg-white/5 px-1.5 py-0.5">P ≈ {s.sim.period.toFixed(2)} d</span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5">{s.stellar.teff} K</span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5">{s.stellar.radius} R☉</span>
                  </div>
                  {active && <span className="pulse-ring absolute -right-2 -top-2 h-6 w-6 rounded-full border border-nebula" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'upload' && (
        <div className="space-y-3">
          <DataSourceTip />
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${dragOver ? 'border-aurora bg-aurora/10' : 'border-white/15 bg-black/20 hover:border-white/30'}`}
          >
            <div className="text-3xl">🛰️</div>
            <p className="mt-2 text-sm text-white">Drop a Kepler light-curve file here, or click to browse</p>
            <p className="mt-1 text-[11px] text-slate-400">CSV / TSV / whitespace-separated. Columns: <code className="font-mono">time, flux</code> (or a MAST export with <code className="font-mono">TIME, PDCSAP_FLUX</code>). Lines starting with # are ignored.</p>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.dat,.tbl" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
          <div className="text-center text-[11px] text-slate-500">— or paste data —</div>
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} placeholder={'time,flux\n131.512,1.000212\n131.532,0.999871\n...'} className="w-full rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-nebula focus:outline-none" />
          <StellarEditor stellar={stellar} setStellar={setStellar} />
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={busy || pasted.trim().length === 0} onClick={() => handleText(pasted, 'Pasted light curve')} className="rounded-lg bg-gradient-to-r from-nebula to-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-nebula/30 transition hover:brightness-110 disabled:opacity-40">
              Analyse pasted data
            </button>
            <button onClick={downloadTemplate} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10">
              Download template CSV
            </button>
            <a href="https://archive.stsci.edu/kepler/data_search/search.php" target="_blank" rel="noreferrer" className="text-xs text-aurora underline-offset-2 hover:underline">
              Get real data from MAST ↗
            </a>
          </div>
          {uploadMsg && <p className={`text-xs ${uploadMsg.ok ? 'text-aurora' : 'text-plasma'}`}>{uploadMsg.text}</p>}
        </div>
      )}

      {tab === 'simulate' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">Design your own signal and feed it through the exact same detection pipeline. Try turning on a secondary eclipse or odd/even mismatch to see the classifier flip to false positive.</p>
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            <Slider label="Orbital period" value={sim.period} min={0.5} max={40} step={0.01} log onChange={(v) => setSim({ ...sim, period: v })} fmt={(v) => `${v.toFixed(2)} d`} />
            <Slider label="Transit depth" value={sim.depth} min={0.00005} max={0.15} step={0.0001} log onChange={(v) => setSim({ ...sim, depth: v })} fmt={(v) => (v < 0.01 ? `${(v * 1e6).toFixed(0)} ppm` : `${(v * 100).toFixed(2)} %`)} />
            <Slider label="Transit duration" value={sim.duration} min={0.03} max={0.5} step={0.005} onChange={(v) => setSim({ ...sim, duration: v })} fmt={(v) => `${(v * 24).toFixed(1)} h`} />
            <Slider label="Shape (ingress fraction)" value={sim.shape} min={0.05} max={0.5} step={0.01} onChange={(v) => setSim({ ...sim, shape: v })} fmt={(v) => (v < 0.2 ? `${v.toFixed(2)} (U)` : v > 0.4 ? `${v.toFixed(2)} (V)` : v.toFixed(2))} />
            <Slider label="Photometric noise" value={sim.noise} min={0.00003} max={0.003} step={0.00001} log onChange={(v) => setSim({ ...sim, noise: v })} fmt={(v) => `${(v * 1e6).toFixed(0)} ppm`} />
            <Slider label="Secondary eclipse depth" value={sim.secondaryDepth} min={0} max={0.02} step={0.0001} onChange={(v) => setSim({ ...sim, secondaryDepth: v })} fmt={(v) => (v === 0 ? 'none' : `${(v * 1e6).toFixed(0)} ppm`)} />
            <Slider label="Odd/even depth ratio" value={sim.oddEvenRatio} min={0.3} max={1} step={0.01} onChange={(v) => setSim({ ...sim, oddEvenRatio: v })} fmt={(v) => (v === 1 ? 'identical' : v.toFixed(2))} />
            <Slider label="Stellar variability" value={sim.variabilityAmp} min={0} max={0.01} step={0.0001} onChange={(v) => setSim({ ...sim, variabilityAmp: v })} fmt={(v) => `${(v * 1e6).toFixed(0)} ppm`} />
            <Slider label="Observing baseline" value={sim.span} min={20} max={180} step={1} onChange={(v) => setSim({ ...sim, span: v })} fmt={(v) => `${v} d`} />
            <Slider label="Random seed" value={sim.seed} min={1} max={999} step={1} onChange={(v) => setSim({ ...sim, seed: Math.round(v) })} fmt={(v) => `#${Math.round(v)}`} />
          </div>
          <StellarEditor stellar={stellar} setStellar={setStellar} />
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => onSimulate(simulateLightCurve(sim, 'Simulated target'), stellar)} className="rounded-lg bg-gradient-to-r from-nebula to-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-nebula/30 transition hover:brightness-110 disabled:opacity-40">
              Generate & analyse
            </button>
            <button onClick={() => setSim({ ...DEFAULT_SIM, secondaryDepth: 0.004, shape: 0.45, depth: 0.05 })} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">Preset: eclipsing binary</button>
            <button onClick={() => setSim({ ...DEFAULT_SIM, oddEvenRatio: 0.55, depth: 0.01 })} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">Preset: odd/even EB</button>
            <button onClick={() => setSim({ ...DEFAULT_SIM, depth: 0.0002, period: 12.3, noise: 0.0001, shape: 0.15 })} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">Preset: small planet</button>
            <button onClick={() => setSim({ ...DEFAULT_SIM })} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">Reset</button>
          </div>
        </div>
      )}
    </div>
  );
}
