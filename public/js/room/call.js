// Voice + video for one game room: WebRTC mesh, signalling over Socket.IO, perfect-negotiation so both sides can renegotiate safely.
// Media is requested only when the player presses Join; every control (mic, camera, deafen, devices) works on live tracks.
import { S, sock, ask, on, toast } from '../core.js';

const explain = e => {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Permission was blocked. Allow camera and microphone for this site in your browser settings, then try again.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No matching camera or microphone was found on this device.';
  if (n === 'NotReadableError' || n === 'AbortError') return 'Your camera or microphone is being used by another app.';
  return 'Could not start the call: ' + ((e && e.message) || 'unknown error');
};

export function createCall() {
  const subs = new Set(), peers = new Map(), speak = new Map(), analysers = new Map();
  const st = { joined: false, joining: false, mic: false, cam: false, deaf: false, local: null, members: [], vol: {}, error: '', cams: 0, facing: 'user', devs: { mic: '', cam: '', out: '' } };
  let ice = [], ac = null, timer = null, camIdx = 0, offs = [];
  const emitChange = () => subs.forEach(f => f());
  const audioTrack = () => st.local && st.local.getAudioTracks()[0];
  const videoTrack = () => st.local && st.local.getVideoTracks()[0];
  const send = (to, data) => sock.emit('rtc:signal', { to, data });
  const report = () => sock.emit('rtc:state', { mic: st.mic, cam: st.cam });

  /* ---------- speaking detection ---------- */
  function watch(key, stream) {
    unwatch(key); if (!stream || !stream.getAudioTracks().length) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaStreamSource(stream), an = ac.createAnalyser(); an.fftSize = 512; src.connect(an);
      analysers.set(key, { an, src, buf: new Uint8Array(an.fftSize), hold: 0 });
      if (!timer) timer = setInterval(tick, 120);
    } catch {}
  }
  function unwatch(key) { const a = analysers.get(key); if (a) { try { a.src.disconnect(); } catch {} analysers.delete(key); } speak.delete(key); }
  function tick() {
    let changed = false;
    for (const [k, a] of analysers) {
      a.an.getByteTimeDomainData(a.buf); let sum = 0; for (const v of a.buf) { const x = (v - 128) / 128; sum += x * x; }
      const loud = Math.sqrt(sum / a.buf.length) > 0.035; if (loud) a.hold = 6; else if (a.hold > 0) a.hold--;
      const on_ = a.hold > 0 && (k !== S.me.id || st.mic); if (!!speak.get(k) !== on_) { speak.set(k, on_); changed = true; }
    }
    if (changed) emitChange();
  }

  /* ---------- peers ---------- */
  function applyAudioOut(p) { p.audio.muted = st.deaf; p.audio.volume = st.vol[p.id] == null ? 1 : st.vol[p.id]; if (st.devs.out && p.audio.setSinkId) p.audio.setSinkId(st.devs.out).catch(() => {}); }
  async function unlockAudio() { try { if (ac && ac.state === 'suspended') await ac.resume(); } catch {} for (const p of peers.values()) { try { await p.audio.play(); } catch {} } }
  function makePeer(id) {
    if (peers.has(id)) return peers.get(id);
    const pc = new RTCPeerConnection({ iceServers: ice, bundlePolicy: 'max-bundle' });
    const p = { id, pc, polite: S.me.id < id, making: false, ignore: false, stream: new MediaStream(), audio: new Audio(), state: 'connecting', pending: [] };
    p.audio.autoplay = true; p.audio.hidden = true; p.audio.dataset.peer = id; document.body.append(p.audio); p.audio.srcObject = p.stream; applyAudioOut(p);
    const ta = pc.addTransceiver('audio', { direction: 'sendrecv' }), tv = pc.addTransceiver('video', { direction: 'sendrecv' });
    p.aSend = ta.sender; p.vSend = tv.sender;
    if (audioTrack()) p.aSend.replaceTrack(audioTrack()).catch(() => {});
    if (videoTrack()) { p.vSend.replaceTrack(videoTrack()).then(() => capBitrate(p)).catch(() => {}); }
    pc.ontrack = e => {
      if (!p.stream.getTracks().includes(e.track)) p.stream.addTrack(e.track);
      e.track.onunmute = emitChange; if (e.track.kind === 'audio') { watch(id, p.stream); p.audio.play().catch(() => {}); }
      emitChange();
    };
    pc.onicecandidate = e => { if (e.candidate) send(id, { candidate: e.candidate }); };
    pc.onnegotiationneeded = async () => {
      if (pc.signalingState !== 'stable') return;
      try { p.making = true; await pc.setLocalDescription(); send(id, { description: pc.localDescription }); } catch {} finally { p.making = false; }
    };
    pc.onconnectionstatechange = () => {
      p.state = pc.connectionState; emitChange();
      if (pc.connectionState === 'failed') { try { pc.restartIce(); } catch {} }
      if (pc.connectionState === 'disconnected') setTimeout(() => { if (pc.connectionState === 'disconnected') { try { pc.restartIce(); } catch {} } }, 3000);
    };
    peers.set(id, p); return p;
  }
  function capBitrate(p) { try { const s = p.vSend.getParameters(); if (!s.encodings || !s.encodings.length) s.encodings = [{}]; s.encodings[0].maxBitrate = 700000; p.vSend.setParameters(s).catch(() => {}); } catch {} }
  function dropPeer(id) { const p = peers.get(id); if (!p) return; try { p.pc.close(); } catch {} p.audio.srcObject = null; p.audio.remove(); unwatch(id); peers.delete(id); }
  async function onSignal({ from, data }) {
    if (!st.joined || !data) return;
    const p = makePeer(from), pc = p.pc;
    try {
      if (data.description) {
        const collision = data.description.type === 'offer' && (p.making || pc.signalingState !== 'stable');
        p.ignore = !p.polite && collision; if (p.ignore) return;
        await pc.setRemoteDescription(data.description);
        if (data.description.type === 'offer') { await pc.setLocalDescription(); send(from, { description: pc.localDescription }); }
      } else if (data.candidate) {
        try { await pc.addIceCandidate(data.candidate); } catch (e) { if (!p.ignore) throw e; }
      }
    } catch (e) { console.warn('[call] signalling error', e.message); }
  }
  function onList(list) {
    st.members = list;
    if (st.joined) for (const id of [...peers.keys()]) if (!list.some(m => m.id === id)) dropPeer(id);
    emitChange();
  }

  /* ---------- local media ---------- */
  const audioC = () => ({ echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(st.devs.mic ? { deviceId: { exact: st.devs.mic } } : {}) });
  const videoC = () => ({ width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 }, ...(st.devs.cam ? { deviceId: { exact: st.devs.cam } } : { facingMode: { ideal: st.facing } }) });
  async function countCams() { try { const d = await navigator.mediaDevices.enumerateDevices(); st.cams = d.filter(x => x.kind === 'videoinput').length; } catch {} }
  function setLocal(track) { if (!st.local) st.local = new MediaStream(); st.local.getTracks().filter(t => t.kind === track.kind).forEach(t => { t.stop(); st.local.removeTrack(t); }); st.local.addTrack(track); }
  async function getAudio() {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: audioC() }); const t = s.getAudioTracks()[0]; setLocal(t); st.mic = true; for (const p of peers.values()) p.aSend.replaceTrack(t).catch(() => {}); watch(S.me.id, new MediaStream([t])); return true; }
    catch (e) { st.error = explain(e); toast(st.error, { ms: 6000 }); st.mic = false; return false; }
  }
  async function getVideo() {
    try { const s = await navigator.mediaDevices.getUserMedia({ video: videoC() }); const t = s.getVideoTracks()[0]; setLocal(t); st.cam = true; for (const p of peers.values()) p.vSend.replaceTrack(t).then(() => capBitrate(p)).catch(() => {}); t.onended = () => { if (st.cam) { st.cam = false; report(); emitChange(); } }; countCams(); return true; }
    catch (e) { st.error = explain(e); toast(st.error, { ms: 6000 }); st.cam = false; return false; }
  }

  const api = {
    st, speak, peers,
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    supported: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.RTCPeerConnection),
    async join({ video = false } = {}) {
      if (st.joined || st.joining) return; if (!api.supported()) { toast('Voice and video need a modern browser over HTTPS.'); return; }
      st.joining = true; st.error = ''; emitChange();
      try {
        const gotMic = await getAudio(); if (video) await getVideo();
        if (!gotMic && !st.cam) { /* allow joining to listen even when local capture is unavailable */ }
        const r = await ask('rtc:join', { cam: st.cam });
        if (!r || r.error) { toast(r && r.error || 'Could not join the call. Please try again.'); api.stopLocal(); st.joining = false; emitChange(); return; }
        ice = r.ice || []; st.joined = true;
        offs.push(on('rtc:signal', onSignal));
        for (const id of r.peers || []) makePeer(id);
        await unlockAudio(); report(); await countCams(); emitChange();
      } catch (e) {
        st.error = explain(e); toast(st.error, { ms: 6000 }); api.stopLocal(); st.joined = false;
      } finally { st.joining = false; emitChange(); }
    },
    stopLocal() { if (st.local) st.local.getTracks().forEach(t => t.stop()); st.local = null; st.mic = st.cam = false; unwatch(S.me.id); },
    leave(silent) {
      if (!st.joined && !st.joining) return;
      for (const id of [...peers.keys()]) dropPeer(id);
      api.stopLocal(); offs.forEach(f => f()); offs = []; st.joined = false; st.joining = false; st.members = st.members.filter(m => m.id !== S.me.id);
      if (!silent) sock.emit('rtc:leave'); emitChange();
    },
    async rejoin() { // after a socket reconnect the server forgot us: join again with the same media
      if (!st.joined) return; const r = await ask('rtc:join', { cam: st.cam }); if (r.error) { api.leave(true); return; }
      ice = r.ice || ice; for (const id of [...peers.keys()]) dropPeer(id); for (const id of r.peers) makePeer(id); report();
    },
    async toggleMic() {
      if (!st.joined) return; await unlockAudio(); const t = audioTrack();
      if (!t) { if (await getAudio()) { report(); emitChange(); } return; }
      t.enabled = !t.enabled; st.mic = t.enabled; report(); emitChange();
    },
    async toggleCam() {
      if (!st.joined) return;
      if (st.cam) { const t = videoTrack(); if (t) { t.stop(); st.local.removeTrack(t); } st.cam = false; for (const p of peers.values()) p.vSend.replaceTrack(null).catch(() => {}); report(); emitChange(); }
      else if (await getVideo()) { report(); emitChange(); }
    },
    toggleDeaf() { st.deaf = !st.deaf; for (const p of peers.values()) applyAudioOut(p); emitChange(); },
    setVolume(id, v) { st.vol[id] = v; const p = peers.get(id); if (p) applyAudioOut(p); emitChange(); },
    async switchCamera() {
      if (!st.joined) return;
      try { const d = (await navigator.mediaDevices.enumerateDevices()).filter(x => x.kind === 'videoinput'); if (d.length > 1) { const cur = videoTrack() && videoTrack().getSettings().deviceId; camIdx = (d.findIndex(x => x.deviceId === cur) + 1) % d.length; st.devs.cam = d[camIdx].deviceId; } else { st.facing = st.facing === 'user' ? 'environment' : 'user'; st.devs.cam = ''; } } catch {}
      const t = videoTrack(); if (t) { t.stop(); st.local.removeTrack(t); } await getVideo(); report(); emitChange();
    },
    async devices() { try { const d = await navigator.mediaDevices.enumerateDevices(); return { mic: d.filter(x => x.kind === 'audioinput'), cam: d.filter(x => x.kind === 'videoinput'), out: d.filter(x => x.kind === 'audiooutput') }; } catch { return { mic: [], cam: [], out: [] }; } },
    async setDevice(kind, id) { st.devs[kind] = id; if (kind === 'mic' && st.joined) { await getAudio(); report(); } if (kind === 'cam' && st.joined && st.cam) { const t = videoTrack(); if (t) { t.stop(); st.local.removeTrack(t); } await getVideo(); report(); } if (kind === 'out') for (const p of peers.values()) applyAudioOut(p); emitChange(); },
    destroy() { api.leave(); clearInterval(timer); timer = null; try { ac && ac.close(); } catch {} ac = null; subs.clear(); },
  };
  // when the signalling socket drops and returns, the server has dropped our call membership
  const offHello = on('hello', () => api.rejoin());
  const oldDestroy = api.destroy; api.destroy = () => { offHello(); offList(); oldDestroy(); };
  const offList = on('rtc:list', onList);
  return api;
}
