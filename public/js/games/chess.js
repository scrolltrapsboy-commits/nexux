import { h, loadCss, mmss } from '../core.js';
loadCss('/css/g-board.css');

const FILES = 'abcdefgh', NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const sqName = i => FILES[i & 7] + (8 - (i >> 3));
const sqIdx = s => (8 - +s[1]) * 8 + FILES.indexOf(s[0]);
const isWhite = ch => ch === ch.toUpperCase();
const sprite = ch => (isWhite(ch) ? 'w' : 'b') + ch.toLowerCase();
const svgOf = ch => '<svg viewBox="0 0 40 40" aria-hidden="true"><use href="/assets/pieces.svg#' + sprite(ch) + '"/></svg>';

/* ---- FEN + a small legal-move generator, used only to draw move hints (the server stays authoritative) ---- */
function parseFen(fen) {
  const [pl, tm, ca, ep] = fen.split(' '), b = Array(64).fill(null);
  pl.split('/').forEach((row, r) => { let c = 0; for (const ch of row) { if (/\d/.test(ch)) c += +ch; else b[r * 8 + c++] = ch; } });
  return { b, white: tm === 'w', ca: ca || '-', ep: ep && ep !== '-' ? sqIdx(ep) : -1 };
}
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], OR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const on = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
function attacked(b, sq, byWhite) {
  const r = sq >> 3, c = sq & 7, at = (rr, cc) => (on(rr, cc) ? b[rr * 8 + cc] : null);
  const pr = byWhite ? r + 1 : r - 1, pawn = byWhite ? 'P' : 'p';
  if (at(pr, c - 1) === pawn || at(pr, c + 1) === pawn) return true;
  const own = ch => ch && isWhite(ch) === byWhite ? ch.toLowerCase() : null;
  for (const [dr, dc] of KN) if (own(at(r + dr, c + dc)) === 'n') return true;
  for (const [dr, dc] of KG) if (own(at(r + dr, c + dc)) === 'k') return true;
  for (const [set, kinds] of [[DG, 'bq'], [OR, 'rq']]) for (const [dr, dc] of set) {
    let y = r + dr, x = c + dc;
    while (on(y, x)) { const p = b[y * 8 + x]; if (p) { const k = own(p); if (k && kinds.includes(k)) return true; break; } y += dr; x += dc; }
  }
  return false;
}
function pseudo(st, from) {
  const b = st.b, p = b[from]; if (!p) return [];
  const w = isWhite(p), k = p.toLowerCase(), r = from >> 3, c = from & 7, out = [];
  const add = (y, x) => { if (!on(y, x)) return false; const t = b[y * 8 + x]; if (t && isWhite(t) === w) return false; out.push(y * 8 + x); return !t; };
  if (k === 'p') {
    const d = w ? -1 : 1, start = w ? 6 : 1;
    if (on(r + d, c) && !b[(r + d) * 8 + c]) { out.push((r + d) * 8 + c); if (r === start && !b[(r + 2 * d) * 8 + c]) out.push((r + 2 * d) * 8 + c); }
    for (const dc of [-1, 1]) if (on(r + d, c + dc)) { const t = b[(r + d) * 8 + c + dc]; if ((t && isWhite(t) !== w) || (r + d) * 8 + c + dc === st.ep) out.push((r + d) * 8 + c + dc); }
  } else if (k === 'n') KN.forEach(([dr, dc]) => add(r + dr, c + dc));
  else if (k === 'k') {
    KG.forEach(([dr, dc]) => add(r + dr, c + dc));
    const home = w ? 60 : 4, rk = w ? 'R' : 'r';
    if (from === home && !attacked(b, home, !w)) {
      if (st.ca.includes(w ? 'K' : 'k') && !b[home + 1] && !b[home + 2] && b[home + 3] === rk && !attacked(b, home + 1, !w) && !attacked(b, home + 2, !w)) out.push(home + 2);
      if (st.ca.includes(w ? 'Q' : 'q') && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === rk && !attacked(b, home - 1, !w) && !attacked(b, home - 2, !w)) out.push(home - 2);
    }
  } else {
    const dirs = k === 'b' ? DG : k === 'r' ? OR : [...DG, ...OR];
    for (const [dr, dc] of dirs) { let y = r + dr, x = c + dc; while (add(y, x)) { y += dr; x += dc; } }
  }
  return out;
}
function legalFrom(st, from) {
  const p = st.b[from], w = isWhite(p);
  return pseudo(st, from).filter(to => {
    const b = st.b.slice(); b[to] = b[from]; b[from] = null;
    if (p.toLowerCase() === 'p' && to === st.ep && from % 8 !== to % 8) b[(from >> 3) * 8 + (to & 7)] = null;
    if (p.toLowerCase() === 'k' && Math.abs(to - from) === 2) { const rk = b[to > from ? to + 1 : to - 2]; b[to > from ? to + 1 : to - 2] = null; b[(from + to) / 2] = rk; }
    const king = b.indexOf(w ? 'K' : 'k');
    return king >= 0 && !attacked(b, king, !w);
  });
}

