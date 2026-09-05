import { analyze } from './analysis';
import type { LightCurve, StellarParams } from './lightcurve';

self.onmessage = (e: MessageEvent<{ lc: LightCurve; stellar: StellarParams; id: number }>) => {
  const { lc, stellar, id } = e.data;
  try {
    const result = analyze(lc, stellar);
    (self as unknown as Worker).postMessage({ id, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
