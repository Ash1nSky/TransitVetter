// Light-curve data structures, synthetic generators and parsers

export interface LightCurveTargetInfo {
  kic?: number;
  koi?: string | null;
  displayName?: string;
  keplerName?: string | null;
  disposition?: string;
  isDeepest?: boolean;
  deepestKoi?: string | null;
  siblings?: Array<{
    koi: string;
    keplerName: string | null;
    period: number;
    depthPpm: number;
    durationHours: number;
    epochBkjd?: number;
    disposition: string;
  }>;
  allKois?: Array<{
    kic: number;
    koi: string | null;
    displayName: string;
    keplerName: string | null;
    disposition: string;
    period: number | null;
    depthPpm: number | null;
    durationHours: number | null;
    epochBkjd?: number | null;
    stellar: StellarParams;
  }>;
  isRealData?: boolean;
  maskedCadences?: number;
  maskedSiblingsCount?: number;
}

export interface LightCurve {
  time: number[]; // days (BKJD)
  flux: number[]; // normalized flux (median = 1)
  name: string;
  source: 'sample' | 'upload' | 'simulated' | 'mast';
  targetInfo?: LightCurveTargetInfo;
}

export interface StellarParams {
  radius: number; // solar radii
  mass: number; // solar masses
  teff: number; // Kelvin
}

export interface SimParams {
  period: number; // days
  epoch: number; // days
  depth: number; // fractional (0.01 = 1%)
  duration: number; // days
  noise: number; // fractional per-point scatter
  span: number; // days
  cadence: number; // days
  secondaryDepth: number; // fractional
  oddEvenRatio: number; // depth multiplier for odd transits (1 = identical)
  shape: number; // ingress fraction of total duration: 0.1 = flat U, 0.5 = V
  variabilityAmp: number; // fractional
  variabilityPeriod: number; // days
  seed: number;
}

// ---------- Seeded RNG ----------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Trapezoid transit profile. dt = time from mid-transit, T = total duration, f = ingress fraction
export function trapezoid(dt: number, T: number, f: number): number {
  const half = T / 2;
  const x = Math.abs(dt);
  if (x >= half) return 0;
  const ingress = Math.max(f, 0.01) * T;
  const flatHalf = half - ingress;
  if (x <= flatHalf) return 1;
  return (half - x) / ingress;
}

export const DEFAULT_SIM: SimParams = {
  period: 3.52,
  epoch: 1.3,
  depth: 0.009,
  duration: 0.13,
  noise: 0.0004,
  span: 90,
  cadence: 0.02043,
  secondaryDepth: 0,
  oddEvenRatio: 1,
  shape: 0.12,
  variabilityAmp: 0.0008,
  variabilityPeriod: 11,
  seed: 42,
};

export function simulateLightCurve(p: SimParams, name = 'Simulated target'): LightCurve {
  const rng = mulberry32(p.seed);
  const n = Math.floor(p.span / p.cadence);
  const time: number[] = [];
  const flux: number[] = [];
  const gap1 = [p.span * 0.42, p.span * 0.45]; // simulated data-downlink gap
  for (let i = 0; i < n; i++) {
    const t = i * p.cadence;
    if (t > gap1[0] && t < gap1[1]) continue;
    let f = 1;
    // primary transits
    const nTr = Math.round((t - p.epoch) / p.period);
    const dt = t - (p.epoch + nTr * p.period);
    let depth = p.depth;
    if (Math.abs(nTr) % 2 === 1) depth *= p.oddEvenRatio;
    f -= depth * trapezoid(dt, p.duration, p.shape);
    // secondary eclipse at phase 0.5
    if (p.secondaryDepth > 0) {
      const nSec = Math.round((t - p.epoch - p.period / 2) / p.period);
      const dts = t - (p.epoch + p.period / 2 + nSec * p.period);
      f -= p.secondaryDepth * trapezoid(dts, p.duration, p.shape);
    }
    // stellar variability (two harmonics for realism)
    if (p.variabilityAmp > 0) {
      f += p.variabilityAmp * Math.sin((2 * Math.PI * t) / p.variabilityPeriod);
      f += 0.4 * p.variabilityAmp * Math.sin((2 * Math.PI * t) / (p.variabilityPeriod * 0.37) + 1.1);
    }
    // slow instrumental drift
    f += 0.0003 * Math.sin((2 * Math.PI * t) / (p.span * 0.8) + 0.4);
    f += p.noise * gaussian(rng);
    time.push(t + 131.51); // BKJD-like offset
    flux.push(f);
  }
  return { time, flux, name, source: 'simulated' };
}

