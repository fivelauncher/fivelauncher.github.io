// Drift: soft dust and a few out-of-focus bokeh discs rising slowly through the dark, in three depths.
// The mouse parts them gently and they parallax with it; the venom "sink" draws them in.
export function drift(canvas, mouse) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let W = 0, H = 0, dpr = 1, P = [];
  const sm = { x: 0, y: 0 };
  function make(p, top) {
    p.z = Math.random();
    p.bokeh = Math.random() < .06;
    p.r = p.bokeh ? 18 + Math.random() * 46 : .6 + p.z * 1.9;
    p.x = Math.random() * W; p.y = top ? H + p.r + Math.random() * 40 : Math.random() * H;
    p.vx = 0; p.vy = 0; p.ph = Math.random() * 6.28; p.tw = .5 + Math.random();
    return p;
  }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(420, Math.max(160, W * H / 5200)));
    P = Array.from({ length: n }, () => make({}, false));
  }
  resize(); addEventListener('resize', resize);
  return {
    destroy() { removeEventListener('resize', resize); },
    step(t, dt, scroll, sink) {
      dt = Math.min(dt, 1 / 30);
      ctx.fillStyle = '#0e0e10'; ctx.fillRect(0, 0, W, H);
      sm.x += ((mouse.on ? mouse.x / W - .5 : 0) - sm.x) * Math.min(1, dt * 2);
      sm.y += ((mouse.on ? mouse.y / H - .5 : 0) - sm.y) * Math.min(1, dt * 2);
      const R = 160;
      for (const p of P) {
        const rise = 6 + p.z * 16;
        let fx = Math.sin(t * .3 * p.tw + p.ph) * 6, fy = -rise;
        if (mouse.on) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
          if (d < R) { const k = (1 - d / R) ** 2 * 140; fx += dx / (d + 1) * k; fy += dy / (d + 1) * k; }
        }
        if (sink && sink.k > .02) {
          const dx = sink.x - p.x, dy = sink.y - p.y, d = Math.hypot(dx, dy) + 40;
          const k = sink.k * 120 * Math.min(1, 300 / d); fx += dx / d * k; fy += dy / d * k;
        }
        p.vx += (fx - p.vx) * Math.min(1, dt * 1.5); p.vy += (fy - p.vy) * Math.min(1, dt * 1.5);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y < -p.r - 20 || p.x < -80 || p.x > W + 80) make(p, true);
        // parallax: nearer ones shift more with the mouse and the scroll
        const px = p.x - sm.x * 40 * p.z, py = p.y - sm.y * 26 * p.z - (scroll * .05 * p.z) % H;
        const yy = ((py % (H + 100)) + H + 100) % (H + 100) - 50;
        if (p.bokeh) {
          const g = ctx.createRadialGradient(px, yy, 0, px, yy, p.r);
          g.addColorStop(0, 'rgba(255,255,255,.055)'); g.addColorStop(.7, 'rgba(255,255,255,.03)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, yy, p.r, 0, 6.283); ctx.fill();
        } else {
          ctx.globalAlpha = (.18 + p.z * .55) * (.75 + .25 * Math.sin(t * 1.3 * p.tw + p.ph));
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, yy, p.r, 0, 6.283); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    },
  };
}
