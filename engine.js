// Five Launcher site: the shared ENGINE for the design concepts (d1/d2/d3.html). Same behaviour as main.js, but it
// finds its parts by data attributes instead of one layout's class names, so any layout gets the liquid morph:
//   [data-card]   takes part in the morph          [data-pic]   a big picture card (pictures pair with pictures)
//   [data-rgb]    the liquid colour for a picture  [data-round] a circle (liquid corner = half its width)
//   [data-scroll] a list that scrolls inside a tab [data-light] gets the pointer light ([data-white] on white cards)
//   [data-rise]   rises in on first load, in order  #nav a[data-go] + #navBlob: the tab drop (across or down)
//   #progress[data-axis=x|y]: the progress line.  Everything optional is skipped when it is not on the page.
// --- below: main.js v5 ---
// Six tabs in order. Scrolling (or the arrow keys) moves to the next or previous tab, and the current tab MORPHS
// into the next one: each card flies to a card near it on the next tab and cross-fades into it, with a liquid
// edge under the cards (see "switching tabs"). A new switch first lands a running one, so fast switching is safe.
// Performance: only transform/opacity animate, nothing loops while hidden, the hero video only plays on Home
// and is skipped entirely on weak PCs (lite mode).
const REPO = 'OmarFive3/five-launcher-releases';
// The site is pinned to ONE launcher version: the download buttons, badge and update lists never go past it,
// even when newer releases exist on GitHub. Change PIN (and the download link in index.html) to move it.
const PIN = 'v0.3.4';
const ver = t => (t || '').replace(/^v/, '').split('.').map(Number);
const notNewer = t => { const a = ver(t), b = ver(PIN); for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0); return true; };
const q = new URLSearchParams(location.search);
// Omar, Nov 19 2026: the site always moves, even with Windows animation effects off (that sets prefers-reduced-motion). ?still still works.
const reduced = false;
const still = q.has('still') || reduced;
const lite = q.has('lite') || navigator.connection?.saveData || (navigator.deviceMemory || 8) <= 2 || (navigator.hardwareConcurrency || 8) <= 2;
if (lite) document.documentElement.classList.add('lite');
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const mobile = () => innerWidth <= 980;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const TABS = ['home', 'screens', 'features', 'updates', 'faq', 'creator'];
const NAMES = ['Home', 'Screens', 'Features', 'Updates', 'Questions', 'Creator'];
const views = TABS.map(t => $(`#v-${t}`));
const stage = $('#stage'), hero = $('#hero'), notch = $('.notch-btn');
const notched = !!(stage && hero && hero.dataset.shape === 'notch');

// ---------- the hero's shape: cut out at the bottom left for the white card, a soft bite on the right for the arrow ----------
function shape() {
  if (!notched) return;
  if (mobile() || !stage.clientWidth) { hero.style.clipPath = ''; return; }   // (dir-*.html mock-ups shape the hero in their own CSS)
  const W = stage.clientWidth, H = stage.clientHeight, cs = getComputedStyle(stage);
  const cw = parseFloat(cs.getPropertyValue('--cw')), ch = parseFloat(cs.getPropertyValue('--ch')), d = parseFloat(cs.getPropertyValue('--nd'));
  const R = 32, r = 30, a = 70, ny = Math.round(H * .44);
  hero.style.clipPath = `path('${[
    `M${R},0`, `H${W - R}`, `A${R},${R} 0 0 1 ${W},${R}`,
    `V${ny - a}`, `C${W},${ny - a * .5} ${W - d},${ny - a * .62} ${W - d},${ny}`, `C${W - d},${ny + a * .62} ${W},${ny + a * .5} ${W},${ny + a}`,
    `V${H - R}`, `A${R},${R} 0 0 1 ${W - R},${H}`, `H${cw + R}`, `A${R},${R} 0 0 1 ${cw},${H - R}`,
    `V${H - ch + r}`, `A${r},${r} 0 0 0 ${cw - r},${H - ch}`, `H${R}`, `A${R},${R} 0 0 1 0,${H - ch - R}`,
    `V${R}`, `A${R},${R} 0 0 1 ${R},0`, 'Z'].join(' ')}')`;
  notch.style.left = `${W - d + 6}px`; notch.style.top = `${ny - 29}px`;
}
if (notched) new ResizeObserver(shape).observe(stage);

// ---------- hero video: only when the PC can afford it, only while Home is on screen ----------
let video = null;
if (!lite && !reduced && !q.has('still') && $('#heroPoster')) {
  video = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, preload: 'none', poster: 'assets/room.jpg', className: 'hero-vid' });
  video.setAttribute('aria-hidden', 'true'); video.src = 'assets/room.mp4';
  // swap the still for the video once it can play, so the first paint never waits on it
  video.addEventListener('canplay', () => { $('#heroPoster')?.replaceWith(video); syncVideo(); }, { once: true });
  addEventListener('load', () => { video.preload = 'auto'; video.load(); }, { once: true });
}
function syncVideo() { if (!video || !video.isConnected) return; (cur === 0 && !document.hidden) ? video.play().catch(() => {}) : video.pause(); }
document.addEventListener('visibilitychange', syncVideo);

// ---------- entrance (transform/opacity only) ----------
if (!still) $$('[data-rise]').forEach((el, i) => { el.classList.add('rise'); el.style.setProperty('--d', el.dataset.rise || i); });

