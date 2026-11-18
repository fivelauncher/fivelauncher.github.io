// The story on Home: a 20-second motion graphic that tours what Five Launcher does, rebuilt from scratch (no screenshots).
//
// The story (each beat is one feature, and a white 3D cursor drives it):
//   open      a drop of liquid falls, splashes into a pool, and the launcher is poured out of it    "Minecraft, liquid smooth."
//   mods      Discover opens beside it like an open book; Install turns the mod's icon into liquid that flows
//             into an instance, its two dependencies follow, the count ticks up                       "One click, every mod"
//   loaders   four tiles (Fabric, Forge, NeoForge, Quilt) turn in; the cursor sweeps across them       "Every loader, built in"
//   skins     a stage lies flat like a floor; a real lit 3D player rises on it; the cursor spins them,
//             then drags a skin over: liquid paint runs down the player                               "Your skin, alive"
//   settings  three instances side by side; one toggle and one slider change, and a bead of liquid
//             carries the change to the others while the camera tracks along them                    "Settings follow you"
//   share     a .mrpack file is dragged in and dropped on the empty slot; it pours into a new instance  "Share packs in one drop"
//   update    an Update button appears; one click sends a liquid wave across the app; v0.3.4 -> 0.3.5  "Always up to date"
//   play      Play loads, the cursor comes in slowly, the press blasts, everything cuts to black, and the
//             energy pulls up into one drop, which falls to start the loop                            "Ready to play?"
//
// Colour is a black-and-white placeholder (Omar is making the palette): PAL below, and LIQ / LIQ2 in create().
// Panels are glass slabs: the front's edge comes from the slab's true rounded shape, light falls across it from the top
// left, a sheen grows at grazing angles, pieces float at their own heights with a soft and a contact shadow, and each
// slab is built from its outline first. One WebGL canvas; every frame is a pure function of time (render(t)).
// Omar: no popping. Things glide, flow and settle; only the Play press and the blast hit hard.
import * as THREE from '../three.module.min.js';

export const T = 30000;   // the loop on screen; the story itself runs on a 20 s clock that slows into each hook (see warp)
const ST = 20000;
const SW = 1470, SH = 1000;            // the stage, in stage pixels (y down)
const AW = 1040, AH = 660, SB = 84;    // the app window and its sidebar
const IW = 560, IH = 360;              // the installer window

// ---------- easing (no overshoot anywhere) ----------
const bez = (x1, y1, x2, y2) => p => {
  if (p <= 0) return 0; if (p >= 1) return 1;
  let u = p;
  for (let i = 0; i < 6; i++) { const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - p; const d = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2); if (Math.abs(d) < 1e-5) break; u = Math.min(1, Math.max(0, u - x / d)); }
  return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
};
const E = { lin: p => p, out: bez(.16, 1, .3, 1), in: bez(.7, 0, .84, 0), io: bez(.76, 0, .24, 1), sine: bez(.37, 0, .63, 1), soft: bez(.45, .05, .25, 1), glide: bez(.22, .8, .2, 1) };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, u) => a + (b - a) * u, rad = d => d * Math.PI / 180;
const seg = (t, a, b, e = E.io) => e(clamp((t - a) / (b - a), 0, 1));

// ---------- tweens on plain numbers ----------
const DEF = { s: 1, o: 1, zoom: 1, build: 1 };
const N = () => ({ p: {} });
function A(n, t0, dur, props, ease = E.out) {
  for (const k in props) { const v = props[k], list = n.p[k] || (n.p[k] = []), last = list[list.length - 1]; list.push({ t0, dur, a: Array.isArray(v) ? v[0] : (last ? last.b : (DEF[k] ?? 0)), b: Array.isArray(v) ? v[1] : v, e: ease }); }
}
const S = (n, t0, props) => A(n, t0, 0, props);
function val(n, k, time) {
  const list = n.p[k]; if (!list) return DEF[k] ?? 0;
  let w = null; for (let i = 0; i < list.length; i++) { if (list[i].t0 <= time) w = list[i]; else break; }
  if (!w) return list[0].a;
  if (!w.dur || time >= w.t0 + w.dur) return w.b;
  return w.a + (w.b - w.a) * w.e((time - w.t0) / w.dur);
}

// ---------- drawing kit (the app, rebuilt by hand) ----------
const FONT = 'Fredoka, system-ui, sans-serif';
// The palette. Black and white is a placeholder: change these (and LIQ / LIQ2 for the shaders) when the real one is ready.
const PAL = { accent: '#FFFFFF', accent2: '#CFCFD4', ink: '#0B0B0C', bg: '#0F0F11', card: '#161618', text: '#F4F4F5', muted: '#9A9AA3', dim: '#6B6B73', line: 'rgba(255,255,255,.09)',
  tint: 'rgba(255,255,255,', tiles: ['#F2F2F4', '#BDBDC3', '#8E8E96', '#D6D6DA', '#A6A6AD', '#E6E6E9'] };
const GOLD = PAL.accent, VIOLET = PAL.accent2, TEXT = PAL.text, MUTED = PAL.muted, DIM = PAL.dim, DARK = PAL.ink, BG = PAL.bg, CARD = PAL.card, LINE = PAL.line;
function R(g, x, y, w, h, r, fill, stroke, lw = 1) { g.beginPath(); g.roundRect(x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }
function Tx(g, str, x, y, size, color = TEXT, weight = 600, align = 'left') { g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(str, x, y); return g.measureText(str).width; }
function Ic(g, d, x, y, size, color, lw = 0) { g.save(); g.translate(x, y); g.scale(size / 24, size / 24); const p = new Path2D(d); if (lw) { g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(p); } else { g.fillStyle = color; g.fill(p); } g.restore(); }
const ICON = {
  home: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z', compass: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
  box: 'M4 7.5 12 3.5l8 4v9l-8 4-8-4zM4 7.5l8 4 8-4M12 11.5v9',
  shirt: 'M8.5 4 4 6.5l1.8 4 2.2-1V20h8V9.5l2.2 1 1.8-4L15.5 4c-.5 1.6-1.8 2.5-3.5 2.5S9 5.6 8.5 4z',
  gear: 'M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  plus: 'M12 5v14M5 12h14', check: 'M5 12.5 10 17.5 19 7', dl: 'M12 4v11M7 10.5l5 5 5-5M5 19.5h14', play: 'M7 4.5v15l13-7.5z',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16.2 16.2 20 20', chev: 'M9 5l7 7-7 7', min: 'M6 12h12', x: 'M7 7l10 10M17 7 7 17',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z', sparkle: 'M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z',
  leaf: 'M20 4C9 4 4 9 4 20c11 0 16-5 16-16z', drop: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z',
  moon: 'M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z', map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z',
};
// the brand F: three rounded bars in a 100-unit box centred on 0 (top bar, middle bar, stem), from five-F-black.png
const FB = [[-42.37, -50, 84.74, 28.77], [-42.37, -11.08, 60.99, 27.1], [-42.37, -50, 28.78, 100]];
function drawF(g, cx, cy, h, cols) { const s = h / 100, c = Array.isArray(cols) ? cols : [cols, cols, cols]; [2, 1, 0].forEach(i => { const [x, y, w, hh] = FB[i]; R(g, cx + x * s, cy + y * s, w * s, hh * s, 10.15 * s, c[i]); }); }
const goldGrad = (g, x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, PAL.accent); gr.addColorStop(1, PAL.accent2); return gr; };
function goldTile(g, x, y, s, r) { R(g, x, y, s, s, r, goldGrad(g, x, y, x + s, y + s)); }
const GOLDF = [PAL.accent, '#E4E4E8', '#C8C8CE'];

// a pixel face and a blocky player, drawn from scratch (our own character: dark hair, gold eyes)
const FACE = ['HHHHHHHH', 'HHHHHHHH', 'HSSSSSHH', 'SSSSSSSS', 'SWGSSGWS', 'SSSSSSSS', 'SSSMMSSS', 'SSSSSSSS'];
const FPAL = { H: '#1C1C20', S: '#C9C9CE', W: '#F4F4F5', G: '#FFFFFF', M: '#8A8A90' };
function pix(g, x, y, u, rows, pal) { rows.forEach((r, j) => [...r].forEach((ch, i) => { const c = pal[ch]; if (c) { g.fillStyle = c; g.fillRect(x + i * u, y + j * u, u + .6, u + .6); } })); }
function face(g, x, y, s) { g.save(); g.beginPath(); g.roundRect(x, y, s, s, s * .28); g.clip(); pix(g, x, y, s / 8, FACE, FPAL); g.restore(); }
const LOOKS = [
  { shirt: '#2E2E33', sleeve: 12, pants: '#1A1A1E', shoes: '#0E0E10' },
  { shirt: '#F4F4F6', sleeve: 12, pants: '#BDBDC3', shoes: '#1C1C20', stripe: '#1C1C20', strings: true },
  { shirt: '#8E8E96', sleeve: 4, pants: '#3A3A40', shoes: '#1B1B20' },
  { shirt: '#5A5A62', sleeve: 12, pants: '#2A2A30', shoes: '#F4F4F5' },
  { shirt: '#D6D6DA', sleeve: 4, pants: '#4A4A52', shoes: '#1B1B20' },
  { shirt: '#2A2A31', sleeve: 12, pants: '#18181C', shoes: '#FFFFFF', stripe: '#FFFFFF' },
];
function figure(g, x, y, u, L, full = true) {
  const box = (bx, by, bw, bh, c) => { g.fillStyle = c; g.fillRect(x + bx * u, y + by * u, bw * u + .6, bh * u + .6); };
  pix(g, x + 4 * u, y, u, FACE, FPAL);
  box(4, 8, 8, 12, L.shirt);
  if (L.stripe) box(4, 13, 8, 2, L.stripe);
  if (L.strings) { box(6, 8, 1, 4, TEXT); box(9, 8, 1, 4, TEXT); }
  [0, 12].forEach(ax => { box(ax, 8, 4, 12, FPAL.S); box(ax, 8, 4, L.sleeve, L.shirt); if (L.stripe && L.sleeve > 4) box(ax, 13, 4, 2, L.stripe); });
  if (full) { box(4, 20, 4, 12, L.pants); box(8, 20, 4, 12, L.pants); box(4, 30, 4, 2, L.shoes); box(8, 30, 4, 2, L.shoes); }
  g.fillStyle = 'rgba(0,0,0,.17)';
  [[8, 0, 4, 8], [8, 8, 4, 12], [2, 8, 2, 12], [14, 8, 2, 12]].concat(full ? [[6, 20, 2, 12], [10, 20, 2, 12]] : []).forEach(([a, b, c, d]) => g.fillRect(x + a * u, y + b * u, c * u, d * u));
}

// "Cozy Skies": a sunset with pixel clouds and stepped hills (banner, logo and thumbnails)
function sky(g, x, y, w, h, r, seed = 0) {
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, r); g.clip();
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#121214'); gr.addColorStop(.55, '#46464E'); gr.addColorStop(1, '#C9C9CF'); g.fillStyle = gr; g.fillRect(x, y, w, h);
  const sx = x + w * (.66 + seed * .12), sy = y + h * .68, sr = Math.min(w, h) * .19;
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.8); sg.addColorStop(0, 'rgba(255,255,255,.9)'); sg.addColorStop(.36, 'rgba(255,255,255,.35)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sg; g.fillRect(x, y, w, h);
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
  const q = Math.max(3, Math.round(Math.min(w, h) / 24));
  const cloud = (cx, cy, k) => { g.fillStyle = 'rgba(255,255,255,.9)'; [[0, 1, 7, 2], [1, 0, 4, 1], [2, -1, 2, 1], [5, 0, 1, 1]].forEach(([a, b, c, d]) => g.fillRect(cx + a * q * k, cy + b * q * k, c * q * k, d * q * k)); };
  cloud(x + w * (.1 + seed * .05), y + h * .26, 1); cloud(x + w * .44, y + h * .13, .8); if (w > h * 1.4) cloud(x + w * .8, y + h * .3, .7);
  const hill = (base, amp, col, ph) => { g.fillStyle = col; for (let i = 0; i < w; i += q * 2) { const hh = base + Math.round((Math.sin(i / w * 6.5 + ph) * .5 + .5) * amp / q) * q; g.fillRect(x + i, y + h - hh, q * 2 + 1, hh); } };
  hill(h * .22, h * .16, '#2C2C33', seed * 3 + 1); hill(h * .1, h * .12, '#111113', seed * 5 + 3);
  g.restore();
}
function pills(g, x, y, list, active = -1) { list.forEach((p, i) => { g.font = `600 14px ${FONT}`; const pw = g.measureText(p).width + 26; R(g, x, y, pw, 32, 16, i === active ? GOLD : '#222228', i === active ? null : LINE); Tx(g, p, x + 13, y + 21, 14, i === active ? DARK : '#C9C9D1', 600); x += pw + 8; }); }
function dashed(g, x, y, w, h, r) { g.save(); g.setLineDash([9, 8]); R(g, x + 1, y + 1, w - 2, h - 2, r, null, 'rgba(255,255,255,.2)', 2); g.restore(); }
function tile(g, x, y, s, c, ic) { R(g, x, y, s, s, s * .3, c); Ic(g, ICON[ic], x + s * .22, y + s * .22, s * .56, 'rgba(14,14,16,.88)'); }

