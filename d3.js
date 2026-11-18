// Drops (d3.html): this page's own motion, on top of engine.js (which does the tabs and the liquid morph).
//   - the background, in three styles, with a small panel to preview them (temporary, until Omar picks one)
//   - (the Download button stays still: Omar asked for no movement on it)
//   - the feature bars: a pool of light follows the mouse, a ripple where you click
//   - the speed score (the centre of Features) draws itself in each time you open Features
// Performance: everything moves with transform and opacity, at most once per frame, and only while the mouse is
// there or the tab is open. Lite mode (weak PCs) and reduced motion get the still versions.
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const q = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lite = document.documentElement.classList.contains('lite');
const still = q.has('still') || reduced;
const canHover = !lite && matchMedia('(hover: hover)').matches;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

// ---------- the background ----------
const STYLES = [['liquid', 'Liquid'], ['dots', 'Dots'], ['voxel', 'Voxel'], ['none', 'None']];
const bg = document.createElement('div'); bg.className = 'bgfx'; bg.setAttribute('aria-hidden', 'true');
bg.innerHTML = '<div class="bg-liquid"><i></i><i></i><i></i><i></i></div><div class="bg-dots"><span class="lens"><i></i></span></div><div class="bg-voxel"><span class="lens"><i></i></span></div>';
document.body.prepend(bg);

// the voxel tile: blocks of slightly different greys, drawn once into a small picture that repeats
function voxelTile(bright) {
  const c = document.createElement('canvas'), n = 12, s = 16; c.width = c.height = n * s;
  const g = c.getContext('2d'); let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = rnd(); if (r < .55) continue;                       // most of the tile stays empty
    const a = bright ? .05 + r * .1 : .008 + r * .02;
    g.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
    if (r > .93) { g.fillStyle = `rgba(255,201,58,${bright ? .22 : .05})`; g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2); }   // a rare gold block
  }
  return c.toDataURL();
}
let voxelMade = false;
function makeVoxel() {
  if (voxelMade) return; voxelMade = true;
  $('.bg-voxel', bg).style.backgroundImage = `url(${voxelTile(false)})`;
  $('.bg-voxel .lens > i', bg).style.backgroundImage = `url(${voxelTile(true)})`;
}
function setBg(name) {
  if (!STYLES.some(([k]) => k === name)) name = 'liquid';
  if (name === 'voxel') makeVoxel();
  bg.dataset.bg = name;
}
// the lens: a round window that follows the mouse; inside it the same pattern, bigger and brighter. The window moves
// one way and its pattern the other way by the same amount, so the pattern stays in place (transform only).
if (canHover && !still) {
  let x = -999, y = -999, raf = 0;
  const lenses = $$('.lens', bg);
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      for (const l of lenses) {
        const h = l.offsetWidth / 2;
        l.style.transform = `translate3d(${x - h}px,${y - h}px,0)`;
        l.firstElementChild.style.transform = `translate3d(${h - x}px,${h - y}px,0)`;
        l.classList.add('on');
      }
    });
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => $$('.lens', bg).forEach(l => l.classList.remove('on')));
}
// Omar picked Liquid (Nov 18 2026); the preview panel is gone. ?bg=dots|voxel|none still previews the others.
setBg(q.get('bg') || 'liquid');

// ---------- the Download button: energy streaks shoot out when it's clicked (the button itself stays still) ----------
{
  const drop = $('.drop'), streaks = drop ? $$('.burst i', drop) : [];
  // most streaks fly out to the sides, a few up and down, at slightly different speeds
  streaks.forEach((el, k) => {
    const side = k % 2 ? 180 : 0, spread = [-22, -9, 4, 16, -14, 24][Math.floor(k / 2) % 6];
    el.style.setProperty('--a', `${side + spread}deg`); el.style.setProperty('--d', `${(k % 4) * 30}ms`);
  });
  if (drop && !still) drop.addEventListener('pointerdown', () => {
    drop.classList.remove('fire'); void drop.offsetWidth; drop.classList.add('fire');
    setTimeout(() => drop.classList.remove('fire'), 900);
  });
}

