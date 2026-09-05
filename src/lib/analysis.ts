import { LightCurve, StellarParams, median, trapezoid } from './lightcurve';

// ------------------------------------------------------------------
// 1. Detrending: running-median filter (removes stellar variability &
//    instrumental drift while preserving short transits)
// ------------------------------------------------------------------
export function detrend(lc: LightCurve, windowDays = 1.0): { flux: number[]; trend: number[] } {
  const n = lc.time.length;
  const trend = new Array<number>(n);
  let lo = 0;
  let hi = 0;
  const half = windowDays / 2;
  const buf: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = lc.time[i];
    while (lo < n && lc.time[lo] < t - half) lo++;
    while (hi < n && lc.time[hi] <= t + half) hi++;
    buf.length = 0;
    for (let j = lo; j < hi; j++) buf.push(lc.flux[j]);
    trend[i] = median(buf);
  }
  const flux = lc.flux.map((f, i) => f / trend[i]);
  return { flux, trend };
}

export function robustSigma(arr: number[]): number {
  const med = median(arr);
  const dev = arr.map((v) => Math.abs(v - med));
  return 1.4826 * median(dev);
}

// ------------------------------------------------------------------
// 2. Box Least Squares (Kovács, Zucker & Mazeh 2002)
// ------------------------------------------------------------------
export interface Periodogram {
  periods: number[];
  power: number[];
  bestPeriod: number;
  bestEpoch: number;
  bestDuration: number;
  bestDepth: number;
  sde: number; // signal detection efficiency
}

const DURATIONS_DAYS = [0.03, 0.05, 0.08, 0.12, 0.18, 0.26, 0.36, 0.5];

function blsAtPeriod(
  time: number[],
  flux: number[],
  period: number,
  nbins: number,
  t0: number,
): { power: number; phaseStart: number; durBins: number; depth: number } {
  const sum = new Float64Array(nbins);
  const cnt = new Float64Array(nbins);
  const n = time.length;
  let total = 0;
  const invP = 1 / period;
  for (let i = 0; i < n; i++) {
    const x = (time[i] - t0) * invP;
    const ph = x - Math.floor(x);
    let b = (ph * nbins) | 0;
    if (b >= nbins) b = nbins - 1;
    sum[b] += flux[i];
    cnt[b] += 1;
    total += flux[i];
  }
  let best = { power: 0, phaseStart: 0, durBins: 1, depth: 0 };
  for (const d of DURATIONS_DAYS) {
    if (d > period * 0.2) continue;
    const q = Math.max(1, Math.round((d / period) * nbins));
    // sliding circular window
    let s = 0;
    let c = 0;
    for (let k = 0; k < q; k++) {
      s += sum[k];
      c += cnt[k];
    }
    for (let start = 0; start < nbins; start++) {
      if (c > 3 && n - c > 3) {
        const meanIn = s / c;
        const meanOut = (total - s) / (n - c);
        const depth = meanOut - meanIn;
        if (depth > 0) {
          const power = (depth * depth * c * (n - c)) / n;
          if (power > best.power) best = { power, phaseStart: start / nbins, durBins: q, depth };
        }
      }
      // advance window
      const out = start;
      const inn = (start + q) % nbins;
      s += sum[inn] - sum[out];
      c += cnt[inn] - cnt[out];
    }
  }
  return best;
}

// phase-bin width of ~20 minutes regardless of period, so short transits are never smeared
function binsForPeriod(period: number) {
  return Math.min(3000, Math.max(200, Math.round(period / 0.014)));
}

