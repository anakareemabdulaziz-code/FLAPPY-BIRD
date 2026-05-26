/**
 * game.js - Core Game Engine for Flappy Bird Premium
 * Implements physics, parallax backgrounds, procedural themes, particles, shop, powerups, and game loops.
 */

// ==========================================
// CONSTANTS & METADATA
// ==========================================
const CANVAS_WIDTH = 450;
const CANVAS_HEIGHT = 800;

// Game States
const STATE_MENU = 'MENU';
const STATE_GETREADY = 'GETREADY';
const STATE_PLAYING = 'PLAYING';
const STATE_PAUSED = 'PAUSED';
const STATE_GAMEOVER = 'GAMEOVER';

// Skins Configuration
const SKINS = {
    classic: {
        id: 'classic',
        name: 'Classic Yellow',
        cost: 0,
        unlocked: true,
        primaryColor: '#f7b731',
        secondaryColor: '#eb3b5a',
        eyeColor: '#fff',
        trailColor: 'rgba(255, 255, 255, 0.4)',
        type: 'organic'
    },
    cyber: {
        id: 'cyber',
        name: 'Cyber Drone',
        cost: 10,
        unlocked: false,
        primaryColor: '#00f0ff',
        secondaryColor: '#ff007f',
        eyeColor: '#ff007f',
        trailColor: 'rgba(0, 240, 255, 0.5)',
        type: 'cyber'
    },
    bat: {
        id: 'bat',
        name: 'Chubby Bat',
        cost: 17,
        unlocked: false,
        primaryColor: '#8854d0',
        secondaryColor: '#2d98da',
        eyeColor: '#ff3f34',
        trailColor: 'rgba(136, 84, 208, 0.4)',
        type: 'bat'
    },
    phoenix: {
        id: 'phoenix',
        name: 'Golden Phoenix',
        cost: 30,
        unlocked: false,
        primaryColor: '#ffaa00',
        secondaryColor: '#ff3300',
        eyeColor: '#fff',
        trailColor: 'rgba(255, 170, 0, 0.6)',
        type: 'phoenix'
    },
    rocket: {
        id: 'rocket',
        name: 'Rocket Bird',
        cost: 45,
        unlocked: false,
        primaryColor: '#d1d8e0',
        secondaryColor: '#fc5c65',
        eyeColor: '#2bcbba',
        trailColor: 'rgba(252, 92, 101, 0.7)',
        type: 'rocket'
    }
};

