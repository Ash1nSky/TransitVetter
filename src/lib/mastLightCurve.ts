import { kicPadded } from './keplerTargets';
import { LightCurve, median } from './lightcurve';
import { extractQuarterLightCurve } from './fitsLightCurve';

// ---------------------------------------------------------------------------
// Real Kepler light curves from MAST
// ---------------------------------------------------------------------------
// The "archive model" path synthesizes an idealized transit from three numbers
// (period/depth/duration), which cannot reproduce the binary signatures —
// secondary eclipse, odd/even depth mismatch — that make a FALSE POSITIVE a
// false positive. This module instead downloads the target's ACTUAL Kepler
// long-cadence photometry from the MAST bulk tree:
//
//   https://archive.stsci.edu/pub/kepler/lightcurves/0062/006267425/
//
// ...picks up to MAX_QUARTERS quarter files spread across the mission, parses
// the LIGHTCURVE binary table out of each FITS file, stitches them into one
// time-sorted series and normalises by the median — ready for analyze().
//
// Like the NASA TAP lookup, MAST sends no Access-Control-Allow-Origin header,
// so the browser goes through the same-origin /api/mast proxy (vite.config.ts)
// and only falls back to the absolute URL when the proxy isn't wired up.

const MAST_HOST = 'https://archive.stsci.edu';
const MAST_PROXY = '/api/mast';

/** How many quarter files to download (spread across the mission). ~4.4k long-cadence points each. */
export const MAX_QUARTERS = 4;

export type MastErrorCode = 'NOT_FOUND' | 'NO_LONG_CADENCE' | 'SHORT_ONLY' | 'EMPTY' | 'NETWORK' | 'PARSE';

export class MastError extends Error {
  code: MastErrorCode;
  constructor(code: MastErrorCode, message: string) {
    super(message);
    this.name = 'MastError';
    this.code = code;
  }
}

/** Bulk-tree directory path for a KIC, e.g. /pub/kepler/lightcurves/0062/006267425/ */
export function mastDirPath(kic: number): string {
  const p = kicPadded(kic);
  return `/pub/kepler/lightcurves/${p.slice(0, 4)}/${p}/`;
}

export function mastDirProxyUrl(kic: number): string {
  return `${MAST_PROXY}${mastDirPath(kic)}`;
}

export function mastDirDirectUrl(kic: number): string {
  return `${MAST_HOST}${mastDirPath(kic)}`;
}

/** Filenames in an Apache directory listing: kplr006267425-2010078095331_llc.fits */
export function parseListingFilenames(html: string): string[] {
  const re = /href="([^"]*?kplr\d+-\d+_llc\.fits)"/gi;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const base = (m[1].split('/').pop() ?? m[1]).split('?')[0];
    if (base.endsWith('_llc.fits')) out.add(base);
  }
  return [...out].sort();
}

/** Pick up to `max` files spread evenly across the (chronological) listing. */
export function pickQuarters(files: string[], max: number): string[] {
  if (max < 1 || files.length <= max) return [...files];
  if (max === 1) return [files[Math.floor(files.length / 2)]];
  const picked: string[] = [];
  for (let i = 0; i < max; i++) {
    picked.push(files[Math.round((i * (files.length - 1)) / (max - 1))]);
  }
  return picked;
}

async function fetchMast(path: string, signal: AbortSignal | undefined, as: 'text'): Promise<string>;
async function fetchMast(path: string, signal: AbortSignal | undefined, as: 'buffer'): Promise<ArrayBuffer>;
async function fetchMast(path: string, signal: AbortSignal | undefined, as: 'text' | 'buffer'): Promise<string | ArrayBuffer> {
  const urls = [`${MAST_PROXY}${path}`, `${MAST_HOST}${path}`];
  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal });
      if (res.status === 404) {
        // Either the target really has no MAST directory (never observed by
        // Kepler) or the request never reached MAST (no /api/mast proxy in a
        // static build) — the message covers both.
        throw new MastError(
          'NOT_FOUND',
          `MAST has no light-curve directory for this KIC (404). Either Kepler never observed it, or the download never reached MAST: the static single-file build has no /api/mast proxy, so run via “npm run dev” / “npm run preview”, or fetch the data with the Python snippet below and upload it.`,
        );
      }
      if (!res.ok) throw new Error(`MAST responded ${res.status}`);
      return as === 'text' ? await res.text() : await res.arrayBuffer();
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      if (err instanceof MastError) throw err; // 404 verdict stands — don't retry direct
      lastErr = err;
    }
  }
  if (lastErr instanceof TypeError) {
    throw new MastError(
      'NETWORK',
      'Could not reach MAST from your browser (offline, or the archive blocked the cross-origin request — it sends no Access-Control-Allow-Origin header). Run the app behind the /api/mast proxy (“npm run dev” / “npm run preview”) to download real light curves, or fetch the data with the Python snippet and upload it.',
    );
  }
  throw lastErr instanceof Error ? lastErr : new MastError('NETWORK', 'Could not reach MAST from your browser.');
}

