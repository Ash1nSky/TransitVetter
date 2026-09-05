import { useEffect, useState } from 'react';

const STORAGE_KEY = 'transitvetter_todo_v1';
const GUIDE_OPEN_KEY = 'transitvetter_guide_open_v1';

type Step = {
  id: string;
  title: string;
  summary: string;
  detail: React.ReactNode;
};

const STEPS: Step[] = [
  {
    id: 'pick',
    title: '1 — Pick a star',
    summary: 'Everything is filed by star, not planet.',
    detail: (
      <>
        <p className="text-[11px] leading-relaxed text-slate-300">
          Kepler doesn’t organise by “Kepler-22 b” — it organises by{' '}
          <b className="text-white">KIC number</b> (Kepler Input Catalog). Type that number into any archive search and you get all the planets around that star.
        </p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-300">
          <li>
            <b className="text-white">KIC 5780885</b> = the star Kepler-7 (KOI 97, Kepler-7 b lives here)
          </li>
          <li>
            <b className="text-white">KOI = Kepler Object of Interest</b> — a dip that looked planet-like before vetting (e.g. K00097.01)
          </li>
          <li>
            <b className="text-white">Kepler name</b> = only given after confirmation (Kepler-7 b). False positives never get one.
          </li>
        </ul>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          No idea which star? Hit <span className="font-mono text-aurora">🎲 Roll a random target</span> below — it fills in a real KIC + stellar numbers for you. Or open the{' '}
          <a href="https://exoplanetarchive.ipac.caltech.edu/cgi-bin/TblView/nph-tblView?app=ExoTbls&config=cumulative" target="_blank" rel="noreferrer noopener" className="text-aurora underline-offset-2 hover:underline">
            KOI table
          </a>{' '}
          and filter <code className="font-mono text-slate-300">koi_disposition = CONFIRMED</code> to browse.
        </p>
      </>
    ),
  },
  {
    id: 'peek',
    title: '2 — Look at it online first',
    summary: 'No download, no account needed.',
    detail: (
      <>
        <p className="text-[11px] leading-relaxed text-slate-300">
          Before downloading, peek at the folded light curve in the browser:
        </p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-slate-300">
          <li>
            Open the target’s{' '}
            <span className="rounded bg-white/5 px-1 font-mono text-aurora">Time Series Viewer</span> link (every roll has one). It’s a NASA Exoplanet Archive viewer — paste the KIC, e.g.{' '}
            <code className="font-mono text-white">5780885</code>.
          </li>
          <li>Scroll to the phase-folded view — you’ll see the dip even before downloading.</li>
          <li>
            If you use <span className="text-white">MAST Portal</span>, search <code className="font-mono text-white">KIC 5780885</code> instead — same data, different skin.
          </li>
        </ol>
        <p className="mt-1.5 rounded-lg border border-aurora/20 bg-aurora/5 p-2 text-[10px] leading-relaxed text-slate-400">
          💡 Think of it like Google Street View for stars — you look first, then decide if you want the raw photo.
        </p>
      </>
    ),
  },
  {
    id: 'get',
    title: '3 — Get the data onto your machine',
    summary: 'Two routes: Colab (easy) or MAST clicks.',
    detail: (
      <>
        <p className="text-[11px] font-semibold text-white">Route A — Google Colab + 4 lines (recommended)</p>
        <pre className="mt-1 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[10px] leading-relaxed text-slate-300">
{`# pip install lightkurve   (Colab: !pip install lightkurve)
import lightkurve as lk

lc = lk.search_lightcurve("KIC 5780885", mission="Kepler",
                          cadence="long").download_all().stitch().remove_nans()
lc.to_csv("kic_5780885.csv")   # -> time, flux`}
        </pre>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
          Replace <code className="font-mono text-white">"KIC 5780885"</code> with any KIC or name like <code className="font-mono text-white">"Kepler-22 b"</code>. Run in a free Colab notebook, then download the CSV.
        </p>
        <p className="mt-2 text-[11px] font-semibold text-white">Route B — Click through MAST (no Python)</p>
        <ol className="mt-1 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-slate-300">
          <li>
            Open{' '}
            <a href="https://archive.stsci.edu/kepler/data_search/search.php" target="_blank" rel="noreferrer noopener" className="text-aurora underline-offset-2 hover:underline">
              MAST Kepler Data Search
            </a>{' '}
            → type the KIC in the <b>Kepler ID</b> box.
          </li>
          <li>
            Tick <b>Long Cadence</b> only, leave Short Cadence off (long = one point per 30 min, file is 5× smaller).
          </li>
          <li>
            Click <b>Search</b> → tick a few rows (one per <i>Quarter</i>) → <b>Get Data</b> → download the <code className="font-mono">_llc.fits</code> files.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: 'csv',
    title: '4 — Make sure it’s time + flux',
    summary: 'Archive files are FITS — convert once.',
    detail: (
      <>
        <p className="text-[11px] leading-relaxed text-slate-300">
          MAST gives you <code className="font-mono text-white">.fits</code> files. TransitVetter reads plain text tables (
          <code className="font-mono text-slate-200">time, flux</code>), so convert:
        </p>
        <pre className="mt-1.5 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[10px] leading-relaxed text-slate-300">
{`# if you used MAST files, convert with Lightkurve:
import lightkurve as lk
lc = lk.read("kplr005780885-*.fits").remove_nans().stitch()
lc.to_csv("kic_5780885.csv")`}
        </pre>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
          The CSV just needs two columns: <code className="font-mono text-white">time</code> (BKJD — days since 2009) and{' '}
          <code className="font-mono text-white">flux</code> (PDCSAP_FLUX preferred). Header can be{' '}
          <code className="font-mono">time,flux</code> or <code className="font-mono">TIME,PDCSAP_FLUX</code> — TransitVetter auto-detects both and normalises flux by its median.
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          Big files (&gt;14k rows) are auto-binned; the banner tells you the factor. Need PDCSAP vs SAP? See jargon decoder below.
        </p>
      </>
    ),
  },
  {
    id: 'stars',
    title: '5 — Copy the star’s three numbers',
    summary: 'Radius, mass, Teff — without them the classifier guesses wrong.',
    detail: (
      <>
        <p className="text-[11px] leading-relaxed text-slate-300">
          To turn “% dip” into “Earth radii” we need the star’s size + temperature:
        </p>
        <div className="mt-1.5 grid gap-1.5 rounded-lg border border-white/10 bg-black/30 p-2">
          {[
            { k: 'R★ (radius)', col: 'koi_srad', eg: '1.84 R☉ for Kepler-7', box: 'Radius (R☉)' },
            { k: 'M★ (mass)', col: 'koi_smass', eg: '1.35 M☉', box: 'Mass (M☉)' },
            { k: 'Teff', col: 'koi_steff', eg: '5933 K', box: 'Teff (K)' },
          ].map((r) => (
            <div key={r.k} className="flex items-start justify-between gap-3 text-[11px]">
              <span className="font-mono text-slate-300">{r.k}</span>
              <span className="text-right text-slate-400">
                KOI column <code className="font-mono text-aurora">{r.col}</code> → paste into <span className="text-white">{r.box}</span> box<br />
                <span className="text-slate-500">e.g. {r.eg}</span>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          Find them on the KOI table (one row per KOI) or the star’s{' '}
          <a href="https://exoplanetarchive.ipac.caltech.edu/overview/Kepler-7%20b" target="_blank" rel="noreferrer noopener" className="text-aurora underline-offset-2 hover:underline">
            Overview page
          </a>
          . The random roller has a one-click <span className="rounded bg-white/5 px-1 font-mono text-white">Use this star’s parameters</span> button that fills the three boxes for you.
        </p>
      </>
    ),
  },
  {
    id: 'drop',
    title: '6 — Drop it in & compare with NASA',
    summary: 'Why disagreeing is normal.',
    detail: (
      <>
        <p className="text-[11px] leading-relaxed text-slate-300">
          Drag the CSV onto the upload area (or paste the text). TransitVetter detrends, finds the period with BLS, folds, and runs the 7 vetting tests. Then scroll to the verdict.
        </p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-300">
          <li>
            <span className="text-aurora">You agree with NASA (PLANET vs FALSE POSITIVE)?</span> Great — the physics checks line up.
          </li>
          <li>
            <span className="text-plasma">You disagree?</span> Also great. Robovetter (the official Kepler classifier) uses slightly different detrending, harmonic removal and thresholds. A borderline KOI can flip to CANDIDATE in another pipeline. Science lives there.
          </li>
          <li>
            Check the per-test breakdown: is it <i>odd/even</i> or <i>secondary eclipse</i> that made you fail? Click a test to read why.
          </li>
        </ul>
        <p className="mt-1.5 rounded-lg border border-star/20 bg-star/5 p-2 text-[10px] leading-relaxed text-slate-300">
          🎓 Try a known impostor next: roll <b>KOI-1003.01</b> (deep V) or <b>KIC 4544587</b> (spotted star, no transit) and watch every test light up red.
        </p>
      </>
    ),
  },
];

const JARGON: { term: string; short: string; detail: string }[] = [
  { term: 'KIC', short: 'Kepler Input Catalog', detail: 'Master star list for the Kepler field. Each star = one KIC number (e.g. KIC 5780885 = Kepler-7). Data files are filed by KIC, not by planet name. Think “student ID for stars”.' },
  { term: 'KOI', short: 'Kepler Object of Interest', detail: 'A star that showed at least one transit-like dip. Named Kxxxxx.01, .02 for multi-planet systems (K00097.01 = Kepler-7 b before it was confirmed). Every KOI row in the archive links back to its KIC.' },
  { term: 'Quarter', short: 'Q0–Q17', detail: 'Kepler rotated every ~90 days to keep its solar panels on the Sun; each rotation = one Quarter. MAST lists one file per Quarter. For a full baseline you usually want Q1–Q17 (4 years).' },
  { term: 'Long vs Short cadence', short: '30 min vs 1 min', detail: 'Long cadence (29.4 min) is plenty for a transit (hours). Short cadence (58.8 s) just makes the file 30× bigger. Pick Long unless you chase very short transits.' },
  { term: 'SAP vs PDCSAP', short: 'raw vs corrected flux', detail: 'SAP = raw electrons/second in the aperture. PDCSAP = SAP after removing instrumental drift (cottrending). PDCSAP is what you want — it keeps dips, removes spacecraft wobble.' },
  { term: 'BKJD', short: 'Barycentric Kepler Julian Date', detail: 'Time in days since 2009-01-01 12:00 UTC, corrected for Kepler’s orbit around the Sun. First Kepler data ≈ BKJD 131.5. The absolute offset doesn’t matter — we only use gaps between points.' },
  { term: 'ppm', short: 'parts per million', detail: 'How we quote a dip. 1% = 10,000 ppm. Earth transiting the Sun = 84 ppm. Kepler-37 b = 22 ppm (tiny!). Hot Jupiter = 5,000–15,000 ppm (obvious).' },
  { term: 'kplr006922244-…_llc.fits', short: 'filename grammar', detail: 'kplr = Kepler, 006922244 = KIC (padded to 9 digits), numbers = timestamp, _llc = long cadence, _slc = short, .fits = archive format. Example kplr005780885-2010078095331_llc.fits = Kepler-7, long cadence, a 2010 observation.' },
];

export default function BeginnerGuide() {
  const [checked, setChecked] = useState<boolean[]>(() => Array(STEPS.length).fill(false));
  const [openStep, setOpenStep] = useState<string | null>('pick');
  const [jargonOpen, setJargonOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);

  // hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === STEPS.length) setChecked(parsed);
      }
      const g = localStorage.getItem(GUIDE_OPEN_KEY);
      if (g !== null) setGuideOpen(g === 'true');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      /* ignore */
    }
  }, [checked]);

  useEffect(() => {
    try {
      localStorage.setItem(GUIDE_OPEN_KEY, String(guideOpen));
    } catch {
      /* ignore */
    }
  }, [guideOpen]);

  const done = checked.filter(Boolean).length;
  const pct = (done / STEPS.length) * 100;

  const toggle = (i: number) => {
    setChecked((c) => {
      const n = [...c];
      n[i] = !n[i];
      return n;
    });
  };

  const reset = () => setChecked(Array(STEPS.length).fill(false));

  return (
    <div className="space-y-3">
      {/* Collapsible checklist wrapper */}
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <button
            onClick={() => setGuideOpen(!guideOpen)}
            className="flex flex-1 items-start gap-3 text-left"
            aria-expanded={guideOpen}
          >
            <span className={`mt-0.5 shrink-0 text-slate-400 transition ${guideOpen ? 'rotate-180' : ''}`}>▾</span>
            <span className="flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">New to Kepler data? Follow this checklist</span>
                <span className="rounded-full bg-aurora/15 px-2 py-0.5 font-mono text-[10px] text-aurora">
                  {done}/{STEPS.length} · {pct.toFixed(0)}%
                </span>
                {!guideOpen && <span className="text-[11px] text-slate-400">— tap to expand</span>}
              </span>
              {guideOpen ? (
                <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">
                  Six steps from “I’ve never opened the archive” to “I’ve vetted a real exoplanet”. Tap a step to unfold the plain-English how-to. Your ticks are saved in this browser.
                </span>
              ) : (
                <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">Collapsed — progress saved. Expand to see the six steps + jargon decoder.</span>
              )}
            </span>
          </button>
          <button onClick={reset} className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-slate-400 hover:bg-white/10 hover:text-white">
            Reset
          </button>
        </div>

        {/* persistent progress bar, visible even when collapsed */}
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-nebula to-aurora transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-[10px] text-slate-400">{pct.toFixed(0)}%</span>
        </div>

        {guideOpen && (
          <div className="fade-up mt-3 space-y-3">
            <ul className="space-y-1.5">
              {STEPS.map((s, i) => {
                const isDone = checked[i];
                const isOpen = openStep === s.id;
                return (
                  <li key={s.id} className={`rounded-xl border transition ${isDone ? 'border-aurora/30 bg-aurora/[0.07]' : 'border-white/10 bg-black/20'} ${isOpen ? 'ring-1 ring-white/10' : ''}`}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        onClick={() => toggle(i)}
                        aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] transition ${isDone ? 'border-aurora bg-aurora text-void' : 'border-white/20 bg-white/5 text-slate-400 hover:border-white/30'}`}
                      >
                        {isDone ? '✓' : ''}
                      </button>
                      <button onClick={() => setOpenStep(isOpen ? null : s.id)} className="flex flex-1 items-center justify-between gap-2 text-left">
                        <span className={`text-xs font-medium ${isDone ? 'text-aurora' : 'text-white'}`}>{s.title}</span>
                        <span className="hidden text-[11px] text-slate-400 sm:block">{s.summary}</span>
                        <span className={`text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                      </button>
                    </div>
                    {isOpen && <div className="border-t border-white/10 px-3 py-2.5 sm:px-4">{s.detail}</div>}
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap gap-2 text-[11px]">
              <a
                href="https://exoplanetarchive.ipac.caltech.edu/cgi-bin/TblView/nph-tblView?app=ExoTbls&config=cumulative"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-slate-200 hover:bg-white/10"
              >
                Open KOI table ↗
              </a>
              <a
                href="https://archive.stsci.edu/kepler/data_search/search.php"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-slate-200 hover:bg-white/10"
              >
                Open MAST search ↗
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Jargon decoder — stays visible even when checklist collapsed */}
      <div className="rounded-xl border border-white/10 bg-black/20">
        <button onClick={() => setJargonOpen(!jargonOpen)} className="flex w-full items-center justify-between px-3 py-2.5 text-left sm:px-4">
          <span className="text-xs font-semibold text-white">📖 Jargon decoder — talk like a Kepler vet</span>
          <span className={`text-slate-500 transition ${jargonOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {jargonOpen && (
          <div className="fade-up border-t border-white/10 px-3 py-3 sm:px-4">
            <dl className="grid gap-2 sm:grid-cols-2">
              {JARGON.map((j) => (
                <div key={j.term} className="rounded-lg border border-white/8 bg-white/[0.03] p-2.5">
                  <dt className="flex items-baseline gap-1.5 text-[11px] font-semibold text-aurora">
                    {j.term} <span className="font-normal text-slate-400">— {j.short}</span>
                  </dt>
                  <dd className="mt-1 text-[11px] leading-relaxed text-slate-300">{j.detail}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              File names: <code className="font-mono text-slate-300">kplr006922244-2009131105131_llc.fits</code> → 006922244 = KIC 6922244 (Kepler-8), timestamp 2009-09-11, long cadence. <code className="font-mono">_slc</code> would be short.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
