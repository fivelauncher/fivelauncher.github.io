// Symbiote button. The button IS the goo: a glossy black pill drawn in a "goo" canvas (blur + alpha threshold +
// specular light, an SVG filter), so anything drawn near it melts into it.
//  - SENSE: the cursor comes near -> pseudopods ooze out and feel toward it.
//  - GRAB:  closer -> thick strands lunge (fast) and each one wraps a finger of the glove cursor; fine hairs follow.
//           The glove gets reeled toward the button.
//  - SNAP:  pull far enough away -> strands stretch, snap, and melt back; the pill wobbles and throws spikes.
// The real <a> stays underneath as the click / keyboard target; its look is drawn here.

const SENSE = 380, REACH = 250, RELEASE = 470, M = 520; // px from the button edge; M = canvas margin around it
const N = 16, INK = '#000';
const THICK = 7, HAIRS = 8;

// glove: hotspot (index fingertip) at 0,0, pointing up; anchors where strands wrap
const G = 1.6;
const ANCHORS = [[0, 6], [0, 14], [7, 17], [13, 19], [18, 22], [-4, 27], [7, 39]];

export function drawGlove(ctx, x, y, sq = 0, G = 1.6) {
    ctx.save(); ctx.translate(x, y); ctx.scale(G * (1 + sq * .06), G * (1 - sq * .05));
    // a pointing hand: index finger up on the LEFT edge, the other three curled into a fist stepping down to the right,
    // the thumb tucked across the front of the fist, a cuff at the wrist
    const shapes = g => {
      g.beginPath();
      g.roundRect(-4, 0, 8, 26, 4);          // index
      g.roundRect(-5, 17, 25, 20, 6);        // fist
      g.roundRect(3.5, 13.5, 7, 9, 3.5);     // curled fingers, stepping down
      g.roundRect(9.5, 15.5, 7, 9, 3.5);
      g.roundRect(15, 18.5, 6, 9, 3);
      g.roundRect(-6, 35, 27, 9, 3);         // cuff
    };
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4.2; shapes(ctx); ctx.stroke();
    ctx.fillStyle = '#fff'; shapes(ctx); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(10, 18); ctx.lineTo(10, 23); ctx.moveTo(15.5, 20.5); ctx.lineTo(15.5, 25);   // gaps between curled fingers
    ctx.moveTo(1, 37.5); ctx.lineTo(1, 41.5); ctx.moveTo(7.5, 37.5); ctx.lineTo(7.5, 41.5); ctx.moveTo(14, 37.5); ctx.lineTo(14, 41.5);
    ctx.stroke();
    // thumb over the front of the fist
    ctx.beginPath(); ctx.roundRect(-8.5, 24.5, 11.5, 6.5, 3.2);
    ctx.lineWidth = 2.2; ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
    ctx.restore();
  }