export function boxLeastSquares(time: number[], flux: number[], minPeriod = 0.3, maxPeriod?: number, maxTrials = 9000): Periodogram {
  const t0 = time[0];
  const span = time[time.length - 1] - t0;
  // require at least 3 transits in the baseline (Kepler TCE rule)
  const pMax = Math.max(minPeriod * 2, Math.min(maxPeriod ?? span / 3, span / 3));
  const fMin = 1 / pMax;
  const fMax = 1 / minPeriod;
  // Build a frequency grid whose spacing keeps the accumulated phase drift below
  // a fraction of the shortest transit duration: Δf = q_min / (P · span)
  const qMin = 0.05;
  const grid: number[] = [];
  let f = fMin;
  while (f <= fMax) {
    grid.push(f);
    f += qMin / ((1 / f) * span);
  }
  // sub-sample if the grid is excessively large (very long baselines)
  const stride = Math.max(1, Math.ceil(grid.length / maxTrials));
  const periods: number[] = [];
  const power: number[] = [];
  let best = { power: -1, period: 1, phaseStart: 0, durBins: 1, depth: 0, nbins: 200 };
  for (let i = 0; i < grid.length; i += stride) {
    const p = 1 / grid[i];
    const nb = binsForPeriod(p);
    const r = blsAtPeriod(time, flux, p, nb, t0);
    periods.push(p);
    power.push(Math.sqrt(r.power));
    if (r.power > best.power) best = { ...r, period: p, nbins: nb };
  }
  // fine refinement around the best period
  const p0 = best.period;
  let fine = { ...best };
  const halfWidth = 0.003;
  for (let i = -120; i <= 120; i++) {
    const p = p0 * (1 + (i / 120) * halfWidth);
    const nb = Math.min(4000, binsForPeriod(p) * 2);
    const r = blsAtPeriod(time, flux, p, nb, t0);
    if (r.power > fine.power) fine = { ...r, period: p, nbins: nb };
  }
  const durFrac = fine.durBins / fine.nbins;
  const duration = durFrac * fine.period;
  const epoch = t0 + (fine.phaseStart + durFrac / 2) * fine.period;
  // SDE
  const mean = power.reduce((a, b) => a + b, 0) / power.length;
  const sd = Math.sqrt(power.reduce((a, b) => a + (b - mean) ** 2, 0) / power.length);
  const sde = sd > 0 ? (Math.max(...power) - mean) / sd : 0;
  return { periods, power, bestPeriod: fine.period, bestEpoch: epoch, bestDuration: duration, bestDepth: fine.depth, sde };
}

// ------------------------------------------------------------------
// 3. Phase folding & trapezoid fit
// ------------------------------------------------------------------
export function phaseFold(time: number[], period: number, epoch: number): number[] {
  return time.map((t) => {
    let ph = ((t - epoch) / period) % 1;
    if (ph < 0) ph += 1;
    if (ph > 0.5) ph -= 1;
    return ph; // [-0.5, 0.5)
  });
}

export interface TrapezoidFit {
  depth: number;
  duration: number; // days (T14)
  ingressFrac: number; // 0.05 = flat bottom, 0.5 = V shape
  chi2: number;
}

export function fitTrapezoid(phase: number[], flux: number[], period: number, durGuess: number): TrapezoidFit {
  // bin data within ±1.5 durations
  const win = durGuess * 1.5;
  const nb = 60;
  const bsum = new Float64Array(nb);
  const bcnt = new Float64Array(nb);
  for (let i = 0; i < phase.length; i++) {
    const dt = phase[i] * period;
    if (Math.abs(dt) > win) continue;
    const b = Math.min(nb - 1, Math.floor(((dt + win) / (2 * win)) * nb));
    bsum[b] += flux[i];
    bcnt[b] += 1;
  }
  const bx: number[] = [];
  const by: number[] = [];
  for (let b = 0; b < nb; b++) {
    if (bcnt[b] > 0) {
      bx.push(-win + ((b + 0.5) / nb) * 2 * win);
      by.push(1 - bsum[b] / bcnt[b]); // positive dip
    }
  }
  let best: TrapezoidFit = { depth: 0, duration: durGuess, ingressFrac: 0.2, chi2: Infinity };
  for (let di = 0; di < 14; di++) {
    const T = durGuess * (0.5 + di * 0.1);
    for (let fi = 0; fi < 10; fi++) {
      const f = 0.05 + fi * 0.05;
      // linear least squares for depth given shape
      let num = 0;
      let den = 0;
      const m: number[] = [];
      for (let k = 0; k < bx.length; k++) {
        const s = trapezoid(bx[k], T, f);
        m.push(s);
        num += s * by[k];
        den += s * s;
      }
      const depth = den > 0 ? num / den : 0;
      let chi2 = 0;
      for (let k = 0; k < bx.length; k++) chi2 += (by[k] - depth * m[k]) ** 2;
      if (chi2 < best.chi2) best = { depth, duration: T, ingressFrac: f, chi2 };
    }
  }
  return best;
}