// ---------- the pointer light: a soft pool inside the card and a bright line along its edge ----------
// Each card gets one clipped layer (.lights) with two round gradients in it. They follow the pointer with transform
// only, at most once per frame; .cover hides the bright one except for a 1px line along the card's edge (style.css).
const canHover = !lite && matchMedia('(hover: hover)').matches;
function light(el) {
  if (!canHover || el.querySelector(':scope > .lights')) return;
  const span = c => Object.assign(document.createElement('span'), { className: c });
  const box = span('lights'), white = el.hasAttribute('data-white');
  if (white) el.classList.add('on-white');
  const parts = white ? [span('glow')] : [span('edge'), span('cover'), span('glow')];
  box.append(...parts); el.prepend(box);
  const moving = parts.filter(p => !p.classList.contains('cover'));
  let x = 0, y = 0, raf = 0;
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect(); x = e.clientX - r.left; y = e.clientY - r.top;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; const t = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`; for (const p of moving) p.style.transform = t; });
  });
}
$$('[data-light]').forEach(light);
$$('.lk').forEach(a => a.prepend(Object.assign(document.createElement('span'), { className: 'lk-ink' })));
$$('[data-dl]').forEach(a => { if ($('#dl')) a.href = $('#dl').href; });

// ---------- speed test (placeholder numbers): bars slide in, lower is better ----------
{
  const bench = $('[data-bench]');
  if (bench) {
  $$('li[data-a]', bench).forEach(li => {
    const a = +li.dataset.a, b = +li.dataset.b, u = li.dataset.u, max = Math.max(a, b);
    for (const [cls, v] of [['me', a], ['them', b]]) {
      const bar = document.createElement('div'), w = Math.max(16, v / max * 100);
      bar.className = `bar ${cls}`; bar.innerHTML = `<i></i><b>${v} ${u}</b>`; bar.dataset.w = String(w); li.appendChild(bar);
    }
  });
  const fill = () => {
    $$('.bar', bench).forEach(bar => {
      const w = +bar.dataset.w, b = $('b', bar), inside = w > 34;
      $('i', bar).style.transform = `translateX(${w - 100}%)`;
      b.style.left = inside ? `calc(${w}% - ${b.offsetWidth + 12}px)` : `calc(${w}% + 10px)`;
      if (!inside && bar.classList.contains('me')) b.style.color = 'var(--tx)';
    });
    bench.classList.add('go');
  };
  setTimeout(fill, still ? 0 : 600);
  }
}

// ---------- the nav: one white drop that stretches from tab to tab (across or down, whichever way the nav runs) ----------
const tabLinks = $$('#nav a[data-go]'), blob = $('#navBlob');
let blobAt = null;
function placeBlob(i, instant) {
  const t = tabLinks[i]; tabLinks.forEach(a => a.classList.toggle('on', a === t));
  if (!t || !blob) return;
  const x = t.offsetLeft, y = t.offsetTop, w = t.offsetWidth, h = t.offsetHeight; if (!w) return;
  const kf = (X, Y, W, H) => ({ transform: `translate(${X}px,${Y}px)`, width: `${W}px`, height: `${H}px` });
  if (!instant && !still && blobAt) {
    const a = blobAt, l = Math.min(a.x, x), tp = Math.min(a.y, y);
    blob.animate([kf(a.x, a.y, a.w, a.h), { ...kf(l, tp, Math.max(a.x + a.w, x + w) - l, Math.max(a.y + a.h, y + h) - tp), offset: .42 }, kf(x, y, w, h)],
      { duration: 560, easing: 'cubic-bezier(.3,1.2,.4,1)' });
  }
  Object.assign(blob.style, kf(x, y, w, h)); blobAt = { x, y, w, h };
}

// ---------- the progress line on the right: how far through the tabs you are ----------
const progress = $('#progress'), prFill = $('#prFill'), axisX = progress?.dataset.axis === 'x';
const dots = progress ? TABS.map((t, i) => {
  const b = document.createElement('a'); b.className = 'pr-dot'; b.href = `#${t}`; b.style[axisX ? 'left' : 'top'] = `${i / (TABS.length - 1) * 100}%`;
  b.setAttribute('aria-label', NAMES[i]); b.innerHTML = `<span>${NAMES[i]}</span>`; progress.appendChild(b); return b;
}) : [];
function placeProgress(i) {
  const cn = $('#countN'); if (cn) cn.textContent = String(i + 1).padStart(2, '0');   // a big counter, if the layout has one
  if (!progress) return;
  prFill.style.transform = `${axisX ? 'scaleX' : 'scaleY'}(${i / (TABS.length - 1)})`;
  dots.forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('past', k < i); });
}

