// Download help: when someone presses any Download button, the download starts as normal and a warm panel
// opens in the middle of the screen. It thanks them, shows (with drawn pictures) what to do if Windows SmartScreen
// says "Windows protected your PC", and explains why Windows does that. Omar asked for emoji and yellow text here,
// so this panel is the one place on the site that uses them.
// Self-contained: loads its own stylesheet, works on any page that has links to the setup file.
const SETUP = /Five-Launcher-Setup\.exe$/i;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'download-help.css?v=1';
document.head.appendChild(css);

// the two Windows screens, drawn (not screenshots), with the button to press ringed in yellow
const screen = step => `
  <div class="ss" aria-hidden="true">
    <div class="ss-bar"><i></i></div>
    <div class="ss-body">
      <b class="ss-title">Windows protected your PC</b>
      <span class="ss-line"></span><span class="ss-line short"></span>
      ${step === 1
        ? `<span class="ss-link hot">More info<i class="ss-cursor"></i></span>`
        : `<span class="ss-meta">App: <em>Five-Launcher-Setup.exe</em></span><span class="ss-meta">Publisher: <em>Unknown publisher</em></span>`}
    </div>
    <div class="ss-foot">
      ${step === 2 ? `<span class="ss-btn hot">Run anyway<i class="ss-cursor"></i></span>` : ''}
      <span class="ss-btn">Don't run</span>
    </div>
  </div>`;

const wrap = document.createElement('div');
wrap.className = 'dh'; wrap.hidden = true;
wrap.innerHTML = `
  <div class="dh-scrim" data-close></div>
  <section class="dh-panel" role="dialog" aria-modal="true" aria-labelledby="dh-title" aria-describedby="dh-lead">
    <button class="dh-x" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    <div class="dh-hello" aria-hidden="true">🎉</div>
    <h2 id="dh-title" tabindex="-1">Thank you for downloading Five Launcher! 💛</h2>
    <p class="dh-lead" id="dh-lead">Your download has started ⬇️ It means a lot that you're giving it a try.</p>

    <p class="dh-warm">🛡️ If Windows shows a blue <b>"Windows protected your PC"</b> screen when you open it, don't worry, it's totally safe to continue. Here's how:</p>

    <ol class="dh-steps">
      <li><div class="dh-pic">${screen(1)}</div><p><span class="n">1</span>Click <b>More info</b> 👆</p></li>
      <li><div class="dh-pic">${screen(2)}</div><p><span class="n">2</span>Click <b>Run anyway</b> ✅</p></li>
      <li><div class="dh-pic dh-done"><span>🎮</span></div><p><span class="n">3</span>Install and play! 🚀</p></li>
    </ol>

    <details class="dh-why">
      <summary>🤔 Why does Windows do this?</summary>
      <p>Windows SmartScreen warns about apps that are new and aren't signed with a paid code-signing certificate yet. Five Launcher is a free project made by one person, so it isn't signed yet 🙏 The warning isn't about anything found in the file. It shows up for most new apps, and it fades away as more players install it. The setup is the exact same file published on our GitHub releases.</p>
    </details>

    <div class="dh-actions">
      <button class="dh-ok" type="button" data-close>Got it, let's play! ✨</button>
      <a class="dh-again" data-again href="#">Download didn't start? Try again</a>
    </div>
  </section>`;
document.body.appendChild(wrap);

const panel = wrap.querySelector('.dh-panel');
let lastFocus = null, open = false;
function show(href) {
  wrap.querySelector('[data-again]').href = href;
  lastFocus = document.activeElement;
  wrap.hidden = false; open = true;
  document.documentElement.classList.add('dh-open');
  requestAnimationFrame(() => { wrap.classList.add('on'); wrap.querySelector('#dh-title').focus({ preventScroll: true }); });
}
function hide() {
  if (!open) return; open = false;
  wrap.classList.remove('on');
  document.documentElement.classList.remove('dh-open');
  setTimeout(() => { if (!open) wrap.hidden = true; }, reduced ? 0 : 320);
  lastFocus?.focus?.({ preventScroll: true });
}

// any link to the setup file: let the download start, then open the panel
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || !SETUP.test(a.href) || a.matches('[data-again]')) return;
  setTimeout(() => show(a.href), a.closest('.drop') ? 420 : 60);   // the big Drops button gets a moment for its streaks
});
// links like the top-bar pill get their real href from main.js; catch them too
document.addEventListener('click', e => {
  const a = e.target.closest('[data-dl]');
  if (a && !SETUP.test(a.href)) { const real = document.querySelector('#dl')?.href; if (real) { e.preventDefault(); location.href = real; setTimeout(() => show(real), 60); } }
}, true);

wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) hide(); });
// while the panel is open, the page behind it doesn't scroll or switch tabs
addEventListener('wheel', e => { if (open && !(e.target instanceof Element && e.target.closest('.dh-panel'))) { e.preventDefault(); e.stopImmediatePropagation(); } else if (open) e.stopImmediatePropagation(); }, { capture: true, passive: false });
addEventListener('keydown', e => {
  if (!open) return;
  e.stopImmediatePropagation();
  if (e.key === 'Escape') { e.preventDefault(); hide(); return; }
  if (e.key === 'Tab') {   // keep focus inside the panel
    const f = [...panel.querySelectorAll('button, a[href], summary, [tabindex]:not([tabindex="-1"])')];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}, true);

// screenshot helper: ?thanks opens the panel on load
if (new URLSearchParams(location.search).has('thanks')) addEventListener('load', () => show(document.querySelector('#dl')?.href || '#'));