// ------------------------------------------------------------------
// 4. Vetting metrics
// ------------------------------------------------------------------
export interface VettingMetrics {
  period: number;
  epoch: number;
  duration: number; // days
  depth: number; // fraction
  depthPpm: number;
  snr: number;
  sde: number;
  nTransits: number;
  oddDepth: number;
  evenDepth: number;
  oddEvenSigma: number;
  secondaryDepth: number;
  secondarySigma: number;
  ingressFrac: number;
  shape: 'U' | 'intermediate' | 'V';
  noiseSigma: number;
  expectedDuration: number; // days from stellar density
  durationRatio: number;
  dutyCycle: number; // duration / period
  sineAdvantage: number; // (chi2_box - chi2_sine) / chi2_box ; > 0 means a sinusoid fits better than a transit
}

// Compare a box/trapezoid transit model against a pure sinusoid (+ first harmonic) on the folded curve.
function sineVsBox(phase: number[], flux: number[], period: number, fit: TrapezoidFit): number {
  const nb = 120;
  const bs = new Float64Array(nb);
  const bc = new Float64Array(nb);
  for (let i = 0; i < phase.length; i++) {
    const b = Math.min(nb - 1, Math.floor((phase[i] + 0.5) * nb));
    bs[b] += flux[i];
    bc[b] += 1;
  }
  const x: number[] = [];
  const y: number[] = [];
  for (let b = 0; b < nb; b++) if (bc[b] > 0) {
    x.push(-0.5 + (b + 0.5) / nb);
    y.push(bs[b] / bc[b]);
  }
  if (y.length < 10) return 0;
  // box chi2
  let chiBox = 0;
  for (let k = 0; k < x.length; k++) {
    const mdl = 1 - fit.depth * trapezoid(x[k] * period, fit.duration, fit.ingressFrac);
    chiBox += (y[k] - mdl) ** 2;
  }
  // sinusoid chi2: y = a + b cos(2πφ) + c sin(2πφ) + d cos(4πφ) + e sin(4πφ)  (linear least squares, 5 params)
  const cols = x.map((p) => [1, Math.cos(2 * Math.PI * p), Math.sin(2 * Math.PI * p), Math.cos(4 * Math.PI * p), Math.sin(4 * Math.PI * p)]);
  const m = 5;
  const ata: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  const aty: number[] = new Array(m).fill(0);
  for (let k = 0; k < x.length; k++) {
    for (let i = 0; i < m; i++) {
      aty[i] += cols[k][i] * y[k];
      for (let j = 0; j < m; j++) ata[i][j] += cols[k][i] * cols[k][j];
    }
  }
  // gaussian elimination
  const A = ata.map((row, i) => [...row, aty[i]]);
  for (let i = 0; i < m; i++) {
    let piv = i;
    for (let r = i + 1; r < m; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]];
    if (Math.abs(A[i][i]) < 1e-14) return 0;
    for (let r = 0; r < m; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c <= m; c++) A[r][c] -= f * A[i][c];
    }
  }
  const coef = A.map((row, i) => row[m] / row[i]);
  let chiSine = 0;
  for (let k = 0; k < x.length; k++) {
    let mdl = 0;
    for (let i = 0; i < m; i++) mdl += coef[i] * cols[k][i];
    chiSine += (y[k] - mdl) ** 2;
  }
  return chiBox > 0 ? (chiBox - chiSine) / chiBox : 0;
}

function meanStd(arr: number[]) {
  if (arr.length === 0) return { mean: NaN, std: NaN, n: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, arr.length - 1));
  return { mean, std, n: arr.length };
}

