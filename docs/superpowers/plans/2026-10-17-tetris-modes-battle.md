# 游戏模式、人机对战与攻击表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加 Sprint 40L、Blitz 2min、VS AI 三种模式与图形化自定义攻击表，同时保持无构建、无依赖、纯前端。

**Architecture:** 攻击计算、垃圾行、模式判定、AI 决策拆成无 DOM 的 `attack.js` / `modes.js` / `ai.js`；`main.js` 只做模式时钟、双方状态编排与结算；`render.js` 抽出可复用棋盘绘制给对手小棋盘；攻击表用独立弹窗编辑，JSON 只走文件导入导出。

**Tech Stack:** 原生 ES Modules、Canvas 2D、`node --test`、localStorage。

**Spec:** `docs/superpowers/specs/2026-10-17-tetris-modes-battle-design.md`

## Global Constraints

- 不新增依赖、不引入构建步骤；`package.json` 保持只有 `type: module` 与测试脚本。
- `engine/handling/rotations/settings/attack/modes/ai` 不碰 DOM，Node 可测。
- 逻辑固定 60Hz；新增计时一律用毫秒。
- 攻击值取整并夹在 0–20；combo 表长度 1–20。
- 旧 `tetris.settings.v1` 存档必须能直接启动。
- Conventional Commits，英文，一个逻辑改动一个提交。
- 验证命令：`npm test`，单个文件 `node --test test/<name>.test.mjs`。

## Review Focus

- 旧存档没有 `mode/aiDifficulty/attackTable` → 必须回退默认值而不是启动崩溃。
- 垃圾行插入把内容推入隐藏行 → 必须判顶死；不能穿模或丢行。
- 暂停、切后台、设置抽屉打开时模式时钟与 AI 必须停。
- Blitz 剩余时间到 0 后不能显示负数，结算只触发一次。
- 攻击表空 combo、字符串、超大数 → `computeAttack` 不能返回 NaN 或负数。

---

### Task 1: 攻击计算与攻击表校验

**Files:**
- Create: `js/attack.js`
- Test: `test/attack.test.mjs`

**Interfaces:**
- Produces: `ATTACK_PRESETS.guideline|high|low`、`validateAttackTable(input): AttackTable`、`computeAttack(info, table): number`。
- `info = { lines, tspin: null | { mini }, perfect, combo, b2bActive }`；combo 是消行后的连击数，b2bActive 是消行前状态。

- [ ] **Step 1: 写失败测试**

```js
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/attack.test.mjs` → FAIL，模块不存在。

- [ ] **Step 3: 实现**

