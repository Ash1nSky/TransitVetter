import { PlanetProperties } from './analysis';
import { StellarParams } from './lightcurve';

export type PromptStyle = 'photoreal' | 'nasa' | 'retro' | 'painterly' | 'cinematic';
export type PromptView = 'orbit' | 'surface' | 'transit' | 'system';

export interface PromptOptions {
  style: PromptStyle;
  view: PromptView;
  includeStar: boolean;
  includeMoons: boolean;
  aspect: '16:9' | '1:1' | '9:16' | '21:9';
}

export const STYLE_LABELS: Record<PromptStyle, string> = {
  photoreal: 'Photorealistic render',
  nasa: 'NASA / JPL illustration',
  retro: 'Retro travel poster',
  painterly: 'Painterly concept art',
  cinematic: 'Cinematic film still',
};

export const VIEW_LABELS: Record<PromptView, string> = {
  orbit: 'From orbit',
  surface: 'From the surface',
  transit: 'Transit silhouette',
  system: 'Whole system',
};

function starLook(stellar: StellarParams) {
  const t = stellar.teff;
  if (t >= 7500) return { color: 'brilliant blue-white', light: 'harsh, cold white light with sharp shadows' };
  if (t >= 6000) return { color: 'pale yellow-white', light: 'bright, slightly cool white sunlight' };
  if (t >= 5200) return { color: 'warm yellow, Sun-like', light: 'warm golden sunlight' };
  if (t >= 3700) return { color: 'deep orange', light: 'amber, low-contrast orange light' };
  return { color: 'dim ruby-red', light: 'moody crimson light with deep long shadows' };
}

function planetLook(p: PlanetProperties) {
  const T = p.equilibriumTempK;
  const R = p.radiusEarth;
  const parts: string[] = [];
  const atmos: string[] = [];
  if (R > 6) {
    // gas giant
    if (T > 1500) {
      parts.push('an ultra-hot gas giant with a glowing, partially molten dayside, iron and silicate vapour clouds, tidally locked');
      atmos.push('dark sodium-stained bands, faint reddish thermal glow on the night side, wind-streaked cloud tops racing at supersonic speed');
    } else if (T > 1000) {
      parts.push('a hot Jupiter with swirling banded clouds in ochre, cream and rust tones');
      atmos.push('turbulent equatorial jet streams, oval storm vortices, hazy limb glowing at the terminator');
    } else if (T > 500) {
      parts.push('a warm gas giant with pastel cloud bands of sulfur yellow and white ammonia');
      atmos.push('layered cloud decks, thin faint ring system catching the light');
    } else {
      parts.push('a cold Jovian giant with muted blue-grey and cream ammonia bands');
      atmos.push('a delicate icy ring system, high-altitude haze, polar auroras');
    }
  } else if (R > 3.5) {
    if (T > 800) {
      parts.push('a hot Neptune with a hazy, slate-blue and violet atmosphere being stripped by stellar wind');
      atmos.push('a faint comet-like tail of escaping hydrogen, photochemical haze layers');
    } else {
      parts.push('an azure ice giant, deep methane-blue with faint wispy white cirrus');
      atmos.push('subtle dark spots, a thin narrow ring, smooth limb darkening');
    }
  } else if (R > 1.75) {
    if (T > 700) {
      parts.push('a steamy sub-Neptune wrapped in thick pale cream and peach cloud layers');
      atmos.push('featureless deep atmosphere, bright reflective haze, soft glowing limb');
    } else {
      parts.push('a temperate mini-Neptune with a deep hydrogen envelope in teal and white tones');
      atmos.push('possible water-cloud layers, a hazy layered horizon');
    }
  } else if (R > 1.25) {
    if (T > 1200) {
      parts.push('a scorched lava super-Earth, its dayside a glowing sea of molten rock with dark cooling crust rafts');
      atmos.push('thin vaporised-rock atmosphere, incandescent orange lava rivers, obsidian plains');
    } else if (T > 400) {
      parts.push('a hot, dry super-Earth with cracked basalt plains, volcanic peaks and a thick CO₂ atmosphere');
      atmos.push('yellowish sulfuric haze, dust storms, weak orange glow at the terminator');
    } else if (T > 200) {
      parts.push('a temperate super-Earth with deep oceans, scattered rocky continents and swirling water clouds');
      atmos.push('vivid blue seas, white cloud bands, green-brown coastlines, polar ice caps');
    } else {
      parts.push('a frozen super-Earth encased in nitrogen ice and cracked glaciers');
      atmos.push('pale blue-white surface, deep frost fractures, thin misty atmosphere');
    }
  } else {
    if (T > 1200) {
      parts.push('a small molten lava world, tidally locked, one hemisphere an ocean of glowing magma');
      atmos.push('incandescent yellow-orange dayside, black glassy night side, no clouds');
    } else if (T > 400) {
      parts.push('a barren rocky planet resembling a hot Mercury, heavily cratered, airless');
      atmos.push('sharp-edged craters, grey-brown regolith, no atmospheric glow');
    } else if (T > 200) {
      parts.push('an Earth-sized world with shallow seas, continents and a breathable-looking atmosphere');
      atmos.push('blue oceans, wispy white clouds, subtle green landmasses, a thin glowing blue atmospheric limb');
    } else {
      parts.push('a small icy world, glacier-covered with a thin tenuous atmosphere');
      atmos.push('white and pale-blue ice sheets, faint frost haze, dark rocky outcrops');
    }
  }
  return { body: parts.join(' '), atmos: atmos.join(', ') };
}

