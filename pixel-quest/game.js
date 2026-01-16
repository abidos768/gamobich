// ===== PIXEL QUEST - Stages & Timer =====

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 32;
const MAP_WIDTH = 12;
const MAP_HEIGHT = 10;
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
let gameActive = true;

// Player
const player = { x: 5, y: 5, color: '#6ee7ff' };

// Game objects
let collectibles = [];
let triggers = [];
let particles = [];

// Stage maps
const stages = [
    // Stage 1
    [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 3, 3, 0, 1],
        [1, 2, 2, 0, 0, 0, 0, 0, 3, 3, 0, 1],
        [1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 1],
        [1, 0, 0, 3, 3, 0, 0, 2, 2, 0, 0, 1],
        [1, 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],
    // Stage 2
    [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 1],
        [1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
        [1, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 1],
        [1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
        [1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],
    // Stage 3
    [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
        [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],
    // Stage 4
    [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 3, 3, 0, 0, 0, 0, 3, 3, 0, 1],
        [1, 0, 3, 3, 0, 0, 0, 0, 3, 3, 0, 1],
        [1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1],
        [1, 0, 3, 3, 0, 0, 0, 0, 3, 3, 0, 1],
        [1, 0, 3, 3, 0, 0, 0, 0, 3, 3, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],
    // Stage 5
    [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ]
];

let map = stages[0];

const tileColors = { 0: '#1a1a2e', 1: '#3a3a5c', 2: '#2a4a2a', 3: '#1a3a5a' };

function loadStage(stageNum) {
    stage = stageNum;
    map = stages[(stageNum - 1) % stages.length];
    player.x = 5;
    player.y = 5;
    collectiblesNeeded = 3 + stage * 2;
    collectiblesGot = 0;
    timer = Math.max(30, 60 - (stage - 1) * 5);
    stageTime = timer;
    spawnCollectibles();
    spawnTriggers();
    updateHUD();
    showReward(`⭐ STAGE ${stage} - Collect ${collectiblesNeeded}!`);
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
            gameOver();
        }
    }
}

function gameOver() {
    gameActive = false;
    showReward(`☠️ TIME'S UP! Stage ${stage}`);
    setTimeout(() => {
        coins = Math.floor(coins / 2);
        loadStage(1);
        gameActive = true;
    }, 2000);
}

function stageComplete() {
    gameActive = false;
    const bonus = stage * 50;
    coins += bonus;
    showReward(`🎉 STAGE CLEAR! +${bonus} bonus!`);
    setTimeout(() => {
        loadStage(stage + 1);
        gameActive = true;
    }, 2000);
}

function movePlayer(dx, dy) {
    if (!gameActive) return;
    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT &&
        map[newY][newX] !== 1 && map[newY][newX] !== 3) {
        player.x = newX;
        player.y = newY;
        checkCollectibles();
        checkTriggers();
    }
}

function checkCollectibles() {
    collectibles = collectibles.filter(c => {
        if (c.x === player.x && c.y === player.y) {
            coins += c.value;
            xp += c.xp;
            collectiblesGot++;
            createParticles(c.x, c.y, '#ffd700', 8);
            showReward(`+${c.value}💎 (${collectiblesGot}/${collectiblesNeeded})`);
            updateHUD();
            checkLevelUp();

            if (collectiblesGot >= collectiblesNeeded) {
                stageComplete();
            }
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
    setTimeout(() => popup.classList.add('hidden'), 1500);
}

function drawMap() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            ctx.fillStyle = tileColors[map[y][x]];
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
    ctx.fillRect(x + 11, y + 12 + bounce, 4, 4);
    ctx.fillRect(x + 17, y + 12 + bounce, 4, 4);

    ctx.shadowColor = player.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = player.color;
    ctx.fillRect(x + 8, y + 8 + bounce, 16, 16);
    ctx.shadowBlur = 0;
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
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateTimer();
    updateParticles();

    drawMap();
    drawTriggers();
    drawCollectibles();
    drawPlayer();
    drawParticles();

    requestAnimationFrame(gameLoop);
}

// Controls
document.getElementById('btn-up').addEventListener('touchstart', (e) => { e.preventDefault(); movePlayer(0, -1); });
document.getElementById('btn-down').addEventListener('touchstart', (e) => { e.preventDefault(); movePlayer(0, 1); });
document.getElementById('btn-left').addEventListener('touchstart', (e) => { e.preventDefault(); movePlayer(-1, 0); });
document.getElementById('btn-right').addEventListener('touchstart', (e) => { e.preventDefault(); movePlayer(1, 0); });
document.getElementById('btn-up').addEventListener('click', () => movePlayer(0, -1));
document.getElementById('btn-down').addEventListener('click', () => movePlayer(0, 1));
document.getElementById('btn-left').addEventListener('click', () => movePlayer(-1, 0));
document.getElementById('btn-right').addEventListener('click', () => movePlayer(1, 0));

document.addEventListener('keydown', (e) => {
    const keys = {
        'ArrowUp': [0, -1], 'w': [0, -1], 'ArrowDown': [0, 1], 's': [0, 1],
        'ArrowLeft': [-1, 0], 'a': [-1, 0], 'ArrowRight': [1, 0], 'd': [1, 0]
    };
    if (keys[e.key]) movePlayer(...keys[e.key]);
});

// Init
loadStage(1);
gameLoop();