// ---------- Sample catalogue ----------
export interface SampleTarget {
  id: string;
  name: string;
  kic: string;
  description: string;
  truth: 'planet' | 'false-positive';
  stellar: StellarParams;
  sim: SimParams;
}

export const SAMPLE_TARGETS: SampleTarget[] = [
  {
    id: 'kepler-7b',
    name: 'Kepler-7 b',
    kic: 'KIC 5780885',
    description: 'Inflated hot Jupiter orbiting an evolved F-type star. Deep, flat-bottomed transits.',
    truth: 'planet',
    stellar: { radius: 1.84, mass: 1.35, teff: 5933 },
    sim: { ...DEFAULT_SIM, period: 4.8855, epoch: 2.71, depth: 0.0068, duration: 0.212, noise: 0.00025, shape: 0.11, variabilityAmp: 0.0003, variabilityPeriod: 17, seed: 7 },
  },
  {
    id: 'kepler-10b',
    name: 'Kepler-10 b',
    kic: 'KIC 11904151',
    description: "Kepler's first rocky planet. Ultra-short 0.84-day period, shallow ~150 ppm transits.",
    truth: 'planet',
    stellar: { radius: 1.065, mass: 0.91, teff: 5627 },
    sim: { ...DEFAULT_SIM, period: 0.8375, epoch: 0.41, depth: 0.00016, duration: 0.077, noise: 0.00009, shape: 0.2, variabilityAmp: 0.00005, variabilityPeriod: 25, seed: 10 },
  },
  {
    id: 'kepler-8b',
    name: 'Kepler-8 b',
    kic: 'KIC 6922244',
    description: 'Hot Jupiter with a 3.52-day period around an F star. Textbook U-shaped transit.',
    truth: 'planet',
    stellar: { radius: 1.49, mass: 1.21, teff: 6213 },
    sim: { ...DEFAULT_SIM, period: 3.5225, epoch: 1.94, depth: 0.0092, duration: 0.135, noise: 0.0003, shape: 0.13, variabilityAmp: 0.0004, variabilityPeriod: 8, seed: 8 },
  },
  {
    id: 'kepler-138d',
    name: 'Kepler-138 d',
    kic: 'KIC 7603200',
    description: 'Low-density sub-Neptune around a red dwarf. Shallow transits every 23 days.',
    truth: 'planet',
    stellar: { radius: 0.54, mass: 0.52, teff: 3841 },
    sim: { ...DEFAULT_SIM, period: 23.089, epoch: 5.3, depth: 0.00055, duration: 0.09, noise: 0.00012, shape: 0.18, variabilityAmp: 0.0006, variabilityPeriod: 19, seed: 138 },
  },
  {
    id: 'koi-fp-eb',
    name: 'KOI-1003.01 style EB',
    kic: 'KIC 8112039',
    description: 'Detached eclipsing binary. Very deep V-shaped eclipse with a visible secondary at phase 0.5.',
    truth: 'false-positive',
    stellar: { radius: 1.1, mass: 1.02, teff: 5800 },
    sim: { ...DEFAULT_SIM, period: 2.744, epoch: 0.9, depth: 0.085, duration: 0.19, noise: 0.0004, shape: 0.48, secondaryDepth: 0.021, variabilityAmp: 0.0004, variabilityPeriod: 6, seed: 1003 },
  },
  {
    id: 'koi-fp-oddeven',
    name: 'KOI-3240.01 style EB',
    kic: 'KIC 3247294',
    description: 'Near-twin binary mis-identified at half the true period. Odd and even eclipses differ in depth.',
    truth: 'false-positive',
    stellar: { radius: 0.98, mass: 0.97, teff: 5650 },
    sim: { ...DEFAULT_SIM, period: 1.921, epoch: 0.6, depth: 0.012, duration: 0.11, noise: 0.0003, shape: 0.3, oddEvenRatio: 0.62, variabilityAmp: 0.0002, variabilityPeriod: 13, seed: 3240 },
  },
  {
    id: 'koi-fp-beb',
    name: 'Background EB blend',
    kic: 'KIC 9705459',
    description: 'Faint background binary diluted by a bright foreground star. Planet-like depth but a tell-tale secondary eclipse.',
    truth: 'false-positive',
    stellar: { radius: 1.2, mass: 1.1, teff: 6050 },
    sim: { ...DEFAULT_SIM, period: 6.13, epoch: 3.1, depth: 0.0031, duration: 0.31, noise: 0.0003, shape: 0.42, secondaryDepth: 0.0014, variabilityAmp: 0.0003, variabilityPeriod: 21, seed: 9705 },
  },
  {
    id: 'koi-fp-noise',
    name: 'Spotted star (no transit)',
    kic: 'KIC 4544587',
    description: 'Rotational modulation from starspots and instrumental noise only. No periodic box-shaped dips.',
    truth: 'false-positive',
    stellar: { radius: 0.88, mass: 0.9, teff: 5200 },
    sim: { ...DEFAULT_SIM, period: 5.5, epoch: 1, depth: 0, duration: 0.1, noise: 0.0005, variabilityAmp: 0.0025, variabilityPeriod: 4.3, seed: 4544 },
  },
];

