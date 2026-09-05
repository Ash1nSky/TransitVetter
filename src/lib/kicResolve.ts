import { KEPLER_TARGETS, KeplerTarget, SiblingKoi } from './keplerTargets';
import { DEFAULT_SIM, SimParams, StellarParams } from './lightcurve';

// ---------------------------------------------------------------------------
// KIC resolver
// ---------------------------------------------------------------------------
// Give it a KIC id (or a KOI / Kepler name) and it hands back everything the
// app needs to pre-fill itself: host-star radius / mass / Teff plus the transit
// parameters (period, depth, duration, epoch) from the NASA cumulative KOI table.
//
// Two lookup layers:
//   1. offline  — the 26-target catalogue bundled in keplerTargets.ts. Instant,
//                 works with no network, covers the teaching targets.
//   2. live     — NASA Exoplanet Archive TAP service, queried straight from the
//                 browser. Covers all ~9,500 KOIs. If the network or CORS
//                 blocks it we simply fall back to layer 1 / a clear message.

export type { SiblingKoi };

export interface ResolvedTarget {
  kic: number;
  koi: string | null;
  displayName: string;
  keplerName: string | null;
  disposition: string;
  period: number | null; // days
  depthPpm: number | null;
  durationHours: number | null;
  epochBkjd: number | null;
  stellar: StellarParams;
  notes?: string;
  source: 'catalogue' | 'archive';
  siblings?: SiblingKoi[];
  allKois?: ResolvedTarget[];
}

export type ResolveStatus = 'idle' | 'loading' | 'ok' | 'not-found' | 'error';

export interface ResolveOutcome {
  status: ResolveStatus;
  target: ResolvedTarget | null;
  message: string;
}

// The NASA Exoplanet Archive TAP service. It sends no
// Access-Control-Allow-Origin header, so a direct browser fetch is blocked by
// CORS. We prefer the same-origin `/api/nasa` proxy (see vite.config.ts) and
// only fall back to this absolute URL when the proxy is unavailable.
const TAP_PATH = '/TAP/sync';
const TAP_HOST = 'https://exoplanetarchive.ipac.caltech.edu';
const TAP = `${TAP_HOST}${TAP_PATH}`;
// Same-origin path that vite proxies to TAP_HOST, dodging CORS entirely.
const TAP_PROXY = `/api/nasa${TAP_PATH}`;

/** What the user typed, reduced to something we can match on. */
export interface ParsedQuery {
  kic: number | null;
  koi: string | null; // normalised to the archive form, e.g. K00097.01
  name: string | null; // e.g. "Kepler-7 b"
  raw: string;
}

export function parseQuery(input: string): ParsedQuery {
  const raw = input.trim();
  const out: ParsedQuery = { kic: null, koi: null, name: null, raw };
  if (!raw) return out;

  // "KIC 6922244", "kic6922244", "006922244", "6922244"
  const kicMatch = raw.match(/^(?:kic[\s_-]*)?0*(\d{4,9})$/i);
  if (kicMatch) {
    out.kic = parseInt(kicMatch[1], 10);
    return out;
  }

  // "KOI-97.01", "K00097.01", "koi 97"
  const koiMatch = raw.match(/^(?:koi[\s_-]*|k)0*(\d{1,5})(?:\.(\d{1,2}))?$/i);
  if (koiMatch) {
    const num = koiMatch[1].padStart(5, '0');
    const planet = (koiMatch[2] ?? '01').padStart(2, '0');
    out.koi = `K${num}.${planet}`;
    return out;
  }

  // Anything else: treat as a name ("Kepler-7 b").
  out.name = raw;
  return out;
}

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Layer 1 — bundled catalogue. */
export function findInCatalogue(q: ParsedQuery): KeplerTarget | null {
  if (q.kic != null) return KEPLER_TARGETS.find((t) => t.kic === q.kic) ?? null;
  if (q.koi) return KEPLER_TARGETS.find((t) => t.koi === q.koi) ?? null;
  if (q.name) {
    const n = normName(q.name);
    return (
      KEPLER_TARGETS.find((t) => normName(t.displayName) === n) ??
      KEPLER_TARGETS.find((t) => t.keplerName && normName(t.keplerName) === n) ??
      // "Kepler-7" should match "Kepler-7 b"
      KEPLER_TARGETS.find((t) => normName(t.displayName).startsWith(n) && n.length >= 6) ??
      null
    );
  }
  return null;
}