export function computeMetrics(time: number[], flux: number[], pg: Periodogram, fit: TrapezoidFit, stellar: StellarParams): VettingMetrics {
  const period = pg.bestPeriod;
  const epoch = pg.bestEpoch;
  const duration = Math.min(fit.duration, period * 0.25);
  const phase = phaseFold(time, period, epoch);
  const inTr: number[] = [];
  const out: number[] = [];
  const odd: number[] = [];
  const even: number[] = [];
  const sec: number[] = [];
  const transitNums = new Set<number>();
  const inHalf = duration * 0.4; // core of the transit
  const exclude = Math.min(duration * 1.2, period * 0.15); // buffer around primary & secondary for the baseline
  for (let i = 0; i < time.length; i++) {
    const dt = phase[i] * period;
    const dtSec = ((phase[i] < 0 ? phase[i] + 1 : phase[i]) - 0.5) * period; // days from phase 0.5
    if (Math.abs(dt) < inHalf) {
      inTr.push(flux[i]);
      const n = Math.round((time[i] - epoch) / period);
      transitNums.add(n);
      if (Math.abs(n) % 2 === 1) odd.push(flux[i]);
      else even.push(flux[i]);
    } else if (Math.abs(dtSec) < inHalf) {
      sec.push(flux[i]);
    } else if (Math.abs(dt) > exclude && Math.abs(dtSec) > exclude) {
      out.push(flux[i]);
    }
  }
  const safe = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback);
  const o = meanStd(out.length > 10 ? out : flux);
  const sigma = Math.max(robustSigma(out.length > 10 ? out : flux), 1e-9);
  const i = meanStd(inTr);
  const depth = safe(o.mean - i.mean);
  const snr = inTr.length > 0 ? safe((depth / sigma) * Math.sqrt(inTr.length)) : 0;
  const od = meanStd(odd);
  const ev = meanStd(even);
  const oddDepth = od.n > 0 ? safe(o.mean - od.mean) : 0;
  const evenDepth = ev.n > 0 ? safe(o.mean - ev.mean) : 0;
  const oeErr = Math.sqrt((sigma * sigma) / Math.max(1, od.n) + (sigma * sigma) / Math.max(1, ev.n));
  const oddEvenSigma = od.n > 3 && ev.n > 3 ? safe(Math.abs(oddDepth - evenDepth) / oeErr) : 0;
  const s = meanStd(sec);
  const secondaryDepth = s.n > 3 ? safe(o.mean - s.mean) : 0;
  const secondarySigma = s.n > 3 ? safe(secondaryDepth / (sigma / Math.sqrt(s.n))) : 0;
  const ingressFrac = fit.ingressFrac;
  const shape: VettingMetrics['shape'] = ingressFrac <= 0.25 ? 'U' : ingressFrac >= 0.4 ? 'V' : 'intermediate';
  // Expected central-transit duration for a planet: T ≈ 13 h (P/1yr)^(1/3) R*/M*^(1/3)
  const expectedDuration = ((13 / 24) * Math.cbrt(period / 365.25) * stellar.radius) / Math.cbrt(stellar.mass);
  return {
    period,
    epoch,
    duration,
    depth,
    depthPpm: depth * 1e6,
    snr,
    sde: pg.sde,
    nTransits: transitNums.size,
    oddDepth,
    evenDepth,
    oddEvenSigma,
    secondaryDepth,
    secondarySigma,
    ingressFrac,
    shape,
    noiseSigma: sigma,
    expectedDuration,
    durationRatio: duration / expectedDuration,
    dutyCycle: duration / period,
    sineAdvantage: sineVsBox(phase, flux, period, fit),
  };
}

// ------------------------------------------------------------------
// 5. Derived planet properties
// ------------------------------------------------------------------
export interface PlanetProperties {
  radiusEarth: number;
  radiusJupiter: number;
  semiMajorAxisAU: number;
  equilibriumTempK: number;
  insolationEarth: number;
  periodDays: number;
  planetClass: string;
  starClass: string;
  habitableZone: 'too hot' | 'inner edge' | 'habitable zone' | 'outer edge' | 'too cold';
}

