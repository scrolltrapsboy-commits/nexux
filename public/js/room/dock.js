// The right-hand dock: call tiles, call controls and room chat. Tiles are keyed, so video elements are never rebuilt while a call runs.
import { h, icon, avatar, S, modal, clear, toast, gameInfo } from '../core.js';
import { chatPanel } from '../chatui.js';

export function createDock(call, opts) {
  const vids = h('div', { class: 'vids glass flat' }), bar = h('div', { class: 'callbar glass flat' });
  const chat = chatPanel({ scope: 'room', title: 'Room chat', subtitle: 'Only people in this room can see this', placeholder: 'Message the room…', onNew: opts.onNew, closeBtn: h('button', { class: 'btn ghost round sm m-only', 'aria-label': 'Close chat', onclick: () => opts.setChat(false) }, icon('x', 'sm')) });
  const tiles = new Map();
  let room = null, canCall = true;

  const stream = (id) => id === S.me.id ? call.st.local : call.peers.get(id) && call.peers.get(id).stream;
  const info = id => { const p = room && room.players.find(x => x.id === id); return p || { id, name: '?', av: 0 }; };

  function tile(id) {
    let t = tiles.get(id); if (t) return t;
    const me = id === S.me.id, v = h('video', { autoplay: true, playsinline: true, muted: true, 'aria-label': 'Video of ' + info(id).name }); v.muted = true; if (me) v.classList.add('mirror');
    const ph = h('div', { class: 'ph' }), st = h('div', { class: 'st', hidden: true, title: 'Muted' }, icon('micoff', 'sm')), nm = h('span');
    const tb = h('div', { class: 'tb' });
    if (!me) tb.append(h('button', { 'aria-label': 'Volume', title: 'Volume', onclick: () => volume(id) }, icon('volume', 'sm')));
    tb.append(h('button', { 'aria-label': 'Full screen', title: 'Full screen', onclick: () => { (v.requestFullscreen || v.webkitRequestFullscreen || (() => {})).call(v); } }, icon('panel', 'sm')));
    const el = h('div', { class: 'tile', 'data-id': id, tabindex: 0 }, v, ph, st, h('div', { class: 'nm' }, nm), tb);
    el.addEventListener('click', () => el.classList.toggle('touch'));
    t = { el, v, ph, st, nm, avId: null }; tiles.set(id, t); return t;
  }
  function volume(id) {
    const p = info(id);
    modal((b, close) => { const r = h('input', { type: 'range', min: 0, max: 100, value: Math.round((call.st.vol[id] == null ? 1 : call.st.vol[id]) * 100), 'aria-label': 'Volume', style: { width: '100%', accentColor: 'var(--fg)' }, oninput: () => call.setVolume(id, r.value / 100) });
      b.append(h('h2', null, p.name + ' volume'), h('div', { class: 'field', style: { marginTop: '14px' } }, r), h('div', { class: 'acts' }, h('button', { class: 'btn primary', onclick: close }, 'Done'))); });
  }
  function devices() {
    modal(async (b, close) => {
      b.append(h('h2', null, 'Call settings'), h('p', { class: 'small muted' }, 'Loading devices…'));
      const d = await call.devices(); clear(b);
      const sel = (label, kind, list, cur) => list.length ? h('label', { class: 'field' }, h('span', null, label), h('select', { class: 'inp', onchange: e => call.setDevice(kind, e.target.value) }, list.map((x, i) => h('option', { value: x.deviceId, selected: x.deviceId === cur }, x.label || label + ' ' + (i + 1))))) : null;
      const curMic = call.st.local && call.st.local.getAudioTracks()[0] && call.st.local.getAudioTracks()[0].getSettings().deviceId, curCam = call.st.local && call.st.local.getVideoTracks()[0] && call.st.local.getVideoTracks()[0].getSettings().deviceId;
      b.append(h('h2', null, 'Call settings'), sel('Microphone', 'mic', d.mic, curMic), sel('Camera', 'cam', d.cam, curCam), 'setSinkId' in HTMLMediaElement.prototype ? sel('Speakers', 'out', d.out, call.st.devs.out) : null, !d.mic.length && !d.cam.length ? h('p', { class: 'muted' }, 'No devices found.') : null, h('div', { class: 'acts' }, h('button', { class: 'btn primary', onclick: close }, 'Done')));
    });
  }

  function drawTiles() {
    const st = call.st, ids = st.joined ? [S.me.id, ...st.members.map(m => m.id).filter(id => id !== S.me.id)] : [];
    vids.classList.toggle('empty-call', !st.joined); vids.classList.toggle('one', ids.length <= 1); vids.classList.toggle('hide', !ids.length);
    if (!st.joined) { for (const [id, t] of tiles) { t.v.srcObject = null; tiles.delete(id); } clear(vids);
      const n = st.members.length;
      if (canCall) vids.append(icon('video', 'lg'), h('div', { class: 'b' }, n ? n + ' in the call' : 'Talk while you play'), h('div', { class: 'small muted' }, 'Voice and video stay inside this room. Your browser will ask for permission when you join.'), h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn primary sm', onclick: () => call.join({ video: false }), disabled: st.joining }, icon('mic', 'sm'), 'Join voice'), h('button', { class: 'btn sm', onclick: () => call.join({ video: true }), disabled: st.joining }, icon('video', 'sm'), 'Join with video')));
      return; }
    if (vids.querySelector(':scope > .ico')) clear(vids);
    for (const [id, t] of tiles) if (!ids.includes(id)) { t.v.srcObject = null; t.el.remove(); tiles.delete(id); }
    ids.forEach((id, i) => {
      const t = tile(id), me = id === S.me.id, m = st.members.find(x => x.id === id) || { mic: true, cam: false };
      const p = info(id), hasCam = me ? st.cam : (m.cam && stream(id) && stream(id).getVideoTracks().length > 0), micOn = me ? st.mic : m.mic;
      if (t.avId !== p.av) { t.avId = p.av; clear(t.ph); t.ph.append(avatar(p.av, 64)); }
      t.nm.replaceChildren(!micOn ? icon('micoff', 'sm') : '', p.name + (me ? ' (you)' : ''));
      t.st.hidden = micOn; t.ph.hidden = !!hasCam; t.v.hidden = !hasCam;
      const s = stream(id), want = hasCam && s ? new MediaStream(s.getVideoTracks()) : null;
      if (hasCam && s) { const cur = t.v.srcObject, same = cur && cur.getVideoTracks()[0] && cur.getVideoTracks()[0] === s.getVideoTracks()[0]; if (!same) { t.v.srcObject = want; t.v.play().catch(() => {}); } } else if (t.v.srcObject) t.v.srcObject = null;
      t.el.classList.toggle('speaking', !!call.speak.get(id) && micOn);
      if (t.el.parentNode !== vids) vids.append(t.el);
    });
    ids.forEach((id, i) => { const el = tiles.get(id).el; if (vids.children[i] !== el) vids.insertBefore(el, vids.children[i] || null); });
  }
  function drawBar() {
    const st = call.st; clear(bar); bar.classList.toggle('pre', !st.joined);
    if (!canCall) { bar.hidden = true; return; } bar.hidden = false;
    const chatBtn = h('button', { class: 'btn round m-only', id: 'chatbtn', 'aria-label': 'Open chat', onclick: () => opts.setChat(true) }, icon('chat'), h('span', { class: 'badge', id: 'chatbadge', style: { position: 'absolute', top: '-4px', right: '-4px' }, hidden: true }));
    chatBtn.style.position = 'relative'; const nb = opts.unread(); const bd = chatBtn.querySelector('#chatbadge'); bd.hidden = !nb; bd.textContent = nb > 9 ? '9+' : nb;
    const sw = (on_, ic, icOff, label, fn, off) => h('button', { class: 'btn round' + (off ? ' mutedx' : ''), 'aria-label': label, 'aria-pressed': !!off, title: label, onclick: fn }, icon(off ? icOff : ic));
    if (!st.joined) {
      bar.append(chatBtn, h('button', { class: 'btn', onclick: () => call.join({ video: false }), disabled: st.joining, 'aria-label': 'Join voice call' }, icon('mic', 'sm'), h('span', { class: 'lbl' }, st.joining ? 'Joining…' : 'Voice')), h('button', { class: 'btn', onclick: () => call.join({ video: true }), disabled: st.joining, 'aria-label': 'Join video call' }, icon('video', 'sm'), h('span', { class: 'lbl' }, 'Video')));
      return;
    }
    bar.append(chatBtn, sw(0, 'mic', 'micoff', st.mic ? 'Mute microphone' : 'Unmute microphone', () => call.toggleMic(), !st.mic), sw(0, 'video', 'videooff', st.cam ? 'Turn camera off' : 'Turn camera on', () => call.toggleCam(), !st.cam),
      sw(0, 'headphones', 'volumeoff', st.deaf ? 'Undeafen' : 'Deafen (mute everyone)', () => call.toggleDeaf(), st.deaf),
      ...(st.cam ? [h('button', { class: 'btn round', 'aria-label': 'Switch camera', title: 'Switch camera', onclick: () => call.switchCamera() }, icon('refresh'))] : []),
      h('button', { class: 'btn round', 'aria-label': 'Call settings', title: 'Call settings', onclick: devices }, icon('gear')),
      h('button', { class: 'btn round hang', 'aria-label': 'Leave call', title: 'Leave call', onclick: () => call.leave() }, icon('phone')));
    for (const n of [...bar.childNodes]) if (n.nodeType === 3 && n.textContent === 'null') n.remove();
  }
  const refresh = () => { drawTiles(); drawBar(); };
  const unsub = call.subscribe(refresh);
  refresh();
  return {
    vids, bar, chat, refresh,
    setRoom(r) { room = r; canCall = !r.watching; if (r.watching && call.st.joined) call.leave(); vids.hidden = r.watching; refresh(); },
    destroy() { unsub(); chat.destroy(); for (const t of tiles.values()) t.v.srcObject = null; },
  };
}
