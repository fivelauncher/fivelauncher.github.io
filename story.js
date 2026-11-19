// The launcher story on Home: a 20-second motion graphic that tours Five Launcher's features, driven by a 3D cursor
// (the story itself is described at the top of assets/story/fmotion.js). Older notes below:
//   the F forms from a drop, presses Install and pushes the bar to 100%, grabs the installer and pulls it into the app,
//   then: sign in with Microsoft, import a Modrinth pack (or make your own), set a skin, a banner, a logo and a name,
//   add mods from Discover, Play fills to 100%, the F comes in slowly, Play glows, it's pressed, it blasts, everything
//   cuts to black, and the energy pulls back into the F (the loop).
//
// This file is the small part: the clock, pause / resume, and the choice between the live story and a still picture.
// The story itself is assets/story/fmotion.js (three.js, one WebGL canvas, everything drawn by code), and it is only
// downloaded when it will run: a real GPU, not lite mode, not ?still, not reduced motion. Everyone else gets
// assets/story/still.webp. ?forcegl runs it on a software renderer too (for testing).
// It renders only while Home is on screen and the tab is visible, and starts from the top each time.
// ?story=<ms> draws exactly that moment and holds it; window.__story.seek(ms) / .play(fromMs) do the same from code.
// ?v3 brings back the previous story (assets/story/story3d.js, with its step pills), kept for comparison.
const q = new URLSearchParams(location.search);
const host = document.querySelector('.stage-bg .story');
const home = document.querySelector('#v-home');
const stillMode = q.has('still') || document.documentElement.classList.contains('lite');
const V3 = q.has('v3');
let T = 20000; const BEATS = [0, 2150, 5300, 7900, 10250, 13250, 15500, 19450];
const CAPS = V3 ? ['Install', 'Sign in with Microsoft', 'Import a Modrinth pack or make your own', 'Set your skin', 'A banner, a logo and a name', 'Add mods from Discover', 'Press Play'] : [];

// which kind of WebGL is here: none, a software one (too slow for this), or a real GPU
function gpu() {
  try {
    const g = document.createElement('canvas').getContext('webgl2'); if (!g) return null;
    const d = g.getExtension('WEBGL_debug_renderer_info'), name = d ? String(g.getParameter(d.UNMASKED_RENDERER_WEBGL)) : '';
    g.getExtension('WEBGL_lose_context')?.loseContext();
    return { software: /swiftshader|llvmpipe|software|basic render/i.test(name) };
  } catch { return null; }
}

if (host) {
  host.setAttribute('role', 'img');
  host.setAttribute('aria-label', 'A 20 second tour of Five Launcher: it is poured out of a drop of liquid, a mod installs in one click with its dependencies, all four loaders are built in, a 3D player turns and takes a new skin, settings follow you across instances, a modpack file is dropped in, the launcher updates itself, then Play.');
  host.innerHTML = `<canvas class="gl"></canvas><img class="still" alt="" hidden>
    ${CAPS.map((c, i) => `<div class="cap"><b>${i + 1}</b><span>${c}</span></div>`).join('')}
    ${V3 ? `<div class="ticks">${'<i><u></u></i>'.repeat(7)}</div>` : ''}`;
  const canvas = host.querySelector('canvas'), caps = [...host.querySelectorAll('.cap')], ticks = [...host.querySelectorAll('.ticks u')];
  let beat = -2;
  const tickAt = [];
  function ui(t) {   // (old story only) the caption pill for this step, and the seven ticks
    if (!V3) return;
    let b = -1; for (let i = 0; i < 7; i++) if (t >= BEATS[i] + 60 && t < BEATS[i + 1] - 60) b = i;
    if (b !== beat) { beat = b; caps.forEach((c, i) => c.classList.toggle('on', i === b)); }
    ticks.forEach((u, i) => { const v = t >= 19700 ? 0 : Math.round(Math.min(1, Math.max(0, (t - BEATS[i]) / (BEATS[i + 1] - BEATS[i]))) * 50) / 50; if (v !== tickAt[i]) { tickAt[i] = v; u.style.transform = `scaleX(${v})`; } });
  }
  function still() {
    host.classList.add('still-shot'); canvas.hidden = true;
    const img = host.querySelector('.still'); img.src = V3 ? 'assets/story/still.webp?v=5' : 'assets/story/fstill.webp?v=4'; img.hidden = false;
    ui(16250);
  }

  let s3 = null, raf = 0, live = false, frozen = false, start = 0, from0 = 0, pending = q.has('story') ? Math.max(0, Math.min(59999, +q.get('story') || 0)) : null;
  // At most ~120 story frames a second, evenly paced (Nov 19 2026): on a 360 Hz screen the story drew 360 times a
  // second, so the GPU had no room left and any other load (a game, a render) made the whole page stutter.
  // `every` = how many screen refreshes each story frame stays up: 1 at 60-144 Hz, 2 at 240 Hz, 3 at 360 Hz.
  let lastNow = 0, gap = 16.7, every = 1, n = 0;
  const frame = now => {
    raf = requestAnimationFrame(frame);
    if (lastNow) { gap += (Math.min(50, now - lastNow) - gap) * .05; every = Math.max(1, Math.round(8.33 / gap)); }
    lastNow = now;
    if (++n < every) return; n = 0;
    const t = (((now - start) % T) + T) % T; s3.render(t); ui(t);
  };
  const shouldRun = () => !home.hidden && !document.hidden;
  function sync() {
    if (!s3 || frozen) return;
    const on = shouldRun();
    if (on === live) return;
    live = on; cancelAnimationFrame(raf);
    if (on) { start = performance.now() - from0; from0 = 0; raf = requestAnimationFrame(frame); }
  }
  function seek(t) { if (!s3) { pending = t; return; } cancelAnimationFrame(raf); live = false; frozen = true; pending = t; s3.render(t); ui(t); }
  window.__story = { T, seek, play: (from = 0) => { cancelAnimationFrame(raf); frozen = false; live = false; pending = null; from0 = from; sync(); }, ready: false };

  const g = stillMode ? null : gpu();
  if (!g || (g.software && !q.has('forcegl'))) still();
  else import(V3 ? './assets/story/story3d.js?v=5' : './assets/story/fmotion.js?v=6').then(m => m.create(canvas, { software: g.software })).then(s => {
    const fit = () => { if (!host.clientWidth) return; s.resize(host.clientWidth, host.clientHeight, devicePixelRatio); if (frozen && pending != null) s.render(pending); };
    fit(); s.warm(); fit(); new ResizeObserver(fit).observe(host);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); s3 = null; still(); });
    T = s.T || T; window.__story.T = T;
    s3 = s; window.__story.ready = true; window.__story.hooks = s.hooks; window.__story.canvas = canvas;
    if (pending != null) seek(pending);
    else { new MutationObserver(sync).observe(home, { attributes: true, attributeFilter: ['hidden'] }); document.addEventListener('visibilitychange', sync); sync(); }
  }).catch(e => { console.warn('story: 3D failed, showing the still', e); still(); });
}
