import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTACK_PRESETS, computeAttack, validateAttackTable } from '../js/attack.js';

const g = ATTACK_PRESETS.guideline;
const plain = (lines, extra = {}) => ({ lines, tspin: null, perfect: false, combo: 0, b2bActive: false, ...extra });

test('普通消行按表发攻击', () => {
  assert.equal(computeAttack(plain(1), g), 0);
  assert.equal(computeAttack(plain(2), g), 1);
  assert.equal(computeAttack(plain(3), g), 2);
  assert.equal(computeAttack(plain(4), g), 4);
});

test('T-Spin 优先于普通消行', () => {
  assert.equal(computeAttack(plain(1, { tspin: { mini: true } }), g), 1);
  assert.equal(computeAttack(plain(2, { tspin: { mini: false } }), g), 4);
  assert.equal(computeAttack(plain(0, { tspin: { mini: false } }), g), 0);
});

test('combo 用消行后的连击数，超出长度重复最后一项', () => {
  assert.equal(computeAttack(plain(2, { combo: 2 }), g), 2);
  assert.equal(computeAttack(plain(1, { combo: 5 }), g), 2);
  assert.equal(computeAttack(plain(1, { combo: 99 }), g), 4);
});

test('B2B 只加在困难消行上', () => {
  assert.equal(computeAttack(plain(4, { b2bActive: true }), g), 5);
  assert.equal(computeAttack(plain(2, { b2bActive: true }), g), 1);
});

test('Perfect Clear 叠加', () => {
  assert.equal(computeAttack(plain(1, { perfect: true }), g), 10);
});

test('校验会取整、夹取并补齐缺省字段', () => {
  const t = validateAttackTable({ base: { tetris: 99.6 }, combo: [], name: 'X' });
  assert.equal(t.base.tetris, 20);
  assert.equal(t.base.tspinDouble, 4);
  assert.deepEqual(t.combo, [0]);
  assert.equal(t.name, 'X');
  assert.throws(() => validateAttackTable(null));
});