export function starClassFromTeff(teff: number): string {
  if (teff >= 30000) return 'O-type blue star';
  if (teff >= 10000) return 'B-type blue-white star';
  if (teff >= 7500) return 'A-type white star';
  if (teff >= 6000) return 'F-type yellow-white star';
  if (teff >= 5200) return 'G-type yellow dwarf (Sun-like)';
  if (teff >= 3700) return 'K-type orange dwarf';
  return 'M-type red dwarf';
}

export function derivePlanet(m: VettingMetrics, stellar: StellarParams): PlanetProperties {
  const radiusEarth = Math.sqrt(Math.max(m.depth, 0)) * stellar.radius * 109.2;
  const a = Math.cbrt(stellar.mass * (m.period / 365.25) ** 2);
  const rStarAU = stellar.radius * 0.00465047;
  const teq = stellar.teff * Math.sqrt(rStarAU / (2 * a)) * Math.pow(1 - 0.3, 0.25);
  const insol = (stellar.radius ** 2 * (stellar.teff / 5778) ** 4) / a ** 2;
  let planetClass = 'Terrestrial rocky world';
  if (radiusEarth > 22) planetClass = 'Stellar-sized object (not a planet)';
  else if (radiusEarth > 12) planetClass = 'Inflated / brown-dwarf-sized giant';
  else if (radiusEarth > 6) planetClass = teq > 1000 ? 'Hot Jupiter gas giant' : 'Jovian gas giant';
  else if (radiusEarth > 3.5) planetClass = teq > 800 ? 'Hot Neptune' : 'Neptune-like ice giant';
  else if (radiusEarth > 1.75) planetClass = 'Sub-Neptune / mini-Neptune';
  else if (radiusEarth > 1.25) planetClass = teq > 1200 ? 'Lava super-Earth' : 'Super-Earth';
  else if (teq > 1200) planetClass = 'Molten lava world';
  let hz: PlanetProperties['habitableZone'] = 'habitable zone';
  if (insol > 1.8) hz = 'too hot';
  else if (insol > 1.1) hz = 'inner edge';
  else if (insol < 0.2) hz = 'too cold';
  else if (insol < 0.36) hz = 'outer edge';
  return {
    radiusEarth,
    radiusJupiter: radiusEarth / 11.21,
    semiMajorAxisAU: a,
    equilibriumTempK: teq,
    insolationEarth: insol,
    periodDays: m.period,
    planetClass,
    starClass: starClassFromTeff(stellar.teff),
    habitableZone: hz,
  };
}

// ------------------------------------------------------------------
// 6. Classifier: logistic scoring over vetting flags
//    (mirrors the logic of the Kepler Robovetter / DR25 disposition tests)
// ------------------------------------------------------------------
export interface VettingTest {
  id: string;
  name: string;
  passed: boolean;
  severity: 'pass' | 'warn' | 'fail';
  detail: string;
  weight: number; // logit contribution
}