// ---------- Parsing ----------
export interface ParseResult {
  lc?: LightCurve;
  error?: string;
  info?: string;
}

export function parseLightCurveText(text: string, name = 'Uploaded light curve'): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.trim().startsWith('#') && !l.trim().startsWith('\\'));
  if (lines.length < 20) return { error: 'Need at least 20 data rows (time, flux).' };

  const splitLine = (l: string) => l.trim().split(/[,\t; ]+/).map((s) => s.trim());
  const first = splitLine(lines[0]);
  let timeIdx = 0;
  let fluxIdx = 1;
  let start = 0;
  let info = 'Columns: 1 = time, 2 = flux';
  const isHeader = first.some((c) => isNaN(parseFloat(c)));
  if (isHeader) {
    start = 1;
    const lower = first.map((c) => c.toLowerCase());
    const tI = lower.findIndex((c) => c === 'time' || c === 't' || c === 'bjd' || c === 'bkjd' || c.includes('time'));
    const pdc = lower.findIndex((c) => c.includes('pdcsap_flux') && !c.includes('err'));
    const sap = lower.findIndex((c) => c.includes('sap_flux') && !c.includes('err'));
    const fl = lower.findIndex((c) => (c === 'flux' || c.includes('flux')) && !c.includes('err'));
    if (tI >= 0) timeIdx = tI;
    if (pdc >= 0) {
      fluxIdx = pdc;
      info = `Using columns "${first[timeIdx]}" and "${first[pdc]}" (PDC-corrected flux)`;
    } else if (sap >= 0) {
      fluxIdx = sap;
      info = `Using columns "${first[timeIdx]}" and "${first[sap]}"`;
    } else if (fl >= 0) {
      fluxIdx = fl;
      info = `Using columns "${first[timeIdx]}" and "${first[fl]}"`;
    }
  }
  const time: number[] = [];
  const flux: number[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const t = parseFloat(cols[timeIdx]);
    const f = parseFloat(cols[fluxIdx]);
    if (!isFinite(t) || !isFinite(f)) continue;
    time.push(t);
    flux.push(f);
  }
  if (time.length < 20) return { error: 'Could not parse enough numeric rows. Expected columns: time, flux.' };
  // sort by time
  const idx = time.map((_, i) => i).sort((a, b) => time[a] - time[b]);
  let ts = idx.map((i) => time[i]);
  let fs = idx.map((i) => flux[i]);
  // bin very large files (e.g. multi-quarter or short-cadence) so the search stays interactive
  const MAX_POINTS = 14000;
  let binNote = '';
  if (ts.length > MAX_POINTS) {
    const k = Math.ceil(ts.length / MAX_POINTS);
    const bt: number[] = [];
    const bf: number[] = [];
    for (let i = 0; i < ts.length; i += k) {
      let st = 0;
      let sf = 0;
      let c = 0;
      for (let j = i; j < Math.min(i + k, ts.length); j++) {
        st += ts[j];
        sf += fs[j];
        c++;
      }
      bt.push(st / c);
      bf.push(sf / c);
    }
    ts = bt;
    fs = bf;
    binNote = ` · binned ${k}× to ${ts.length} points`;
  }
  // normalise by median
  const med = median(fs);
  const norm = fs.map((f) => f / med);
  return { lc: { time: ts, flux: norm, name, source: 'upload' }, info: `${info} · ${ts.length} points${binNote} · ${(ts[ts.length - 1] - ts[0]).toFixed(1)} day baseline` };
}

