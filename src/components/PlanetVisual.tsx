import { PlanetProperties } from '../lib/analysis';
import { StellarParams } from '../lib/lightcurve';

function starColor(teff: number) {
  if (teff >= 7500) return { core: '#dfe9ff', glow: 'rgba(160,190,255,0.6)' };
  if (teff >= 6000) return { core: '#fff6df', glow: 'rgba(255,240,200,0.55)' };
  if (teff >= 5200) return { core: '#ffe9a8', glow: 'rgba(255,215,130,0.55)' };
  if (teff >= 3700) return { core: '#ffb86b', glow: 'rgba(255,160,80,0.55)' };
  return { core: '#ff7a5a', glow: 'rgba(255,90,60,0.55)' };
}

function planetPalette(p: PlanetProperties): { base: string; bands: string; glow: string; kind: 'gas' | 'ice' | 'rock' | 'lava' | 'ocean' | 'frozen' } {
  const T = p.equilibriumTempK;
  const R = p.radiusEarth;
  if (R > 6) {
    if (T > 1500) return { kind: 'gas', base: '#3a1a1a', bands: 'linear-gradient(180deg,#5a1d10 0%,#c8451c 18%,#3b1410 30%,#e0703a 42%,#2a0d0a 55%,#b34a24 70%,#4a1b12 85%,#7a2d18 100%)', glow: 'rgba(255,110,60,0.55)' };
    if (T > 1000) return { kind: 'gas', base: '#8a5a2b', bands: 'linear-gradient(180deg,#d8b482 0%,#8f5a2e 14%,#e4c89a 26%,#a4632f 38%,#f0dcb4 50%,#7d4a25 62%,#d1a56c 76%,#94602f 88%,#c99b64 100%)', glow: 'rgba(255,190,120,0.4)' };
    if (T > 500) return { kind: 'gas', base: '#c9b07a', bands: 'linear-gradient(180deg,#f2e6c4 0%,#c9a866 15%,#f6ecd0 30%,#b6934f 45%,#efe0b8 58%,#c4a25e 72%,#f4e8c8 86%,#a98844 100%)', glow: 'rgba(240,220,160,0.35)' };
    return { kind: 'gas', base: '#7f8ea3', bands: 'linear-gradient(180deg,#d7dee8 0%,#8394ad 16%,#e3e8ef 30%,#6f819c 44%,#cfd7e2 58%,#8393a8 72%,#e1e6ed 86%,#75869f 100%)', glow: 'rgba(180,200,230,0.35)' };
  }
  if (R > 3.5) {
    if (T > 800) return { kind: 'ice', base: '#5b5f9e', bands: 'linear-gradient(180deg,#6d6bb6 0%,#4a4a8c 30%,#8b7cc9 50%,#3f3f7a 70%,#7670b8 100%)', glow: 'rgba(150,140,230,0.45)' };
    return { kind: 'ice', base: '#3d7fd6', bands: 'linear-gradient(180deg,#5b9ae6 0%,#2f6fc4 25%,#78b3f0 45%,#2a63b5 65%,#5f9ce4 100%)', glow: 'rgba(90,160,255,0.45)' };
  }
  if (R > 1.75) {
    if (T > 700) return { kind: 'ice', base: '#d9c7a8', bands: 'linear-gradient(180deg,#f0e2c8 0%,#d6bc95 30%,#f5ead4 55%,#cbb08a 80%,#efe0c4 100%)', glow: 'rgba(240,220,180,0.4)' };
    return { kind: 'ice', base: '#4fa39a', bands: 'linear-gradient(180deg,#7cc8bf 0%,#3f8f87 30%,#93d6cd 55%,#377f78 80%,#6fbfb5 100%)', glow: 'rgba(100,200,190,0.4)' };
  }
  if (T > 1200) return { kind: 'lava', base: '#2b1410', bands: 'radial-gradient(circle at 35% 40%, #ffd166 0%, #ff7b2e 18%, #b62b0e 38%, #3a1108 62%, #120504 100%)', glow: 'rgba(255,120,40,0.65)' };
  if (T > 400) return { kind: 'rock', base: '#8d6b4b', bands: 'radial-gradient(circle at 40% 35%, #c9a67c 0%, #9a7451 30%, #6b4d33 60%, #3a2919 100%)', glow: 'rgba(200,160,110,0.3)' };
  if (T > 200) return { kind: 'ocean', base: '#1f5fa8', bands: 'radial-gradient(circle at 30% 30%, #7fc1ff 0%, #2b73c9 25%, #1f5aa5 50%, #163f7a 80%, #0b2246 100%)', glow: 'rgba(110,180,255,0.5)' };
  return { kind: 'frozen', base: '#cfe3f2', bands: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #dcebf7 30%, #a9c6dd 60%, #6f8ea8 100%)', glow: 'rgba(200,225,255,0.5)' };
}

export default function PlanetVisual({ planet, stellar, verdict }: { planet: PlanetProperties; stellar: StellarParams; verdict: 'PLANET' | 'FALSE POSITIVE' | 'CANDIDATE' }) {
  const pal = planetPalette(planet);
  const sc = starColor(stellar.teff);
  const isStar = verdict === 'FALSE POSITIVE' && planet.radiusEarth > 15;
  const size = Math.min(150, Math.max(58, 58 + Math.log10(Math.max(planet.radiusEarth, 0.5)) * 60));

  return (
    <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#05071a] to-[#02030a]">
      {/* star */}
      <div className="absolute -left-24 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${sc.core} 0%, ${sc.core} 38%, ${sc.glow} 52%, transparent 70%)`, filter: 'blur(2px)' }} />
      <div className="absolute -left-24 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full opacity-60" style={{ background: `radial-gradient(circle, transparent 40%, ${sc.glow} 46%, transparent 75%)`, animation: 'pulse-ring 4s ease-out infinite' }} />

      {/* orbit line */}
      <div className="absolute left-[-160px] top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full border border-dashed border-white/10" />

      {/* planet or companion star */}
      <div className="absolute left-[58%] top-1/2 -translate-x-1/2 -translate-y-1/2">
        {isStar ? (
          <div className="relative">
            <div className="h-28 w-28 rounded-full" style={{ background: 'radial-gradient(circle at 40% 40%, #ffd7a0 0%, #ff9b4a 45%, rgba(255,120,60,0.4) 70%, transparent 100%)', filter: 'blur(1px)' }} />
            <div className="pulse-ring absolute inset-0 rounded-full border border-orange-300/40" />
          </div>
        ) : (
          <div className="relative" style={{ width: size, height: size }}>
            <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 ${size / 2}px ${pal.glow}` }} />
            <div
              className={`absolute inset-0 overflow-hidden rounded-full ${pal.kind === 'gas' || pal.kind === 'ice' ? 'planet-surface' : ''}`}
              style={{ background: pal.bands, backgroundSize: pal.kind === 'gas' || pal.kind === 'ice' ? '200% 100%' : '100% 100%' }}
            />
            {(pal.kind === 'ocean' || pal.kind === 'ice') && (
              <div className="absolute inset-0 rounded-full opacity-70" style={{ background: 'radial-gradient(ellipse 30% 12% at 30% 40%, rgba(255,255,255,0.8), transparent 70%), radial-gradient(ellipse 40% 10% at 60% 65%, rgba(255,255,255,0.7), transparent 70%)' }} />
            )}
            {/* terminator shading: lit from the left where the star is */}
            <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, transparent 35%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.9) 100%)' }} />
            <div className="absolute inset-0 rounded-full" style={{ boxShadow: `inset -${size / 8}px 0 ${size / 4}px rgba(0,0,0,0.6), inset ${size / 20}px 0 ${size / 8}px rgba(255,255,255,0.15)` }} />
            {pal.kind === 'gas' && planet.equilibriumTempK < 600 && (
              <div className="absolute left-1/2 top-1/2 h-[30%] w-[170%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[3px] border-white/20" style={{ transform: 'translate(-50%,-50%) rotateX(72deg) rotate(-12deg)' }} />
            )}
          </div>
        )}
      </div>

      {/* Earth for scale */}
      {!isStar && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg bg-black/40 px-2 py-1 text-[10px] text-slate-300 backdrop-blur">
          <span className="inline-block rounded-full" style={{ width: Math.max(4, size / Math.max(planet.radiusEarth, 0.3)) > 40 ? 40 : Math.max(4, size / Math.max(planet.radiusEarth, 0.3)), height: Math.max(4, size / Math.max(planet.radiusEarth, 0.3)) > 40 ? 40 : Math.max(4, size / Math.max(planet.radiusEarth, 0.3)), background: 'radial-gradient(circle at 35% 35%, #9fd0ff, #1e5fb0 60%, #0b2a55)' }} />
          Earth to scale
        </div>
      )}
      <div className="absolute left-3 top-3 rounded-lg bg-black/40 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-300 backdrop-blur">
        {isStar ? 'Stellar companion' : planet.planetClass}
      </div>
    </div>
  );
}
