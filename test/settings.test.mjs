import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
};

const { STORAGE_KEY, loadSettings, importSettings, DEFAULT_SETTINGS } = await import('../js/settings.js');

test('旧存档补齐模式与默认攻击表', () => {
  store.set(STORAGE_KEY, JSON.stringify({ das: 100, rotationSystem: 'srs' }));
  const s = loadSettings();
  assert.equal(s.das, 100);
  assert.equal(s.mode, 'marathon');
  assert.equal(s.aiDifficulty, 'normal');
  assert.equal(s.attackTable.name, 'Guideline');
});

test('损坏的攻击表与非法模式回退默认', () => {
  store.set(STORAGE_KEY, JSON.stringify({ mode: 'nope', aiDifficulty: 'x', attackTable: 'bad' }));
  const s = loadSettings();
  assert.equal(s.mode, 'marathon');
  assert.equal(s.aiDifficulty, 'normal');
  assert.equal(s.attackTable.base.tetris, DEFAULT_SETTINGS.attackTable.base.tetris);
});

test('导入时校验攻击表并夹取数值', () => {
  const s = loadSettings();
  importSettings(s, JSON.stringify({ mode: 'sprint', attackTable: { name: 'T', base: { tetris: 99 } } }));
  assert.equal(s.mode, 'sprint');
  assert.equal(s.attackTable.base.tetris, 20);
  assert.equal(s.attackTable.base.tspinDouble, 4);
});
