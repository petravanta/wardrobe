'use strict';
/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, ms = 2600) {
  clearTimeout(toastTimer); let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; toastTimer = setTimeout(() => t.remove(), ms);
}