// the app shell: sidebar with the F and four places, a title, the account once signed in
const NAV = [['home', 120], ['compass', 178], ['box', 236], ['shirt', 294]];
function shell(g, active, signed, title) {
  g.save(); g.beginPath(); g.roundRect(0, 0, AW, AH, 26); g.clip();
  g.fillStyle = BG; g.fillRect(0, 0, AW, AH);
  g.fillStyle = '#0B0B0E'; g.fillRect(0, 0, SB, AH);
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(SB, 0, 1, AH);
  g.restore();
  goldTile(g, 20, 20, 44, 13); drawF(g, 42, 42, 22, DARK);
  NAV.forEach(([ic, y], i) => { if (i === active) R(g, 18, y - 24, 48, 48, 14, 'rgba(255,255,255,.14)'); Ic(g, ICON[ic], 30, y - 12, 24, i === active ? GOLD : '#8C8C96', 1.9); });
  Ic(g, ICON.gear, 30, AH - 56, 24, '#5E5E68', 1.9);
  Tx(g, title, SB + 28, 52, 26, TEXT, 600);
  if (signed) { R(g, AW - 196, 18, 172, 44, 22, '#18181C', LINE); face(g, AW - 189, 25, 30); Tx(g, 'Player', AW - 150, 46, 17, TEXT, 600); g.beginPath(); g.arc(AW - 44, 40, 5, 0, 7); g.fillStyle = '#E8E8EA'; g.fill(); }
  R(g, .5, .5, AW - 1, AH - 1, 26, null, 'rgba(255,255,255,.1)');
}

// ---------- the screens ----------
function sInstaller(g, done) {
  R(g, 0, 0, IW, IH, 22, BG); R(g, .5, .5, IW - 1, IH - 1, 22, null, 'rgba(255,255,255,.1)');
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, 46, IW, 1);
  drawF(g, 30, 23, 16, GOLDF); Tx(g, 'Five Launcher Setup', 48, 29, 15, MUTED, 600);
  Ic(g, ICON.min, IW - 78, 11, 22, DIM, 2); Ic(g, ICON.x, IW - 42, 11, 22, DIM, 2);
  goldTile(g, 40, 76, 96, 26); drawF(g, 88, 124, 50, DARK);
  Tx(g, 'Install Five Launcher', 160, 118, 30, TEXT, 600);
  Tx(g, 'Version 0.3.4 · 14 MB · Windows', 160, 148, 16, MUTED, 500);
  if (done) { g.save(); g.translate(0, 210); instUI(g, 'd'); g.restore(); }
}
function instUI(g, k) {   // the lower part of the installer: bar, status, button ('r' ready, 'pNN' installing, 'd' done)
  const p = k === 'r' ? 0 : k === 'd' ? 1 : +k.slice(1) / 100;
  R(g, 40, 12, 480, 14, 7, '#232328');
  if (p > 0) R(g, 40, 12, Math.max(14, 480 * p), 14, 7, goldGrad(g, 40, 0, 520, 0));
  if (k === 'r') Tx(g, 'Ready to install', 40, 62, 16, MUTED, 500);
  else if (k === 'd') { g.beginPath(); g.arc(50, 56, 10, 0, 7); g.fillStyle = '#E8E8EA'; g.fill(); Ic(g, ICON.check, 42, 48, 16, DARK, 3); Tx(g, 'Installed. Opening Five', 68, 62, 16, TEXT, 600); }
  else { Tx(g, 'Installing', 40, 62, 16, TEXT, 600); Tx(g, Math.round(p * 100) + '%', 520, 62, 16, GOLD, 600, 'right'); }
  const on = k !== 'r' && k !== 'd';
  R(g, IW - 190, 82, 150, 48, 24, on ? '#1E1E23' : goldGrad(g, 0, 82, 0, 130), on ? LINE : null);
  Tx(g, k === 'r' ? 'Install' : k === 'd' ? 'Open' : 'Installing', IW - 115, 113, on ? 17 : 18, on ? '#8C8C96' : DARK, 600, 'center');
}
function sSignin(g) {
  shell(g, -1, false, 'Welcome');
  const cx = SB + (AW - SB) / 2;
  R(g, cx - 240, 116, 480, 430, 30, CARD, LINE);
  goldTile(g, cx - 38, 152, 76, 22); drawF(g, cx, 190, 40, DARK);
  Tx(g, 'Sign in to play', cx, 290, 34, TEXT, 600, 'center');
  Tx(g, 'Use your Microsoft account. It stays on your PC.', cx, 324, 16, MUTED, 500, 'center');
  R(g, cx - 206, 360, 412, 74, 37, '#FFFFFF');
  const lx = cx - 154, ly = 384; [['#F25022', 0, 0], ['#7FBA00', 14, 0], ['#00A4EF', 0, 14], ['#FFB900', 14, 14]].forEach(([c, a, b]) => { g.fillStyle = c; g.fillRect(lx + a, ly + b, 12, 12); });
  Tx(g, 'Sign in with Microsoft', lx + 42, 405, 22, '#1B1B1F', 600);
  Tx(g, 'No account yet? Try it offline first', cx, 488, 15, DIM, 500, 'center');
}
function bigCard(g, x, y, c, ic, t1, t2, list) {
  R(g, x, y, 400, 320, 26, CARD, LINE);
  R(g, x + 30, y + 30, 76, 76, 22, c); Ic(g, ICON[ic], x + 48, y + 48, 40, DARK, 2.6);
  Tx(g, t1, x + 30, y + 168, 28, TEXT, 600); Tx(g, t2, x + 30, y + 200, 17, MUTED, 500);
  pills(g, x + 30, y + 236, list);
  Ic(g, ICON.chev, x + 348, y + 268, 24, DIM, 2.2);
}
function sPack(g) {
  shell(g, 2, true, 'New instance');
  bigCard(g, 140, 128, GOLD, 'dl', 'Import a modpack', 'Bring a pack from Modrinth', ['Modrinth', '.mrpack']);
  bigCard(g, 584, 128, VIOLET, 'plus', 'Create your own', 'Pick a version and a loader', ['Fabric', 'Forge', 'Quilt']);
  Tx(g, 'Tip: drop a pack file anywhere to import it', 140, 500, 15, DIM, 500);
}
const ROWS = [['Swift Frames', 'bolt', PAL.tiles[0], '2.1 MB'], ['Leafy Breeze', 'leaf', PAL.tiles[1], '640 KB'], ['Clear Water', 'drop', PAL.tiles[2], '1.3 MB']];
function sPack2(g) {
  shell(g, 2, true, 'Importing a modpack');
  R(g, 112, 100, 896, 250, 26, CARD, LINE);
  sky(g, 138, 126, 198, 198, 24, .5);
  Tx(g, 'Cozy Skies', 362, 176, 40, TEXT, 600);
  Tx(g, 'A calm pack with soft skies', 362, 208, 18, MUTED, 500);
  pills(g, 362, 226, ['Fabric 1.21.4', '142 mods', 'from Modrinth']);
  Tx(g, 'Inside the pack', 112, 400, 17, MUTED, 600);
  ROWS.forEach(([n, ic, c, s], i) => { const y = 416 + i * 72; R(g, 112, y, 896, 60, 16, '#151519'); tile(g, 124, y + 10, 40, c, ic); Tx(g, n, 180, y + 37, 18, TEXT, 600); Tx(g, s, 990, y + 37, 15, DIM, 600, 'right'); });
}
function sSkin(g, sel, fig = true) {
  shell(g, 3, true, 'Skins');
  const st = g.createLinearGradient(0, 96, 0, 632); st.addColorStop(0, '#1C1830'); st.addColorStop(1, '#121216');
  R(g, 112, 96, 440, 536, 26, st, LINE);
  const fg = g.createRadialGradient(332, 548, 0, 332, 548, 190); fg.addColorStop(0, 'rgba(139,92,255,.38)'); fg.addColorStop(1, 'rgba(139,92,255,0)'); g.fillStyle = fg; g.fillRect(112, 380, 440, 252);
  g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.ellipse(332, 542, 112, 18, 0, 0, 7); g.fill();
  if (fig) figure(g, 332 - 96, 148, 12, LOOKS[sel]);
  Tx(g, 'Player', 332, 598, 18, TEXT, 600, 'center');
  Tx(g, 'Your skins', 590, 128, 22, TEXT, 600);
  LOOKS.forEach((l, i) => { const x = 590 + (i % 3) * 136, y = 148 + Math.floor(i / 3) * 160; R(g, x, y, 122, 146, 20, CARD, i === sel ? GOLD : LINE, i === sel ? 2.5 : 1); figure(g, x + 61 - 27, y + 18, 3.4, l); });
  R(g, 590, 482, 394, 54, 27, '#1D1D22', LINE); Ic(g, ICON.plus, 720, 497, 24, TEXT, 2.2); Tx(g, 'Upload a skin', 752, 516, 18, TEXT, 600);
  Tx(g, 'Drag a skin onto your player', 590, 576, 15, DIM, 500);
}
function sEdit(g, banner, logo) {
  shell(g, 2, true, 'Edit instance');
  if (banner) sky(g, 112, 96, 896, 220, 24, 0);
  else { R(g, 112, 96, 896, 220, 24, '#141418'); dashed(g, 112, 96, 896, 220, 24); Ic(g, ICON.plus, 544, 168, 32, DIM, 2.2); Tx(g, 'Add a banner', 560, 236, 17, DIM, 600, 'center'); }
  R(g, 132, 254, 136, 136, 34, BG);
  if (logo) sky(g, 140, 262, 120, 120, 28, .9);
  else { R(g, 140, 262, 120, 120, 28, '#141418'); dashed(g, 140, 262, 120, 120, 28); Ic(g, ICON.plus, 186, 308, 28, DIM, 2.2); }
  Tx(g, 'Name', 300, 352, 15, MUTED, 600);
  R(g, 300, 364, 560, 60, 18, '#1B1B20', LINE);
  pills(g, 300, 448, ['Fabric', '1.21.4', '142 mods', 'Java 21']);
  Tx(g, 'Memory', 300, 524, 15, MUTED, 600);
  R(g, 300, 540, 480, 10, 5, '#26262C'); R(g, 300, 540, 260, 10, 5, goldGrad(g, 300, 0, 560, 0));
  g.beginPath(); g.arc(560, 545, 11, 0, 7); g.fillStyle = TEXT; g.fill();
  Tx(g, '6 GB', 800, 551, 16, TEXT, 600);
}
const MODS = [['Swift Frames', 'Smoother frames, less lag', 'bolt', PAL.tiles[0], '2.4M'], ['Glow Shaders', 'Soft light and long shadows', 'sparkle', PAL.tiles[1], '1.1M'], ['Leafy Breeze', 'Leaves that sway in the wind', 'leaf', PAL.tiles[2], '860K'],
  ['Clear Water', 'Water you can see through', 'drop', PAL.tiles[3], '640K'], ['Night Sky', 'Stars, moons and comets', 'moon', PAL.tiles[4], '1.9M'], ['Mini Map', 'Never get lost again', 'map', PAL.tiles[5], '3.2M']];
const cardXY = i => [[112, 416, 720][i % 3], [164, 404][i / 3 | 0]];
function sDisc(g) {
  shell(g, 1, true, 'Discover');
  R(g, 112, 92, 540, 50, 25, '#1B1B20', LINE); Ic(g, ICON.search, 130, 105, 24, MUTED, 2); Tx(g, 'Search mods, shaders and packs', 166, 124, 16, DIM, 500);
  pills(g, 672, 101, ['Mods', 'Shaders', 'Packs'], 0);
  MODS.forEach(([n, d, ic, c, dl], i) => {
    const [x, y] = cardXY(i);
    R(g, x, y, 288, 216, 22, CARD, LINE); tile(g, x + 22, y + 22, 60, c, ic);
    g.beginPath(); g.arc(x + 248, y + 42, 20, 0, 7); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.stroke(); Ic(g, ICON.plus, x + 238, y + 32, 20, GOLD, 2.4);
    Tx(g, n, x + 22, y + 124, 22, TEXT, 600); Tx(g, d, x + 22, y + 152, 15, MUTED, 500);
    Ic(g, ICON.dl, x + 22, y + 174, 16, DIM, 2); Tx(g, dl + ' downloads', x + 44, y + 188, 14, DIM, 600);
  });
}
function sPlay(g) {
  shell(g, 0, true, 'Home');
  sky(g, 112, 92, 896, 300, 26, .2);
  g.save(); g.beginPath(); g.roundRect(112, 92, 896, 300, 26); g.clip(); const gr = g.createLinearGradient(0, 250, 0, 392); gr.addColorStop(0, 'rgba(17,17,20,0)'); gr.addColorStop(1, 'rgba(17,17,20,.6)'); g.fillStyle = gr; g.fillRect(112, 250, 896, 142); g.restore();
  R(g, 132, 328, 128, 128, 32, BG); sky(g, 140, 336, 112, 112, 26, .9);
  Tx(g, 'Cozy Skies', 280, 442, 44, TEXT, 600);
  Tx(g, 'Fabric 1.21.4 · 145 mods · Played today', 280, 476, 16, MUTED, 500);
  Tx(g, 'Screenshots', 112, 584, 15, MUTED, 600);
  for (let i = 0; i < 4; i++) sky(g, 112 + i * 228, 596, 212, 46, 12, i * .3);
}

