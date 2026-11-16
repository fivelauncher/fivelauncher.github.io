import { drift } from './js/bg-drift.js?v=10';
import { venom } from './js/venom.js?v=10';

const REPO = 'OmarFive3/five-launcher-releases';
// The site is pinned to ONE launcher version: the download button, badge and update list never go past it,
// even when newer releases exist on GitHub. Change PIN (and the download link in index.html) to move it.
const PIN = 'v0.2.7';
const ver = t => (t || '').replace(/^v/, '').split('.').map(Number);
const notNewer = t => { const a = ver(t), b = ver(PIN); for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0); return true; };
const q = new URLSearchParams(location.search);

// ---------- mouse (or a fixed one for screenshots: ?mx=..&my=..) ----------
const mouse = { x: innerWidth * .5, y: innerHeight * .5, on: false, sx: 0, sy: 0 };
if (q.has('mx')) { mouse.x = +q.get('mx') * innerWidth; mouse.y = +q.get('my') * innerHeight; mouse.on = true; }
else {
  addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; });
  document.addEventListener('pointerleave', () => { mouse.on = false; });
}

// ---------- background + button ----------
const bg = drift(document.getElementById('world'), mouse);
const vn = venom(document.getElementById('venom'), mouse, { blockers: [document.getElementById('win')] });

// ---------- entrance ----------
requestAnimationFrame(() => document.body.classList.add('ready'));

// ---------- the live launcher demo ----------
// The real launcher UI (a web build of launcher/app on its mock backend) runs in an iframe at its native 1280x760
// and is scaled to fit the window frame. It sleeps (no pointer events) until clicked, so wheel-scrolling past it
// never gets stuck in it; moving the mouse well away puts it back to sleep.
const win = document.getElementById('win'), screen = document.getElementById('screen'), demo = document.getElementById('demo');
const wideEnough = () => innerWidth > 760;
function fitDemo() { screen.style.setProperty('--k', String(screen.clientWidth / 1280)); }
addEventListener('resize', fitDemo); fitDemo();
function loadDemo() { if (wideEnough() && demo.src === 'about:blank') demo.src = demo.dataset.src; }
addEventListener('load', () => setTimeout(loadDemo, 400));
addEventListener('resize', loadDemo);
document.getElementById('wake').addEventListener('click', () => { loadDemo(); win.classList.add('on'); });
win.addEventListener('pointerleave', () => { win.classList.remove('on'); });
// the page can't see the mouse inside the iframe: park the goo/particle cursor while it is over the demo
screen.addEventListener('pointerenter', () => { if (win.classList.contains('on')) mouse.on = false; });

// tilt: starts leaning back a little, flattens as it rises to the middle of the screen
function tilt() {
  const r = win.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * .75)));
  const e = 1 - Math.pow(1 - p, 2);
  win.style.setProperty('--tilt', `${(10 * (1 - e)).toFixed(2)}deg`);
  win.style.setProperty('--sc', (.97 + .03 * e).toFixed(4));
}

// ---------- nav state ----------
const nav = document.querySelector('.nav');
const navLinks = [...document.querySelectorAll('.nav nav a')];
const targets = navLinks.map(a => document.querySelector(a.getAttribute('href')));
function navState() {
  nav.classList.toggle('solid', scrollY > 20);
  let cur = 0;
  targets.forEach((el, k) => { if (el && el.getBoundingClientRect().top < innerHeight * .4) cur = k; });
  navLinks.forEach((a, k) => k === cur ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
}

// ---------- frame ----------
if (q.has('s')) scrollTo(0, +q.get('s') * innerHeight);
let last = performance.now(), T = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
  vn.step(T, dt);
  bg.step(T, dt, scrollY, vn.sink);
  tilt(); navState();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- releases from GitHub ----------
const fallback = [{ tag_name: 'v0.2.7', published_at: '2026-11-16T13:48:40Z', body: "- Much faster new instances: the launcher now reuses Minecraft files, mods, resource packs, shaders and Java already on your PC (official launcher, Modrinth App, CurseForge, Prism and more) instead of downloading them again. Every file is checked first, and other launchers' files are never changed.\n- Files on the same drive are shared, so they take no extra space.", assets: [{ name: 'Five-Launcher-Setup.exe', size: 48658877 }] }];
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function md(body) {
  const lines = (body || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = lines.filter(l => /^[-*] /.test(l)).map(l => `<li>${esc(l.slice(2))}</li>`);
  const text = lines.filter(l => !/^[-*] /.test(l) && !l.startsWith('#')).map(l => `<p>${esc(l)}</p>`);
  return text.join('') + (items.length ? `<ul>${items.join('')}</ul>` : '');
}
function render(list) {
  document.getElementById('releases').innerHTML = list.slice(0, 8).map((r, k) => `
    <li class="rel"><header><span class="v">${esc(r.tag_name)}</span>${k === 0 ? '<span class="tag">Latest</span>' : ''}
    <time datetime="${esc(r.published_at)}">${new Date(r.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</time></header>${md(r.body)}</li>`).join('');
  const v = list[0]?.tag_name; if (v) document.querySelectorAll('[data-ver]').forEach(e => e.textContent = v);
  const a = list[0]?.assets?.find(x => /\.exe$/i.test(x.name));
  if (a) document.querySelectorAll('[data-size]').forEach(e => e.textContent = `${Math.round(a.size / 1048576)} MB`);
}
render(fallback);
if (!q.has('offline')) fetch(`https://api.github.com/repos/${REPO}/releases`).then(r => r.ok ? r.json() : []).then(l => { l = Array.isArray(l) ? l.filter(r => !r.draft && !r.prerelease && notNewer(r.tag_name)) : []; if (l.length) render(l); }).catch(() => {});
