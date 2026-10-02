const { test, expect } = require('@playwright/test');

async function enterAsGuest(page) {
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
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
  await expect(p1.locator('#view-home .game-grid')).toContainText('Chess');
  await p1.locator('.sidebar [data-view="games"]').click();
  await expect(p1.locator('#view-games')).toContainText('Game library');
  await expect(p1.locator('#view-games .play-btn')).toHaveCount(19);

  await p1.locator('#gamesRoom').click();
  await p1.locator('[data-create="chess"]').click();
  await expect(p1.locator('#gameTitle')).toHaveText('Chess');
  await expect(p1.locator('.board-chess .chess-cell')).toHaveCount(64);

  const lobbyText = await p1.locator('#gameBoard').innerText();
  const codeMatch = lobbyText.match(/[A-Z0-9]{6}/);
  expect(codeMatch).not.toBeNull();
  const code = codeMatch[0];

  await enterAsGuest(p2);
  await p2.locator('#roomCodeBtn').click();
  await p2.locator('#joinCode').fill(code);
  await p2.locator('#joinBtn').click();

  await expect(p1.locator('#gameTitle')).toHaveText('Chess');
  await expect(p2.locator('#gameTitle')).toHaveText('Chess');
  await expect(p1.locator('.board-chess .chess-cell')).toHaveCount(64);
  await expect(p2.locator('.board-chess .chess-cell')).toHaveCount(64);

  await p1.locator('[data-chess="52"]').click();
  await expect(p1.locator('[data-chess="36"].legal')).toBeVisible();
  await p1.locator('[data-chess="36"]').click();
  await expect(p2.locator('.move-item').last()).toContainText('e4');

  await p1.locator('#socialGlobalTab').click();
  await p1.locator('#globalChatInput').fill('E2E global message');
  await p1.locator('#globalChatForm button').click();
  await expect(p1.locator('#globalChatList')).toContainText('E2E global message');

  await p1.locator('#callAudio').click();
  await expect(p1.locator('#callEmpty')).toBeHidden();

  await p1.locator('#gameMobileSocial').evaluate(el => {
    el.style.display = 'block';
  });
  await expect(p1.locator('#mobileCallVideo')).toBeVisible();
  await expect(p1.locator('#mobileSocialForm')).toBeVisible();

  expect(errors1).toEqual([]);
  expect(errors2).toEqual([]);

  await c1.close();
  await c2.close();
});