// ---------- switching tabs: the LIQUID MORPH (v5) ----------
// The real cards do the morph, so the page never empties or goes dark:
//   - every old card is matched with a new card near it (same place, similar size, same light or dark surface);
//   - a matched pair flies as one: the old card heads for the new card's place and shape, the new card starts from
//     the old card's place and shape, and the content swaps in the middle of the flight (FIT limits how far content
//     is squeezed, so text never smears; where shapes differ more than that, the liquid edge carries the change);
//   - an old card with no match leans toward the nearest new card and melts away, and a new card with no match
//     wells up leaning in from the nearest old card;
//   - the cards leave one after another in a wave across the page, so some content is always fully readable;
//   - pictures and white cards stay solid until what replaces them is solid, so the page never dips to dark.
// Under the cards, one WebGL layer draws the same boxes as liquid in the cards' own colours: swollen a little,
// joined with a smooth union so neighbours melt together and pull apart, with a light rim on the surface. It is
// only an edge around the cards, never a cover. The shader runs only during a switch. Without a real graphics
// card (or in lite mode) the cards morph the same way, just without the liquid edge.
// On DOM elements only transform and opacity animate, on the compositor (Web Animations).
const CARD = '[data-card]';                              // the cards of a tab that take part
const TITLES = '.pt, .ps';                               // page title and subtitle: they roll, they are not cards
const SCROLLERS = '[data-scroll]';                       // lists that clip their cards: opened up while cards fly
const PAIRS = ['[data-pic]'];                            // the big pictures always turn into each other
const board = $('#board');
// ---- tunables ----
const MOVE = lite ? 380 : 440;      // ms: one card's flight
const WAVE = lite ? 110 : 170;      // ms: how far apart the first and the last card leave
const TOTAL = MOVE + WAVE;          // ms: the whole switch
const CURVE = [.5, 0, .18, 1.22];   // the flight curve: slow lift-off, quick middle, a small overshoot as it lands
const FIT = [.85, 1.18];             // how far a card's content may be squeezed or stretched to follow its shape
// When a card's content shows, as [time, opacity] over its own flight. Text cards swap in the middle of the flight,
// one nearly gone before the other shows (no text printed over text); picture cards and white cards stay solid
// until the card that replaces them is solid too, so nothing bright blinks out.
// Keep the first two stops of each list at the same opacity: the first stop also carries the flight curve.
const OUT_TEXT = [[0, 1], [.24, 1], [.52, 0], [1, 0]], IN_TEXT = [[0, 0], [.38, 0], [.66, 1], [1, 1]];
const OUT_SOLID = [[0, 1], [.54, 1], [.76, 0], [1, 0]], IN_SOLID = [[0, 0], [.3, 0], [.6, 1], [1, 1]];
const OUT_EARLY = [[0, 1], [.12, 1], [.4, 0], [1, 0]];   // a text card that turns into a white or picture card clears first
const SMALL = .92, DRIFT = .22, DRIFT_MAX = 70;         // a card with no match: the size it shrinks to or grows from, and how far it leans toward its neighbour (share of the way, px limit)
const GOO = { swell: 10, merge: 22, ripple: 4, rim: .5, lift: .035 };   // px, px, px, 0..1, 0..1 (the liquid edge)
const MAXN = 24;
const FREEZE = q.has('freeze') ? +q.get('freeze') : null;   // screenshot helper: ?freeze=0.5 (add ?forcegl for the liquid), then switch
let cur = -1, tr = null;

function show(i, keep) {
  views.forEach((v, k) => { v.hidden = k !== i && v !== keep; });
  cur = i; placeBlob(i, true); placeProgress(i);
  if (i === 0) shape();
  syncVideo();
  if (TABS[i] === 'screens') layDeck();
}

// the flight curve as a function, so the liquid follows exactly the path the cards take
const curve = (([x1, y1, x2, y2]) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return t => {
    if (t <= 0) return 0; if (t >= 1) return 1;
    let lo = 0, hi = 1, s = t;
    for (let i = 0; i < 22; i++) { ((ax * s + bx) * s + cx) * s < t ? lo = s : hi = s; s = (lo + hi) / 2; }
    return ((ay * s + by) * s + cy) * s;
  };
})(CURVE);
const CURVE_CSS = `cubic-bezier(${CURVE})`;

// --- the WebGL layer for the liquid edge (made once, hidden between switches) ---
const gl = (() => {
  if (lite || still) return null;
  const c = document.createElement('canvas'); c.className = 'liquid'; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true, powerPreference: 'low-power' });
  if (!g) return null;
  // software renderers (no real GPU) would be slower than the effect is worth
  const dbg = g.getExtension('WEBGL_debug_renderer_info');
  const name = dbg ? String(g.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|software|basic render/i.test(name) && !q.has('forcegl')) return null;
  const deriv = !!g.getExtension('OES_standard_derivatives');   // lets the rim catch the light from above
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `${deriv ? '#extension GL_OES_standard_derivatives : enable\n' : ''}
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 res;uniform float k;uniform float wob;uniform float tm;uniform float rim;uniform float lift;uniform float px;uniform int n;
uniform vec4 box[${MAXN}];uniform vec4 col[${MAXN}];
float sdb(vec2 p,vec2 c,vec2 h,float r){vec2 q=abs(p-c)-h+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
void main(){
  vec2 p=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y);
  float d=1e4;vec3 c=vec3(0.);vec3 cp=vec3(0.);float ap=0.;
  for(int i=0;i<${MAXN};i++){ if(i>=n)break;
    vec4 b=box[i];vec4 cc=col[i];
    float e=sdb(p,b.xy,b.zw,min(cc.a,min(b.z,b.w)));
    float h=clamp(.5+.5*(e-d)/max(k,.001),0.,1.);
    d=mix(e,d,h)-k*h*(1.-h);                          /* smooth union: drops that touch melt together */
    c=mix(cc.rgb,c,smoothstep(.3,.7,h));
    float w=clamp(.5-e,0.,1.);cp=mix(cp,cc.rgb,w);ap=max(ap,w);   /* drops come biggest first: a small one inside a big one keeps its colour */
  }
  c=mix(c,cp,ap);
  d+=wob*sin(p.x*.021/px+tm*7.)*sin(p.y*.017/px-tm*5.);   /* a soft ripple on the surface while it flows */
  float a=clamp(.5-d,0.,1.);
  float e=clamp(1.+d/(5.*px),0.,1.);                  /* 0 deep inside, 1 on the surface */
  ${deriv ? 'vec2 g=vec2(dFdx(d),-dFdy(d));float l=.5+.5*dot(g/max(length(g),1e-4),vec2(-.42,-.9));' : 'float l=.7;'}
  c=mix(c+lift,vec3(1.),rim*e*e*(.3+.7*l));           /* the light rim, brighter on edges that face up */
  gl_FragColor=vec4(c*a,a);
}`;
  const sh = (t, s) => { const o = g.createShader(t); g.shaderSource(o, s); g.compileShader(o); return o; };
  const pr = g.createProgram(); g.attachShader(pr, sh(g.VERTEX_SHADER, vs)); g.attachShader(pr, sh(g.FRAGMENT_SHADER, fs)); g.linkProgram(pr);
  if (!g.getProgramParameter(pr, g.LINK_STATUS)) return null;
  g.useProgram(pr);
  const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
  const loc = g.getAttribLocation(pr, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  const U = n => g.getUniformLocation(pr, n);
  board.appendChild(c);
  return { c, g, res: U('res'), k: U('k'), wob: U('wob'), tm: U('tm'), rim: U('rim'), lift: U('lift'), px: U('px'), n: U('n'), box: U('box'), col: U('col'),
    boxes: new Float32Array(MAXN * 4), cols: new Float32Array(MAXN * 4) };
})();

