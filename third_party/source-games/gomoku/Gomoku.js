'use strict';

// 模組頂層常數：AI 核心方法 toString() 拼接的 SHA-256 哈希
// 使用 const 而非 static getter，防止攻擊者透過 Object.defineProperty 覆蓋
const _GOMOKU_AI_HASH = 'sha256-gE2zpmLAbt3Et6XS8wiJJwTz0kg/ODHLne8OufR6D6w=';

class Gomoku {
  constructor(canvas) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.titleEl   = document.getElementById('title');
    this.subEl     = document.getElementById('subtitle');

    this.LINES     = 15;
    this.PADDING   = 0;
    this.RATE      = 0;
    this.DPR       = Math.min(window.devicePixelRatio || 1, 3);

    this.chessBoard  = [];
    this.wins        = [];
    this.winPatterns = [];
    this.count       = 0;

    this.playerWin = [];
    this.AIWin     = [];

    this.over       = false;
    this.player     = true;

    this.history         = [];
    this.canBack         = false;
    this.canCancel       = false;
    this._cancelSnapshot = null;

    this.hoverPos      = null;
    this.aiThinking    = false;
    this._aiTimer           = null;  // AI 思考 setTimeout 的計時器 ID
    this._winLineTimer      = null;  // 用於在 init() 中取消待執行的勝線繪製
    this._integrityViolated = false; // 完整性校验失败后永久锁定，不可被 init() 清除

    // 缓存按钮引用，避免 _updateBtns 每次重新查询 DOM
    this._backBtn   = document.getElementById('back');
    this._cancelBtn = document.getElementById('cancel');

    this._resizeTimer = null; // ResizeObserver 防抖计时器，避免拖拽窗口期间频繁重绘

