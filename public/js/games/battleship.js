import { h, loadCss, toast } from '../core.js';
loadCss('/css/g-board.css');
const FLEET = [5, 4, 3, 3, 2];
const XS = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8"/></svg>';
const L = i => 'ABCDEFGHIJ'[i % 10] + (((i / 10) | 0) + 1);
const cellsOf = (len, x, y, hz) => Array.from({ length: len }, (_, k) => (y + (hz ? 0 : k)) * 10 + x + (hz ? k : 0));
const inB = (len, x, y, hz) => x >= 0 && y >= 0 && (hz ? x + len <= 10 && y < 10 : y + len <= 10 && x < 10);

export default {
  seat(R, i) {
    const s = R.state; if (!s) return {};
    if (s.phase === 'place') return { sub: s.ready[i] ? 'Fleet ready' : 'Placing fleet' };
    return { sub: 'Ships sunk', badge: s.sunk[i] + '/5' };
  },
  status(R) {
    const s = R.state; if (!s || R.status !== 'playing') return null;
    if (s.phase === 'place') return R.watching ? 'Players are placing ships' : s.ready[R.youIdx] ? 'Waiting for opponent…' : 'Place your fleet';
    if (!R.watching && s.turn === R.youIdx) return { t: 'Your turn · fire!', turn: true };
    return null;
  },
  mount(el, api) {
    let R = null, ships = FLEET.map(len => ({ len, x: -1, y: -1, h: true })), sel = 0, horiz = true, hover = -1, focus = 'enemy', sending = false, lastShots = '';
    const placed = sh => sh.x >= 0;
    const occ = (skip) => { const m = new Map(); ships.forEach((sh, k) => { if (k !== skip && placed(sh)) cellsOf(sh.len, sh.x, sh.y, sh.h).forEach(c => m.set(c, k)); }); return m; };
    const fits = (k, x, y, hz) => { const sh = ships[k]; if (!inB(sh.len, x, y, hz)) return false; const o = occ(k); return cellsOf(sh.len, x, y, hz).every(c => !o.has(c)); };

    /* ---------- placement UI ---------- */
    const pCells = Array.from({ length: 100 }, (_, i) => h('button', { class: 'bc w', 'aria-label': L(i), onclick: () => pClick(i), onpointerenter: () => { hover = i; drawPlace(); } }, h('i', { class: 'mk' })));
    const pGrid = h('div', { class: 'bs-grid gb-frame', role: 'grid', 'aria-label': 'Your fleet grid', onpointerleave: () => { hover = -1; drawPlace(); } }, pCells);
    const tray = FLEET.map((len, k) => h('button', { class: 'bs-ship', 'aria-label': 'Ship of length ' + len, onclick: () => { sel = k; if (placed(ships[k])) horiz = ships[k].h; drawPlace(); } }, Array.from({ length: len }, () => h('i'))));
    const note = h('div', { class: 'bs-note', 'aria-live': 'polite' });
    const bRot = h('button', { class: 'btn sm', 'aria-label': 'Rotate selected ship', onclick: rotate }, 'Rotate');
    const bRnd = h('button', { class: 'btn sm', 'aria-label': 'Place ships randomly', onclick: randomize }, 'Randomize');
    const bClr = h('button', { class: 'btn sm', 'aria-label': 'Clear all ships', onclick: () => { ships.forEach(s => { s.x = s.y = -1; }); sel = 0; drawPlace(); } }, 'Clear');
    const bGo = h('button', { class: 'btn sm primary', 'aria-label': 'Ready, lock in fleet', onclick: ready }, 'Ready');
    const tools = h('div', { class: 'bs-tools' }, h('div', { class: 'bs-tray' }, tray), h('div', { class: 'bs-btns' }, bRot, bRnd, bClr, bGo), note);
    const placeBox = h('div', { class: 'bs-place' }, pGrid, tools);

    function pClick(i) {
      if (R.state.ready[R.youIdx]) return;
      const o = occ(-1); if (o.has(i) && o.get(i) !== sel) { sel = o.get(i); horiz = ships[sel].h; drawPlace(); return; }
      const sh = ships[sel]; let x = i % 10, y = (i / 10) | 0;
      x = Math.min(x, horiz ? 10 - sh.len : 9); y = Math.min(y, horiz ? 9 : 10 - sh.len);
      if (!fits(sel, x, y, horiz)) { api.sfx('err'); toast('Ships cannot overlap'); return; }
      Object.assign(sh, { x, y, h: horiz }); api.sfx('tick');
      const nx = ships.findIndex(s => !placed(s)); if (nx >= 0) sel = nx;
      hover = -1; drawPlace();
    }
    function rotate() {
      horiz = !horiz; const sh = ships[sel];
      if (placed(sh)) {
        let x = Math.min(sh.x, horiz ? 10 - sh.len : 9), y = Math.min(sh.y, horiz ? 9 : 10 - sh.len);
        if (fits(sel, x, y, horiz)) Object.assign(sh, { x, y, h: horiz }); else { horiz = !horiz; api.sfx('err'); toast('No room to rotate here'); }
      }
      drawPlace();
    }
    function randomize() {
      for (let tries = 0; tries < 50; tries++) {
        ships.forEach(s => { s.x = s.y = -1; }); let ok = true;
        for (let k = 0; k < ships.length && ok; k++) {
          ok = false;
          for (let t = 0; t < 200 && !ok; t++) { const hz = Math.random() < .5, x = (Math.random() * (hz ? 11 - ships[k].len : 10)) | 0, y = (Math.random() * (hz ? 10 : 11 - ships[k].len)) | 0; if (fits(k, x, y, hz)) { Object.assign(ships[k], { x, y, h: hz }); ok = true; } }
        }
        if (ok) break;
      }
      sel = 0; drawPlace();
    }
    async function ready() {
      if (sending || !ships.every(placed)) return; sending = true; drawPlace();
      const err = await api.move({ t: 'place', ships: ships.map(s => ({ len: s.len, x: s.x, y: s.y, h: s.h })) });
      sending = false; if (!err) api.sfx('move'); drawPlace();
    }
    function drawPlace() {
      if (!R || !R.state) return;
      const s = R.state, locked = s.ready[R.youIdx];
      if (locked && !ships.every(placed) && s.mine) ships = s.mine.map(cs => ({ len: cs.length, x: cs[0] % 10, y: (cs[0] / 10) | 0, h: cs.length > 1 ? cs[1] === cs[0] + 1 : true }));
      const o = occ(-1), pv = new Map();
      if (!locked && hover >= 0 && sel >= 0) {
        const sh = ships[sel]; let x = Math.min(hover % 10, horiz ? 10 - sh.len : 9), y = Math.min((hover / 10) | 0, horiz ? 9 : 10 - sh.len), ok = fits(sel, x, y, horiz);
        cellsOf(sh.len, x, y, horiz).forEach(c => pv.set(c, ok));
      }
      pCells.forEach((e, i) => {
        const k = o.get(i); let cls = 'bc w';
        if (k != null) { const sh = ships[k], idx = i === cellsOf(sh.len, sh.x, sh.y, sh.h)[0] ? 0 : i === cellsOf(sh.len, sh.x, sh.y, sh.h)[sh.len - 1] ? 1 : -1; cls = 'bc ship' + (sh.h ? '' : ' v') + (idx >= 0 ? ' e' + idx : '') + (k === sel && !locked ? ' sel' : ''); }
        else if (pv.has(i)) cls += ' pv' + (pv.get(i) ? '' : ' bad');
        e.className = cls; e.disabled = locked; e.setAttribute('aria-label', L(i) + (k != null ? ', ship' : ', water'));
      });
      tray.forEach((b, k) => { b.className = 'bs-ship' + (k === sel && !locked ? ' on' : '') + (placed(ships[k]) ? ' done' : ''); b.disabled = locked; });
      const all = ships.every(placed); bGo.disabled = locked || !all || sending; bRot.disabled = bRnd.disabled = bClr.disabled = locked;
      note.textContent = locked ? 'Fleet locked in. Waiting for opponent…' : all ? 'All ships placed. Press Ready.' : 'Select a ship, then tap a cell. ' + ships.filter(placed).length + '/5 placed';
      bRot.title = horiz ? 'Horizontal' : 'Vertical';
    }

    /* ---------- battle UI ---------- */
    const mkGrid = interactive => Array.from({ length: 100 }, (_, i) => h(interactive ? 'button' : 'div', interactive ? { class: 'bc w enemy', onclick: () => { if (api.myTurn()) api.move({ t: 'fire', c: i }); } } : { class: 'bc w' }, h('i', { class: 'mk', html: XS })));
    const eCells = mkGrid(true), mCells = mkGrid(false);
    const eCap = h('div', { class: 'bs-cap' }), mCap = h('div', { class: 'bs-cap' });
    const eBox = h('div', { class: 'bsb enemyb', onclick: () => { if (eBox.classList.contains('small')) { focus = 'enemy'; drawBattle(); } } }, eCap, h('div', { class: 'bs-grid gb-frame', role: 'grid', 'aria-label': 'Enemy waters' }, eCells));
    const mBox = h('div', { class: 'bsb mineb', role: 'button', tabindex: 0, onclick: () => { if (mBox.classList.contains('small')) { focus = 'mine'; drawBattle(); } }, onkeydown: e => { if ((e.key === 'Enter' || e.key === ' ') && mBox.classList.contains('small')) { e.preventDefault(); focus = 'mine'; drawBattle(); } } }, mCap, h('div', { class: 'bs-grid gb-frame', role: 'grid', 'aria-label': 'Your fleet' }, mCells));
    const battleBox = h('div', { class: 'bs-battle' }, eBox, mBox);

    function paintShots(cells, shots, shipSet, lastC, canFire, enemy) {
      const m = new Map(shots.map(x => [x.c, x.h]));
      cells.forEach((e, i) => {
        const has = m.has(i), hit = has && m.get(i), isShip = shipSet && shipSet.has(i);
        const freshShot = has && !e._hadShot; e._hadShot = has;
        e.className = 'bc' + (enemy ? ' enemy' : '') + (isShip ? ' ship' : ' w') + (hit ? ' hit' : has ? ' miss' : '') + (freshShot ? ' impact' : '') + (i === lastC ? ' lastshot' : '') + (canFire && !has ? ' fire' : '');
        if (e.tagName === 'BUTTON') { e.disabled = !canFire || has; }
        e.setAttribute('aria-label', L(i) + (has ? (hit ? ', hit' : ', miss') : isShip ? ', your ship' : canFire ? ', fire' : ', unknown'));
      });
    }
    function drawBattle() {
      const s = R.state, me = R.youIdx, watch = me < 0, last = a => (a.length ? a[a.length - 1].c : -1);
      const A = watch ? s.shots[0] : s.shots[me], B = watch ? s.shots[1] : s.shots[1 - me];
      const mine = !watch && s.mine ? new Set(s.mine.flat()) : null, can = !watch && R.status === 'playing' && api.myTurn();
      paintShots(eCells, A, null, last(A), can, true); paintShots(mCells, B, mine, last(B), false, false);
      if (watch) {
        eCap.replaceChildren(h('span', null, api.name(0) + ' fires'), h('em', null, s.sunk[0] + '/5 sunk')); mCap.replaceChildren(h('span', null, api.name(1) + ' fires'), h('em', null, s.sunk[1] + '/5 sunk'));
        eBox.setAttribute('aria-label', 'Shots by ' + api.name(0));
      } else {
        eCap.replaceChildren(h('span', null, 'Enemy waters'), h('em', null, s.sunk[me] + '/5 sunk')); mCap.replaceChildren(h('span', null, 'Your fleet'), h('em', null, (5 - s.sunk[1 - me]) + '/5 afloat'));
      }
      mBox.setAttribute('aria-label', watch ? 'Shots by ' + api.name(1) : (mBox.classList.contains('small') ? 'Show your fleet at full size' : 'Your fleet'));
      const big = watch ? 'enemy' : focus;
      eBox.classList.toggle('big', big === 'enemy'); eBox.classList.toggle('small', big !== 'enemy');
      mBox.classList.toggle('big', big === 'mine'); mBox.classList.toggle('small', big !== 'mine');
      if (watch) mBox.removeAttribute('role');
      if (eBox.classList.contains('small')) eBox.setAttribute('role', 'button'); else eBox.removeAttribute('role');
    }

    el.append(h('div', { class: 'gb bs' }, placeBox, battleBox));
    return {
      update(r) {
        R = r; const s = r.state; if (!s) return;
        const place = s.phase === 'place'; placeBox.hidden = !place; battleBox.hidden = place;
        if (place && r.youIdx >= 0) drawPlace();
        else {
          if (place) { placeBox.hidden = true; battleBox.hidden = false; }
          const k = s.shots[0].length + ':' + s.shots[1].length;
          if (k !== lastShots) { if (lastShots) api.sfx('move'); lastShots = k; if (r.youIdx >= 0 && s.turn === r.youIdx) focus = 'enemy'; }
          drawBattle();
        }
      }, destroy() { },
    };
  },
};