const parseRGB = s => { const m = (s || '').match(/[\d.]+/g); return m && (m.length < 4 || +m[3] > 0.05) ? [m[0] / 255, m[1] / 255, m[2] / 255] : null; };
// the cards of a tab that are on screen right now, measured in the board's own coordinates
const SKIN = new WeakMap();
function cardsOf(i, B) {
  const out = [];
  for (const el of $$(CARD, views[i])) {
    if (!el.offsetWidth) continue;
    const r = el.getBoundingClientRect(), sc = el.parentElement.closest(SCROLLERS), c = sc ? sc.getBoundingClientRect() : B;
    if (r.bottom < Math.max(B.top, c.top) + 6 || r.top > Math.min(B.bottom, c.bottom) - 6) { el.classList.add('morph-off'); continue; }   // scrolled out of sight: stays out
    let k = SKIN.get(el);
    if (!k) {             // a card's colour and corner do not change: read them once
      const cs = getComputedStyle(el), fixed = el.dataset.rgb ? el.dataset.rgb.split(',').map(Number) : null;
      const rgb = fixed ? fixed : (parseRGB(cs.backgroundColor) || [.09, .09, .1]), light = rgb[0] + rgb[1] + rgb[2] > 1.5;
      SKIN.set(el, k = { rgb, light, solid: light || !!fixed, rad: el.hasAttribute('data-round') ? r.width / 2 : parseFloat(cs.borderTopLeftRadius) || 16 });
    }
    out.push({ el, x: r.left + r.width / 2 - B.left, y: r.top + r.height / 2 - B.top, w: r.width, h: r.height, ...k });
  }
  return out;
}
// lists stop clipping while their cards fly (the scrollbar's width is kept as padding, so nothing reflows)
function unclip(v, on) {
  for (const s of $$(SCROLLERS, v)) {
    if (!on) { s.classList.remove('unclip'); s.style.paddingRight = ''; continue; }
    const bar = s.offsetWidth - s.clientWidth;
    if (bar > 0) s.style.paddingRight = `${parseFloat(getComputedStyle(s).paddingRight) + bar}px`;
    s.classList.add('unclip');
  }
}
// where each card's box really is once the lists are open (an old card may have been scrolled)
function settle(list, B, isNew) {
  for (const c of list) {
    const r = c.el.getBoundingClientRect(); c.lx = r.left + r.width / 2 - B.left; c.ly = r.top + r.height / 2 - B.top;
    if (isNew) { c.x = c.lx; c.y = c.ly; c.w = r.width; c.h = r.height; }
  }
}
// who becomes who: forced pairs, then the cheapest matches (near, similar size, same light or dark surface);
// what is left over is drunk by, or buds from, the nearest card on the other side
function plan(A, Bs, diag) {
  const items = [], usedA = new Set(), usedB = new Set();
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const take = (a, b) => { usedA.add(a); usedB.add(b); items.push({ a, b }); };
  for (const sel of PAIRS) { const a = A.find(o => o.el.matches(sel)), b = Bs.find(o => o.el.matches(sel)); if (a && b && !usedA.has(a) && !usedB.has(b)) take(a, b); }
  const cand = [];
  for (const a of A) for (const b of Bs) {
    const size = Math.abs(Math.log((a.w * a.h) / (b.w * b.h)));       // 0 = same area
    const cost = dist(a, b) + (a.light !== b.light ? 260 : 0) + 110 * size;
    if (cost < diag * .3 && size < 1.4) cand.push([cost, a, b]);        // only near neighbours, never a card 4x the other's size
  }
  cand.sort((p, q) => p[0] - q[0]).forEach(([, a, b]) => { if (!usedA.has(a) && !usedB.has(b)) take(a, b); });
  const inside = (p, r) => ({ x: clamp(p.x, r.x - r.w * .3, r.x + r.w * .3), y: clamp(p.y, r.y - r.h * .3, r.y + r.h * .3) });   // the spot inside card r nearest to p
  const near = (p, list) => list.reduce((best, r) => { const at = inside(p, r), d = dist(p, at); return !best || d < best.d ? { r, at, d } : best; }, null);
  if (Bs.length) for (const a of A) if (!usedA.has(a)) items.push({ a, into: near(a, Bs) });
  if (A.length) for (const b of Bs) if (!usedB.has(b)) items.push({ b, from: near(b, A) });
  return items;
}

