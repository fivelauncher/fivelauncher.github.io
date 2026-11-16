// Website-only changes to the live demo. These are not part of the launcher.
// 1. Import is switched off: the top-bar Import button does nothing here and looks disabled.
// 2. The Home music starts muted, so the page never plays sound by surprise. The music button turns it on.
try { if (localStorage.getItem('five.musicMuted') == null) localStorage.setItem('five.musicMuted', 'true'); } catch { /* storage blocked */ }
addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#impBtn');
  if (b) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
const css = document.createElement('style');
css.textContent = '#impBtn{opacity:.4;cursor:not-allowed}#impBtn:hover{filter:none;transform:none}';
document.head.appendChild(css);
new MutationObserver(() => {
  const b = document.getElementById('impBtn');
  if (b && !b.hasAttribute('aria-disabled')) { b.setAttribute('aria-disabled', 'true'); b.title = 'Import works in the real launcher'; }
}).observe(document.documentElement, { childList: true, subtree: true });
