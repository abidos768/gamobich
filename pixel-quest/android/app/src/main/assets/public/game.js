// ===== PIXEL QUEST - Stages & Timer =====

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 32;
const MAP_WIDTH = 11;
const MAP_HEIGHT = 15;

canvas.width = MAP_WIDTH * TILE_SIZE;
canvas.height = MAP_HEIGHT * TILE_SIZE;

// Game state
let coins = 0;
let xp = 0;
let level = 1;
let xpToNext = 50;
let stage = 1;
let stageTime = 60;
let timer = stageTime;
let lastTick = Date.now();
let collectiblesNeeded = 5;
let collectiblesGot = 0;
let gameActive = false; // Start false, wait for click
let health = 3;
let maxHealth = 3;
let invincible = 0;
let isSaved = false;
let difficulty = 'normal'; // easy, normal, hard

function getDifficultyMultipliers() {
    switch (difficulty) {
        case 'easy': return { enemySpeed: 0.7, timer: 1.5, bossSpeed: 0.8 };
        case 'hard': return { enemySpeed: 1.3, bossSpeed: 1.2, timer: 0.8 };
        default: return { enemySpeed: 1.0, timer: 1.0, bossSpeed: 1.0 };
    }
}

// Player
const player = { x: 7, y: 6, color: '#6ee7ff', dir: { x: 0, y: 1 }, isAttacking: false };

// Game objects
let collectibles = [];
let triggers = [];
let particles = [];
let enemies = [];
const enemySpeed = 0.05; // Base speed, modified by difficulty
let projectiles = []; // Boss attacks
let boss = null;      // Boss object
let attackEffect = null; // Store current attack visual

// Audio Context
let audioCtx;
const sounds = {
    jump: { type: 'square', freq: 150, end: 300, dur: 0.1 },
    coin: { type: 'sine', freq: 1000, end: 1500, dur: 0.1 },
    hit: { type: 'sawtooth', freq: 100, end: 50, dur: 0.3 },
    win: { type: 'triangle', freq: 400, end: 800, dur: 0.5 },
    chest: { type: 'sine', freq: 600, end: 1200, dur: 0.4 },
    attack: { type: 'sawtooth', freq: 300, end: 100, dur: 0.15 },
    enemyDeath: { type: 'square', freq: 200, end: 50, dur: 0.2 },
    powerup: { type: 'sine', freq: 500, end: 900, dur: 0.3 }
};

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(name) {
    if (!audioCtx) return;
    const s = sounds[name];
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = s.type;
    osc.frequency.setValueAtTime(s.freq, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(s.end, audioCtx.currentTime + s.dur);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + s.dur);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + s.dur);
}

// ... (Map arrays remain the same) ...

// Enemy System
function spawnEnemies() {
    enemies = [];
    const count = stage + 1; // More enemies per stage
    for (let i = 0; i < count; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * (MAP_WIDTH - 2)) + 1;
            y = Math.floor(Math.random() * (MAP_HEIGHT - 2)) + 1;
        } while (map[y][x] !== 0 || (Math.abs(x - player.x) < 4 && Math.abs(y - player.y) < 4));

        enemies.push({
            x, y,
            hp: 2, // Enemies take 2 hits
            moveTimer: 0,
            color: '#ff4444',
            knockback: { x: 0, y: 0 }
        });
    }
}

