import { h, loadCss } from '../core.js';
loadCss('/css/g-arcade.css');
export default {
  seat: (R, i) => ({ sub: 'First to ' + R.state.target, badge: R.state.scores[i], active: false }),
  status(R, api) {
    const s = R.state;
    if (R.watching) return 'Round ' + s.round;
    return { count: 'Get ready', wait: 'Wait for white…', go: 'TAP!', result: 'Round ' + s.round }[s.phase] || 'Play!';
  },
  mount(el, api) {
    const hud = h('div', { class: 'rx-hud' }), big = h('div', { class: 'rx-big' }), sub = h('div', { class: 'rx-sub' }), note = h('div', { class: 'rx-note' });
    const hint = h('div', { class: 'rx-hint' }, 'Tap anywhere, or press Space / Enter');
    const live = h('div', { class: 'sr', 'aria-live': 'polite' });
    const btn = h('button', { class: 'rx count', 'aria-label': 'Reaction area' }, hud, big, sub, note, hint);
    el.append(btn, live);
    let R = null, lastPhase = '', lastFs = false, liveTxt = '';
    const me = () => (R ? R.youIdx : -1);
    function tap() {
      if (!R || R.status !== 'playing' || me() < 0) return;
      const s = R.state; if (s.phase !== 'wait' && s.phase !== 'go') return;
      if (s.fs[me()]) return;
      api.move({});
    }
    btn.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); tap(); });
    btn.addEventListener('click', e => e.preventDefault());
    const key = e => {
      if (e.key !== ' ' && e.key !== 'Enter' && e.code !== 'Space') return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'SELECT') && t !== btn) return;
      if (!R || (R.state.phase !== 'wait' && R.state.phase !== 'go')) return;
      e.preventDefault(); if (!e.repeat) tap();
    };
    document.addEventListener('keydown', key);
    const pips = (i, s) => h('div', { class: 'rx-pips', role: 'img', 'aria-label': api.name(i) + ' has ' + s.scores[i] + ' of ' + s.target }, Array.from({ length: s.target }, (_, k) => h('i', { class: 'rx-pip' + (k < s.scores[i] ? ' on' : '') })));
    const side = (i, s, cls) => h('div', { class: 'rx-side ' + cls }, h('span', { class: 'n' }, (R.youIdx === i ? 'You' : api.name(i))), pips(i, s));
    function draw() {
      if (!R) return; const s = R.state, m = me(), now = api.now();
      let t = '', st = '', nt = '', cls = s.phase;
      if (s.phase === 'count') { const n = Math.min(3, Math.max(1, Math.ceil((s.cdAt - now) / 1000))); t = s.cdAt - now > 0 ? String(n) : '…'; st = 'Get ready'; nt = m >= 0 ? 'Do not tap until the screen turns white' : ''; }
      else if (s.phase === 'wait') { t = 'Wait…'; if (m >= 0 && s.fs[m]) { st = 'You jumped the gun'; nt = 'Waiting for the round to finish'; } else { st = 'Tap only when it turns white'; } }
      else if (s.phase === 'go') { if (m >= 0 && s.fs[m]) { t = 'Locked out'; st = 'You jumped the gun'; } else { t = 'TAP!'; st = ''; } }
      else {
        const l = s.last || {};
        if (l.void && l.both) { t = 'Void'; st = 'Both players jumped the gun'; }
        else if (l.void) { t = 'Too slow'; st = 'Nobody tapped in time'; if (m >= 0 && s.fs[m]) nt = 'You jumped the gun'; }
        else { t = l.ms + ' ms'; st = (l.w === m ? 'You' : api.name(l.w)) + ' ' + l.ms + ' ms'; nt = l.w === m ? 'You won the round' : (m >= 0 && s.fs[m] ? 'You jumped the gun' : api.name(l.w) + ' was faster'); }
        if (R.status === 'finished') nt = nt || 'Match over';
      }
      const big_ = t.length > 4 && s.phase !== 'go'; big.className = 'rx-big' + (big_ || t === 'Locked out' ? ' t' : '');
      if (big.textContent !== t) { big.textContent = t; big.classList.remove('rx-pop'); void big.offsetWidth; big.classList.add('rx-pop'); } if (sub.textContent !== st) sub.textContent = st; if (note.textContent !== nt) note.textContent = nt;
      btn.className = 'rx ' + cls + ((m < 0 || R.status !== 'playing' || (m >= 0 && s.fs[m] && (s.phase === 'wait' || s.phase === 'go'))) && (s.phase === 'wait' || s.phase === 'go') ? ' lock' : '');
      btn.setAttribute('aria-label', s.phase === 'go' ? 'Tap now' : s.phase === 'wait' ? 'Wait, do not tap yet' : 'Reaction area: ' + t);
      btn.setAttribute('aria-disabled', m < 0 || R.status !== 'playing' ? 'true' : 'false');
      hint.hidden = m < 0 || (s.phase !== 'wait' && s.phase !== 'go');
      const lt = s.phase === 'result' ? st + (nt ? '. ' + nt : '') : s.phase === 'go' ? 'Tap!' : s.phase === 'wait' ? 'Wait' : ''; if (lt !== liveTxt) { liveTxt = lt; live.textContent = lt; }
    }
    const iv = setInterval(() => { if (R && R.state.phase === 'count') draw(); }, 100);
    return {
      update(r) {
        R = r; const s = r.state, m = me();
        hud.replaceChildren(side(0, s, 'l'), h('div', { class: 'rx-mid' }, 'Round ' + s.round), side(1, s, 'r'));
        draw();
        if (s.phase !== lastPhase) { if (s.phase === 'go') api.sfx('move'); lastPhase = s.phase; }
        const fs = m >= 0 && s.fs[m]; if (fs && !lastFs) api.sfx('err'); lastFs = fs;
      },
      destroy() { clearInterval(iv); document.removeEventListener('keydown', key); },
    };
  },
};
