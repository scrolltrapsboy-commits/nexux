// Central configuration. Everything secret comes from the environment and never reaches the browser.
const path = require('path');
const crypto = require('crypto');
const env = process.env;
const secret = env.SESSION_SECRET || env.JWT_SECRET || '';
if (!secret && env.NODE_ENV === 'production') console.warn('[config] SESSION_SECRET is not set. Set it in production; a random one is used for this run, so sessions will not survive a restart.');
module.exports = {
  port: +env.PORT || 3000,
  databaseUrl: env.DATABASE_URL || 'sqlite:' + path.join(__dirname, '..', 'data', 'nexus.db'),
  clientUrl: env.CLIENT_URL || '',            // allowed browser origin when the client is hosted elsewhere; empty = same origin
  sessionSecret: secret || crypto.randomBytes(32).toString('hex'),
  sessionDays: 30,
  rateScale: +env.RATE_SCALE || 1,            // multiplies REST rate limits (test suites raise it)
  legacyJson: env.LEGACY_JSON || path.join(__dirname, '..', 'data.json'),
  // WebRTC: STUN is always on, TURN is added when configured (needed behind strict NATs)
  iceServers() {
    const s = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
    if (env.TURN_SERVER_URL) s.push({ urls: env.TURN_SERVER_URL.split(','), username: env.TURN_SERVER_USERNAME, credential: env.TURN_SERVER_PASSWORD });
    return s;
  },
  test: !!env.NP_TEST,                         // short clocks + state-injection hook; never enable in production
  httpsRedirect: env.FORCE_HTTPS === '1',
};