function updateEnemies() {
    if (!gameActive) return;

    const mult = getDifficultyMultipliers();
    enemies = enemies.filter(e => e.hp > 0); // Remove dead enemies

    enemies.forEach(e => {
        // Knockback recovery
        if (Math.abs(e.knockback.x) > 0.1 || Math.abs(e.knockback.y) > 0.1) {
            e.knockback.x *= 0.8;
            e.knockback.y *= 0.8;
            e.x += e.knockback.x;
            e.y += e.knockback.y;
            // Keep bounds
            e.x = Math.max(1, Math.min(MAP_WIDTH - 2, e.x));
            e.y = Math.max(1, Math.min(MAP_HEIGHT - 2, e.y));
            return; // Skip normal movement while being knocked back
        }

        e.moveTimer++;
        if (e.moveTimer > 30 / mult.enemySpeed) { // Apply difficulty multiplier to movement speed
            e.moveTimer = 0;
            // Snapping to grid for cleaner movement
            const gx = Math.round(e.x);
            const gy = Math.round(e.y);
            const dx = Math.sign(player.x - gx);
            const dy = Math.sign(player.y - gy);

            if (Math.random() < 0.8) {
                if (Math.abs(player.x - gx) > Math.abs(player.y - gy)) {
                    if (map[gy][gx + dx] === 0) e.x = gx + dx;
                    else e.x = gx;
                } else {
                    if (map[gy + dy][gx] === 0) e.y = gy + dy;
                    else e.y = gy;
                }
            } else {
                const rx = (Math.random() < 0.5 ? -1 : 1);
                const ry = (Math.random() < 0.5 ? -1 : 1);
                if (Math.random() < 0.5) {
                    if (map[gy][gx + rx] === 0) e.x = gx + rx;
                } else {
                    if (map[gy + ry][gx] === 0) e.y = gy + ry;
                }
            }
        }

        // Collision with player
        if (Math.round(e.x) === player.x && Math.round(e.y) === player.y && invincible <= 0) {
            takeDamage();
        }
    });
}

function attack() {
    if (player.isAttacking || !gameActive) return;

    player.isAttacking = true;
    playSound('attack');

    // Attack visual
    attackEffect = {
        x: player.x + player.dir.x,
        y: player.y + player.dir.y,
        life: 10
    };

    // Check Boss Hit
    if (boss && gameActive && Math.abs((boss.x + 1) - attackEffect.x) < 1.5 && Math.abs((boss.y + 1) - attackEffect.y) < 1.5) {
        boss.hp--;
        boss.color = '#fff';
        setTimeout(() => boss.color = '#ff0055', 100);

        if (boss.hp <= 0) {
            bossDeath();
        } else {
            playSound('hit');
            createParticles(boss.x + 1, boss.y + 1, '#fff', 10);
        }
    }

    // Check hits
    enemies.forEach(e => {
        if (Math.round(e.x) === attackEffect.x && Math.round(e.y) === attackEffect.y) {
            e.hp--;
            e.knockback.x = player.dir.x * 0.5;
            e.knockback.y = player.dir.y * 0.5;
            e.color = '#fff'; // Flash white
            setTimeout(() => e.color = '#ff4444', 100);

            if (e.hp <= 0) {
                killEnemy(e);
            } else {
                playSound('hit');
                createParticles(e.x, e.y, '#fff', 5);
            }
        }
    });

    setTimeout(() => {
        player.isAttacking = false;
        attackEffect = null;
    }, 200);
}

function killEnemy(e) {
    playSound('enemyDeath');
    createParticles(e.x, e.y, '#ff4444', 15);
    xp += 10;
    checkLevelUp();
    showReward('+10 XP');

    // Chance to drop heart
    if (Math.random() < 0.1 && health < maxHealth) {
        collectibles.push({
            x: Math.round(e.x), y: Math.round(e.y),
            emoji: '❤️', value: 0, xp: 0, heal: 1,
            animOffset: 0
        });
    }
}

function takeDamage() {
    health--;
    invincible = 60; // 1 second invincibility
    playSound('hit');
    updateHUD();
    createParticles(player.x, player.y, '#ff0000', 10);

    if (health <= 0) {
        gameOver();
    }
}

function drawEnemies() {
    enemies.forEach(e => {
        const x = e.x * TILE_SIZE;
        const y = e.y * TILE_SIZE;
        const bounce = Math.sin(Date.now() / 150) * 3;

        // Slime body
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2 + bounce, 10, Math.PI, 0);
        ctx.fillRect(x + 6, y + TILE_SIZE / 2 + bounce, 20, 10);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 10, y + TILE_SIZE / 2 + bounce - 2, 4, 4);
        ctx.fillRect(x + 18, y + TILE_SIZE / 2 + bounce - 2, 4, 4);
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 12, y + TILE_SIZE / 2 + bounce, 2, 2);
        ctx.fillRect(x + 20, y + TILE_SIZE / 2 + bounce, 2, 2);
    });
}

