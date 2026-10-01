const path = require('node:path');
const express = require('express');
const http = require('node:http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 25000,
  pingTimeout: 20000,
});

const PUBLIC_DIR = path.join(__dirname, 'public');
app.disable('x-powered-by');
app.use(express.static(PUBLIC_DIR));

const PORT = Number(process.env.PORT) || 3000;
const TICK_MS = 50;
const PLAYER_SPEED = 0.012;
const DASH_DISTANCE = 0.16;
const DASH_COOLDOWN = 45;
const ATTACK_COOLDOWN = 8;
const MAX_PLAYERS = 24;

const players = new Map();
const enemies = [
  { id: 1, x: 0.18, y: 0.18, hp: 100, respawnAt: 0 },
  { id: 2, x: 0.82, y: 0.22, hp: 100, respawnAt: 0 },
  { id: 3, x: 0.75, y: 0.78, hp: 100, respawnAt: 0 },
];
let coin = { x: 0.55, y: 0.48 };

const clamp = (value, min = 0.06, max = 0.94) =>
  Math.max(min, Math.min(max, value));

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function randomPoint() {
  return {
    x: 0.12 + Math.random() * 0.76,
    y: 0.12 + Math.random() * 0.76,
  };
}

function randomSpawn(avoidPlayer = null) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const point = randomPoint();
    if (!avoidPlayer || distance(point.x, point.y, avoidPlayer.x, avoidPlayer.y) > 0.18) {
      return point;
    }
  }
  return randomPoint();
}

function cleanName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  return Array.from(name || 'Jugador').slice(0, 12).join('');
}

function normalizeInput(input) {
  if (!input || typeof input !== 'object') {
    return { up: false, down: false, left: false, right: false };
  }
  return {
    up: Boolean(input.up),
    down: Boolean(input.down),
    left: Boolean(input.left),
    right: Boolean(input.right),
  };
}

function publicState() {
  const safePlayers = {};
  for (const [id, player] of players) {
    safePlayers[id] = {
      name: player.name,
      x: player.x,
      y: player.y,
      hp: player.hp,
      score: player.score,
    };
  }

  return {
    players: safePlayers,
    enemies: enemies.map(({ id, x, y, hp }) => ({ id, x, y, hp })),
    coin: { ...coin },
  };
}

function broadcast() {
  io.emit('state', publicState());
}

function resetPlayer(player, scorePenalty = 50) {
  player.hp = 100;
  player.score = Math.max(0, player.score - scorePenalty);
  const spawn = randomSpawn(player);
  player.x = spawn.x;
  player.y = spawn.y;
}

function resetEnemy(enemy) {
  const spawn = randomPoint();
  enemy.x = spawn.x;
  enemy.y = spawn.y;
  enemy.hp = 100;
  enemy.respawnAt = 0;
}

io.on('connection', (socket) => {
  socket.on('join', (payload) => {
    if (players.has(socket.id)) return;
    if (players.size >= MAX_PLAYERS) {
      socket.emit('joinError', 'La arena está llena. Probá de nuevo más tarde.');
      return;
    }

    const name = cleanName(payload?.name);
    const spawn = randomSpawn();
    players.set(socket.id, {
      name,
      x: spawn.x,
      y: spawn.y,
      hp: 100,
      score: 0,
      attackCooldown: 0,
      dashCooldown: 0,
      input: normalizeInput(),
    });

    socket.emit('joined', { id: socket.id });
    io.emit('message', `${name} se unió a la arena.`);
    broadcast();
  });

  socket.on('input', (input) => {
    const player = players.get(socket.id);
    if (player) player.input = normalizeInput(input);
  });

  socket.on('attack', () => {
    const player = players.get(socket.id);
    if (!player || player.hp <= 0 || player.attackCooldown > 0) return;

    player.attackCooldown = ATTACK_COOLDOWN;

    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      if (distance(player.x, player.y, enemy.x, enemy.y) < 0.18) {
        enemy.hp = Math.max(0, enemy.hp - 35);
        if (enemy.hp === 0) {
          player.score += 100;
          enemy.respawnAt = Date.now() + 1800;
        }
      }
    }

    for (const other of players.values()) {
      if (other === player || other.hp <= 0) continue;
      if (distance(player.x, player.y, other.x, other.y) < 0.16) {
        other.hp = Math.max(0, other.hp - 20);
        player.score += 10;
      }
    }
  });

  socket.on('dash', (direction) => {
    const player = players.get(socket.id);
    if (!player || player.hp <= 0 || player.dashCooldown > 0) return;

    const input = normalizeInput(direction);
    let dx = Number(input.right) - Number(input.left);
    let dy = Number(input.down) - Number(input.up);

    if (dx === 0 && dy === 0) dy = -1;
    const magnitude = Math.hypot(dx, dy) || 1;
    player.x = clamp(player.x + (dx / magnitude) * DASH_DISTANCE);
    player.y = clamp(player.y + (dy / magnitude) * DASH_DISTANCE);
    player.dashCooldown = DASH_COOLDOWN;
  });

  socket.on('restart', () => {
    const player = players.get(socket.id);
    if (!player) return;
    player.score = 0;
    resetPlayer(player, 0);
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    broadcast();
  });
});

function updateEnemies() {
  const now = Date.now();

  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      if (now >= enemy.respawnAt) resetEnemy(enemy);
      continue;
    }

    let target = null;
    let bestDistance = Infinity;

    for (const player of players.values()) {
      if (player.hp <= 0) continue;
      const d = distance(player.x, player.y, enemy.x, enemy.y);
      if (d < bestDistance) {
        bestDistance = d;
        target = player;
      }
    }

    if (!target) continue;

    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    enemy.x = clamp(enemy.x + (dx / magnitude) * 0.0015);
    enemy.y = clamp(enemy.y + (dy / magnitude) * 0.0015);

    if (bestDistance < 0.055) {
      target.hp = Math.max(0, target.hp - 0.3);
    }
  }
}

function updatePlayers() {
  for (const player of players.values()) {
    const input = player.input;
    let dx = Number(input.right) - Number(input.left);
    let dy = Number(input.down) - Number(input.up);

    if (player.hp > 0 && (dx !== 0 || dy !== 0)) {
      const magnitude = Math.hypot(dx, dy) || 1;
      player.x = clamp(player.x + (dx / magnitude) * PLAYER_SPEED);
      player.y = clamp(player.y + (dy / magnitude) * PLAYER_SPEED);
    }

    if (player.attackCooldown > 0) player.attackCooldown -= 1;
    if (player.dashCooldown > 0) player.dashCooldown -= 1;

    if (player.hp > 0 && distance(player.x, player.y, coin.x, coin.y) < 0.055) {
      player.score += 25;
      coin = randomSpawn(player);
    }

    if (player.hp <= 0) {
      resetPlayer(player);
    }
  }
}

setInterval(() => {
  updatePlayers();
  updateEnemies();
  broadcast();
}, TICK_MS);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mini Arena Online running on port ${PORT}`);
});
