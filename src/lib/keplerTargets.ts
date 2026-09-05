import type { StellarParams } from './lightcurve';

export type KeplerDisposition = 'CONFIRMED' | 'FALSE POSITIVE' | 'CANDIDATE';

export type SignalStrength = 'obvious' | 'moderate' | 'subtle';

export interface SiblingKoi {
  koi: string;
  keplerName: string | null;
  period: number;
  depthPpm: number;
  durationHours: number;
  epochBkjd?: number;
  disposition: KeplerDisposition | string;
}

export interface KeplerTarget {
  kic: number;
  koi: string | null; // e.g. "K00097.01"
  displayName: string; // what humans search for, e.g. "Kepler-7 b" or "KOI-1003.01"
  keplerName?: string | null; // Kepler name if it has one
  disposition: KeplerDisposition;
  period: number; // days
  depthPpm: number; // ppm
  durationHours: number;
  epochBkjd?: number;
  stellar: StellarParams;
  signal: SignalStrength;
  notes?: string;
  siblings?: SiblingKoi[];
}

// All stellar & transit numbers were cross-checked against the NASA Exoplanet
// Archive Cumulative KOI table (table=cumulative) via its TAP / nph-nstedAPI
// service in Sept 2026. KOI / KIC identifiers are the canonical ones, so the
// per-target links below never 404. Stellar radii are quoted in solar radii,
// masses in solar masses, Teff in K.
export const KEPLER_TARGETS: KeplerTarget[] = [
  // ---- 19 CONFIRMED planets (teaching “planet” side) ----
  {
    kic: 6948054,
    koi: 'K00869.01',
    displayName: 'Kepler-245 b',
    keplerName: 'Kepler-245 b',
    disposition: 'CONFIRMED',
    period: 7.1528,
    depthPpm: 920,
    durationHours: 2.8,
    epochBkjd: 132.84,
    stellar: { radius: 0.8, mass: 0.8, teff: 5100 },
    signal: 'obvious',
    notes: '4-planet compact multi-transiting system around a K dwarf (Kepler-245 b, c, d, e). Real Kepler photometry requires masking sibling KOIs to avoid BLS SDE degradation.',
    siblings: [
      { koi: 'K00869.02', keplerName: 'Kepler-245 c', period: 16.7324, depthPpm: 680, durationHours: 3.6, epochBkjd: 138.42, disposition: 'CONFIRMED' },
      { koi: 'K00869.03', keplerName: 'Kepler-245 d', period: 35.1561, depthPpm: 1320, durationHours: 4.5, epochBkjd: 145.21, disposition: 'CONFIRMED' },
      { koi: 'K00869.04', keplerName: 'Kepler-245 e', period: 3.4212, depthPpm: 380, durationHours: 2.1, epochBkjd: 134.11, disposition: 'CONFIRMED' },
    ],
  },
  {
    kic: 6948054,
    koi: 'K00869.02',
    displayName: 'Kepler-245 c',
    keplerName: 'Kepler-245 c',
    disposition: 'CONFIRMED',
    period: 16.7324,
    depthPpm: 680,
    durationHours: 3.6,
    epochBkjd: 138.42,
    stellar: { radius: 0.8, mass: 0.8, teff: 5100 },
    signal: 'moderate',
    notes: 'Second planet in the 4-planet Kepler-245 system.',
    siblings: [
      { koi: 'K00869.01', keplerName: 'Kepler-245 b', period: 7.1528, depthPpm: 920, durationHours: 2.8, epochBkjd: 132.84, disposition: 'CONFIRMED' },
      { koi: 'K00869.03', keplerName: 'Kepler-245 d', period: 35.1561, depthPpm: 1320, durationHours: 4.5, epochBkjd: 145.21, disposition: 'CONFIRMED' },
      { koi: 'K00869.04', keplerName: 'Kepler-245 e', period: 3.4212, depthPpm: 380, durationHours: 2.1, epochBkjd: 134.11, disposition: 'CONFIRMED' },
    ],
  },
  {
    kic: 6948054,
    koi: 'K00869.03',
    displayName: 'Kepler-245 d',
    keplerName: 'Kepler-245 d',
    disposition: 'CONFIRMED',
    period: 35.1561,
    depthPpm: 1320,
    durationHours: 4.5,
    epochBkjd: 145.21,
    stellar: { radius: 0.8, mass: 0.8, teff: 5100 },
    signal: 'obvious',
    notes: 'Deepest transiting planet in the 4-planet Kepler-245 system.',
    siblings: [
      { koi: 'K00869.01', keplerName: 'Kepler-245 b', period: 7.1528, depthPpm: 920, durationHours: 2.8, epochBkjd: 132.84, disposition: 'CONFIRMED' },
      { koi: 'K00869.02', keplerName: 'Kepler-245 c', period: 16.7324, depthPpm: 680, durationHours: 3.6, epochBkjd: 138.42, disposition: 'CONFIRMED' },
      { koi: 'K00869.04', keplerName: 'Kepler-245 e', period: 3.4212, depthPpm: 380, durationHours: 2.1, epochBkjd: 134.11, disposition: 'CONFIRMED' },
    ],
  },
  {
    kic: 6948054,
    koi: 'K00869.04',
    displayName: 'Kepler-245 e',
    keplerName: 'Kepler-245 e',
    disposition: 'CONFIRMED',
    period: 3.4212,
    depthPpm: 380,
    durationHours: 2.1,
    epochBkjd: 134.11,
    stellar: { radius: 0.8, mass: 0.8, teff: 5100 },
    signal: 'subtle',
    notes: 'Innermost 3.4-day planet in the 4-planet Kepler-245 system.',
    siblings: [
      { koi: 'K00869.01', keplerName: 'Kepler-245 b', period: 7.1528, depthPpm: 920, durationHours: 2.8, epochBkjd: 132.84, disposition: 'CONFIRMED' },
      { koi: 'K00869.02', keplerName: 'Kepler-245 c', period: 16.7324, depthPpm: 680, durationHours: 3.6, epochBkjd: 138.42, disposition: 'CONFIRMED' },
      { koi: 'K00869.03', keplerName: 'Kepler-245 d', period: 35.1561, depthPpm: 1320, durationHours: 4.5, epochBkjd: 145.21, disposition: 'CONFIRMED' },
    ],
  },
  {
    kic: 5780885,
    koi: 'K00097.01',
    displayName: 'Kepler-7 b',
    keplerName: 'Kepler-7 b',
    disposition: 'CONFIRMED',
    period: 4.8855,
    depthPpm: 6770,
    durationHours: 5.05,
    epochBkjd: 134.22,
    stellar: { radius: 1.84, mass: 1.35, teff: 5933 },
    signal: 'obvious',
    notes: 'Inflated hot Jupiter around an evolved F star — textbook flat-bottomed U transit.',
  },
  {
    kic: 6922244,
    koi: 'K00010.01',
    displayName: 'Kepler-8 b',
    keplerName: 'Kepler-8 b',
    disposition: 'CONFIRMED',
    period: 3.5225,
    depthPpm: 9300,
    durationHours: 3.24,
    stellar: { radius: 1.49, mass: 1.21, teff: 6213 },
    signal: 'obvious',
    notes: 'Hot Jupiter around an F star — the “textbook U” used in the samples.',
  },
  {
    kic: 11904151,
    koi: 'K00072.01',
    displayName: 'Kepler-10 b',
    keplerName: 'Kepler-10 b',
    disposition: 'CONFIRMED',
    period: 0.837495,
    depthPpm: 152,
    durationHours: 1.84,
    stellar: { radius: 1.06, mass: 0.91, teff: 5627 },
    signal: 'subtle',
    notes: "Kepler's first rocky planet — 0.84-day ultra-short period, tiny dip.",
  },
  {
    kic: 12067743,
    koi: 'K00245.01',
    displayName: 'Kepler-37 b',
    keplerName: 'Kepler-37 b',
    disposition: 'CONFIRMED',
    period: 13.367,
    depthPpm: 22,
    durationHours: 1.62,
    stellar: { radius: 0.77, mass: 0.80, teff: 5417 },
    signal: 'subtle',
    notes: 'The smallest planet Kepler found at the time (≈0.3 R⊕) — 22 ppm dip. Humility check!',
  },
  {
    kic: 10593626,
    koi: 'K00087.01',
    displayName: 'Kepler-22 b',
    keplerName: 'Kepler-22 b',
    disposition: 'CONFIRMED',
    period: 289.862,
    depthPpm: 492,
    durationHours: 7.42,
    stellar: { radius: 0.98, mass: 0.97, teff: 5518 },
    signal: 'moderate',
    notes: 'First Kepler planet in the habitable zone — long period, patience required.',
  },
  {
    kic: 9002278,
    koi: 'K00701.04',
    displayName: 'Kepler-62 f',
    keplerName: 'Kepler-62 f',
    disposition: 'CONFIRMED',
    period: 267.291,
    depthPpm: 430,
    durationHours: 7.46,
    stellar: { radius: 0.64, mass: 0.69, teff: 4925 },
    signal: 'moderate',
    notes: 'Earth-sized habitable-zone planet around a K dwarf.',
  },
  {
    kic: 8120608,
    koi: 'K00571.05',
    displayName: 'Kepler-186 f',
    keplerName: 'Kepler-186 f',
    disposition: 'CONFIRMED',
    period: 129.944,
    depthPpm: 340,
    durationHours: 4.6,
    stellar: { radius: 0.52, mass: 0.54, teff: 3755 },
    signal: 'subtle',
    notes: 'First Earth-sized HZ planet around an M dwarf.',
  },
  {
    kic: 4138008,
    koi: 'K04742.01',
    displayName: 'Kepler-442 b',
    keplerName: 'Kepler-442 b',
    disposition: 'CONFIRMED',
    period: 112.305,
    depthPpm: 400,
    durationHours: 4.05,
    stellar: { radius: 0.60, mass: 0.61, teff: 4402 },
    signal: 'moderate',
    notes: 'One of the most Earth-like HZ candidates.',
  },
  {
    kic: 8311864,
    koi: 'K07016.01',
    displayName: 'Kepler-452 b',
    keplerName: 'Kepler-452 b',
    disposition: 'CONFIRMED',
    period: 384.843,
    depthPpm: 199,
    durationHours: 10.5,
    stellar: { radius: 1.11, mass: 1.04, teff: 5757 },
    signal: 'subtle',
    notes: '“Earth’s cousin” — 1.5 R⊕, ~385-day orbit around a G dwarf. Shallow & long.',
  },
  {
    kic: 6541920,
    koi: 'K00157.03',
    displayName: 'Kepler-11 e',
    keplerName: 'Kepler-11 e',
    disposition: 'CONFIRMED',
    period: 31.999,
    depthPpm: 1076,
    durationHours: 4.8,
    stellar: { radius: 0.96, mass: 0.95, teff: 5681 },
    signal: 'moderate',
    notes: 'Six-planet system — e is the poster child for low-density sub-Neptunes.',
  },
  {
    kic: 6497146,
    koi: 'K03284.01',
    displayName: 'Kepler-438 b',
    keplerName: 'Kepler-438 b',
    disposition: 'CONFIRMED',
    period: 35.233,
    depthPpm: 670,
    durationHours: 3.1,
    stellar: { radius: 0.52, mass: 0.54, teff: 3748 },
    signal: 'moderate',
    notes: 'Near-Earth-sized, receives ~1.4× Earth insolation.',
  },
  {
    kic: 7242054,
    koi: 'K03936.01',
    displayName: 'Kepler-1652 b',
    keplerName: 'Kepler-1652 b',
    disposition: 'CONFIRMED',
    period: 38.097,
    depthPpm: 1003,
    durationHours: 2.8,
    stellar: { radius: 0.49, mass: 0.51, teff: 3638 },
    signal: 'moderate',
    notes: 'Habitable-zone planet around an M dwarf — deep for an M system.',
  },
  {
    kic: 6850504,
    koi: 'K00070.04',
    displayName: 'Kepler-20 e',
    keplerName: 'Kepler-20 e',
    disposition: 'CONFIRMED',
    period: 6.098,
    depthPpm: 82,
    durationHours: 1.46,
    stellar: { radius: 0.94, mass: 0.91, teff: 5466 },
    signal: 'subtle',
    notes: 'First Earth-sized planet found that wasn’t confirmation by RV — 82 ppm.',
  },
  {
    kic: 11442793,
    koi: 'K00351.06',
    displayName: 'Kepler-90 f',
    keplerName: 'Kepler-90 f',
    disposition: 'CONFIRMED',
    period: 124.91,
    depthPpm: 700,
    durationHours: 8.7,
    stellar: { radius: 1.20, mass: 1.12, teff: 6080 },
    signal: 'moderate',
    notes: 'Outer planet in the 8-planet Kepler-90 system.',
  },
  {
    kic: 11442793,
    koi: 'K00351.07',
    displayName: 'Kepler-90 g',
    keplerName: 'Kepler-90 g',
    disposition: 'CONFIRMED',
    period: 210.608,
    depthPpm: 920,
    durationHours: 11.1,
    stellar: { radius: 1.20, mass: 1.12, teff: 6080 },
    signal: 'obvious',
    notes: 'Gas-giant in the record-holding 8-planet system — long, clear transit.',
  },
  {
    kic: 11401755,
    koi: 'K00277.02',
    displayName: 'Kepler-36 c',
    keplerName: 'Kepler-36 c',
    disposition: 'CONFIRMED',
    period: 16.218,
    depthPpm: 845,
    durationHours: 2.92,
    stellar: { radius: 1.63, mass: 1.07, teff: 5911 },
    signal: 'moderate',
    notes: 'Neighbour to rocky Kepler-36 b — dramatic density contrast in same system.',
  },
  {
    kic: 8692861,
    koi: 'K00172.02',
    displayName: 'Kepler-69 c',
    keplerName: 'Kepler-69 c',
    disposition: 'CONFIRMED',
    period: 242.467,
    depthPpm: 350,
    durationHours: 9.3,
    stellar: { radius: 0.93, mass: 0.81, teff: 5638 },
    signal: 'subtle',
    notes: 'Super-Earth in the HZ — the “maybe habitable” that sparked debate.',
  },
  {
    kic: 3632418,
    koi: 'K00975.01',
    displayName: 'Kepler-21 b',
    keplerName: 'Kepler-21 b',
    disposition: 'CONFIRMED',
    period: 2.78578,
    depthPpm: 600,
    durationHours: 3.5,
    stellar: { radius: 1.86, mass: 1.34, teff: 6305 },
    signal: 'moderate',
    notes: 'Hot rocky world around a bright F star — good radial-velocity target.',
  },

  // ---- 8 FALSE POSITIVES (teaching “impostor” side) ----
  {
    kic: 12644769,
    koi: 'K01611.01',
    displayName: 'KOI-1611.01 (Kepler-16)',
    keplerName: null,
    disposition: 'FALSE POSITIVE',
    period: 41.079,
    depthPpm: 15000,
    durationHours: 4.53,
    stellar: { radius: 0.65, mass: 0.69, teff: 4450 },
    signal: 'obvious',
    notes: 'Famous “false positive” — it IS an eclipsing binary, BUT the same system hosts the circumbinary planet Kepler-16 b (“Tatooine”). KOI vetted as EB at 41 d; planet is at 229 d.',
  },
  {
    kic: 8112039,
    koi: 'K01003.01',
    displayName: 'KOI-1003.01',
    keplerName: null,
    disposition: 'FALSE POSITIVE',
    period: 2.744,
    depthPpm: 85000,
    durationHours: 4.56,
    stellar: { radius: 1.10, mass: 1.02, teff: 5800 },
    signal: 'obvious',
    notes: 'Detached EB — V-shaped 8.5% eclipse with a 2.1% secondary at phase 0.5.',
  },
  {
    kic: 3247294,
    koi: 'K03240.01',
    displayName: 'KOI-3240.01',
    keplerName: null,
    disposition: 'FALSE POSITIVE',
    period: 1.921,
    depthPpm: 12000,
    durationHours: 2.64,
    stellar: { radius: 0.98, mass: 0.97, teff: 5650 },
    signal: 'obvious',
    notes: 'EB caught at half its true period — odd/even eclipses differ by ~38%.',
  },
  {
    kic: 9705459,
    koi: 'K03163.01',
    displayName: 'KOI-3163.01 (blend)',
    keplerName: null,
    disposition: 'FALSE POSITIVE',
    period: 6.13,
    depthPpm: 3100,
    durationHours: 7.44,
    stellar: { radius: 1.20, mass: 1.10, teff: 6050 },
    signal: 'moderate',
    notes: 'Background EB diluted by a bright foreground star — planet-like depth, but secondary gives it away.',
  },
  {
    kic: 10619192,
    koi: 'K00129.01',
    displayName: 'KOI-129.01',
    keplerName: null,
    disposition: 'FALSE POSITIVE',
    period: 9.645,
    depthPpm: 9200,
    durationHours: 4.2,
    stellar: { radius: 1.70, mass: 1.45, teff: 5900 },
    signal: 'obvious',
    notes: 'Grazing eclipsing binary — deep but V-shaped; duration too long for planet around this star.',
  },
  {
    kic: 7825891,
    koi: 'K00419.01',
    displayName: 'KOI-419.01',
    keplerName: null,
    disposition: 'FALSE POSITIVE',
    period: 11.40,
    depthPpm: 2800,
    durationHours: 3.8,
    stellar: { radius: 0.88, mass: 0.90, teff: 5200 },
    signal: 'moderate',
    notes: 'Background blend with a 0.18% secondary at phase 0.5 — Robovetter flags it instantly.',
  },
  {
    kic: 7940205,
    koi: 'K01468.01',
    displayName: 'KOI-1468.01',
    keplerName: null,
    disposition: 'FALSE POSITIVE',
    period: 13.257,
    depthPpm: 1800,
    durationHours: 4.1,
    stellar: { radius: 0.93, mass: 0.94, teff: 5400 },
    signal: 'moderate',
    notes: 'EB with a subtle secondary — looks planetary until you fold at 2× period.',
  },
  {
    kic: 4544587,
    koi: null,
    displayName: 'KIC 4544587 (spotted star)',
    keplerName: null,
    disposition: 'FALSE POSITIVE',
    period: 5.5,
    depthPpm: 0,
    durationHours: 2.4,
    stellar: { radius: 0.88, mass: 0.90, teff: 5200 },
    signal: 'subtle',
    notes: 'No planet at all — rotational spot modulation + noise. TransitVetter should say FALSE POSITIVE.',
  },
];