// Stage maps (11x15)
const stages = [
    // Stage 1
    [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1],
        [1, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1],
        [1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 3, 3, 3, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],
    // Stage 2
    [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        [1, 0, 2, 2, 0, 1, 0, 2, 2, 0, 1],
        [1, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],
    // Stage 3
    [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 3, 3, 0, 0, 0, 3, 3, 0, 1],
        [1, 0, 3, 3, 0, 0, 0, 3, 3, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1],
        [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 3, 3, 0, 0, 0, 3, 3, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],
    // Stage 4
    [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 2, 0, 0, 0, 0, 0, 2, 0, 1],
        [1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 2, 0, 0, 0, 0, 0, 2, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],
    // Stage 5 (Boss Room)
    [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ]
];

let map = stages[0];

const biomes = {
    forest: {
        0: '#1a1a2e', 1: '#5a5a8c', 2: '#3a6a3a', 3: '#2a4a7a'
    },
    ice: {
        0: '#e0f7fa', // Floor (Ice)
        1: '#006064', // Wall (Dark Ice)
        2: '#80deea', // Obstacle (Ice Block)
        3: '#00bcd4'  // Water (Deep Water)
    },
    lava: {
        0: '#212121', // Floor (Dark Rock)
        1: '#b71c1c', // Wall (Red Rock)
        2: '#ff5722', // Obstacle (Hot Rock)
        3: '#bf360c'  // Lava
    }
};

let currentBiome = biomes.forest;
const tileColors = biomes.forest; // Fallback? Unused if we use currentBiome

// Generate random map for stages after 5
function generateRandomMap() {
    const newMap = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            // Walls on edges
            if (y === 0 || y === MAP_HEIGHT - 1 || x === 0 || x === MAP_WIDTH - 1) {
                row.push(1);
            }
            // Keep player spawn area clear (Adjusted for bottom-center spawn 5,7)
            else if (Math.abs(x - 5) <= 1 && Math.abs(y - 7) <= 1) {
                row.push(0);
            }
            // Random obstacles
            else {
                const rand = Math.random();
                if (rand < 0.08) row.push(1);       // Wall 8%
                else if (rand < 0.12) row.push(2);  // Grass 4%
                else if (rand < 0.15) row.push(3);  // Water 3%
                else row.push(0);                    // Floor
            }
        }
        newMap.push(row);
    }
    return newMap;
}

function loadStage(stageNum) {
    stage = stageNum;

    // Biome Selection
    if (stage <= 2) currentBiome = biomes.forest;
    else if (stage <= 4) currentBiome = biomes.ice;
    else if (stage === 5) currentBiome = biomes.lava; // Boss
    else {
        // Random biome for infinite stages
        const keys = Object.keys(biomes);
        currentBiome = biomes[keys[Math.floor(Math.random() * keys.length)]];
    }


    // Use preset maps for stages 1-5, random after
    if (stageNum <= 5) {
        map = stages[stageNum - 1];
    } else {
        map = generateRandomMap();
    }

    player.x = 5;
    player.y = 7;
    collectiblesNeeded = 3 + stage * 2;
    collectiblesGot = 0;

    const mult = getDifficultyMultipliers();
    timer = Math.max(30, (60 - (stage - 1) * 5) * mult.timer);
    enemies = [];
    boss = null;
    stageTime = timer;
    spawnCollectibles();
    spawnTriggers();
    spawnEnemies();
    updateHUD();

    if (stageNum === 5) {
        showReward(`👹 BOSS FIGHT! Defeat the Giant Slime!`);
        spawnBoss();
    } else if (stageNum > 5) {
        showReward(`🎲 RANDOM STAGE ${stage}!`);
        spawnCollectibles();
        spawnStageHeart();
        spawnEnemies();
    } else {
        showReward(`⭐ STAGE ${stage} - Collect ${collectiblesNeeded}!`);
        spawnCollectibles();
        spawnStageHeart();
        spawnEnemies();
    }

    // Always spawn triggers if applicable
    spawnTriggers();
    updateHUD();
}