// ==========================================
// GAME INITIALIZATION & SETUP
// ==========================================
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Audio instance
        this.audio = new SoundEffects();
        
        // System variables
        this.state = STATE_MENU;
        this.theme = 'sunny';
        this.coins = 0;
        this.score = 0;
        this.highScore = 0;
        this.coinsEarnedThisRun = 0;
        this.isNewHighScore = false;
        
        // Time management
        this.lastTime = 0;
        this.accumulator = 0;
        this.timestep = 1000 / 60; // 60 FPS target
        
        // Entities & Systems
        this.bird = null;
        this.pipes = [];
        this.coinsList = [];
        this.powerups = [];
        this.particles = [];
        this.bgManager = null;
        
        // Powerup state timers (in ms)
        this.activePowerups = {
            shield: 0,
            magnet: 0,
            shrink: 0
        };
        
        // Pipe Spawner configs
        this.pipeSpawnTimer = 0;
        this.pipeSpawnInterval = 1600; // time between pipes in ms
        this.minPipeGap = 135;
        this.maxPipeGap = 160;
        this.speedMultiplier = 1.0;
        
        // LocalStorage loading
        this.loadSaveData();
        
        // Setup Canvas DPI scaling
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Initialize Background
        this.bgManager = new BackgroundManager(this);
        
        // Initialize Bird (will be reset when game starts)
        this.bird = new Bird(this);
        
        // UI Bindings
        this.bindEvents();
        this.updateUI();
        this.renderSkinPreviews();
    }

    /**
     * Set up higher quality rendering for high-DPI screens.
     */
    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        // Internal size of canvas
        this.canvas.width = CANVAS_WIDTH * dpr;
        this.canvas.height = CANVAS_HEIGHT * dpr;
        
        // Scaling context
        this.ctx.scale(dpr, dpr);
    }

    /**
     * Retrieve score, coins, and skin data from localStorage.
     */
    loadSaveData() {
        this.highScore = parseInt(localStorage.getItem('fb_highScore')) || 0;
        this.coins = parseInt(localStorage.getItem('fb_coins')) || 0;
        this.theme = localStorage.getItem('fb_theme') || 'sunny';
        
        // Apply theme to document body
        document.body.setAttribute('data-theme', this.theme);
        
        // Audio volume setting
        const sfxOn = localStorage.getItem('fb_sfxOn') !== 'false';
        document.getElementById('soundToggle').checked = sfxOn;
        this.audio.setMuted(!sfxOn);
        
        // Load skins data
        const unlockedSkins = JSON.parse(localStorage.getItem('fb_unlockedSkins')) || ['classic'];
        const equippedSkin = localStorage.getItem('fb_equippedSkin') || 'classic';
        
        // Mark unlocked states in SKINS object
        unlockedSkins.forEach(skinId => {
            if (SKINS[skinId]) SKINS[skinId].unlocked = true;
        });
        
        // Set currently equipped skin
        this.equippedSkin = SKINS[equippedSkin] ? equippedSkin : 'classic';
    }

    /**
     * Persist important game data to localStorage.
     */
    saveGameData() {
        localStorage.setItem('fb_highScore', this.highScore.toString());
        localStorage.setItem('fb_coins', this.coins.toString());
        localStorage.setItem('fb_theme', this.theme);
        
        // Save skins data
        const unlockedSkins = Object.keys(SKINS).filter(id => SKINS[id].unlocked);
        localStorage.setItem('fb_unlockedSkins', JSON.stringify(unlockedSkins));
        localStorage.setItem('fb_equippedSkin', this.equippedSkin);
    }

    /**
     * Bind click, touch, keyboard, and UI button events.
     */
    bindEvents() {
        // Core game inputs
        const handleJumpAction = (e) => {
            // Prevent scrolling on mobile/keyboard
            if (e.cancelable) e.preventDefault();
            
            if (this.state === STATE_GETREADY) {
                this.state = STATE_PLAYING;
                this.bird.jump();
                this.audio.playJump();
                document.getElementById('tapToPlayIndicator').classList.remove('active');
            } else if (this.state === STATE_PLAYING) {
                this.bird.jump();
                this.audio.playJump();
            } else if (this.state === STATE_MENU) {
                // UI clicks handle menu transitions
            }
        };

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                handleJumpAction(e);
            }
            if (e.code === 'KeyP') {
                this.togglePause();
            }
        });

        this.canvas.addEventListener('touchstart', (e) => {
            handleJumpAction(e);
        }, { passive: false });

        this.canvas.addEventListener('mousedown', (e) => {
            handleJumpAction(e);
        });

        // UI Menu Navigation
        document.getElementById('btnPlay').addEventListener('click', () => {
            this.audio.playClick();
            this.startNewGame();
        });

        document.getElementById('btnPlayAgain').addEventListener('click', () => {
            this.audio.playClick();
            this.startNewGame();
        });

        document.getElementById('btnBackToMenu').addEventListener('click', () => {
            this.audio.playClick();
            this.transitionToScreen('mainMenuScreen');
            this.state = STATE_MENU;
        });

        document.getElementById('btnOpenShop').addEventListener('click', () => {
            this.audio.playClick();
            this.transitionToScreen('shopScreen');
            this.updateShopUI();
        });

        document.getElementById('btnBackFromShop').addEventListener('click', () => {
            this.audio.playClick();
            this.transitionToScreen('mainMenuScreen');
        });

        document.getElementById('btnOpenSettings').addEventListener('click', () => {
            this.audio.playClick();
            this.transitionToScreen('settingsScreen');
        });

        document.getElementById('btnBackFromSettings').addEventListener('click', () => {
            this.audio.playClick();
            this.transitionToScreen('mainMenuScreen');
        });

        // Theme selection clicks
        const themes = ['sunny', 'cyberpunk', 'synthwave'];
        themes.forEach(themeName => {
            const btn = document.getElementById('theme' + themeName.charAt(0).toUpperCase() + themeName.slice(1));
            if (btn) {
                btn.addEventListener('click', () => {
                    this.audio.playClick();
                    // Set active theme button
                    document.querySelectorAll('.theme-options .theme-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Set theme
                    this.theme = themeName;
                    document.body.setAttribute('data-theme', themeName);
                    this.saveGameData();
                });
            }
        });

        // SFX toggle
        document.getElementById('soundToggle').addEventListener('change', (e) => {
            const isMuted = !e.target.checked;
            this.audio.setMuted(isMuted);
            localStorage.setItem('fb_sfxOn', (!isMuted).toString());
            if (!isMuted) this.audio.playClick();
        });
    }

    /**
     * Start/Restart game setup.
     */
    startNewGame() {
        this.score = 0;
        this.coinsEarnedThisRun = 0;
        this.isNewHighScore = false;
        this.speedMultiplier = 1.0;
        
        // Reset dynamic objects
        this.pipes = [];
        this.coinsList = [];
        this.powerups = [];
        this.particles = [];
        
        // Reset timers
        this.pipeSpawnTimer = 0;
        
        // Reset powerups
        this.activePowerups.shield = 0;
        this.activePowerups.magnet = 0;
        this.activePowerups.shrink = 0;
        
        // Initialize Bird
        this.bird = new Bird(this);
        this.bird.setSkin(SKINS[this.equippedSkin]);
        
        // UI states
        document.getElementById('hudOverlay').classList.add('active');
        document.getElementById('tapToPlayIndicator').classList.add('active');
        
        this.updateUI();
        this.transitionToScreen(null); // Hide all overlay menus
        this.state = STATE_GETREADY;
    }

    /**
     * Transition between overlay views.
     * @param {string} screenId - ID of overlay element to show, or null to hide all
     */
    transitionToScreen(screenId) {
        document.querySelectorAll('.overlay-screen').forEach(scr => {
            scr.classList.remove('active');
        });
        
        if (screenId) {
            document.getElementById(screenId).classList.add('active');
        }
    }

    /**
     * Pauses or resumes the active gameplay.
     */
    togglePause() {
        if (this.state === STATE_PLAYING) {
            this.state = STATE_PAUSED;
            document.getElementById('pauseIndicator').classList.add('active');
        } else if (this.state === STATE_PAUSED) {
            this.state = STATE_PLAYING;
            document.getElementById('pauseIndicator').classList.remove('active');
            this.lastTime = performance.now();
        }
    }

    /**
     * End gameplay, trigger crash particles, compute high scores.
     */
    triggerGameOver() {
        this.state = STATE_GAMEOVER;
        this.audio.playCrash();
        
        // Guncangan layar (Screen Shake)
        this.canvas.classList.add('screen-shake');
        setTimeout(() => this.canvas.classList.remove('screen-shake'), 500);

        // Add crash explosion particles
        for (let i = 0; i < 40; i++) {
            this.particles.push(new Particle(
                this.bird.x,
                this.bird.y,
                this.bird.skin.primaryColor,
                'square'
            ));
        }

        // Coins and scores persistence
        this.coins += this.coinsEarnedThisRun;
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.isNewHighScore = true;
        }

        this.saveGameData();
        this.updateUI();
        
        // Wait briefly for crash animation, then show gameover overlay
        setTimeout(() => {
            if (this.state === STATE_GAMEOVER) {
                document.getElementById('hudOverlay').classList.remove('active');
                
                // Set score outputs
                document.getElementById('endScore').innerText = this.score;
                document.getElementById('endCoinsEarned').innerText = '+' + this.coinsEarnedThisRun;
                document.getElementById('endBestScore').innerText = this.highScore;
                
                // Highscore badge
                const badge = document.getElementById('newHighScoreBadge');
                badge.style.display = this.isNewHighScore ? 'block' : 'none';
                
                this.transitionToScreen('gameOverScreen');
            }
        }, 1000);
    }

    /**
     * Redraw numbers on HUD.
     */
    updateUI() {
        document.getElementById('currentScore').innerText = this.score;
        document.getElementById('currentCoins').innerText = this.coins + this.coinsEarnedThisRun;
        document.getElementById('mainHighScore').innerText = this.highScore;
        document.getElementById('shopCoins').innerText = this.coins;
    }

    /**
     * Re-renders the list of skins dynamically in Shop screen.
     */
    updateShopUI() {
        document.getElementById('shopCoins').innerText = this.coins;
        
        // Re-generate list items
        const grid = document.getElementById('skinsGrid');
        grid.innerHTML = '';
        
        Object.keys(SKINS).forEach(skinId => {
            const skin = SKINS[skinId];
            const isEquipped = (this.equippedSkin === skinId);
            
            const card = document.createElement('div');
            card.className = `skin-card ${isEquipped ? 'equipped' : ''}`;
            card.setAttribute('data-skin', skinId);
            
            let bottomTagHTML = '';
            if (isEquipped) {
                bottomTagHTML = `<span class="skin-equipped-tag">Active</span>`;
            } else if (skin.unlocked) {
                bottomTagHTML = `<span class="skin-equipped-tag" style="color: var(--text-light)">Tap to Equip</span>`;
            } else {
                bottomTagHTML = `<span class="skin-price">💰 ${skin.cost}</span>`;
            }

            const lockedTagHTML = !skin.unlocked ? `<span class="skin-locked-tag">🔒</span>` : '';

            card.innerHTML = `
                ${lockedTagHTML}
                <div class="skin-preview-container">
                    <canvas class="skin-canvas-preview" id="preview_${skinId}"></canvas>
                </div>
                <h3 class="skin-name">${skin.name}</h3>
                ${bottomTagHTML}
            `;
            
            // Purchase/equip listeners
            card.addEventListener('click', () => {
                this.handleSkinClick(skinId);
            });

            grid.appendChild(card);
            
            // Draw skin preview onto canvas inside card
            setTimeout(() => {
                const prevCanvas = document.getElementById(`preview_${skinId}`);
                if (prevCanvas) {
                    prevCanvas.width = 48;
                    prevCanvas.height = 48;
                    const prevCtx = prevCanvas.getContext('2d');
                    this.drawSkinPreviewOnContext(prevCtx, skin);
                }
            }, 10);
        });
    }

    /**
     * Performs skin purchases or switches equipped skin.
     * @param {string} skinId 
     */
    handleSkinClick(skinId) {
        const skin = SKINS[skinId];
        if (!skin) return;

        if (skin.unlocked) {
            // Equip skin
            this.equippedSkin = skinId;
            this.audio.playClick();
            this.saveGameData();
            this.updateShopUI();
        } else {
            // Purchase skin
            if (this.coins >= skin.cost) {
                this.coins -= skin.cost;
                skin.unlocked = true;
                this.equippedSkin = skinId;
                this.audio.playPowerup(); // Play exciting powerup tone for unlocked!
                this.saveGameData();
                this.updateShopUI();
                this.updateUI();
            } else {
                // Cant afford - shake the price visual or play minor buzz
                this.audio.playShieldBreak(); // Buzzy sound
                alert('Koin Anda tidak cukup untuk membeli skin ini! Kumpulkan lebih banyak koin saat terbang.');
            }
        }
    }

    /**
     * Draws pre-rendered skins inside shop cards.
     */
    drawSkinPreviewOnContext(pCtx, skin) {
        pCtx.clearRect(0, 0, 48, 48);
        
        pCtx.save();
        pCtx.translate(24, 24);
        
        // Create custom mock bird object to render
        const mockBird = {
            radius: 14,
            skin: skin,
            wingFlapStage: 1,
            yVel: 0,
            angle: 0,
            getRadius() { return this.radius; }
        };
        
        this.bird.drawBirdOnContext(pCtx, mockBird);
        pCtx.restore();
    }

    /**
     * Pre-render skin icons inside buttons if necessary.
     */
    renderSkinPreviews() {
        // Standard placeholder for future setups
    }

    // ==========================================
    // CORE LOOP & LOGIC
    // ==========================================
    run(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        let elapsed = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Caps max elapsed to avoid giant physics jumps (e.g. from backgrounding tab)
        if (elapsed > 100) elapsed = 100;

        this.accumulator += elapsed;

        // Fixed timestep loop
        while (this.accumulator >= this.timestep) {
            this.update(this.timestep);
            this.accumulator -= this.timestep;
        }

        this.render();
        requestAnimationFrame((t) => this.run(t));
    }

    /**
     * Updates physics, movements, collision, power-ups, spawner.
     * @param {number} dt 
     */
    update(dt) {
        // Global background scroll
        this.bgManager.update(dt);

        if (this.state === STATE_PLAYING) {
            // Update speed multiplier based on score to increase difficulty
            this.speedMultiplier = 1.0 + Math.min(this.score * 0.015, 0.5);

            // Update Bird Physics
            this.bird.update(dt);

            // Update active Powerup Timers
            Object.keys(this.activePowerups).forEach(key => {
                if (this.activePowerups[key] > 0) {
                    this.activePowerups[key] -= dt;
                    if (this.activePowerups[key] <= 0) {
                        this.activePowerups[key] = 0;
                        this.audio.playShieldBreak(); // Sound alert for expiration
                        this.updatePowerupHUD();
                    }
                }
            });

            // Spawner System (Pipes, Coins, PowerUps)
            this.pipeSpawnTimer += dt;
            const dynamicSpawnInterval = this.pipeSpawnInterval / this.speedMultiplier;
            
            if (this.pipeSpawnTimer >= dynamicSpawnInterval) {
                this.pipeSpawnTimer = 0;
                this.spawnPipeCombo();
            }

            // Update Entity Lists
            this.pipes.forEach(pipe => pipe.update(dt, this.speedMultiplier));
            this.coinsList.forEach(coin => coin.update(dt, this.speedMultiplier, this.bird, this.activePowerups.magnet > 0));
            this.powerups.forEach(pw => pw.update(dt, this.speedMultiplier));
            
            // Clean up out of bounds elements
            this.pipes = this.pipes.filter(pipe => !pipe.isOffscreen);
            this.coinsList = this.coinsList.filter(coin => !coin.isOffscreen && !coin.collected);
            this.powerups = this.powerups.filter(pw => !pw.isOffscreen && !pw.collected);

            // Collisions Engine
            this.checkCollisions();
        }

        // Update active particle effects
        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.alpha > 0);
    }

    /**
     * Generates a pair of pipes, placing a coin or powerup inside the gap.
     */
    spawnPipeCombo() {
        const gap = Math.max(
            this.maxPipeGap - (this.score * 0.8), // Narrower gap as score increases
            this.minPipeGap
        );
        
        // Random Y center for the gap
        const minY = 160;
        const maxY = CANVAS_HEIGHT - 220;
        const gapCenterY = minY + Math.random() * (maxY - minY);
        
        const topHeight = gapCenterY - gap / 2;
        const bottomHeight = CANVAS_HEIGHT - (gapCenterY + gap / 2) - 112; // Ground height is 112
        
        // Pipe moving attribute starting around score 10
        const isMoving = (this.score >= 10 && Math.random() < 0.4);
        
        const newPipe = new Pipe(CANVAS_WIDTH, topHeight, bottomHeight, gap, isMoving);
        this.pipes.push(newPipe);

        // Chance of spawning Powerup vs Gold Coin inside the gap center
        // Spawns power-up 12% of the time, coin 88%
        if (Math.random() < 0.12) {
            const types = ['shield', 'magnet', 'shrink'];
            const randomType = types[Math.floor(Math.random() * types.length)];
            this.powerups.push(new PowerUp(CANVAS_WIDTH + 35, gapCenterY, randomType));
        } else {
            this.coinsList.push(new Coin(CANVAS_WIDTH + 35, gapCenterY));
        }
    }

    /**
     * Comprehensive circular/rectangular overlapping solver.
     */
    checkCollisions() {
        // Ground Collision
        const groundY = CANVAS_HEIGHT - 112;
        const birdR = this.bird.getRadius();
        
        if (this.bird.y + birdR >= groundY) {
            this.bird.y = groundY - birdR;
            this.triggerGameOver();
            return;
        }

        // Ceiling collision
        if (this.bird.y - birdR <= 0) {
            this.bird.y = birdR;
            this.bird.yVel = 0.5; // push down gently
        }

        // Pipes Collisions
        for (let i = 0; i < this.pipes.length; i++) {
            const pipe = this.pipes[i];
            
            // Score tracking (Passed the pipe)
            if (!pipe.passed && this.bird.x > pipe.x + pipe.width / 2) {
                pipe.passed = true;
                this.score++;
                this.audio.playScore();
                this.updateUI();
            }

            // Hitbox overlap test
            if (pipe.collidesWith(this.bird)) {
                if (this.activePowerups.shield > 0) {
                    // Shield breaks
                    this.activePowerups.shield = 0;
                    this.audio.playShieldBreak();
                    this.updatePowerupHUD();
                    
                    // Push pipe out of collision scope immediately
                    pipe.x = -200; 
                    
                    // Spawn shield burst particles
                    for (let p = 0; p < 20; p++) {
                        this.particles.push(new Particle(this.bird.x, this.bird.y, '#00f0ff', 'circle'));
                    }
                } else {
                    this.triggerGameOver();
                    return;
                }
            }
        }

        // Coins Collection
        this.coinsList.forEach(coin => {
            if (!coin.collected && coin.collidesWith(this.bird)) {
                coin.collected = true;
                this.coinsEarnedThisRun++;
                this.audio.playCoin();
                this.updateUI();
                
                // Spawn golden sparkle particles
                for (let p = 0; p < 12; p++) {
                    this.particles.push(new Particle(coin.x, coin.y, '#f7b731', 'sparkle'));
                }
            }
        });

        // Power-ups Collection
        this.powerups.forEach(pw => {
            if (!pw.collected && pw.collidesWith(this.bird)) {
                pw.collected = true;
                
                // Activate powerup for 10 seconds (10,000ms)
                this.activePowerups[pw.type] = 10000;
                this.audio.playPowerup();
                this.updatePowerupHUD();

                // Sparkle visual explosion
                let sparkleColor = '#00f0ff'; // Shield
                if (pw.type === 'magnet') sparkleColor = '#f7b731';
                if (pw.type === 'shrink') sparkleColor = '#ff007f';

                for (let p = 0; p < 18; p++) {
                    this.particles.push(new Particle(pw.x, pw.y, sparkleColor, 'sparkle'));
                }
            }
        });
    }

    /**
     * Redraw HTML elements representing powerups countdowns.
     */
    updatePowerupHUD() {
        const hud = document.getElementById('powerupIndicator');
        hud.innerHTML = '';

        Object.keys(this.activePowerups).forEach(type => {
            const timeRemaining = this.activePowerups[type];
            if (timeRemaining > 0) {
                const badge = document.createElement('div');
                badge.className = `powerup-badge ${type}`;
                
                let label = '';
                if (type === 'shield') label = `🛡️ Shield (${Math.ceil(timeRemaining / 1000)}s)`;
                if (type === 'magnet') label = `🧲 Magnet (${Math.ceil(timeRemaining / 1000)}s)`;
                if (type === 'shrink') label = `⚡ Tiny (${Math.ceil(timeRemaining / 1000)}s)`;

                badge.innerText = label;
                hud.appendChild(badge);
            }
        });
    }

    /**
     * Clear and redraw entities onto context.
     */
    render() {
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // 1. Draw backgrounds (parallax layers)
        this.bgManager.draw(this.ctx);
        
        // 2. Draw Pipes
        this.pipes.forEach(pipe => pipe.draw(this.ctx, this.theme));
        
        // 3. Draw Coins
        this.coinsList.forEach(coin => coin.draw(this.ctx));
        
        // 4. Draw Powerups
        this.powerups.forEach(pw => pw.draw(this.ctx));

        // 5. Draw Particle effects
        this.particles.forEach(p => p.draw(this.ctx));

        // 6. Draw Bird (in READY/PLAYING/GAMEOVER states)
        if (this.state !== STATE_MENU) {
            this.bird.draw(this.ctx);
        }
        
        // 7. Draw foreground scrolling ground
        this.bgManager.drawGround(this.ctx);
    }
}

