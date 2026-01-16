// ===== PIXEL QUEST - Simple Mobile Game =====

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Game dimensions
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

// Player
const player = {
    x: 5,
    y: 5,
    color: '#6ee7ff',
    frame: 0,
    animTimer: 0
};

// Collectibles
let collectibles = [];
let triggers = [];
let particles = [];

// Map tiles (0=floor, 1=wall, 2=grass, 3=water)
const map = [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,2,2,0,0,0,0,0,1],
    [1,0,0,0,2,2,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,3,3,0,1],
    [1,2,2,0,0,0,0,0,3,3,0,1],
    [1,2,2,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,2,2,0,0,1],
    [1,0,0,3,3,0,0,2,2,0,0,1],
    [1,0,0,3,3,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1]
];

// Colors for tiles
const tileColors = {
    0: '#1a1a2e', // floor
    1: '#3a3a5c', // wall
    2: '#2a4a2a', // grass
    3: '#1a3a5a'  // water
};

// Initialize collectibles
function spawnCollectibles() {
    collectibles = [];
    const types = [
        { emoji: '💎', value: 10, xp: 5 },
        { emoji: '⭐', value: 5, xp: 10 },
        { emoji: '🍎', value: 3, xp: 3 },
        { emoji: '🔮', value: 15, xp: 15 }
    ];
    
    for (let i = 0; i < 5; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * (MAP_WIDTH - 2)) + 1;
            y = Math.floor(Math.random() * (MAP_HEIGHT - 2)) + 1;
        } while (map[y][x] === 1 || map[y][x] === 3 || 
                 (x === player.x && y === player.y) ||
                 collectibles.some(c => c.x === x && c.y === y));
        
        const type = types[Math.floor(Math.random() * types.length)];
        collectibles.push({
            x, y,
            ...type,
            animOffset: Math.random() * Math.PI * 2
        });
    }
}

// Initialize trigger zones
function spawnTriggers() {
    triggers = [
        { x: 2, y: 2, type: 'chest', opened: false, emoji: '📦' },
        { x: 9, y: 7, type: 'chest', opened: false, emoji: '📦' }
    ];
}

// Particle system
function createParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x * TILE_SIZE + TILE_SIZE / 2,
            y: y * TILE_SIZE + TILE_SIZE / 2,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 2,
            life: 1,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

// Update particles
function updateParticles() {
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.03;
        return p.life > 0;
    });
}

// Draw particles
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

// Move player
function movePlayer(dx, dy) {
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    // Check bounds and walls
    if (newX >= 0 && newX < MAP_WIDTH && 
        newY >= 0 && newY < MAP_HEIGHT &&
        map[newY][newX] !== 1 && map[newY][newX] !== 3) {
        
        player.x = newX;
        player.y = newY;
        
        // Check collectibles
        checkCollectibles();
        
        // Check triggers
        checkTriggers();
    }
}

// Check collectible pickups
function checkCollectibles() {
    collectibles = collectibles.filter(c => {
        if (c.x === player.x && c.y === player.y) {
            coins += c.value;
            xp += c.xp;
            createParticles(c.x, c.y, '#ffd700', 8);
            showReward(`+${c.value} 💎  +${c.xp} XP`);
            updateHUD();
            checkLevelUp();
            return false;
        }
        return true;
    });
    
    // Respawn if all collected
    if (collectibles.length === 0) {
        setTimeout(spawnCollectibles, 1000);
    }
}

// Check trigger zones
function checkTriggers() {
    triggers.forEach(t => {
        if (t.x === player.x && t.y === player.y && !t.opened) {
            t.opened = true;
            t.emoji = '🎁';
            const bonus = 20 + level * 5;
            coins += bonus;
            xp += 25;
            createParticles(t.x, t.y, '#ff6b9d', 12);
            showReward(`CHEST! +${bonus} 💎  +25 XP`);
            updateHUD();
            checkLevelUp();
            
            // Reset chest after delay
            setTimeout(() => {
                t.opened = false;
                t.emoji = '📦';
            }, 10000);
        }
    });
}

// Level up check
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

// Update HUD
function updateHUD() {
    document.getElementById('coin-count').textContent = coins;
    document.getElementById('level-count').textContent = level;
    document.getElementById('xp-fill').style.width = `${(xp / xpToNext) * 100}%`;
}

// Show reward popup
function showReward(text) {
    const popup = document.getElementById('reward-popup');
    popup.querySelector('.reward-text').textContent = text;
    popup.classList.remove('hidden');
    
    setTimeout(() => {
        popup.classList.add('hidden');
    }, 1500);
}

// Draw map
function drawMap() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            ctx.fillStyle = tileColors[map[y][x]];
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            
            // Add subtle grid
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }
}

// Draw collectibles
function drawCollectibles() {
    const time = Date.now() / 200;
    collectibles.forEach(c => {
        const bounce = Math.sin(time + c.animOffset) * 3;
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            c.emoji,
            c.x * TILE_SIZE + TILE_SIZE / 2,
            c.y * TILE_SIZE + TILE_SIZE / 2 + bounce
        );
    });
}

// Draw triggers
function drawTriggers() {
    triggers.forEach(t => {
        ctx.font = '22px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            t.emoji,
            t.x * TILE_SIZE + TILE_SIZE / 2,
            t.y * TILE_SIZE + TILE_SIZE / 2
        );
    });
}

// Draw player (pixel art style)
function drawPlayer() {
    const x = player.x * TILE_SIZE;
    const y = player.y * TILE_SIZE;
    const time = Date.now() / 150;
    const bounce = Math.sin(time) * 2;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + TILE_SIZE/2, y + TILE_SIZE - 4, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.fillStyle = player.color;
    ctx.fillRect(x + 8, y + 8 + bounce, 16, 16);
    
    // Eyes
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 11, y + 12 + bounce, 4, 4);
    ctx.fillRect(x + 17, y + 12 + bounce, 4, 4);
    
    // Glow effect
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = player.color;
    ctx.fillRect(x + 8, y + 8 + bounce, 16, 16);
    ctx.shadowBlur = 0;
}

// Main game loop
function gameLoop() {
    // Clear
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update
    updateParticles();
    
    // Draw
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

// Mouse fallback for testing
document.getElementById('btn-up').addEventListener('click', () => movePlayer(0, -1));
document.getElementById('btn-down').addEventListener('click', () => movePlayer(0, 1));
document.getElementById('btn-left').addEventListener('click', () => movePlayer(-1, 0));
document.getElementById('btn-right').addEventListener('click', () => movePlayer(1, 0));

// Keyboard controls
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp': case 'w': movePlayer(0, -1); break;
        case 'ArrowDown': case 's': movePlayer(0, 1); break;
        case 'ArrowLeft': case 'a': movePlayer(-1, 0); break;
        case 'ArrowRight': case 'd': movePlayer(1, 0); break;
    }
});

// Initialize game
spawnCollectibles();
spawnTriggers();
updateHUD();
gameLoop();

console.log('🎮 Pixel Quest loaded! Use arrow keys or on-screen controls to move.');