function spawnBoss() {
    boss = {
        x: MAP_WIDTH / 2 - 1,
        y: MAP_HEIGHT / 2 - 1,
        hp: 20,
        maxHp: 20,
        color: '#ff0055',
        timer: 0,
        phase: 0
    };
    enemies = []; // Clear other enemies
}

function updateBoss() {
    if (!boss || !gameActive) return;

    // Boss Movement (Slower)
    boss.timer++;
    if (boss.timer % 40 === 0) {
        const dx = Math.sign(player.x - (boss.x + 1)); // Center tracking
        const dy = Math.sign(player.y - (boss.y + 1));

        let newX = boss.x + dx * 0.5;
        let newY = boss.y + dy * 0.5;

        // Keep in bounds
        if (newX > 1 && newX < MAP_WIDTH - 3 && newY > 1 && newY < MAP_HEIGHT - 3) {
            boss.x = newX;
            boss.y = newY;
        }
    }

    // Boss Attack (Shoot projectile)
    if (boss.timer % 120 === 0) { // Every 2 seconds
        const angle = Math.atan2(player.y - (boss.y + 1), player.x - (boss.x + 1));
        projectiles.push({
            x: boss.x + 1,
            y: boss.y + 1,
            vx: Math.cos(angle) * 0.2,
            vy: Math.sin(angle) * 0.2,
            life: 200
        });
        playSound('hit'); // reused sound
    }

    // Collision with player
    if (Math.abs((boss.x + 1) - player.x) < 1.5 && Math.abs((boss.y + 1) - player.y) < 1.5 && invincible <= 0) {
        takeDamage();
    }
}

function updateProjectiles() {
    projectiles = projectiles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        // Hit player
        if (Math.abs(p.x - player.x) < 0.5 && Math.abs(p.y - player.y) < 0.5 && invincible <= 0) {
            takeDamage();
            return false;
        }

        return p.life > 0 && p.x > 0 && p.x < MAP_WIDTH && p.y > 0 && p.y < MAP_HEIGHT;
    });
}


function spawnCollectibles() {
    collectibles = [];
    const types = [
        { emoji: '💎', value: 10, xp: 5 },
        { emoji: '⭐', value: 5, xp: 10 },
        { emoji: '🍎', value: 3, xp: 3 },
        { emoji: '🔮', value: 15, xp: 15 }
    ];

    for (let i = 0; i < collectiblesNeeded; i++) {
        let x, y, tries = 0;
        do {
            x = Math.floor(Math.random() * (MAP_WIDTH - 2)) + 1;
            y = Math.floor(Math.random() * (MAP_HEIGHT - 2)) + 1;
            tries++;
        } while ((map[y][x] !== 0 || (x === player.x && y === player.y) ||
            collectibles.some(c => c.x === x && c.y === y)) && tries < 100);

        if (tries < 100) {
            const type = types[Math.floor(Math.random() * types.length)];
            collectibles.push({ x, y, ...type, animOffset: Math.random() * Math.PI * 2 });
        }
    }
}

// Spawn guaranteed hearts every 2 stages
function spawnStageHeart() {
    // Spawn a heart every 2 stages (stage 2, 4, 6, etc.) if player is missing health
    if (stage % 2 === 0 && stage !== 5) { // Skip boss stage
        let x, y, tries = 0;
        do {
            x = Math.floor(Math.random() * (MAP_WIDTH - 4)) + 2;
            y = Math.floor(Math.random() * (MAP_HEIGHT - 4)) + 2;
            tries++;
        } while ((map[y][x] !== 0 || (x === player.x && y === player.y) ||
            collectibles.some(c => c.x === x && c.y === y)) && tries < 50);

        if (tries < 50) {
            collectibles.push({
                x, y,
                emoji: '❤️', value: 0, xp: 0, heal: 1,
                animOffset: Math.random() * Math.PI * 2
            });
        }
    }

    // Spawn 2 hearts on harder stages (every 3rd stage after stage 6)
    if (stage > 6 && stage % 3 === 0) {
        for (let i = 0; i < 2; i++) {
            let x, y, tries = 0;
            do {
                x = Math.floor(Math.random() * (MAP_WIDTH - 4)) + 2;
                y = Math.floor(Math.random() * (MAP_HEIGHT - 4)) + 2;
                tries++;
            } while ((map[y][x] !== 0 || (x === player.x && y === player.y) ||
                collectibles.some(c => c.x === x && c.y === y)) && tries < 50);

            if (tries < 50) {
                collectibles.push({
                    x, y,
                    emoji: '❤️', value: 0, xp: 0, heal: 1,
                    animOffset: Math.random() * Math.PI * 2
                });
            }
        }
    }
}

