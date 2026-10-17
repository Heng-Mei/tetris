import { PIECE_IDS, SYSTEMS, SRS } from './rotations.js';

export const STORAGE_KEY = 'tetris.settings.v1';

export const DEFAULT_BINDINGS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  softDrop: 'ArrowDown',
  hardDrop: 'Space',
  rotateCW: 'ArrowUp',
  rotateCCW: 'KeyZ',
  rotate180: 'KeyA',
  hold: 'KeyC',
  pause: 'Escape',
  restart: 'KeyR',
};

export const DEFAULT_SETTINGS = {
  das: 130,
  arr: 30,
  sdf: 20,
  gravity: 1,
  lockDelay: 500,
  maxLockResets: 15,
  are: 0,
  lineClearDelay: 0,
  resetOnMove: true,
  resetOnRotate: true,
  cancelDasOnRotate: false,
  lastPriority: true,
  irs: false,
  ihs: false,
  ghost: true,
  grid: true,
  rotationSystem: 'srs',
  rot180: 'two',
  customRotation: null,
  bindings: { ...DEFAULT_BINDINGS },
};

export const PRESETS = {
  modern: {
    label: 'Modern（SRS）',
    values: {
      das: 130, arr: 30, sdf: 20, gravity: 1, lockDelay: 500, maxLockResets: 15,
      are: 0, lineClearDelay: 0, resetOnMove: true, resetOnRotate: true,
      cancelDasOnRotate: false, lastPriority: true, irs: false, ihs: false,
      rotationSystem: 'srs', rot180: 'two', ghost: true, grid: true,
    },
  },
  tgm: {
    label: 'TGM（ARS）',
    values: {
      das: 106, arr: 33, sdf: 20, gravity: 1, lockDelay: 500, maxLockResets: 0,
      are: 200, lineClearDelay: 0, resetOnMove: false, resetOnRotate: false,
      cancelDasOnRotate: false, lastPriority: true, irs: true, ihs: true,
      rotationSystem: 'ars', rot180: 'off', ghost: true, grid: true,
    },
  },
  classic: {
    label: 'Classic（无踢墙）',
    values: {
      das: 267, arr: 1000, sdf: 20, gravity: 1, lockDelay: 0, maxLockResets: 0,
      are: 0, lineClearDelay: 0, resetOnMove: false, resetOnRotate: false,
      cancelDasOnRotate: false, lastPriority: true, irs: false, ihs: false,
      rotationSystem: 'classic', rot180: 'off', ghost: false, grid: true,
    },
  },
};

export const PARAM_GROUPS = [
  {
    title: '手感',
    params: [
      { key: 'das', label: 'DAS 延迟', min: 0, max: 300, step: 1, unit: 'ms', hint: '按住方向键后，开始连续移动前的等待' },
      { key: 'arr', label: 'ARR 间隔', min: 0, max: 1000, step: 10, unit: 'ms', hint: '连续移动间隔；0 = 瞬间贴墙' },
      { key: 'sdf', label: 'SDF 软降倍率', min: 1, max: 40, step: 1, unit: '×', hint: '软降速度 = 重力 × 倍数' },
      { key: 'gravity', label: '重力', min: 0, max: 40, step: 0.1, unit: '行/秒', hint: '0 = 不下落' },
      { key: 'lockDelay', label: '锁定延迟', min: 0, max: 1000, step: 10, unit: 'ms', hint: '触底后到锁定的时间' },
      { key: 'maxLockResets', label: '最大锁定重置', min: 0, max: 30, step: 1, unit: '次', hint: '移动/旋转可重置锁定延迟的次数' },
      { key: 'are', label: 'ARE 出生延迟', min: 0, max: 1000, step: 10, unit: 'ms', hint: '锁定到下一个方块出现' },
      { key: 'lineClearDelay', label: '消行延迟', min: 0, max: 1000, step: 10, unit: 'ms', hint: '消行到下一个方块出现' },
    ],
  },
  {
    title: '规则开关',
    params: [
      { key: 'resetOnMove', label: '移动重置锁定', type: 'check' },
      { key: 'resetOnRotate', label: '旋转重置锁定', type: 'check' },
      { key: 'cancelDasOnRotate', label: '旋转取消 DAS 蓄力', type: 'check' },
      { key: 'lastPriority', label: '双向键后按优先', type: 'check' },
      { key: 'irs', label: 'IRS：出生前旋转', type: 'check' },
      { key: 'ihs', label: 'IHS：出生前 Hold', type: 'check' },
      { key: 'ghost', label: '显示幽灵块', type: 'check' },
      { key: 'grid', label: '显示网格', type: 'check' },
    ],
  },
  {
    title: '旋转系统',
    params: [
      {
        key: 'rotationSystem',
        label: '旋转系统',
        type: 'select',
        options: [
          ['srs', 'SRS'],
          ['ars', 'ARS（右偏踢墙）'],
          ['classic', 'Classic（无踢墙）'],
          ['custom', 'Custom（自定义 JSON）'],
        ],
      },
      {
        key: 'rot180',
        label: '180° 旋转',
        type: 'select',
        options: [['off', '关闭'], ['two', '两步旋转'], ['table', '180° 踢墙表']],
      },
    ],
  },
];

