import { PIECE_IDS, kickList } from './rotations.js';

export const W = 10;
export const H = 22;
export const HIDDEN = 2; // 顶部隐藏行
export const VISIBLE = 20;

const idx = (x, y) => y * W + x;

export function createBoard() {
  return new Uint8Array(W * H);
}

export function collides(board, system, type, r, x, y) {
  for (const [cx, cy] of system.shapes[type][r]) {
    const bx = x + cx;
    const by = y + cy;
    if (bx < 0 || bx >= W || by >= H) return true;
    if (by >= 0 && board[idx(bx, by)]) return true;
  }
  return false;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function createGame() {
  return {
    board: createBoard(),
    current: null,
    hold: null,
    holdUsed: false,
    queue: [],
    bag: [],
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    b2b: false,
    pieces: 0,
    time: 0,
    status: 'idle', // idle | spawning | playing | over
    spawnTimer: 0,
    dropAccum: 0,
    grounded: 0,
    lockResets: 0,
    lastAction: '',
    pendingIRS: null,
    pendingIHS: false,
  };
}

export function fillQueue(state) {
  while (state.queue.length < 7) {
    if (!state.bag.length) state.bag = shuffle([...PIECE_IDS]);
    state.queue.push(state.bag.pop());
  }
}

export function resetGame(state) {
  Object.assign(state, createGame());
  fillQueue(state);
  state.status = 'spawning';
  state.spawnTimer = 0;
}

function place(state, system, type) {
  const [sx, sy] = (system.spawn && system.spawn[type]) || [3, 2];
  state.current = { type, r: 0, x: sx, y: sy };
  state.dropAccum = 0;
  state.grounded = 0;
  state.lockResets = 0;
  state.lastAction = '';
  state.status = 'playing';
  if (collides(state.board, system, type, 0, sx, sy)) state.status = 'over';
}

export function spawnNext(state, system, settings) {
  fillQueue(state);
  const type = state.queue.shift();
  fillQueue(state);

  const irs = state.pendingIRS;
  const ihs = state.pendingIHS;
  state.pendingIRS = null;
  state.pendingIHS = false;

  place(state, system, type);
  state.holdUsed = false;
  if (state.status === 'over') return;

  if (settings.irs && irs) rotate(state, system, settings, irs);
  if (settings.ihs && ihs) holdPiece(state, system, settings);
}

export function ghostY(state, system) {
  const c = state.current;
  if (!c) return 0;
  let y = c.y;
  while (!collides(state.board, system, c.type, c.r, c.x, y + 1)) y++;
  return y;
}

function resetLock(state, settings, kind) {
  if (state.grounded <= 0) return;
  if (state.lockResets >= settings.maxLockResets) return;
  if (kind === 'move' && !settings.resetOnMove) return;
  if (kind === 'rotate' && !settings.resetOnRotate) return;
  state.grounded = 0;
  state.lockResets++;
}

export function tryMove(state, system, dx, dy, settings) {
  const c = state.current;
  if (!c) return false;
  if (collides(state.board, system, c.type, c.r, c.x + dx, c.y + dy)) return false;
  c.x += dx;
  c.y += dy;
  if (dx) {
    state.lastAction = 'move';
    resetLock(state, settings, 'move');
  }
  if (dy) state.grounded = 0;
  return true;
}

function rotateOnce(state, system, dir) {
  const c = state.current;
  const to = dir === 'cw' ? (c.r + 1) % 4 : (c.r + 3) % 4;
  for (const [dx, dy] of kickList(system, c.type, c.r, to, false)) {
    if (!collides(state.board, system, c.type, to, c.x + dx, c.y + dy)) {
      c.r = to;
      c.x += dx;
      c.y += dy;
      return true;
    }
  }
  return false;
}

export function rotate(state, system, settings, dir) {
  const c = state.current;
  if (!c) return { ok: false };

  if (dir === '180') {
    if (settings.rot180 === 'off') return { ok: false };
    if (settings.rot180 === 'table') {
      const to = (c.r + 2) % 4;
      for (const [dx, dy] of kickList(system, c.type, c.r, to, true)) {
        if (!collides(state.board, system, c.type, to, c.x + dx, c.y + dy)) {
          c.r = to;
          c.x += dx;
          c.y += dy;
          state.lastAction = 'rotate';
          resetLock(state, settings, 'rotate');
          return { ok: true, kicked: dx !== 0 || dy !== 0 };
        }
      }
      return { ok: false };
    }
    // two-step：连续两次顺时针；中途失败整体回滚
    const save = { x: c.x, y: c.y, r: c.r };
    if (rotateOnce(state, system, 'cw') && rotateOnce(state, system, 'cw')) {
      state.lastAction = 'rotate';
      resetLock(state, settings, 'rotate');
      return { ok: true };
    }
    c.x = save.x;
    c.y = save.y;
    c.r = save.r;
    return { ok: false };
  }

  const ok = rotateOnce(state, system, dir);
  if (ok) {
    state.lastAction = 'rotate';
    resetLock(state, settings, 'rotate');
  }
  return { ok };
}

export function hardDrop(state, system) {
  const c = state.current;
  if (!c) return { dropped: 0 };
  let dropped = 0;
  while (tryMove(state, system, 0, 1)) dropped++;
  state.score += dropped * 2;
  return { dropped };
}

export function holdPiece(state, system, settings) {
  const c = state.current;
  if (!c || state.holdUsed) return false;
  const cur = c.type;
  if (state.hold === null) {
    state.hold = cur;
    state.current = null;
    spawnNext(state, system, settings);
  } else {
    const next = state.hold;
    state.hold = cur;
    place(state, system, next);
  }
  state.holdUsed = true;
  return true;
}

// 三格判定 T-Spin（锁定前调用）
function detectTSpin(state) {
  const c = state.current;
  if (!c || c.type !== 'T' || state.lastAction !== 'rotate') return null;
  const cx = c.x + 1;
  const cy = c.y + 1;
  const occupied = (dx, dy) => {
    const x = cx + dx;
    const y = cy + dy;
    if (x < 0 || x >= W || y >= H) return true;
    if (y < 0) return false;
    return state.board[idx(x, y)] !== 0;
  };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const filled = corners.map(([dx, dy]) => occupied(dx, dy));
  if (filled.filter(Boolean).length < 3) return null;
  const front = { 0: [0, 1], 1: [1, 2], 2: [2, 3], 3: [3, 0] }[c.r];
  return { mini: !(filled[front[0]] && filled[front[1]]) };
}

function scoreClear(lines, tspin, level, combo, prevB2B) {
  let base = 0;
  if (tspin) {
    if (tspin.mini) base = [100, 200, 400, 800, 1600][lines];
    else base = [400, 800, 1200, 1600, 2600][lines];
  } else {
    base = [0, 100, 300, 500, 800][lines];
  }
  const difficult = lines === 4 || !!(tspin && lines > 0);
  const b2bMult = difficult && prevB2B ? 1.5 : 1;
  let points = Math.floor(base * level * b2bMult);
  points += 50 * Math.max(0, combo) * level;
  return { points, difficult };
}

export function clearFullRows(board) {
  let cleared = 0;
  let write = H - 1;
  for (let read = H - 1; read >= 0; read--) {
    let full = true;
    for (let x = 0; x < W; x++) {
      if (!board[idx(x, read)]) {
        full = false;
        break;
      }
    }
    if (full) {
      cleared++;
      continue;
    }
    if (write !== read) board.copyWithin(write * W, read * W, read * W + W);
    write--;
  }
  for (let y = write; y >= 0; y--) board.fill(0, y * W, y * W + W);
  return cleared;
}

export function lockPiece(state, system, settings) {
  const c = state.current;
  if (!c) return { lines: 0, points: 0, tspin: null };

  const tspin = detectTSpin(state);
  const color = PIECE_IDS.indexOf(c.type) + 1;
  for (const [cx, cy] of system.shapes[c.type][c.r]) {
    const x = c.x + cx;
    const y = c.y + cy;
    if (y >= 0 && y < H && x >= 0 && x < W) state.board[idx(x, y)] = color;
  }

  const lines = clearFullRows(state.board);
  const { points, difficult } = scoreClear(lines, tspin, state.level, state.combo, state.b2b);

  state.score += points;
  if (lines > 0) {
    state.lines += lines;
    state.level = Math.floor(state.lines / 10) + 1;
    state.combo += 1;
    state.b2b = difficult;
  } else {
    state.combo = -1;
  }
  state.pieces += 1;
  state.current = null;
  state.status = 'spawning';
  state.spawnTimer = (lines > 0 ? settings.lineClearDelay : 0) + settings.are;

  return { lines, points, tspin, level: state.level };
}

export function step(state, system, settings, dt, softDrop) {
  if (state.status === 'over' || state.status === 'idle') return null;
  if (state.status === 'spawning') {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) spawnNext(state, system, settings);
    return null;
  }
  if (!state.current) return null;

  state.time += dt;

  const speed = Math.max(0, settings.gravity) * (softDrop ? Math.max(1, settings.sdf) : 1);
  state.dropAccum += (speed * dt) / 1000;

  let guard = 0;
  while (state.dropAccum >= 1 && guard++ < H) {
    state.dropAccum -= 1;
    if (tryMove(state, system, 0, 1, null)) {
      state.grounded = 0;
      if (softDrop) state.score += 1;
    } else {
      break;
    }
  }

  if (!state.current) return null;

  const c = state.current;
  const grounded = collides(state.board, system, c.type, c.r, c.x, c.y + 1);
  if (grounded) {
    state.grounded += dt;
    if (state.grounded >= settings.lockDelay) {
      return lockPiece(state, system, settings);
    }
  } else {
    state.grounded = 0;
  }
  return null;
}