function spawnTriggers() {
    triggers = [];
    if (stage >= 2) {
        triggers.push({ x: 2, y: 2, type: 'chest', opened: false, emoji: '📦' });
    }
    if (stage >= 4) {
        triggers.push({ x: 9, y: 7, type: 'chest', opened: false, emoji: '📦' });
    }
}

function createParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x * TILE_SIZE + TILE_SIZE / 2,
            y: y * TILE_SIZE + TILE_SIZE / 2,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 2,
            life: 1, color, size: Math.random() * 4 + 2
        });
    }
}

function updateParticles() {
    particles = particles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 0.03;
        return p.life > 0;
    });
}

function updateTimer() {
    if (!gameActive) return;
    const now = Date.now();
    if (now - lastTick >= 1000) {
        lastTick = now;
        timer--;
        updateHUD();
        if (timer <= 0) {
            takeDamage(); // Time out = Damage instead of instant game over
            timer = 10;   // Give 10s mercy time
            showReward('⚠️ -1 ❤️ TIME PENALTY!');
        }
    }

    if (invincible > 0) invincible--;
}

function gameOver() {
    gameActive = false;
    showReward(`☠️ GAME OVER! Stage ${stage}`);
    playSound('win'); // Sad win sound?
    setTimeout(() => {
        coins = Math.floor(coins / 2);
        health = maxHealth;
        loadStage(1);
        // gameActive = true; // Wait for click
        document.getElementById('start-screen').classList.remove('hidden');
    }, 2000);
}

function stageComplete() {
    gameActive = false;
    const bonus = stage * 50;
    coins += bonus;
    playSound('win');
    showReward(`🎉 STAGE CLEAR! +${bonus} bonus!`);
    saveGame(); // Add Save
    setTimeout(() => {
        loadStage(stage + 1);
        gameActive = true;
    }, 2000);
}

function movePlayer(dx, dy) {
    if (!gameActive) return;

    // Update facing direction
    if (dx !== 0 || dy !== 0) {
        player.dir = { x: dx, y: dy };
    }

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT &&
        map[newY][newX] !== 1 && map[newY][newX] !== 3) {
        player.x = newX;
        player.y = newY;
        playSound('jump');
        checkCollectibles();
        checkTriggers();
    }
}

function checkCollectibles() {
    collectibles = collectibles.filter(c => {
        if (c.x === player.x && c.y === player.y) {
            if (c.heal) {
                health = Math.min(health + c.heal, maxHealth);
                playSound('powerup');
                showReward('❤️ HEALED!');
            } else {
                coins += c.value;
                xp += c.xp;
                collectiblesGot++;
                playSound('coin');
                showReward(`+${c.value}💎 (${collectiblesGot}/${collectiblesNeeded})`);

                if (collectiblesGot >= collectiblesNeeded) {
                    stageComplete();
                }
            }
            createParticles(c.x, c.y, '#ffd700', 8);
            updateHUD();
            checkLevelUp();
            return false;
        }
        return true;
    });
}