export default {
  seat(R, i, now) {
    const s = R.state, sub = i === 0 ? 'White' : 'Black';
    if (!s || !s.clock) return { sub };
    let left = s.clock[i];
    if (R.status === 'playing' && s.turn === i) left -= now - s.ts;
    return { sub, badge: mmss(left), low: R.status === 'playing' && left < 20000 };
  },
  status(R, api) {
    const s = R.state; if (!s || R.status !== 'playing' || !s.chk) return null;
    if (R.watching) return api.name(s.turn) + ' is in check';
    return s.turn === R.youIdx ? { t: 'Your turn · you are in check', turn: true } : 'Check! ' + api.name(s.turn) + '’s turn';
  },
  mount(el, api) {
    const cells = [], sqs = Array.from({ length: 64 }, (_, i) => {
      const r = i >> 3, c = i & 7, e = h('button', { class: 'sq' + ((r + c) % 2 ? ' d' : ''), 'aria-label': sqName(i), onclick: () => click(i) }, h('i', { class: 'mk' }));
      e._p = undefined; cells.push(e); return e;
    });
    const board = h('div', { class: 'cg-board gb-frame', role: 'grid', 'aria-label': 'Chess board' }, sqs);
    const mv = h('div', { class: 'cg-mv', role: 'log', 'aria-label': 'Move list' });
    const wrap = h('div', { class: 'gb cg' }, h('div', { style: { position: 'relative' } }, board), mv);
    const boardHost = wrap.firstChild; el.append(wrap);
    let R = null, st = null, sel = -1, tg = new Set(), flip = null, fenKey = '', movesKey = null, promo = null;

    function layoutFlip(f) {
      flip = f;
      sqs.forEach((e, i) => {
        const r = i >> 3, c = i & 7, dr = f ? 7 - r : r, dc = f ? 7 - c : c;
        e.style.gridRow = dr + 1; e.style.gridColumn = dc + 1;
        if (dc === 0) e.dataset.rk = 8 - r; else delete e.dataset.rk;
        if (dr === 7) e.dataset.fl = FILES[c]; else delete e.dataset.fl;
      });
    }
    const mine = i => { const p = st.b[i]; return p && R.youIdx >= 0 && isWhite(p) === (R.youIdx === 0); };
    function clearSel() { sel = -1; tg = new Set(); paint(); }
    function select(i) { sel = i; tg = new Set(legalFrom(st, i)); paint(); }
    function click(i) {
      if (promo || !R || !st || R.status !== 'playing' || !api.myTurn()) return;
      if (sel >= 0 && tg.has(i)) return go(sel, i);
      if (mine(i) && i !== sel) select(i); else clearSel();
    }
    function go(from, to) {
      const p = st.b[from], last = (to >> 3) === 0 || (to >> 3) === 7;
      if (p.toLowerCase() === 'p' && last) return askPromo(from, to, isWhite(p));
      send({ from: sqName(from), to: sqName(to) });
    }
    function send(m) { clearSel(); api.move(m); }
    function askPromo(from, to, w) {
      const pick = k => { closePromo(); send({ from: sqName(from), to: sqName(to), promotion: k }); };
      const btns = ['q', 'r', 'b', 'n'].map(k => h('button', { 'aria-label': 'Promote to ' + NAMES[k], html: svgOf(w ? k.toUpperCase() : k), onclick: e => { e.stopPropagation(); pick(k); } }));
      promo = h('div', { class: 'cg-promo', role: 'dialog', 'aria-label': 'Choose promotion piece', onclick: () => { closePromo(); clearSel(); } }, h('div', null, btns));
      boardHost.append(promo); btns[0].focus();
    }
    function closePromo() { if (promo) promo.remove(); promo = null; }

    function paint() {
      if (!st) return;
      const my = R.status === 'playing' && api.myTurn(), s = R.state;
      const king = s.chk ? st.b.indexOf(st.white ? 'K' : 'k') : -1, last = s.last ? s.last.map(sqIdx) : [];
      sqs.forEach((e, i) => {
        const p = st.b[i];
        if (e._p !== p) {
          const had = e._p; e._p = p; e.querySelectorAll('svg').forEach(x => x.remove());
          if (p) { e.insertAdjacentHTML('afterbegin', svgOf(p)); }
          e.setAttribute('aria-label', sqName(i) + (p ? ', ' + (isWhite(p) ? 'white ' : 'black ') + NAMES[p.toLowerCase()] : ', empty'));
          if (had !== undefined && last[1] === i) { e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }
        }
        const t = tg.has(i);
        e.classList.toggle('last', last.includes(i)); e.classList.toggle('chk', i === king); e.classList.toggle('sel', i === sel);
        e.classList.toggle('tg', t); e.classList.toggle('cap', t && (!!p || (i === st.ep && st.b[sel] && st.b[sel].toLowerCase() === 'p')));
        e.classList.toggle('can', my && (t || (mine(i) && i !== sel)));
        e.disabled = !my;
      });
    }
    function drawMoves(s) {
      const mk = s.moves.join(' '); if (mk === movesKey) return; movesKey = mk;
      mv.replaceChildren();
      if (!s.moves.length) { mv.append(h('span', { class: 'e' }, 'No moves yet')); return; }
      s.moves.forEach((m, i) => {
        if (i % 2 === 0) mv.append(h('span', { class: 'n' }, (i / 2 + 1) + '.'));
        mv.append(h('span', { class: 'm' + (i === s.moves.length - 1 ? ' l' : '') }, m));
      });
      mv.scrollLeft = mv.scrollWidth;
    }
    return {
      update(r) {
        R = r; const s = r.state; if (!s) return;
        const f = r.youIdx === 1; if (flip !== f) layoutFlip(f);
        st = parseFen(s.fen);
        const key = s.fen + '|' + s.turn; if (key !== fenKey) { if (fenKey) api.sfx('move'); fenKey = key; sel = -1; tg = new Set(); closePromo(); }
        else if (sel >= 0 && (!api.myTurn() || !mine(sel))) { sel = -1; tg = new Set(); }
        drawMoves(s); paint();
      },
      destroy() { },
    };
  },
};