export function median(arr: number[]): number {
  if (arr.length === 0) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function lightCurveToCSV(lc: LightCurve): string {
  const rows = ['time,flux'];
  for (let i = 0; i < lc.time.length; i++) rows.push(`${lc.time[i].toFixed(5)},${lc.flux[i].toFixed(7)}`);
  return rows.join('\n');
}

// ---------- Multi-planet / Sibling KOI Masking ----------
export interface TransitMask {
  period: number;
  epoch?: number | null; // BKJD
  durationHours: number;
  name?: string;
  koi?: string;
}

export function isTimeInTransit(t: number, mask: TransitMask, maskFactor = 1.3): boolean {
  if (!mask.period || mask.period <= 0 || !mask.durationHours) return false;
  const durDays = mask.durationHours / 24;
  const halfWin = (durDays / 2) * maskFactor;
  // If epoch is not provided, we cannot mask by phase accurately
  if (mask.epoch == null || !Number.isFinite(mask.epoch)) return false;
  let dt = (t - mask.epoch) % mask.period;
  if (dt < 0) dt += mask.period;
  if (dt > mask.period / 2) dt -= mask.period;
  return Math.abs(dt) <= halfWin;
}

export function maskSiblingTransits(
  lc: LightCurve,
  siblings: TransitMask[],
  maskFactor = 1.3,
): { lc: LightCurve; maskedCadences: number; totalCadences: number } {
  const validSiblings = (siblings || []).filter(
    (s) => s.period > 0 && s.durationHours > 0 && s.epoch != null && Number.isFinite(s.epoch),
  );
  if (validSiblings.length === 0) {
    return { lc, maskedCadences: 0, totalCadences: lc.time.length };
  }
  const newTime: number[] = [];
  const newFlux: number[] = [];
  let masked = 0;
  for (let i = 0; i < lc.time.length; i++) {
    const t = lc.time[i];
    let inSibling = false;
    for (const s of validSiblings) {
      if (isTimeInTransit(t, s, maskFactor)) {
        inSibling = true;
        break;
      }
    }
    if (inSibling) {
      masked++;
    } else {
      newTime.push(t);
      newFlux.push(lc.flux[i]);
    }
  }
  return {
    lc: {
      ...lc,
      time: newTime,
      flux: newFlux,
      name:
        masked > 0
          ? `${lc.name} (masked ${validSiblings.length} sibling KOI${validSiblings.length > 1 ? 's' : ''})`
          : lc.name,
    },
    maskedCadences: masked,
    totalCadences: lc.time.length,
  };
}