function sSigned(g) {
  shell(g, -1, true, 'Welcome');
  const cx = SB + (AW - SB) / 2;
  R(g, cx - 240, 116, 480, 430, 30, CARD, LINE);
  const gl = g.createRadialGradient(cx, 214, 10, cx, 214, 120); gl.addColorStop(0, 'rgba(255,255,255,.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(cx - 160, 110, 320, 220);
  face(g, cx - 52, 162, 104);
  Tx(g, 'Welcome, Player', cx, 326, 32, TEXT, 600, 'center');
  g.beginPath(); g.arc(cx - 118, 372, 12, 0, 7); g.fillStyle = '#E8E8EA'; g.fill(); Ic(g, ICON.check, cx - 127, 363, 18, DARK, 3);
  Tx(g, 'Signed in with Microsoft', cx - 98, 379, 19, TEXT, 600);
  Tx(g, 'Your account stays on your PC', cx, 430, 15, DIM, 500, 'center');
}
function importCard(g) {
  R(g, 0, 0, 400, 320, 26, CARD); R(g, 1, 1, 398, 318, 26, null, 'rgba(255,255,255,.6)', 2);
  sky(g, 30, 30, 120, 120, 22, .5);
  Tx(g, 'Cozy Skies', 172, 76, 30, TEXT, 600); Tx(g, 'from Modrinth', 172, 104, 16, MUTED, 500);
  pills(g, 172, 118, ['Fabric 1.21.4', '142 mods']);
  Tx(g, 'Importing the pack', 30, 196, 16, MUTED, 600);
}
function playButton(g) {
  R(g, 0, 0, 256, 96, 48, goldGrad(g, 0, 0, 0, 96)); R(g, 1, 1, 254, 94, 47, null, 'rgba(255,255,255,.5)', 2);
  Ic(g, ICON.play, 70, 32, 34, DARK); Tx(g, 'Play', 114, 60, 32, DARK, 600);
}

// ---------- the feature story's screens (drawn by code, in the palette) ----------
const HOMECARDS = [['Cozy Skies', 'Fabric 1.21.4', '142 mods', .5], ['Survival Plus', 'NeoForge 1.21.1', '88 mods', .1], ['Speedrun', 'Fabric 1.21.4', '12 mods', .8],
  ['Creative Lab', 'Quilt 1.20.4', '40 mods', .3], ['Skyblock', 'Forge 1.20.1', '63 mods', .65]];
const homeXY = i => [[112, 416, 720][i % 3], [92, 372][i / 3 | 0]];
function instCard(g, x, y, [name, ver, mods, seed]) {
  R(g, x, y, 288, 260, 22, CARD); R(g, x + .5, y + .5, 287, 259, 22, null, LINE);
  sky(g, x + 10, y + 10, 268, 120, 16, seed);
  R(g, x + 16, y + 96, 68, 68, 19, BG); sky(g, x + 20, y + 100, 60, 60, 15, (seed + .4) % 1);
  Tx(g, name, x + 22, y + 192, 21, TEXT, 600);
  Tx(g, `${ver} · ${mods}`, x + 22, y + 218, 14, MUTED, 500);
  R(g, x + 206, y + 206, 64, 34, 17, '#232327', LINE); Ic(g, ICON.play, x + 228, y + 213, 20, TEXT);
}
function emptySlot(g, x, y) { R(g, x, y, 288, 260, 22, '#121214'); dashed(g, x, y, 288, 260, 22); Ic(g, ICON.plus, x + 128, y + 92, 32, DIM, 2.2); Tx(g, 'Drop a pack here', x + 144, y + 160, 16, DIM, 600, 'center'); }
function sHome(g, filled) {
  shell(g, 0, true, 'Instances');
  HOMECARDS.forEach((c, i) => { const [x, y] = homeXY(i); instCard(g, x, y, c); });
  const [x, y] = homeXY(5); if (filled) instCard(g, x, y, ['Lantern Days', 'Fabric 1.21.4', 'imported', .9]); else emptySlot(g, x, y);
}
function sDisc2(g) {
  shell(g, 1, true, 'Discover');
  R(g, 112, 92, 410, 50, 25, '#1B1B20', LINE); Ic(g, ICON.search, 130, 105, 24, MUTED, 2); Tx(g, 'Search', 166, 124, 16, DIM, 500);
  pills(g, 540, 101, ['Mods', 'Shaders', 'Resource packs', 'Modpacks'], 0);
  MODS.forEach(([n, d, ic, c, dl], i) => {
    const [x, y] = cardXY(i);
    R(g, x, y, 288, 216, 22, CARD); R(g, x + .5, y + .5, 287, 215, 22, null, LINE); tile(g, x + 22, y + 22, 60, c, ic);
    g.beginPath(); g.arc(x + 248, y + 42, 20, 0, 7); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.stroke(); Ic(g, ICON.plus, x + 238, y + 32, 20, TEXT, 2.4);
    Tx(g, n, x + 22, y + 124, 22, TEXT, 600); Tx(g, d, x + 22, y + 152, 15, MUTED, 500);
    Ic(g, ICON.dl, x + 22, y + 174, 16, DIM, 2); Tx(g, dl + ' downloads', x + 44, y + 188, 14, DIM, 600);
  });
}
const LOADERS = [['Fabric', 'weave'], ['Forge', 'anvil'], ['NeoForge', 'hex'], ['Quilt', 'patch']];
function loaderTile(g, name, kind) {   // abstract marks, not the loaders' logos
  R(g, 0, 0, 230, 300, 28, CARD); R(g, .75, .75, 228.5, 298.5, 28, null, 'rgba(255,255,255,.12)', 1.5);
  g.save(); g.translate(115, 118); g.fillStyle = PAL.accent; g.strokeStyle = PAL.accent; g.lineWidth = 6; g.lineJoin = 'round'; g.lineCap = 'round';
  if (kind === 'weave') { for (let i = -2; i <= 2; i++) { g.globalAlpha = 1; g.beginPath(); g.moveTo(-50, i * 22); g.lineTo(50, i * 22); g.stroke(); g.globalAlpha = .4; g.beginPath(); g.moveTo(i * 22, -50); g.lineTo(i * 22, 50); g.stroke(); } g.globalAlpha = 1; }
  else if (kind === 'anvil') { R(g, -58, -34, 116, 28, 9, PAL.accent); R(g, -20, -6, 40, 32, 6, PAL.accent); R(g, -46, 26, 92, 22, 7, PAL.accent); }
  else if (kind === 'hex') { const hex = r => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); }; hex(56); g.stroke(); hex(24); g.fill(); }
  else [[-50, -50], [4, -50], [-50, 4], [4, 4]].forEach(([x, y], i) => R(g, x, y, 46, 46, 11, i % 3 === 0 ? PAL.accent : 'rgba(255,255,255,.35)'));
  g.restore();
  Tx(g, name, 115, 236, 28, TEXT, 600, 'center'); Tx(g, 'built in', 115, 266, 15, MUTED, 500, 'center');
}
const SWXY = i => [[640, 806][i % 2], [148, 314, 480][i / 2 | 0]];
function sStage(g, swatches = true) {
  shell(g, 3, true, 'Skins');
  const fg = g.createRadialGradient(330, 380, 0, 330, 380, 270); fg.addColorStop(0, 'rgba(255,255,255,.10)'); fg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fg; g.fillRect(84, 96, 520, 560);
  for (let r = 70; r <= 230; r += 40) { g.beginPath(); g.arc(330, 380, r, 0, 7); g.strokeStyle = `rgba(255,255,255,${(.13 - r * .0004).toFixed(3)})`; g.lineWidth = 1.5; g.stroke(); }
  Tx(g, 'Drag to turn', 330, 640, 14, DIM, 600, 'center');
  Tx(g, 'Your skins', 640, 128, 22, TEXT, 600);
  if (swatches) LOOKS.forEach((l, i) => { const [x, y] = SWXY(i); R(g, x, y, 150, 150, 22, CARD, i === 0 ? PAL.accent : LINE, i === 0 ? 2 : 1); figure(g, x + 75 - 27, y + 18, 3.4, l); });
}
function sSettings(g, name, seed) {
  R(g, 0, 0, 520, 600, 26, BG); R(g, .5, .5, 519, 599, 26, null, 'rgba(255,255,255,.1)');
  sky(g, 16, 16, 488, 110, 18, seed);
  Tx(g, name, 28, 162, 24, TEXT, 600); Tx(g, 'Settings', 28, 186, 14, MUTED, 600);
  const row = (y, label) => { R(g, 16, y, 488, 64, 16, CARD); Tx(g, label, 36, y + 39, 17, TEXT, 600); };
  row(206, 'Smooth lighting'); row(282, 'Render distance');
  row(358, 'Hotbar'); for (let i = 0; i < 9; i++) R(g, 200 + i * 33, 374, 28, 32, 6, '#232327', LINE);
  row(434, 'Servers'); Tx(g, '3 saved', 484, 473, 16, MUTED, 600, 'right');
  Tx(g, 'Synced across your instances', 260, 560, 14, DIM, 600, 'center');
}
function fileCard(g) {
  R(g, 0, 0, 220, 280, 22, '#1B1B1F'); R(g, .75, .75, 218.5, 278.5, 22, null, 'rgba(255,255,255,.18)', 1.5);
  g.fillStyle = '#2E2E33'; g.beginPath(); g.moveTo(168, 1); g.lineTo(219, 52); g.lineTo(168, 52); g.closePath(); g.fill();
  sky(g, 24, 64, 172, 110, 16, .9);
  Tx(g, 'lantern-days', 24, 206, 19, TEXT, 600); Tx(g, '.mrpack', 24, 232, 17, MUTED, 600); Tx(g, '86 mods', 24, 260, 14, DIM, 600);
}

