const FIELDS = [
  'single',
  'double',
  'triple',
  'tetris',
  'tspinMini',
  'tspinSingle',
  'tspinDouble',
  'tspinTriple',
  'perfectClear',
];

export const ATTACK_PRESETS = {
  guideline: {
    name: 'Guideline',
    base: {
      single: 0,
      double: 1,
      triple: 2,
      tetris: 4,
      tspinMini: 1,
      tspinSingle: 2,
      tspinDouble: 4,
      tspinTriple: 6,
      perfectClear: 10,
    },
    b2b: 1,
    combo: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4],
  },
  high: {
    name: '高攻击',
    base: {
      single: 1,
      double: 2,
      triple: 4,
      tetris: 8,
      tspinMini: 2,
      tspinSingle: 4,
      tspinDouble: 8,
      tspinTriple: 12,
      perfectClear: 12,
    },
    b2b: 2,
    combo: [0, 1, 1, 2, 3, 3, 4, 5, 6, 7, 8],
  },
  low: {
    name: '低攻击',
    base: {
      single: 0,
      double: 0,
      triple: 1,
      tetris: 2,
      tspinMini: 0,
      tspinSingle: 1,
      tspinDouble: 2,
      tspinTriple: 3,
      perfectClear: 4,
    },
    b2b: 1,
    combo: [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3],
  },
};

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

export function validateAttackTable(input) {
  if (!input || typeof input !== 'object') throw new Error('攻击表必须是 JSON 对象');
  const base = input.base && typeof input.base === 'object' ? input.base : {};
  const out = {
    name:
      typeof input.name === 'string' && input.name.trim()
        ? input.name.trim().slice(0, 32)
        : 'Custom',
    base: {},
    b2b: clampInt(input.b2b, 0, 20, 1),
    combo: [],
  };
  for (const field of FIELDS) {
    out.base[field] = clampInt(base[field], 0, 20, ATTACK_PRESETS.guideline.base[field]);
  }
  const combo = Array.isArray(input.combo) ? input.combo.slice(0, 20) : [];
  out.combo = combo.length ? combo.map((v) => clampInt(v, 0, 20, 0)) : [0];
  return out;
}

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function computeAttack(info, table) {
  const lines = Math.max(0, Math.floor(toFinite(info?.lines)));
  if (!lines) return 0;
  const t = table || ATTACK_PRESETS.guideline;
  const base = t.base || {};
  const field = (key) => toFinite(base[key]);
  let value;
  if (info.tspin) {
    value = info.tspin.mini
      ? lines >= 2
        ? field('tspinDouble')
        : field('tspinMini')
      : [0, field('tspinSingle'), field('tspinDouble'), field('tspinTriple')][Math.min(lines, 3)];
  } else {
    value = [0, field('single'), field('double'), field('triple'), field('tetris')][Math.min(lines, 4)];
  }
  const difficult = lines === 4 || !!info.tspin;
  if (difficult && info.b2bActive) value += toFinite(t.b2b);
  const combo = Array.isArray(t.combo) && t.combo.length ? t.combo : [0];
  const comboIndex = Math.min(Math.max(0, Math.floor(toFinite(info.combo))), combo.length - 1);
  value += toFinite(combo[comboIndex]);
  if (info.perfect) value += field('perfectClear');
  return Math.max(0, Math.round(toFinite(value)));
}
