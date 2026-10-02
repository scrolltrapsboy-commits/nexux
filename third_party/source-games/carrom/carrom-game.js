// Carrom Game Controller & Board Renderer

class CarromGame {
    constructor() {
        this.canvas = document.getElementById('carromCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Dimensions
        this.width = 800;
        this.height = 800;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.boardConfig = {
            boardWidth: 800,
            boardHeight: 800,
            boardMargin: 55, // Outer wooden frame thickness
            pocketRadius: 32,
            strikerRadius: 24,
            coinRadius: 18,
            queenRadius: 18,
            strikerMass: 3.5,
            coinMass: 1.0,
            bottomBaselineY: 700,
            topBaselineY: 100,
            baselineMinX: 180,
            baselineMaxX: 620,
            centerCircleRadius: 55,
            queenRingRadius: 28
        };

        // Audio & Physics & AI
        this.audio = new CarromAudio();
        this.physics = new CarromPhysicsEngine(this.boardConfig, this.audio);
        this.ai = new CarromAI(this);

        // Game State
        this.mode = 'ai'; // 'ai', '2p', 'practice'
        this.gameState = 'PLACEMENT'; // 'PLACEMENT', 'AIMING', 'STRIKING', 'ROUND_OVER', 'GAME_OVER'
        this.currentPlayer = 1; // 1: Player 1 (White), 2: Player 2 / AI (Black)
        
        this.scores = { 1: 0, 2: 0 };
        this.pocketedCoins = { 1: [], 2: [] };
        this.foulPenaltiesDue = { 1: 0, 2: 0 };

        // Queen State
        this.queenStatus = 'CENTER'; // 'CENTER', 'PENDING_COVER', 'COVERED'
        this.queenAwaitingPlayer = null;

        // Turn Tracking
        this.coinsPocketedThisTurn = [];
        this.strikerPocketedThisTurn = false;
        this.hasFoulThisTurn = false;

        // Aiming & Power
        this.aimAngle = -Math.PI / 2; // Default facing up
        this.shotPower = 60; // 15 to 100
        this.isDraggingAim = false;
        this.dragStartPos = null;
        this.showAimGuide = true;

        // Interactive Objects
        this.coins = [];
        this.striker = null;
        this.pockets = [];

        // DOM elements
        this.initDOMElements();

        // Setup Board & Pockets
        this.initPockets();
        this.resetGame();

        // Event Listeners
        this.bindEvents();

        // Game Loop
        this.lastTime = performance.now();
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    initDOMElements() {
        this.dom = {
            bannerText: document.getElementById('banner-text'),
            p1Score: document.getElementById('p1-score'),
            p2Score: document.getElementById('p2-score'),
            p1Name: document.getElementById('p1-name'),
            p2Name: document.getElementById('p2-name'),
            p1Card: document.getElementById('card-p1'),
            p2Card: document.getElementById('card-p2'),
            p1TurnBadge: document.getElementById('p1-turn-badge'),
            p2TurnBadge: document.getElementById('p2-turn-badge'),
            p1Tray: document.getElementById('p1-tray'),
            p2Tray: document.getElementById('p2-tray'),
            p1SliderBox: document.getElementById('p1-slider-box'),
            p2SliderBox: document.getElementById('p2-slider-box'),
            p1PosSlider: document.getElementById('p1-pos-slider'),
            p2PosSlider: document.getElementById('p2-pos-slider'),
            powerSlider: document.getElementById('power-slider'),
            powerValue: document.getElementById('power-value'),
            powerBarFill: document.getElementById('power-bar-fill'),
            strikeBtn: document.getElementById('strike-action-btn'),
            aimGuideBtn: document.getElementById('aim-guide-toggle'),
            soundBtn: document.getElementById('sound-btn'),
            rulesBtn: document.getElementById('rules-btn'),
            resetBtn: document.getElementById('reset-btn'),
            rulesModal: document.getElementById('rules-modal'),
            closeRulesBtn: document.getElementById('close-rules-btn'),
            startPlayingBtn: document.getElementById('start-playing-btn'),
            gameoverModal: document.getElementById('gameover-modal'),
            winnerTitle: document.getElementById('winner-title'),
            winnerSubtitle: document.getElementById('winner-subtitle'),
            finalP1Name: document.getElementById('final-p1-name'),
            finalP2Name: document.getElementById('final-p2-name'),
            finalP1Score: document.getElementById('final-p1-score'),
            finalP2Score: document.getElementById('final-p2-score'),
            playAgainBtn: document.getElementById('play-again-btn'),
            queenStatusText: document.getElementById('queen-status-text'),
            modeBtns: document.querySelectorAll('.mode-btn')
        };
    }

    initPockets() {
        const margin = this.boardConfig.boardMargin;
        const pr = this.boardConfig.pocketRadius;
        const w = this.width;
        const h = this.height;

        // 4 Standard Authentic Corner Pockets
        const pocketInset = margin + pr * 0.9;
        this.pockets = [
            { pos: new Vector2(pocketInset, pocketInset), radius: pr }, // Top-Left
            { pos: new Vector2(w - pocketInset, pocketInset), radius: pr }, // Top-Right
            { pos: new Vector2(pocketInset, h - pocketInset), radius: pr }, // Bottom-Left
            { pos: new Vector2(w - pocketInset, h - pocketInset), radius: pr } // Bottom-Right
        ];

        this.physics.initPockets(this.pockets);
        this.physics.onPocketedCallback = (disc) => this.handleDiscPocketed(disc);
    }

    resetGame() {
        this.scores = { 1: 0, 2: 0 };
        this.pocketedCoins = { 1: [], 2: [] };
        this.foulPenaltiesDue = { 1: 0, 2: 0 };
        this.queenStatus = 'CENTER';
        this.queenAwaitingPlayer = null;
        this.currentPlayer = 1;
        this.gameState = 'PLACEMENT';
        this.coinsPocketedThisTurn = [];
        this.strikerPocketedThisTurn = false;

        // Arrange Authentic Carrom Center (19 Coins: 1 Queen + 9 White + 9 Black)
        this.arrangeCoins();

        // Create Striker
        this.createStriker();

        this.updateUI();
        this.setAnnouncement("Player 1's Turn! Position striker and aim.");
    }

    arrangeCoins() {
        this.coins = [];
        const cx = this.width / 2;
        const cy = this.height / 2;
        const r = this.boardConfig.coinRadius;

        // 1. Queen at exact center (Red)
        const queen = new Disc(cx, cy, this.boardConfig.queenRadius, this.boardConfig.coinMass, 'queen', '#ef4444');
        queen.isQueen = true;
        this.coins.push(queen);

        // 2. Inner Ring (6 coins: alternating White and Black)
        const innerRadius = r * 2.05;
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const type = (i % 2 === 0) ? 'white' : 'black';
            const color = (type === 'white') ? '#f8fafc' : '#1e293b';
            const x = cx + innerRadius * Math.cos(angle);
            const y = cy + innerRadius * Math.sin(angle);
            this.coins.push(new Disc(x, y, r, this.boardConfig.coinMass, type, color));
        }

        // 3. Outer Ring (12 coins: alternating White and Black)
        const outerRadius = r * 4.08;
        for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI) / 6 + (Math.PI / 12);
            const type = (i % 2 === 0) ? 'white' : 'black';
            const color = (type === 'white') ? '#f8fafc' : '#1e293b';
            const x = cx + outerRadius * Math.cos(angle);
            const y = cy + outerRadius * Math.sin(angle);
            this.coins.push(new Disc(x, y, r, this.boardConfig.coinMass, type, color));
        }