export function fromCatalogue(t: KeplerTarget): ResolvedTarget {
  const sameKic = KEPLER_TARGETS.filter((x) => x.kic === t.kic);
  const siblingsFromCatalog: SiblingKoi[] = sameKic
    .filter((x) => x.koi !== t.koi)
    .map((x) => ({
      koi: x.koi ?? `KOI-${x.kic}`,
      keplerName: x.keplerName ?? null,
      period: x.period,
      depthPpm: x.depthPpm,
      durationHours: x.durationHours,
      epochBkjd: x.epochBkjd,
      disposition: x.disposition,
    }));
  const explicitSiblings = t.siblings ?? [];
  const allSiblings = [...explicitSiblings];
  for (const s of siblingsFromCatalog) {
    if (!allSiblings.some((x) => x.koi === s.koi)) {
      allSiblings.push(s);
    }
  }

  const allKois: ResolvedTarget[] = sameKic.map((k) => ({
    kic: k.kic,
    koi: k.koi,
    displayName: k.displayName,
    keplerName: k.keplerName ?? null,
    disposition: k.disposition,
    period: k.period,
    depthPpm: k.depthPpm,
    durationHours: k.durationHours,
    epochBkjd: k.epochBkjd ?? null,
    stellar: { ...k.stellar },
    notes: k.notes,
    source: 'catalogue',
  }));

  return {
    kic: t.kic,
    koi: t.koi,
    displayName: t.displayName,
    keplerName: t.keplerName ?? null,
    disposition: t.disposition,
    period: t.period,
    depthPpm: t.depthPpm,
    durationHours: t.durationHours,
    epochBkjd: t.epochBkjd ?? null,
    stellar: { ...t.stellar },
    notes: t.notes,
    source: 'catalogue',
    siblings: allSiblings.length > 0 ? allSiblings : undefined,
    allKois: allKois.length > 1 ? allKois : undefined,
  };
}

interface KoiRow {
  kepid: number;
  kepoi_name: string | null;
  kepler_name: string | null;
  koi_disposition: string | null;
  koi_period: number | null;
  koi_time0bk: number | null;
  koi_depth: number | null;
  koi_duration: number | null;
  koi_srad: number | null;
  koi_smass: number | null;
  koi_steff: number | null;
}