// ==========================================
// BACKGROUND MANAGER (PARALLAX EFFECT)
// ==========================================
class BackgroundManager {
    constructor(game) {
        this.game = game;
        this.groundOffset = 0;
        
        // Background scroll positions (relative speeds)
        this.cloudsOffset = 0;
        this.cityOffset = 0;
        
        // Pre-calculated mountains / buildings parameters
        this.farBuildings = [];
        this.nearBuildings = [];
        
        this.generateParallaxStructures();
    }

    /**
     * Generates randomized but consistent mountains and buildings so they look natural scrolling.
     */
    generateParallaxStructures() {
        // Generate buildings for Cyberpunk/Synthwave & hills for Sunny
        for (let i = 0; i < 15; i++) {
            this.farBuildings.push({
                x: i * 80,
                width: 60 + Math.random() * 60,
                height: 120 + Math.random() * 150,
                colorSeed: Math.random()
            });
            this.nearBuildings.push({
                x: i * 110,
                width: 80 + Math.random() * 70,
                height: 200 + Math.random() * 180,
                colorSeed: Math.random()
            });
        }
    }

    update(dt) {
        const isScrolling = (this.game.state === STATE_PLAYING || this.game.state === STATE_GETREADY || this.game.state === STATE_MENU);
        
        if (isScrolling) {
            const baseSpeed = 2.4 * this.game.speedMultiplier;
            
            // Speed scaling for parallax depth layers
            this.groundOffset = (this.groundOffset + baseSpeed) % 100;
            this.cityOffset = (this.cityOffset + baseSpeed * 0.25) % 1000;
            this.cloudsOffset = (this.cloudsOffset + baseSpeed * 0.08) % 1000;
        }
    }