// one frame of the liquid edge, at `ms` into the switch
function drawGoo(blobs, ms, dpr) {
  const { g, c, boxes, cols } = gl, T = ms / TOTAL, mid = Math.sin(Math.PI * clamp(T, 0, 1));
  let n = 0;
  for (const o of blobs) {
    if (n >= MAXN) break;
    const u = clamp((ms - o.delay) / MOVE, 0, 1), t0 = o.t0 || 0, v = clamp((u - t0) / ((o.t1 || 1) - t0), 0, 1);   // v: this drop's own stretch of the flight
    const p = curve(v), fly = Math.sin(Math.PI * v), L = (a, b) => a + (b - a) * p;
    const w = L(o.a.w, o.b.w), h = L(o.a.h, o.b.h); if (Math.min(w, h) < 3) continue;
    const swell = GOO.swell * fly * Math.min(1, Math.min(w, h) / 44) - 1;   // swollen in flight; one pixel inside its card at rest
    const e = clamp((u - .25) / .4, 0, 1);
    boxes.set([L(o.a.x, o.b.x) * dpr, L(o.a.y, o.b.y) * dpr, Math.max(1, w / 2 + swell) * dpr, Math.max(1, h / 2 + swell) * dpr], n * 4);
    cols.set([0, 1, 2].map(i => o.a.rgb[i] + (o.b.rgb[i] - o.a.rgb[i]) * e).concat(Math.max(0, L(o.a.rad, o.b.rad) + swell) * dpr), n * 4);
    n++;
  }
  g.viewport(0, 0, c.width, c.height); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
  g.uniform2f(gl.res, c.width, c.height); g.uniform1f(gl.px, dpr); g.uniform1i(gl.n, n); g.uniform1f(gl.tm, T);
  g.uniform1f(gl.k, GOO.merge * mid * dpr + .001); g.uniform1f(gl.wob, GOO.ripple * mid * dpr);
  g.uniform1f(gl.rim, GOO.rim * mid); g.uniform1f(gl.lift, GOO.lift * mid);
  g.uniform4fv(gl.box, boxes); g.uniform4fv(gl.col, cols);
  g.drawArrays(g.TRIANGLES, 0, 3);
}