function styleSuffix(style: PromptStyle) {
  switch (style) {
    case 'photoreal':
      return 'ultra-detailed photorealistic 3D render, physically based lighting, 8k, sharp focus, subtle film grain, no text';
    case 'nasa':
      return "in the style of NASA/JPL exoplanet artist's concept illustrations, clean digital painting, scientifically plausible, soft lens flare, no text";
    case 'retro':
      return 'vintage 1960s space-age travel poster, flat screen-print colours, bold geometric shapes, paper texture, muted palette, stylised';
    case 'painterly':
      return 'painterly sci-fi concept art, visible brushstrokes, dramatic atmosphere, in the spirit of Chesley Bonestell, rich colour, no text';
    case 'cinematic':
      return 'cinematic anamorphic film still, volumetric light, shallow depth of field, IMAX quality, epic scale, colour graded, no text';
  }
}

export function buildImagePrompt(p: PlanetProperties, stellar: StellarParams, opts: PromptOptions, targetName: string): string {
  const star = starLook(stellar);
  const look = planetLook(p);
  const distanceWord = p.semiMajorAxisAU < 0.05 ? 'orbiting terrifyingly close to its star, which fills a huge part of the sky' : p.semiMajorAxisAU < 0.3 ? 'orbiting close to its star, which appears large and intense' : p.semiMajorAxisAU < 1.5 ? 'orbiting at a comfortable distance from its star' : 'orbiting far from its distant, small-looking star';
  const hz = p.habitableZone === 'habitable zone' ? 'located in the habitable zone' : p.habitableZone === 'too hot' ? 'far inside the habitable zone' : p.habitableZone === 'too cold' ? 'well beyond the habitable zone' : `near the ${p.habitableZone} of the habitable zone`;

  let scene = '';
  switch (opts.view) {
    case 'orbit':
      scene = `Wide establishing shot from high orbit of ${look.body}. Atmospheric details: ${look.atmos}. The planet is ${distanceWord}, ${hz}.`;
      break;
    case 'surface':
      scene = `Ground-level landscape view standing on the surface of ${look.body}. Foreground terrain in sharp detail, ${look.atmos}. The host star, a ${star.color} star, hangs in the sky casting ${star.light}. The planet is ${hz}.`;
      break;
    case 'transit':
      scene = `Dramatic view of ${look.body} silhouetted as a dark disc crossing the blazing face of its ${star.color} host star during transit, a thin glowing ring of atmosphere refracting starlight around the planet's limb. Seen from deep space, star fills most of the frame.`;
      break;
    case 'system':
      scene = `Scientifically inspired diagram-like vista of the whole planetary system: a ${star.color} ${p.starClass} at centre, with ${look.body} shown on its orbit ${p.semiMajorAxisAU.toFixed(3)} AU away (${p.periodDays.toFixed(2)}-day orbit), faint orbital paths, and a scale comparison with Earth.`;
      break;
  }
  const starClause = opts.includeStar && opts.view !== 'transit' && opts.view !== 'surface' ? ` Its ${star.color} ${p.starClass} glows in the background, bathing the scene in ${star.light}.` : '';
  const moons = opts.includeMoons && p.radiusEarth > 3 ? ' One or two small cratered moons drift in the foreground.' : opts.includeMoons ? ' A single small moon is visible nearby.' : '';
  const facts = `Physical parameters from Kepler transit data: radius ${p.radiusEarth.toFixed(2)} Earth radii, equilibrium temperature ~${Math.round(p.equilibriumTempK)} K, ${p.planetClass.toLowerCase()}, receives ${p.insolationEarth.toFixed(1)}× Earth's starlight.`;
  return `${targetName}: ${scene}${starClause}${moons} ${facts} Deep black space backdrop with dense Milky Way starfield. ${styleSuffix(opts.style)}. --ar ${opts.aspect}`;
}

export function buildNegativePrompt(): string {
  return 'text, watermark, logo, caption, blurry, low resolution, cartoon, distorted sphere, extra planets, lens dirt, oversaturated, human figures';
}