    draw(ctx) {
        const theme = this.game.theme;
        
        // LAYER 1: SKY GRADIENT
        const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        
        if (theme === 'sunny') {
            skyGrad.addColorStop(0, '#70c5ce');
            skyGrad.addColorStop(1, '#beeef1');
        } else if (theme === 'cyberpunk') {
            skyGrad.addColorStop(0, '#0a0b10');
            skyGrad.addColorStop(0.6, '#13141f');
            skyGrad.addColorStop(1, '#1b1b2f');
        } else if (theme === 'synthwave') {
            skyGrad.addColorStop(0, '#1a052e');
            skyGrad.addColorStop(0.5, '#4c0e65');
            skyGrad.addColorStop(0.8, '#f35588');
            skyGrad.addColorStop(1, '#ff8a5c');
        }
        
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // SPECIAL THEME BG VISUALS
        if (theme === 'synthwave') {
            // Draw retro sun
            ctx.save();
            const sunX = CANVAS_WIDTH / 2;
            const sunY = CANVAS_HEIGHT * 0.45;
            const sunR = 75;
            
            const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
            sunGrad.addColorStop(0, '#fede15');
            sunGrad.addColorStop(0.5, '#ff007f');
            sunGrad.addColorStop(1, '#2b0f54');
            
            ctx.fillStyle = sunGrad;
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#ff007f';
            ctx.beginPath();
            ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw horizontal retro synthwave lines inside the sun
            ctx.restore();
            ctx.fillStyle = '#1a052e';
            for (let y = sunY - sunR; y < sunY + sunR; y += 8) {
                const height = Math.max(1, (y - (sunY - sunR)) / 14);
                ctx.fillRect(sunX - sunR - 10, y, sunR * 2 + 20, height);
            }
        }

        // LAYER 2: FAR MOUNTAINS / SCENERY (PARALLAX)
        ctx.save();
        ctx.translate(-this.cloudsOffset, 0);
        
        if (theme === 'sunny') {
            // Soft background clouds
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            const cloudXOffsets = [0, 220, 480, 700, 920];
            cloudXOffsets.forEach(ox => {
                ctx.beginPath();
                ctx.arc(ox + 40, 150, 30, 0, Math.PI * 2);
                ctx.arc(ox + 80, 140, 40, 0, Math.PI * 2);
                ctx.arc(ox + 120, 150, 30, 0, Math.PI * 2);
                ctx.arc(ox + 80, 170, 30, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        ctx.restore();

        // LAYER 3: MID-GROUND CITIES / MOUNTAINS
        ctx.save();
        ctx.translate(-this.cityOffset, 0);
        
        const count = 4; // loop count to cover canvas scroll width
        for (let loop = 0; loop < count; loop++) {
            const shiftX = loop * 450;
            
            if (theme === 'sunny') {
                // Soft green rolling hills
                ctx.fillStyle = '#81d897';
                ctx.beginPath();
                ctx.moveTo(shiftX - 50, CANVAS_HEIGHT - 110);
                ctx.quadraticCurveTo(shiftX + 110, CANVAS_HEIGHT - 210, shiftX + 260, CANVAS_HEIGHT - 120);
                ctx.quadraticCurveTo(shiftX + 370, CANVAS_HEIGHT - 190, shiftX + 510, CANVAS_HEIGHT - 110);
                ctx.lineTo(shiftX + 510, CANVAS_HEIGHT - 110);
                ctx.fill();
                
                // Shadowed closer hill
                ctx.fillStyle = '#6ab87e';
                ctx.beginPath();
                ctx.moveTo(shiftX - 20, CANVAS_HEIGHT - 110);
                ctx.quadraticCurveTo(shiftX + 160, CANVAS_HEIGHT - 170, shiftX + 320, CANVAS_HEIGHT - 130);
                ctx.quadraticCurveTo(shiftX + 410, CANVAS_HEIGHT - 160, shiftX + 480, CANVAS_HEIGHT - 110);
                ctx.fill();
            } else if (theme === 'cyberpunk') {
                // Silhouette cyberpunk tall skyscrapers with neon window dots
                this.farBuildings.forEach(b => {
                    ctx.fillStyle = 'rgba(21, 23, 38, 0.9)';
                    const bx = b.x + shiftX;
                    const by = CANVAS_HEIGHT - 112 - b.height * 0.8;
                    ctx.fillRect(bx, by, b.width, b.height * 0.8);
                    
                    // Windows dots
                    ctx.fillStyle = b.colorSeed < 0.5 ? '#ff007f' : '#00f0ff';
                    ctx.globalAlpha = 0.4;
                    for (let wx = bx + 5; wx < bx + b.width - 5; wx += 14) {
                        for (let wy = by + 10; wy < CANVAS_HEIGHT - 120; wy += 20) {
                            if (Math.random() < 0.2) {
                                ctx.fillRect(wx, wy, 4, 6);
                            }
                        }
                    }
                    ctx.globalAlpha = 1.0;
                });
            } else if (theme === 'synthwave') {
                // Wireframe outline retro vector grid hills
                ctx.strokeStyle = '#ff007f';
                ctx.fillStyle = '#2b0f54';
                ctx.lineWidth = 1.5;
                
                ctx.beginPath();
                ctx.moveTo(shiftX - 50, CANVAS_HEIGHT - 110);
                
                // Generate a retro mountain outline
                const mPoints = [
                    {x: shiftX + 60, y: CANVAS_HEIGHT - 280},
                    {x: shiftX + 130, y: CANVAS_HEIGHT - 200},
                    {x: shiftX + 220, y: CANVAS_HEIGHT - 350},
                    {x: shiftX + 310, y: CANVAS_HEIGHT - 220},
                    {x: shiftX + 400, y: CANVAS_HEIGHT - 290},
                    {x: shiftX + 500, y: CANVAS_HEIGHT - 110}
                ];
                
                mPoints.forEach(p => {
                    ctx.lineTo(p.x, p.y);
                });
                
                ctx.fill();
                ctx.stroke();
                
                // Add retro wire lines
                ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
                mPoints.forEach(p => {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x, CANVAS_HEIGHT - 112);
                    ctx.stroke();
                });
            }
        }
        ctx.restore();
    }

    /**
     * Draws the ground, implementing separate aesthetics per theme.
     */
    drawGround(ctx) {
        const theme = this.game.theme;
        const groundY = CANVAS_HEIGHT - 112;
        
        ctx.save();
        
        if (theme === 'sunny') {
            // Classic Flappy Bird Ground: green top grass line, sandy yellow dirt base.
            ctx.fillStyle = '#ded895';
            ctx.fillRect(0, groundY, CANVAS_WIDTH, 112);
            
            // Grass green top
            ctx.fillStyle = '#73c73f';
            ctx.fillRect(0, groundY, CANVAS_WIDTH, 14);
            
            // Grass secondary highlight line
            ctx.fillStyle = '#559c25';
            ctx.fillRect(0, groundY + 14, CANVAS_WIDTH, 4);

            // Diagonal brown soil lines
            ctx.strokeStyle = '#c5be7b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            
            const startX = -this.groundOffset;
            for (let x = startX; x < CANVAS_WIDTH + 40; x += 18) {
                ctx.moveTo(x, groundY + 25);
                ctx.lineTo(x - 10, groundY + 112);
            }
            ctx.stroke();

        } else if (theme === 'cyberpunk') {
            // Neon digital cyber floor
            ctx.fillStyle = '#08080c';
            ctx.fillRect(0, groundY, CANVAS_WIDTH, 112);
            
            // Cyan top wire glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00f0ff';
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(0, groundY, CANVAS_WIDTH, 4);
            
            // Draw digital network lines
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
            ctx.lineWidth = 2;
            
            const startX = -this.groundOffset;
            ctx.beginPath();
            for (let x = startX; x < CANVAS_WIDTH + 40; x += 25) {
                ctx.moveTo(x, groundY + 4);
                ctx.lineTo(x - 15, groundY + 112);
            }
            ctx.stroke();

            // Horizontal slice dividing lines
            ctx.strokeStyle = 'rgba(255, 0, 127, 0.3)';
            ctx.beginPath();
            ctx.moveTo(0, groundY + 30); ctx.lineTo(CANVAS_WIDTH, groundY + 30);
            ctx.moveTo(0, groundY + 70); ctx.lineTo(CANVAS_WIDTH, groundY + 70);
            ctx.stroke();

        } else if (theme === 'synthwave') {
            // Outrun 3D Perspective Vector Grid
            ctx.fillStyle = '#0a0314';
            ctx.fillRect(0, groundY, CANVAS_WIDTH, 112);
            
            // Pink glow ceiling bar
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#ff007f';
            ctx.fillStyle = '#ff007f';
            ctx.fillRect(0, groundY, CANVAS_WIDTH, 4);
            ctx.shadowBlur = 0;
            
            // Perspective grid rays pointing to center horizon
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            
            const centerX = CANVAS_WIDTH / 2;
            const vanishingY = groundY - 30; // perspective anchor
            
            for (let x = -100; x <= CANVAS_WIDTH + 100; x += 40) {
                ctx.moveTo(x, groundY + 4);
                // line sweeps outward
                const dx = x - centerX;
                ctx.lineTo(centerX + dx * 2, groundY + 112);
            }
            ctx.stroke();

            // Horizontal parallel grid lines scrolling upwards
            ctx.strokeStyle = 'rgba(255, 0, 127, 0.6)';
            
            // Scroll based on offset
            const scrollVal = this.groundOffset * 0.3;
            for (let i = 0; i < 6; i++) {
                const dy = ((i * 22 + scrollVal) % 112);
                // Apply a simple non-linear scaling for perspective (closer = wider)
                const lineY = groundY + 4 + dy;
                
                if (lineY <= groundY + 112) {
                    ctx.lineWidth = 1 + (dy / 100) * 1.5;
                    ctx.beginPath();
                    ctx.moveTo(0, lineY);
                    ctx.lineTo(CANVAS_WIDTH, lineY);
                    ctx.stroke();
                }
            }
        }
        
        ctx.restore();
    }
}

// ==========================================
// BIRD ENTITY (PHYSICS & MULTIPLE SKINS)
// ==========================================
class Bird {
    constructor(game) {
        this.game = game;
        this.x = 90;
        this.y = CANVAS_HEIGHT * 0.45;
        this.radius = 16;
        
        // Physics
        this.yVel = 0;
        this.gravity = 0.38;
        this.lift = -6.5;
        this.terminalVelocity = 10;
        
        // Rotation & State
        this.angle = 0;
        this.targetAngle = 0;
        this.wingFlapStage = 0;
        this.flapTime = 0;
        
        // Default skin metadata
        this.skin = SKINS.classic;
    }

    setSkin(skinConfig) {
        this.skin = skinConfig;
    }

    getRadius() {
        // If shrink powerup is active, bird is tiny!
        if (this.game.activePowerups.shrink > 0) {
            return this.radius * 0.6;
        }
        return this.radius;
    }

    jump() {
        const isShrunk = (this.game.activePowerups.shrink > 0);
        this.yVel = isShrunk ? this.lift * 0.9 : this.lift;
        this.targetAngle = -0.35; // point upwards
    }

    update(dt) {
        const isShrunk = (this.game.activePowerups.shrink > 0);
        const dynamicGravity = isShrunk ? this.gravity * 0.95 : this.gravity;
        
        // Physics update
        this.yVel += dynamicGravity;
        if (this.yVel > this.terminalVelocity) this.yVel = this.terminalVelocity;
        
        this.y += this.yVel;

        // Wing flapping speed based on velocity
        this.flapTime += dt;
        const flapRate = this.yVel < 0 ? 80 : 180; // flap faster when moving upwards
        if (this.flapTime >= flapRate) {
            this.flapTime = 0;
            this.wingFlapStage = (this.wingFlapStage + 1) % 3;
        }

        // Interpolate angle based on velocity
        if (this.yVel > 3.0) {
            this.targetAngle = Math.min(Math.PI / 2.2, this.targetAngle + 0.05); // dive
        } else if (this.yVel < 0) {
            this.targetAngle = -0.35;
        }
        
        // Smooth rotation shift
        this.angle += (this.targetAngle - this.angle) * 0.15;

        // Tail jet emissions / particle trails
        this.spawnTrailParticles();
    }

    /**
     * Continuous smoke/rocket trails from the back of the bird.
     */
    spawnTrailParticles() {
        if (Math.random() < 0.25 || this.skin.id === 'rocket') {
            const rx = this.x - this.getRadius();
            const ry = this.y + (Math.random() * 6 - 3);
            
            let particleColor = this.skin.trailColor;
            let type = 'circle';
            
            if (this.skin.id === 'rocket') {
                particleColor = Math.random() < 0.4 ? '#fc5c65' : '#f7b731'; // Fire particles
                type = 'sparkle';
            } else if (this.skin.id === 'phoenix') {
                particleColor = '#ffaa00';
                type = 'sparkle';
            } else if (this.skin.id === 'bat') {
                particleColor = 'rgba(136, 84, 208, 0.3)';
                type = 'circle';
            }

            this.game.particles.push(new Particle(rx, ry, particleColor, type, -1.8, 0));
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Render shield bubble around bird if active
        if (this.game.activePowerups.shield > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, this.getRadius() + 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 3;
            // Pulsing effect
            const alphaPulse = 0.3 + Math.sin(performance.now() * 0.015) * 0.25;
            ctx.fillStyle = `rgba(0, 240, 255, ${alphaPulse})`;
            
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00f0ff';
            ctx.stroke();
            ctx.fill();
            ctx.restore();
        }

        // Draw actual bird
        this.drawBirdOnContext(ctx, this);
        
        ctx.restore();
    }

    /**
     * Renders customizable visual configurations of the bird based on its equipped skin type.
     */
    drawBirdOnContext(ctx, birdEntity) {
        const radius = birdEntity.getRadius();
        const skin = birdEntity.skin;
        const flap = birdEntity.wingFlapStage;
        
        ctx.shadowBlur = 0; // reset
        
        if (skin.type === 'organic') {
            // Draw body circle
            ctx.fillStyle = skin.primaryColor;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Border outline
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Eye
            ctx.fillStyle = skin.eyeColor;
            ctx.beginPath();
            ctx.arc(radius * 0.35, -radius * 0.3, radius * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Pupil
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(radius * 0.45, -radius * 0.3, radius * 0.12, 0, Math.PI * 2);
            ctx.fill();

            // Beak
            ctx.fillStyle = skin.secondaryColor;
            ctx.beginPath();
            ctx.moveTo(radius * 0.7, -radius * 0.1);
            ctx.lineTo(radius * 1.3, radius * 0.1);
            ctx.lineTo(radius * 0.7, radius * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Wing flapping draw
            ctx.fillStyle = skin.secondaryColor;
            ctx.beginPath();
            
            let wingY = 0;
            if (flap === 0) wingY = -radius * 0.4; // Wing High
            else if (flap === 1) wingY = 0;        // Wing Mid
            else wingY = radius * 0.4;             // Wing Low
            
            ctx.ellipse(-radius * 0.3, wingY, radius * 0.5, radius * 0.3, Math.PI / 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

        } else if (skin.type === 'cyber') {
            // FUTURISTIC TECH SHIP DESIGN
            ctx.shadowBlur = 10;
            ctx.shadowColor = skin.primaryColor;

            // Sleek triangle spaceship hull
            ctx.fillStyle = skin.primaryColor;
            ctx.beginPath();
            ctx.moveTo(-radius, -radius * 0.7);
            ctx.lineTo(radius * 1.1, 0);
            ctx.lineTo(-radius, radius * 0.7);
            ctx.closePath();
            ctx.fill();

            // Core engine metal block
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(-radius * 1.1, -radius * 0.4, radius * 0.4, radius * 0.8);

            // Glow engine exhaust line
            ctx.fillStyle = skin.secondaryColor;
            ctx.fillRect(-radius * 1.25, -radius * 0.2, radius * 0.15, radius * 0.4);

            // Glowing eye shield bar
            ctx.strokeStyle = skin.eyeColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(radius * 0.2, -radius * 0.25);
            ctx.lineTo(radius * 0.7, -radius * 0.05);
            ctx.stroke();

            // Cyber Wing panel
            ctx.fillStyle = skin.secondaryColor;
            ctx.beginPath();
            
            let wingY = 0;
            if (flap === 0) wingY = -radius * 0.3;
            else if (flap === 1) wingY = 0;
            else wingY = radius * 0.3;

            ctx.moveTo(-radius * 0.6, wingY);
            ctx.lineTo(-radius * 0.1, wingY - radius * 0.6);
            ctx.lineTo(radius * 0.1, wingY);
            ctx.closePath();
            ctx.fill();

        } else if (skin.type === 'bat') {
            // BAT SKIN: Dark colors, little horns, bat wings
            ctx.fillStyle = skin.primaryColor;
            
            // Bat rounded head with points
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Horn 1
            ctx.beginPath();
            ctx.moveTo(-radius * 0.4, -radius * 0.8);
            ctx.lineTo(-radius * 0.7, -radius * 1.3);
            ctx.lineTo(-radius * 0.8, -radius * 0.5);
            ctx.fill();
            
            // Horn 2
            ctx.beginPath();
            ctx.moveTo(radius * 0.2, -radius * 0.9);
            ctx.lineTo(radius * 0.4, -radius * 1.4);
            ctx.lineTo(radius * 0.5, -radius * 0.7);
            ctx.fill();

            // Red glowing eyes
            ctx.fillStyle = skin.eyeColor;
            ctx.beginPath();
            ctx.arc(radius * 0.35, -radius * 0.15, radius * 0.2, 0, Math.PI * 2);
            ctx.arc(-radius * 0.1, -radius * 0.15, radius * 0.2, 0, Math.PI * 2);
            ctx.fill();

            // Cute fangs
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(radius * 0.2, radius * 0.3);
            ctx.lineTo(radius * 0.3, radius * 0.6);
            ctx.lineTo(radius * 0.4, radius * 0.3);
            ctx.closePath();
            ctx.fill();

            // Webbed black/purple wings
            ctx.fillStyle = '#1e272e';
            ctx.beginPath();
            
            let wMultiplier = 1;
            if (flap === 0) wMultiplier = -1.2;
            else if (flap === 1) wMultiplier = 0;
            else wMultiplier = 1.2;
            
            ctx.moveTo(-radius * 0.3, 0);
            ctx.lineTo(-radius * 1.4, radius * wMultiplier * 0.8);
            ctx.lineTo(-radius * 0.8, radius * wMultiplier * 0.2);
            ctx.lineTo(-radius * 1.1, radius * wMultiplier * 1.1);
            ctx.closePath();
            ctx.fill();

        } else if (skin.type === 'phoenix') {
            // GOLDEN PHOENIX FIREBIRD
            ctx.shadowBlur = 15;
            ctx.shadowColor = skin.secondaryColor;
            
            // Gradient base body
            const fireGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
            fireGrad.addColorStop(0, '#fff5cc');
            fireGrad.addColorStop(0.5, skin.primaryColor);
            fireGrad.addColorStop(1, skin.secondaryColor);
            
            ctx.fillStyle = fireGrad;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            // Elegant high peak beak
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(radius * 0.6, -radius * 0.15);
            ctx.lineTo(radius * 1.4, 0);
            ctx.lineTo(radius * 0.6, radius * 0.35);
            ctx.closePath();
            ctx.fill();

            // Flame crest crown
            ctx.fillStyle = skin.secondaryColor;
            ctx.beginPath();
            ctx.moveTo(-radius * 0.2, -radius * 0.9);
            ctx.quadraticCurveTo(-radius * 0.8, -radius * 1.6, -radius * 1.3, -radius * 1.4);
            ctx.quadraticCurveTo(-radius * 0.8, -radius * 0.8, -radius * 0.6, -radius * 0.8);
            ctx.fill();

            // Feathered fiery wings
            ctx.fillStyle = skin.primaryColor;
            ctx.beginPath();
            
            let wingY = 0;
            if (flap === 0) wingY = -radius * 0.5;
            else if (flap === 1) wingY = 0;
            else wingY = radius * 0.5;

            ctx.ellipse(-radius * 0.4, wingY, radius * 0.7, radius * 0.4, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();

        } else if (skin.type === 'rocket') {
            // ROCKET BIRD: white helmet, strapping booster
            ctx.fillStyle = '#ffffff'; // space white
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Blue astronaut glass visor shield
            ctx.fillStyle = skin.eyeColor;
            ctx.beginPath();
            ctx.arc(radius * 0.4, -radius * 0.1, radius * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Helmet shine
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.ellipse(radius * 0.5, -radius * 0.2, radius * 0.15, radius * 0.08, Math.PI/4, 0, Math.PI*2);
            ctx.fill();

            // Strap-on red rocket booster jetpack on its back!
            ctx.fillStyle = skin.secondaryColor;
            ctx.fillRect(-radius * 1.1, -radius * 0.5, radius * 0.5, radius * 1.0);
            ctx.strokeRect(-radius * 1.1, -radius * 0.5, radius * 0.5, radius * 1.0);

            // Small metallic nozzle
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(-radius * 1.35, -radius * 0.25, radius * 0.25, radius * 0.5);

            // Flapping organic wings sticking out
            ctx.fillStyle = '#f7b731'; // yellow bird wing inside astronaut suit
            ctx.beginPath();
            
            let wingY = 0;
            if (flap === 0) wingY = -radius * 0.4;
            else if (flap === 1) wingY = 0;
            else wingY = radius * 0.4;
            
            ctx.ellipse(-radius * 0.1, wingY, radius * 0.4, radius * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }
}

// ==========================================
// PIPE ENTITY (CHALLENGING OBSTACLE)
// ==========================================
class Pipe {
    constructor(x, topHeight, bottomHeight, gap, isMoving = false) {
        this.x = x;
        this.topHeight = topHeight;
        this.bottomHeight = bottomHeight;
        this.gap = gap;
        
        this.width = 72;
        this.speed = 2.4;
        this.isOffscreen = false;
        this.passed = false;
        
        // Moving parameters (vertical oscillation)
        this.isMoving = isMoving;
        this.movingRange = 60; // Max pixels to move up/down
        this.movingSpeed = 0.0025; // Speed of movement
        this.initialCenterY = topHeight + gap / 2;
        this.currentCenterY = this.initialCenterY;
        this.seed = Math.random() * 1000; // unique wave phase offset
    }

    update(dt, speedMultiplier) {
        this.x -= this.speed * speedMultiplier * (dt / 16.66);
        
        if (this.x + this.width < 0) {
            this.isOffscreen = true;
        }

        // Apply up/down vertical movement if enabled
        if (this.isMoving) {
            const time = performance.now() * this.movingSpeed + this.seed;
            const shiftY = Math.sin(time) * this.movingRange;
            
            this.currentCenterY = this.initialCenterY + shiftY;
            
            // Adjust upper and lower boundaries dynamically
            this.topHeight = this.currentCenterY - this.gap / 2;
            this.bottomHeight = CANVAS_HEIGHT - (this.currentCenterY + this.gap / 2) - 112;
        }
    }

    collidesWith(bird) {
        const birdR = bird.getRadius();
        
        // Basic AABB overlapping bounds test for speed check
        if (bird.x + birdR > this.x && bird.x - birdR < this.x + this.width) {
            // Test collision with upper pipe
            if (bird.y - birdR < this.topHeight) {
                return true;
            }
            // Test collision with lower pipe
            if (bird.y + birdR > CANVAS_HEIGHT - 112 - this.bottomHeight) {
                return true;
            }
        }
        return false;
    }

    draw(ctx, theme) {
        ctx.save();
        
        // Define pipe designs based on themes
        let mainGrad = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
        let borderGlow = false;
        let glowColor = '';
        
        if (theme === 'sunny') {
            // Classic 3D shading green pipe
            mainGrad.addColorStop(0, '#73c72d');
            mainGrad.addColorStop(0.3, '#a7eb5a');
            mainGrad.addColorStop(0.7, '#73c72d');
            mainGrad.addColorStop(1, '#4e851a');
            
            ctx.fillStyle = mainGrad;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2.5;
        } else if (theme === 'cyberpunk') {
            // Sleek dark tubes with cyan/magenta neon strokes
            mainGrad.addColorStop(0, '#111422');
            mainGrad.addColorStop(1, '#08090f');
            
            ctx.fillStyle = mainGrad;
            ctx.strokeStyle = this.isMoving ? '#ff007f' : '#00f0ff'; // Moving = magenta, Static = cyan
            ctx.lineWidth = 3;
            borderGlow = true;
            glowColor = ctx.strokeStyle;
        } else if (theme === 'synthwave') {
            // Retro wireframe grid pipes
            mainGrad.addColorStop(0, '#21083a');
            mainGrad.addColorStop(1, '#110321');
            
            ctx.fillStyle = mainGrad;
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 2;
            borderGlow = true;
            glowColor = '#ff007f';
        }

        // Apply glow filter if active
        if (borderGlow) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = glowColor;
        }

        // 1. DRAW TOP PIPE
        const topPipeY = 0;
        ctx.beginPath();
        ctx.rect(this.x, topPipeY, this.width, this.topHeight);
        ctx.fill();
        ctx.stroke();
        
        // Draw decorative top pipe lip lip
        const lipHeight = 24;
        const lipExt = 4; // width expansion
        ctx.beginPath();
        ctx.rect(this.x - lipExt, this.topHeight - lipHeight, this.width + lipExt * 2, lipHeight);
        ctx.fill();
        ctx.stroke();

        // 2. DRAW BOTTOM PIPE
        const bottomPipeY = CANVAS_HEIGHT - 112 - this.bottomHeight;
        ctx.beginPath();
        ctx.rect(this.x, bottomPipeY, this.width, this.bottomHeight);
        ctx.fill();
        ctx.stroke();

        // Draw decorative bottom pipe lip lip
        ctx.beginPath();
        ctx.rect(this.x - lipExt, bottomPipeY, this.width + lipExt * 2, lipHeight);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}

// ==========================================
// COIN ENTITY (FOR PURCHASING SKIN UPGRADES)
// ==========================================
class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 11;
        this.speed = 2.4;
        
        this.isOffscreen = false;
        this.collected = false;
        
        // Animation variables (rotation spinning)
        this.spinScale = 1.0;
        this.spinSpeed = 0.08;
        this.spinAngle = Math.random() * Math.PI;
    }

    update(dt, speedMultiplier, bird, magnetActive) {
        // Horizontal scroll movement
        this.x -= this.speed * speedMultiplier * (dt / 16.66);
        
        if (this.x + this.radius < 0) {
            this.isOffscreen = true;
        }

        // Magnet attraction physics
        if (magnetActive) {
            const dx = bird.x - this.x;
            const dy = bird.y - this.y;
            const distance = Math.hypot(dx, dy);
            
            // Attract if within 140 pixels scope
            if (distance < 145) {
                const pullForce = 5.5; // pull speed
                this.x += (dx / distance) * pullForce * (dt / 16.66);
                this.y += (dy / distance) * pullForce * (dt / 16.66);
            }
        }

        // Spin animation
        this.spinAngle += this.spinSpeed;
        this.spinScale = Math.abs(Math.sin(this.spinAngle));
    }

    collidesWith(bird) {
        const dx = bird.x - this.x;
        const dy = bird.y - this.y;
        const distance = Math.hypot(dx, dy);
        
        // Sum of both radii overlap check
        return distance < (bird.getRadius() + this.radius);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.spinScale, 1.0); // horizontal squish for spin effect
        
        // Gold gradient circle
        const coinGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, this.radius);
        coinGrad.addColorStop(0, '#fff176');
        coinGrad.addColorStop(0.6, '#fbc02d');
        coinGrad.addColorStop(1, '#f57f17');
        
        ctx.fillStyle = coinGrad;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#fbc02d';
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner coin border
        ctx.strokeStyle = '#ffb300';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.65, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}

// ==========================================
// POWERUP ENTITY (SHIELD, MAGNET, SHRINK)
// ==========================================
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'shield', 'magnet', 'shrink'
        this.radius = 14;
        this.speed = 2.4;
        
        this.isOffscreen = false;
        this.collected = false;
        
        // Floating hover animation
        this.hoverOffset = 0;
        this.seed = Math.random() * 100;
    }

    update(dt, speedMultiplier) {
        this.x -= this.speed * speedMultiplier * (dt / 16.66);
        
        if (this.x + this.radius < 0) {
            this.isOffscreen = true;
        }

        // Float up/down
        this.hoverOffset = Math.sin((performance.now() * 0.005) + this.seed) * 5;
    }

    collidesWith(bird) {
        const dx = bird.x - this.x;
        const dy = bird.y - (this.y + this.hoverOffset);
        const distance = Math.hypot(dx, dy);
        
        return distance < (bird.getRadius() + this.radius);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y + this.hoverOffset);
        
        let ballColor = '';
        let glowColor = '';
        let icon = '';

        if (this.type === 'shield') {
            ballColor = '#00f0ff';
            glowColor = 'rgba(0, 240, 255, 0.4)';
            icon = '🛡️';
        } else if (this.type === 'magnet') {
            ballColor = '#f7b731';
            glowColor = 'rgba(247, 183, 49, 0.4)';
            icon = '🧲';
        } else if (this.type === 'shrink') {
            ballColor = '#ff007f';
            glowColor = 'rgba(255, 0, 127, 0.4)';
            icon = '⚡';
        }

        // Glowing backdrop bubble
        ctx.shadowBlur = 10;
        ctx.shadowColor = ballColor;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // White boundary border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Centered Emoji text
        ctx.shadowBlur = 0;
        ctx.font = '13px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(icon, 0, 1);

        ctx.restore();
    }
}

// ==========================================
// PARTICLE ENGINE (EXPLOSIONS & VISUAL SFX)
// ==========================================
class Particle {
    constructor(x, y, color, type = 'circle', vxOverride = null, vyOverride = null) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type; // 'circle', 'square', 'sparkle'
        
        // Velocity (exploded spread out)
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 3.5;
        this.vx = vxOverride !== null ? vxOverride + (Math.random() * 0.6 - 0.3) : Math.cos(angle) * speed;
        this.vy = vyOverride !== null ? vyOverride + (Math.random() * 0.6 - 0.3) : Math.sin(angle) * speed;
        
        this.alpha = 1.0;
        // Faster fadeout for trails
        this.decay = vxOverride !== null ? 0.03 + Math.random() * 0.02 : 0.015 + Math.random() * 0.015;
        
        this.size = 2.5 + Math.random() * 4.5;
        this.gravity = vxOverride !== null ? 0.02 : 0.08; // heavier explosion falling
    }

    update(dt) {
        this.vy += this.gravity * (dt / 16.66);
        this.x += this.vx * (dt / 16.66);
        this.y += this.vy * (dt / 16.66);
        
        this.alpha -= this.decay * (dt / 16.66);
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        
        if (this.type === 'circle') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'square') {
            ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        } else if (this.type === 'sparkle') {
            // Little star diamond sparkle drawing
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.size);
            ctx.lineTo(this.x + this.size * 0.5, this.y);
            ctx.lineTo(this.x, this.y + this.size);
            ctx.lineTo(this.x - this.size * 0.5, this.y);
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// ==========================================
// EXECUTE INITIALIZATION
// ==========================================
window.onload = () => {
    // Launch the game engine
    const fbGame = new Game();
    requestAnimationFrame((t) => fbGame.run(t));
};
