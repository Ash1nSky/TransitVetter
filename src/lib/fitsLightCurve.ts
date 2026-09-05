// ---------------------------------------------------------------------------
// Minimal FITS reader — just enough to pull TIME / PDCSAP_FLUX / SAP_QUALITY
// out of a Kepler (or TESS) light-curve file, in the browser, with no
// dependencies. Only what the pipeline needs is implemented:
//
//   * 2880-byte header blocks, 80-char cards
//   * skipping HDUs to the LIGHTCURVE binary table (HDU 1 in mission files)
//   * BINTABLE columns with scalar numeric TFORMs (D/E/J/K/I/B/L, plus A/C/M/X
//     for row-stride accounting), TSCAL/TZERO/TNULL handling
//   * big-endian data (FITS standard) via DataView
//
// Kepler layout reference (Archive Manual, confirmed against MAST sample
// headers): 20 columns, TIME(D) 1, PDCSAP_FLUX(E) 6, SAP_FLUX(E) 4,
// SAP_QUALITY(J) 10. Columns are matched by TTYPEn name first; when names are
// absent we fall back to the documented fixed positions.
// ---------------------------------------------------------------------------

const FITS_BLOCK = 2880;
const CARD_LEN = 80;

export class FitsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FitsError';
  }
}

type HeaderValue = string | number | boolean;
type HeaderMap = Map<string, HeaderValue>;

function ascii(bytes: Uint8Array, start: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[start + i]);
  return s;
}

function readHeader(bytes: Uint8Array, offset: number): { cards: string[]; dataOffset: number } {
  const cards: string[] = [];
  for (let i = 0; ; i++) {
    const start = offset + i * CARD_LEN;
    if (start + CARD_LEN > bytes.length) throw new FitsError('Truncated FITS header (file ends mid-header).');
    const card = ascii(bytes, start, CARD_LEN);
    cards.push(card);
    if (card.startsWith('END')) break;
    if (cards.length > 4000) throw new FitsError('FITS header is implausibly large — not a light-curve file?');
  }
  const dataOffset = offset + Math.ceil(cards.length / (FITS_BLOCK / CARD_LEN)) * FITS_BLOCK;
  return { cards, dataOffset };
}

/** Parse value cards (`KEYWORD = value / comment`) into a keyword map. */
function headerMap(cards: string[]): HeaderMap {
  const m: HeaderMap = new Map();
  for (const card of cards) {
    const key = card.slice(0, 8).trim();
    if (!key || key === 'COMMENT' || key === 'HISTORY' || key === 'END' || card[8] !== '=') continue;
    // Duplicated keywords (e.g. repeated CHECKSUM): first occurrence wins for
    // structural keys; table descriptors are unique per column anyway.
    if (m.has(key)) continue;
    const rest = card.slice(10);
    const trimmed = rest.trim();
    let value: HeaderValue;
    if (trimmed.startsWith("'")) {
      // Quoted string: runs to the closing quote, '' is an escaped quote.
      // (Comments after the closing quote are ignored.)
      let out = '';
      let i = rest.indexOf("'") + 1;
      while (i < rest.length) {
        if (rest[i] === "'") {
          if (rest[i + 1] === "'") {
            out += "'";
            i += 2;
          } else break;
        } else {
          out += rest[i];
          i++;
        }
      }
      value = out.trim();
    } else {
      const bare = rest.split('/')[0].trim();
      if (bare === 'T') value = true;
      else if (bare === 'F') value = false;
      else if (bare === '') value = '';
      else {
        const num = Number(bare);
        value = Number.isFinite(num) ? num : bare;
      }
    }
    m.set(key, value);
  }
  return m;
}

