import { h, icon, avatar, S, sock, ask, api, toast, store, setPref, modal, confirmBox, clear, applyPrefs } from '../core.js';

export default function settings(root, ctx) {
  ctx.title('Settings');
  const card = (title, ...kids) => h('section', { class: 'glass', style: { padding: '20px' } }, h('div', { class: 'h2', style: { marginBottom: '14px' } }, title), ...kids);
  const toggle = (label, desc, key) => { const val = () => key === 'theme' ? S.prefs.theme === 'light' : !!S.prefs[key]; const sw = h('button', { class: 'switch', role: 'switch', 'aria-checked': val(), 'aria-label': label, onclick: () => { setPref(key, key === 'theme' ? (val() ? 'dark' : 'light') : !S.prefs[key]); sw.setAttribute('aria-checked', val()); } }); return h('div', { class: 'row', style: { padding: '10px 0' } }, h('div', { class: 'grow' }, h('b', null, label), h('div', { class: 'small muted' }, desc)), sw); };
  const me = S.me, status = h('div', { class: 'err', role: 'alert' });
  const name = h('input', { class: 'inp', value: me.name, maxlength: 16, 'aria-label': 'Username' }), bio = h('textarea', { class: 'inp', maxlength: 140, rows: 3, 'aria-label': 'Bio', placeholder: 'A short line about you' }, me.bio || '');
  const picker = h('div', { class: 'avpick', role: 'radiogroup', 'aria-label': 'Avatar' });
  const drawPick = () => picker.replaceChildren(...Array.from({ length: 16 }, (_, i) => h('button', { class: S.me.avatar === i ? 'on' : '', role: 'radio', 'aria-checked': S.me.avatar === i, 'aria-label': 'Avatar ' + (i + 1), onclick: async () => { const r = await ask('avatar', { a: i }); if (r.error) toast(r.error); else { S.me = r.me; drawPick(); } } }, avatar(i, 100))));
  drawPick();
  const save = h('button', { class: 'btn primary', onclick: async e => { e.target.disabled = true; status.textContent = ''; const r = await ask('profile:update', { name: name.value, bio: bio.value }); e.target.disabled = false; if (r.error) status.textContent = r.error; else { S.me = r.me; toast('Profile saved'); } } }, 'Save profile');

  let account;
  if (me.guest) {
    const u = h('input', { class: 'inp', placeholder: 'Choose a username', maxlength: 16, autocomplete: 'username', 'aria-label': 'New username' }), p = h('input', { class: 'inp', type: 'password', placeholder: 'Password (8+ characters)', autocomplete: 'new-password', 'aria-label': 'Password' }), e2 = h('div', { class: 'err', role: 'alert' });
    account = card('Save your progress', h('p', { class: 'muted small', style: { marginBottom: '12px' } }, 'You are playing as a guest. Create an account to keep your rating, friends and achievements on any device.'), h('div', { class: 'field' }, u), h('div', { class: 'field' }, p), e2,
      h('button', { class: 'btn primary', onclick: async e => { e.target.disabled = true; const r = await api('/register', { username: u.value, password: p.value }); e.target.disabled = false; if (r.error) e2.textContent = r.error; else { store.set('np.token', r.token); toast('Account created'); setTimeout(() => location.reload(), 600); } } }, 'Create account'));
  } else {
    const o = h('input', { class: 'inp', type: 'password', placeholder: 'Current password', autocomplete: 'current-password', 'aria-label': 'Current password' }), n = h('input', { class: 'inp', type: 'password', placeholder: 'New password (8+ characters)', autocomplete: 'new-password', 'aria-label': 'New password' }), e2 = h('div', { class: 'err', role: 'alert' });
    account = card('Password', h('div', { class: 'field' }, o), h('div', { class: 'field' }, n), e2, h('button', { class: 'btn', onclick: async e => { e.target.disabled = true; e2.textContent = ''; const r = await api('/password', { old: o.value, new: n.value }); e.target.disabled = false; if (r.error) e2.textContent = r.error; else { S.token = r.token; store.set('np.token', r.token); o.value = n.value = ''; toast('Password updated'); } } }, 'Change password'));
  }
  const dev = h('div', { class: 'small muted' }, 'Camera and microphone are only requested when you press Join call inside a game.');
  root.append(h('div', { class: 'grid-2', style: { alignItems: 'start' } },
    h('div', { class: 'col', style: { gap: '16px' } },
      card('Profile', h('div', { class: 'label', style: { marginBottom: '8px' } }, 'Avatar'), picker, h('div', { class: 'sep' }), h('label', { class: 'field' }, h('span', null, 'Username'), name), h('label', { class: 'field' }, h('span', null, 'Bio'), bio), status, save),
      account),
    h('div', { class: 'col', style: { gap: '16px' } },
      card('Preferences', toggle('Sound effects', 'Move, message and result cues.', 'sound'), toggle('Light theme', 'Monochrome light appearance.', 'theme'), toggle('Reduce motion', 'Turns off animations and transitions.', 'reduce'), h('div', { class: 'sep' }), dev),
      card('Session', h('p', { class: 'muted small', style: { marginBottom: '12px' } }, 'Signed in as ' + me.name + (me.guest ? ' (guest)' : '') + '.'),
        h('button', { class: 'btn', onclick: async () => { if (!(await confirmBox('Sign out?', me.guest ? 'Guest accounts are lost when you sign out. Create an account first to keep your progress.' : 'You can sign back in any time.', 'Sign out'))) return; await api('/logout', {}); store.del('np.token'); location.hash = ''; location.reload(); } }, icon('logout', 'sm'), 'Sign out')),
      card('About', h('p', { class: 'small muted' }, 'NEXUS PLAY. Chess pieces by Colin M.L. Burnett (CC BY-SA 3.0), via cm-chessboard. Rules for chess by chess.js. Word list from an-array-of-english-words.')))));
}
