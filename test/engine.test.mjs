import test from 'node:test';
import assert from 'node:assert/strict';

import {
  W,
  H,
  createGame,
  createBoard,
  fillQueue,
  collides,
  ghostY,
  rotate,
  lockPiece,
  clearFullRows,
  step,
} from '../js/engine.js';
import { SRS } from '../js/rotations.js';
import { DEFAULT_SETTINGS } from '../js/settings.js';
import { createHandling, press, tick } from '../js/handling.js';

const settings = { ...DEFAULT_SETTINGS };

test('7-bag: 每 7 个方块为一轮且不重复', () => {
  const game = createGame();
  fillQueue(game);
  const first = game.queue.slice(0, 7);
  assert.equal(new Set(first).size, 7);
  game.queue.splice(0, 7);
  fillQueue(game);
  const second = game.queue.slice(0, 7);
  assert.equal(new Set(second).size, 7);
  assert.deepEqual([...second].sort(), [...first].sort());
});

test('碰撞与幽灵位置', () => {
  const board = createBoard();
  assert.equal(collides(board, SRS, 'I', 0, 6, H - 2), false);
  assert.equal(collides(board, SRS, 'I', 0, 6, H - 1), true); // 右越界
  const game = createGame();
  game.current = { type: 'I', r: 0, x: 3, y: 2 };
  assert.equal(ghostY(game, SRS), H - 2);
});

test('SRS 墙角踢墙：贴底 T 顺时针上踢', () => {
  const game = createGame();
  game.current = { type: 'T', r: 0, x: 3, y: H - 2 };
  const res = rotate(game, SRS, settings, 'cw');
  assert.equal(res.ok, true);
  assert.deepEqual(game.current, { type: 'T', r: 1, x: 2, y: H - 3 });
});

test('T-Spin 三格判定与计分', () => {
  const game = createGame();
  const put = (x, y) => {
    game.board[y * W + x] = 1;
  };
  put(3, 5);
  put(5, 5);
  put(3, 7);
  game.current = { type: 'T', r: 0, x: 3, y: 5 };
  game.lastAction = 'rotate';
  const info = lockPiece(game, SRS, settings);
  assert.ok(info.tspin);
  assert.equal(info.tspin.mini, false);
  assert.equal(info.lines, 0);
  assert.equal(game.score, 400);
});

test('消行：整行移除并压缩棋盘', () => {
  const board = createBoard();
  for (let x = 0; x < W; x++) board[(H - 1) * W + x] = 1;
  for (let x = 1; x < W; x++) board[(H - 2) * W + x] = 2;
  assert.equal(clearFullRows(board), 1);
  assert.equal(board[(H - 1) * W + 0], 0);
  assert.equal(board[(H - 1) * W + 1], 2);
});

test('DAS 先蓄力、ARR 按间隔连发', () => {
  const h = createHandling();
  const s = { ...settings, das: 100, arr: 50, lastPriority: true };
  let shifts = 0;
  const move = () => {
    shifts++;
    return true;
  };
  assert.equal(press(h, 1, s), 1);
  shifts++; // 首次按下立即移动

  for (let i = 0; i < 10; i++) tick(h, 10, s, move); // 蓄满 DAS 时再移动一次
  assert.equal(shifts, 2);

  for (let i = 0; i < 5; i++) tick(h, 10, s, move); // ARR 50ms 后再移动
  assert.equal(shifts, 3);
});

test('ARR 0 时 DAS 蓄满即贴墙', () => {
  const h = createHandling();
  const s = { ...settings, das: 100, arr: 0, lastPriority: true };
  let moves = 0;
  const move = () => {
    if (moves >= 5) return false;
    moves++;
    return true;
  };
  press(h, 1, s);
  moves++;

  for (let i = 0; i < 10; i++) tick(h, 10, s, move); // 蓄满，移动 1 次
  assert.equal(moves, 2);

  tick(h, 10, s, move); // 下一帧一次冲到墙
  assert.equal(moves, 5);
});

test('180 关闭时旋转失败且不改变状态', () => {
  const game = createGame();
  game.current = { type: 'T', r: 0, x: 3, y: 5 };
  const res = rotate(game, SRS, { ...settings, rot180: 'off' }, '180');
  assert.equal(res.ok, false);
  assert.deepEqual(game.current, { type: 'T', r: 0, x: 3, y: 5 });
});

test('软降受 SDF 影响，硬到底后锁定延迟触发', () => {
  const game = createGame();
  game.current = { type: 'I', r: 1, x: 3, y: 2 };
  game.status = 'playing';
  const fast = { ...settings, gravity: 1, sdf: 20, lockDelay: 500, are: 0 };
  let locked = null;
  for (let i = 0; i < 120 && !locked; i++) {
    locked = step(game, SRS, fast, 1000 / 60, true);
  }
  assert.ok(locked, '应当锁定并返回结算信息');
  assert.equal(game.pieces, 1);
});
