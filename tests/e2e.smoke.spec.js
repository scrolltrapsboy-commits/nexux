const { chromium, test, expect } = require('@playwright/test');

test.describe.configure({ mode: 'serial' });

const launchOptions = {
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--allow-loopback-in-peer-connection',
    '--autoplay-policy=no-user-gesture-required'
  ]
};

async function enterAsGuest(page) {
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
  await page.locator('#guest').click();
  await expect(page.locator('#app')).toBeVisible({timeout:15000});
}

async function makePair() {
  const b1 = await chromium.launch(launchOptions);
  const b2 = await chromium.launch(launchOptions);
  const c1 = await b1.newContext({ permissions: ['microphone', 'camera'] });
  const c2 = await b2.newContext({ permissions: ['microphone', 'camera'] });
  const p1 = await c1.newPage();
  const p2 = await c2.newPage();
  const errors = [[], []];
  [p1, p2].forEach((page, i) => {
    page.on('pageerror', e => errors[i].push('pageerror: ' + e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors[i].push('console: ' + msg.text());
    });
  });
  await Promise.all([enterAsGuest(p1), enterAsGuest(p2)]);
  return { b1, b2, c1, c2, p1, p2, errors };
}

async function closePair(pair) {
  await pair.c1.close().catch(() => {});
  await pair.c2.close().catch(() => {});
  await pair.b1.close().catch(() => {});
  await pair.b2.close().catch(() => {});
}

