// Versioned schema. Add a new entry to MIGRATIONS to change the database; never edit a released one.
const MIGRATIONS = [
  { version: 1, name: 'initial schema', sql: `
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      pass_hash TEXT,
      is_guest INTEGER NOT NULL DEFAULT 1,
      avatar INTEGER NOT NULL DEFAULT 0,
      bio TEXT NOT NULL DEFAULT '',
      xp INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL DEFAULT 1000,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX idx_sessions_user ON sessions(user_id);
    CREATE TABLE friends (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, friend_id)
    );
    CREATE TABLE friend_requests (
      from_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (from_id, to_id)
    );
    CREATE TABLE blocked_users (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, blocked_id)
    );
    CREATE TABLE rooms (
      code TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      host_id TEXT,
      visibility TEXT NOT NULL DEFAULT 'public',
      opts TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      closed_at INTEGER
    );
    CREATE TABLE matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT,
      game TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      reason TEXT,
      is_draw INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_matches_ended ON matches(ended_at);
    CREATE TABLE match_players (
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seat INTEGER NOT NULL,
      outcome TEXT NOT NULL,
      score INTEGER,
      rating_before INTEGER,
      rating_after INTEGER,
      PRIMARY KEY (match_id, user_id)
    );
    CREATE INDEX idx_mp_user ON match_players(user_id);
    CREATE TABLE game_stats (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game TEXT NOT NULL,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL DEFAULT 1000,
      PRIMARY KEY (user_id, game)
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pair TEXT NOT NULL,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_messages_pair ON messages(pair, id);
    CREATE TABLE dm_reads (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      peer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, peer_id)
    );
    CREATE TABLE global_chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      go TEXT NOT NULL DEFAULT 'home',
      read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_notes_user ON notifications(user_id, created_at);
    CREATE TABLE achievements (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      unlocked_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, key)
    );
    CREATE TABLE password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE VIEW leaderboards AS
      SELECT g.user_id, u.username, u.avatar, g.game, g.wins, g.losses, g.draws, g.wins + g.losses + g.draws AS games, g.rating
      FROM game_stats g JOIN users u ON u.id = g.user_id;
  ` },
];
module.exports = { MIGRATIONS };