```js
const FIELDS = ['single', 'double', 'triple', 'tetris', 'tspinMini', 'tspinSingle', 'tspinDouble', 'tspinTriple', 'perfectClear'];

export const ATTACK_PRESETS = {
  guideline: {
    name: 'Guideline',
    base: { single: 0, double: 1, triple: 2, tetris: 4, tspinMini: 1, tspinSingle: 2, tspinDouble: 4, tspinTriple: 6, perfectClear: 10 },
    b2b: 1,
    combo: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4],
  },
  high: { name: '高攻击', base: { single: 1, double: 2, triple: 4, tetris: 8, tspinMini: 2, tspinSingle: 4, tspinDouble: 8, tspinTriple: 12, perfectClear: 12 }, b2b: 2, combo: [0, 1, 1, 2, 3, 3, 4, 5, 6, 7, 8] },
  low: { name: '低攻击', base: { single: 0, double: 0, triple: 1, tetris: 2, tspinMini: 0, tspinSingle: 1, tspinDouble: 2, tspinTriple: 3, perfectClear: 4 }, b2b: 1, combo: [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3] },
};

const clampInt = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

export function validateAttackTable(input) {
  if (!input || typeof input !== 'object') throw new Error('攻击表必须是 JSON 对象');
  const base = input.base && typeof input.base === 'object' ? input.base : {};
  const out = { name: typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 32) : 'Custom', base: {}, b2b: clampInt(input.b2b, 0, 20, 1), combo: [] };
  for (const field of FIELDS) out.base[field] = clampInt(base[field], 0, 20, ATTACK_PRESETS.guideline.base[field]);
  const combo = Array.isArray(input.combo) ? input.combo.slice(0, 20) : [];
  out.combo = combo.length ? combo.map((v) => clampInt(v, 0, 20, 0)) : [0];
  return out;
}

export function computeAttack(info, table) {
  const lines = Math.max(0, Math.floor(info?.lines || 0));
  if (!lines) return 0;
  const t = table || ATTACK_PRESETS.guideline;
  const base = t.base;
  let value;
  if (info.tspin) value = info.tspin.mini ? (lines >= 2 ? base.tspinDouble : base.tspinMini) : [0, base.tspinSingle, base.tspinDouble, base.tspinTriple][Math.min(lines, 3)];
  else value = [0, base.single, base.double, base.triple, base.tetris][Math.min(lines, 4)];
  const difficult = lines === 4 || !!info.tspin;
  if (difficult && info.b2bActive) value += t.b2b;
  const comboIndex = Math.min(Math.max(0, Math.floor(info.combo)), t.combo.length - 1);
  value += t.combo[comboIndex] || 0;
  if (info.perfect) value += base.perfectClear;
  return Math.max(0, Math.round(value));
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/attack.test.mjs` → 6 pass。

- [ ] **Step 5: 提交**

```bash
git add js/attack.js test/attack.test.mjs
git commit -m "feat: add attack table and garbage attack calculation"
```

---

### Task 2: 垃圾行插入、顶死与 Perfect Clear

**Files:**
- Modify: `js/engine.js`
- Test: `test/garbage.test.mjs`

**Interfaces:**
- `GARBAGE = 8`
- `isToppedOut(board): boolean`（隐藏行有方块即顶死）
- `insertGarbage(state, lines, rng = Math.random): { toppedOut }`
- `lockPiece` 返回值新增 `combo`（消行后）、`b2bActive`（消行前）、`perfect`。

- [ ] **Step 1: 写失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, insertGarbage, isToppedOut, lockPiece, W, H, GARBAGE } from '../js/engine.js';
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
  assert.equal(isToppedOut(g.board), true);
});