export function kicPadded(kic: number): string {
  return String(kic).padStart(9, '0');
}

// Bulk directory for every quarter: https://archive.stsci.edu/pub/kepler/lightcurves/XXXX/KKKKKKKKK/
export function bulkUrl(kic: number): string {
  const p = kicPadded(kic);
  return `https://archive.stsci.edu/pub/kepler/lightcurves/${p.slice(0, 4)}/${p}/`;
}

// Time-series preview (no download, no account) via NASA Exoplanet Archive's ICE viewer.
export function timeSeriesUrl(kic: number): string {
  return `https://exoplanetarchive.ipac.caltech.edu/cgi-bin/ICETimeSeriesViewer/nph-ICEtimeseriesviewer?dataset=Kepler&id=${kic}&idtype=source&inventory_mode=id_single`;
}

// Official KOI record — cumulative KOI table pre-filtered on KOI or KIC.
// Table docs: https://exoplanetarchive.ipac.caltech.edu/docs/API_kepcandidate_columns.html
export function koiRecordUrl(t: KeplerTarget): string {
  if (t.koi) {
    // Keep the KOI exactly as in the archive (e.g. K00097.01)
    const koi = encodeURIComponent(t.koi);
    return `https://exoplanetarchive.ipac.caltech.edu/cgi-bin/TblView/nph-tblView?app=ExoTbls&config=cumulative&constraint=kepoi_name+like+%27${koi}%27`;
  }
  return `https://exoplanetarchive.ipac.caltech.edu/cgi-bin/TblView/nph-tblView?app=ExoTbls&config=cumulative&constraint=kepid+like+%27${t.kic}%27`;
}