function checkTriggers() {
    triggers.forEach(t => {
        if (t.x === player.x && t.y === player.y && !t.opened) {
            t.opened = true;
            t.emoji = '🎁';
            const bonus = 20 + level * 5;
            coins += bonus;
            xp += 25;
            timer += 10; // Bonus time!
            playSound('chest');
            createParticles(t.x, t.y, '#ff6b9d', 12);
            showReward(`CHEST! +${bonus}💎 +10s⏱️`);
            updateHUD();
            checkLevelUp();
        }
    });
}

function checkLevelUp() {
    while (xp >= xpToNext) {
        xp -= xpToNext;
        level++;
        xpToNext = Math.floor(xpToNext * 1.5);
        createParticles(player.x, player.y, '#c44cff', 20);
        showReward(`🎉 LEVEL UP! Lv.${level}`);
        saveGame(); // Add Save on Level Up
    }
    updateHUD();
}

function updateHUD() {
    document.getElementById('coin-count').textContent = coins;
    document.getElementById('level-count').textContent = level;
    document.getElementById('stage-count').textContent = stage;
    document.getElementById('timer-count').textContent = timer;
    document.getElementById('xp-fill').style.width = `${(xp / xpToNext) * 100}%`;
    document.getElementById('progress-fill').style.width = `${(collectiblesGot / collectiblesNeeded) * 100}%`;
    document.getElementById('hearts').textContent = '❤️'.repeat(health);

    // Timer color warning
    const timerEl = document.getElementById('timer-count');
    if (timer <= 10) timerEl.style.color = '#ff4444';
    else if (timer <= 20) timerEl.style.color = '#ffaa00';
    else timerEl.style.color = '#6ee7ff';
}

function showReward(text) {
    const popup = document.getElementById('reward-popup');
    popup.querySelector('.reward-text').textContent = text;
    popup.classList.remove('hidden');
    setTimeout(() => popup.classList.add('hidden'), 1000);
}

function drawMap() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            ctx.fillStyle = currentBiome[map[y][x]];
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }
}

function drawCollectibles() {
    const time = Date.now() / 200;
    collectibles.forEach(c => {
        const bounce = Math.sin(time + c.animOffset) * 3;
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.emoji, c.x * TILE_SIZE + TILE_SIZE / 2, c.y * TILE_SIZE + TILE_SIZE / 2 + bounce);
    });
}

function drawTriggers() {
    triggers.forEach(t => {
        ctx.font = '22px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.emoji, t.x * TILE_SIZE + TILE_SIZE / 2, t.y * TILE_SIZE + TILE_SIZE / 2);
    });
}

function drawBoss() {
    if (!boss) return;

    const x = boss.x * TILE_SIZE;
    const y = boss.y * TILE_SIZE;
    const bounce = Math.sin(Date.now() / 200) * 5;

    // Boss Body (2x2 tiles)
    ctx.fillStyle = boss.color;
    ctx.beginPath();
    ctx.arc(x + TILE_SIZE, y + TILE_SIZE + bounce, 40, Math.PI, 0);
    ctx.fillRect(x + 10, y + TILE_SIZE + bounce, 44, 40);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 20, y + TILE_SIZE + bounce - 10, 10, 10);
    ctx.fillRect(x + 40, y + TILE_SIZE + bounce - 10, 10, 10);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 24, y + TILE_SIZE + bounce - 6, 4, 4);
    ctx.fillRect(x + 44, y + TILE_SIZE + bounce - 6, 4, 4);

    // Health Bar
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y - 20, 64, 8);
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(x, y - 20, 64 * (boss.hp / boss.maxHp), 8);
}

function drawProjectiles() {
    ctx.fillStyle = '#00ff00';
    projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2, 6, 0, Math.PI * 2);
        ctx.fill();
    });
}

function bossDeath() {
    playSound('win');
    const bossX = boss.x;
    const bossY = boss.y;
    createParticles(bossX + 1, bossY + 1, '#ff0055', 50);
    boss = null;
    showReward('🏆 BOSS DEFEATED!');

    // Drop massive loot
    for (let i = 0; i < 10; i++) {
        collectibles.push({
            x: Math.round(bossX + (Math.random() * 2)),
            y: Math.round(bossY + (Math.random() * 2)),
            emoji: '💎', value: 50, xp: 50,
            animOffset: Math.random()
        });
    }

    setTimeout(() => {
        stageComplete();
    }, 4000);
}

