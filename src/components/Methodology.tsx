import { useState } from 'react';

const steps = [
  { n: '01', title: 'Normalise & detrend', math: 'Running-median filter (1-day window)', desc: 'Divide flux by its median, then by a sliding median to remove starspot modulation and instrumental drift. Transits (hours) survive; slow trends (days) are flattened.' },
  { n: '02', title: 'Box Least Squares search', math: 'Kovács, Zucker & Mazeh (2002)', desc: 'For thousands of trial periods, fold the data and slide a box of each trial duration across the phase. Power ∝ depth² · n_in · n_out / N. The peak gives period, epoch and duration — no training required.' },
  { n: '03', title: 'Trapezoid fit', math: 'Grid least-squares on binned phase curve', desc: 'Fit depth, total duration and ingress fraction. Ingress fraction discriminates U-shaped planetary transits from V-shaped grazing stellar eclipses.' },
  { n: '04', title: 'Vetting statistics', math: 'SNR, odd/even Δ, secondary eclipse, duration ratio', desc: 'These are the same diagnostic tests NASA’s Kepler Robovetter applies: is the signal significant, are alternating transits equal, is there a dip at phase 0.5, does the implied radius stay planetary, is the duration consistent with the stellar density?' },
  { n: '05', title: 'Logistic disposition', math: 'σ(Σ wᵢ · testᵢ)', desc: 'Each test adds a signed weight; a sigmoid converts the sum to P(planet). The weights here are hand-set from physics — swapping them for coefficients learned on the Kepler DR25 catalogue turns this into a trained model with zero architectural change.' },
];

export default function Methodology() {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Under the hood</div>
          <h3 className="text-lg font-semibold text-white">How the classifier works — do we need a trained AI model?</h3>
        </div>
        <span className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="mt-5 space-y-6 fade-up">
          <div className="grid gap-3 md:grid-cols-5">
            {steps.map((s) => (
              <div key={s.n} className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="font-mono text-[10px] text-nebula">{s.n}</div>
                <div className="mt-1 text-sm font-semibold text-white">{s.title}</div>
                <div className="mt-0.5 font-mono text-[10px] text-aurora">{s.math}</div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-aurora/25 bg-aurora/5 p-4">
              <div className="text-sm font-semibold text-aurora">Pure mathematics (what runs here)</div>
              <ul className="mt-2 space-y-1.5 text-[12px] text-slate-300">
                <li>• BLS / TLS periodograms find the signal analytically.</li>
                <li>• Physics gives the discriminants: Kepler’s third law, stellar density → duration, depth → radius.</li>
                <li>• Threshold-based vetting is exactly what produced the Kepler DR25 catalogue (Robovetter).</li>
                <li>• Transparent, explainable, works on a single light curve with no training set.</li>
                <li>• Weakness: hand-tuned thresholds; no learned handling of exotic systematics.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-nebula/30 bg-nebula/5 p-4">
              <div className="text-sm font-semibold text-violet-300">Classical ML on extracted features</div>
              <ul className="mt-2 space-y-1.5 text-[12px] text-slate-300">
                <li>• Take the metrics computed above (SNR, depth, duration, odd/even, secondary…) as a feature vector.</li>
                <li>• Train a random forest / gradient boosting / logistic regression on the labelled KOI table (~8,000 dispositioned objects, freely available at the NASA Exoplanet Archive).</li>
                <li>• This is the “Autovetter” approach (McCauliff et al. 2015); ~95% accuracy.</li>
                <li>• Cheap to train (seconds), can run in-browser via ONNX / TF.js.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-plasma/30 bg-plasma/5 p-4">
              <div className="text-sm font-semibold text-plasma">Deep learning on the raw light curve</div>
              <ul className="mt-2 space-y-1.5 text-[12px] text-slate-300">
                <li>• 1-D CNN on the phase-folded “global” + “local” views (AstroNet, Shallue & Vanderburg 2018) — discovered Kepler-90 i.</li>
                <li>• Needs ~15k labelled folded curves plus augmentation; best at odd systematics and shallow signals.</li>
                <li>• Still requires BLS first to find the period — DL replaces only the vetting stage.</li>
                <li>• Less interpretable; overkill for a few objects, excellent for a survey.</li>
              </ul>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-400">
            <span className="text-white">Bottom line:</span> you do <em>not</em> need a neural network to classify transit signals. Period detection is always done mathematically (BLS), and the vetting can be done with physically motivated tests as in this app. A trained model becomes worthwhile when you want to process thousands of targets with maximum completeness — and the natural upgrade path is to feed the feature vector computed here into a classifier trained on the Kepler DR25 KOI catalogue.
          </p>
        </div>
      )}
    </div>
  );
}