export interface Classification {
  verdict: 'PLANET' | 'FALSE POSITIVE' | 'CANDIDATE';
  probability: number; // P(planet)
  fpType: string | null;
  tests: VettingTest[];
  summary: string;
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

export function classify(m: VettingMetrics, planet: PlanetProperties): Classification {
  const tests: VettingTest[] = [];
  let logit = 0.8; // weak prior: roughly half of Kepler KOIs are planets

  // -- Signal significance --
  if (m.snr < 7.1 || m.sde < 6) {
    const w = m.snr < 4 ? -4 : -2.5;
    tests.push({ id: 'snr', name: 'Transit significance (MES ≥ 7.1σ)', passed: false, severity: 'fail', weight: w, detail: `SNR ${m.snr.toFixed(1)}σ, SDE ${m.sde.toFixed(1)}. Below the Kepler detection threshold — signal is consistent with noise or stellar variability.` });
    logit += w;
  } else {
    const w = Math.min((m.snr - 7) / 12, 2);
    tests.push({ id: 'snr', name: 'Transit significance (MES ≥ 7.1σ)', passed: true, severity: 'pass', weight: w, detail: `SNR ${m.snr.toFixed(1)}σ from ${m.nTransits} transits, periodogram SDE ${m.sde.toFixed(1)}. Clear periodic box-shaped signal.` });
    logit += w;
  }

  // -- Not transit-like: sinusoidal variability or absurd duty cycle --
  if (m.sineAdvantage > 0.15 || m.dutyCycle > 0.15 || m.secondarySigma < -4) {
    const why = m.dutyCycle > 0.15 ? `the dip occupies ${(m.dutyCycle * 100).toFixed(0)}% of the orbit (planets: < 10%)` : m.secondarySigma < -4 ? `flux is significantly brighter at phase 0.5 (${m.secondarySigma.toFixed(1)}σ) — a sinusoidal pattern, not an eclipse` : `a sinusoid fits ${(m.sineAdvantage * 100).toFixed(0)}% better than a transit box`;
    tests.push({ id: 'transitlike', name: 'Signal is transit-like (not sinusoidal)', passed: false, severity: 'fail', weight: -3.5, detail: `Not transit-like: ${why}. Typical of starspot rotation, pulsation or ellipsoidal variation.` });
    logit -= 3.5;
  } else if (m.sineAdvantage > 0 || m.dutyCycle > 0.1) {
    tests.push({ id: 'transitlike', name: 'Signal is transit-like (not sinusoidal)', passed: true, severity: 'warn', weight: -0.6, detail: `Marginal: sinusoid fits ${(m.sineAdvantage * 100).toFixed(0)}% better than a box; duty cycle ${(m.dutyCycle * 100).toFixed(1)}%.` });
    logit -= 0.6;
  } else {
    tests.push({ id: 'transitlike', name: 'Signal is transit-like (not sinusoidal)', passed: true, severity: 'pass', weight: 0.5, detail: `A box/trapezoid fits the folded curve ${(-m.sineAdvantage * 100).toFixed(0)}% better than a sinusoid; duty cycle ${(m.dutyCycle * 100).toFixed(1)}%.` });
    logit += 0.5;
  }

  // -- Number of transits --
  if (m.nTransits < 3) {
    tests.push({ id: 'ntr', name: 'Minimum 3 transits observed', passed: false, severity: 'warn', weight: -1.2, detail: `Only ${m.nTransits} transit event(s) in baseline. Period is poorly constrained.` });
    logit -= 1.2;
  } else {
    tests.push({ id: 'ntr', name: 'Minimum 3 transits observed', passed: true, severity: 'pass', weight: 0.2, detail: `${m.nTransits} individual transits folded on P = ${m.period.toFixed(4)} d.` });
    logit += 0.2;
  }

  // -- Implied radius --
  if (planet.radiusEarth > 25) {
    tests.push({ id: 'radius', name: 'Implied companion radius is planetary', passed: false, severity: 'fail', weight: -4, detail: `Depth ${(m.depth * 100).toFixed(2)}% implies R = ${planet.radiusEarth.toFixed(0)} R⊕ (${planet.radiusJupiter.toFixed(1)} R♃). This is a star, not a planet.` });
    logit -= 4;
  } else if (planet.radiusEarth > 18) {
    tests.push({ id: 'radius', name: 'Implied companion radius is planetary', passed: false, severity: 'warn', weight: -1.5, detail: `R = ${planet.radiusEarth.toFixed(1)} R⊕ is larger than any known inflated planet; likely a low-mass star or brown dwarf.` });
    logit -= 1.5;
  } else {
    tests.push({ id: 'radius', name: 'Implied companion radius is planetary', passed: true, severity: 'pass', weight: 0.6, detail: `R = ${planet.radiusEarth.toFixed(2)} R⊕ (${planet.radiusJupiter.toFixed(2)} R♃) — within the planetary regime.` });
    logit += 0.6;
  }

  // -- Odd / even --
  if (m.oddEvenSigma > 3) {
    tests.push({ id: 'oddeven', name: 'Odd/even transit depths consistent', passed: false, severity: 'fail', weight: -3, detail: `Odd ${(m.oddDepth * 1e6).toFixed(0)} ppm vs even ${(m.evenDepth * 1e6).toFixed(0)} ppm (${m.oddEvenSigma.toFixed(1)}σ). Alternating eclipses of two different stars — true period is 2×.` });
    logit -= 3;
  } else if (m.oddEvenSigma > 2) {
    tests.push({ id: 'oddeven', name: 'Odd/even transit depths consistent', passed: true, severity: 'warn', weight: -0.8, detail: `Marginal odd/even difference of ${m.oddEvenSigma.toFixed(1)}σ.` });
    logit -= 0.8;
  } else {
    tests.push({ id: 'oddeven', name: 'Odd/even transit depths consistent', passed: true, severity: 'pass', weight: 0.5, detail: `Odd ${(m.oddDepth * 1e6).toFixed(0)} ppm vs even ${(m.evenDepth * 1e6).toFixed(0)} ppm differ by only ${m.oddEvenSigma.toFixed(1)}σ.` });
    logit += 0.5;
  }

  // -- Secondary eclipse --
  if (m.secondarySigma > 3.5) {
    tests.push({ id: 'secondary', name: 'No significant secondary eclipse', passed: false, severity: 'fail', weight: -3, detail: `Secondary dip of ${(m.secondaryDepth * 1e6).toFixed(0)} ppm at phase 0.5 (${m.secondarySigma.toFixed(1)}σ). The companion is self-luminous — an eclipsing binary.` });
    logit -= 3;
  } else if (m.secondarySigma > 2.2) {
    tests.push({ id: 'secondary', name: 'No significant secondary eclipse', passed: true, severity: 'warn', weight: -0.8, detail: `Weak secondary feature (${m.secondarySigma.toFixed(1)}σ). Could be thermal emission from a hot planet or a faint blended binary.` });
    logit -= 0.8;
  } else {
    tests.push({ id: 'secondary', name: 'No significant secondary eclipse', passed: true, severity: 'pass', weight: 0.5, detail: `Phase 0.5 is flat to within ${m.secondarySigma.toFixed(1)}σ.` });
    logit += 0.5;
  }

  // -- Shape --
  if (m.shape === 'V') {
    tests.push({ id: 'shape', name: 'Transit shape (flat bottom vs V)', passed: false, severity: 'warn', weight: -1.4, detail: `Ingress/egress occupy ${(m.ingressFrac * 100).toFixed(0)}% of the event each — V-shaped. Typical of grazing stellar eclipses.` });
    logit -= 1.4;
  } else if (m.shape === 'intermediate') {
    tests.push({ id: 'shape', name: 'Transit shape (flat bottom vs V)', passed: true, severity: 'warn', weight: -0.3, detail: `Moderately rounded profile (ingress fraction ${(m.ingressFrac * 100).toFixed(0)}%). Consistent with a high-impact-parameter planet or a blend.` });
    logit -= 0.3;
  } else {
    tests.push({ id: 'shape', name: 'Transit shape (flat bottom vs V)', passed: true, severity: 'pass', weight: 0.6, detail: `Flat-bottomed U-shape (ingress fraction ${(m.ingressFrac * 100).toFixed(0)}%) — the companion is fully occulted and much smaller than the star.` });
    logit += 0.6;
  }

  // -- Duration vs stellar density --
  if (m.durationRatio > 2.5 || m.durationRatio < 0.15) {
    tests.push({ id: 'duration', name: 'Duration consistent with stellar density', passed: false, severity: 'warn', weight: -1.5, detail: `Measured ${(m.duration * 24).toFixed(1)} h vs ${(m.expectedDuration * 24).toFixed(1)} h expected for this star (ratio ${m.durationRatio.toFixed(1)}). Suggests the eclipse is on a different, larger star.` });
    logit -= 1.5;
  } else {
    tests.push({ id: 'duration', name: 'Duration consistent with stellar density', passed: true, severity: 'pass', weight: 0.3, detail: `Measured ${(m.duration * 24).toFixed(1)} h vs ${(m.expectedDuration * 24).toFixed(1)} h expected (ratio ${m.durationRatio.toFixed(2)}).` });
    logit += 0.3;
  }

  // Robovetter semantics: any single failed test is disqualifying, regardless of how strong the signal is
  const hardFails = tests.filter((t) => t.severity === 'fail').length;
  let probability = sigmoid(logit);
  if (hardFails > 0) probability = Math.min(probability, 0.3 / hardFails);
  let verdict: Classification['verdict'] = 'CANDIDATE';
  if (probability >= 0.62) verdict = 'PLANET';
  else if (probability <= 0.4) verdict = 'FALSE POSITIVE';

  let fpType: string | null = null;
  if (verdict !== 'PLANET') {
    if (m.snr < 7.1 || m.sde < 6) fpType = 'Noise / stellar variability — not transit-like';
    else if (m.sineAdvantage > 0.15 || m.dutyCycle > 0.15 || m.secondarySigma < -4) fpType = 'Stellar variability (starspots / pulsation) — sinusoidal, not transit-like';
    else if (planet.radiusEarth > 18) fpType = 'Eclipsing binary (stellar-sized companion)';
    else if (m.oddEvenSigma > 3) fpType = 'Eclipsing binary at twice the detected period';
    else if (m.secondarySigma > 3.5) fpType = 'Eclipsing binary / background blend with secondary eclipse';
    else if (m.shape === 'V') fpType = 'Grazing eclipsing binary';
    else if (m.durationRatio > 2.5) fpType = 'Blended eclipse on a larger background star';
    else fpType = 'Ambiguous — requires follow-up';
  }

  const failed = tests.filter((t) => t.severity === 'fail').length;
  const warns = tests.filter((t) => t.severity === 'warn').length;
  const summary =
    verdict === 'PLANET'
      ? `Signal passes all ${tests.length} vetting tests${warns ? ` with ${warns} minor warning(s)` : ''}. Periodic, flat-bottomed, planet-sized transits with no sign of a stellar companion.`
      : verdict === 'FALSE POSITIVE'
        ? `Signal fails ${failed} critical test(s)${warns ? ` and raises ${warns} warning(s)` : ''}. Most likely explanation: ${fpType}.`
        : `Signal is transit-like but ambiguous (${warns} warning(s)). Needs additional data such as centroid analysis, radial velocities or high-resolution imaging.`;

  return { verdict, probability, fpType, tests, summary };
}

// ------------------------------------------------------------------
// 7. Full pipeline
// ------------------------------------------------------------------
export interface AnalysisResult {
  lc: LightCurve;
  detrended: number[];
  trend: number[];
  periodogram: Periodogram;
  phase: number[];
  fit: TrapezoidFit;
  metrics: VettingMetrics;
  planet: PlanetProperties;
  classification: Classification;
  binned: { phase: number[]; flux: number[] };
  stellar: StellarParams;
  elapsedMs: number;
}

export function analyze(lc: LightCurve, stellar: StellarParams): AnalysisResult {
  const start = performance.now();
  const { flux: detrended, trend } = detrend(lc, 1.0);
  // sigma-clip strong positive outliers (cosmic rays) before searching
  const sig = robustSigma(detrended);
  const clipped = detrended.map((f) => (f > 1 + 4 * sig ? 1 : f));
  const pg = boxLeastSquares(lc.time, clipped);
  const phase = phaseFold(lc.time, pg.bestPeriod, pg.bestEpoch);
  const fit = fitTrapezoid(phase, clipped, pg.bestPeriod, pg.bestDuration);
  const metrics = computeMetrics(lc.time, clipped, pg, fit, stellar);
  const planet = derivePlanet(metrics, stellar);
  const classification = classify(metrics, planet);
  // binned folded curve for plotting
  const nb = 200;
  const bs = new Float64Array(nb);
  const bc = new Float64Array(nb);
  for (let i = 0; i < phase.length; i++) {
    const b = Math.min(nb - 1, Math.floor((phase[i] + 0.5) * nb));
    bs[b] += clipped[i];
    bc[b] += 1;
  }
  const binned = { phase: [] as number[], flux: [] as number[] };
  for (let b = 0; b < nb; b++) {
    if (bc[b] > 0) {
      binned.phase.push(-0.5 + (b + 0.5) / nb);
      binned.flux.push(bs[b] / bc[b]);
    }
  }
  return { lc, detrended: clipped, trend, periodogram: pg, phase, fit, metrics, planet, classification, binned, stellar, elapsedMs: performance.now() - start };
}