function drawPlayer() {
    const x = player.x * TILE_SIZE;
    const y = player.y * TILE_SIZE;
    const bounce = Math.sin(Date.now() / 150) * 2;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + TILE_SIZE / 2, y + TILE_SIZE - 4, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = player.color;
    ctx.fillRect(x + 8, y + 8 + bounce, 16, 16);
    ctx.fillStyle = '#1a1a2e';

    // Eyes direction
    const ex = player.dir.x * 2;
    const ey = player.dir.y * 2;
    ctx.fillRect(x + 11 + ex, y + 12 + ey + bounce, 4, 4);
    ctx.fillRect(x + 17 + ex, y + 12 + ey + bounce, 4, 4);

    ctx.shadowColor = player.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = player.color;
    ctx.fillRect(x + 8, y + 8 + bounce, 16, 16);
    ctx.shadowBlur = 0;

    // Blink when invincible
    if (invincible > 0 && Math.floor(invincible / 4) % 2 === 0) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 8, y + 8 + bounce, 16, 16);
        ctx.globalAlpha = 1;
    }

    // Draw Attack Swing
    if (attackEffect) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        const ax = attackEffect.x * TILE_SIZE + TILE_SIZE / 2;
        const ay = attackEffect.y * TILE_SIZE + TILE_SIZE / 2;
        ctx.beginPath();
        ctx.arc(ax, ay, 12, 0, Math.PI * 2);
        ctx.stroke();
        attackEffect.life--;
        if (attackEffect.life <= 0) attackEffect = null;
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function gameLoop() {
    updateControls();

    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Clear screen

    updateTimer();
    updateEnemies();
    updateBoss();
    updateProjectiles();
    updateParticles();

    drawMap();
    drawTriggers();
    drawCollectibles();
    drawEnemies();
    drawBoss();
    drawProjectiles();
    drawPlayer();
    drawParticles();

    requestAnimationFrame(gameLoop);
}

// Controls
// Controls State
const inputState = {
    up: false, down: false, left: false, right: false,
    moveTimer: 0, moveDelay: 8 // Move every 8 frames
};

// Handle Continuous Input
function updateControls() {
    if (!gameActive) return;

    if (inputState.up || inputState.down || inputState.left || inputState.right) {
        if (inputState.moveTimer === 0) {
            let dx = 0;
            let dy = 0;
            if (inputState.up) dy = -1;
            if (inputState.down) dy = 1;
            if (inputState.left) dx = -1;
            if (inputState.right) dx = 1;

            if (dx !== 0 || dy !== 0) {
                movePlayer(dx, dy);
                inputState.moveTimer = inputState.moveDelay;
            }
        } else {
            inputState.moveTimer--;
        }
    } else {
        inputState.moveTimer = 0; // Reset delay when stopped
    }
}

function setupBtn(id, dir) {
    const btn = document.getElementById(id);
    const start = (e) => {
        if (e.cancelable) e.preventDefault();
        inputState[dir] = true;
    };
    const end = (e) => {
        if (e.cancelable) e.preventDefault();
        inputState[dir] = false;
    };

    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
}

setupBtn('btn-up', 'up');
setupBtn('btn-down', 'down');
setupBtn('btn-left', 'left');
setupBtn('btn-right', 'right');

// Attack doesn't need continuous hold
const btnAttack = document.getElementById('btn-attack');
const attackHandler = (e) => {
    if (e.cancelable) e.preventDefault();
    attack();
};
btnAttack.addEventListener('touchstart', attackHandler, { passive: false });
btnAttack.addEventListener('mousedown', attackHandler);

// Keyboard
document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'ArrowUp' || e.key === 'w') inputState.up = true;
    if (e.key === 'ArrowDown' || e.key === 's') inputState.down = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') inputState.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') inputState.right = true;
    if (e.key === ' ' || e.key === 'Enter') attack();
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w') inputState.up = false;
    if (e.key === 'ArrowDown' || e.key === 's') inputState.down = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') inputState.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') inputState.right = false;
});