    this._ro = new ResizeObserver(() => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this._onResize(), 150);
    });

    this._resize();
    this.init();
    this._bindEvents();
    this._verifyIntegrity(); // 异步校验 AI 核心算法完整性
    // 確保棋盤完全初始化後才開始監聽尺寸變化
    // 若提前 observe，部分瀏覽器可能在 init() 前觸發回調，導致 chessBoard 未初始化時 crash
    this._ro.observe(canvas.parentElement);
  }

  async _verifyIntegrity() {
    if (!window.crypto?.subtle) return; // 非 HTTPS / 不支持 SubtleCrypto 时跳过
    try {
      const methods  = ['_aiChoose','_minimax','_evalBoard','_patternScore','_getCandidates','_rankCandidates'];
      const combined = methods.map(m => this[m].toString()).join('');
      const buf      = new TextEncoder().encode(combined);
      const hashBuf  = await crypto.subtle.digest('SHA-256', buf);
      // ArrayBuffer → base64（避免大数组 spread 溢出栈）
      const bytes = new Uint8Array(hashBuf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      if ('sha256-' + b64 !== _GOMOKU_AI_HASH) {
        this._integrityFailed();
      }
    } catch (e) {
      // SubtleCrypto 出错时静默降级，不中断游戏
      console.warn('[Gomoku] integrity check error:', e);
    }
  }

  _integrityFailed() {
    this._integrityViolated = true; // 永久锁定，init() 无法解除
    this.over       = true;
    this.aiThinking = false;
    this.canBack    = false; // 確保悔棋 / 取消按鈕立即禁用
    this.canCancel  = false;
    this.titleEl.textContent = '完整性校验失败';
    this.titleEl.className   = 'lose';
    this.subEl.textContent   = 'AI 算法已被篡改，请刷新或重新部署';
    // 在棋盘上叠加红色警告遮罩
    const W   = parseFloat(this.canvas.style.width);
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0); // 确保使用正确的逻辑坐标系
    ctx.fillStyle = 'rgba(255, 59, 48, 0.10)';
    ctx.fillRect(0, 0, W, W);
    const fs = Math.max(14, Math.round(W * 0.058));
    ctx.font         = `600 ${fs}px -apple-system, "SF Pro Text", sans-serif`;
    ctx.fillStyle    = 'rgba(255, 59, 48, 0.82)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠  AI 算法完整性校验失败', W / 2, W / 2);
    ctx.restore();
    this._updateBtns();
  }

  /* ── HiDPI 自适应 ── */

  _resize() {
    const wrap = this.canvas.parentElement;
    // 讀實際 CSS padding，避免移動端 padding 被覆寫後仍用舊值計算
    const style = getComputedStyle(wrap);
    const padX2 = (parseFloat(style.paddingLeft) || 16) + (parseFloat(style.paddingRight) || 16);
    const available = (wrap.clientWidth || 520) - padX2;
    const logicSize = Math.max(Math.min(available, 720), 260);

    this.RATE    = Math.floor((logicSize - 32) / (this.LINES - 1));
    this.PADDING = Math.round((logicSize - this.RATE * (this.LINES - 1)) / 2);
    const W = this.RATE * (this.LINES - 1) + this.PADDING * 2;

    this.canvas.width        = W * this.DPR;
    this.canvas.height       = W * this.DPR;
    this.canvas.style.width  = W + 'px';
    this.canvas.style.height = W + 'px';

    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
  }

  _onResize() {
    this._resize();
    this._redraw();
    if (this._integrityViolated) this._integrityFailed();
  }

  /* ── 初始化 ── */

  init() {
    if (this._integrityViolated) return; // 校验失败后禁止重置游戏
    // 取消上一局遊戲可能正在計時的勝線繪製，避免畫在新棋盤上
    if (this._winLineTimer !== null) { clearTimeout(this._winLineTimer); this._winLineTimer = null; }
    if (this._aiTimer      !== null) { clearTimeout(this._aiTimer);      this._aiTimer      = null; }
    this.over       = false;
    this.player     = true;
    this.canBack    = false;
    this.canCancel  = false;
    this.history    = [];
    this._cancelSnapshot = null;
    this.aiThinking = false;
    this.hoverPos   = null;

    this.titleEl.className   = '';
    this.titleEl.textContent = '五子棋';
    this.subEl.textContent   = '黑棋先行，祝你好运';

    this.chessBoard = Array.from({ length: this.LINES }, () => new Array(this.LINES).fill(0));
    this.wins       = Array.from({ length: this.LINES }, () => Array.from({ length: this.LINES }, () => []));
    this.winPatterns = [];
    this.count = 0;
    this._calcWins();

    this.playerWin = new Array(this.count).fill(0);
    this.AIWin     = new Array(this.count).fill(0);

    this._updateBtns();
    this._redraw();
  }

  /* ── 赢法 ── */

  _calcWins() {
    const L = this.LINES;
    const add = cells => {
      const k = this.count;
      this.winPatterns[k] = cells;
      cells.forEach(({ i, j }) => this.wins[i][j].push(k));
      this.count++;
    };
    for (let i = 0; i < L; i++)
      for (let j = 0; j <= L-5; j++) add([0,1,2,3,4].map(k=>({i, j:j+k})));
    for (let i = 0; i <= L-5; i++)
      for (let j = 0; j < L; j++) add([0,1,2,3,4].map(k=>({i:i+k, j})));
    for (let i = 0; i <= L-5; i++)
      for (let j = 0; j <= L-5; j++) add([0,1,2,3,4].map(k=>({i:i+k, j:j+k})));
    for (let i = 0; i <= L-5; i++)
      for (let j = 4; j < L; j++) add([0,1,2,3,4].map(k=>({i:i+k, j:j-k})));
  }

  /* ── 绘制 ── */

  _redraw() {
    this._drawBoard();
    for (let i = 0; i < this.LINES; i++)
      for (let j = 0; j < this.LINES; j++) {
        if (this.chessBoard[i][j] === 1) this._drawPiece(i, j, 'black', false);
        if (this.chessBoard[i][j] === 2) this._drawPiece(i, j, 'white', false);
      }
    if (this.hoverPos && !this.over && !this.aiThinking) {
      const { i, j } = this.hoverPos;
      if (this.chessBoard[i][j] === 0) this._drawPiece(i, j, 'black', true);
    }
  }

  _drawBoard() {
    const ctx = this.ctx;
    const P = this.PADDING, R = this.RATE, L = this.LINES;
    const W = R * (L - 1) + P * 2;

    ctx.clearRect(0, 0, W, W);

    // 棋盘底色：温润浅木色，配合浅色主题
    const bg = ctx.createLinearGradient(0, 0, W, W);
    bg.addColorStop(0,    '#F2D98A');
    bg.addColorStop(0.42, '#E8C96A');
    bg.addColorStop(1,    '#D4AE48');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, W);

    // 柔和高光
    const hl = ctx.createLinearGradient(0, 0, 0, W * 0.6);
    hl.addColorStop(0,   'rgba(255,255,255,0.22)');
    hl.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(0, 0, W, W);

    // 网格 — 1 物理像素，crisp；横竖各一条路径批量绘制减少 draw call
    const snap = 0.5 / this.DPR;
    ctx.save();
    ctx.strokeStyle = 'rgba(120, 80, 0, 0.28)';
    ctx.lineWidth   = 1 / this.DPR;
    ctx.beginPath();
    for (let i = 0; i < L; i++) {
      const a = Math.round(P + i * R) + snap;
      ctx.moveTo(P,         a); ctx.lineTo(P+(L-1)*R, a); // 横
      ctx.moveTo(a,         P); ctx.lineTo(a, P+(L-1)*R); // 竖
    }
    ctx.stroke();

    // 外框加粗
    ctx.strokeStyle = 'rgba(120, 80, 0, 0.5)';
    ctx.lineWidth   = 2 / this.DPR;
    ctx.strokeRect(
      P + snap, P + snap,
      (L-1)*R - 1/this.DPR,
      (L-1)*R - 1/this.DPR
    );
    ctx.restore();

    // 星位
    const sr = Math.max(2.5, R * 0.1);
    [[3,3],[3,11],[7,7],[11,3],[11,11]].forEach(([si,sj]) => {
      ctx.beginPath();
      ctx.arc(P+sj*R, P+si*R, sr, 0, 2*Math.PI);
      ctx.fillStyle = 'rgba(100,60,0,0.6)';
      ctx.fill();
    });
  }

  _drawPiece(i, j, color, ghost = false) {
    const ctx = this.ctx;
    const x = this.PADDING + j * this.RATE;
    const y = this.PADDING + i * this.RATE;
    const r = this.RATE * 0.43;

    ctx.save();
    ctx.globalAlpha = ghost ? 0.3 : 1;

    if (!ghost) {
      ctx.shadowColor   = color === 'black'
        ? 'rgba(0, 0, 0, 0.45)'
        : 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur    = r * 0.7;
      ctx.shadowOffsetX = r * 0.12;
      ctx.shadowOffsetY = r * 0.18;
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2*Math.PI);

    if (color === 'black') {
      // 黑子：深灰到近黑，带高光
      const g = ctx.createRadialGradient(x-r*.28, y-r*.32, r*.04, x, y, r);
      g.addColorStop(0,   '#8a8a8a');
      g.addColorStop(0.35,'#333333');
      g.addColorStop(1,   '#0d0d0d');
      ctx.fillStyle = g;
    } else {
      // 白子：纯白到浅灰，立体
      const g = ctx.createRadialGradient(x-r*.28, y-r*.32, r*.04, x, y, r);
      g.addColorStop(0,   '#ffffff');
      g.addColorStop(0.45,'#f0f0f0');
      g.addColorStop(1,   '#c0c0c0');
      ctx.fillStyle = g;
    }

    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = color === 'black'
      ? 'rgba(0,0,0,0.7)'
      : 'rgba(160,160,160,0.6)';
    ctx.lineWidth = 0.8 / this.DPR;
    ctx.stroke();
    ctx.restore();
  }

  _drawWinLine(idx) {
    const cells = this.winPatterns[idx];
    const ctx = this.ctx;
    const P = this.PADDING, R = this.RATE;
    const x0 = P + cells[0].j*R, y0 = P + cells[0].i*R;
    const x1 = P + cells[4].j*R, y1 = P + cells[4].i*R;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 113, 227, 0.85)';   // Apple 蓝
    ctx.lineWidth   = Math.max(2.5, R * 0.13);
    ctx.lineCap     = 'round';
    ctx.shadowColor = 'rgba(0, 113, 227, 0.4)';
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  /* ── 坐标转换 ── */

  _getPos(cx, cy) {
    const rect   = this.canvas.getBoundingClientRect();
    const logicW = parseFloat(this.canvas.style.width);
    const px = (cx - rect.left)  * (logicW / rect.width);
    const py = (cy - rect.top)   * (logicW / rect.height);
    const j  = Math.round((px - this.PADDING) / this.RATE);
    const i  = Math.round((py - this.PADDING) / this.RATE);
    if (i >= 0 && i < this.LINES && j >= 0 && j < this.LINES) return {i, j};
    return null;
  }

  /* ── 玩家回合 ── */

  _onMove(e) {
    if (this.over || this.aiThinking) return;
    const pos = this._getPos(e.clientX, e.clientY);
    const prev = this.hoverPos;
    if (pos && this.chessBoard[pos.i][pos.j] === 0) {
      if (!prev || prev.i !== pos.i || prev.j !== pos.j) {
        this.hoverPos = pos; this._redraw();
      }
    } else if (prev) {
      this.hoverPos = null; this._redraw();
    }
  }

  playerRound(cx, cy) {
    if (this.over || !this.player || this.aiThinking) return;
    const pos = this._getPos(cx, cy);
    // 无论落子是否成功都清除 ghost piece，防止残影
    if (this.hoverPos) { this.hoverPos = null; this._redraw(); }
    if (!pos) return;
    const { i, j } = pos;
    if (this.chessBoard[i][j] !== 0) return;
    // 快照必须在落子之前捕获，确保 back()/cancel() 的状态还原正确
    const preSnap = { pSnap: [...this.playerWin], aSnap: [...this.AIWin] };
    this._place(i, j, 1);
    this._redraw();

    const win = this._checkWin(i, j, this.playerWin);
    if (win !== -1) { this._over('玩家胜！', 'win', win); return; }
    if (this._full())  { this._over('平局！', 'draw', -1); return; }

    this.player    = false;
    this.canBack   = true;
    this.canCancel = false;
    this._cancelSnapshot = null;
    this.aiThinking = true;
    this.subEl.textContent = 'AI 思考中…';
    this._updateBtns();
    this._aiTimer = setTimeout(() => { this._aiTimer = null; this._aiRound(i, j, preSnap); }, 320);
  }

  /* ── AI 回合 ── */

  _aiRound(pi, pj, preSnap) {
    if (this.over) return;
    const { i, j } = this._aiChoose();

    // 保存落子前快照（玩家和 AI 均未落子的干净状态）
    this.history.push({
      pi, pj, ai: i, aj: j,
      pSnap: preSnap.pSnap,
      aSnap: preSnap.aSnap,
    });

    this._place(i, j, 2);
    this._redraw();
    this.aiThinking = false;

    const win = this._checkWin(i, j, this.AIWin);
    if (win !== -1) { this._over('电脑胜！', 'lose', win); return; }
    if (this._full())  { this._over('平局！', 'draw', -1); return; }

    this.player = true;
    this.subEl.textContent = '轮到你了';
    this._updateBtns();
  }

  _place(i, j, who) {
    this.chessBoard[i][j] = who;
    const my = who === 1 ? this.playerWin : this.AIWin;
    const en = who === 1 ? this.AIWin     : this.playerWin;
    this.wins[i][j].forEach(k => { my[k]++; if (en[k] < 6) en[k] = 6; });
  }

  /* ══════════════════════════════════════
     AI — Minimax + Alpha-Beta 剪枝（深度4）
     操作 this.chessBoard，不影响 playerWin/AIWin
     ══════════════════════════════════════ */

  _aiChoose() {
    const candidates = this._getCandidates();
    if (!candidates.length) return { i: 7, j: 7 };

    // 用快速启发式对候选点排序，提升 α-β 剪枝效率
    const ranked = this._rankCandidates(candidates).slice(0, 12);

    let bestScore = -Infinity;
    let bestMove  = ranked[0];

    for (const move of ranked) {
      this.chessBoard[move.i][move.j] = 2;
      const score = this._minimax(3, false, -Infinity, Infinity);
      this.chessBoard[move.i][move.j] = 0;
      if (score > bestScore) { bestScore = score; bestMove = move; }
    }
    return bestMove;
  }

  /**
   * Minimax with Alpha-Beta pruning
   * isMax=true → AI(2) 走，isMax=false → 玩家(1) 走
   */
  _minimax(depth, isMax, alpha, beta) {
    const ev = this._evalBoard();
    // 命中终局或到达叶节点
    if (depth === 0 || ev >= 90000 || ev <= -90000) return ev;

    const candidates = this._getCandidates().slice(0, 10);
    if (!candidates.length) return ev;

    if (isMax) {
      let best = -Infinity;
      for (const { i, j } of candidates) {
        this.chessBoard[i][j] = 2;
        best = Math.max(best, this._minimax(depth - 1, false, alpha, beta));
        this.chessBoard[i][j] = 0;
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break; // β 剪枝
      }
      return best;
    } else {
      let best = Infinity;
      for (const { i, j } of candidates) {
        this.chessBoard[i][j] = 1;
        best = Math.min(best, this._minimax(depth - 1, true, alpha, beta));
        this.chessBoard[i][j] = 0;
        beta = Math.min(beta, best);
        if (beta <= alpha) break; // α 剪枝
      }
      return best;
    }
  }

  /**
   * 生成候选落点：距离已有棋子 ≤2 格的所有空位
   */
  _getCandidates() {
    const L = this.LINES, R = 2;
    const seen   = new Uint8Array(L * L);
    const result = [];
    let   hasStone = false;

    for (let i = 0; i < L; i++) {
      for (let j = 0; j < L; j++) {
        if (!this.chessBoard[i][j]) continue;
        hasStone = true;
        for (let di = -R; di <= R; di++) {
          for (let dj = -R; dj <= R; dj++) {
            const ni = i + di, nj = j + dj;
            if (ni < 0 || ni >= L || nj < 0 || nj >= L) continue;
            if (this.chessBoard[ni][nj]) continue;
            const k = ni * L + nj;
            if (!seen[k]) { seen[k] = 1; result.push({ i: ni, j: nj }); }
          }
        }
      }
    }
    if (!hasStone) return [{ i: 7, j: 7 }];
    return result;
  }

  /**
   * 启发式排序：对每个候选点分别模拟 AI 落子 / 玩家落子，
   * 取较大值排序，让 α-β 优先搜索好棋
   */
  _rankCandidates(candidates) {
    return candidates.map(c => {
      this.chessBoard[c.i][c.j] = 2;
      const as = this._evalBoard();
      this.chessBoard[c.i][c.j] = 1;
      const ps = -this._evalBoard();
      this.chessBoard[c.i][c.j] = 0;
      return { ...c, score: Math.max(as, ps) };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * 棋盘静态评估函数
   * 扫描所有行/列/斜线，统计连子数与开放端，累加得分
   * AI(2) 正分，玩家(1) 负分
   */
  _evalBoard() {
    let score = 0;
    const L    = this.LINES;
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (let i = 0; i < L; i++) {
      for (let j = 0; j < L; j++) {
        const who = this.chessBoard[i][j];
        if (!who) continue;

        for (const [di, dj] of dirs) {
          // 只从序列起点开始计数（避免重复）
          const pi = i - di, pj = j - dj;
          if (pi >= 0 && pi < L && pj >= 0 && pj < L &&
              this.chessBoard[pi][pj] === who) continue;

          // 统计连子长度
          let len = 0, ni = i, nj = j;
          while (ni >= 0 && ni < L && nj >= 0 && nj < L &&
                 this.chessBoard[ni][nj] === who) {
            len++; ni += di; nj += dj;
          }

          // 检查两端是否开放
          const frontOpen = ni >= 0 && ni < L && nj >= 0 && nj < L &&
                            this.chessBoard[ni][nj] === 0;
          const backOpen  = pi >= 0 && pi < L && pj >= 0 && pj < L &&
                            this.chessBoard[pi][pj] === 0;
          const opens = (frontOpen ? 1 : 0) + (backOpen ? 1 : 0);

          const s = this._patternScore(len, opens);
          score += who === 2 ? s : -s;
        }
      }
    }
    return score;
  }

  /**
   * 连子模式评分表
   * 双端开放价值远高于单端（双活三/四无法同时封堵）
   */
  _patternScore(len, opens) {
    if (len >= 5) return 100000;  // 必胜
    if (opens === 0) return 0;    // 两端都堵死，无价值
    switch (len) {
      case 4: return opens === 2 ? 50000 : 10000; // 活四 / 冲四
      case 3: return opens === 2 ? 5000  :  1000; // 活三 / 眠三
      case 2: return opens === 2 ? 500   :   100; // 活二 / 眠二
      case 1: return opens === 2 ? 50    :    10;
    }
    return 0;
  }

  /* ── 胜负 ── */

  _checkWin(i, j, mw) {
    for (const k of this.wins[i][j]) if (mw[k] === 5) return k;
    return -1;
  }
  _full() { return this.chessBoard.every(r => r.every(v => v !== 0)); }

  _over(msg, cls, winIdx) {
    this.over      = true;
    this.aiThinking = false;
    this.canBack   = false; // 遊戲結束後禁止悔棋，避免 back() 在無對應 history entry 時破壞狀態
    this.canCancel = false;
    this.titleEl.textContent = msg;
    this.titleEl.className   = cls;
    this.subEl.textContent   = cls === 'draw' ? '势均力敌，平局收场' : '点击"重新开始"再来一局';
    if (winIdx !== -1) this._winLineTimer = setTimeout(() => { this._winLineTimer = null; this._drawWinLine(winIdx); }, 200);
    this._updateBtns();
  }

  /* ── 悔棋 / 取消 ── */

  back() {
    if (this._integrityViolated || !this.canBack || !this.history.length || this.aiThinking) return;
    const s = this.history.pop();
    this.playerWin = [...s.pSnap];
    this.AIWin     = [...s.aSnap];
    this.chessBoard[s.pi][s.pj] = 0;
    this.chessBoard[s.ai][s.aj] = 0;
    this._cancelSnapshot = { ...s };
    this.canCancel = true;
    this.over    = false;
    this.player  = true;
    this.canBack = this.history.length > 0;
    this.titleEl.className   = '';
    this.titleEl.textContent = '五子棋';
    this.subEl.textContent   = '已悔棋，轮到你了';
    this._updateBtns();
    this._redraw();
  }

  cancel() {
    if (this._integrityViolated || !this.canCancel || !this._cancelSnapshot || this.aiThinking) return;
    const s = this._cancelSnapshot;
    this.history.push(s);
    // 恢复快照（快照是本轮玩家落子前的干净状态）
    this.playerWin = [...s.pSnap];
    this.AIWin     = [...s.aSnap];
    // 通过 _place() 重放本轮双方落子，与正常游戏流程保持一致，避免重复维护计数逻辑
    this._place(s.pi, s.pj, 1);
    this._place(s.ai, s.aj, 2);
    this.canCancel = false;
    this._cancelSnapshot = null;
    this.over    = false;
    this.player  = true;
    this.canBack = this.history.length > 0;
    this.titleEl.className   = '';
    this.titleEl.textContent = '五子棋';
    this.subEl.textContent   = '已恢复，轮到你了';
    this._updateBtns();
    this._redraw();
    const pw = this._checkWin(s.pi, s.pj, this.playerWin);
    if (pw !== -1) { this._over('玩家胜！','win',pw); return; }
    const aw = this._checkWin(s.ai, s.aj, this.AIWin);
    if (aw !== -1) { this._over('电脑胜！','lose',aw); }
  }

  /* ── 按钮状态 ── */

  _updateBtns() {
    const bd = !this.canBack   || this.aiThinking || !this.history.length;
    const cd = !this.canCancel || this.aiThinking;
    this._backBtn.disabled   = bd;
    this._cancelBtn.disabled = cd;
  }

  /* ── 事件绑定 ── */

  _bindEvents() {
    const cv = this.canvas;

    // ── 鼠标事件（桌面端）──
    cv.addEventListener('click',      e => this.playerRound(e.clientX, e.clientY));
    cv.addEventListener('mousemove',  e => this._onMove(e));
    cv.addEventListener('mouseleave', () => { if (this.hoverPos) { this.hoverPos = null; this._redraw(); } });

    // ── 触摸事件（移动端）──
    // touchstart：显示落子预览（ghost piece），记录起始位置
    cv.addEventListener('touchstart', e => {
      e.preventDefault();
      if (this.over || !this.player || this.aiThinking) return;
      if (!e.changedTouches.length) return;
      const t = e.changedTouches[0];
      const pos = this._getPos(t.clientX, t.clientY);
      if (pos && this.chessBoard[pos.i][pos.j] === 0) {
        if (!this.hoverPos || this.hoverPos.i !== pos.i || this.hoverPos.j !== pos.j) {
          this.hoverPos = pos;
          this._redraw();
        }
      }
    }, { passive: false });

    // touchmove：手指滑动时跟随更新预览位置，方便精确定位
    cv.addEventListener('touchmove', e => {
      e.preventDefault();
      if (this.over || !this.player || this.aiThinking) return;
      if (!e.changedTouches.length) return;
      const t = e.changedTouches[0];
      const pos = this._getPos(t.clientX, t.clientY);
      if (pos && this.chessBoard[pos.i][pos.j] === 0) {
        if (!this.hoverPos || this.hoverPos.i !== pos.i || this.hoverPos.j !== pos.j) {
          this.hoverPos = pos;
          this._redraw();
        }
      } else if (this.hoverPos) {
        this.hoverPos = null;
        this._redraw();
      }
    }, { passive: false });

    // touchend：手指抬起时提交落子（使用 changedTouches 的最终坐标）
    cv.addEventListener('touchend', e => {
      e.preventDefault();
      if (!e.changedTouches.length) return;
      const t = e.changedTouches[0];
      this.playerRound(t.clientX, t.clientY);
    }, { passive: false });

    // touchcancel：系统打断触摸（来电、弹窗等），清除预览
    cv.addEventListener('touchcancel', () => {
      if (this.hoverPos) { this.hoverPos = null; this._redraw(); }
    });

    document.getElementById('restart').addEventListener('click', () => this.init());
    this._backBtn.addEventListener('click',   () => this.back());
    this._cancelBtn.addEventListener('click', () => this.cancel());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 凍結 prototype，阻止攻擊者透過 Gomoku.prototype.xxx = ... 覆蓋任何方法
  Object.freeze(Gomoku.prototype);
  new Gomoku(document.getElementById('Gomoku'));
});

/* ══════════════════════════════════════
   名言 · 诗句模块
   ══════════════════════════════════════ */

const QUOTES = [
  // 围棋 / 棋道
  { text: "棋局小世界，世界大棋局。", source: "古语" },
  { text: "落子无悔大丈夫，举棋不定非男儿。", source: "棋谚" },
  { text: "善弈者谋势，不善弈者谋子。", source: "棋谚" },
  { text: "博弈之道，贵乎谨严。", source: "《弈旨》" },
  { text: "胜固欣然，败亦可喜。", source: "苏轼" },

  // 哲理 · 先贤
  { text: "知己知彼，百战不殆。", source: "《孙子兵法》" },
  { text: "攻其无备，出其不意。", source: "《孙子兵法》" },
  { text: "不积跬步，无以至千里；不积小流，无以成江海。", source: "《荀子·劝学》" },
  { text: "学而不思则罔，思而不学则殆。", source: "《论语》" },
  { text: "三人行，必有我师焉。", source: "《论语》" },
  { text: "己所不欲，勿施于人。", source: "《论语》" },
  { text: "知之者不如好之者，好之者不如乐之者。", source: "《论语》" },
  { text: "温故而知新，可以为师矣。", source: "《论语》" },
  { text: "博学之，审问之，慎思之，明辨之，笃行之。", source: "《礼记·中庸》" },
  { text: "天下难事，必作于易；天下大事，必作于细。", source: "《道德经》" },
  { text: "知人者智，自知者明；胜人者有力，自胜者强。", source: "《道德经》" },
  { text: "上善若水，水善利万物而不争。", source: "《道德经》" },
  { text: "祸兮福之所倚，福兮祸之所伏。", source: "《道德经》" },
  { text: "路漫漫其修远兮，吾将上下而求索。", source: "屈原《离骚》" },
  { text: "锲而不舍，金石可镂。", source: "《荀子·劝学》" },
  { text: "青，取之于蓝而青于蓝；冰，水为之而寒于水。", source: "《荀子·劝学》" },
  { text: "穷则独善其身，达则兼善天下。", source: "《孟子》" },
  { text: "生于忧患，死于安乐。", source: "《孟子》" },
  { text: "仁者无敌。", source: "《孟子》" },
  { text: "得道多助，失道寡助。", source: "《孟子》" },
  { text: "业精于勤荒于嬉，行成于思毁于随。", source: "韩愈《进学解》" },
  { text: "书山有路勤为径，学海无涯苦作舟。", source: "韩愈" },
  { text: "工欲善其事，必先利其器。", source: "《论语》" },
  { text: "千里之行，始于足下。", source: "《道德经》" },
  { text: "人而无信，不知其可也。", source: "《论语》" },

  // 唐诗
  { text: "会当凌绝顶，一览众山小。", source: "杜甫《望岳》" },
  { text: "烽火连三月，家书抵万金。", source: "杜甫《春望》" },
  { text: "读书破万卷，下笔如有神。", source: "杜甫《奉赠韦左丞丈》" },
  { text: "黄沙百战穿金甲，不破楼兰终不还。", source: "王昌龄《从军行》" },
  { text: "秦时明月汉时关，万里长征人未还。", source: "王昌龄《出塞》" },
  { text: "举头望明月，低头思故乡。", source: "李白《静夜思》" },
  { text: "天生我材必有用，千金散尽还复来。", source: "李白《将进酒》" },
  { text: "长风破浪会有时，直挂云帆济沧海。", source: "李白《行路难》" },
  { text: "抽刀断水水更流，举杯消愁愁更愁。", source: "李白《宣州谢朓楼饯别》" },
  { text: "独在异乡为异客，每逢佳节倍思亲。", source: "王维《九月九日忆山东兄弟》" },
  { text: "劝君更尽一杯酒，西出阳关无故人。", source: "王维《送元二使安西》" },
  { text: "海内存知己，天涯若比邻。", source: "王勃《送杜少府之任蜀州》" },
  { text: "春蚕到死丝方尽，蜡炬成灰泪始干。", source: "李商隐《无题》" },
  { text: "东风不与周郎便，铜雀春深锁二乔。", source: "杜牧《赤壁》" },
  { text: "商女不知亡国恨，隔江犹唱后庭花。", source: "杜牧《泊秦淮》" },
  { text: "停车坐爱枫林晚，霜叶红于二月花。", source: "杜牧《山行》" },
  { text: "春风得意马蹄疾，一日看尽长安花。", source: "孟郊《登科后》" },
  { text: "野火烧不尽，春风吹又生。", source: "白居易《赋得古原草送别》" },
  { text: "同是天涯沦落人，相逢何必曾相识。", source: "白居易《琵琶行》" },
  { text: "日出江花红胜火，春来江水绿如蓝。", source: "白居易《忆江南》" },

  // 宋词
  { text: "人生自是有情痴，此恨不关风与月。", source: "欧阳修《玉楼春》" },
  { text: "先天下之忧而忧，后天下之乐而乐。", source: "范仲淹《岳阳楼记》" },
  { text: "不以物喜，不以己悲。", source: "范仲淹《岳阳楼记》" },
  { text: "明月几时有，把酒问青天。", source: "苏轼《水调歌头》" },
  { text: "但愿人长久，千里共婵娟。", source: "苏轼《水调歌头》" },
  { text: "欲把西湖比西子，淡妆浓抹总相宜。", source: "苏轼《饮湖上初晴后雨》" },
  { text: "竹外桃花三两枝，春江水暖鸭先知。", source: "苏轼《惠崇春江晚景》" },
  { text: "横看成岭侧成峰，远近高低各不同。", source: "苏轼《题西林壁》" },
  { text: "大江东去，浪淘尽，千古风流人物。", source: "苏轼《念奴娇·赤壁怀古》" },
  { text: "人有悲欢离合，月有阴晴圆缺，此事古难全。", source: "苏轼《水调歌头》" },
  { text: "衣带渐宽终不悔，为伊消得人憔悴。", source: "柳永《蝶恋花》" },
  { text: "昨夜西风凋碧树，独上高楼，望尽天涯路。", source: "晏殊《蝶恋花》" },
  { text: "莫道不销魂，帘卷西风，人比黄花瘦。", source: "李清照《醉花阴》" },
  { text: "生当作人杰，死亦为鬼雄。", source: "李清照《夏日绝句》" },
  { text: "山重水复疑无路，柳暗花明又一村。", source: "陆游《游山西村》" },
  { text: "王师北定中原日，家祭无忘告乃翁。", source: "陆游《示儿》" },
  { text: "位卑未敢忘忧国，事定犹须待阖棺。", source: "陆游《病起书怀》" },
  { text: "僵卧孤村不自哀，尚思为国戍轮台。", source: "陆游《十一月四日风雨大作》" },
  { text: "了却君王天下事，赢得生前身后名。", source: "辛弃疾《破阵子》" },
  { text: "青山遮不住，毕竟东流去。", source: "辛弃疾《菩萨蛮》" },
  { text: "众里寻他千百度，蓦然回首，那人却在灯火阑珊处。", source: "辛弃疾《青玉案》" },
  { text: "问渠那得清如许？为有源头活水来。", source: "朱熹《观书有感》" },

  // 近现代
  { text: "自古英雄多磨难，从来纨绔少伟男。", source: "古训" },
  { text: "宝剑锋从磨砺出，梅花香自苦寒来。", source: "古训" },
  { text: "志不强者智不达，言不信者行不果。", source: "《墨子》" },
  { text: "老骥伏枥，志在千里；烈士暮年，壮心不已。", source: "曹操《龟虽寿》" },
  { text: "山不厌高，海不厌深；周公吐哺，天下归心。", source: "曹操《短歌行》" },
  { text: "少壮不努力，老大徒伤悲。", source: "汉乐府《长歌行》" },
  { text: "苟利国家生死以，岂因祸福避趋之。", source: "林则徐" },
  { text: "我自横刀向天笑，去留肝胆两昆仑。", source: "谭嗣同" },
  { text: "人固有一死，或重于泰山，或轻于鸿毛。", source: "司马迁《报任安书》" },
  { text: "不鸣则已，一鸣惊人。", source: "《史记》" },
];

document.addEventListener('DOMContentLoaded', function () {
  const textEl  = document.getElementById('quote-text');
  const srcEl   = document.getElementById('quote-source');
  const nextBtn = document.getElementById('quote-next');
  if (!textEl || !srcEl || !nextBtn) return;

  let lastIdx = -1;
  let timer   = null;

  function pickRandom() {
    let idx;
    do { idx = Math.floor(Math.random() * QUOTES.length); }
    while (idx === lastIdx && QUOTES.length > 1);
    lastIdx = idx;
    return QUOTES[idx];
  }

  function showQuote(q, instant) {
    // 先淡出（或直接写入）
    textEl.classList.remove('visible');
    srcEl.classList.remove('visible');

    var delay = instant ? 0 : 220;
    setTimeout(function () {
      textEl.textContent = q.text;
      srcEl.textContent  = '—— ' + q.source;
      // 双帧确保浏览器先绘制 opacity:0，再触发过渡
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          textEl.classList.add('visible');
          srcEl.classList.add('visible');
        });
      });
    }, delay);
  }

  function scheduleNext() {
    clearInterval(timer);
    timer = setInterval(function () { showQuote(pickRandom(), false); }, 25000);
  }

  nextBtn.addEventListener('click', function () {
    // 用 keyframe class，每次移除再添加，避免 inline style 合帧问题
    var svg = nextBtn.querySelector('svg');
    if (svg) {
      svg.classList.remove('spin-once');
      // 双帧确保 class 移除已被浏览器绘制，再加回去触发动画
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          svg.classList.add('spin-once');
        });
      });
    }
    showQuote(pickRandom(), false);
    scheduleNext();
  });

  // 初始化：先写入文字，再加 visible（instant 模式）
  showQuote(pickRandom(), true);
  scheduleNext();

  // 页面隐藏时暂停轮播，避免后台定时器唤醒
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearInterval(timer);
    } else {
      scheduleNext();
    }
  });
});
