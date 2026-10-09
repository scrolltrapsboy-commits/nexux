// Small helpers shared by the canvas games (Mini Golf, Carrom, Nexus Grand Prix).
import { h } from '../core.js';
export const theme = () => {
  const cs = getComputedStyle(document.documentElement), dark = document.documentElement.dataset.theme !== 'light';
  return { dark, fg: cs.getPropertyValue('--fg').trim() || '#f4f4f6', bg: cs.getPropertyValue('--bg').trim() || '#09090b', fg2: cs.getPropertyValue('--fg2').trim() || '#b4b4bc', fg3: cs.getPropertyValue('--fg3').trim() || '#7c7c86', line: cs.getPropertyValue('--line2').trim() || 'rgba(255,255,255,.2)' };
};
// a canvas that always fills its wrapper, with devicePixelRatio scaling. onSize(w, h) gets CSS pixels.
export function fullCanvas(wrap, label, onSize) {
  const cv = h('canvas', { class: 'gp-cv', role: 'img', 'aria-label': label, tabindex: 0 }); wrap.append(cv);
  const ctx = cv.getContext('2d'); let w = 0, hh = 0, dpr = 1;
  const size = () => {
    const r = wrap.getBoundingClientRect(); if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2); w = Math.round(r.width); hh = Math.round(r.height);
    cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); onSize && onSize(w, hh);
  };
  const ro = new ResizeObserver(size); ro.observe(wrap); requestAnimationFrame(size);
  return { cv, ctx, size: () => ({ w, h: hh }), destroy: () => ro.disconnect() };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const decodeTrack = (f) => { const pts = [[f[0] / 10, f[1] / 10]]; let x = f[0], y = f[1]; for (let i = 2; i + 1 < f.length; i += 2) { x += f[i]; y += f[i + 1]; pts.push([x / 10, y / 10]); } return pts; };