// ---------- the feature bars: a gold pool follows the mouse, a ripple where you click, the description pops up ----------
for (const el of $$('.fbar')) {
  const fx = $('.fx', el), glow = $('.fx-glow', el);
  if (canHover && !still) {
    let raf = 0, px = 0, py = 0;
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; glow.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0)`; });
    });
  }
  el.addEventListener('pointerdown', e => {
    if (still) return;
    const r = el.getBoundingClientRect(), rip = document.createElement('span');
    rip.className = 'rip'; rip.style.left = `${e.clientX - r.left}px`; rip.style.top = `${e.clientY - r.top}px`;
    fx.appendChild(rip); rip.addEventListener('animationend', () => rip.remove(), { once: true });
    el.classList.remove('squish'); void el.offsetWidth; el.classList.add('squish');
  });
  el.addEventListener('animationend', e => { if (e.animationName === 'squish') el.classList.remove('squish'); });
}

// ---------- the speed score: the centre of Features ----------
// Each launcher's score (0-100, higher is better) in four tests, drawn as smooth lines (ours solid white, the others
// dotted greys, each named at its line's end), with the overall score board on the left. SVG at real pixel size,
// redrawn on resize; nothing in the SVG animates. When Features opens, a panel slides off the lines (transform only),
// the board's bars grow (transform) and the big score counts up. Hovering shows a guide and every score for a test.
// PLACEHOLDER NUMBERS: replace with the real test before publishing (and keep "Sample data" until then).
{
  const card = $('.score'), view = $('#v-features');
  const TESTS = ['Opens', 'Starts Minecraft', 'Installs a modpack', 'Memory use'];
  const L8 = [
    { name: 'Five Launcher', me: true, s: [97, 93, 95, 92] },
    { name: 'Prism Launcher', s: [78, 74, 69, 81] },
    { name: 'Modrinth App', s: [56, 68, 61, 47] },
    { name: 'CurseForge', s: [43, 57, 50, 36] },
  ];
  if (card && view) {
    const overall = l => Math.round(l.s.reduce((a, v) => a + v, 0) / l.s.length);
    const plot = $('.g-plot', card), tag = $('.g-x', card), board = $('.sc-board', card), big = $('[data-score]', card);
    const ranked = [...L8].sort((a, b) => overall(b) - overall(a));
    board.innerHTML = ranked.map((l, i) => `<li class="${l.me ? 'me' : ''}"><span class="r">${i + 1}</span><span class="n">${l.name}</span><span class="bar"><i data-w="${overall(l)}"></i></span><b>${overall(l)}</b></li>`).join('');
    $$('.bar i', board).forEach(i => { i.style.width = `${i.dataset.w}%`; });   // set from script: the CSP blocks style attributes in markup
    const mine = overall(L8[0]), rest = L8.slice(1).map(overall), avgOthers = rest.reduce((a, v) => a + v, 0) / rest.length;
    tag.textContent = `${Math.round(mine - avgOthers)} points ahead on average`;
    const NS = 'http://www.w3.org/2000/svg';
    const back = document.createElementNS(NS, 'svg'), lines = document.createElementNS(NS, 'svg');
    back.setAttribute('class', 'g-back'); lines.setAttribute('class', 'g-lines');
    const cover = document.createElement('span'); cover.className = 'g-cover';
    const guide = document.createElement('span'); guide.className = 'g-guide';
    const tip = document.createElement('div'); tip.className = 'g-tip';
    plot.append(lines, cover, back, guide, tip);
    let geo = null;
    const smooth = pts => pts.map((p, i) => {
      if (!i) return `M${p[0]},${p[1]}`;
      const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p3 = pts[i + 1] || p, k = .2;
      const c1 = [p1[0] + (p[0] - p0[0]) * k, p1[1] + (p[1] - p0[1]) * k], c2 = [p[0] - (p3[0] - p1[0]) * k, p[1] - (p3[1] - p1[1]) * k];
      return `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    }).join('');
    function draw() {
      const W = plot.clientWidth, H = plot.clientHeight; if (!W || !H) return;
      const Lm = 40, R = 128, Tp = 12, B = 30, n = TESTS.length;
      const x = i => Lm + 30 + (W - Lm - R - 60) * i / (n - 1), y = v => Tp + (H - Tp - B) * (1 - v / 100);
      geo = { x, y, n, W };
      for (const s of [back, lines]) { s.setAttribute('width', W); s.setAttribute('height', H); s.setAttribute('viewBox', `0 0 ${W} ${H}`); }
      let g = '';
      for (let v = 0; v <= 100; v += 20) { const yy = y(v).toFixed(1); g += `<line class="gl" x1="${Lm}" x2="${W - R + 30}" y1="${yy}" y2="${yy}"/><text class="yl" x="${Lm - 10}" y="${yy}">${v}</text>`; }
      for (let i = 0; i < n; i++) { const xx = x(i).toFixed(1); g += `<line class="gv" x1="${xx}" x2="${xx}" y1="${Tp}" y2="${H - B}"/><text class="xl" x="${xx}" y="${H - 8}">${TESTS[i]}</text>`; }
      back.innerHTML = g;
      // others first (under), ours last (on top); each line is named at its end, nudged apart so names never overlap
      const order = [...L8].reverse();
      let ends = order.map(l => ({ l, y: y(l.s[n - 1]) })).sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
      lines.innerHTML = order.map((l, k) => {
        const cls = l.me ? 'l-me' : `l-them t${k}`, pts = l.s.map((v, i) => [x(i), y(v)]);
        const end = ends.find(e => e.l === l);
        return `<path class="${cls}" d="${smooth(pts)}"/>` + pts.map(p => `<circle class="${l.me ? 'l-me-dot' : 'l-them-dot'}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${l.me ? 5.5 : 4}"/>`).join('')
          + `<text class="end${l.me ? ' me' : ''}" x="${(x(n - 1) + 14).toFixed(1)}" y="${end.y.toFixed(1)}">${l.name}</text>`;
      }).join('');
      cover.style.left = `${Lm - 6}px`;
      plot.setAttribute('aria-label', `Scores per test, sample data. ${L8.map(l => `${l.name}: ${l.s.join(', ')}`).join('. ')}.`);
    }
    new ResizeObserver(draw).observe(plot);
    plot.addEventListener('pointermove', e => {
      if (!geo) return;
      const r = plot.getBoundingClientRect(), px = e.clientX - r.left;
      let i = 0; for (let k = 1; k < geo.n; k++) if (Math.abs(geo.x(k) - px) < Math.abs(geo.x(i) - px)) i = k;
      const xx = geo.x(i);
      guide.style.transform = `translateX(${xx.toFixed(1)}px)`;
      tip.innerHTML = `<b>${TESTS[i]}</b>` + ranked.map(l => `<span class="${l.me ? 'me' : 'them'}"><i></i>${l.name}<em>${l.s[i]}</em></span>`).join('');
      const tw = tip.offsetWidth, tx = xx + 16 + tw > geo.W ? xx - 16 - tw : xx + 16;
      tip.style.transform = `translate(${tx.toFixed(1)}px, 6px)`;
      card.classList.add('hover');
    });
    plot.addEventListener('pointerleave', () => card.classList.remove('hover'));
    // the big score counts up
    let run = 0;
    const count = () => {
      const t0 = performance.now(), me = ++run;
      const tick = now => {
        if (me !== run) return;
        const p = Math.min(1, Math.max(0, (now - t0 - 200) / 1200)), e = 1 - Math.pow(1 - p, 3);
        big.textContent = String(Math.round(mine * e));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    let shown = false;
    const check = () => {
      const on = !view.hidden && !view.classList.contains('leaving');
      if (on === shown) return; shown = on;
      if (!on) { run++; card.classList.remove('go'); return; }
      draw();
      if (still) { card.classList.add('go'); big.textContent = String(mine); return; }
      setTimeout(() => { if (shown) { card.classList.remove('go'); void card.offsetWidth; card.classList.add('go'); count(); } }, 380);
    };
    new MutationObserver(check).observe(view, { attributes: true, attributeFilter: ['hidden', 'class'] });
    draw(); check();
  }
}