// ===== SETTINGS =====
// Settings Logic
const settingsPanel = document.getElementById('settings-panel');
const settingsBtn = document.getElementById('settings-btn');
const closeSettings = document.getElementById('close-settings');
const btnSizeSlider = document.getElementById('btn-size');
const btnOffset = document.getElementById('btn-offset');
const ctrlPosition = document.getElementById('ctrl-position');
const difficultySelect = document.getElementById('difficulty-select');

function applySettings() {
    const size = btnSizeSlider.value + 'px';
    const offset = btnOffset.value + 'px';
    const position = ctrlPosition.value;

    const controls = document.getElementById('controls');
    const ctrlBtns = document.querySelectorAll('.ctrl-btn');
    const actionBtn = document.getElementById('btn-attack');

    ctrlBtns.forEach(btn => {
        btn.style.width = size;
        btn.style.height = size;
    });
    actionBtn.style.width = size;
    actionBtn.style.height = size;

    controls.style.bottom = offset;

    if (position === 'left') {
        controls.style.left = '20px';
        controls.style.right = 'auto';
        controls.style.transform = 'none';
    } else if (position === 'right') {
        controls.style.left = 'auto';
        controls.style.right = '20px';
        controls.style.transform = 'none';
    } else {
        controls.style.left = '50%';
        controls.style.right = 'auto';
        controls.style.transform = 'translateX(-50%)';
    }

    difficulty = difficultySelect.value;
}

function saveSettings() {
    const settings = {
        btnSize: btnSizeSlider.value,
        btnOffset: btnOffset.value,
        ctrlPosition: ctrlPosition.value,
        difficulty: difficultySelect.value
    };
    localStorage.setItem('pixelquest-settings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('pixelquest-settings');
    if (saved) {
        const settings = JSON.parse(saved);
        btnSizeSlider.value = settings.btnSize || 55;
        btnOffset.value = settings.btnOffset || 25;
        ctrlPosition.value = settings.ctrlPosition || 'center';
        difficultySelect.value = settings.difficulty || 'normal';
        difficulty = settings.difficulty || 'normal';
        applySettings();
    }
}

// Event listeners
settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.remove('hidden');
    gameActive = false;
});

closeSettings.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
    saveSettings();
    gameActive = true;
});

btnSizeSlider.addEventListener('input', applySettings);
ctrlPosition.addEventListener('change', applySettings);
btnOffset.addEventListener('input', applySettings);
difficultySelect.addEventListener('change', applySettings);

// Start Screen Logic
const startHandler = () => {
    initAudio();
    document.getElementById('start-screen').classList.add('hidden');
    gameActive = true;
    if (health <= 0) {
        health = maxHealth;
        loadStage(1);
    }
};

const startScreen = document.getElementById('start-screen');
startScreen.addEventListener('click', startHandler);
startScreen.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startHandler();
}, { passive: false });

// Save System
function saveGame() {
    const gameState = {
        coins, xp, level, xpToNext, stage, health, maxHealth,
        settings: JSON.parse(localStorage.getItem('pixelquest-settings') || '{}')
    };
    localStorage.setItem('pixelquest-save', JSON.stringify(gameState));
    showReward('💾 SAVED');
}

function loadGame() {
    const saved = localStorage.getItem('pixelquest-save');
    if (saved) {
        const state = JSON.parse(saved);
        coins = state.coins || 0;
        xp = state.xp || 0;
        level = state.level || 1;
        xpToNext = state.xpToNext || 50;
        stage = state.stage || 1;
        health = state.health || maxHealth;
    }
}

function resetProgress() {
    if (confirm('Are you sure you want to reset all progress?')) {
        localStorage.removeItem('pixelquest-save');
        location.reload();
    }
}

document.getElementById('reset-progress').addEventListener('click', resetProgress);

// Init
window.addEventListener('load', () => {
    loadSettings();
    loadGame();
    loadStage(stage);
    gameLoop();
});
