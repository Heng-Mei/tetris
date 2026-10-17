import { W, H, collides, clearFullRows } from './engine.js';

export const AI_PROFILES = {
  easy: { label: '简单', interval: 900, blunder: 0.35, noise: 2.5 },
  normal: { label: '普通', interval: 450, blunder: 0.12, noise: 1.0 },
  hard: { label: '困难', interval: 200, blunder: 0.03, noise: 0.3 },
};

export function evaluateBoard(board) {
  const heights = new Array(W).fill(0);
  let holes = 0;
  for (let x = 0; x < W; x++) {
    let top = H;
    for (let y = 0; y < H; y++) {
      if (board[y * W + x]) {
        top = y;
        break;
      }
    }
    heights[x] = H - top;
    let seen = false;
    for (let y = 0; y < H; y++) {
      const filled = !!board[y * W + x];
      if (filled) seen = true;
      else if (seen) holes++;
    }
  }
  const bumpiness = heights.reduce((sum, h, i) => (i ? sum + Math.abs(h - heights[i - 1]) : sum), 0);
  return {
    height: heights.reduce((a, b) => a + b, 0),
    holes,
    bumpiness,
    maxHeight: Math.max(...heights),
  };
}

function dropY(board, system, type, r, x) {
  let y = -3;
  if (!collides(board, system, type, r, x, y)) {
    while (!collides(board, system, type, r, x, y + 1)) y++;
  }
  return y;
}

function fits(board, system, type, p) {
  for (const [cx, cy] of system.shapes[type][p.r]) {
    const y = p.y + cy;
    const x = p.x + cx;
    if (y < 0 || y >= H || x < 0 || x >= W) return false;
  }
  return true;
}

export function enumeratePlacements(board, system, type) {
  const out = [];
  const seen = new Set();
  for (let r = 0; r < 4; r++) {
    for (let x = -4; x <= W; x++) {
      const y = dropY(board, system, type, r, x);
      const p = { r, x, y };
      if (!fits(board, system, type, p) || collides(board, system, type, r, x, y)) continue;
      const key = `${r}:${x}:${y}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(p);
      }
    }
  }
  return out;
}

export function choosePlacement(board, system, type, profile, rng = Math.random) {
  const list = enumeratePlacements(board, system, type);
  if (!list.length) return null;
  const scored = list.map((p) => {
    const b = Uint8Array.from(board);
    for (const [cx, cy] of system.shapes[type][p.r]) b[(p.y + cy) * W + p.x + cx] = 1;
    const cleared = clearFullRows(b);
    const e = evaluateBoard(b);
    const score =
      0.76 * cleared - 0.51 * e.height - 0.36 * e.holes - 0.18 * e.bumpiness - 0.05 * e.maxHeight;
    return { p, score: score + (rng() - 0.5) * profile.noise };
  });
  scored.sort((a, b) => b.score - a.score);
  const pick = rng() < profile.blunder ? Math.min(scored.length - 1, Math.floor(rng() * 3)) : 0;
  return scored[pick].p;
}