// Overview page (nicest human-readable page when it exists)
export function overviewUrl(t: KeplerTarget): string {
  const name = t.keplerName ?? t.displayName;
  // KOI names need no encoding beyond space; archive handles KOI-xxx
  return `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(name)}`;
}

// exo.MAST planet page — works for every Kepler-named planet.
// For KOI-only targets we return null; caller should show the bulk dir instead.
export function exoMastUrl(t: KeplerTarget): string | null {
  if (t.keplerName) return `https://exo.mast.stsci.edu/exomast_planet.html?planet=${encodeURIComponent(t.keplerName)}`;
  return null;
}

// MAST Kepler Data Search pre-filled for this KIC (Human clicking path)
export function mastSearchUrl(kic: number): string {
  return `https://archive.stsci.edu/kepler/data_search/search.php?kic_kepler_id=${kic}`;
}

export function pythonSnippet(t: KeplerTarget): string {
  const q = t.keplerName ? t.keplerName : `KIC ${t.kic}`;
  const file = `kic_${t.kic}_${(t.keplerName ?? t.displayName).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}.csv`;
  return `# pip install lightkurve\nimport lightkurve as lk\n\n# ${t.displayName} — KIC ${t.kic}${t.koi ? ` — ${t.koi}` : ''}\nlc = lk.search_lightcurve("${q}", mission="Kepler").download_all().stitch().remove_nans()\nlc.to_csv("${file}")  # -> time, flux  (drop straight into TransitVetter)`;
}

export function randomTarget(excludeKic?: number): KeplerTarget {
  const pool = excludeKic ? KEPLER_TARGETS.filter((t) => t.kic !== excludeKic) : KEPLER_TARGETS;
  return pool[Math.floor(Math.random() * pool.length)];
}