export interface MastProgress {
  stage: 'listing' | 'download';
  done: number;
  total: number;
  label: string;
}

export interface MastLightCurve {
  lc: LightCurve;
  files: string[];
  available: number;
  fluxColumn: string;
  nRawRows: number;
  qualityCut: boolean;
}

export interface FetchRealOptions {
  maxQuarters?: number;
  signal?: AbortSignal;
  onProgress?: (p: MastProgress) => void;
}

/**
 * Download a target's real Kepler long-cadence photometry from MAST and turn
 * it into a pipeline-ready LightCurve (stitched, time-sorted, median-1).
 * Throws MastError with a human-readable message on any failure.
 */
export async function fetchRealLightCurve(kic: number, displayName: string, opts: FetchRealOptions = {}): Promise<MastLightCurve> {
  const maxQuarters = opts.maxQuarters ?? MAX_QUARTERS;
  const dir = mastDirPath(kic);
  opts.onProgress?.({ stage: 'listing', done: 0, total: 1, label: `Listing Kepler quarters for KIC ${kic} on MAST…` });
  const html = await fetchMast(dir, opts.signal, 'text');

  const files = parseListingFilenames(html);
  if (files.length === 0) {
    // A proxy-less static host often answers /api/* with the app's own
    // index.html (HTTP 200) — that parses as "no files", so detect it.
    if (!/index of/i.test(html)) {
      throw new MastError(
        'NETWORK',
        'The quarter listing did not come back from MAST (got something else — usually the app shell when the /api/mast proxy is missing). Run via “npm run dev” / “npm run preview” for real-light-curve downloads, or fetch the data with the Python snippet and upload it.',
      );
    }
    if (/slc\.fits/i.test(html)) {
      throw new MastError(
        'SHORT_ONLY',
        `KIC ${kic} was only observed in Kepler short cadence (1-minute sampling), which this downloader does not support yet — those files need heavy downsampling before the search stays interactive. Use the Python snippet below and upload the CSV instead.`,
      );
    }
    throw new MastError('NO_LONG_CADENCE', `No Kepler long-cadence light curves found for KIC ${kic} on MAST.`);
  }

  const picked = pickQuarters(files, maxQuarters);
  const times: number[] = [];
  const fluxes: number[] = [];
  let nRawRows = 0;
  let fluxColumn = 'PDCSAP_FLUX';
  let qualityCut = false;
  for (let i = 0; i < picked.length; i++) {
    opts.onProgress?.({ stage: 'download', done: i, total: picked.length, label: `Downloading ${picked[i]} (${i + 1}/${picked.length})…` });
    const buf = await fetchMast(`${dir}${picked[i]}`, opts.signal, 'buffer');
    let q;
    try {
      q = extractQuarterLightCurve(buf);
    } catch (err) {
      throw new MastError(
        'PARSE',
        `Downloaded ${picked[i]} but could not parse it as a Kepler light curve (${(err as Error)?.message ?? err}). MAST may have served an error page — try again, or use the Python snippet and upload the CSV.`,
      );
    }
    nRawRows += q.nRows;
    fluxColumn = q.fluxColumn;
    qualityCut = qualityCut || q.qualityCutApplied;
    for (let j = 0; j < q.time.length; j++) {
      times.push(q.time[j]);
      fluxes.push(q.flux[j]);
    }
  }

  if (times.length < 50) {
    throw new MastError(
      'EMPTY',
      `The MAST files for KIC ${kic} yielded only ${times.length} usable cadences after removing gaps and flagged data — not enough to vet. The target may be too faint or the quarters may be mostly flagged.`,
    );
  }

  // Stitch: sort by time (quarters arrive in arbitrary order).
  const idx = times.map((_, i) => i).sort((a, b) => times[a] - times[b]);
  const st = idx.map((i) => times[i]);
  let sf = idx.map((i) => fluxes[i]);
  // Normalise by the median: the pipeline expects flux ≈ 1.
  const med = median(sf);
  if (!Number.isFinite(med) || med <= 0) {
    throw new MastError('EMPTY', `The MAST fluxes for KIC ${kic} look invalid (non-positive median) — refusing to vet garbage.`);
  }
  sf = sf.map((f) => f / med);

  const lc: LightCurve = {
    time: st,
    flux: sf,
    name: `${displayName} (KIC ${kic}) — real Kepler photometry (${picked.length} quarter${picked.length > 1 ? 's' : ''})`,
    source: 'mast',
  };
  opts.onProgress?.({
    stage: 'download',
    done: picked.length,
    total: picked.length,
    label: `${st.length.toLocaleString()} cadences from ${picked.length} quarter${picked.length > 1 ? 's' : ''} ready.`,
  });
  return { lc, files: picked, available: files.length, fluxColumn, nRawRows, qualityCut };
}