        this.physics.setDiscs(this.coins);
    }

    createStriker() {
        const baselineY = (this.currentPlayer === 1) 
            ? this.boardConfig.bottomBaselineY 
            : this.boardConfig.topBaselineY;
        const initialX = this.width / 2;

        this.striker = new Disc(
            initialX, 
            baselineY, 
            this.boardConfig.strikerRadius, 
            this.boardConfig.strikerMass, 
            'striker', 
            '#f59e0b'
        );
        this.aimAngle = (this.currentPlayer === 1) ? -Math.PI / 2 : Math.PI / 2;

        // Include striker in physics list
        this.physics.setDiscs([...this.coins, this.striker]);
    }

    resetStrikerPlacement() {
        if (!this.striker) return;
        const baselineY = (this.currentPlayer === 1) 
            ? this.boardConfig.bottomBaselineY 
            : this.boardConfig.topBaselineY;
        
        let sliderVal = (this.currentPlayer === 1) 
            ? parseFloat(this.dom.p1PosSlider.value) 
            : parseFloat(this.dom.p2PosSlider.value);
            
        const minX = this.boardConfig.baselineMinX;
        const maxX = this.boardConfig.baselineMaxX;
        let x = minX + (maxX - minX) * (sliderVal / 100);

        this.striker.pos.set(x, baselineY);
        this.striker.vel.set(0, 0);
        this.striker.pocketed = false;
        this.striker.isSinking = false;
        this.striker.sinkScale = 1.0;

        this.aimAngle = (this.currentPlayer === 1) ? -Math.PI / 2 : Math.PI / 2;
        this.gameState = 'PLACEMENT';

        // Check coin collision at baseline placement
        this.adjustStrikerOverlap();
    }

    adjustStrikerOverlap() {
        let hasOverlap = true;
        let attempts = 0;
        while (hasOverlap && attempts < 10) {
            hasOverlap = false;
            for (const coin of this.coins) {
                if (!coin.pocketed && !coin.isSinking) {
                    if (this.striker.pos.dist(coin.pos) < this.striker.radius + coin.radius + 1) {
                        hasOverlap = true;
                        // Nudge striker slightly
                        this.striker.pos.x += 10;
                        if (this.striker.pos.x > this.boardConfig.baselineMaxX) {
                            this.striker.pos.x = this.boardConfig.baselineMinX;
                        }
                    }
                }
            }
            attempts++;
        }
    }

    handleDiscPocketed(disc) {
        if (disc.type === 'striker') {
            this.strikerPocketedThisTurn = true;
            this.hasFoulThisTurn = true;
        } else {
            this.coinsPocketedThisTurn.push(disc);
        }
    }

    executeStrike(power = null, angle = null) {
        if (this.gameState === 'STRIKING') return;

        const strikePower = power !== null ? power : (this.shotPower * 0.32); // Scale to velocity
        const strikeAngle = angle !== null ? angle : this.aimAngle;

        this.striker.vel.x = Math.cos(strikeAngle) * strikePower;
        this.striker.vel.y = Math.sin(strikeAngle) * strikePower;

        this.gameState = 'STRIKING';
        this.coinsPocketedThisTurn = [];
        this.strikerPocketedThisTurn = false;
        this.hasFoulThisTurn = false;

        this.audio.playStrike(strikePower / 30);
        this.setAnnouncement("Shot released! In motion...");
    }

    triggerAITurn() {
        this.setAnnouncement("🤖 Computer is thinking...");
        setTimeout(() => {
            if (this.currentPlayer !== 2 || this.gameState !== 'PLACEMENT') return;

            const bestShot = this.ai.calculateBestShot();
            if (bestShot) {
                // Update AI striker position on baseline
                this.striker.pos.x = bestShot.strikerX;
                const minX = this.boardConfig.baselineMinX;
                const maxX = this.boardConfig.baselineMaxX;
                const pct = ((bestShot.strikerX - minX) / (maxX - minX)) * 100;
                this.dom.p2PosSlider.value = pct;

                this.aimAngle = bestShot.angle;

                setTimeout(() => {
                    this.executeStrike(bestShot.power, bestShot.angle);
                }, 700);
            } else {
                this.executeStrike(20, Math.PI / 2);
            }
        }, 800);
    }

    processTurnEnd() {
        let playerCoinCount = 0;
        let opponentCoinCount = 0;
        let queenPocketed = false;

        const myColor = (this.currentPlayer === 1) ? 'white' : 'black';
        const oppColor = (this.currentPlayer === 1) ? 'black' : 'white';
        const oppPlayer = (this.currentPlayer === 1) ? 2 : 1;

        for (const coin of this.coinsPocketedThisTurn) {
            if (coin.isQueen) {
                queenPocketed = true;
            } else if (coin.type === myColor) {
                playerCoinCount++;
                this.scores[this.currentPlayer] += 1;
                this.pocketedCoins[this.currentPlayer].push(coin.type);
            } else if (coin.type === oppColor) {
                opponentCoinCount++;
                this.scores[oppPlayer] += 1;
                this.pocketedCoins[oppPlayer].push(coin.type);
            }
        }

        let extraTurn = false;
        let turnMsg = "";

        // Handle Queen rules
        if (queenPocketed) {
            if (this.queenStatus === 'CENTER') {
                this.queenStatus = 'PENDING_COVER';
                this.queenAwaitingPlayer = this.currentPlayer;
                turnMsg = `👑 Queen Pocketed! Pocket a ${myColor} coin next to cover it!`;

                // If player also pocketed their own coin on the same shot, Queen is immediately covered!
                if (playerCoinCount > 0) {
                    this.queenStatus = 'COVERED';
                    this.scores[this.currentPlayer] += 3;
                    this.pocketedCoins[this.currentPlayer].push('queen');
                    this.audio.playQueenCovered();
                    turnMsg = `🎉 Queen COVERED (+3 pts) and ${playerCoinCount} coin(s) pocketed!`;
                    extraTurn = true;
                } else {
                    extraTurn = true; // Extra turn to cover Queen
                }
            }
        } else if (this.queenStatus === 'PENDING_COVER') {
            if (this.queenAwaitingPlayer === this.currentPlayer) {
                if (playerCoinCount > 0 && !this.strikerPocketedThisTurn) {
                    // Queen successfully covered on this turn!
                    this.queenStatus = 'COVERED';
                    this.scores[this.currentPlayer] += 3;
                    this.pocketedCoins[this.currentPlayer].push('queen');
                    this.audio.playQueenCovered();
                    turnMsg = `🎉 Queen COVERED (+3 pts) and ${playerCoinCount} coin(s) pocketed!`;
                    extraTurn = true;
                } else {
                    // Failed to cover queen! Queen returns to center circle
                    this.returnQueenToCenter();
                    this.queenStatus = 'CENTER';
                    this.queenAwaitingPlayer = null;
                    turnMsg = `❌ Failed to cover Queen! Queen returns to center.`;
                    extraTurn = false;
                }
            }
        }

        // Handle Striker Foul
        if (this.strikerPocketedThisTurn) {
            this.audio.playFoul();
            turnMsg = `⚠️ FOUL! Striker pocketed! 1 Penalty coin returned to center.`;
            this.applyFoulPenalty(this.currentPlayer);
            extraTurn = false;
        } else if (!queenPocketed && this.queenStatus !== 'PENDING_COVER') {
            if (playerCoinCount > 0) {
                extraTurn = true;
                turnMsg = `✨ Pocketed ${playerCoinCount} coin(s)! Extra Turn granted!`;
            } else if (opponentCoinCount > 0) {
                turnMsg = `Pocketed opponent coin (+1 pt to opponent). Turn passes.`;
                extraTurn = false;
            } else {
                turnMsg = `No coins pocketed. Turn passes.`;
                extraTurn = false;
            }
        }

        // Check Win Condition
        if (this.checkGameOver()) {
            return;
        }

        // Switch turn if no extra turn
        if (!extraTurn) {
            this.currentPlayer = (this.currentPlayer === 1) ? 2 : 1;
        }

        this.setAnnouncement(turnMsg);
        this.updateUI();

        // Reset striker for next player
        this.resetStrikerPlacement();

        // If next player is AI, trigger AI shot
        if (this.mode === 'ai' && this.currentPlayer === 2) {
            this.triggerAITurn();
        }
    }

    returnQueenToCenter() {
        const queen = this.coins.find(c => c.isQueen);
        if (queen) {
            queen.pocketed = false;
            queen.isSinking = false;
            queen.sinkScale = 1.0;
            queen.pos.set(this.width / 2, this.height / 2);
            queen.vel.set(0, 0);

            // If center is blocked by other coins, nudge
            for (const coin of this.coins) {
                if (coin !== queen && !coin.pocketed && queen.pos.dist(coin.pos) < queen.radius + coin.radius) {
                    queen.pos.x += queen.radius * 2;
                }
            }
        }
    }

    applyFoulPenalty(player) {
        const color = (player === 1) ? 'white' : 'black';
        const pocketedIndex = this.pocketedCoins[player].indexOf(color);
        
        if (pocketedIndex !== -1) {
            // Remove one coin from player's pocketed tray and return to center
            this.pocketedCoins[player].splice(pocketedIndex, 1);
            this.scores[player] = Math.max(0, this.scores[player] - 1);

            // Find a pocketed coin of this type and reactivate it
            const coin = this.coins.find(c => c.type === color && c.pocketed);
            if (coin) {
                coin.pocketed = false;
                coin.isSinking = false;
                coin.sinkScale = 1.0;
                coin.pos.set(this.width / 2 + (player === 1 ? -30 : 30), this.height / 2);
                coin.vel.set(0, 0);
            }
        } else {
            // Due penalty
            this.foulPenaltiesDue[player]++;
        }
    }

    checkGameOver() {
        const remainingWhite = this.coins.filter(c => c.type === 'white' && !c.pocketed).length;
        const remainingBlack = this.coins.filter(c => c.type === 'black' && !c.pocketed).length;
        const queenPocketed = this.coins.find(c => c.isQueen)?.pocketed;

        if ((remainingWhite === 0 && queenPocketed) || (remainingBlack === 0 && queenPocketed) || (remainingWhite === 0 && remainingBlack === 0)) {
            this.gameState = 'GAME_OVER';
            
            let winner = "Player 1";
            if (this.scores[2] > this.scores[1]) {
                winner = (this.mode === 'ai') ? "Computer AI" : "Player 2";
            } else if (this.scores[1] === this.scores[2]) {
                winner = "It's a Tie Game!";
            }

            this.dom.winnerTitle.innerText = `${winner.toUpperCase()} WINS!`;
            this.dom.winnerSubtitle.innerText = `Final Score: ${this.scores[1]} vs ${this.scores[2]}`;
            this.dom.finalP1Score.innerText = this.scores[1];
            this.dom.finalP2Score.innerText = this.scores[2];
            this.dom.finalP1Name.innerText = "Player 1 (White)";
            this.dom.finalP2Name.innerText = (this.mode === 'ai') ? "Computer AI" : "Player 2 (Black)";

            this.dom.gameoverModal.style.display = 'flex';
            return true;
        }
        return false;
    }

    setAnnouncement(msg) {
        this.dom.bannerText.innerText = msg;
    }

    updateUI() {
        // Scores
        this.dom.p1Score.innerText = this.scores[1];
        this.dom.p2Score.innerText = this.scores[2];

        // Active Player Card Highlighting
        if (this.currentPlayer === 1) {
            this.dom.p1Card.classList.add('active-turn');
            this.dom.p2Card.classList.remove('active-turn');
            this.dom.p1TurnBadge.innerText = "YOUR TURN";
            this.dom.p2TurnBadge.innerText = "WAITING";
            this.dom.p1SliderBox.style.display = 'flex';
            this.dom.p2SliderBox.style.display = 'none';
        } else {
            this.dom.p2Card.classList.add('active-turn');
            this.dom.p1Card.classList.remove('active-turn');
            this.dom.p1TurnBadge.innerText = "WAITING";
            this.dom.p2TurnBadge.innerText = (this.mode === 'ai') ? "AI THINKING..." : "YOUR TURN";
            this.dom.p1SliderBox.style.display = 'none';
            this.dom.p2SliderBox.style.display = (this.mode === '2p') ? 'flex' : 'none';
        }

        // Pocketed Trays
        this.dom.p1Tray.innerHTML = this.pocketedCoins[1].map(type => 
            `<div class="tray-coin ${type}"></div>`
        ).join('');

        this.dom.p2Tray.innerHTML = this.pocketedCoins[2].map(type => 
            `<div class="tray-coin ${type}"></div>`
        ).join('');

        // Queen Status UI
        if (this.queenStatus === 'CENTER') {
            this.dom.queenStatusText.innerText = "In Center (+3 pts)";
            this.dom.queenStatusText.style.color = "#fef08a";
        } else if (this.queenStatus === 'PENDING_COVER') {
            const name = (this.queenAwaitingPlayer === 1) ? "Player 1" : (this.mode === 'ai' ? "AI" : "Player 2");
            this.dom.queenStatusText.innerText = `Pocketed by ${name}! MUST COVER THIS TURN!`;
            this.dom.queenStatusText.style.color = "#f87171";
        } else if (this.queenStatus === 'COVERED') {
            this.dom.queenStatusText.innerText = "Covered & Claimed! (+3 pts awarded)";
            this.dom.queenStatusText.style.color = "#4ade80";
        }
    }

    bindEvents() {
        // Mode Selector
        this.dom.modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.mode = btn.dataset.mode;
                this.dom.p2Name.innerText = (this.mode === 'ai') ? "Computer AI" : "Player 2";
                this.resetGame();
            });
        });

        // Sliders
        this.dom.p1PosSlider.addEventListener('input', (e) => {
            if (this.currentPlayer === 1 && this.gameState === 'PLACEMENT') {
                const minX = this.boardConfig.baselineMinX;
                const maxX = this.boardConfig.baselineMaxX;
                this.striker.pos.x = minX + (maxX - minX) * (parseFloat(e.target.value) / 100);
                this.adjustStrikerOverlap();
            }
        });

        this.dom.p2PosSlider.addEventListener('input', (e) => {
            if (this.currentPlayer === 2 && this.gameState === 'PLACEMENT' && this.mode === '2p') {
                const minX = this.boardConfig.baselineMinX;
                const maxX = this.boardConfig.baselineMaxX;
                this.striker.pos.x = minX + (maxX - minX) * (parseFloat(e.target.value) / 100);
                this.adjustStrikerOverlap();
            }
        });

        // Power Slider
        this.dom.powerSlider.addEventListener('input', (e) => {
            this.shotPower = parseFloat(e.target.value);
            this.dom.powerValue.innerText = `${Math.round(this.shotPower)}%`;
            this.dom.powerBarFill.style.width = `${this.shotPower}%`;
        });

        // Strike Action Button
        this.dom.strikeBtn.addEventListener('click', () => {
            if (this.gameState === 'PLACEMENT' || this.gameState === 'AIMING') {
                this.executeStrike();
            }
        });

        // Aim Guide Toggle
        this.dom.aimGuideBtn.addEventListener('click', () => {
            this.showAimGuide = !this.showAimGuide;
            this.dom.aimGuideBtn.innerText = `🎯 Guide: ${this.showAimGuide ? 'ON' : 'OFF'}`;
            this.dom.aimGuideBtn.classList.toggle('btn-secondary', this.showAimGuide);
        });

        // Sound Toggle
        this.dom.soundBtn.addEventListener('click', () => {
            const enabled = this.audio.toggleSound();
            this.dom.soundBtn.innerText = enabled ? '🔊' : '🔇';
        });

        // Modals & Reset
        this.dom.rulesBtn.addEventListener('click', () => this.dom.rulesModal.style.display = 'flex');
        this.dom.closeRulesBtn.addEventListener('click', () => this.dom.rulesModal.style.display = 'none');
        this.dom.startPlayingBtn.addEventListener('click', () => this.dom.rulesModal.style.display = 'none');
        this.dom.resetBtn.addEventListener('click', () => this.resetGame());
        this.dom.playAgainBtn.addEventListener('click', () => {
            this.dom.gameoverModal.style.display = 'none';
            this.resetGame();
        });

        // Canvas Mouse / Touch Aiming Events
        const getCanvasCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (this.width / rect.width),
                y: (clientY - rect.top) * (this.height / rect.height)
            };
        };

        const onPointerDown = (e) => {
            if (this.gameState === 'STRIKING' || (this.mode === 'ai' && this.currentPlayer === 2)) return;
            const coords = getCanvasCoords(e);
            
            // Check if clicking near striker to drag position or aim
            const dist = this.striker.pos.dist(coords);
            if (dist < this.striker.radius * 2.5) {
                this.isDraggingAim = true;
                this.dragStartPos = coords;
                this.gameState = 'AIMING';
            } else {
                // Direct aim to clicked position
                this.aimAngle = Math.atan2(coords.y - this.striker.pos.y, coords.x - this.striker.pos.x);
                this.isDraggingAim = true;
                this.dragStartPos = coords;
                this.gameState = 'AIMING';
            }
        };

        const onPointerMove = (e) => {
            if (!this.isDraggingAim || this.gameState === 'STRIKING') return;
            const coords = getCanvasCoords(e);

            // Slingshot pullback calculation: vector from current mouse to striker
            const dx = this.striker.pos.x - coords.x;
            const dy = this.striker.pos.y - coords.y;
            const pullDist = Math.sqrt(dx * dx + dy * dy);

            if (pullDist > 10) {
                // Pullback mode: aiming along pull direction
                this.aimAngle = Math.atan2(coords.y - this.striker.pos.y, coords.x - this.striker.pos.x);
                
                // Dynamic power from drag distance
                const dynamicPower = Math.min(Math.max((pullDist / 180) * 100, 15), 100);
                this.shotPower = dynamicPower;
                this.dom.powerSlider.value = dynamicPower;
                this.dom.powerValue.innerText = `${Math.round(dynamicPower)}%`;
                this.dom.powerBarFill.style.width = `${dynamicPower}%`;
            }
        };

        const onPointerUp = (e) => {
            if (!this.isDraggingAim) return;
            this.isDraggingAim = false;

            // If dragged significantly, execute strike!
            const coords = getCanvasCoords(e.changedTouches ? e.changedTouches[0] : e);
            const dist = this.striker.pos.dist(coords);
            if (dist > 25 && (this.gameState === 'AIMING' || this.gameState === 'PLACEMENT')) {
                this.executeStrike();
            }
        };

        this.canvas.addEventListener('mousedown', onPointerDown);
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);

        this.canvas.addEventListener('touchstart', onPointerDown, { passive: true });
        window.addEventListener('touchmove', onPointerMove, { passive: true });
        window.addEventListener('touchend', onPointerUp);

        // Keyboard Shortcut: Space to strike, Arrow keys to position
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.gameState === 'PLACEMENT' || this.gameState === 'AIMING') {
                    this.executeStrike();
                }
            } else if (e.code === 'ArrowLeft' && this.gameState === 'PLACEMENT') {
                const slider = (this.currentPlayer === 1) ? this.dom.p1PosSlider : this.dom.p2PosSlider;
                slider.value = Math.max(0, parseFloat(slider.value) - 3);
                slider.dispatchEvent(new Event('input'));
            } else if (e.code === 'ArrowRight' && this.gameState === 'PLACEMENT') {
                const slider = (this.currentPlayer === 1) ? this.dom.p1PosSlider : this.dom.p2PosSlider;
                slider.value = Math.min(100, parseFloat(slider.value) + 3);
                slider.dispatchEvent(new Event('input'));
            }
        });
    }

    // ==================== RENDERING ENGINE ====================

    drawBoard() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const m = this.boardConfig.boardMargin;

        // 1. Outer Dark Wooden Frame
        ctx.fillStyle = '#1e1108';
        ctx.fillRect(0, 0, w, h);

        // Wood grain gradient on outer frame
        const frameGrad = ctx.createLinearGradient(0, 0, w, h);
        frameGrad.addColorStop(0, '#3e2311');
        frameGrad.addColorStop(0.5, '#241308');
        frameGrad.addColorStop(1, '#442713');
        ctx.fillStyle = frameGrad;
        ctx.fillRect(8, 8, w - 16, h - 16);

        // Frame inner shadow
        ctx.strokeStyle = '#100703';
        ctx.lineWidth = 4;
        ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);

        // 2. Playfield Surface (Smooth polished maple / birch wood)
        const boardGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, 500);
        boardGrad.addColorStop(0, '#f5deb3'); // Wheat
        boardGrad.addColorStop(0.7, '#e8c99b');
        boardGrad.addColorStop(1, '#d4af7a'); // Darker wood edge
        ctx.fillStyle = boardGrad;
        ctx.fillRect(m, m, w - 2 * m, h - 2 * m);

        // Inner Board Boundary Line
        ctx.strokeStyle = '#5c3317';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(m + 4, m + 4, w - 2 * m - 8, h - 2 * m - 8);

        // 3. Baselines & Circles
        this.drawBaselines();

        // 4. Center Circle & Concentric Patterns
        this.drawCenterCircle();

        // 5. Corner Arrows & Guides pointing to pockets
        this.drawCornerGuides();

        // 6. Corner Pockets
        this.drawPockets();
    }

    drawBaselines() {
        const ctx = this.ctx;
        const minX = this.boardConfig.baselineMinX;
        const maxX = this.boardConfig.baselineMaxX;
        const bottomY = this.boardConfig.bottomBaselineY;
        const topY = this.boardConfig.topBaselineY;
        const circleR = 15;
        const lineOffset = 18;

        // Function to draw one pair of baseline lines & red end circles
        const drawPair = (y, isActive) => {
            ctx.save();
            ctx.strokeStyle = isActive ? '#991b1b' : '#78350f';
            ctx.lineWidth = 2;

            // Double baseline track
            ctx.beginPath();
            ctx.moveTo(minX, y - lineOffset);
            ctx.lineTo(maxX, y - lineOffset);
            ctx.moveTo(minX, y + lineOffset);
            ctx.lineTo(maxX, y + lineOffset);
            ctx.stroke();

            // End Circles
            [minX, maxX].forEach(x => {
                // Outer circle
                ctx.beginPath();
                ctx.arc(x, y, circleR, 0, Math.PI * 2);
                ctx.fillStyle = '#ef4444';
                ctx.fill();
                ctx.strokeStyle = '#7f1d1d';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Inner dot
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            });
            ctx.restore();
        };

        // Bottom baseline (Player 1)
        drawPair(bottomY, this.currentPlayer === 1);
        // Top baseline (Player 2 / AI)
        drawPair(topY, this.currentPlayer === 2);

        // Left & Right decorative baselines
        ctx.save();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        const minY = this.boardConfig.baselineMinX;
        const maxY = this.boardConfig.baselineMaxX;
        const leftX = this.boardConfig.topBaselineY;
        const rightX = this.boardConfig.bottomBaselineY;

        // Left vertical baseline
        ctx.beginPath();
        ctx.moveTo(leftX - lineOffset, minY);
        ctx.lineTo(leftX - lineOffset, maxY);
        ctx.moveTo(leftX + lineOffset, minY);
        ctx.lineTo(leftX + lineOffset, maxY);
        ctx.stroke();

        // Right vertical baseline
        ctx.beginPath();
        ctx.moveTo(rightX - lineOffset, minY);
        ctx.lineTo(rightX - lineOffset, maxY);
        ctx.moveTo(rightX + lineOffset, minY);
        ctx.lineTo(rightX + lineOffset, maxY);
        ctx.stroke();
        ctx.restore();
    }

    drawCenterCircle() {
        const ctx = this.ctx;
        const cx = this.width / 2;
        const cy = this.height / 2;

        ctx.save();
        // Outer decorative ring
        ctx.beginPath();
        ctx.arc(cx, cy, this.boardConfig.centerCircleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Star / Flower pattern rays
        ctx.strokeStyle = 'rgba(120, 53, 15, 0.4)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI) / 6;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * 15, cy + Math.sin(angle) * 15);
            ctx.lineTo(cx + Math.cos(angle) * this.boardConfig.centerCircleRadius, cy + Math.sin(angle) * this.boardConfig.centerCircleRadius);
            ctx.stroke();
        }

        // Inner Queen circle
        ctx.beginPath();
        ctx.arc(cx, cy, this.boardConfig.queenRingRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.fill();
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.restore();
    }

    drawCornerGuides() {
        const ctx = this.ctx;
        const cx = this.width / 2;
        const cy = this.height / 2;

        ctx.save();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;

        // Diagonal lines pointing towards pockets
        this.pockets.forEach(pocket => {
            const angle = Math.atan2(pocket.pos.y - cy, pocket.pos.x - cx);
            const startDist = this.boardConfig.centerCircleRadius + 20;
            const endDist = 380;

            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * startDist, cy + Math.sin(angle) * startDist);
            ctx.lineTo(cx + Math.cos(angle) * endDist, cy + Math.sin(angle) * endDist);
            ctx.stroke();

            // Arrow head near pocket
            const arrowX = cx + Math.cos(angle) * (endDist - 30);
            const arrowY = cy + Math.sin(angle) * (endDist - 30);
            ctx.beginPath();
            ctx.arc(arrowX, arrowY, 14, 0, Math.PI * 2);
            ctx.strokeStyle = '#991b1b';
            ctx.stroke();
        });
        ctx.restore();
    }

    drawPockets() {
        const ctx = this.ctx;
        this.pockets.forEach(pocket => {
            ctx.save();
            // Drop shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 10;

            // Outer dark wooden pocket ring
            ctx.beginPath();
            ctx.arc(pocket.pos.x, pocket.pos.y, pocket.radius + 4, 0, Math.PI * 2);
            ctx.fillStyle = '#100703';
            ctx.fill();

            // Inner hole with depth gradient
            ctx.shadowBlur = 0;
            const holeGrad = ctx.createRadialGradient(
                pocket.pos.x - 4, pocket.pos.y - 4, 2,
                pocket.pos.x, pocket.pos.y, pocket.radius
            );
            holeGrad.addColorStop(0, '#000000');
            holeGrad.addColorStop(0.7, '#0f0f0f');
            holeGrad.addColorStop(1, '#2a1a10');

            ctx.beginPath();
            ctx.arc(pocket.pos.x, pocket.pos.y, pocket.radius, 0, Math.PI * 2);
            ctx.fillStyle = holeGrad;
            ctx.fill();

            // Leather pocket net pattern
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        });
    }

    drawCoins() {
        for (const coin of this.coins) {
            if (coin.pocketed) continue;
            this.drawDisc(coin);
        }
    }

    drawStriker() {
        if (!this.striker || this.striker.pocketed) return;
        this.drawDisc(this.striker);

        // Draw Aim Trajectory & Prediction Guide
        if (this.showAimGuide && (this.gameState === 'PLACEMENT' || this.gameState === 'AIMING')) {
            this.drawAimGuide();
        }
    }

    drawDisc(disc) {
        const ctx = this.ctx;
        const x = disc.pos.x;
        const y = disc.pos.y;
        const r = disc.radius * disc.sinkScale;

        if (r <= 0) return;

        ctx.save();

        // 1. Drop Shadow
        ctx.beginPath();
        ctx.arc(x + 3, y + 4, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fill();

        // 2. Base Shading
        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);

        if (disc.type === 'white') {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.6, '#f1f5f9');
            grad.addColorStop(1, '#94a3b8');
        } else if (disc.type === 'black') {
            grad.addColorStop(0, '#475569');
            grad.addColorStop(0.6, '#1e293b');
            grad.addColorStop(1, '#090d16');
        } else if (disc.type === 'queen') {
            grad.addColorStop(0, '#f87171');
            grad.addColorStop(0.6, '#dc2626');
            grad.addColorStop(1, '#7f1d1d');
        } else if (disc.type === 'striker') {
            grad.addColorStop(0, '#fef08a');
            grad.addColorStop(0.4, '#f59e0b');
            grad.addColorStop(1, '#b45309');
        }

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 3. Rim & Concentric Grooves
        ctx.strokeStyle = (disc.type === 'white') ? '#cbd5e1' : 
                          (disc.type === 'black') ? '#334155' : 
                          (disc.type === 'queen') ? '#fca5a5' : '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner engraved rings
        ctx.beginPath();
        ctx.arc(x, y, r * 0.65, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
        ctx.stroke();

        // Queen / Striker Center Emblem
        if (disc.isQueen) {
            ctx.beginPath();
            ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        } else if (disc.type === 'striker') {
            // Striker Crosshair / Star
            ctx.beginPath();
            ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
            ctx.fillStyle = '#d97706';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();
    }

    drawAimGuide() {
        const ctx = this.ctx;
        const sx = this.striker.pos.x;
        const sy = this.striker.pos.y;
        const dirX = Math.cos(this.aimAngle);
        const dirY = Math.sin(this.aimAngle);
        const powerRatio = this.shotPower / 100;

        ctx.save();

        // Aim Line Length proportional to power
        const maxLen = 320 * powerRatio + 60;
        let endX = sx + dirX * maxLen;
        let endY = sy + dirY * maxLen;

        // Check for wall bounce reflection
        const minX = this.boardConfig.boardMargin + this.boardConfig.strikerRadius;
        const maxX = this.boardConfig.boardWidth - this.boardConfig.boardMargin - this.boardConfig.strikerRadius;
        const minY = this.boardConfig.boardMargin + this.boardConfig.strikerRadius;
        const maxY = this.boardConfig.boardHeight - this.boardConfig.boardMargin - this.boardConfig.strikerRadius;

        let hitWall = false;
        let wallHitPoint = null;
        let bounceDir = null;

        // Line-wall intersections
        if (dirX > 0 && endX > maxX) {
            const t = (maxX - sx) / dirX;
            wallHitPoint = new Vector2(maxX, sy + dirY * t);
            bounceDir = new Vector2(-dirX, dirY);
            hitWall = true;
        } else if (dirX < 0 && endX < minX) {
            const t = (minX - sx) / dirX;
            wallHitPoint = new Vector2(minX, sy + dirY * t);
            bounceDir = new Vector2(-dirX, dirY);
            hitWall = true;
        }

        if (dirY > 0 && endY > maxY) {
            const t = (maxY - sy) / dirY;
            wallHitPoint = new Vector2(sx + dirX * t, maxY);
            bounceDir = new Vector2(dirX, -dirY);
            hitWall = true;
        } else if (dirY < 0 && endY < minY) {
            const t = (minY - sy) / dirY;
            wallHitPoint = new Vector2(sx + dirX * t, minY);
            bounceDir = new Vector2(dirX, -dirY);
            hitWall = true;
        }

        // Draw primary dashed trajectory
        ctx.beginPath();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.moveTo(sx, sy);

        if (hitWall && wallHitPoint) {
            ctx.lineTo(wallHitPoint.x, wallHitPoint.y);
            ctx.stroke();

            // Draw bounce line
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
            const bounceLen = maxLen * 0.4;
            ctx.moveTo(wallHitPoint.x, wallHitPoint.y);
            ctx.lineTo(wallHitPoint.x + bounceDir.x * bounceLen, wallHitPoint.y + bounceDir.y * bounceLen);
            ctx.stroke();

            // Ghost circle at wall
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.arc(wallHitPoint.x, wallHitPoint.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
        } else {
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Aim arrowhead
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.arc(endX, endY, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
        }

        // Target ghost striker cursor
        ctx.beginPath();
        ctx.arc(endX, endY, this.boardConfig.strikerRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }

    // ==================== MAIN GAME LOOP ====================

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Physics update when discs are in motion
        if (this.gameState === 'STRIKING') {
            this.physics.update();

            // Check if all discs have come to a complete rest
            if (this.physics.areAllDiscsStopped()) {
                this.gameState = 'ROUND_OVER';
                this.processTurnEnd();
            }
        }

        // Render scene
        this.drawBoard();
        this.drawCoins();
        this.drawStriker();

        requestAnimationFrame(this.loop);
    }
}

// Initialize on DOM Loaded
window.addEventListener('DOMContentLoaded', () => {
    window.carrom = new CarromGame();
});
