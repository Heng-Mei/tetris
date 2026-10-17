import test from 'node:test';
import assert from 'node:assert/strict';
import { checkOutcome, gravityFor, formatClock } from '../js/modes.js';

const p = (lines = 0, over = false) => ({ lines, over });

test('sprint 40 行完成', () => {
  assert.deepEqual(checkOutcome('sprint', p(40), null, 90000), { winner: 'player', reason: 'goal', time: 90000 });
  assert.equal(checkOutcome('sprint', p(39), null, 90000), null);
});

test('sprint 顶死优先于完成', () => {
  assert.equal(checkOutcome('sprint', p(40, true), null, 90000).reason, 'topout');
});

test('blitz 2 分钟结束', () => {
  assert.equal(checkOutcome('blitz', p(10), null, 119999), null);
  assert.equal(checkOutcome('blitz', p(10), null, 120000).reason, 'time');
});

test('vs 双顶死判玩家负', () => {
  assert.equal(checkOutcome('vs', p(10, true), p(10, true), 1000).winner, 'ai');
  assert.equal(checkOutcome('vs', p(10), p(10, true), 1000).winner, 'player');
});

test('Blitz 重力取用户重力与曲线的较大值', () => {
  assert.equal(gravityFor('blitz', 1, 1), 1);
  assert.equal(gravityFor('blitz', 6, 1), 4);
  assert.ok(Math.abs(gravityFor('blitz', 11, 1) - 7) < 1e-9);
  assert.equal(gravityFor('marathon', 11, 1), 1);
  assert.equal(gravityFor('blitz', 2, 9), 9);
});

test('formatClock 处理负数与超过一小时', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(-5), '0:00');
  assert.equal(formatClock(61000), '1:01');
});
