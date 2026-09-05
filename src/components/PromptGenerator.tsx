import { useMemo, useState } from 'react';
import { AnalysisResult } from '../lib/analysis';
import { buildImagePrompt, buildNegativePrompt, PromptOptions, PromptStyle, PromptView, STYLE_LABELS, VIEW_LABELS } from '../lib/prompt';

export default function PromptGenerator({ result }: { result: AnalysisResult }) {
  const [opts, setOpts] = useState<PromptOptions>({ style: 'nasa', view: 'orbit', includeStar: true, includeMoons: false, aspect: '16:9' });
  const [copied, setCopied] = useState<'prompt' | 'neg' | null>(null);
  const prompt = useMemo(() => buildImagePrompt(result.planet, result.stellar, opts, result.lc.name), [result, opts]);
  const negative = buildNegativePrompt();
  const isStar = result.classification.verdict === 'FALSE POSITIVE' && result.planet.radiusEarth > 15;

  const copy = async (text: string, which: 'prompt' | 'neg') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="glass fade-up p-5" style={{ animationDelay: '0.2s' }}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Visualise the world</div>
          <h3 className="text-lg font-semibold text-white">Image-generation prompt</h3>
          <p className="max-w-xl text-xs text-slate-400">Built from the physical parameters measured in the light curve — radius, equilibrium temperature, orbital distance and host-star spectral type. Paste into Midjourney, DALL·E, Stable Diffusion or Imagen.</p>
        </div>
        {isStar && <span className="rounded-full border border-plasma/40 bg-plasma/10 px-3 py-1 text-xs text-plasma">Heads-up: this signal is a stellar companion — prompt describes what a planet of this depth would look like.</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-400">Art style</label>
            <div className="grid grid-cols-1 gap-1.5">
              {(Object.keys(STYLE_LABELS) as PromptStyle[]).map((s) => (
                <button key={s} onClick={() => setOpts({ ...opts, style: s })} className={`rounded-lg border px-3 py-1.5 text-left text-xs transition ${opts.style === s ? 'border-nebula bg-nebula/25 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/25'}`}>
                  {STYLE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-400">Viewpoint</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(VIEW_LABELS) as PromptView[]).map((v) => (
                <button key={v} onClick={() => setOpts({ ...opts, view: v })} className={`rounded-lg border px-3 py-1.5 text-xs transition ${opts.view === v ? 'border-aurora bg-aurora/20 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/25'}`}>
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-[#6d5dfc]" checked={opts.includeStar} onChange={(e) => setOpts({ ...opts, includeStar: e.target.checked })} /> Host star</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-[#6d5dfc]" checked={opts.includeMoons} onChange={(e) => setOpts({ ...opts, includeMoons: e.target.checked })} /> Moons</label>
            <select value={opts.aspect} onChange={(e) => setOpts({ ...opts, aspect: e.target.value as PromptOptions['aspect'] })} className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white">
              {['16:9', '1:1', '9:16', '21:9'].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div className="relative rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Prompt</span>
              <button onClick={() => copy(prompt, 'prompt')} className="rounded-md bg-nebula/80 px-3 py-1 text-xs font-medium text-white transition hover:bg-nebula">
                {copied === 'prompt' ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <p className="font-mono text-[12.5px] leading-relaxed text-slate-200">{prompt}</p>
          </div>
          <div className="relative rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Negative prompt</span>
              <button onClick={() => copy(negative, 'neg')} className="rounded-md border border-white/15 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10">
                {copied === 'neg' ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <p className="font-mono text-[12px] leading-relaxed text-slate-400">{negative}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
