import { h, loadCss, mmss } from '../core.js';
loadCss('/css/g-arcade.css');
const I = {
  shuffle: '<svg viewBox="0 0 24 24"><path d="M3 7h3c5 0 7 10 12 10h3M3 17h3c2 0 3.4-1.4 4.6-3.2M14 9c1.2-1.2 2.4-2 4-2h3M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9L3 12z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>',
  clear: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
const pts = n => (n < 3 ? 0 : { 3: 1, 4: 2, 5: 4, 6: 6, 7: 9 }[n] || 12);
export default {
  seat: (R, i) => ({ sub: 'Round ' + R.state.round + '/' + R.state.rounds, badge: R.state.scores[i], active: true }),
  status(R) { const s = R.state; return s.phase === 'between' ? 'Round ' + s.round + ' over' : { t: 'Round ' + s.round + '/' + s.rounds + ' · build words', turn: !R.watching }; },
  mount(el, api) {
    let R = null, letters = '', perm = [], sel = [], key = '', maxRem = 1, busy = false, wordsKey = '';
    const time = h('span', { class: 'wb-time', role: 'timer', 'aria-label': 'Time left' }, '0:00'), bar = h('i'), rnd = h('span');
    const cur = h('div', { class: 'wb-cur', 'aria-live': 'polite' }), tiles = h('div', { class: 'wb-tiles', role: 'group', 'aria-label': 'Letters' });
    const lists = h('div', { class: 'wb-lists' }), over = h('div', { class: 'wb-over', hidden: true });
    const bBack = h('button', { class: 'wb-ib', 'aria-label': 'Backspace', html: I.back, onclick: () => { sel.pop(); draw(); } });
    const bClear = h('button', { class: 'wb-ib', 'aria-label': 'Clear word', html: I.clear, onclick: () => { sel = []; draw(); } });
    const bShuf = h('button', { class: 'wb-ib', 'aria-label': 'Shuffle letters', html: I.shuffle, onclick: () => { for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } buildTiles(); draw(); } });
    const bGo = h('button', { class: 'wb-go', 'aria-label': 'Submit word', onclick: () => submit() }, 'Submit');
    const root = h('div', { class: 'wb' }, h('div', { class: 'wb-top' }, rnd, time, h('div', { class: 'wb-bar', 'aria-hidden': 'true' }, bar)), lists, cur, tiles, h('div', { class: 'wb-ctl' }, bShuf, bBack, bClear, bGo), over);
    el.append(root);
    let tb = [];
    function buildTiles() { tb = perm.map(li => h('button', { class: 'wb-t', 'aria-label': 'Letter ' + letters[li], onclick: () => tap(li) }, letters[li])); tiles.replaceChildren(...tb); }
    const canPlay = () => R && R.status === 'playing' && R.youIdx >= 0 && R.state.phase === 'play';
    const word = () => sel.map(li => letters[li]).join('');
    function tap(li) { if (!canPlay()) return; const at = sel.indexOf(li); if (at >= 0) sel.splice(at, 1); else sel.push(li); api.sfx('tick'); draw(); }
    function shake() { cur.classList.remove('ar-shake'); void cur.offsetWidth; cur.classList.add('ar-shake'); }
    async function submit() {
      if (!canPlay() || busy) return; const w = word();
      if (w.length < 3) { api.toast('Words need at least 3 letters.'); api.sfx('err'); shake(); return; }
      busy = true; draw(); const err = await api.move({ w }); busy = false;
      if (!err) { if (word() === w) sel = []; api.sfx('move'); } else shake();
      draw();
    }
    function draw() {
      const p = canPlay(), w = word();
      cur.replaceChildren(w ? h('div', { class: 'wb-word', 'aria-label': 'Current word ' + w }, w) : h('div', { class: 'wb-ph' }, p ? 'Tap letters or type a word' : 'Waiting…'), w.length >= 3 ? h('span', { class: 'wb-pts' }, '+' + pts(w.length)) : null);
      tb.forEach((b, p2) => { const used = sel.includes(perm[p2]); b.classList.toggle('used', used); b.disabled = !p; b.setAttribute('aria-pressed', used); });
      bBack.disabled = bClear.disabled = !p || !sel.length; bShuf.disabled = !p; bGo.disabled = !p || busy || w.length < 3;
    }
    const kd = e => {
      const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (!canPlay()) return;
      if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) submit(); }
      else if (e.key === 'Backspace') { e.preventDefault(); sel.pop(); draw(); }
      else if (e.key === 'Escape') { sel = []; draw(); }
      else if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
        e.preventDefault(); const ch = e.key.toUpperCase(), li = perm.find(l => letters[l] === ch && !sel.includes(l));
        if (li === undefined) { shake(); return; } sel.push(li); api.sfx('tick'); draw();
      }
    };
    document.addEventListener('keydown', kd);
    const col = (i, s, me) => h('div', { class: 'wb-col' + (me ? ' me' : ''), role: 'group', 'aria-label': 'Words by ' + api.name(i) },
      h('div', { class: 'wb-hd' }, h('span', null, me ? 'You' : api.name(i)), h('b', null, '+' + s.roundScores[i])),
      h('div', { class: 'wb-words' }, s.words[i].length ? s.words[i].map(x => h('span', { class: 'wb-chip' }, x.toUpperCase(), h('small', null, '+' + pts(x.length)))) : h('span', { class: 'wb-empty' }, 'No words yet')));
    const tick = () => {
      if (!R) return; const s = R.state, rem = s.endsAt - api.now();
      if (s.phase === 'play' && R.status === 'playing') { maxRem = Math.max(maxRem, rem); time.textContent = mmss(rem); time.classList.toggle('low', rem < 10000); bar.style.transform = 'scaleX(' + Math.max(0, Math.min(1, rem / maxRem)) + ')'; }
      else { time.textContent = '0:00'; time.classList.remove('low'); bar.style.transform = 'scaleX(0)'; }
    };
    const iv = setInterval(tick, 200);
    let prevN = 0, prevScroll = {};
    return {
      update(r) {
        R = r; const s = r.state, k = s.round + ':' + s.letters + ':' + s.gen;
        if (k !== key) { key = k; letters = s.letters; perm = [...letters].map((_, i) => i); sel = []; maxRem = 1; prevN = 0; buildTiles(); }
        rnd.textContent = 'Round ' + s.round + '/' + s.rounds;
        const me = r.youIdx, order = me >= 0 ? [me, 1 - me] : [0, 1];
        const nextWordsKey = JSON.stringify(s.words);
        if (nextWordsKey !== wordsKey) {
          const old = lists.querySelectorAll('.wb-words'); old.forEach((w, i) => { prevScroll[i] = w.scrollTop; });
          lists.replaceChildren(...order.map(i => col(i, s, i === me && me >= 0)));
          lists.querySelectorAll('.wb-words').forEach((w, i) => { w.scrollTop = w.scrollHeight; });
          wordsKey = nextWordsKey;
        }
        const n = s.words[0].length + s.words[1].length; if (n > prevN && prevN) api.sfx('tick'); prevN = n;
        if (s.phase === 'between' && s.last) {
          const l = s.last, last = s.round >= s.rounds, w = l[0] === l[1] ? -1 : l[0] > l[1] ? 0 : 1;
          over.hidden = false;
          over.replaceChildren(h('div', null, h('div', { class: 'sm' }, 'Round ' + s.round + ' of ' + s.rounds), h('div', { class: 'big' }, w < 0 ? 'Round tied' : (w === me ? 'You took the round' : api.name(w) + ' took the round')),
            h('div', { class: 'rs' }, [0, 1].map(i => h('div', null, h('b', null, '+' + l[i]), h('span', null, i === me ? 'You' : api.name(i))))),
            h('div', { class: 'sm' }, 'Total ' + s.scores[0] + ' : ' + s.scores[1]), h('div', { class: 'sm' }, last ? 'Final results coming up…' : 'Next round starting…')));
        } else over.hidden = true;
        tick(); draw();
      }, destroy() { clearInterval(iv); document.removeEventListener('keydown', kd); },
    };
  },
};
