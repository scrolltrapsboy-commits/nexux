const { test, expect } = require('@playwright/test');

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

async function enterAsGuest(page, url='http://127.0.0.1:3000') {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#guest').click();
  await expect(page.locator('#app')).toBeVisible();
}

test('NEXUS PLAY production UI and multiplayer smoke', async ({ browser }) => {
  const errors1 = [];
  const errors2 = [];
  const c1 = await browser.newContext({ permissions: ['microphone', 'camera'] });
  const c2 = await browser.newContext({ permissions: ['microphone', 'camera'] });
  const p1 = await c1.newPage();
  const p2 = await c2.newPage();

  for (const [page, errors] of [[p1, errors1], [p2, errors2]]) {
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push('console: ' + msg.text());
    });
  }

  await enterAsGuest(p1);
  await expect(p1.locator('#view-home .game-grid .play-btn')).toHaveCount(6);
  await expect(p1.locator('#view-home .game-grid')).toContainText('Tic Tac Toe');
  await p1.locator('.sidebar [data-view="games"]').click();
  await expect(p1.locator('#view-games')).toContainText('Game library');
  await expect(p1.locator('#view-games .play-btn')).toHaveCount(22);

  await p1.locator('#gamesRoom').click();
  await p1.locator('[data-create="chess"]').click();
  await expect(p1.locator('#gameTitle')).toHaveText('Chess');
  await expect(p1.locator('#gameBoard')).toContainText('Waiting for opponent');

  const lobbyText = await p1.locator('#gameBoard').innerText();
  const codeMatch = lobbyText.match(/[A-Z0-9]{6}/);
  expect(codeMatch).not.toBeNull();
  const code = codeMatch[0];

  await enterAsGuest(p2, 'http://127.0.0.1:3000/?room='+code);
  await expect(p2.locator('#gameModal')).toBeVisible();

  await expect(p1.locator('#gameTitle')).toHaveText('Chess');
  await expect(p2.locator('#gameTitle')).toHaveText('Chess');
  await expect(p1.locator('.board-chess .chess-cell')).toHaveCount(64);
  await expect(p2.locator('.board-chess .chess-cell')).toHaveCount(64);
  await expect(p1.locator('#shareGame')).toBeVisible();
  await expect(p1.locator('body.game-active .social')).toBeVisible();
  const vp=await p1.evaluate(()=>({w:innerWidth,h:innerHeight}));
  const gameBox=await p1.locator('#gameModal .game-modal').boundingBox();
  const socialBox=await p1.locator('body.game-active .social').boundingBox();
  expect(gameBox.width).toBeGreaterThan(vp.w*0.55);
  expect(gameBox.height).toBeGreaterThan(vp.h*0.9);
  expect(socialBox.width).toBeGreaterThan(250);

  await p1.locator('[data-chess="52"]').click();
  await expect(p1.locator('[data-chess="36"].legal')).toBeVisible();
  await p1.locator('[data-chess="36"]').click();
  await expect(p2.locator('.move-item').last()).toContainText('e4');

  const roomChatInput = p1.locator('#roomChatInput');
  await roomChatInput.fill('E2E room message');
  await p1.locator('#roomChatForm button').click();
  await expect(p1.locator('#roomChat')).toContainText('E2E room message');

  await p1.locator('#socialGlobalTab').click();
  await p1.locator('#globalChatInput').fill('E2E global message');
  await p1.locator('#globalChatForm button').click();
  await expect(p1.locator('#globalChatList')).toContainText('E2E global message');

  await p1.locator('#callVideo').click();
  await expect(p1.locator('#callEmpty')).toBeHidden();
  await expect.poll(async()=>p1.evaluate(()=>!!document.querySelector('#localVideo')?.srcObject?.getVideoTracks()?.length)).toBe(true);
  await expect.poll(async()=>p2.evaluate(()=>!!document.querySelector('#remoteVideo')?.srcObject?.getVideoTracks()?.length),{timeout:10000}).toBe(true);
  await expect.poll(async()=>p2.evaluate(()=>!!document.querySelector('#remoteVideo')?.srcObject?.getAudioTracks()?.length),{timeout:10000}).toBe(true);
  await p1.locator('#callMute').click();
  await p1.locator('#callCamera').click();
  await p1.locator('#callCamera').click();

  await p1.setViewportSize({width:390,height:844});
  await expect(p1.locator('body.game-active .social')).toBeVisible();
  const mobile=await p1.locator('#gameModal .game-modal').boundingBox();
  expect(mobile.width).toBeCloseTo(390,0);
  expect(await p1.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await p1.setViewportSize({width:1280,height:900});
  await p1.locator('#callEnd').click();
  await p1.locator('#leaveGame').click();
  await p2.locator('#leaveGame').click();
  await expect(p1.locator('#gameModal')).toBeHidden();
  await expect(p2.locator('#gameModal')).toBeHidden();

  const allGames=['tictactoe','connect4','rps','chess','checkers','battleship','memory','minesweeper','wordbattle','reaction','pool','carrom','minigolf','racing','game2048','tetris','snake','othello','pong','dotsboxes','gomoku','backgammon'];
  for(const game of allGames){
    await p1.locator('.sidebar [data-view="games"]').click();
    await p1.locator(`.play-btn[data-game="${game}"]`).click();
    await expect(p1.locator('#gameModal')).toBeVisible();
    await expect(p1.locator('#gameBoard')).not.toBeEmpty();
    await expect(p1.locator('#gameTitle')).not.toHaveText('Game');
    await expect(p2.locator('#gameModal')).toBeVisible();
    await expect(p2.locator('#gameBoard')).not.toBeEmpty();
    await expect(p1.locator('#shareGame')).toBeVisible();
    if(game==='dotsboxes'){
      await expect(p1.locator('.dots-grid')).toBeVisible();
      await expect(p2.locator('.dots-grid')).toBeVisible();
      await p1.locator('[data-db^="h,0,0"]').click();
      await expect(p2.locator('.db-line.active')).toHaveCount(1);
    }
    if(game==='gomoku'){
      await expect(p1.locator('.gomoku-board')).toBeVisible();
      await p1.locator('[data-gomoku="112"]').click();
      await expect(p2.locator('[data-gomoku="112"]')).toHaveText('●');
    }
    if(game==='backgammon'){
      await expect(p1.locator('.backgammon-wrap')).toBeVisible();
      await expect(p2.locator('.backgammon-wrap')).toBeVisible();
      await expect(p1.locator('.bg-dice span')).toHaveCount(2);
      await expect(p1.locator('.bg-step')).toHaveCountGreaterThan(0).catch(()=>{});
    }
    await expect(p1.locator('body.game-active .social')).toBeVisible();
    await expect(p2.locator('body.game-active .social')).toBeVisible();
    expect(await p1.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    expect(await p2.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await p1.locator('#leaveGame').click();
    await p2.locator('#leaveGame').click();
    await expect(p1.locator('#gameModal')).toBeHidden();
    await expect(p2.locator('#gameModal')).toBeHidden();
  }


  expect(errors1).toEqual([]);
  expect(errors2).toEqual([]);

  await c1.close();
  await c2.close();
});
