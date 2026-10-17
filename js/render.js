import { COLORS, PIECE_IDS } from './rotations.js';
import { W, H, HIDDEN, VISIBLE, ghostY } from './engine.js';

const BG = '#0b0f16';
const GRID = 'rgba(120, 150, 200, 0.08)';

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function paintCell(g, px, py, size, color, ghost) {
  const inset = Math.max(1, size * 0.05);
  const r = Math.max(2, size * 0.18);
  const x = px + inset;
  const y = py + inset;
  const w = size - inset * 2;
  const h = size - inset * 2;

  roundRect(g, x, y, w, h, r);
  if (ghost) {
    g.fillStyle = 'rgba(255,255,255,0.03)';
    g.fill();
    g.strokeStyle = color;
    g.globalAlpha = 0.42;
    g.lineWidth = Math.max(1.5, size * 0.06);
    g.stroke();
    g.globalAlpha = 1;
    return;
  }

  g.fillStyle = color;
  g.fill();

  const shade = g.createLinearGradient(x, y, x, y + h);
  shade.addColorStop(0, 'rgba(255,255,255,0.30)');
  shade.addColorStop(0.45, 'rgba(255,255,255,0.05)');
  shade.addColorStop(1, 'rgba(0,0,0,0.20)');
  roundRect(g, x, y, w, h, r);
  g.fillStyle = shade;
  g.fill();
}

export function createRenderer({ board, hold, next }) {
  const ctx = board.getContext('2d');
  const holdCtx = hold.getContext('2d');
  const nextCtx = next.getContext('2d');
  let cell = 30;
  let miniCell = 20;

  function setupCanvas(canvas, cssW, cssH) {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return g;
  }

  function resize() {
    const verticalRoom = window.innerHeight - 190;
    const horizontalRoom = window.innerWidth - 380;
    cell = Math.max(12, Math.floor(Math.min(verticalRoom / VISIBLE, horizontalRoom / W, 42)));
    setupCanvas(board, cell * W, cell * VISIBLE);

    miniCell = Math.max(10, Math.round(cell * 0.72));
    const slotW = miniCell * 4;
    setupCanvas(hold, slotW, miniCell * 3);
    setupCanvas(next, slotW, miniCell * 3 * 5);
  }

  function drawBoard(state, settings, system, opts = {}) {
    const g = ctx;
    g.clearRect(0, 0, cell * W, cell * VISIBLE);
    g.fillStyle = BG;
    g.fillRect(0, 0, cell * W, cell * VISIBLE);

    if (settings.grid) {
      g.strokeStyle = GRID;
      g.lineWidth = 1;
      for (let x = 1; x < W; x++) {
        g.beginPath();
        g.moveTo(Math.round(x * cell) + 0.5, 0);
        g.lineTo(Math.round(x * cell) + 0.5, cell * VISIBLE);
        g.stroke();
      }
      for (let y = 1; y < VISIBLE; y++) {
        g.beginPath();
        g.moveTo(0, Math.round(y * cell) + 0.5);
        g.lineTo(cell * W, Math.round(y * cell) + 0.5);
        g.stroke();
      }
    }

    // 已固定方块
    for (let y = HIDDEN; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = state.board[y * W + x];
        if (v) paintCell(g, x * cell, (y - HIDDEN) * cell, cell, COLORS[PIECE_IDS[v - 1]], false);
      }
    }

    const c = state.current;
    if (c && state.status === 'playing') {
      const gy = ghostY(state, system);
      if (settings.ghost && gy !== c.y) {
        for (const [cx, cy] of system.shapes[c.type][c.r]) {
          const y = gy + cy - HIDDEN;
          if (y < 0) continue;
          paintCell(g, (c.x + cx) * cell, y * cell, cell, COLORS[c.type], true);
        }
      }
      g.save();
      g.shadowColor = COLORS[c.type];
      g.shadowBlur = cell * 0.45;
      for (const [cx, cy] of system.shapes[c.type][c.r]) {
        const y = c.y + cy - HIDDEN;
        if (y < 0) continue;
        paintCell(g, (c.x + cx) * cell, y * cell, cell, COLORS[c.type], false);
      }
      g.restore();
    }

    if (opts.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${(opts.flash / 140) * 0.10})`;
      g.fillRect(0, 0, cell * W, cell * VISIBLE);
    }
  }

  function drawPieceInto(g, type, slotHeight, system, originY) {
    const cells = system.shapes[type][0];
    const xs = cells.map(([x]) => x);
    const ys = cells.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = (maxX - minX + 1) * miniCell;
    const h = (maxY - minY + 1) * miniCell;
    const ox = (miniCell * 4 - w) / 2 - minX * miniCell;
    const oy = originY + (slotHeight - h) / 2 - minY * miniCell;
    for (const [x, y] of cells) {
      paintCell(g, ox + x * miniCell, oy + y * miniCell, miniCell, COLORS[type], false);
    }
  }

  function drawHold(state, system) {
    holdCtx.clearRect(0, 0, miniCell * 4, miniCell * 3);
    if (state.hold) drawPieceInto(holdCtx, state.hold, miniCell * 3, system, 0);
  }

  function drawNext(state, system) {
    nextCtx.clearRect(0, 0, miniCell * 4, miniCell * 3 * 5);
    for (let i = 0; i < 5; i++) {
      const type = state.queue[i];
      if (!type) continue;
      nextCtx.globalAlpha = i === 0 ? 1 : Math.max(0.45, 1 - i * 0.13);
      drawPieceInto(nextCtx, type, miniCell * 3, system, i * miniCell * 3);
      nextCtx.globalAlpha = 1;
    }
  }

  return {
    resize,
    draw(state, settings, system, opts = {}) {
      drawBoard(state, settings, system, opts);
      drawHold(state, system);
      drawNext(state, system);
    },
    get cell() {
      return cell;
    },
  };
}