test('消行后棋盘全空标记 perfect', () => {
  const g = createGame();
  for (let x = 4; x < W; x++) g.board[(H - 1) * W + x] = 3;
  g.current = { type: 'I', r: 0, x: 0, y: H - 2 };
  const info = lockPiece(g, SRS, settings);
  assert.equal(info.lines, 1);
  assert.equal(info.perfect, true);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/garbage.test.mjs` → FAIL，`insertGarbage` 未导出。

- [ ] **Step 3: 实现**

`engine.js` 顶部加 `export const GARBAGE = 8;`，`createGame()` 加 `lastGarbageHole: -1`。

```js
export function isToppedOut(board) {
  for (let y = 0; y < HIDDEN; y++) {
    for (let x = 0; x < W; x++) if (board[y * W + x]) return true;
  }
  return false;
}

export function insertGarbage(state, lines, rng = Math.random) {
  const n = Math.max(0, Math.min(Math.floor(lines), H));
  if (!n) return { toppedOut: isToppedOut(state.board) };
  let overflow = false;
  for (let y = 0; y < n && !overflow; y++) {
    for (let x = 0; x < W; x++) if (state.board[y * W + x]) { overflow = true; break; }
  }
  state.board.copyWithin(0, n * W, H * W);
  state.board.fill(0, (H - n) * W, H * W);
  for (let i = 0; i < n; i++) {
    let hole = Math.floor(Math.max(0, Math.min(0.999, rng())) * W);
    if (hole === state.lastGarbageHole) hole = (hole + 1) % W;
    state.lastGarbageHole = hole;
    const row = (H - n + i) * W;
    state.board.fill(GARBAGE, row, row + W);
    state.board[row + hole] = 0;
  }
  const toppedOut = overflow || isToppedOut(state.board);
  if (toppedOut) state.status = 'over';
  return { toppedOut };
}
```

`lockPiece` 内保存 `const prevB2B = state.b2b;`，消行后 `const perfect = state.board.every((v) => v === 0);`，返回值加 `combo: state.combo, b2bActive: prevB2B, perfect`。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/garbage.test.mjs` → PASS；再跑 `npm test` 保证旧的 9 项不回归。

- [ ] **Step 5: 提交**

```bash
git add js/engine.js test/garbage.test.mjs
git commit -m "feat: add garbage insertion and perfect clear detection"
```

---

### Task 3: 模式定义与结束判定

**Files:**
- Create: `js/modes.js`
- Test: `test/modes.test.mjs`

**Interfaces:**
- `MODES`：`marathon/sprint/blitz/vs`，字段 `id,label,clock,duration,goal`
- `modeOptions()` → `[[id,label],...]`
- `gravityFor(modeId, level, userGravity): number`
- `checkOutcome(modeId, player, opponent, elapsed): null | { winner: 'player'|'ai', reason: 'goal'|'time'|'topout', time }`
- `formatClock(ms): string`

- [ ] **Step 1: 写失败测试**

```js
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/modes.test.mjs` → FAIL。

- [ ] **Step 3: 实现**

```js
export const MODES = {
  marathon: { id: 'marathon', label: 'Marathon', clock: 'up', duration: null, goal: null },
  sprint: { id: 'sprint', label: 'Sprint 40L', clock: 'up', duration: null, goal: 40 },
  blitz: { id: 'blitz', label: 'Blitz 2:00', clock: 'down', duration: 120000, goal: null },
  vs: { id: 'vs', label: 'VS AI', clock: 'up', duration: null, goal: null },
};

export const modeOptions = () => Object.values(MODES).map((m) => [m.id, m.label]);

export function gravityFor(modeId, level, userGravity) {
  const base = Number.isFinite(userGravity) ? Math.max(0, userGravity) : 1;
  if (modeId !== 'blitz') return base;
  return Math.max(base, 1 + (Math.max(1, level) - 1) * 0.6);
}

export function checkOutcome(modeId, player, opponent, elapsed) {
  const mode = MODES[modeId] || MODES.marathon;
  if (modeId === 'vs') {
    if (player.over || opponent?.over) return { winner: player.over ? 'ai' : 'player', reason: 'topout', time: elapsed };
    return null;
  }
  if (player.over) return { winner: 'ai', reason: 'topout', time: elapsed };
  if (mode.goal != null && player.lines >= mode.goal) return { winner: 'player', reason: 'goal', time: elapsed };
  if (mode.duration != null && elapsed >= mode.duration) return { winner: 'player', reason: 'time', time: elapsed };
  return null;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/modes.test.mjs` → PASS。

- [ ] **Step 5: 提交**

```bash
git add js/modes.js test/modes.test.mjs
git commit -m "feat: add game mode rules and outcome checks"
```

---

### Task 4: AI 落点评估

**Files:**
- Create: `js/ai.js`
- Test: `test/ai.test.mjs`

**Interfaces:**
- `AI_PROFILES`：`easy/normal/hard`，字段 `label,interval,blunder,noise`
- `evaluateBoard(board)` → `{ height, holes, bumpiness, maxHeight }`
- `enumeratePlacements(board, system, type)` → `[{ r, x, y }]`（已是落底位置）
- `choosePlacement(board, system, type, profile, rng = Math.random)` → `{ r, x, y } | null`

- [ ] **Step 1: 写失败测试**

```js
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/ai.test.mjs` → FAIL。

- [ ] **Step 3: 实现**

```js
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
    for (let y = 0; y < H; y++) if (board[y * W + x]) { top = y; break; }
    heights[x] = H - top;
    let seen = false;
    for (let y = 0; y < H; y++) {
      const filled = !!board[y * W + x];
      if (filled) seen = true;
      else if (seen) holes++;
    }
  }
  const bumpiness = heights.reduce((sum, h, i) => (i ? sum + Math.abs(h - heights[i - 1]) : sum), 0);
  return { height: heights.reduce((a, b) => a + b, 0), holes, bumpiness, maxHeight: Math.max(...heights) };
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
    if (y < 0 || y >= H || p.x + cx < 0 || p.x + cx >= W) return false;
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
      if (!seen.has(key)) { seen.add(key); out.push(p); }
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
    const score = 0.76 * cleared - 0.51 * e.height - 0.36 * e.holes - 0.18 * e.bumpiness - 0.05 * e.maxHeight;
    return { p, score: score + (rng() - 0.5) * profile.noise };
  });
  scored.sort((a, b) => b.score - a.score);
  const pick = rng() < profile.blunder ? Math.min(scored.length - 1, Math.floor(rng() * 3)) : 0;
  return scored[pick].p;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/ai.test.mjs` → PASS。

- [ ] **Step 5: 提交**

```bash
git add js/ai.js test/ai.test.mjs
git commit -m "feat: add heuristic ai placement search"
```

---

### Task 5: 设置持久化与攻击表默认值

**Files:**
- Modify: `js/settings.js:1-40,139-158,239-247`

**Interfaces:**
- `DEFAULT_SETTINGS` 新增 `mode: 'marathon'`、`aiDifficulty: 'normal'`、`attackTable: ATTACK_PRESETS.guideline 的深拷贝`。
- `loadSettings()` 对缺失/损坏字段回退；`importSettings` 校验 `attackTable`。

- [ ] **Step 1: 改默认值与加载**

在 `settings.js` 顶部 `import { ATTACK_PRESETS, validateAttackTable } from './attack.js';`，默认值加入：

```js
mode: 'marathon',
aiDifficulty: 'normal',
attackTable: clone(ATTACK_PRESETS.guideline),
```

`loadSettings()` 在合并后加：

```js
if (!['marathon', 'sprint', 'blitz', 'vs'].includes(merged.mode)) merged.mode = 'marathon';
if (!['easy', 'normal', 'hard'].includes(merged.aiDifficulty)) merged.aiDifficulty = 'normal';
try {
  merged.attackTable = validateAttackTable(merged.attackTable);
} catch {
  merged.attackTable = clone(ATTACK_PRESETS.guideline);
}
```

`importSettings` 里：

```js
if (data.attackTable) next.attackTable = validateAttackTable(data.attackTable);
else next.attackTable = clone(ATTACK_PRESETS.guideline);
```

- [ ] **Step 2: 验证旧存档**

Run: `node -e "global.localStorage={getItem:()=>JSON.stringify({das:100})}; const s=await import('./js/settings.js'); console.log(s.loadSettings().mode, s.loadSettings().attackTable.name)"`（Node 里用 `--input-type=module`；或临时脚本）。

Expected: `marathon Guideline`。

- [ ] **Step 3: 提交**

```bash
git add js/settings.js
git commit -m "feat: persist mode, ai difficulty, and attack table"
```

---

### Task 6: 棋盘绘制复用与对手小棋盘

**Files:**
- Modify: `js/render.js:44-176`

**Interfaces:**
- `drawBoardInto(g, state, settings, system, cell, opts = {})`：在 `(0,0)` 起画，`opts.flash`、`opts.ghost`（默认跟随 settings）。
- `createRenderer(dom)` 新增 `createOpponentRenderer(canvas)`，`draw(state, settings, system, opts, opponent)`。

- [ ] **Step 1: 抽出 `drawBoardInto`**

把 `drawBoard` 主体改成接受 `cell` 与 `g`，垃圾格 `v === GARBAGE` 用 `#5b6472`；其余逻辑不变。`createRenderer` 内改为调用它。

- [ ] **Step 2: 对手绘制**

```js
export function createOpponentRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let cell = 13;
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = 130, h = 260;
    cell = Math.floor(w / W);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  return {
    resize,
    draw(state, settings, system, opts = {}) {
      if (!state) { ctx.clearRect(0, 0, W * cell, H * cell); return; }
      drawBoardInto(ctx, state, settings, system, cell, { ...opts, ghost: false });
    },
  };
}
```

`drawBoardInto` 内先 `clearRect` + 填 BG，再画网格/方块/当前块/闪白；可见行仍从 `HIDDEN` 开始。

- [ ] **Step 3: 手动验证**

Run: `python3 -m http.server 8123`，打开页面确认主棋盘绘制不变。

- [ ] **Step 4: 提交**

```bash
git add js/render.js
git commit -m "refactor: share board painting for opponent view"
```

---

### Task 7: 顶栏模式选择、HUD 与对手面板

**Files:**
- Modify: `index.html:11-60`
- Modify: `css/style.css`
- Modify: `js/main.js:25-45,236-282`（先接 DOM 引用与 HUD，不改战斗）

- [ ] **Step 1: HTML**

顶栏 controls 前加：

```html
<label class="pick">模式
  <select id="modeSelect">
    <option value="marathon">Marathon</option>
    <option value="sprint">Sprint 40L</option>
    <option value="blitz">Blitz 2:00</option>
    <option value="vs">VS AI</option>
  </select>
</label>
<label class="pick" id="aiWrap" hidden>AI
  <select id="aiSelect">
    <option value="easy">简单</option>
    <option value="normal">普通</option>
    <option value="hard">困难</option>
  </select>
</label>
```

左栏 stats 末尾加：

```html
<div id="attackRow" hidden><span>攻击</span><b id="attack">0</b></div>
<div id="incomingRow" hidden><span>待接收</span><b id="incoming">0</b></div>
```

右栏 NEXT 下方加：

```html
<section class="box vs" id="vsBox" hidden>
  <h2>AI <span id="aiLabel">普通</span></h2>
  <canvas id="opponent" aria-label="对手棋盘"></canvas>
  <div class="vs-stats">
    <div><span>AI 待接收</span><b id="oppIncoming">0</b></div>
    <div><span>AI 攻击</span><b id="oppSent">0</b></div>
  </div>
</section>
```

- [ ] **Step 2: CSS**

```css
.pick { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); }
.pick select { background: #121a26; color: var(--text); border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; font-size: 12px; }
.vs canvas { width: 130px; height: 260px; }
.vs-stats { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.vs-stats div { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }
.vs-stats b { color: var(--text); font-variant-numeric: tabular-nums; }
.vs h2 span { color: var(--accent); }
```

- [ ] **Step 3: DOM 引用与 HUD 适配**

`main.js` 的 `dom` 加 `modeSelect/aiSelect/aiWrap/attackRow/incomingRow/attack/incoming/vsBox/aiLabel/opponent/oppIncoming/oppSent`，并在状态区先声明 `let modeClock = 0;`（Task 8 继续使用）。

`updateHud()`：

```js
const isBlitz = settings.mode === 'blitz';
const remaining = isBlitz ? Math.max(0, 120000 - modeClock) : modeClock;
dom.time.textContent = formatClock(remaining);
dom.lines.textContent = settings.mode === 'sprint' ? `${Math.min(game.lines, 40)} / 40` : String(game.lines);
```

`refreshModeUi()` 设置 `aiWrap.hidden = settings.mode !== 'vs'`、`vsBox.hidden`、`attackRow.hidden`、`incomingRow.hidden`，并把下拉值同步为 settings。

- [ ] **Step 4: 手动验证**

页面能显示模式下拉，切到 VS 时对手面板出现（空棋盘即可），切回隐藏。

- [ ] **Step 5: 提交**

```bash
git add index.html css/style.css js/main.js
git commit -m "feat: add mode controls and opponent panel layout"
```

---

### Task 8: 主循环接入模式时钟、对战与 AI

**Files:**
- Modify: `js/main.js`

**Interfaces:**
- 消费 Task 1–5 的 `computeAttack`、`insertGarbage`、`checkOutcome`、`gravityFor`、`AI_PROFILES`、`choosePlacement`、`spawnNext`、`ghostY`。

- [ ] **Step 1: 状态**

```js
let modeClock = 0;
let finished = false;
let opponent = null;
let aiTimer = 0;
let playerIncoming = 0;
let playerSent = 0;
let oppIncoming = 0;
let oppSent = 0;
const oppRenderer = createOpponentRenderer(dom.opponent);
```

`start()` 重置全部，VS 时 `opponent = createGame(); resetGame(opponent);`。

- [ ] **Step 2: 攻击结算**

```js
function resolveSide(side, other, info) {
  const attack = info ? computeAttack(info, settings.attackTable) : 0;
  const before = side.incoming;
  const cancelled = Math.min(before, attack);
  side.incoming = before - cancelled;
  const send = attack - cancelled;
  if (send > 0) { other.incoming += send; side.sent += send; }
  if (side.incoming > 0) {
    insertGarbage(side.game, side.incoming, Math.random);
    side.incoming = 0;
  }
}
```

`handleLock(info)`：闪白；若 `settings.mode === 'vs'` 调 `resolveSide(playerSide, aiSide, info)`，并检查双方 `status === 'over'`。

AI 落子：

```js
function aiMove(STEP) {
  if (!opponent || opponent.status === 'over') return;
  if (opponent.status === 'spawning') spawnNext(opponent, system, settings);
  if (opponent.status !== 'playing' || !opponent.current) return;
  const p = choosePlacement(opponent.board, system, opponent.current.type, AI_PROFILES[settings.aiDifficulty]);
  if (!p) { opponent.status = 'over'; return; }
  opponent.current.r = p.r;
  opponent.current.x = p.x;
  opponent.current.y = p.y;
  const info = lockPiece(opponent, system, settings);
  resolveSide(aiSide, playerSide, info);
}
```

- [ ] **Step 3: 每逻辑步**

```js
modeClock += STEP;
const stepSettings = settings.mode === 'blitz'
  ? { ...settings, gravity: gravityFor('blitz', game.level, settings.gravity) }
  : settings;
// 现有 tick/step 用 stepSettings
if (settings.mode === 'vs') {
  aiTimer += STEP;
  const profile = AI_PROFILES[settings.aiDifficulty];
  if (aiTimer >= profile.interval) { aiTimer = 0; aiMove(); }
}
const outcome = checkOutcome(settings.mode, { lines: game.lines, over: game.status === 'over' },
  { over: opponent?.status === 'over' }, modeClock);
if (outcome) finishGame(outcome);
```

`finishGame(outcome)`：只执行一次，`running = false`，按模式/胜负显示 overlay；Sprint 显示 `用时 ${formatClock(outcome.time)}`，Blitz 显示分数，VS 显示胜负与双方消行。删除 `frame()` 里现有的「顶死后直接 `showOverlay('游戏结束'...)`」分支，统一交给 `checkOutcome`。

- [ ] **Step 4: 模式切换与绘制**

```js
dom.modeSelect.addEventListener('change', () => {
  settings.mode = dom.modeSelect.value;
  saveSettings(settings);
  refreshModeUi();
  start();
});
dom.aiSelect.addEventListener('change', () => {
  settings.aiDifficulty = dom.aiSelect.value;
  saveSettings(settings);
  start();
});
```

`renderer.draw(game, settings, system, { flash }, opponent)`；`oppRenderer.draw(opponent, settings, system)`。resize 时同步 `oppRenderer.resize()`。

- [ ] **Step 5: 手动验证**

- Marathon 行为不变。
- Sprint 计时增长，40 行后结算。
- Blitz 显示倒计时，时间到结算。
- VS 对手会落子；玩家消行后 AI 待接收增加；AI 顶死玩家胜。

- [ ] **Step 6: 提交**

```bash
git add js/main.js
git commit -m "feat: wire modes, battle garbage, and ai opponent"
```

---

### Task 9: 攻击表图形编辑器

**Files:**
- Create: `js/attack-editor.js`
- Modify: `js/ui.js`（设置面板新增区块与按钮）
- Modify: `js/main.js`（创建编辑器并传入回调）
- Modify: `css/style.css`（复用 modal，补少量字段布局）

- [ ] **Step 1: 编辑器结构**

复用 `.modal` 样式，字段：

```js
const BASE_FIELDS = [
  ['single', '单消'], ['double', '双消'], ['triple', '三消'], ['tetris', 'Tetris'],
  ['tspinMini', 'T-Spin Mini'], ['tspinSingle', 'T-Spin 单'], ['tspinDouble', 'T-Spin 双'], ['tspinTriple', 'T-Spin 三'],
  ['perfectClear', 'Perfect Clear'],
];
```

- 9 个 `input[type=number][min=0][max=20]`
- B2B 一个数字输入
- combo 列表：逐项数字输入 + 删除 + `+ 添加`（至少保留 1 项）
- 预设按钮：Guideline / 高攻击 / 低攻击
- 导入 JSON / 导出 JSON / 取消 / 应用
- 应用：`validateAttackTable(model)` → `settings.attackTable = table; saveSettings; onApply(); close();`
- 导入：`JSON.parse(await file.text())` → validate → 载入模型；失败 toast
- 导出：validate 后下载 `attack-table.json`

- [ ] **Step 2: 设置面板入口**

`ui.js` 新增：

```html
<section class="pgroup">
  <h3>攻击表</h3>
  <p class="muted">消行攻击、T-Spin、combo、B2B 与 Perfect Clear；支持导入/导出 JSON 文件。</p>
  <button class="btn small" data-edit-attack>打开编辑器</button>
</section>
```

`opts.onEditAttack` 绑定按钮。

- [ ] **Step 3: main 接线**

```js
const attackEditor = createAttackEditor({
  settings,
  onApply() { panelUi.render(); },
});
// buildPanel opts 加 onEditAttack: () => attackEditor.open()
```

- [ ] **Step 4: 手动验证**

改 Tetris 攻击为 8 → 对战中一次 Tetris 应发 8 行（减去 incoming）；导出再导入值一致；界面上没有 JSON 文本框。

- [ ] **Step 5: 提交**

```bash
git add js/attack-editor.js js/ui.js js/main.js css/style.css
git commit -m "feat: add graphical attack table editor"
```

---

### Task 10: 文档、全量验证与部署

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-10-17-tetris-modes-battle-design.md`（状态改「已实现」）

- [ ] **Step 1: README**

新增「游戏模式」「人机对战」「攻击表」三节：模式规则、三档 AI、垃圾行抵消顺序、攻击表字段与导入导出。

- [ ] **Step 2: AGENTS.md**

架构段补 `attack.js / modes.js / ai.js / attack-editor.js`；已知取舍补 AI 单层、垃圾行随机洞、Blitz 曲线固定。

- [ ] **Step 3: 全量测试**

Run: `npm test` → 全部通过（旧 9 项 + 新增攻击/垃圾/模式/AI）。

- [ ] **Step 4: 无头浏览器验证**

用 CDP 脚本（临时目录）验证：四个模式可切换；Sprint 完成结算；Blitz 倒计时；VS 对手落子与攻击数字；攻击表编辑器应用/导出/导入；控制台无报错。

- [ ] **Step 5: 提交并推送**

```bash
git add README.md AGENTS.md docs/superpowers/specs/2026-10-17-tetris-modes-battle-design.md
git commit -m "docs: document modes, battle, and attack table"
git push
```

部署成功后访问 https://heng-mei.github.io/tetris/ 确认新版本。
