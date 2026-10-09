// The server owns both fleets. A client only ever receives its own ships plus the shots fired.
module.exports = {
  id: 'battleship', title: 'Battleship', category: 'board', difficulty: 'Medium', min: 2, max: 2, resign: true, watch: true,
  desc: 'Hide your fleet, then hunt the enemy ships one shot at a time.',
  init: () => ({ gen: Date.now(), phase: 'place', turn: -1, ships: [null, null], ready: [false, false], shots: [[], []], sunk: [0, 0] }),
  move(s, i, m) {
    if (s.phase === 'place') {
      if (m.t !== 'place' || s.ready[i] || !Array.isArray(m.ships) || m.ships.length !== 5) return 'Invalid placement.';
      if (m.ships.map(x => x && x.len).sort((a, b) => b - a).join() !== '5,4,3,3,2') return 'Your fleet needs ships of 5, 4, 3, 3 and 2 cells.';
      const used = new Set(), out = [];
      for (const sh of m.ships) {
        if (!sh || ![sh.x, sh.y].every(Number.isInteger)) return 'Invalid placement.';
        const cells = [];
        for (let k = 0; k < sh.len; k++) {
          const x = sh.x + (sh.h ? k : 0), y = sh.y + (sh.h ? 0 : k);
          if (x < 0 || x > 9 || y < 0 || y > 9) return 'A ship is out of bounds.';
          if (used.has(y * 10 + x)) return 'Ships cannot overlap.';
          used.add(y * 10 + x); cells.push(y * 10 + x);
        }
        out.push(cells);
      }
      s.ships[i] = out; s.ready[i] = true;
      if (s.ready[0] && s.ready[1]) { s.phase = 'battle'; s.turn = 0; }
      return;
    }
    if (m.t !== 'fire' || !Number.isInteger(m.c) || m.c < 0 || m.c > 99) return 'Pick a cell to fire at.';
    if (s.shots[i].some(x => x.c === m.c)) return 'You already fired there.';
    const o = 1 - i, hit = s.ships[o].some(sh => sh.includes(m.c)); s.shots[i].push({ c: m.c, h: hit });
    const hits = new Set(s.shots[i].filter(x => x.h).map(x => x.c));
    s.sunk[i] = s.ships[o].filter(sh => sh.every(c => hits.has(c))).length;
    if (s.sunk[i] === 5) return { winner: i };
    s.turn = o;
  },
  redact: (s, k) => ({ gen: s.gen, phase: s.phase, turn: s.turn, ready: s.ready, sunk: s.sunk, shots: s.shots, mine: k >= 0 ? s.ships[k] : null }),
};