function toNum(v: HeaderValue | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function toStr(v: HeaderValue | undefined): string | null {
  return typeof v === 'string' ? v : null;
}

function padded(n: number): number {
  return Math.ceil(n / FITS_BLOCK) * FITS_BLOCK;
}

/** Byte length of an HDU's data segment (before 2880-byte padding). */
function hduDataBytes(head: HeaderMap): number {
  const xt = toStr(head.get('XTENSION'));
  if (xt === 'BINTABLE' || xt === 'TABLE' || xt === 'A3DTABLE') {
    const n1 = toNum(head.get('NAXIS1')) ?? 0;
    const n2 = toNum(head.get('NAXIS2')) ?? 0;
    const pcount = toNum(head.get('PCOUNT')) ?? 0;
    if (pcount > 0) throw new FitsError('Variable-length (heap) FITS tables are not supported.');
    return n1 * n2;
  }
  const naxis = toNum(head.get('NAXIS')) ?? 0;
  if (naxis === 0) return 0;
  const bitpix = toNum(head.get('BITPIX')) ?? 8;
  let n = Math.abs(bitpix) / 8;
  for (let i = 1; i <= naxis; i++) n *= toNum(head.get(`NAXIS${i}`)) ?? 0;
  return n;
}

interface ColumnLayout {
  code: string; // TFORM base code: D/E/J/...
  size: number; // bytes this column occupies in each row
}

/** Row stride for one TFORM descriptor (e.g. 'D', '1J', '16A'). */
function columnLayout(tform: string): ColumnLayout {
  const t = tform.trim().toUpperCase();
  const m = /^(\d*)([A-Z])/.exec(t);
  if (!m) throw new FitsError(`Unparseable TFORM descriptor '${tform}'.`);
  if (t.includes('(')) throw new FitsError(`Variable-length TFORM '${tform}' is not supported.`);
  const rep = m[1] ? parseInt(m[1], 10) : 1;
  const code = m[2];
  switch (code) {
    case 'L':
    case 'B':
    case 'A':
      return { code, size: rep };
    case 'I':
      return { code, size: rep * 2 };
    case 'J':
    case 'E':
      return { code, size: rep * 4 };
    case 'K':
    case 'D':
      return { code, size: rep * 8 };
    case 'C':
      return { code, size: rep * 8 }; // 2 × float32
    case 'M':
      return { code, size: rep * 16 }; // 2 × float64
    case 'X':
      return { code, size: Math.ceil(rep / 8) }; // bit array
    default:
      throw new FitsError(`Unsupported TFORM code '${code}' in '${tform}'.`);
  }
}

interface TableColumn {
  offset: number;
  code: string;
  tscal: number;
  tzero: number;
  tnull: number | null;
}

/** Read one scalar cell (big-endian), applying TSCAL/TZERO/TNULL. */
function readCell(view: DataView, at: number, col: TableColumn): number | null {
  let raw: number;
  switch (col.code) {
    case 'B':
      raw = view.getUint8(at);
      break;
    case 'L':
      raw = view.getUint8(at) === 84 ? 1 : 0; // 'T'
      break;
    case 'I':
      raw = view.getInt16(at);
      break;
    case 'J':
      raw = view.getInt32(at);
      break;
    case 'K':
      raw = Number(view.getBigInt64(at));
      break;
    case 'E':
      raw = view.getFloat32(at);
      break;
    case 'D':
      raw = view.getFloat64(at);
      break;
    default:
      return null;
  }
  if (col.tnull != null && raw === col.tnull) return null;
  return raw * col.tscal + col.tzero;
}

export interface QuarterLightCurve {
  time: number[]; // days, as stored (BKJD for Kepler)
  flux: number[]; // raw flux units (e-/s), NOT normalised — caller normalises
  fluxColumn: string; // which column the flux came from
  qualityColumn: string | null;
  qualityCutApplied: boolean;
  nRows: number; // raw table rows
  nKept: number; // rows surviving filtering
  nBad: number; // dropped: non-finite time/flux or non-positive flux
  nFlagged: number; // dropped by the quality cut
}

/**
 * Extract TIME + flux (+ quality) from one Kepler/TESS light-curve FITS file.
 * Rows with NaN/blank time or flux are always dropped; rows with non-zero
 * quality flags are dropped only when that still keeps a healthy majority
 * (some files flag most cadences with harmless warnings).
 */
export function extractQuarterLightCurve(buffer: ArrayBuffer): QuarterLightCurve {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < FITS_BLOCK || ascii(bytes, 0, 6) !== 'SIMPLE') {
    throw new FitsError('Not a FITS file (missing SIMPLE header). The download may be an HTML error page — is the /api/mast proxy reaching MAST?');
  }
  let offset = 0;
  for (let hdu = 0; hdu < 12; hdu++) {
    const { cards, dataOffset } = readHeader(bytes, offset);
    const head = headerMap(cards);
    if (toStr(head.get('XTENSION')) === 'BINTABLE') {
      const ext = (toStr(head.get('EXTNAME')) ?? '').toUpperCase();
      if (ext === 'LIGHTCURVE' || hdu === 1) return readLightCurveTable(bytes, dataOffset, head);
    }
    offset = dataOffset + padded(hduDataBytes(head));
    if (offset >= bytes.length) break;
  }
  throw new FitsError('No LIGHTCURVE binary table found in this FITS file.');
}