function finish() {
  if (!tr) return;
  const t = tr; tr = null; clearTimeout(t.guard); cancelAnimationFrame(t.raf);
  t.anims.forEach(a => { try { a.cancel(); } catch {} });
  if (gl) gl.c.style.display = 'none';
  for (const v of [t.oldV, t.newV]) { unclip(v, false); $$('.morph-off', v).forEach(el => el.classList.remove('morph-off')); }
  t.oldV.classList.remove('leaving'); if (t.oldV !== views[cur]) t.oldV.hidden = true;
  focusTitle(cur);
}
function go(to) {
  to = clamp(to, 0, TABS.length - 1);
  finish();                                            // a new switch first lands the running one
  if (to === cur) return;
  for (const el of $$('.rise')) el.classList.remove('rise');   // the entrance plays once, on load; from here on the morph is the entrance
  const from = cur, oldV = views[from], newV = views[to], dir = to > from ? 1 : -1;
  if (location.hash.slice(1) !== TABS[to]) history.pushState(null, '', `#${TABS[to]}`);
  placeBlob(to);
  if (still || mobile()) { show(to); if (mobile()) scrollTo(0, 0); return focusTitle(to); }

  // measure both tabs (they share one grid cell; the new one sits on top)
  const B = board.getBoundingClientRect(), olds = cardsOf(from, B);
  show(to, oldV); oldV.classList.add('leaving');
  for (const s of $$(SCROLLERS, newV)) s.scrollTop = 0;
  const news = cardsOf(to, B);
  unclip(oldV, true); unclip(newV, true);
  settle(olds, B, false); settle(news, B, true);
  const items = plan(olds, news, Math.hypot(B.width, B.height));
  // the wave: cards leave one after another across the page (the other way round when going back)
  const key = it => { const s = it.a || it.from.at; return s.x * .8 + s.y * .6; };
  items.sort((p, q) => (key(p) - key(q)) * dir).forEach((it, i) => { it.delay = items.length > 1 ? WAVE * i / (items.length - 1) : 0; });

  const anims = [], blobs = [];
  const A = (el, kf, o) => { const a = el.animate(kf, { fill: 'both', easing: 'linear', ...o }); anims.push(a); return a; };
  // one animation per card: its transform follows the flight curve from start to end, its opacity follows `stops`
  const move = (el, a, b, stops, delay) => A(el, stops.map(([offset, opacity], i) => i === 0 ? { offset, opacity, transform: a, easing: CURVE_CSS }
    : i === stops.length - 1 ? { offset, opacity, transform: b } : { offset, opacity }), { duration: MOVE, delay });
  const lean = (c, at) => { const dx = (at.x - c.x) * DRIFT, dy = (at.y - c.y) * DRIFT, f = Math.min(1, DRIFT_MAX / (Math.hypot(dx, dy) || 1)); return [dx * f, dy * f]; };
  const top = newV.getBoundingClientRect().top - B.top;
  const onBoard = (x, y, w, h) => [clamp(x, w / 2, B.width - w / 2), clamp(y, top + h / 2, B.height - h / 2)];   // a card that FIT keeps big never hangs off the page
  const tf = (x, y, sx = 1, sy = 1) => `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
  for (const { a, b, into, from: src, delay } of items) {
    if (a && b) {             // one shape, two contents: both cards are the same box all the way (unless FIT holds them back)
      const fit = v => clamp(v, FIT[0], FIT[1]), ax = fit(b.w / a.w), ay = fit(b.h / a.h), bx = fit(a.w / b.w), by = fit(a.h / b.h);
      const [ex, ey] = onBoard(b.x, b.y, a.w * ax, a.h * ay), [sx, sy] = onBoard(a.x, a.y, b.w * bx, b.h * by);   // where the old card ends, where the new one starts
      move(a.el, tf(a.x - a.lx, a.y - a.ly), tf(ex - a.lx, ey - a.ly, ax, ay), a.solid ? OUT_SOLID : b.solid ? OUT_EARLY : OUT_TEXT, delay);
      move(b.el, tf(sx - b.x, sy - b.y, bx, by), tf(0, 0), a.solid && b.solid ? IN_SOLID : IN_TEXT, delay);
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.w - b.w) + Math.abs(a.h - b.h) > 3) blobs.push({ a, b, delay });
    } else if (a) {           // no match: it leans toward the nearest new card and melts away
      const [dx, dy] = lean(a, into.at);
      move(a.el, tf(a.x - a.lx, a.y - a.ly), tf(a.x - a.lx + dx, a.y - a.ly + dy, SMALL, SMALL), a.solid ? OUT_SOLID : OUT_TEXT, delay);
      if (!a.light) blobs.push({ a, b: { x: a.x + dx, y: a.y + dy, w: 0, h: 0, rad: 0, rgb: a.rgb }, delay, t1: a.solid ? .85 : .6 });   // its liquid closes up under it, gone when the card is
    } else {                  // no match: it wells up, leaning in from the nearest old card
      const [dx, dy] = lean(b, src.at);
      move(b.el, tf(dx, dy, SMALL, SMALL), tf(0, 0), b.solid ? IN_SOLID : IN_TEXT, delay);
      if (!b.light) blobs.push({ a: { x: b.x + dx, y: b.y + dy, w: 0, h: 0, rad: 0, rgb: b.rgb }, b, delay, t0: .1, t1: .5 });   // its liquid wells up first, then the card shows on it (a white card needs none: a bare white drop would flash)
    }
  }
  blobs.sort((p, q) => Math.max(q.a.w * q.a.h, q.b.w * q.b.h) - Math.max(p.a.w * p.a.h, p.b.w * p.b.h));   // biggest drops first (see the shader)
  // page titles roll: the old one leaves the way you are going, the new one follows it in
  for (const el of $$(TITLES, oldV)) A(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${-10 * dir}px)` }], { duration: 200, easing: 'ease-in' });
  for (const el of $$(TITLES, newV)) A(el, [{ opacity: 0, transform: `translateY(${12 * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 340, delay: 150, easing: 'cubic-bezier(.3,1.25,.4,1)' });

  const T = tr = { anims, oldV, newV, raf: 0, guard: 0 };
  const freeze = () => { anims.forEach(a => { a.pause(); a.currentTime = FREEZE * TOTAL; }); };
  if (!gl) {                                           // no liquid edge: the cards morph on their own
    if (FREEZE != null) return freeze();
    T.guard = setTimeout(finish, TOTAL + 30);
    return;
  }
  const dpr = Math.min(devicePixelRatio || 1, 1.25), c = gl.c;
  const w = Math.round(B.width * dpr), h = Math.round(B.height * dpr);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  c.style.display = 'block';
  const clock = A(c, [{ opacity: 0 }, { opacity: 1, offset: .1 }, { opacity: 1, offset: .84 }, { opacity: 0 }], { duration: TOTAL });
  drawGoo(blobs, 0, dpr);
  if (FREEZE != null) { freeze(); return drawGoo(blobs, FREEZE * TOTAL, dpr); }
  T.guard = setTimeout(finish, TOTAL + 150);           // lands on time even if the browser stops sending frames
  const tick = () => {
    if (tr !== T) return;
    const ms = Math.min(TOTAL, +clock.currentTime || 0); drawGoo(blobs, ms, dpr);
    if (ms < TOTAL) T.raf = requestAnimationFrame(tick); else finish();
  };
  T.raf = requestAnimationFrame(tick);
}
function focusTitle(i) { if (i > 0 && cur === i) $('.pt', views[i])?.focus({ preventScroll: true }); }
const fromHash = () => Math.max(0, TABS.indexOf(location.hash.slice(1)));
addEventListener('popstate', () => go(fromHash()));
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  const i = TABS.indexOf(a.getAttribute('href').slice(1)); if (i < 0) return;
  e.preventDefault(); go(i);
});
addEventListener('resize', () => { placeBlob(cur, true); });

// ---------- scroll wheel and keys move through the tabs ----------
// One tab per gesture: after a move the wheel must rest briefly before it can move again, so a trackpad's long
// glide never skips tabs. Lists inside a tab scroll first and only hand over at their ends.
let lastWheel = 0, needRest = false, acc = 0;
function innerCanScroll(target, dy) {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 1) continue;
    if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
    if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
  }
  return false;
}
addEventListener('wheel', e => {
  if (mobile() || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  if (innerCanScroll(e.target, e.deltaY)) return;
  e.preventDefault();
  const now = performance.now(), gap = now - lastWheel; lastWheel = now;
  if (needRest) { if (gap < 180) return; needRest = false; }
  if (tr) return;
  if (gap > 220) acc = 0;
  acc += e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
  if (Math.abs(acc) < 40) return;
  const next = cur + Math.sign(acc); acc = 0;
  if (next < 0 || next >= TABS.length) return;
  needRest = true; go(next);
}, { passive: false });
addEventListener('keydown', e => {
  if (mobile() || e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key, up = k === 'ArrowUp' || k === 'PageUp', down = k === 'ArrowDown' || k === 'PageDown';
  if (k === 'Escape' && cur) return go(0);
  if (!up && !down) return;
  if (innerCanScroll(document.activeElement, up ? -1 : 1)) return;
  e.preventDefault(); if (!tr) go(cur + (down ? 1 : -1));
});

// ---------- screens: a deck that shuffles by itself; the pill under it follows ----------
const deck = $('#deck'), cards = deck ? $$('.card-shot', deck) : [], seg = $('#seg'), hl = $('.seg-hl');
let order = cards.map((_, i) => i), busy = false, hlAt = null;
const segBtns = cards.map((c, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = c.dataset.name;
  b.addEventListener('click', () => pick(i)); seg.appendChild(b); return b;
});
let flying = [], flyT = 0;   // cards that are flying off the front (they are laid at the back once they land)
function layDeck() {
  if (!cards.length) return;
  order.forEach((ci, depth) => {
    if (flying.includes(ci)) return;
    const c = cards[ci], vis = Math.min(depth, 3);
    c.style.zIndex = String(50 - depth);
    c.style.transform = depth === 0 ? 'none' : `translateY(${-vis * 5.4}%) scale(${1 - vis * .06})`;
    c.style.opacity = depth > 2 ? '0' : '1';
    c.style.setProperty('--dim', String(depth === 0 ? 0 : .22 * vis));
  });
  const t = segBtns[order[0]];
  segBtns.forEach(b => b.setAttribute('aria-selected', String(b === t)));
  const x = t.offsetLeft, w = t.offsetWidth; if (!w) return;
  if (hlAt && !still && hlAt.x !== x) {
    const a = hlAt, left = Math.min(a.x, x), span = Math.max(a.x + a.w, x + w) - left;
    hl.animate([{ transform: `translateX(${a.x}px)`, width: `${a.w}px` }, { transform: `translateX(${left}px)`, width: `${span}px`, offset: .45 }, { transform: `translateX(${x}px)`, width: `${w}px` }], { duration: 560, easing: 'cubic-bezier(.3,1.2,.4,1)' });
  }
  hl.style.transform = `translateX(${x}px)`; hl.style.width = `${w}px`; hlAt = { x, w };
}
// Bringing a card to the front: every card in front of it flies off to the left, one after another, staying on top
// while it flies; at the same time the rest of the deck moves up, so the picked card rises into the front place.
// Once they have flown, those cards are put at the back without a transition. A new pick first lands the last one,
// so clicking quickly (or during the automatic shuffle) never leaves a card stuck or jumping through the deck.
function landFlown() {
  clearTimeout(flyT);
  if (!flying.length) return;
  const done = flying; flying = [];
  for (const ci of done) {
    const c = cards[ci];
    c.style.transition = 'none'; c.style.transitionDelay = ''; c.style.zIndex = '0';
    c.style.transform = 'translateY(-16.2%) scale(.82)'; c.style.opacity = '0';
  }
  void deck.offsetWidth;
  for (const ci of done) cards[ci].style.transition = '';
  layDeck();
}
function bringToFront(i) {
  landFlown();
  const at = order.indexOf(i); if (at <= 0) return;
  const ahead = order.slice(0, at);
  order = order.slice(at).concat(ahead);
  flying = still ? [] : ahead;
  ahead.forEach((ci, k) => {
    if (still) return;
    const c = cards[ci];
    c.style.zIndex = String(70 - k); c.style.transitionDelay = `${k * 70}ms`;
    c.style.transform = 'translate(-62%, 8%) rotate(-10deg) scale(.92)'; c.style.opacity = '0';
  });
  layDeck();
  if (flying.length) flyT = setTimeout(landFlown, 560 + (ahead.length - 1) * 70);
}
function shuffleOnce() { bringToFront(order[1]); }
function pick(i) { if (order[0] === i) return; bringToFront(i); restart(); }
let timer = 0;
function restart() { clearInterval(timer); if (!still) timer = setInterval(() => { if (cur === 1 && !tr && !document.hidden && !deck.matches(':hover')) shuffleOnce(); }, 3400); }
addEventListener('resize', () => cur === 1 && layDeck());
if (deck) restart();

// ---------- features: the mini install bar fills, finishes, starts again (only while Features is shown) ----------
{
  const em = $('.ml em.busy'), pct = em && $('.pct', em); let v = 62;
  if (em && !still) setInterval(() => {
    if (cur !== 2 || document.hidden) return;
    v = v >= 100 ? 8 : Math.min(100, v + 3 + Math.random() * 5);
    em.style.setProperty('--p', `${v}%`); pct.textContent = v >= 100 ? 'Done' : `${Math.round(v)}%`;
  }, 300);
}

// ---------- questions: one open at a time ----------
// The answer takes its room at once; what moves is the rows, which slide from where they were to where they now
// belong (transform only, no height animation). Later rows sit on top of earlier ones, so an opening answer is
// uncovered by the rows below it as they slide down.
{
  const qas = $$('.qa');
  qas.forEach(qa => $('.q', qa).addEventListener('click', () => {
    const open = !qa.classList.contains('open'), was = qas.map(o => o.getBoundingClientRect().top);
    qas.forEach(o => { o.classList.remove('open'); $('.q', o).setAttribute('aria-expanded', 'false'); });
    if (open) { qa.classList.add('open'); $('.q', qa).setAttribute('aria-expanded', 'true'); }
    if (still) return;
    qas.forEach((o, i) => {
      const d = was[i] - o.getBoundingClientRect().top;
      if (Math.abs(d) > .5) o.animate([{ transform: `translateY(${d.toFixed(1)}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.3,1.25,.4,1)' });
    });
  }));
}

