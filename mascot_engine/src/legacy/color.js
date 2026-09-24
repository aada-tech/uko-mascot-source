// Theme & contrast math (OKLab/OKLCH, WCAG ratios).
  const THEME_DEFAULTS={"bodyStrokeColor":"#0B0B0B","detailColor":"#0B0B0B","headFillColor":"#FFFFFF","handFillColor":"#FFFFFF","footFillColor":"#FFFFFF","hairColor":"#0B0B0B","accessoryColor":"#0B0B0B","artifactNeutralColor":"#0B0B0B","accentColor":"#0B0B0B","loadingColor":"#0B0B0B","successColor":"#0B0B0B","errorColor":"#0B0B0B","sleepColor":"#0B0B0B"};
const THEME_PRESET_SEEDS={"original":{"label":"Original","brand":"#0B0B0B"},"ocean":{"label":"Ocean","brand":"#0284C7"},"mint":{"label":"Mint","brand":"#059669"},"sunset":{"label":"Sunset","brand":"#EA580C"},"lavender":{"label":"Lavender","brand":"#7C3AED"},"graphite":{"label":"Graphite","brand":"#475569"}};
const SEMANTIC_SEEDS={success:'#16A34A',error:'#DC2626',sleep:'#2563EB'};
const ARTIFACT_KEYS=["artifactNeutralColor", "accentColor", "loadingColor", "successColor", "errorColor", "sleepColor"];
const HAIR_DEFAULT_SEED='#0B0B0B';
let themeMode='light', currentPreset='original', artifactMode='auto', hairMode='auto', contrastMode='direct';
let hairSeed=HAIR_DEFAULT_SEED, hairCustomColor=HAIR_DEFAULT_SEED;
const systemDark=window.matchMedia('(prefers-color-scheme: dark)');