function svgFilter() {
  if (document.getElementById('goo-filter')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('width', '0'); s.setAttribute('height', '0'); s.style.position = 'absolute';
  s.innerHTML = `<filter id="goo-filter" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="b"/>
    <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 30 -13" result="g"/>
    <feGaussianBlur in="g" stdDeviation="4" result="gb"/>
    <feSpecularLighting in="gb" surfaceScale="7" specularConstant="1.25" specularExponent="34" lighting-color="#ffffff" result="sp">
      <feDistantLight azimuth="235" elevation="48"/>
    </feSpecularLighting>
    <feComposite in="sp" in2="g" operator="in" result="spi"/>
    <feComposite in="g" in2="spi" operator="arithmetic" k1="0" k2="1" k3=".85" k4="0"/>
  </filter>`;
  document.body.appendChild(s);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Rope {
  constructor(i, thick) {
    this.thick = thick;
    this.anchor = thick ? i % ANCHORS.length : Math.floor(Math.random() * ANCHORS.length);
    this.jit = thick ? [0, 0] : [(Math.random() - .5) * 6, (Math.random() - .5) * 6];
    this.w = thick ? 9 + Math.random() * 7 : 1.2 + Math.random() * .9;
    this.u = thick ? (i + .5) / THICK : Math.random();    // where along the button's cursor-facing side it roots
    this.ph = Math.random() * 6.28;
    this.feel = .38 + Math.random() * .3;
    this.delay = thick ? i * .035 : .05 + Math.random() * .15;
    this.p = Array.from({ length: N + 1 }, () => ({ x: 0, y: 0, ox: 0, oy: 0 }));
    this.len = 0; this.latch = 0; this.live = false;
  }
}

function makeButton(el) {
  const goo = document.createElement('canvas');
  goo.className = 'goo';
  document.body.appendChild(goo);
  const b = {
    el, goo, gx: goo.getContext('2d'), mode: 'idle', t: 0, pull: 0,
    wob: 0, wobV: 0, spikes: [], lean: 0,
    ropes: [...Array(THICK)].map((_, i) => new Rope(i, true)).concat([...Array(HAIRS)].map((_, i) => new Rope(i, false))),
    label: el.querySelector('span')?.textContent.trim() || el.textContent.trim(),
  };
  return b;
}

// point on the pill's outline at angle a (stadium), plus its outward normal
function stadium(r, a, grow = 0) {
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.height / 2 + grow, flat = r.width / 2 - r.height / 2;
  const dx = Math.cos(a), dy = Math.sin(a);
  let t = Math.abs(dy) > 1e-4 ? rad / Math.abs(dy) : Infinity;
  if (Math.abs(dx * t) <= flat) return [cx + dx * t, cy + dy * t, 0, Math.sign(dy)];
  const ox = Math.sign(dx) * flat, bq = -2 * dx * ox, c = ox * ox - rad * rad;
  t = (-bq + Math.sqrt(Math.max(0, bq * bq - 4 * c))) / 2;
  const x = dx * t, y = dy * t, nx = x - ox, ny = y, nl = Math.hypot(nx, ny) || 1;
  return [cx + x, cy + y, nx / nl, ny / nl];
}

export function venom(canvas, mouse, { blockers = [] } = {}) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  const resize = () => { dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
  resize(); addEventListener('resize', resize);
  const off = matchMedia('(prefers-reduced-motion: reduce)').matches;
  svgFilter();
  document.body.classList.add('venom');
  const buttons = [...document.querySelectorAll('[data-venom]')].map(makeButton);
  const cursor = { shown: false, over: null };

  addEventListener('click', e => {
    if (!cursor.shown || cursor.blocked || !cursor.over || e.target.closest('[data-venom]')) return;
    e.preventDefault(); cursor.over.el.click();
  }, true);

  // ---------- physics ----------
  function step(b, s, r, aim, gloveX, gloveY, h, T) {
    // root: spread along the side of the pill that faces the cursor
    const a = aim + (s.u - .5) * (s.thick ? 1.5 : 1.9);
    const [rx, ry] = stadium(r, a, -6);
    if (!s.live) { s.p.forEach(q => { q.x = q.ox = rx; q.y = q.oy = ry; }); s.live = true; s.len = 0; }
    const P = s.p;
    const on = b.t > s.delay;
    const [ax0, ay0] = ANCHORS[s.anchor];
    const tx = gloveX + (ax0 + s.jit[0]) * G, ty = gloveY + (ay0 + s.jit[1]) * G;
    const dist = Math.hypot(tx - rx, ty - ry);

    let want = 0, rate = 1800;
    if (b.mode === 'sense' && on) { want = dist * s.feel * (s.thick ? 1 : .6); rate = 500; }
    if (b.mode === 'grab' && on) { want = dist * 1.12 + 8; rate = 3600; }
    if (s.latch > .5 && b.mode === 'grab') want = dist * (s.thick ? 1.16 - .12 * b.pull : 1.03) + 6;
    s.len += clamp(want - s.len, -rate * h, rate * h);
    if (b.mode !== 'grab') s.latch = Math.max(0, s.latch - h * 20);

    // integrate
    const grav = s.thick ? 420 : 160, damp = .975;
    for (let k = 1; k <= N; k++) {
      const q = P[k], vx = (q.x - q.ox) * damp, vy = (q.y - q.oy) * damp;
      q.ox = q.x; q.oy = q.y;
      const wr = b.mode === 'sense' ? .45 : 1;
      let fx = Math.sin(T * 5.5 + k * .8 + s.ph) * 340 * wr, fy = grav * wr + Math.cos(T * 4.6 + k * .6 + s.ph) * 280 * wr;
      if (k === N && b.mode === 'sense') { // feel toward the cursor with a wandering tip
        const wx = rx + (tx - rx) * s.feel + Math.sin(T * 3 + s.ph) * 18, wy = ry + (ty - ry) * s.feel + Math.cos(T * 2.6 + s.ph) * 18;
        fx += (wx - q.x) * 1400; fy += (wy - q.y) * 1400;
      }
      q.x += vx + fx * h * h; q.y += vy + fy * h * h;
    }
    // lunge: the tip is thrown straight at its finger
    const lunging = b.mode === 'grab' && on && s.latch < .5;
    if (lunging) {
      const q = P[N], gx = tx - q.x, gy = ty - q.y, gd = Math.hypot(gx, gy) || 1, st = Math.min(gd, 3400 * h);
      q.x += gx / gd * st; q.y += gy / gd * st; q.ox = q.x; q.oy = q.y;
      s.len = Math.max(s.len, Math.hypot(q.x - rx, q.y - ry) * 1.1);
      if (gd < 9) s.latch = 1;
    }
    const seg = Math.max(.3, s.len / N), pinned = lunging || s.latch > .5;
    for (let it = 0; it < 10; it++) {
      P[0].x = rx; P[0].y = ry;
      if (s.latch > .5) { P[N].x = tx; P[N].y = ty; }
      for (let k = 0; k < N; k++) {
        const A = P[k], C = P[k + 1], dx = C.x - A.x, dy = C.y - A.y, d = Math.hypot(dx, dy) || 1e-3, df = (d - seg) / d;
        const wa = k === 0 ? 0 : 1, wc = (k + 1 === N && pinned) ? 0 : 1, sum = wa + wc || 1;
        A.x += dx * df * wa / sum; A.y += dy * df * wa / sum; C.x -= dx * df * wc / sum; C.y -= dy * df * wc / sum;
      }
    }
    if (b.mode !== 'grab' && b.mode !== 'sense' && s.len < .5) s.live = false;
  }

  // ---------- drawing ----------
  function drawPill(g, b, r, ox, oy, T, aim) {
    const pts = 72;
    g.beginPath();
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      let [x, y, nx, ny] = stadium(r, a);
      const flat = nx === 0 && ny === 0;
      if (flat) { nx = 0; ny = Math.sign(Math.sin(a)) || 1; }
      // lean toward the cursor, wobble, spikes
      const face = Math.max(0, Math.cos(a - aim));
      let d = b.lean * 10 * face ** 3 + b.wob * 5 * Math.sin(a * 3 + T * 18) + b.wob * 3 * Math.sin(a * 5 - T * 13);
      for (const sp of b.spikes) { const da = Math.atan2(Math.sin(a - sp.a), Math.cos(a - sp.a)); d += sp.amp * Math.exp(-((da / .07) ** 2)); }
      const X = x + nx * d - ox, Y = y + ny * d - oy;
      i ? g.lineTo(X, Y) : g.moveTo(X, Y);
    }
    g.closePath(); g.fill();
  }

  function drawRopeGoo(g, s, ox, oy) {
    const P = s.p;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < N; k++) {
      const t = k / N, stretch = clamp(1.4 - s.len / 520, .45, 1);
      g.lineWidth = (s.w * (1 - t * .5) + 7.5) * stretch;
      g.beginPath(); g.moveTo(P[k].x - ox, P[k].y - oy); g.lineTo(P[k + 1].x - ox, P[k + 1].y - oy); g.stroke();
    }
    // fat neck where it leaves the pill
    const r0 = s.w * 1.25 * clamp(s.len / 50, 0, 1);
    for (const k of [1, 2, 3]) { g.beginPath(); g.arc(P[k].x - ox, P[k].y - oy, r0 * (1 - k * .18), 0, 6.283); g.fill(); }
  }

  function drawHair(s, T) {
    const P = s.p;
    ctx.strokeStyle = 'rgba(0,0,0,.92)'; ctx.lineWidth = s.w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
    for (let k = 1; k < N; k++) ctx.quadraticCurveTo(P[k].x, P[k].y, (P[k].x + P[k + 1].x) / 2, (P[k].y + P[k + 1].y) / 2);
    ctx.lineTo(P[N].x, P[N].y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = .6; ctx.stroke();
  }

  function wraps(b, gx, gy) {
    ctx.strokeStyle = '#000'; ctx.lineCap = 'round';
    for (const s of b.ropes) {
      if (!s.thick || s.latch < .5) continue;
      const [ax, ay] = ANCHORS[s.anchor], x = gx + ax * G, y = gy + ay * G;
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.ellipse(x, y, 6.5 * G, 2.6 * G, -.15, 0, 6.283); ctx.stroke();
      ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.ellipse(x, y - 1, 5 * G, 1.6 * G, -.15, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
      ctx.strokeStyle = '#000';
    }
  }

  function label(b, r) {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const fs = r.height > 56 ? 18 : 16;
    ctx.font = `600 ${fs}px Fredoka, system-ui, sans-serif`;
    const tw = ctx.measureText(b.label).width, iw = 20, gap = 11, x0 = cx - (tw + iw + gap) / 2;
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, x0 + iw + gap, cy + 1);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ix = x0 + iw / 2, iy = cy;
    ctx.beginPath(); ctx.moveTo(ix, iy - 8); ctx.lineTo(ix, iy + 3); ctx.moveTo(ix - 4.5, iy - 1.5); ctx.lineTo(ix, iy + 3); ctx.lineTo(ix + 4.5, iy - 1.5);
    ctx.moveTo(ix - 7, iy + 8); ctx.lineTo(ix + 7, iy + 8); ctx.stroke();
  }

  return {
    sink: { x: 0, y: 0, k: 0 },
    step(T, dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const mx = mouse.x, my = mouse.y;
      let best = 0, gloveX = mx, gloveY = my, anyNear = false; cursor.over = null;
      // never hunt the cursor while it is over something interactive of its own (the live demo): let go at once
      const blocked = blockers.some(el => { const q = el.getBoundingClientRect(); return mx > q.left - 16 && mx < q.right + 16 && my > q.top - 16 && my < q.bottom + 16; });
      const sub = 3, h = Math.min(dt, .033) / sub;

      for (const b of buttons) {
        const r = b.el.getBoundingClientRect();
        const vis = r.bottom > -M && r.top < innerHeight + M && r.width > 0;
        b.goo.style.display = vis ? 'block' : 'none';
        if (!vis) { b.mode = 'idle'; b.ropes.forEach(s => { s.live = false; s.latch = 0; }); b.pull = 0; continue; }
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const qx = clamp(mx, r.left + r.height / 2, r.right - r.height / 2), qy = cy;
        const edge = Math.max(0, Math.hypot(mx - qx, my - qy) - r.height / 2);
        const inside = mx > r.left && mx < r.right && my > r.top && my < r.bottom;

        // state machine
        const prev = b.mode;
        if (off || !mouse.on || inside || blocked) b.mode = prev === 'grab' && !inside ? 'snap' : 'idle';
        else if (prev === 'grab') b.mode = edge > RELEASE ? 'snap' : 'grab';
        else if (edge < REACH) b.mode = 'grab';
        else if (edge < SENSE) b.mode = 'sense';
        else b.mode = prev === 'snap' ? 'snap' : 'idle';
        if (b.mode === 'snap' && prev === 'grab') {
          b.wobV += 9; // snap: wobble and throw spikes
          for (let i = 0; i < 6; i++) b.spikes.push({ a: Math.random() * 6.283, amp: 10 + Math.random() * 16 });
          b.ropes.forEach(s => { s.latch = 0; const q = s.p[N]; q.ox = q.x - (cx - q.x) * .02; q.oy = q.y - (cy - q.y) * .02; });
        }
        if (b.mode === 'snap' && b.ropes.every(s => !s.live)) b.mode = 'idle';
        b.t = (b.mode === 'grab' || b.mode === 'sense') && prev === b.mode ? b.t + dt : (b.mode === prev ? b.t : 0);
        if (b.mode !== prev && (b.mode === 'grab' || b.mode === 'sense')) b.t = 0;

        // springs: lean, wobble, spikes
        const lean = b.mode === 'grab' ? 1 : b.mode === 'sense' ? .5 : 0;
        b.lean += (lean - b.lean) * Math.min(1, dt * 6);
        b.wobV += (-b.wob * 160 - b.wobV * 9) * dt; b.wob += b.wobV * dt;
        b.spikes.forEach(s => s.amp *= Math.pow(.02, dt)); b.spikes = b.spikes.filter(s => s.amp > .5);

        // reel the glove toward the button while held
        const held = b.ropes.filter(s => s.thick).reduce((a, s) => a + s.latch, 0) / THICK;
        b.pull += (held - b.pull) * Math.min(1, dt * (held > b.pull ? 2.4 : 10));
        let gX = mx, gY = my;
        if (b.pull > .01) { gX = mx + (qx - mx) * b.pull * .42 + Math.sin(T * 37) * b.pull; gY = my + (qy - my) * b.pull * .42 + Math.cos(T * 31) * b.pull; }
        if (b.pull >= best) { best = b.pull; gloveX = gX; gloveY = gY; this.sink.x = cx; this.sink.y = cy; }
        if (b.mode !== 'idle' || b.pull > .01) anyNear = true;

        const aim = Math.atan2(gY - cy, (gX - cx) * .8);
        for (let i = 0; i < sub; i++) for (const s of b.ropes) if (b.mode !== 'idle' || s.live) step(b, s, r, aim, gX, gY, h, T + i * h);

        // goo canvas: covers the button plus a margin, in page pixels
        const ox = r.left - M, oy = r.top - M, W = Math.ceil(r.width + 2 * M), H = Math.ceil(r.height + 2 * M);
        if (b.goo.width !== W || b.goo.height !== H) { b.goo.width = W; b.goo.height = H; }
        b.goo.style.transform = `translate(${ox}px,${oy}px)`;
        const g = b.gx;
        g.clearRect(0, 0, W, H); g.fillStyle = INK; g.strokeStyle = INK;
        drawPill(g, b, r, ox, oy, T, aim);
        for (const s of b.ropes) if (s.thick && s.live && s.len > 1) drawRopeGoo(g, s, ox, oy);

        for (const s of b.ropes) if (!s.thick && s.live && s.len > 2) drawHair(s, T);
        label(b, r);
        b._glove = [gX, gY];
        const over = gX > r.left && gX < r.right && gY > r.top && gY < r.bottom && b.pull > .1;
        b.el.classList.toggle('hot', over);
        if (over) cursor.over = b;
      }
      this.sink.k = best;
      cursor.shown = mouse.on && anyNear && !off && !blocked; cursor.blocked = blocked;
      document.body.classList.toggle('grabbed', cursor.shown);
      if (cursor.shown) {
        const owner = buttons.find(b => b.pull === best && b._glove) || buttons[0];
        drawGlove(ctx, gloveX, gloveY, best, G);
        if (owner) wraps(owner, gloveX, gloveY);
      }
    },
  };
}
