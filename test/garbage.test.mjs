import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, createGame, insertGarbage, isToppedOut, lockPiece, W, H, GARBAGE } from '../js/engine.js';
import { SRS } from '../js/rotations.js';

const settings = { lineClearDelay: 0, are: 0 };

test('垃圾行从底部插入并整行上推', () => {
  const g = createGame();
  g.board[(H - 1) * W + 0] = 3;
  insertGarbage(g, 2, () => 0.5);
  assert.equal(g.board[(H - 3) * W + 0], 3);
  assert.equal(g.board[(H - 1) * W + 0], GARBAGE);
  assert.equal(g.board[(H - 2) * W + 0], GARBAGE);
});

test('每行一个洞，连续行避免同洞', () => {
  const g = createGame();
  const holes = [];
  insertGarbage(g, 3, () => 0);
  for (let i = 0; i < 3; i++) {
    const row = (H - 3 + i) * W;
    const empties = [...g.board.slice(row, row + W)].map((v, x) => (v ? -1 : x)).filter((x) => x >= 0);
    assert.equal(empties.length, 1);
    holes.push(empties[0]);
  }
  assert.notEqual(holes[0], holes[1]);
  assert.notEqual(holes[1], holes[2]);
});

test('推入隐藏行判顶死', () => {
  const g = createGame();
  g.board[0 * W + 4] = 3;
  const { toppedOut } = insertGarbage(g, 1, () => 0);
  assert.equal(toppedOut, true);
  assert.equal(g.status, 'over');
});

test('隐藏行有方块即判定顶死标记', () => {
  const board = createBoard();
  board[4] = 3;
  assert.equal(isToppedOut(board), true);
});

test('消行后棋盘全空标记 perfect', () => {
  const g = createGame();
  for (let x = 4; x < W; x++) g.board[(H - 1) * W + x] = 3;
  g.current = { type: 'I', r: 0, x: 0, y: H - 2 };
  const info = lockPiece(g, SRS, settings);
  assert.equal(info.lines, 1);
  assert.equal(info.perfect, true);
});