export const ACTION_LABELS = {
  left: '左移',
  right: '右移',
  softDrop: '软降',
  hardDrop: '硬降',
  rotateCW: '顺时针',
  rotateCCW: '逆时针',
  rotate180: '180°',
  hold: 'Hold',
  pause: '暂停',
  restart: '重开',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadSettings() {
  const base = clone(DEFAULT_SETTINGS);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    const merged = { ...base, ...saved, bindings: { ...base.bindings, ...(saved.bindings || {}) } };
    return merged;
  } catch {
    return base;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* 隐私模式下忽略 */
  }
}

export function applyPreset(settings, name) {
  const preset = PRESETS[name];
  if (!preset) return settings;
  Object.assign(settings, preset.values);
  return settings;
}

export function validateCustomRotation(input) {
  if (!input || typeof input !== 'object') throw new Error('自定义旋转系统必须是 JSON 对象');
  if (!input.shapes || typeof input.shapes !== 'object') throw new Error('缺少 shapes');
  const shapes = {};
  for (const id of PIECE_IDS) {
    const states = input.shapes[id];
    if (!Array.isArray(states) || states.length !== 4) throw new Error(`shapes.${id} 需要 4 个旋转状态`);
    shapes[id] = states.map((state, i) => {
      if (!Array.isArray(state) || state.length === 0) throw new Error(`shapes.${id}[${i}] 不能为空`);
      return state.map((cell) => {
        if (!Array.isArray(cell) || cell.length !== 2 || !cell.every(Number.isFinite)) {
          throw new Error(`shapes.${id}[${i}] 的格子必须是 [x, y]`);
        }
        return [Math.round(cell[0]), Math.round(cell[1])];
      });
    });
  }

  const spawn = {};
  for (const id of PIECE_IDS) {
    const s = input.spawn && input.spawn[id];
    spawn[id] = Array.isArray(s) && s.length === 2 && s.every(Number.isFinite) ? [Math.round(s[0]), Math.round(s[1])] : [3, 2];
  }

  const kicks = input.kicks && typeof input.kicks === 'object' ? input.kicks : { standard: { '*': [[0, 0]] } };
  return { id: 'custom', name: input.name || 'Custom', shapes, spawn, kicks: normalizeKicks(kicks) };
}

function isOffset(value) {
  return Array.isArray(value) && value.length === 2 && value.every((n) => Number.isFinite(n) && Math.abs(n) <= 3);
}

function normalizeKickTable(table) {
  if (!table || typeof table !== 'object') return null;
  const out = {};
  for (const [key, offsets] of Object.entries(table)) {
    if (!Array.isArray(offsets)) continue;
    const list = offsets.filter(isOffset).map(([x, y]) => [Math.round(x), Math.round(y)]);
    if (list.length) out[key] = list;
  }
  return Object.keys(out).length ? out : null;
}

function normalizeKicks(kicks) {
  const standard = normalizeKickTable(kicks.standard) || { '*': [[0, 0]] };
  const I = normalizeKickTable(kicks.I);
  const half = Array.isArray(kicks.half) ? kicks.half.filter(isOffset) : null;
  return { standard, ...(I ? { I } : {}), ...(half && half.length ? { half } : {}) };
}

export function getSystem(settings) {
  if (settings.rotationSystem === 'custom') {
    try {
      return validateCustomRotation(settings.customRotation);
    } catch {
      return SRS;
    }
  }
  return SYSTEMS[settings.rotationSystem] || SRS;
}

export function exportSettings(settings) {
  const data = JSON.stringify(settings, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tetris-settings.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importSettings(settings, text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('不是有效的设置文件');
  const next = { ...settings, ...data, bindings: { ...DEFAULT_BINDINGS, ...(data.bindings || {}) } };
  if (next.rotationSystem === 'custom' && next.customRotation) validateCustomRotation(next.customRotation);
  Object.assign(settings, next);
  saveSettings(settings);
  return settings;
}
