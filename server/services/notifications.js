// Persistent notifications. Stored first, then pushed live; clicking one navigates via its `go` route.
const crypto = require('crypto');
module.exports = function notifications(app) {
  const { db } = app;
  const api = {
    list: uid => db.all('SELECT id, body AS text, go, read, created_at AS t FROM notifications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50', uid).map(n => ({ ...n, read: !!n.read })),
    send(uid) { app.io.to('u:' + uid).emit('notes', api.list(uid)); },
    add(uid, text, go = 'home', opts = {}) {
      if (!app.users.exists(uid)) return;
      // several unread messages from one friend collapse into a single notification
      if (go.startsWith('dm:') && db.get('SELECT 1 x FROM notifications WHERE user_id = ? AND go = ? AND read = 0', uid, go)) return;
      db.run('INSERT INTO notifications(id,user_id,body,go,read,created_at) VALUES (?,?,?,?,0,?)', crypto.randomBytes(4).toString('hex'), uid, String(text).slice(0, 160), go, Date.now());
      db.run('DELETE FROM notifications WHERE user_id = ? AND id NOT IN (SELECT id FROM notifications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50)', uid, uid);
      if (!opts.quiet) app.io.to('u:' + uid).emit('notify', { text, go });
      api.send(uid);
    },
    markRead(uid, id) { if (id === 'all') db.run('UPDATE notifications SET read = 1 WHERE user_id = ?', uid); else db.run('UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?', uid, String(id)); api.send(uid); },
  };
  return api;
};
