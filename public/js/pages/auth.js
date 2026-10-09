import { h, api, S, store, clear, icon } from '../core.js';

// Shown when there is no valid session. Calls onDone() once a token is stored.
export function authScreen(root, onDone, initialTab = 'in', resetToken = null) {
  let tab = resetToken ? 'reset' : initialTab;
  const finish = r => { S.token = r.token; store.set('np.token', r.token); onDone(r); };
  const render = () => {
    clear(root);
    const err = h('div', { class: 'err', role: 'alert' });
    const busy = (btn, p) => { btn.disabled = true; return p.finally(() => { btn.disabled = false; }); };
    const field = (label, type, name, ac, ph, extra) => h('label', { class: 'field' }, h('span', null, label), h('input', { class: 'inp', type, name, autocomplete: ac, placeholder: ph || '', required: true, maxlength: 64, autocapitalize: 'off', spellcheck: 'false', ...extra }));
    let form;
    if (tab === 'in') {
      const u = field('Username', 'text', 'username', 'username'), p = field('Password', 'password', 'password', 'current-password');
      const b = h('button', { class: 'btn primary block', type: 'submit' }, 'Sign in');
      form = h('form', { onsubmit: e => { e.preventDefault(); err.textContent = ''; busy(b, api('/login', { username: u.querySelector('input').value, password: p.querySelector('input').value }).then(r => r.error ? err.textContent = r.error : finish(r))); } },
        u, p, err, b, h('button', { type: 'button', class: 'btn ghost block sm', style: { marginTop: '6px' }, onclick: () => { tab = 'forgot'; render(); } }, 'Forgot your password?'));
    } else if (tab === 'up') {
      const u = field('Choose a username', 'text', 'username', 'username', '3 to 16 letters or numbers', { maxlength: 16 }), p = field('Password', 'password', 'new-password', 'new-password', 'At least 8 characters', { minlength: 8 });
      const b = h('button', { class: 'btn primary block', type: 'submit' }, 'Create account');
      form = h('form', { onsubmit: e => { e.preventDefault(); err.textContent = ''; busy(b, api('/register', { username: u.querySelector('input').value, password: p.querySelector('input').value }).then(r => r.error ? err.textContent = r.error : finish(r))); } }, u, p, err, b,
        h('p', { class: 'small muted tc', style: { marginTop: '10px' } }, 'Passwords are hashed with scrypt. We never see or store your password.'));
    } else if (tab === 'forgot') {
      const u = field('Your username', 'text', 'username', 'username');
      const b = h('button', { class: 'btn primary block', type: 'submit' }, 'Send reset link');
      const out = h('p', { class: 'small muted', style: { marginTop: '10px' } });
      form = h('form', { onsubmit: e => { e.preventDefault(); busy(b, api('/password/forgot', { username: u.querySelector('input').value }).then(r => { out.textContent = r.error || 'If that account exists, a reset link has been created. Ask the site operator for it (self-hosted servers print it in the server log).'; if (r.token) { out.append(h('br'), h('a', { href: '#/reset/' + r.token }, 'Open reset page (test mode)')); } })); } }, u, b, out,
        h('button', { type: 'button', class: 'btn ghost block sm', style: { marginTop: '6px' }, onclick: () => { tab = 'in'; render(); } }, 'Back to sign in'));
    } else if (tab === 'reset') {
      const p = field('New password', 'password', 'new-password', 'new-password', 'At least 8 characters', { minlength: 8 });
      const b = h('button', { class: 'btn primary block', type: 'submit' }, 'Set new password');
      form = h('form', { onsubmit: e => { e.preventDefault(); err.textContent = ''; busy(b, api('/password/reset', { token: resetToken, password: p.querySelector('input').value }).then(r => { if (r.error) err.textContent = r.error; else { location.hash = '#/'; tab = 'in'; resetToken = null; render(); err.textContent = ''; } })); } }, p, err, b);
    }
    const guestBtn = h('button', { class: 'btn block', onclick: async e => { e.target.disabled = true; const r = await api('/guest', {}); if (r.error) { err.textContent = r.error; e.target.disabled = false; } else finish(r); } }, icon('bolt', 'sm'), 'Play as guest');
    root.append(h('div', { class: 'auth' }, h('div', { class: 'auth-card glass' },
      h('div', { class: 'brand' }, h('div', { class: 'logo' }, 'N'), h('b', null, 'NEXUS PLAY')),
      h('h1', null, tab === 'up' ? 'Create your account' : tab === 'forgot' ? 'Reset password' : tab === 'reset' ? 'Choose a new password' : 'Welcome back'),
      h('p', { class: 'muted', style: { marginBottom: '16px' } }, 'Real-time games with friends, plus voice and video while you play.'),
      tab === 'in' || tab === 'up' ? h('div', { class: 'seg', style: { display: 'flex', marginBottom: '16px' } }, ['in', 'up'].map(t => h('button', { class: (tab === t ? 'on' : '') + ' grow', style: { flex: 1 }, onclick: () => { tab = t; render(); } }, t === 'in' ? 'Sign in' : 'Create account'))) : null,
      form,
      tab === 'in' || tab === 'up' ? [h('div', { class: 'divider' }, 'or'), guestBtn, h('p', { class: 'small muted tc', style: { marginTop: '10px' } }, 'Guests can play right away and create an account later without losing progress.')] : null)));
    const first = root.querySelector('input'); if (first && innerWidth > 860) first.focus();
  };
  render();
}