function adql(q: ParsedQuery): string | null {
  const cols = 'kepid,kepoi_name,kepler_name,koi_disposition,koi_period,koi_time0bk,koi_depth,koi_duration,koi_srad,koi_smass,koi_steff';
  if (q.kic != null) return `select ${cols} from cumulative where kepid=${q.kic} order by koi_period asc`;
  if (q.koi) {
    return `select ${cols} from cumulative where kepid in (select kepid from cumulative where kepoi_name='${q.koi}') order by koi_period asc`;
  }
  if (q.name) {
    const safe = q.name.replace(/'/g, "''");
    return `select ${cols} from cumulative where kepid in (select kepid from cumulative where kepler_name like '${safe}%') order by koi_period asc`;
  }
  return null;
}

/** The TAP query string (everything after the base URL). */
function tapQueryString(q: ParsedQuery): string | null {
  const query = adql(q);
  if (!query) return null;
  return `?query=${encodeURIComponent(query)}&format=json`;
}

/** Absolute NASA archive URL (direct, CORS-restricted). */
export function tapUrl(q: ParsedQuery): string | null {
  const qs = tapQueryString(q);
  return qs ? `${TAP}${qs}` : null;
}

/** Same-origin proxy URL (see the `/api/nasa` proxy in vite.config.ts). */
export function tapProxyUrl(q: ParsedQuery): string | null {
  const qs = tapQueryString(q);
  return qs ? `${TAP_PROXY}${qs}` : null;
}

function rowToResolved(r: KoiRow): ResolvedTarget {
  const kepler = r.kepler_name?.trim() || null;
  const koi = r.kepoi_name?.trim() || null;
  return {
    kic: r.kepid,
    koi,
    displayName: kepler ?? (koi ? koi.replace(/^K0*/, 'KOI-') : `KIC ${r.kepid}`),
    keplerName: kepler,
    disposition: (r.koi_disposition ?? 'UNKNOWN').toUpperCase(),
    period: r.koi_period ?? null,
    depthPpm: r.koi_depth ?? null,
    durationHours: r.koi_duration ?? null,
    epochBkjd: r.koi_time0bk ?? null,
    stellar: {
      radius: r.koi_srad ?? 1,
      mass: r.koi_smass ?? 1,
      teff: r.koi_steff ?? 5778,
    },
    source: 'archive',
  };
}

async function fetchTapRows(url: string, signal?: AbortSignal): Promise<ResolvedTarget[]> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Archive responded ${res.status}`);
  const rows = (await res.json()) as KoiRow[];
  if (!Array.isArray(rows)) throw new Error('Unexpected archive response');
  return rows.map(rowToResolved);
}

/**
 * Layer 2 — live NASA archive query.
 *
 * The TAP service sends no Access-Control-Allow-Origin header, so a direct
 * browser fetch trips a CORS error. We therefore hit the same-origin
 * `/api/nasa` proxy first (configured in vite.config.ts) and only fall back to
 * the absolute URL when the proxy isn't wired up. A network/TypeError from the
 * direct attempt almost always means CORS, so we surface that explicitly.
 */
export async function fetchFromArchive(q: ParsedQuery, signal?: AbortSignal): Promise<ResolvedTarget[]> {
  const proxyUrl = tapProxyUrl(q);
  const directUrl = tapUrl(q);
  if (!proxyUrl && !directUrl) return [];

  // 1. Same-origin proxy — dodges CORS entirely.
  if (proxyUrl) {
    try {
      return await fetchTapRows(proxyUrl, signal);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      // Proxy not available (e.g. built as a static single file) — fall back.
    }
  }

  // 2. Direct absolute URL — works only if the archive ever allows the origin.
  if (!directUrl) return [];
  try {
    return await fetchTapRows(directUrl, signal);
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    // A TypeError from fetch() with no HTTP status is the classic CORS symptom:
    // the request never completed because the archive sent no
    // Access-Control-Allow-Origin header. Flag it so callers can explain it.
    if (err instanceof TypeError) {
      throw new Error(
        'CORS: the NASA Exoplanet Archive did not allow a cross-origin request from your browser. Run through the /api/nasa same-origin proxy (vite dev/preview) to reach it live.',
      );
    }
    throw err;
  }
}

/**
 * Full resolve: catalogue first (instant), then the live archive.
 * Never throws — the outcome carries a human-readable message.
 */
export async function resolveKic(input: string, signal?: AbortSignal): Promise<ResolveOutcome> {
  const q = parseQuery(input);
  if (!q.kic && !q.koi && !q.name) {
    return { status: 'idle', target: null, message: 'Enter a KIC id, a KOI number or a Kepler name.' };
  }

  const local = findInCatalogue(q);
  if (local) {
    return {
      status: 'ok',
      target: fromCatalogue(local),
      message: 'Matched in the built-in catalogue — parameters filled in below.',
    };
  }

  try {
    const rawRows = await fetchFromArchive(q, signal);
    if (rawRows.length === 0) {
      return {
        status: 'not-found',
        target: null,
        message: `No Kepler Object of Interest matches “${q.raw}”. Check the id, or try a Kepler name like “Kepler-7 b”.`,
      };
    }

    const allTargets: ResolvedTarget[] = rawRows.map((r) => ({ ...r }));

    // Find the primary target the user asked for
    let selected = allTargets[0];
    if (q.koi) {
      const match = allTargets.find((t) => t.koi === q.koi);
      if (match) selected = match;
    } else if (q.name) {
      const n = normName(q.name);
      const match = allTargets.find((t) => normName(t.displayName) === n || (t.keplerName && normName(t.keplerName) === n));
      if (match) selected = match;
    } else {
      // Default: choose the deepest signal
      selected = [...allTargets].sort((a, b) => (b.depthPpm ?? 0) - (a.depthPpm ?? 0))[0];
    }

    // Attach siblings and allKois to each target
    for (const tgt of allTargets) {
      tgt.allKois = allTargets;
      tgt.siblings = allTargets
        .filter((x) => x.koi !== tgt.koi && x.period != null && x.durationHours != null)
        .map((x) => ({
          koi: x.koi ?? `KOI-${x.kic}`,
          keplerName: x.keplerName,
          period: x.period!,
          depthPpm: x.depthPpm ?? 0,
          durationHours: x.durationHours!,
          epochBkjd: x.epochBkjd ?? undefined,
          disposition: x.disposition,
        }));
    }

    return {
      status: 'ok',
      target: selected,
      message:
        allTargets.length > 1
          ? `Live from the NASA archive — KIC ${selected.kic} hosts ${allTargets.length} KOIs (${allTargets.map((x) => x.koi || x.displayName).join(', ')}). Active target: ${selected.displayName}${selected.koi ? ` (${selected.koi})` : ''}.`
          : 'Live from the NASA Exoplanet Archive — parameters filled in below.',
    };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { status: 'idle', target: null, message: '' };
    }
    const isCors = (err as Error)?.message?.startsWith('CORS:');
    return {
      status: 'error',
      target: null,
      message: isCors
        ? 'The NASA Exoplanet Archive blocked the live lookup with a CORS error (it sends no Access-Control-Allow-Origin header). This works when the app runs behind the /api/nasa proxy. Meanwhile the 26 bundled targets still resolve instantly — try one, or open the KOI table link below.'
        : 'Could not reach the NASA Exoplanet Archive from your browser (offline, or the request was blocked). The 26 bundled targets still resolve instantly — try one of those, or open the KOI table link below.',
    };
  }
}

/** Turn resolved KOI numbers into simulator parameters we can analyse right away. */
export function toSimParams(t: ResolvedTarget, seed = 42): SimParams {
  const period = t.period && t.period > 0 ? t.period : 5;
  const depth = t.depthPpm != null ? Math.max(0, t.depthPpm / 1e6) : 0.001;
  const durationDays = t.durationHours != null && t.durationHours > 0 ? t.durationHours / 24 : 0.12;
  const epoch = t.epochBkjd != null ? t.epochBkjd : period * 0.37;
  // Enough baseline for the BLS to see >= 5 transits, capped so it stays fast.
  const span = Math.min(180, Math.max(30, period * 6));
  // Deep V-shaped eclipses are the EB signature; shallow ones stay U-shaped.
  const shape = depth > 0.03 ? 0.42 : depth > 0.01 ? 0.2 : 0.13;
  return {
    ...DEFAULT_SIM,
    period,
    epoch,
    depth,
    duration: Math.min(durationDays, period * 0.4),
    shape,
    noise: Math.max(0.00008, Math.min(0.0004, depth / 12)),
    variabilityAmp: 0.0003,
    variabilityPeriod: 15,
    span,
    seed,
  };
}

export function koiTableUrlFor(t: ResolvedTarget): string {
  return `https://exoplanetarchive.ipac.caltech.edu/cgi-bin/TblView/nph-tblView?app=ExoTbls&config=cumulative&constraint=kepid+like+%27${t.kic}%27`;
}

export function resolverPythonSnippet(t: ResolvedTarget): string {
  const q = t.keplerName ? t.keplerName : `KIC ${t.kic}`;
  return `# pip install lightkurve\nimport lightkurve as lk\n\n# ${t.displayName} — KIC ${t.kic}${t.koi ? ` — ${t.koi}` : ''}\nlc = lk.search_lightcurve("${q}", mission="Kepler").download_all().stitch().remove_nans()\nlc.to_csv("kic_${t.kic}.csv")  # -> time, flux  (drop straight into TransitVetter)`;
}

/** Handful of ids shown as one-tap examples. */
export const RESOLVER_EXAMPLES = ['6948054', '6922244', 'Kepler-10 b', 'KOI-97.01', '8112039'];

