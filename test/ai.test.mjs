import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_PROFILES, choosePlacement, enumeratePlacements } from '../js/ai.js';
import { createBoard, W, H, collides, clearFullRows } from '../js/engine.js';
import { SRS } from '../js/rotations.js';

function lands(board, type, p, system) {
  assert.ok(!collides(board, system, type, p.r, p.x, p.y), '落点不能碰撞');
  const b = Uint8Array.from(board);
  for (const [cx, cy] of system.shapes[type][p.r]) b[(p.y + cy) * W + p.x + cx] = 1;
  return clearFullRows(b);
}

test('枚举只产出合法落点', () => {
  const board = createBoard();
  const list = enumeratePlacements(board, SRS, 'T');
  assert.ok(list.length > 10);
  for (const p of list) assert.ok(!collides(board, SRS, 'T', p.r, p.x, p.y));
});

test('AI 会选择能消行的落点', () => {
  const board = createBoard();
  for (let y = H - 4; y < H; y++) for (let x = 0; x < W - 1; x++) board[y * W + x] = 3;
  const p = choosePlacement(board, SRS, 'I', AI_PROFILES.hard, () => 0.5);
  assert.ok(p);
  assert.equal(lands(board, 'I', p, SRS), 4);
});

test('三档难度间隔递减', () => {
  assert.ok(AI_PROFILES.easy.interval > AI_PROFILES.normal.interval);
  assert.ok(AI_PROFILES.normal.interval > AI_PROFILES.hard.interval);
});