function validHex(v){return /^#[0-9A-Fa-f]{6}$/.test(v)}
function clamp01(v){return Math.max(0,Math.min(1,v))}
function clampN(v,a,b){return Math.max(a,Math.min(b,v))}

function hexToRgb(hex){
  const n=parseInt(hex.slice(1),16);
  return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
}
function rgbToHex(rgb){
  return '#'+rgb.map(v=>Math.round(clamp01(v)*255).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function s2l(c){return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)}
function l2s(c){return c<=.0031308?12.92*c:1.055*Math.pow(Math.max(0,c),1/2.4)-.055}

function hexToOklab(hex){
  let [r,g,b]=hexToRgb(hex).map(s2l);
  const l=0.4122214708*r+0.5363325363*g+0.0514459929*b;
  const m=0.2119034982*r+0.6806995451*g+0.1073969566*b;
  const s=0.0883024619*r+0.2817188376*g+0.6299787005*b;
  const l_=Math.cbrt(l),m_=Math.cbrt(m),s_=Math.cbrt(s);
  return [
    0.2104542553*l_+0.793617785*m_-0.0040720468*s_,
    1.9779984951*l_-2.428592205*m_+0.4505937099*s_,
    0.0259040371*l_+0.7827717662*m_-0.808675766*s_
  ];
}
function oklabToHex(L,a,b){
  const l_=L+0.3963377774*a+0.2158037573*b;
  const m_=L-0.1055613458*a-0.0638541728*b;
  const s_=L-0.0894841775*a-1.291485548*b;
  const l=l_*l_*l_,m=m_*m_*m_,s=s_*s_*s_;
  const r= 4.0767416621*l-3.3077115913*m+0.2309699292*s;
  const g=-1.2684380046*l+2.6097574011*m-0.3413193965*s;
  const bb=-0.0041960863*l-0.7034186147*m+1.707614701*s;
  return rgbToHex([l2s(r),l2s(g),l2s(bb)]);
}
function hexToOklch(hex){
  const [L,a,b]=hexToOklab(hex),C=Math.hypot(a,b);
  let h=Math.atan2(b,a)*180/Math.PI;if(h<0)h+=360;
  return [L,C,h];
}
function oklchToHex(L,C,h){
  const rad=h*Math.PI/180;
  return oklabToHex(clamp01(L),Math.cos(rad)*C,Math.sin(rad)*C);
}
function relLum(hex){
  const [r,g,b]=hexToRgb(hex).map(s2l);
  return .2126*r+.7152*g+.0722*b;
}
function contrast(a,b){
  const x=relLum(a),y=relLum(b),hi=Math.max(x,y),lo=Math.min(x,y);
  return (hi+.05)/(lo+.05);
}
function ensureContrast(hex,bg,target,prefer='auto'){
  if(contrast(hex,bg)>=target)return hex.toUpperCase();
  let [L,C,h]=hexToOklch(hex);
  let dir;
  if(prefer==='lighter')dir=1;
  else if(prefer==='darker')dir=-1;
  else dir=relLum(bg)>.35?-1:1;
  for(let i=0;i<45;i++){
    L=clampN(L+dir*.018,.06,.97);
    const candidate=oklchToHex(L,C,h);
    if(contrast(candidate,bg)>=target)return candidate;
  }
  return dir<0?'#111827':'#F8FAFC';
}
function toneFromSeed(seed,L,cScale=.7,cMin=.035,cMax=.12){
  const [,C,h]=hexToOklch(seed);
  const chroma=C<.018?0:clampN(Math.max(C*cScale,cMin),0,cMax);
  return oklchToHex(L,chroma,h);
}

/*
 Hair crosses two surfaces: the head fill and the host background.
 It therefore gets its own semantic color instead of inheriting
 face details or body stroke blindly.
*/
function adaptiveHairColor(seed,bg,headFill,mode){
  if(mode==='light'&&seed.toUpperCase()==='#0B0B0B')return '#0B0B0B';
  if(mode==='dark'&&seed.toUpperCase()==='#0B0B0B')return '#E2E8F0';

  const cBg = contrast(seed, bg);
  const cHead = contrast(seed, headFill);
  if(cBg >= 3.0 && cHead >= 3.0){
    return seed.toUpperCase();
  }

  const [,baseC,h]=hexToOklch(seed);
  const C=baseC<.018?0:clampN(baseC*.55,.02,.09);
  const desired=mode==='dark'?.56:.20;

  let best=null;
  let bestPass=null;

  for(let i=6;i<=94;i++){
    const L=i/100;
    const candidate=oklchToHex(L,C,h);
    const cb=contrast(candidate,bg);
    const ch=contrast(candidate,headFill);
    const minC=Math.min(cb,ch);
    const row={candidate,L,cb,ch,minC,distance:Math.abs(L-desired)};

    if(!best || row.minC>best.minC || (Math.abs(row.minC-best.minC)<.001 && row.distance<best.distance)){
      best=row;
    }
    if(cb>=3 && ch>=3){
      if(!bestPass || row.distance<bestPass.distance)bestPass=row;
    }
  }
  return (bestPass||best).candidate.toUpperCase();
}

function resolvedMode(){
  return themeMode==='auto'?(systemDark.matches?'dark':'light'):themeMode;
}

function resolvedHairColor(bg,headFill,mode){
  if(contrastMode==='auto'){
    const base = (hairMode==='custom' && hairCustomColor) ? hairCustomColor : (hairSeed && hairSeed.toUpperCase()!=='#0B0B0B' ? hairSeed : (mode==='dark'?'#E2E8F0':'#0B0B0B'));
    return adaptiveHairColor(base, bg, headFill, mode);
  }
  if(hairMode==='custom')return hairCustomColor.toUpperCase();
  if(hairSeed && hairSeed.toUpperCase()!=='#0B0B0B')return hairSeed.toUpperCase();
  if(mode==='dark')return '#E2E8F0';
  return '#0B0B0B';
}

function adaptiveHairDetailColor(hair,headFill){
  // Hair detail must remain readable against the actual hair fill.
  // Prefer the head fill for visual harmony, otherwise fall back to
  // a light/dark neutral with the strongest contrast.
  const candidates=[headFill.toUpperCase(),'#F8FAFC','#111827'];
  let best=candidates[0],bestC=contrast(best,hair);
  for(const candidate of candidates.slice(1)){
    const c=contrast(candidate,hair);
    if(c>bestC){best=candidate;bestC=c}
  }
  return best.toUpperCase();
}


function artifactPalette(seed,bg,mode,bodyStroke){
  const stroke = bodyStroke || (mode==='dark'?'#E5E7EB':'#0B0B0B');
  return {
    artifactNeutralColor:stroke,
    accentColor:stroke,
    loadingColor:stroke,
    successColor:stroke,
    errorColor:stroke,
    sleepColor:stroke
  };
}

function paletteFromBrand(seed){
  const mode=resolvedMode();
  const bg=mode==='dark'?'#0F172A':'#FFFFFF';
  const isDefault = !seed || seed.toUpperCase()==='#0B0B0B';
  let stroke = isDefault ? (mode==='dark'?'#ECECEC':'#0B0B0B') : seed.toUpperCase();

  if(contrastMode==='auto'){
    stroke = ensureContrast(stroke, bg, 4.5, mode==='dark'?'lighter':'darker');
  }

  const headFill = '#FFFFFF', handFill = '#FFFFFF', footFill = '#FFFFFF';
  let detail = stroke;
  if(contrastMode==='auto'){
    detail = ensureContrast(detail, headFill, 4.5, 'darker');
  }

  const hair = resolvedHairColor(bg, headFill, mode);
  const hairDetail = adaptiveHairDetailColor(hair, headFill);

  return {
    stageBackground: bg,
    bodyStrokeColor: stroke,
    detailColor: detail,
    headFillColor: headFill,
    handFillColor: handFill,
    footFillColor: footFill,
    hairColor: hair,
    hairDetailColor: hairDetail,
    accessoryColor: stroke,
    ...artifactPalette(seed, bg, mode, stroke)
  };
}