export async function create(canvas, { software = false } = {}) {
  await Promise.all([400, 500, 600].map(w => document.fonts.load(`${w} 30px Fredoka`).catch(() => 0)));

  // ---------- renderer, cameras, layers ----------
  THREE.ColorManagement.enabled = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !software, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = false; renderer.setClearColor(0x000000, 1);
  const D = (SH / 2) / Math.tan(rad(15));
  const camera = new THREE.PerspectiveCamera(30, SW / SH, 20, 40000), wcam = new THREE.PerspectiveCamera(30, SW / SH, 20, 9000);
  wcam.position.set(0, 0, D); wcam.lookAt(0, 0, 0);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.PlaneGeometry(2, 2), plane1 = new THREE.PlaneGeometry(1, 1);
  const scene = new THREE.Scene(), curScene = new THREE.Scene(), wordScene = new THREE.Scene(), bgScene = new THREE.Scene(), fxScene = new THREE.Scene();
  let Vw = SW, Vh = SH;
  const res = software ? 1 : 1.4;
  const v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  const LIQ = '1., 1., 1.', LIQ2 = '.62, .63, .68';   // the accent in the shaders (white for now) and its quieter partner

  function canvasTex(w, h, draw, r = res, mip = true) {
    const c = document.createElement('canvas'); c.width = Math.ceil(w * r); c.height = Math.ceil(h * r);
    const g = c.getContext('2d'); g.scale(r, r); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
    if (mip) { t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; } else { t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; }
    return t;
  }

  // ---------- 1 background: near-black, big soft rings of light at different depths, one fine ring, grain ----------
  const bgMat = new THREE.ShaderMaterial({
    uniforms: { view: { value: new THREE.Vector2(SW, SH) }, time: { value: 0 }, black: { value: 0 }, cam: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform vec2 view, cam; uniform float time, black; varying vec2 vUv;
      float ring(vec2 p, vec2 c, float r, float w){ float d = length(p - c) - r; return exp(-d * d / (w * w)); }
      void main(){
        vec2 p = vec2(735. + (vUv.x - .5) * view.x, 500. - (vUv.y - .5) * view.y);
        vec3 c = mix(vec3(.05, .05, .056), vec3(.016, .016, .02), vUv.y);
        vec2 q1 = p + cam * .55, q2 = p + cam * .3, q3 = p + cam * .8;
        c += vec3(${LIQ}) * .11 * ring(q1, vec2(120. + 60. * sin(time * .21), 980. + 30. * cos(time * .17)), 330., 70.);
        c += vec3(${LIQ2}) * .12 * ring(q2, vec2(1260. + 50. * cos(time * .19), 160.), 420., 110.);
        c += vec3(${LIQ2}) * .06 * exp(-length(q3 - vec2(1350., 880.)) / 380.);
        float d = abs(length(q1 - vec2(160. + 60. * sin(time * .21), 1010.)) - 520.);
        c += vec3(${LIQ}) * (exp(-d / 1.1) * .13 + exp(-d / 14.) * .03);
        c *= 1. - .35 * smoothstep(520., 1150., length(p - vec2(735., 500.)));
        c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) * .016;
        gl_FragColor = vec4(c * (1. - black), 1.);
      }`,
    depthTest: false, depthWrite: false,
  });
  bgScene.add(new THREE.Mesh(quad, bgMat));

  // ---------- 2 panels: glass slabs. The front's edge is drawn from the slab's true rounded shape (no cropped
  // borders), light falls across it from the top left, a sheen grows at grazing angles, and the slab is built from
  // its outline: the edge is drawn first, then the content sweeps in. A second texture can flow in (liquid wipe).
  const BF = 12;
  const slabVS = `uniform float jelly, skew, time;
    varying vec2 vP; varying vec3 vN; varying float vF, vB;
    void main(){
      vec3 p = position;
      vP = p.xy; vF = step(.9, normal.z); vB = step(normal.z, -.9);
      p.z += sin(p.x * .0065 + time * 5.) * sin(p.y * .008 - time * 3.) * jelly * 30.;
      p.x += p.y * skew;
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }`;
  const slabFS = `uniform sampler2D tA, tB; uniform vec2 size; uniform vec3 mixC; uniform float time, opacity, hot, build, outl, rad, inset, isFlat;
    varying vec2 vP; varying vec3 vN; varying float vF, vB;
    float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
    void main(){
      vec2 cap = size * .5 - inset;
      float sd = sdRR(vP, cap, rad);
      float fill = smoothstep(.62, 1., build);
      vec3 col; float a = 1.;
      if (vF > .5) {
        vec2 uv = vP / (cap * 2.) + .5;
        vec4 c = texture2D(tA, uv);
        if (mixC.z > 0.) {
          vec4 B = texture2D(tB, uv);
          vec2 lp = vec2(uv.x * size.x, (1. - uv.y) * size.y) - mixC.xy;
          float an = atan(lp.y, lp.x), L = length(lp);
          float wob = (sin(an * 5. + time * 3.) * .5 + sin(an * 9. - time * 4.3) * .3 + sin(an * 3. + 1.7 + time * 2.) * .4) * min(mixC.z, 220.) * .08;
          float m = mixC.z - L - wob;
          c = mix(c, B, smoothstep(-1.2, 1.2, m));
          float edge = smoothstep(0., 24., mixC.z);
          c.rgb += vec3(${LIQ}) * (exp(-abs(m) / 4.) * .9 + step(0., m) * exp(-m / 30.) * .16) * edge;
          c.rgb -= vec3(.06) * exp(-abs(m + 10.) / 8.) * edge;   // a little shadow just behind the liquid edge
        }
        if (outl > .5) {
          float lit = .5 + .5 * dot(normalize(vec2(-.6, .8)), vP / cap);
          c.rgb *= mix(.88, 1.07, lit);
          float fres = pow(1. - abs(normalize(vN).z), 2.);
          c.rgb += vec3(1.) * fres * .14;
          c.rgb += vec3(1.) * exp(-max(-sd, 0.) / 1.1) * .2 * mix(.5, 1., lit);
        }
        float sweep = clamp((build - .35) / .65, 0., 1.) * 1.25 - .12;
        float cm = smoothstep(sweep + .06, sweep - .06, uv.x * .55 + (1. - uv.y) * .45);
        float per = atan(vP.y * cap.x / cap.y, vP.x) / 6.2832 + .5;
        float line = exp(-abs(sd) / 1.3) * step(per, build / .35) * (1. - fill * .9) * outl;
        float aa = clamp(.5 - sd / max(fwidth(sd), .35), 0., 1.);
        float ca = isFlat > .5 ? c.a : aa;
        col = c.rgb * cm + vec3(${LIQ}) * line;
        a = max(ca * cm, line);
        if (a < .03) discard;
      } else {
        if (fill < .02 || vB > .5) discard;
        vec3 n = normalize(vN);
        float g = pow(max(dot(n, normalize(vec3(-.55, .75, .35))), 0.), 1.4);
        float v = pow(max(dot(n, normalize(vec3(.6, -.7, .3))), 0.), 1.4);
        col = vec3(.05, .05, .058) + vec3(${LIQ}) * g * (.36 + hot) + vec3(${LIQ2}) * v * .22;
        a = fill;
      }
      gl_FragColor = vec4(col, a * opacity);
    }`;
  function slabMat(tex, w, h) {
    return new THREE.ShaderMaterial({
      uniforms: { tA: { value: tex }, tB: { value: tex }, size: { value: new THREE.Vector2(w, h) }, mixC: { value: new THREE.Vector3(0, 0, -1) }, time: { value: 0 }, opacity: { value: 1 }, jelly: { value: 0 }, skew: { value: 0 }, hot: { value: 0 },
        build: { value: 1 }, outl: { value: 1 }, rad: { value: 0 }, inset: { value: 0 }, isFlat: { value: 0 } },
      vertexShader: slabVS, fragmentShader: slabFS, transparent: false,
    });
  }
  const BEV = 2;
  function slabGeo(w, h, r, depth) {
    const b = BEV, x = -w / 2 + b, y = -h / 2 + b, W = w - 2 * b, H = h - 2 * b, rr = Math.max(1, Math.min(r, W / 2, H / 2));
    const s = new THREE.Shape();
    s.moveTo(x + rr, y); s.lineTo(x + W - rr, y); s.absarc(x + W - rr, y + rr, rr, -Math.PI / 2, 0); s.lineTo(x + W, y + H - rr); s.absarc(x + W - rr, y + H - rr, rr, 0, Math.PI / 2);
    s.lineTo(x + rr, y + H); s.absarc(x + rr, y + H - rr, rr, Math.PI / 2, Math.PI); s.lineTo(x, y + rr); s.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5);
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 10 });
    return { geo, rr };
  }
  // soft shadows: a wide soft one and a tight contact one under each floating piece
  const shadowTex = canvasTex(160, 160, g => { g.filter = 'blur(14px)'; R(g, 30, 30, 100, 100, 18, 'rgba(0,0,0,1)'); }, 1, false);
  const contactTex = canvasTex(160, 160, g => { g.filter = 'blur(4px)'; R(g, 12, 12, 136, 136, 14, 'rgba(0,0,0,1)'); }, 1, false);
  const socket = (g, x, y, w, h, r) => { R(g, x, y, w, h, r, '#0C0C0E'); R(g, x + .5, y + .5, w - 1, h - 1, r, null, 'rgba(255,255,255,.12)'); };
  const inside = (q, p) => q !== p && q.z > p.z && !q.flat && q.x >= p.x && q.y >= p.y && q.x + q.w <= p.x + p.w && q.y + q.h <= p.y + p.h;

  const SCR = {};
  function screen(key, pose, life, w = AW, h = AH) {
    const g = new THREE.Group(), content = new THREE.Group(); g.add(content); scene.add(g);
    const sc = { key, g, content, n: N(), life, pieces: [], P: {}, w, h }; S(sc.n, 0, { s: 1, ...pose }); SCR[key] = sc; return sc;
  }
  function baseTex(full, rects, w = AW, h = AH) { return canvasTex(w, h, g => { full(g); rects.filter(p => !p.flat && !rects.some(q => inside(p, q))).forEach(p => socket(g, p.x, p.y, p.w, p.h, p.r)); }); }
  function base(sc, tex, r = 26) {
    const { geo, rr } = slabGeo(sc.w, sc.h, r, 10), mat = slabMat(tex, sc.w, sc.h); mat.uniforms.rad.value = rr; mat.uniforms.inset.value = BEV;
    const mesh = new THREE.Mesh(geo, mat);
    sc.content.add(mesh); const b = { mesh, mat, n: N(), w: sc.w, h: sc.h, base: true, sc, front: 12 };
    S(b.n, 0, { o: 0 }); sc.base = b; sc.pieces.push(b); return b;
  }
  function pieces(sc, full, rects) {
    for (const p of rects) {
      const holes = rects.filter(q => inside(q, p) && !rects.some(m => m !== p && inside(q, m) && inside(m, p)));
      const crop = (fn, withHoles) => canvasTex(p.w, p.h, g => { g.beginPath(); g.roundRect(0, 0, p.w, p.h, p.r || 0); g.clip(); g.translate(-p.x, -p.y); fn(g); if (withHoles) holes.forEach(q => socket(g, q.x, q.y, q.w, q.h, q.r)); }, p.res || res);
      const tex = p.draw ? canvasTex(p.w, p.h, p.draw, p.res || res) : crop(full, true);
      const alt = p.altDraw ? canvasTex(p.w, p.h, p.altDraw, p.res || res) : p.altFull ? crop(p.altFull, false) : null;
      const depth = p.depth ?? 8, mat = slabMat(tex, p.w, p.h);
      let geo;
      if (p.flat) { geo = new THREE.PlaneGeometry(p.w, p.h); mat.uniforms.isFlat.value = 1; mat.uniforms.outl.value = 0; }
      else { const s = slabGeo(p.w, p.h, p.r, depth); geo = s.geo; mat.uniforms.rad.value = s.rr; mat.uniforms.inset.value = BEV; }
      const mesh = new THREE.Mesh(geo, mat), front = p.flat ? 0 : depth + BEV;
      mesh.position.set(p.x + p.w / 2 - sc.w / 2, sc.h / 2 - (p.y + p.h / 2), BF + p.z - front);
      sc.content.add(mesh);
      const parent = rects.filter(q => inside(p, q)).sort((a, b) => b.z - a.z)[0];
      const under = parent ? parent.z : (sc.base ? 0 : -9999);
      let sh = null, ct = null;
      if (!p.flat && under > -9999) { sh = new THREE.Mesh(plane1, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); ct = new THREE.Mesh(plane1, new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false })); sc.content.add(sh); sc.content.add(ct); }
      const piece = { ...p, mesh, mat, tex, alt, front, sh, ct, under, rest: mesh.position.clone(), n: N(), sc };
      S(piece.n, 0, { o: 0, s: 1 }); sc.pieces.push(piece); sc.P[p.id] = piece;
    }
  }
  function arrive(sc, t0, gap = 80, list = sc.pieces) {
    list.forEach((p, i) => {
      if (p.base) { S(p.n, t0, { o: 1 }); A(p.n, t0, 950, { build: [0, 1] }, E.sine); A(p.n, t0, 1100, { lift: [-160, 0], rx: [8, 0] }, E.out); return; }
      const t = t0 + 380 + i * gap; S(p.n, t, { o: 1 }); A(p.n, t, 700, { build: [0, 1] }, E.sine); A(p.n, t, 900, { lift: [110, 0], dy: [-24, 0] }, E.out);
    });
  }
  const tap = (p, t, k = 8) => { A(p.n, t - 90, 90, { lift: -k }, E.in); A(p.n, t, 420, { lift: 0 }, E.out); };
  const WIPES = [];
  const wipe = (p, t0, dur, from, to, lx, ly) => WIPES.push({ p, t0, dur, from, to, uv: [lx, ly] });
  const OVS = [];
  function ov(p, lx, ly, w, h, draw, { r = 1.8, add = false, z = 1.2, key = 'a' } = {}) {
    const c = document.createElement('canvas'); c.width = Math.ceil(w * r); c.height = Math.ceil(h * r);
    const g = c.getContext('2d'), t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    const o = new THREE.Mesh(plane1, mat); o.scale.set(w, h, 1);
    o.position.set(lx - p.w / 2, p.h / 2 - ly, p.front + z); p.mesh.add(o);
    const n = { o, mat, t, p: {}, host: p, key: undefined };
    n.set = k => { if (k === n.key) return; n.key = k; g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, w, h); draw(g, k, w, h); t.needsUpdate = true; };
    S(n, 0, { o: 0 }); n.set(key); OVS.push(n); return n;
  }
  const show = (n, t0, t1, fin = 160, fout = 160) => { A(n, t0, fin, { o: 1 }, E.lin); A(n, t1, fout, { o: 0 }, E.lin); };

  // ================= the world: screens placed in space =================
  const BLAST = 18780;
  // home: the launcher (instances); it comes back for sharing and updating
  const home = screen('home', { x: 0, y: 0, z: 0, ry: 18 }, [[800, 4800], [12200, 16500]]);
  const homeRects = [...HOMECARDS.map((c, i) => { const [x, y] = homeXY(i); return { id: 'c' + i, x, y, w: 288, h: 260, r: 22, z: 22 }; }), { id: 'slot', x: homeXY(5)[0], y: homeXY(5)[1], w: 288, h: 260, r: 22, z: 22, altFull: g => sHome(g, true) }];
  const homeFull = g => sHome(g, false), homeTex = baseTex(homeFull, homeRects);
  base(home, homeTex); pieces(home, homeFull, homeRects);
  // Discover, facing home like an open book
  const disc = screen('disc', { x: 1230, y: 0, z: -140, ry: -22 }, [[1800, 4800]]);
  const discRects = [{ id: 'search', x: 112, y: 92, w: 410, h: 50, r: 25, z: 16 }, ...MODS.map((m, i) => { const [x, y] = cardXY(i); return { id: 'm' + i, x, y, w: 288, h: 216, r: 22, z: 24 }; }),
    { id: 'ic0', x: 134, y: 186, w: 60, h: 60, r: 18, z: 52 }];
  base(disc, baseTex(sDisc2, discRects)); pieces(disc, sDisc2, discRects);
  // the four loaders: free-standing tiles in a row
  const load = screen('load', { x: -1900, y: -40, z: 260, ry: 20 }, [[4500, 6700]]);
  pieces(load, null, LOADERS.map(([n, k], i) => ({ id: 'l' + i, x: 520 - 500 + i * 250, y: 180, w: 230, h: 300, r: 28, z: 0, depth: 14, draw: g => loaderTile(g, n, k) })));
  // skins: a stage lying flat like a floor, with a real 3D player standing on it
  const skin = screen('skin', { x: -3950, y: -260, z: -80, rx: -90 }, [[6300, 9950]]);
  const skinRects = LOOKS.map((l, i) => { const [x, y] = SWXY(i); return { id: 'sw' + i, x, y, w: 150, h: 150, r: 22, z: 20 }; });
  base(skin, baseTex(g => sStage(g, true), skinRects)); pieces(skin, g => sStage(g, true), skinRects);
  // settings: three instances side by side
  const SETS = [['Cozy Skies', .5], ['Survival Plus', .1], ['Speedrun', .8]];
  const sets = SETS.map(([name, seed], i) => { const sc = screen('set' + i, { x: -6260 + i * 640, y: 20, z: i === 1 ? -150 : 0, ry: 16 - i * 16 }, [[9650, 12550]], 520, 600); base(sc, canvasTex(520, 600, g => sSettings(g, name, seed))); return sc; });
  // the .mrpack file, dragged into home
  const file = screen('file', { x: -760, y: 40, z: 300, ry: 26, rz: -6 }, [[12400, 13900]], 220, 280);
  pieces(file, null, [{ id: 'f', x: 0, y: 0, w: 220, h: 280, r: 22, z: 0, depth: 12, draw: fileCard }]);
  // Play
  const play = screen('play', { x: 2750, y: 60, z: 260, ry: -12 }, [[16200, BLAST + 90]]);
  const playRects = [{ id: 'banner', x: 112, y: 92, w: 896, h: 300, r: 26, z: 22 }, { id: 'logo', x: 140, y: 336, w: 112, h: 112, r: 26, z: 56 }, { id: 'thumbs', x: 112, y: 594, w: 896, h: 50, r: 12, z: 14 },
    { id: 'btn', x: 756, y: 408, w: 256, h: 96, r: 48, z: 70, depth: 16, draw: playButton, res: 2 }];
  base(play, baseTex(sPlay, playRects)); pieces(play, sPlay, playRects);

  // ---------- the 3D player (boxes with their own lighting; a liquid paint runs down it when the skin changes) ----------
  const faceTex = canvasTex(8, 8, g => pix(g, 0, 0, 1, FACE, FPAL), 1, false); faceTex.magFilter = THREE.NearestFilter; faceTex.minFilter = THREE.NearestFilter;
  const U = 11, PH = 32 * U;
  const playerMat = (cA, cB, oy, map = null) => new THREE.ShaderMaterial({
    uniforms: { cA: { value: new THREE.Color(cA) }, cB: { value: new THREE.Color(cB) }, paint: { value: 0 }, time: { value: 0 }, oy: { value: oy }, map: { value: map }, useMap: { value: map ? 1 : 0 }, opacity: { value: 1 }, top: { value: PH } },
    vertexShader: `uniform float oy; varying vec3 vN, vV; varying float vH; varying vec2 vUv;
      void main(){ vUv = uv; vH = position.y + oy; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 cA, cB; uniform float paint, time, useMap, opacity, top; uniform sampler2D map; varying vec3 vN, vV; varying float vH; varying vec2 vUv;
      void main(){
        vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-.5, .75, .45));
        float dif = max(dot(n, L), 0.), fill = max(dot(n, normalize(vec3(.6, -.2, .5))), 0.) * .22, rim = pow(1. - max(dot(n, v), 0.), 3.);
        float edge = top + 12. - paint * (top + 80.) + sin(vUv.x * 12. + time * 2.) * 7. + sin(vUv.x * 29.) * 4.;
        float pm = smoothstep(edge - 1.5, edge + 1.5, vH);
        vec3 base = mix(cA, cB, pm);
        if (useMap > .5) base = texture2D(map, vUv).rgb;
        vec3 col = base * (.26 + .86 * dif + fill) + vec3(1.) * rim * .3 + vec3(1.) * pow(max(dot(reflect(-L, n), v), 0.), 24.) * .16;
        col += vec3(${LIQ}) * exp(-abs(vH - edge) / 4.) * .75 * step(.01, paint) * step(paint, .99) * (1. - useMap);
        gl_FragColor = vec4(col, opacity);
      }`,
  });
  const player = new THREE.Group(), spin = new THREE.Group(); player.add(spin);
  player.position.set(330 - AW / 2, AH / 2 - 380, BF + 2); player.rotation.x = Math.PI / 2; skin.content.add(player);
  const PMATS = [];
  const part = (w, h, d, x, y, cA, cB, head = false) => {
    const geo = new THREE.BoxGeometry(w * U, h * U, d * U);
    let mat;
    if (head) { const side = playerMat(cA, cA, y * U), front = playerMat(cA, cA, y * U, faceTex); mat = [side, side, side, side, front, side]; PMATS.push(side, front); }
    else { mat = playerMat(cA, cB, y * U); PMATS.push(mat); }
    const m = new THREE.Mesh(geo, mat); m.position.set(x * U, y * U, 0); spin.add(m);
  };
  // y = the part's centre, in pixels of a 32-tall player; (outfit before, outfit after)
  part(4, 12, 4, -2, 6, '#1A1A1E', '#BDBDC3'); part(4, 12, 4, 2, 6, '#1A1A1E', '#BDBDC3');
  part(8, 12, 4, 0, 18, '#2E2E33', '#F4F4F6'); part(4, 12, 4, -6, 18, '#2E2E33', '#F4F4F6'); part(4, 12, 4, 6, 18, '#2E2E33', '#F4F4F6');
  part(8, 8, 8, 0, 28, '#1C1C20', '#1C1C20', true);
  const pN = N(); S(pN, 0, { s: 0, spin: -.4, paint: 0 });

  // ================= the timeline =================
  // 0 OPEN: a drop of liquid falls, splashes into a pool, and the launcher is poured out of it
  arrive(home, 900);
  // 1 ONE CLICK, EVERY MOD: Discover opens beside it; Install turns the mod's icon into a drop that flows into an instance
  arrive(disc, 1950, 55);
  const ic0 = disc.P.ic0, cozy = home.P.c0;
  A(ic0.n, 3080, 200, { lift: 60, s: 1.12 }, E.out); A(ic0.n, 3260, 220, { s: 0 }, E.in);
  tap(disc.P.m0, 3050, 6);
  A(cozy.n, 4180, 120, { lift: 14 }, E.out); A(cozy.n, 4300, 500, { lift: 0 }, E.out);
  // 2 EVERY LOADER, BUILT IN: four tiles turn in, one after another; the cursor sweeps across them
  load.pieces.forEach((p, i) => { const t = 4950 + i * 110; S(p.n, t, { o: 1 }); A(p.n, t, 650, { build: [0, 1] }, E.sine); A(p.n, t, 900, { ry: [-95, 0], lift: [160, 0] }, E.out);
    const h = 5500 + i * 230; A(p.n, h, 200, { lift: 46 }, E.io); A(p.n, h + 260, 360, { lift: 0 }, E.io); });
  // 3 YOUR SKIN, ALIVE: the stage draws itself, the player rises and turns, a skin flows down over them
  arrive(skin, 6450, 60);
  A(pN, 6900, 700, { s: 1, spin: 0 }, E.out);
  A(pN, 7650, 900, { spin: Math.PI * 1.75 }, E.io); A(pN, 8550, 600, { spin: Math.PI * 2 }, E.out);
  A(pN, 9250, 650, { paint: 1 }, E.sine);
  tap(skin.P.sw1, 8850, 8);
  // 4 SETTINGS FOLLOW YOU: one toggle and one slider change, and a bead of liquid carries them to the others
  sets.forEach((sc, i) => arrive(sc, 9750 + i * 150));
  // 5 SHARE PACKS: a .mrpack file is dragged in and dropped on the empty slot; it pours into a new instance
  arrive(file, 12450);
  const slot = home.P.slot;
  // 6 UPDATES ITSELF: an Update button appears; one click sends a liquid wave across the app
  wipe(home.base, 15120, 900, homeTex, homeTex, 770, 40);
  home.pieces.filter(p => !p.base).forEach((p, i) => { const d = Math.hypot(p.x + p.w / 2 - 770, p.y + p.h / 2 - 40); wipe(p, 15120 + d * .9, 520, p.mat.uniforms.tA.value, p.mat.uniforms.tA.value, 770 - p.x, 40 - p.y); });
  wipe(slot, 13700, 600, slot.tex, slot.alt, 144, 130);
  // 7 PLAY
  arrive(play, 16300);
  const btn = play.P.btn;
  A(btn.n, 18250, 420, { lift: 34, s: 1.04 }, E.io); A(btn.n, 18670, 80, { lift: 8, s: .97 }, E.in);
  A(play.base.n, BLAST, 140, { s: 1.03 }, E.out);

  // the file's flight: it follows the cursor to the slot, then dives in
  const slotWorld = () => v3.set(slot.x + slot.w / 2 - AW / 2, AH / 2 - (slot.y + slot.h / 2), BF + 22 + 60).applyMatrix4(home.content.matrixWorld).clone();

  // overlays
  const cnt = ov(cozy, 152, 213, 260, 30, (g, k) => { R(g, 0, 0, 260, 30, 6, CARD); Tx(g, `Fabric 1.21.4 · ${k} mods`, 0, 20, 14, k === '142' ? MUTED : TEXT, k === '142' ? 500 : 600); }, { key: '142', z: .8 });
  S(cnt, 900, { o: 1 });
  cnt.upd = t => cnt.set(t < 4180 ? '142' : t < 4330 ? '143' : t < 4480 ? '144' : '145');
  const added = ov(disc.P.m0, 248, 42, 46, 46, g => { g.beginPath(); g.arc(23, 23, 21, 0, 7); g.fillStyle = PAL.accent; g.fill(); Ic(g, ICON.check, 11, 11, 24, PAL.ink, 3.2); }, { z: 1 });
  show(added, 3080, 6000, 200, 0);
  const deps = ov(disc.P.m0, 144, 196, 230, 34, g => { R(g, 1, 1, 228, 32, 16, 'rgba(255,255,255,.1)', 'rgba(255,255,255,.4)'); Tx(g, '+ 2 dependencies', 115, 22, 15, TEXT, 600, 'center'); }, { z: 1.4 });
  show(deps, 3500, 4600, 220, 260);
  const tog = (on) => (g) => { R(g, 0, 0, 64, 36, 18, on ? PAL.accent : '#2A2A2E'); g.beginPath(); g.arc(on ? 46 : 18, 18, 13, 0, 7); g.fillStyle = on ? PAL.ink : '#F4F4F5'; g.fill(); };
  const SET_ON = [10700, 11700, 12050];
  const SL = (t, i) => { const t0 = [11000, 11720, 12070][i]; return E.io(clamp((t - t0) / (i ? 300 : 360), 0, 1)); };
  sets.forEach((sc, i) => {
    const o1 = ov(sc.base, 444, 238, 64, 36, (g, k) => tog(k === '1')(g), { key: '0' }); S(o1, 9700, { o: 1 }); o1.upd = t => o1.set(t >= SET_ON[i] ? '1' : '0');
    const o2 = ov(sc.base, 360, 314, 260, 40, (g, k) => { const v = +k; R(g, 0, 17, 190, 6, 3, '#2A2A2E'); R(g, 0, 17, 190 * (v - 8) / 8 + 10, 6, 3, PAL.accent); g.beginPath(); g.arc(5 + 180 * (v - 8) / 8, 20, 11, 0, 7); g.fillStyle = '#F4F4F5'; g.fill(); Tx(g, `${v} chunks`, 260, 26, 15, v > 8 ? TEXT : MUTED, 600, 'right'); }, { key: '8' });
    S(o2, 9700, { o: 1 }); o2.upd = t => o2.set(String(Math.round(8 + 8 * SL(t, i))));
  });
  const upd = ov(home.base, 770, 40, 120, 40, g => { R(g, 0, 0, 120, 40, 20, PAL.accent); Ic(g, ICON.dl, 14, 9, 22, PAL.ink, 2.4); Tx(g, 'Update', 44, 27, 16, PAL.ink, 600); }, { z: 3 });
  A(upd, 14550, 260, { o: 1 }, E.lin); A(upd, 15200, 240, { o: 0 }, E.lin);
  const updGlow = ov(home.base, 770, 40, 260, 140, g => { const a = g.createRadialGradient(130, 70, 10, 130, 70, 120); a.addColorStop(0, 'rgba(255,255,255,.55)'); a.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = a; g.fillRect(0, 0, 260, 140); }, { add: true, r: 1, z: 2 });
  A(updGlow, 14600, 300, { o: .8 }, E.sine); A(updGlow, 14900, 300, { o: .35 }, E.sine); A(updGlow, 15100, 200, { o: 0 }, E.lin);
  const ver = ov(home.base, 310, 42, 150, 28, (g, k) => { R(g, 1, 1, 148, 26, 13, '#1B1B1F', k === '0.3.5' ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.12)'); if (k === '0.3.5') Ic(g, ICON.check, 10, 4, 18, TEXT, 2.6); Tx(g, 'v' + k, k === '0.3.5' ? 34 : 75, 19, 14, k === '0.3.5' ? TEXT : MUTED, 600, k === '0.3.5' ? 'left' : 'center'); }, { key: '0.3.4', z: 1 });
  S(ver, 900, { o: 1 }); ver.upd = t => ver.set(t >= 15420 ? '0.3.5' : '0.3.4');
  const drop = ov(home.base, 864, 502, 320, 290, g => { g.setLineDash([10, 8]); R(g, 6, 6, 308, 278, 26, 'rgba(255,255,255,.05)', 'rgba(255,255,255,.75)', 2); }, { z: 40 });
  A(drop, 13050, 250, { o: 1 }, E.lin); A(drop, 13650, 200, { o: 0 }, E.lin);
  const playGlow = ov(play.base, 884, 456, 560, 320, g => { const a = g.createRadialGradient(280, 160, 20, 280, 160, 270); a.addColorStop(0, 'rgba(255,255,255,.75)'); a.addColorStop(.45, 'rgba(255,255,255,.22)'); a.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = a; g.fillRect(0, 0, 560, 320); }, { add: true, r: 1, z: 30 });
  A(playGlow, 16900, 500, { o: .25 }, E.lin); A(playGlow, 18200, 500, { o: 1 }, E.sine); A(playGlow, BLAST, 60, { o: 0 }, E.lin);
  const launch = ov(play.base, 515, 528, 470, 54, (g, k) => { const p = +k / 100; Tx(g, p < 1 ? 'Getting Cozy Skies ready' : 'Ready', 0, 20, 16, p < 1 ? MUTED : TEXT, 600); Tx(g, k + '%', 470, 20, 16, TEXT, 600, 'right'); R(g, 0, 36, 470, 12, 6, '#26262C'); if (p > 0) R(g, 0, 36, Math.max(12, 470 * p), 12, 6, goldGrad(g, 0, 0, 470, 0)); }, { key: '0' });
  show(launch, 16900, BLAST, 200, 60);
  const launchP = t => E.sine(clamp((t - 17000) / 1000, 0, 1));
  launch.upd = t => launch.set(String(Math.round(launchP(t) * 100)));

  // ---------- poses ----------
  const SCRS = Object.values(SCR);
  const visible = (sc, t) => sc.life.some(([a, b]) => t >= a && t < b);
  function poseScreens(t) {
    for (const sc of SCRS) {
      const n = sc.n, s = val(n, 's', t);
      sc.g.visible = visible(sc, t);
      sc.g.position.set(val(n, 'x', t), val(n, 'y', t), val(n, 'z', t));
      sc.g.rotation.set(rad(val(n, 'rx', t)), rad(val(n, 'ry', t)), rad(val(n, 'rz', t)));
      sc.g.scale.set(s, s, s);
    }
    const ps = val(pN, 's', t); player.scale.set(ps, Math.max(.001, ps), ps); spin.rotation.y = val(pN, 'spin', t);
  }
  function posePieces(t) {
    for (const sc of SCRS) for (const p of sc.pieces) {
      const n = p.n, o = val(n, 'o', t);
      p.o = o; p.mesh.visible = o > .003 && sc.g.visible;
      const lift = val(n, 'lift', t), s = val(n, 's', t), dx = val(n, 'dx', t), dy = val(n, 'dy', t);
      if (p.base) p.mesh.position.set(dx, -dy, lift);
      else p.mesh.position.set(p.rest.x + dx, p.rest.y - dy, p.rest.z + lift + Math.sin(t * .0011 + p.x * .011 + p.y * .013) * 3 * clamp(val(n, 'build', t), 0, 1));
      p.mesh.rotation.set(rad(val(n, 'rx', t)), rad(val(n, 'ry', t)), rad(val(n, 'rz', t)));
      p.mesh.scale.set(s, s, s);
      if (p.sh) {   // two shadows on whatever is under the piece: soft and wide, and a tight contact line
        p.sh.visible = p.ct.visible = p.mesh.visible;
        if (!p.mesh.visible) continue;
        const hgt = Math.max(0, p.z - p.under + lift), b = clamp((val(n, 'build', t) - .5) * 2, 0, 1);
        p.sh.position.set(p.rest.x + dx + hgt * .22, p.rest.y - dy - hgt * .3, BF + p.under + .7);
        p.sh.scale.set(p.w * s * 1.3 + hgt * .7, p.h * s * 1.3 + hgt * .7, 1);
        p.sh.material.opacity = .6 * o * b * clamp(1 - hgt / 700, .15, 1);
        p.ct.position.set(p.rest.x + dx + 2, p.rest.y - dy - 3, BF + p.under + .9);
        p.ct.scale.set(p.w * s * 1.08, p.h * s * 1.08, 1);
        p.ct.material.opacity = .55 * o * b * clamp(1 - hgt / 60, 0, 1);
      }
    }
  }
  // camera keys: K(t, screen, focus x, focus y, yaw, pitch, distance, roll, ease) or W(t, target(), position(), roll, ease)
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), eul = new THREE.Euler();
  const CK = [];
  const K = (t, key, fx, fy, yaw, pitch, dist, roll = 0, e = E.io, fz = 0) => CK.push({ t, e, f: () => {
    const sc = SCR[key], target = new THREE.Vector3(fx - sc.w / 2, sc.h / 2 - fy, BF + fz).applyMatrix4(sc.content.matrixWorld);
    sc.g.getWorldQuaternion(q1); q2.setFromEuler(eul.set(rad(pitch), rad(yaw), 0)); q1.multiply(q2);
    return { target, pos: new THREE.Vector3(0, 0, dist).applyQuaternion(q1).add(target), up: new THREE.Vector3(Math.sin(rad(roll)), Math.cos(rad(roll)), 0).applyQuaternion(q1), key };
  } });
  const W = (t, tf, pf, roll = 0, e = E.io, key = 'w') => CK.push({ t, e, f: () => ({ target: tf(), pos: pf(), up: new THREE.Vector3(Math.sin(rad(roll)), Math.cos(rad(roll)), 0), key }) });
  const wp = (sc, fx, fy, z = BF) => () => new THREE.Vector3(fx - sc.w / 2, sc.h / 2 - fy, z).applyMatrix4(sc.content.matrixWorld);
  const mid = (a, b, off) => () => a().lerp(b(), .5).add(new THREE.Vector3(...off));
  const homeC = wp(home, 560, 340), discC = wp(disc, 560, 340);
  K(0, 'home', 560, 330, 0, 0, 2300); K(1700, 'home', 560, 330, 8, -3, 1700, 0, E.sine);
  W(2750, mid(homeC, discC, [0, 40, 0]), mid(homeC, discC, [0, 190, 3200]), 0);
  W(4350, mid(homeC, discC, [-120, 50, 0]), mid(homeC, discC, [-280, 120, 3000]), -1, E.sine);
  K(5300, 'load', 520, 330, 20, 12, 1500, 1.5); K(6450, 'load', 520, 330, -16, 8, 1350, -1, E.sine);
  K(7050, 'skin', 400, 380, 28, 66, 1750, 0, E.io, 170); K(9700, 'skin', 400, 380, -24, 62, 1550, 0, E.sine, 190);
  K(10350, 'set0', 300, 300, 22, -3, 1900, 1); K(12250, 'set2', 220, 300, -20, -3, 1900, -1, E.sine);
  K(12950, 'home', 560, 360, -14, 6, 1750, 0); K(14300, 'home', 600, 380, 4, 3, 1550, 0, E.sine);
  K(14950, 'home', 720, 160, -8, -10, 1050, 0); K(16150, 'home', 560, 330, 6, 0, 1650, 0, E.sine);
  K(16950, 'play', 520, 330, 24, 3, 1650, 1.5); K(18300, 'play', 860, 452, 6, 0, 900, 0); K(18950, 'play', 884, 456, 0, 0, 760, 0, E.out); K(20001, 'play', 884, 456, 0, 0, 760, 0, E.lin);
  const camTarget = new THREE.Vector3(), upv = new THREE.Vector3();
  function poseCamera(t) {
    let i = 0; while (i < CK.length - 2 && CK[i + 1].t <= t) i++;
    const a = CK[i], b = CK[i + 1], u = b.e(clamp((t - a.t) / (b.t - a.t), 0, 1));
    const A_ = a.f(), B_ = b.f();
    camTarget.lerpVectors(A_.target, B_.target, u);
    camera.position.lerpVectors(A_.pos, B_.pos, u);
    if (A_.key !== B_.key) { const k = Math.sin(Math.PI * u); v3.subVectors(camera.position, camTarget).normalize(); camera.position.addScaledVector(v3, 480 * k); camera.position.y += 220 * k; }
    upv.lerpVectors(A_.up, B_.up, u).normalize(); camera.up.copy(upv);
    camera.position.x += Math.sin(t * .00041) * 16; camera.position.y += Math.sin(t * .00057 + 1.3) * 11;
    camera.lookAt(camTarget); camera.updateMatrixWorld();
  }
  const proj = (w) => { v4.copy(w).project(camera); return [SW / 2 + v4.x * Vw / 2, SH / 2 - v4.y * Vh / 2, v4.z]; };

  // ---------- the cursor ----------
  const arrow = new THREE.Shape(); [[0, 0], [0, -54], [13, -42], [22, -62], [32, -57], [23, -38], [40, -38]].forEach(([x, y], i) => i ? arrow.lineTo(x, y) : arrow.moveTo(x, y)); arrow.closePath();
  const curGeo = new THREE.ExtrudeGeometry(arrow, { depth: 10, bevelEnabled: true, bevelThickness: 3.5, bevelSize: 2.6, bevelSegments: 4, curveSegments: 4 }); curGeo.translate(0, 0, -7);
  const curMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f4, metalness: .35, roughness: .22, emissive: 0x2a2a2e, emissiveIntensity: .7 });
  const cur = new THREE.Group(), curMesh = new THREE.Mesh(curGeo, curMat); curMesh.scale.setScalar(.95); cur.add(curMesh); curScene.add(cur);
  const glowTex = canvasTex(128, 128, g => { const a = g.createRadialGradient(64, 64, 0, 64, 64, 64); a.addColorStop(0, 'rgba(255,255,255,.7)'); a.addColorStop(.35, 'rgba(255,255,255,.2)'); a.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = a; g.fillRect(0, 0, 128, 128); }, 1, false);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true })); glow.position.set(14, -24, -10); glow.scale.setScalar(78); cur.add(glow);
  curScene.add(new THREE.AmbientLight(0xffffff, .6));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.target = cur; curScene.add(key);
  const rim = new THREE.PointLight(0xbfc0c8, 2.2, 0, 0); curScene.add(rim);
  const curShTex = canvasTex(128, 128, g => { g.filter = 'blur(7px)'; g.translate(34, 22); g.scale(1.35, 1.35); g.fillStyle = 'rgba(0,0,0,.95)'; g.fill(new Path2D('M0 0V54L13 42L22 62L32 57L23 38H40Z')); }, 1, false);
  const curSh = new THREE.Mesh(plane1, new THREE.MeshBasicMaterial({ map: curShTex, transparent: true, depthWrite: false }));

  const HOVER = 58;
  const TS = (sc, lx, ly, top) => ({ sc, f: h => v3.set(lx - sc.w / 2, sc.h / 2 - ly, BF + top + h).applyMatrix4(sc.content.matrixWorld).clone() });
  const TP = (p, lx, ly) => ({ sc: p.sc, f: h => v3.set(lx - p.w / 2, p.h / 2 - ly, p.front + h).applyMatrix4(p.mesh.matrixWorld).clone() });
  const TC = (sx, sy, dist) => ({ sc: null, f: () => { v3.set((sx - SW / 2) / (Vw / 2), -(sy - SH / 2) / (Vh / 2), .5).unproject(camera).sub(camera.position).normalize(); return camera.position.clone().addScaledVector(v3, dist); } });
  const TF = (fn, sc) => ({ sc, f: h => fn().f(h) });
  const MV = [], PRESS = [], HOLD = [];
  const go = (t0, t1, at, { arc = 0, lift = .22, e = E.io } = {}) => MV.push({ t0, t1, at, arc, lift, e });
  const press = (t, at) => PRESS.push({ t, at });
  let now = 0;
  function dip(t) {
    let d = 0;
    for (const p of PRESS) { const k = t - p.t; if (k >= -100 && k < 0) d = Math.max(d, E.sine((k + 100) / 100)); else if (k >= 0 && k < 360) d = Math.max(d, 1 - E.out(k / 360)); }
    for (const [a, b] of HOLD) d = Math.max(d, seg(t, a - 120, a, E.sine) * (1 - seg(t, b, b + 300, E.out)));
    return d;
  }
  const C0S = [735, 520], C0 = TC(C0S[0], C0S[1], 1100);
  function cursorAt(t) {
    const h = HOVER * (1 - dip(t)) + 5 + Math.sin(t * .0042) * 7;
    let i = -1; for (let k = 0; k < MV.length; k++) { if (MV[k].t0 <= t) i = k; else break; }
    if (i < 0) return { p: C0.f(h), sc: null, h };
    const m = MV[i], to = m.at.f(h);
    if (t >= m.t1) return { p: to, sc: m.at.sc, h };
    const from = i ? MV[i - 1].at.f(h) : C0.f(h), u = m.e((t - m.t0) / (m.t1 - m.t0)), k = Math.sin(Math.PI * u);
    const p = from.lerp(to, u);
    if (m.lift) { v4.subVectors(camera.position, p); p.addScaledVector(v4, m.lift * .7 * k); }
    if (m.arc) { v4.setFromMatrixColumn(camera.matrixWorld, 1); p.addScaledVector(v4, m.arc * k); }
    return { p, sc: u > .5 ? m.at.sc : (i ? MV[i - 1].at.sc : null), h: h + 630 * m.lift * k };
  }

  // the cursor's path through the story
  go(980, 1500, TC(860, 420, 1000), { lift: .1, arc: 40 });
  const DISC_BTN = TS(home, 42, 178, 0);
  go(1500, 1880, DISC_BTN, { lift: .15 }); press(1950, DISC_BTN);
  const INSTALL = TP(disc.P.m0, 248, 42);
  go(2150, 2900, INSTALL, { lift: .45, arc: -160 }); press(3000, INSTALL);
  go(3300, 4150, TF(() => TP(cozy, 144, 130), home), { lift: .25, arc: 90, e: E.soft });   // it follows the drop home
  load.pieces.forEach((p, i) => go(i ? 5480 + i * 230 - 180 : 4600, 5480 + i * 230, TP(p, 115, 110), { lift: i ? .1 : .5, arc: i ? 40 : -120 }));
  const SW1 = TP(skin.P.sw1, 75, 75), RIM = TS(skin, 330 + 210, 380, 0), RIM2 = TS(skin, 330 - 40, 380 + 205, 0);
  go(6500, 7350, RIM, { lift: .45, arc: 140 }); HOLD.push([7500, 8500]);
  go(7550, 8450, RIM2, { lift: 0, arc: 60, e: E.io });
  go(8550, 8800, SW1, { lift: .2 }); press(8850, SW1);
  go(9000, 9500, TS(skin, 330, 300, 0), { lift: .2, arc: -60 });
  const TOG = sets.map(sc => TS(sc, 444, 238, 0)), KNOB = i => TS(sets[i], 235, 314, 0), KNOB_END = TS(sets[0], 415, 314, 0);
  go(9900, 10620, TOG[0], { lift: .45, arc: -140 }); press(10700, TOG[0]);
  go(10760, 10960, KNOB(0), { lift: .1 }); HOLD.push([11000, 11380]);
  go(11000, 11380, KNOB_END, { lift: 0, e: E.io });
  go(11500, 12150, TS(sets[2], 300, 470, 0), { lift: .25, arc: 80 });
  const FILE = TP(file.P.f, 110, 120);
  go(12400, 12950, FILE, { lift: .4, arc: -120 }); HOLD.push([13000, 13640]);
  go(13700, 14100, TS(home, 560, 470, 22), { lift: .2 });
  const UPD = TS(home, 770, 40, 0);
  go(14500, 14980, UPD, { lift: .3, arc: 60 }); press(15050, UPD);
  go(15350, 16150, TS(home, 640, 330, 22), { lift: .2, arc: -80 });
  go(16250, 16950, TC(1200, 800, 820), { lift: 0, arc: -100 });
  const PLAY = TP(btn, 128, 48);
  go(17900, 18660, PLAY, { lift: 0, arc: 60, e: E.soft }); press(18750, PLAY);
  go(BLAST + 20, BLAST + 21, C0);
  // the file follows the cursor's hand from the grab to the slot, then dives in
  const cN = N(); S(cN, 0, { s: 0 }); A(cN, 760, 380, { s: 1 }, E.out); S(cN, BLAST + 10, { s: 0 });

  // ---------- hooks: each beat opens with its phrase in the centre (the camera eases into slow motion), then the
  // phrase turns into the panel it's about: the key word's pill stretches into the panel's outline, and the other
  // words break into cubes that fly into it. Real time (0..30 s) maps to story time (0..20 s) through warp().
  const HOOK_S = [900, 2750, 5300, 7050, 10350, 12800, 14950, 16950];
  const slowAt = st => { let k = 0; for (const h of HOOK_S) k = Math.max(k, seg(st, h - 950, h - 650, E.sine) * (1 - seg(st, h + 50, h + 350, E.sine))); return k; };
  const RT = new Float32Array(ST + 2); { let r = 0; for (let i = 0; i <= ST + 1; i++) { RT[i] = r; r += 1 / (1 - .8 * slowAt(i)); } const k = T / RT[ST]; for (let i = 0; i <= ST + 1; i++) RT[i] *= k; }
  const realOf = st => RT[clamp(Math.round(st), 0, ST)];
  const STA = new Float32Array(T + 1); { let i = 0; for (let r = 0; r <= T; r++) { while (i < ST && RT[i + 1] <= r) i++; const a = RT[i], b = RT[i + 1]; STA[r] = Math.min(ST, i + (b > a ? (r - a) / (b - a) : 0)); } }
  const warp = tr => STA[clamp(Math.floor(tr), 0, T)];
  const PH_SIZE = 60, PH_Y = 470;
  const HOOKS = [['Minecraft,', 'liquid smooth', '.', () => [home.base]], ['One click,', 'every mod', '', () => [disc.base]], ['Every loader,', 'built in', '', () => load.pieces],
    ['Your skin,', 'alive', '', () => [skin.base]], ['Settings', 'follow you', '', () => [sets[1].base]], ['Share packs in', 'one drop', '', () => [file.P.f]],
    ['Always', 'up to date', '', () => [upd]], ['Ready to', 'play', '?', () => [play.P.btn]]].map(([pre, kw, post, targets], hi) => {
    const R0 = realOf(HOOK_S[hi]), tm = Math.max(900, R0 - 260), tin = Math.max(40, tm - 1500);
    const g0 = document.createElement('canvas').getContext('2d'), sp = PH_SIZE * .3;
    const list = [...pre.split(' ').map(s => ({ s })), { s: kw, kw: true }, ...(post ? [{ s: post }] : [])];
    list.forEach(w => { g0.font = `${w.kw ? 600 : 500} ${PH_SIZE}px ${FONT}`; w.w = g0.measureText(w.s).width; });
    const gapOf = (w, i) => i === 0 ? 0 : /^[.?!,]$/.test(w.s) ? 22 : (w.kw || list[i - 1].kw ? sp + 20 : sp);
    const total = list.reduce((a, w, i) => a + gapOf(w, i) + w.w, 0);
    let x = SW / 2 - total / 2;
    list.forEach((w, i) => { x += gapOf(w, i); w.x = x; x += w.w; w.tin = tin + i * 90; w.tm = tm + i * 45; });
    return { words: list, targets, tm, tin, bb: null };
  });
  const planeL = new THREE.PlaneGeometry(1, 1).translate(.5, 0, 0);
  // a soft dark band behind the phrase so it reads over any panel
  const scrimMat = new THREE.ShaderMaterial({ uniforms: { k: { value: 0 }, y: { value: (SH / 2 - PH_Y) / SH } }, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float k, y; varying vec2 vUv;
      void main(){ vec2 d = vec2((vUv.x - .5) * 1.1, (vUv.y - .5 - y) * 2.6); float a = .34 + .44 * exp(-dot(d, d) * 5.); gl_FragColor = vec4(0., 0., 0., a * k); }` });
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(SW * 1.2, SH * 1.2), scrimMat); scrim.renderOrder = -1; wordScene.add(scrim);
  const words = [];
  const mo = { x: 0, y: 0, tx: 0, ty: 0, last: 0 };
  addEventListener('pointermove', e => { mo.tx = e.clientX / Math.max(1, innerWidth) * 2 - 1; mo.ty = e.clientY / Math.max(1, innerHeight) * 2 - 1; }, { passive: true });
  for (const hk of HOOKS) for (const w of hk.words) {
    const pad = 24, h = PH_SIZE * 1.9, cw = w.w + pad * 2;
    const map = canvasTex(cw, h, g => {
      g.font = `${w.kw ? 600 : 500} ${PH_SIZE}px ${FONT}`;
      if (w.kw) R(g, pad - 20, h / 2 - PH_SIZE * .68, w.w + 40, PH_SIZE * 1.36, PH_SIZE * .68, PAL.accent);
      else { g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 24; g.fillStyle = '#EDEDF0'; g.fillText(w.s, pad, h / 2 + PH_SIZE * .34); g.shadowBlur = 0; }
      g.fillStyle = w.kw ? PAL.ink : '#EDEDF0'; g.fillText(w.s, pad, h / 2 + PH_SIZE * .34);
    }, 2, false);
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, pin: { value: 0 }, op: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform sampler2D map; uniform float pin, op; varying vec2 vUv;
        void main(){ vec4 c = texture2D(map, vUv); float ei = pin * 1.4 - .2; gl_FragColor = vec4(c.rgb, c.a * op * smoothstep(ei + .04, ei - .04, vUv.y)); }`,
    });
    const o = new THREE.Mesh(planeL, mat); o.scale.set(cw, h, 1); o.visible = false; wordScene.add(o);
    words.push({ o, mat, ...w, cw, h, pad, hk });
  }
  // where a target sits on screen right now (a box around its projected corners)
  const corner = new THREE.Vector3();
  function bboxOf(list) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, w0 = 0, ww = 0;
    for (const t of list) {
      const isOv = !t.mesh, mesh = isOv ? t.o : t.mesh, hw = isOv ? .5 : t.w / 2, hh = isOv ? .5 : t.h / 2, z = isOv ? 0 : t.front;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { corner.set(sx * hw, sy * hh, z).applyMatrix4(mesh.matrixWorld); const [x, y] = proj(corner); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      w0 += isOv ? 120 : t.w; ww += 1;
    }
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: (x1 - x0) / 2, hh: (y1 - y0) / 2, r: list.length > 1 ? 18 : 26 * ((x1 - x0) / Math.max(1, w0 / ww)) };
  }

  // ---------- 4 the liquid layer: mercury-like drops and streams, an ink flood, rings, the blast ----------
  const V4 = n => Array.from({ length: n }, () => new THREE.Vector4());
  const fxU = { view: { value: new THREE.Vector2(SW, SH) }, time: { value: 0 }, pxs: { value: 1 }, flash: { value: 0 }, drops: { value: V4(40) }, rings: { value: V4(3) }, burst: { value: new THREE.Vector4() },
    box: { value: new THREE.Vector4() }, boxP: { value: new THREE.Vector3() } };
  const fxMat = new THREE.ShaderMaterial({
    uniforms: fxU, transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform vec2 view; uniform float time, pxs, flash;
      uniform vec4 drops[40]; uniform vec4 rings[3]; uniform vec4 burst; uniform vec4 box; uniform vec3 boxP;
      varying vec2 vUv;
      float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
      void main(){
        vec2 p = vec2(735. + (vUv.x - .5) * view.x, 500. - (vUv.y - .5) * view.y);
        float e = pxs * 1.2;
        vec3 col = vec3(0.); float al = 0., dmin = 1e5;
        // flat 2D cubes: each one a small square, lighter towards its top left, with a darker rim
        for (int i = 0; i < 40; i++) { vec4 o = drops[i]; if (o.z > .2) {
          vec2 q = p - o.xy; float c = cos(o.w), s = sin(o.w); q = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
          float d = sdBox(q, vec2(o.z), o.z * .16); dmin = min(dmin, d);
          float a = clamp(.5 - d / e, 0., 1.);
          if (a > 0.) {
            float lit = clamp(.5 - (q.x + q.y) / (o.z * 2.8), 0., 1.);
            vec3 cc = vec3(${LIQ}) * mix(.6, 1., lit) * mix(.76, 1., smoothstep(0., -max(1.5, o.z * .24), d));
            col = mix(col, cc, a); al = max(al, a);
          } } }
        col += vec3(${LIQ}) * exp(-max(dmin, 0.) / 10.) * .12;
        for (int i = 0; i < 3; i++) { vec4 r = rings[i]; if (r.w > .01) { float dd = abs(length(p - r.xy) - r.z); col += vec3(${LIQ}) * (clamp((2. - dd) / e + .5, 0., 1.) + exp(-dd / 9.) * .3) * r.w; } }
        // a hook's pill turning into its panel: a filled pill that grows into a glowing outline
        if (boxP.y + boxP.z > .01) {
          float d = sdBox(p - box.xy, box.zw, min(boxP.x, min(box.z, box.w)));
          float fa = clamp(.5 - d / e, 0., 1.) * boxP.y;
          col = mix(col, vec3(${LIQ}), fa); al = max(al, fa);
          float ln = (clamp((1.6 - abs(d)) / e + .5, 0., 1.) + exp(-abs(d) / 12.) * .28) * boxP.z;
          col += vec3(${LIQ}) * ln; al = max(al, clamp(ln * .9, 0., 1.));
        }
        if (burst.w > .01) {
          vec2 q = p - burst.xy; float L = length(q), dd = abs(L - burst.z), an = atan(q.y, q.x);
          float th = 10. + 44. * burst.w;
          col += vec3(${LIQ}) * (exp(-dd / th) * 1.1 + smoothstep(th, 0., dd) * .6) * burst.w;
          col += vec3(${LIQ2}) * pow(max(0., sin(an * 23.) * sin(an * 7. + 1.3)), 6.) * smoothstep(burst.z, 0., L) * burst.w * 1.1;
        }
        col += vec3(1.) * flash;
        gl_FragColor = vec4(col, al);
      }`,
  });
  fxScene.add(new THREE.Mesh(quad, fxMat));
  const BD = [...Array(10)].map((_, i) => ({ a: i / 10 * 6.283 + .31 + (i % 2) * .17, d: 460 + (i % 3) * 170, r: 12 + (i % 4) * 3 }));
  let blastAt = null;
  // liquid that travels from one place to another (in the world), as a stream of drops that merge
  const FLOWS = [];
  const flow = (t0, dur, from, to, { r = 13, n = 6, lag = 26, lift = 260 } = {}) => FLOWS.push({ t0, dur, from, to, r, n, lag, lift });
  const ic0World = () => v3.set(0, 0, ic0.front + 10).applyMatrix4(ic0.mesh.matrixWorld).clone();
  const cozyWorld = () => v3.set(0, 20, cozy.front + 6).applyMatrix4(cozy.mesh.matrixWorld).clone();
  const m0World = (dx) => () => v3.set(-80 + dx, -40, disc.P.m0.front + 8).applyMatrix4(disc.P.m0.mesh.matrixWorld).clone();
  flow(3300, 880, ic0World, cozyWorld, { r: 15, n: 7, lift: 380 });
  flow(3520, 780, m0World(0), cozyWorld, { r: 8, n: 4, lift: 300 }); flow(3680, 780, m0World(60), cozyWorld, { r: 8, n: 4, lift: 300 });
  const sw1World = () => v3.set(0, 0, skin.P.sw1.front + 10).applyMatrix4(skin.P.sw1.mesh.matrixWorld).clone();
  const headWorld = () => v3.set(0, PH + 30, 0).applyMatrix4(spin.matrixWorld).clone();
  flow(8920, 360, sw1World, headWorld, { r: 13, n: 6, lift: 260 });
  const togW = i => () => v3.set(444 - 260, 300 - 238, 12 + 8).applyMatrix4(sets[i].content.matrixWorld).clone();
  flow(11420, 300, togW(0), togW(1), { r: 9, n: 5, lift: 160 }); flow(11760, 300, togW(1), togW(2), { r: 9, n: 5, lift: 160 });
  const ARRIVE = [[4180, cozyWorld], [4330, cozyWorld], [4480, cozyWorld], [9280, headWorld], [11720, togW(1)], [12060, togW(2)], [13660, () => slotWorld()]];

  // the file's path: from where it floats, held by the cursor, to the empty slot, then it dives in
  let fileFrom = null, fileTo = null;

  // ================= render one moment =================
  const drops = fxU.drops.value, tmpQ = new THREE.Quaternion();
  function stateAt(t) {
    now = t; poseScreens(t);
    // the file rides between its float spot and the slot (computed in world space, then set as its pose)
    if (!fileFrom) { scene.updateMatrixWorld(); fileFrom = file.g.position.clone(); fileTo = slotWorld().add(new THREE.Vector3(0, 0, 40)); }
    const fu = seg(t, 13000, 13600, E.io), fd = seg(t, 13640, 13800, E.in);
    file.g.position.lerpVectors(fileFrom, fileTo, fu); file.g.position.y += Math.sin(Math.PI * fu) * 120;
    file.g.rotation.set(rad(-10 * Math.sin(Math.PI * fu)), rad(lerp(26, 14, fu)), rad(lerp(-6, 0, fu)));
    const fs = lerp(1, .55, fu) * (1 - fd * .9); file.g.scale.set(fs, fs, fs);
    posePieces(t); scene.updateMatrixWorld(); poseCamera(t);
  }
  function render(t0) {
    const tr = ((t0 % T) + T) % T, t = warp(tr), ts = t / 1000;
    if (!blastAt) { stateAt(BLAST); blastAt = proj(cursorAt(BLAST).p); }
    stateAt(t);
    for (const sc of SCRS) for (const p of sc.pieces) {
      if (!p.mesh.visible) continue;
      const n = p.n, u = p.mat.uniforms, b = val(n, 'build', t); u.opacity.value = p.o; u.build.value = b; u.time.value = ts; u.jelly.value = val(n, 'jelly', t); u.skew.value = val(n, 'skew', t);
      p.mat.transparent = p.o < .999 || b < .999;
    }
    for (const m of PMATS) { m.uniforms.paint.value = val(pN, 'paint', t); m.uniforms.time.value = ts; }
    const done = new Set();
    for (const w of WIPES) {
      const u = w.p.mat.uniforms; if (t < w.t0) { if (!done.has(w.p)) { done.add(w.p); u.tA.value = w.from; u.mixC.value.z = -1; } continue; }
      if (w.dur && t < w.t0 + w.dur) { const k = E.io((t - w.t0) / w.dur), [cx, cy] = w.uv, Wd = w.p.w, Ht = w.p.h; const far = Math.max(Math.hypot(cx, cy), Math.hypot(Wd - cx, cy), Math.hypot(cx, Ht - cy), Math.hypot(Wd - cx, Ht - cy)) + 80; u.tA.value = w.from; u.tB.value = w.to; u.mixC.value.set(cx, cy, k * far); }
      else { u.tA.value = w.to; u.mixC.value.z = -1; }
      done.add(w.p);
    }
    for (const n of OVS) { const o = val(n, 'o', t); n.o.visible = o > .003 && n.host.mesh.visible; if (!n.o.visible) continue; n.upd?.(t); n.mat.opacity = o * val(n.host.n, 'o', t); }
    // cursor
    const cs = val(cN, 's', t), { p: cp, sc: csc, h: ch } = cursorAt(t), past = cursorAt(t - 24).p;
    cur.visible = cs > .01;
    const [sx, sy] = proj(cp), [px, py] = proj(past), vx = (sx - px) / 24, vy = (sy - py) / 24, spd = Math.hypot(vx, vy), dp = dip(t);
    curSh.visible = false;
    if (cur.visible) {
      cur.position.copy(cp); cur.scale.setScalar(cs);
      tmpQ.setFromEuler(eul.set(clamp(-vy * .02, -.6, .6) + .28 + dp * .45, clamp(vx * .02, -.7, .7) - .32, clamp(-vx * .012, -.45, .45)));
      cur.quaternion.copy(camera.quaternion).multiply(tmpQ);
      glow.material.opacity = .3 + val(btn.n, 'lift', t) / 34 * .45;
      key.position.copy(camera.position).add(v3.set(-900, 1100, 400).applyQuaternion(camera.quaternion));
      rim.position.copy(cp).add(v3.set(260, -220, 160).applyQuaternion(camera.quaternion));
      if (csc && csc.g.visible) {
        if (curSh.parent !== csc.content) csc.content.add(curSh);
        v4.copy(cp); csc.content.worldToLocal(v4);
        const hh = ch / csc.g.scale.x;
        curSh.position.set(v4.x + 30 + hh * .25, v4.y - 40 - hh * .35, v4.z - hh + 1.5);
        curSh.scale.setScalar(110 * (1 + hh / 260)); curSh.material.opacity = .5 * clamp(1 - hh / 500, 0, 1) * cs; curSh.visible = true;
      }
    }
    // liquid
    let di = 0;
    const put = (x, y, r) => { if (di < 40 && r > .5) { drops[di].set(x, y, r * .62, di * 1.37 + ts * 1.6); di++; } };
    if (cur.visible && t > 1000) for (let i = 1; i <= 5; i++) { const [qx, qy] = proj(cursorAt(t - 11 * i).p); const persp = clamp(1100 / Math.max(200, camera.position.distanceTo(cp)), .5, 2.4); put(qx, qy, (8 - 1.2 * i) * persp * clamp(spd * 1.3, 0, 1), 14); }
    for (const f of FLOWS) {
      if (t < f.t0 || t > f.t0 + f.dur + f.n * f.lag + 40) continue;
      const a = f.from(), b = f.to(), m = a.clone().lerp(b, .5).addScaledVector(camera.up, f.lift);
      for (let k = 0; k < f.n; k++) {
        const u = clamp((t - f.t0 - k * f.lag) / f.dur, 0, 1); if (u <= 0 || u >= 1) continue;
        const e = E.io(u), q = a.clone().multiplyScalar((1 - e) * (1 - e)).addScaledVector(m, 2 * e * (1 - e)).addScaledVector(b, e * e);
        const [x, y] = proj(q), grow = seg(u, 0, .15, E.out) * (1 - seg(u, .85, 1, E.in) * .6);
        put(x, y, f.r * (1 - k * .11) * grow, 20);
      }
    }
    let ri = 0; const rings = fxU.rings.value;
    const ring = (x, y, d, k = 1) => { if (ri < 3) rings[ri++].set(x, y, 8 + 80 * E.out(d / 700) * k, (1 - d / 700) * .55); };
    for (const pr of PRESS) {
      const d = t - pr.t; if (d < 0 || d >= 700) continue;
      const [rx, ry] = proj(pr.at.f(4)); ring(rx, ry, d);
      if (d < 560) for (let j = 0; j < 3; j++) { const a = -Math.PI / 2 + (j - 1) * .7, v = .3 + (j % 2) * .08; put(rx + Math.cos(a) * v * d, ry + Math.sin(a) * v * d + .0011 * d * d, 4.5 * (1 - d / 560), 12); }
    }
    for (const [ta, at] of ARRIVE) { const d = t - ta; if (d < 0 || d >= 700) continue; const [rx, ry] = proj(at()); ring(rx, ry, d, 1.3);
      if (d < 500) for (let j = 0; j < 4; j++) { const a = -Math.PI / 2 + (j - 1.5) * .6; put(rx + Math.cos(a) * .36 * d, ry + Math.sin(a) * .4 * d + .0014 * d * d, 5 * (1 - d / 500), 12); } }
    for (let i = ri; i < 3; i++) rings[i].set(0, 0, 0, 0);
    if (t >= BLAST) {
      const [bx, by] = blastAt;
      const bp = (d, tt) => { const u1 = seg(tt, BLAST, 19250, E.out), ox = bx + Math.cos(d.a) * d.d * u1, oy = by + Math.sin(d.a) * d.d * u1 * .8, u2 = seg(tt, 19250, 19900, E.io);
        return [lerp(ox, 735, u2), lerp(oy, -150, u2), tt < 19250 ? lerp(d.r * 1.5, d.r * .7, u1) : d.r * .7 * (1 - seg(tt, 19700, 19900, E.in))]; };
      for (const d of BD) { const [x, y, r] = bp(d, t), [x2, y2, r2] = bp(d, Math.max(BLAST, t - 45)); put(x, y, r, 30); if (t > BLAST + 30) put(x2, y2, r2 * .6, 30); }
    }
    for (let i = di; i < 40; i++) drops[i].set(0, 0, 0, 0);
    const bu = clamp((t - BLAST) / 520, 0, 1);
    if (t >= BLAST && bu < 1) fxU.burst.value.set(blastAt[0], blastAt[1], 40 + 1500 * E.out(bu), 1 - bu); else fxU.burst.value.set(0, 0, 0, 0);
    fxU.flash.value = t >= BLAST ? (t < BLAST + 50 ? (t - BLAST) / 50 * .5 : .5 * (1 - seg(t, BLAST + 50, BLAST + 260, E.out))) : 0;
    fxU.time.value = ts;
    // hooks
    fxU.boxP.value.set(0, 0, 0);
    for (const hk of HOOKS) hk.bb = (tr >= hk.tm - 40 && tr < hk.tm + 1100) ? bboxOf(hk.targets()) : null;
    { let k = 0; for (const hk of HOOKS) k = Math.max(k, seg(tr, hk.tin, hk.tin + 500, E.sine) * (1 - seg(tr, hk.tm, hk.tm + 600, E.sine))); scrimMat.uniforms.k.value = t < BLAST ? k : 0; scrim.visible = k > .002; }
    { const nowMs = performance.now(), dt = Math.min(100, nowMs - (mo.last || nowMs)); mo.last = nowMs; const f = 1 - Math.exp(-dt / 260); mo.x += (mo.tx - mo.x) * f; mo.y += (mo.ty - mo.y) * f; }
    scrim.position.set(mo.x * 6, -mo.y * 4, -1);
    for (const w of words) {
      const hk = w.hk, pin = seg(tr, w.tin, w.tin + 520, E.out), m = seg(tr, w.tm, w.tm + 760, E.io);
      const dep = w.kw ? 1 : .6, mx = mo.x * 18 * dep, my = mo.y * 11 * dep;
      w.o.visible = tr >= w.tin && m < 1 && t < BLAST + 40; if (!w.o.visible) continue;
      const u = w.mat.uniforms; u.pin.value = pin;
      const cx = w.x + w.w / 2;
      if (!hk.bb || m <= 0) { u.op.value = 1; w.o.scale.set(w.cw, w.h, 1); w.o.position.set(w.x - w.pad - SW / 2 + mx, SH / 2 - PH_Y - 22 * (1 - pin) - my, 0); continue; }
      const bb = hk.bb;
      if (w.kw) {   // the pill hands over to the outline that grows into the panel
        const k = E.io(m), hw0 = w.w / 2 + 20, hh0 = PH_SIZE * .68, bx = lerp(cx + mx, bb.cx, k), by = lerp(PH_Y + my, bb.cy, k), sc = 1 + .25 * k;
        u.op.value = 1 - seg(m, .04, .34, E.sine);
        w.o.scale.set(w.cw * sc, w.h * sc, 1); w.o.position.set(bx - w.cw * sc / 2 - SW / 2, SH / 2 - by, 0);
        fxU.box.value.set(bx, by, lerp(hw0, bb.hw, k), lerp(hh0, bb.hh, k));
        fxU.boxP.value.set(lerp(hh0, bb.r, k), .28 * seg(m, 0, .08, E.lin) * (1 - seg(m, .2, .6, E.sine)), 1 - seg(m, .72, 1, E.sine));
      } else {      // the other words are pulled into the panel and break into cubes on the way
        const k = E.in(m), sc = 1 - .85 * m, x = lerp(cx + mx, bb.cx, k), y = lerp(PH_Y + my, bb.cy, k);
        u.op.value = 1 - seg(m, .35, .9, E.lin);
        w.o.scale.set(w.cw * sc, w.h * sc, 1); w.o.position.set(x - w.cw * sc / 2 - SW / 2, SH / 2 - y, 0);
        if (m > .08) for (let j = 0; j < 3; j++) { const kk = E.in(Math.max(0, m - .05 * (j + 1))); put(lerp(cx, bb.cx, kk) + (j - 1) * w.w * .25 * (1 - m), lerp(PH_Y, bb.cy, kk) + Math.sin(j * 2.1 + m * 9) * 10, (9 - j * 2) * (1 - m * .6)); }
      }
    }
    bgMat.uniforms.time.value = ts; bgMat.uniforms.cam.value.set(camera.position.x * .12, -camera.position.y * .12);
    bgMat.uniforms.black.value = t < 1300 ? 1 - seg(t, 200, 1300, E.sine) : seg(t, BLAST + 40, BLAST + 160, E.lin);
    scene.visible = t < BLAST + 90;
    renderer.clear();
    renderer.render(bgScene, ortho); renderer.render(scene, camera); renderer.render(wordScene, wcam); renderer.render(fxScene, ortho);
    renderer.clearDepth(); renderer.render(curScene, camera);
  }

  function resize(w, h, dpr) {
    const pr = Math.min(dpr, software ? 1 : 1.75, Math.sqrt(2.6e6 / Math.max(1, w * h)));
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    const asp = w / h; Vw = SW; Vh = SW / asp; if (Vh > SH * 1.3) { Vh = SH * 1.3; Vw = Vh * asp; }   // fit the stage's width (the layer is narrow), up to 30% extra height
    for (const c of [camera, wcam]) { c.aspect = asp; c.fov = 2 * Math.atan(Vh / 2 / D) * 180 / Math.PI; c.updateProjectionMatrix(); }
    bgMat.uniforms.view.value.set(Vw, Vh); fxU.view.value.set(Vw, Vh);
    fxU.pxs.value = Vh / Math.max(1, h * pr);
    blastAt = null;
  }
  function warm() {
    SCRS.forEach(sc => sc.pieces.forEach(p => { renderer.initTexture(p.mat.uniforms.tA.value); if (p.alt) renderer.initTexture(p.alt); }));
    OVS.forEach(n => renderer.initTexture(n.t)); words.forEach(w => renderer.initTexture(w.mat.uniforms.map.value));
    [0, 3000, 5600, 8000, 10800, 13200, 15300, 17500, 18900].forEach(render);
  }
  return { T, render, resize, warm, renderer, hooks: HOOKS.map(h => [h.tin, h.tm]) };
}
