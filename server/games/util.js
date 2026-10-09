const crypto = require('crypto');
const rnd = n => crypto.randomInt(n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
module.exports = { rnd, shuffle };