function readLightCurveTable(bytes: Uint8Array, dataOffset: number, head: HeaderMap): QuarterLightCurve {
  const nFields = toNum(head.get('TFIELDS')) ?? 0;
  const nRows = toNum(head.get('NAXIS2')) ?? 0;
  const rowLen = toNum(head.get('NAXIS1')) ?? 0;
  if (nFields < 1 || nRows < 1 || rowLen < 1) throw new FitsError('Light-curve table is empty.');
  if (dataOffset + rowLen * nRows > bytes.length) {
    throw new FitsError('Truncated download: the table runs past the end of the file. Try again — the connection may have been cut.');
  }

  const names: string[] = [];
  const cols: TableColumn[] = [];
  let off = 0;
  for (let i = 1; i <= nFields; i++) {
    const name = (toStr(head.get(`TTYPE${i}`)) ?? '').trim().toUpperCase();
    const form = (toStr(head.get(`TFORM${i}`)) ?? '').trim();
    if (!form) throw new FitsError(`Column ${i} is missing its TFORM descriptor.`);
    const { code, size } = columnLayout(form);
    names.push(name);
    cols.push({
      offset: off,
      code,
      tscal: toNum(head.get(`TSCAL${i}`)) ?? 1,
      tzero: toNum(head.get(`TZERO${i}`)) ?? 0,
      tnull: toNum(head.get(`TNULL${i}`)),
    });
    off += size;
  }

  const byName = (n: string) => names.indexOf(n);
  let timeIdx = byName('TIME');
  let fluxIdx = byName('PDCSAP_FLUX');
  let fluxColumn = 'PDCSAP_FLUX';
  if (fluxIdx < 0) {
    fluxIdx = byName('SAP_FLUX');
    fluxColumn = 'SAP_FLUX';
  }
  let qualIdx = byName('SAP_QUALITY');
  if (qualIdx < 0) qualIdx = byName('QUALITY');
  // Canonical Kepler fallback (Archive Manual fixed layout) when TTYPEn names
  // are missing: TIME is column 1, PDCSAP_FLUX column 6, SAP_QUALITY column 10.
  if (timeIdx < 0 && names.length >= 1) timeIdx = 0;
  if (fluxIdx < 0 && names.length >= 6) {
    fluxIdx = 5;
    fluxColumn = 'PDCSAP_FLUX (column 6)';
  }
  if (fluxIdx < 0 && names.length >= 4) {
    fluxIdx = 3;
    fluxColumn = 'SAP_FLUX (column 4)';
  }
  if (timeIdx < 0 || fluxIdx < 0) throw new FitsError('Table has no TIME / flux columns.');
  const qualityColumn = qualIdx >= 0 ? names[qualIdx] || `column ${qualIdx + 1}` : null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const time: number[] = [];
  const flux: number[] = [];
  const qual: number[] = [];
  let nBad = 0;
  for (let r = 0; r < nRows; r++) {
    const base = dataOffset + r * rowLen;
    const t = readCell(view, base + cols[timeIdx].offset, cols[timeIdx]);
    const f = readCell(view, base + cols[fluxIdx].offset, cols[fluxIdx]);
    if (t == null || f == null || !Number.isFinite(t) || !Number.isFinite(f) || f <= 0) {
      nBad++;
      continue;
    }
    time.push(t);
    flux.push(f);
    qual.push(qualIdx >= 0 ? (readCell(view, base + cols[qualIdx].offset, cols[qualIdx]) ?? -1) : 0);
  }

  // Strict quality cut (keep only flag-free cadences) when it keeps a healthy
  // majority; otherwise keep everything finite — the flags are warnings, and
  // the pipeline's own detrend + sigma-clip handles the odd bad cadence.
  let qualityCutApplied = false;
  let nFlagged = 0;
  let keptTime = time;
  let keptFlux = flux;
  if (qualIdx >= 0 && qual.length > 0) {
    const qTime: number[] = [];
    const qFlux: number[] = [];
    for (let i = 0; i < qual.length; i++) {
      if (qual[i] === 0) {
        qTime.push(time[i]);
        qFlux.push(flux[i]);
      }
    }
    if (qTime.length >= 200 && qTime.length >= qual.length * 0.5) {
      qualityCutApplied = true;
      nFlagged = qual.length - qTime.length;
      keptTime = qTime;
      keptFlux = qFlux;
    }
  }

  return { time: keptTime, flux: keptFlux, fluxColumn, qualityColumn, qualityCutApplied, nRows, nKept: keptTime.length, nBad, nFlagged };
}
