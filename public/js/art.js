// Monochrome line art for each game card (64x64, stroke = currentColor).
import { h } from './core.js';
const A = {
  chess: '<path d="M32 8v6M29 11h6"/><path d="M24 24c0-6 3-9 8-9s8 3 8 9c0 5-3 7-3 11h-10c0-4-3-6-3-11z"/><path d="M20 50h24M22 44h20l-2-9H24z"/>',
  tictactoe: '<path d="M24 10v44M40 10v44M10 24h44M10 40h44"/><path d="M13 13l8 8M21 13l-8 8"/><circle cx="48" cy="48" r="5"/>',
  connect4: '<rect x="8" y="12" width="48" height="42" rx="6"/><circle cx="20" cy="24" r="5"/><circle cx="32" cy="24" r="5"/><circle cx="44" cy="24" r="5"/><circle cx="20" cy="40" r="5" fill="currentColor"/><circle cx="32" cy="40" r="5"/><circle cx="44" cy="40" r="5" fill="currentColor"/>',
  checkers: '<rect x="8" y="8" width="48" height="48" rx="6"/><path d="M8 32h48M32 8v48"/><circle cx="20" cy="20" r="6" fill="currentColor"/><circle cx="44" cy="44" r="6"/><circle cx="44" cy="44" r="2.5"/>',
  reversi: '<rect x="8" y="8" width="48" height="48" rx="8"/><circle cx="25" cy="25" r="9" fill="currentColor"/><circle cx="39" cy="39" r="9"/><circle cx="39" cy="25" r="3"/><circle cx="25" cy="39" r="3"/>',
  gomoku: '<path d="M10 20h44M10 32h44M10 44h44M20 10v44M32 10v44M44 10v44"/><circle cx="20" cy="20" r="4.5" fill="currentColor"/><circle cx="32" cy="32" r="4.5" fill="currentColor"/><circle cx="44" cy="44" r="4.5" fill="currentColor"/><circle cx="32" cy="20" r="4.5" fill="var(--bg)"/>',
  battleship: '<path d="M8 40h48l-6 12H14z"/><path d="M20 40V28h16v12M36 28l10 12M28 28v-8h6"/><path d="M6 56c6-4 10 4 16 0s10 4 16 0 10 4 20 0" opacity=".5"/>',
  memory: '<rect x="8" y="12" width="22" height="30" rx="5"/><rect x="34" y="22" width="22" height="30" rx="5" fill="currentColor" opacity=".18"/><rect x="34" y="22" width="22" height="30" rx="5"/><path d="M45 32v10M40 37h10"/>',
  rps: '<path d="M16 38V22a4 4 0 018 0v8M24 28V16a4 4 0 018 0v12M32 28V18a4 4 0 018 0v12M40 30v-6a4 4 0 018 0v16c0 9-7 14-15 14-8 0-14-5-17-12l-4-8a3.5 3.5 0 016-3.5z"/>',
  reaction: '<circle cx="32" cy="34" r="20"/><path d="M32 22v12l8 4M26 8h12"/><path d="M50 14l4-4"/>',
  minesweeper: '<circle cx="32" cy="34" r="13" fill="currentColor"/><path d="M32 12v8M32 48v8M10 34h8M46 34h8M16 18l6 6M42 44l6 6M48 18l-6 6M22 44l-6 6"/><circle cx="27" cy="29" r="3" fill="var(--bg)"/>',
  wordbattle: '<rect x="8" y="14" width="22" height="22" rx="5"/><rect x="34" y="28" width="22" height="22" rx="5" fill="currentColor"/><path d="M14 30l5-12 5 12M16 26h6" /><path d="M41 35h8M45 35v10" stroke="var(--bg)"/>',
  golf: '<path d="M18 52V10l22 9-22 9"/><ellipse cx="22" cy="52" rx="16" ry="4"/><circle cx="46" cy="48" r="4" fill="currentColor"/><path d="M36 54c4-2 7-4 8-6" stroke-dasharray="2 4"/>',
  carrom: '<rect x="8" y="8" width="48" height="48" rx="7"/><circle cx="32" cy="32" r="10"/><circle cx="32" cy="32" r="3" fill="currentColor"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/><circle cx="52" cy="12" r="3.5" fill="currentColor"/><circle cx="12" cy="52" r="3.5" fill="currentColor"/><circle cx="52" cy="52" r="3.5" fill="currentColor"/>',
  racing: '<path d="M10 44l4-12 8-6h20l8 6 4 12v6H10z"/><circle cx="20" cy="50" r="5" fill="var(--bg)"/><circle cx="44" cy="50" r="5" fill="var(--bg)"/><path d="M22 26l3 8h14l3-8M26 34h12"/>',
  snakesladders: '<path d="M14 54l10-10-7-7 10-10-7-7 10-10"/><path d="M40 10l10 10-7 7 7 7-10 10 7 7-7 7"/><path d="M10 56h44"/>',
  cards: '<rect x="8" y="14" width="26" height="38" rx="5" transform="rotate(-10 21 33)"/><rect x="26" y="12" width="26" height="38" rx="5" transform="rotate(8 39 31)" fill="currentColor" opacity=".16"/><rect x="26" y="12" width="26" height="38" rx="5" transform="rotate(8 39 31)"/><path d="M39 24l5 8-5 8-5-8z" transform="rotate(8 39 31)"/>',
  dots: '<g fill="currentColor"><circle cx="12" cy="12" r="3"/><circle cx="32" cy="12" r="3"/><circle cx="52" cy="12" r="3"/><circle cx="12" cy="32" r="3"/><circle cx="32" cy="32" r="3"/><circle cx="52" cy="32" r="3"/><circle cx="12" cy="52" r="3"/><circle cx="32" cy="52" r="3"/><circle cx="52" cy="52" r="3"/></g><path d="M12 12h20M32 12v20M32 32h20"/>',
  pong: '<rect x="8" y="18" width="6" height="22" rx="3" fill="currentColor"/><rect x="50" y="26" width="6" height="22" rx="3" fill="currentColor"/><circle cx="32" cy="32" r="4" fill="currentColor"/><path d="M32 8v6M32 20v6M32 38v6M32 50v6" opacity=".5"/>',
};
export const art = (id, size = 64) => h('span', { class: 'art', style: { width: size + 'px', height: size + 'px' }, html: `<svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${A[id] || A.cards}</svg>` });