async function createAndJoin(p1, p2, game) {
  await p1.locator('.sidebar [data-view="games"]').click();
  await p1.locator('#gamesRoom').click();
  await p1.locator(`[data-create="${game}"]`).click();
  await expect(p1.locator('#gameModal')).toBeVisible();
  await expect(p1.locator('#gameBoard .room-code-big')).toBeVisible({timeout:10000});
  const code = (await p1.locator('#gameBoard .room-code-big').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  await p2.locator('#roomCodeBtn').click();
  await p2.locator('#joinCode').fill(code);
  await p2.locator('#joinBtn').click();
  await expect(p1.locator('#gameModal')).toBeVisible();
  await expect(p2.locator('#gameModal')).toBeVisible();
  await expect(p1.locator('#gameBoard')).not.toBeEmpty();
  await expect(p2.locator('#gameBoard')).not.toBeEmpty();
  if(await p1.locator('#gameBoard .lobby-panel').count()||await p2.locator('#gameBoard .lobby-panel').count()){
    console.log('[NEXUS DEBUG] p1='+JSON.stringify(await p1.evaluate(()=>({status:document.body.dataset.nexusRoomStatus,players:document.body.dataset.nexusRoomPlayers,code:document.body.dataset.nexusRoomCode,title:document.querySelector('#gameTitle')?.textContent,board:document.querySelector('#gameBoard')?.innerText}))));
    console.log('[NEXUS DEBUG] p2='+JSON.stringify(await p2.evaluate(()=>({status:document.body.dataset.nexusRoomStatus,players:document.body.dataset.nexusRoomPlayers,code:document.body.dataset.nexusRoomCode,title:document.querySelector('#gameTitle')?.textContent,board:document.querySelector('#gameBoard')?.innerText}))));
  }
  await expect(p1.locator('#gameBoard .lobby-panel')).toHaveCount(0,{timeout:10000});
  await expect(p2.locator('#gameBoard .lobby-panel')).toHaveCount(0,{timeout:10000});
  await expect(p1.locator('#shareGame')).toBeVisible();
  await expect(p1.locator('body.game-active .social')).toBeVisible();
  await expect(p2.locator('body.game-active .social')).toBeVisible();
  await expect.poll(async () => p1.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect.poll(async () => p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

async function leavePairGame(p1, p2) {
  await p1.locator('#leaveGame').click();
  await p2.locator('#leaveGame').click();
  await expect(p1.locator('#gameModal')).toBeHidden();
  await expect(p2.locator('#gameModal')).toBeHidden();
}

async function runCatalog(pair, games) {
  const { p1, p2 } = pair;
  for (const game of games) {
    console.log('[NEXUS-E2E] START ' + game);
    await createAndJoin(p1, p2, game);

    if (game === 'tictactoe') {
      await expect(p1.locator('.source-ttt')).toBeVisible();
      await p1.locator('[data-source-ttt="0"]').click();
      await expect(p2.locator('[data-source-ttt="0"]')).toHaveText('×');
    } else if (game === 'connect4') {
      await p1.locator('[data-col="0"]').first().click();
      await expect(p2.locator('.board-c4')).toBeVisible();
    } else if (game === 'rps') {
      await p1.locator('[data-rps="rock"]').click();
      await p2.locator('[data-rps="scissors"]').click();
      await expect(p1.locator('#gameBoard')).not.toBeEmpty();
    } else if (game === 'chess') {
      await p1.locator('[data-chess="52"]').click();
      await p1.locator('[data-chess="36"]').click();
      await expect.poll(async () => p2.locator('.move-item').count()).toBeGreaterThan(0);
    } else if (game === 'battleship') {
      await expect(p1.locator('.battle-layout')).toBeVisible();
      await p1.locator('[data-bshipcell="0,0"]').click();
      await p1.locator('#placeBattleShip').click();
      await expect(p1.locator('.battle-layout')).toBeVisible();
    } else if (game === 'memory') {
      await p1.locator('[data-memory]').first().click();
      await expect(p1.locator('.memory-grid')).toBeVisible();
    } else if (game === 'minesweeper') {
      await p1.locator('[data-mine]').first().click();
      await expect(p1.locator('.mine-grid')).toBeVisible();
    } else if (game === 'wordchain') {
      await p1.locator('#wordInput').fill('apple');
      await p1.locator('#wordForm button').click();
      await expect(p1.locator('#wordForm')).toBeVisible();
    } else if (game === 'pool') {
      await expect(p1.locator('.physical-game')).toBeVisible();
    } else if (game === 'carrom') {
      await expect(p1.locator('.physical-game')).toBeVisible();
    } else if (game === 'minigolf') {
      await expect(p1.locator('.source-minigolf')).toBeVisible();
    } else if (game === 'racing') {
      await p1.locator('#raceUp').dispatchEvent('pointerdown');
      await p1.waitForTimeout(120);
      await p1.locator('#raceUp').dispatchEvent('pointerup');
      await expect(p1.locator('.racing-wrap')).toBeVisible();
    } else if (game === 'game2048') {
      await p1.locator('[data-2048-dir="left"]').click();
      await expect(p1.locator('.board-2048')).toBeVisible();
    } else if (game === 'tetris') {
      await p1.locator('[data-tet="left"]').click();
      await expect(p1.locator('.tet-canvas')).toHaveCount(2);
    } else if (game === 'snake') {
      await p1.keyboard.press('ArrowUp');
      await expect(p1.locator('#snakeCanvas')).toBeVisible();
    } else if (game === 'othello') {
      await p1.locator('[data-oth="19"]').click();
      await expect(p2.locator('.board-othello')).toBeVisible();
    } else if (game === 'pong') {
      await p1.mouse.move(100, 120);
      await p1.mouse.down();
      await p1.mouse.move(100, 200);
      await p1.mouse.up();
      await expect(p1.locator('#pongCanvas')).toBeVisible();
    } else if (game === 'breakout') {
      await p1.locator('#breakoutCanvas').hover({position:{x:120,y:120}});
      await expect(p1.locator('#breakoutCanvas')).toBeVisible();
    } else if (game === 'spaceinvaders') {
      await p1.locator('[data-inv="fire"]').click();
      await expect(p1.locator('#invadersCanvas')).toBeVisible();
    } else if (game === 'pacman') {
      await p1.keyboard.press('ArrowLeft');
      await expect(p1.locator('#pacCanvas')).toBeVisible();
    } else if (game === 'frogger') {
      await p1.locator('[data-frog="up"]').click();
      await expect(p1.locator('#frogCanvas')).toBeVisible();
    } else if (game === 'flappy') {
      await p1.locator('#flapBtn').click();
      await expect(p1.locator('#flappyCanvas')).toBeVisible();
    } else if (game === 'sudoku') {
      await p1.locator('button.sudoku-cell:not(.given)').first().click();
      await p1.locator('[data-snum="1"]').click();
      await expect(p1.locator('.sudoku-grid')).toBeVisible();
    } else if (game === 'yahtzee') {
      await p1.locator('[data-src-action="rollDice"]').click();
      await expect(p1.locator('.dice-row')).toBeVisible();
    } else if (game === 'monopoly') {
      await p1.locator('[data-src-action="rollDice"]').click();
      await expect(p1.locator('.mono-board')).toBeVisible();
    } else if (game === 'life') {
      await expect(p1.locator('.source-life')).toBeVisible();
    } else if (game === 'dotsboxes') {
      await expect(p1.locator('.dots-grid')).toBeVisible();
    } else if (game === 'gomoku') {
      await p1.locator('[data-gomoku="112"]').click();
      await expect(p2.locator('.gomoku-board')).toBeVisible();
    } else if (game === 'backgammon') {
      await expect(p1.locator('.backgammon-wrap')).toBeVisible();
    } else if (game === 'ludo') {
      await p1.locator('#ludoRoll').click();
      await expect(p1.locator('.ludo-shell')).toBeVisible();
    } else if (game === 'dominoes') {
      await expect(p1.locator('.domino-shell')).toBeVisible();
      await expect(p1.locator('.domino-hand .domino-tile')).toHaveCount(5);
    } else if (game === 'hangman') {
      await p1.locator('.hangman-key').filter({ hasText: 'A' }).click();
      await expect(p1.locator('.hangman-wrap')).toBeVisible();
    }

    await p1.locator('#roomChatInput').fill('active '+game);
    await p1.locator('#roomChatForm button').click();
    await expect(p1.locator('#roomChat')).toContainText('active '+game);
    await p1.locator('#callAudio').click();
    await expect.poll(async () => p1.evaluate(() => !!document.querySelector('#localVideo')?.srcObject?.getAudioTracks()?.length), {timeout:5000}).toBe(true);
    await expect(p1.locator('#gameBoard')).not.toBeEmpty();
    await p1.locator('#callEnd').click();
    await p1.locator('#shareGame').click().catch(()=>{});
    await leavePairGame(p1, p2);
    console.log('[NEXUS-E2E] DONE ' + game);
  }
}

test('NEXUS PLAY core full-screen shell, chat, calls and responsive layout', async () => {
  test.setTimeout(150000);
  const pair = await makePair();
  try {
    const { p1, p2, errors } = pair;
    await p1.locator('.sidebar [data-view="games"]').click();
    await expect(p1.locator('#view-games .play-btn')).toHaveCount(40);
    await expect(p1.locator('#view-games')).toContainText('Hangman');

    await createAndJoin(p1, p2, 'chess');
    await expect(p1.locator('.board-chess .chess-cell')).toHaveCount(64);

    await p1.locator('[data-chess="52"]').click();
    await p1.locator('[data-chess="36"]').click();
    await expect.poll(async () => p2.locator('.move-item').count()).toBeGreaterThan(0);

    await p1.locator('#roomChatInput').fill('room works');
    await p1.locator('#roomChatForm button').click();
    await expect(p1.locator('#roomChat')).toContainText('room works');

    await p1.locator('#socialGlobalTab').click();
    await p1.locator('#globalChatInput').fill('global works');
    await p1.locator('#globalChatForm button').click();
    await expect(p1.locator('#globalChatList')).toContainText('global works');

    await p1.locator('#callVideo').click();
    await expect(p1.locator('#callEmpty')).toBeHidden();
    await expect.poll(async () => p1.evaluate(() => !!document.querySelector('#localVideo')?.srcObject?.getVideoTracks()?.length)).toBe(true);
    await expect.poll(async () => p2.evaluate(() => !!document.querySelector('#remoteVideo')?.srcObject?.getVideoTracks()?.length), { timeout: 10000 }).toBe(true);
    await expect.poll(async () => p2.evaluate(() => !!document.querySelector('#remoteVideo')?.srcObject?.getAudioTracks()?.length), { timeout: 10000 }).toBe(true);

    await p1.setViewportSize({ width: 390, height: 844 });
    await expect(p1.locator('body.game-active .social')).toBeVisible();
    await expect(p1.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).resolves.toBe(true);
    await p1.setViewportSize({ width: 1280, height: 900 });

    await p1.locator('#callEnd').click();
    await leavePairGame(p1, p2);
    expect(errors[0]).toEqual([]);
    expect(errors[1]).toEqual([]);
  } finally {
    await closePair(pair);
  }
});

test('NEXUS PLAY catalog A - board, word and arcade games', async () => {
  test.setTimeout(150000);
  const pair = await makePair();
  try {
    await runCatalog(pair, ['tictactoe','connect4','rps','chess','checkers','battleship','memory','minesweeper','wordbattle','wordchain','reaction','sudoku']);
    expect(pair.errors[0]).toEqual([]);
    expect(pair.errors[1]).toEqual([]);
  } finally {
    await closePair(pair);
  }
});

test('NEXUS PLAY catalog B - source board and physical games', async () => {
  test.setTimeout(150000);
  const pair = await makePair();
  try {
    await runCatalog(pair, ['uno','anagram','numberhunt','speedtyping','pool','carrom','minigolf','racing','game2048','tetris','snake','breakout','spaceinvaders']);
    expect(pair.errors[0]).toEqual([]);
    expect(pair.errors[1]).toEqual([]);
  } finally {
    await closePair(pair);
  }
});

test('NEXUS PLAY catalog C - strategy and long-form games', async () => {
  test.setTimeout(150000);
  const pair = await makePair();
  try {
    await runCatalog(pair, ['othello','pong','yahtzee','monopoly','risk','life','dotsboxes','gomoku','backgammon','ludo','dominoes','hangman','pacman','frogger','flappy']);
    expect(pair.errors[0]).toEqual([]);
    expect(pair.errors[1]).toEqual([]);
  } finally {
    await closePair(pair);
  }
});