// ---------- releases from GitHub (never past PIN) ----------
const fallback = [{ tag_name: 'v0.3.4', published_at: '2026-11-17T15:00:25Z', body: "- A much smaller download: the launcher no longer carries about 38 MB of old Home scenes it never showed\n- New installs go to your own user folders by default (it used to pick an O: drive if your PC had one). Existing installs stay where they are\n- Settings: removed four options that did nothing yet (language, remember the window size, crash reports, usage numbers)\n- Cleaner, lighter code under the hood: dead parts removed and repeated parts merged", assets: [{ name: 'Five-Launcher-Setup.exe', size: 14451219 }] }];
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function md(body) {
  const lines = (body || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = lines.filter(l => /^[-*] /.test(l)).map(l => `<li>${esc(l.slice(2))}</li>`);
  const text = lines.filter(l => !/^[-*] /.test(l) && !l.startsWith('#')).map(l => `<p>${esc(l)}</p>`);
  return text.join('') + (items.length ? `<ul>${items.join('')}</ul>` : '');
}
const headline = body => { const l = (body || '').split(/\r?\n/).map(s => s.trim()).find(s => /^[-*] /.test(s)) || ''; const t = l.slice(2).split(/[:.]/)[0]; return t.length > 46 ? t.slice(0, 44).trim() + '…' : t; };
const longDate = iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
function render(list) {
  const top = list[0];
  if ($('#latest')) $('#latest').innerHTML = `<span class="tag">Latest</span><h3>${esc(top.tag_name)}</h3><time datetime="${esc(top.published_at)}">${longDate(top.published_at)}</time>${md(top.body)}`;
  if ($('#latest') && $('#dl')) { const dl = $('#dl').cloneNode(true); dl.removeAttribute('id'); $('#latest').appendChild(dl); }
  if ($('#releases')) $('#releases').innerHTML = list.slice(1, 12).map(r => `
    <li class="rel"><header><span class="v">${esc(r.tag_name)}</span><time datetime="${esc(r.published_at)}">${longDate(r.published_at)}</time></header>${md(r.body)}</li>`).join('');
  if ($('#newsList')) $('#newsList').innerHTML = list.slice(0, 3).map(r => `<li><span class="v">${esc(r.tag_name)}</span><span class="t"><b>${esc(headline(r.body) || 'Fixes and polish')}</b><span>${new Date(r.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span></span></li>`).join('');
  $$('.rel').forEach(el => { el.setAttribute('data-card', ''); light(el); });
  $$('[data-ver]').forEach(e => e.textContent = top.tag_name);
  const a = top.assets?.find(x => /\.exe$/i.test(x.name));
  if (a) $$('[data-size]').forEach(e => e.textContent = `${Math.round(a.size / 1048576)} MB`);
}
render(fallback);
if (!q.has('offline')) fetch(`https://api.github.com/repos/${REPO}/releases`).then(r => r.ok ? r.json() : []).then(l => { l = Array.isArray(l) ? l.filter(r => !r.draft && !r.prerelease && notNewer(r.tag_name)) : []; if (l.length) render(l); }).catch(() => {});

// ---------- start ----------
show(fromHash());
document.fonts?.ready.then(() => { placeBlob(cur, true); if (cur === 1) layDeck(); });
if (q.has('hover')) $('#dl')?.classList.add('hover-shot');
// decode the hidden tabs' pictures while the PC is idle, so the first visit to Screens or Creator doesn't hitch
addEventListener('load', () => {
  const imgs = $$('.view[hidden] img'), idle = window.requestIdleCallback || (f => setTimeout(f, 200));
  const next = () => { const im = imgs.shift(); if (!im) return; im.loading = 'eager'; im.decode().catch(() => {}).finally(() => idle(next)); };
  idle(next);
}, { once: true });
