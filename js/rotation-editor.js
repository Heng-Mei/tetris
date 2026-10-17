import { COLORS, PIECE_IDS, SYSTEMS } from './rotations.js';
import { getSystem, saveSettings, validateCustomRotation } from './settings.js';

const TRANSITIONS = ['0>1', '1>0', '1>2', '2>1', '2>3', '3>2', '3>0', '0>3'];
const ROT_LABELS = ['0°', '90°', '180°', '270°'];
const GRID = 4;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expandTable(table, fallback) {
  const out = {};
  for (const t of TRANSITIONS) out[t] = clone(table?.[t] || table?.['*'] || fallback || [[0, 0]]);
  return out;
}

function toEditorModel(system) {
  return {
    name: system.name || 'Custom',
    shapes: clone(system.shapes),
    spawn: clone(system.spawn),
    standard: expandTable(system.kicks?.standard),
    I: expandTable(system.kicks?.I || system.kicks?.standard),
    half: clone(system.kicks?.half || [[0, 0]]),
  };
}

function element(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function createRotationEditor({ settings, onApply }) {
  const root = element(`
    <div class="modal" hidden>
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="自定义旋转系统">
        <header class="modal-head">
          <h2>自定义旋转系统</h2>
          <button class="icon-btn" data-close aria-label="关闭">×</button>
        </header>
        <div class="modal-body">
          <label class="row">
            <span class="row-label">名称</span>
            <input class="text-input" data-name maxlength="32" spellcheck="false">
          </label>
          <div class="row">
            <span class="row-label">以现有系统为模板<em>会覆盖当前图形与踢墙表</em></span>
            <span class="preset-row">
              ${Object.entries(SYSTEMS).map(([id, sys]) => `<button class="chip" data-base="${id}">${sys.name}</button>`).join('')}
            </span>
          </div>

          <h3 class="modal-title">形状</h3>
          <div class="seg" data-pieces></div>
          <div class="seg" data-rots></div>
          <div class="shape-editor">
            <div class="shape-grid" data-grid></div>
            <div class="shape-meta">
              <span class="muted">点击格子切换</span>
              <label class="row tight">
                <span class="row-label">出生 X</span>
                <input class="num-input" type="number" min="0" max="9" step="1" data-spawn-x>
              </label>
              <label class="row tight">
                <span class="row-label">出生 Y</span>
                <input class="num-input" type="number" min="0" max="21" step="1" data-spawn-y>
              </label>
            </div>
          </div>

          <h3 class="modal-title">踢墙表</h3>
          <div class="seg" data-tables>
            <button class="seg-btn" data-table="standard">通用</button>
            <button class="seg-btn" data-table="I">I 块</button>
            <button class="seg-btn" data-table="half">180°</button>
          </div>
          <div class="row tight" data-transition-row>
            <span class="row-label nowrap">旋转方向</span>
            <select data-transition>
              ${TRANSITIONS.map((t) => `<option value="${t}">${t.replace('>', ' → ')}</option>`).join('')}
            </select>
          </div>
          <p class="muted small">按顺序尝试，第一个不碰撞的偏移生效。180° 表是所有起止状态共用。</p>
          <div class="kick-list" data-kicks></div>
          <button class="btn small" data-add-kick>+ 添加偏移</button>
        </div>
        <footer class="modal-foot">
          <button class="btn small" data-import>导入 JSON</button>
          <button class="btn small" data-export>导出 JSON</button>
          <span class="spacer"></span>
          <button class="btn small ghost" data-cancel>取消</button>
          <button class="btn small primary" data-apply>应用</button>
        </footer>
        <div class="toast" data-toast></div>
        <input type="file" accept="application/json,.json" data-file hidden>
      </div>
    </div>`);

  document.body.append(root);

  const refs = {
    name: root.querySelector('[data-name]'),
    pieces: root.querySelector('[data-pieces]'),
    rots: root.querySelector('[data-rots]'),
    grid: root.querySelector('[data-grid]'),
    spawnX: root.querySelector('[data-spawn-x]'),
    spawnY: root.querySelector('[data-spawn-y]'),
    tables: root.querySelector('[data-tables]'),
    transitionRow: root.querySelector('[data-transition-row]'),
    transition: root.querySelector('[data-transition]'),
    kicks: root.querySelector('[data-kicks]'),
    toast: root.querySelector('[data-toast]'),
    file: root.querySelector('[data-file]'),
  };

  let model = null;
  let piece = 'T';
  let rot = 0;
  let table = 'standard';
  let transition = '0>1';

  function toast(message, ok = false) {
    refs.toast.textContent = message;
    refs.toast.classList.toggle('ok', ok);
    refs.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => refs.toast.classList.remove('show'), 2400);
  }

  function buildSystem() {
    return {
      name: model.name.trim() || 'Custom',
      shapes: clone(model.shapes),
      spawn: clone(model.spawn),
      kicks: { standard: clone(model.standard), I: clone(model.I), half: clone(model.half) },
    };
  }

  function currentOffsets() {
    if (table === 'half') return model.half;
    return model[table][transition];
  }

  function renderSegments() {
    refs.pieces.innerHTML = PIECE_IDS
      .map((id) => `<button class="seg-btn" data-piece="${id}" style="--piece:${COLORS[id]}">${id}</button>`)
      .join('');
    refs.pieces.querySelectorAll('[data-piece]').forEach((btn) => {
      btn.classList.toggle('on', btn.dataset.piece === piece);
      btn.addEventListener('click', () => {
        piece = btn.dataset.piece;
        render();
      });
    });

    refs.rots.innerHTML = ROT_LABELS
      .map((label, i) => `<button class="seg-btn" data-rot="${i}">${label}</button>`)
      .join('');
    refs.rots.querySelectorAll('[data-rot]').forEach((btn) => {
      btn.classList.toggle('on', Number(btn.dataset.rot) === rot);
      btn.addEventListener('click', () => {
        rot = Number(btn.dataset.rot);
        render();
      });
    });

    refs.tables.querySelectorAll('[data-table]').forEach((btn) => {
      btn.classList.toggle('on', btn.dataset.table === table);
    });
    refs.transitionRow.hidden = table === 'half';
  }

  function renderGrid() {
    const cells = model.shapes[piece][rot];
    refs.grid.style.setProperty('--piece', COLORS[piece]);
    let html = '';
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const on = cells.some(([cx, cy]) => cx === x && cy === y);
        html += `<button class="shape-cell ${on ? 'on' : ''}" data-x="${x}" data-y="${y}" aria-label="${x},${y}"></button>`;
      }
    }
    refs.grid.innerHTML = html;
    refs.grid.querySelectorAll('.shape-cell').forEach((cell) => {
      cell.addEventListener('click', () => {
        const x = Number(cell.dataset.x);
        const y = Number(cell.dataset.y);
        const state = model.shapes[piece][rot];
        const i = state.findIndex(([cx, cy]) => cx === x && cy === y);
        if (i >= 0) {
          if (state.length === 1) {
            toast('每个旋转状态至少保留一个格子');
            return;
          }
          state.splice(i, 1);
        } else {
          state.push([x, y]);
        }
        renderGrid();
      });
    });

    refs.spawnX.value = model.spawn[piece][0];
    refs.spawnY.value = model.spawn[piece][1];
  }

  function renderKicks() {
    const offsets = currentOffsets();
    refs.kicks.innerHTML = offsets
      .map(([x, y], i) => `
        <div class="kick-row" data-i="${i}">
          <span class="muted">#${i + 1}</span>
          <input class="num-input" type="number" min="-3" max="3" step="1" data-dx value="${x}">
          <input class="num-input" type="number" min="-3" max="3" step="1" data-dy value="${y}">
          <button class="icon-btn" data-remove aria-label="删除">×</button>
        </div>`)
      .join('');
    refs.kicks.querySelectorAll('.kick-row').forEach((row, i) => {
      row.querySelector('[data-dx]').addEventListener('input', (e) => {
        offsets[i][0] = clamp(Number(e.target.value), -3, 3);
      });
      row.querySelector('[data-dy]').addEventListener('input', (e) => {
        offsets[i][1] = clamp(Number(e.target.value), -3, 3);
      });
      row.querySelector('[data-remove]').addEventListener('click', () => {
        if (offsets.length === 1) {
          toast('至少保留一个偏移');
          return;
        }
        offsets.splice(i, 1);
        renderKicks();
      });
    });
  }

  function render() {
    refs.name.value = model.name;
    renderSegments();
    renderGrid();
    renderKicks();
  }

  function loadSystem(system) {
    model = toEditorModel(system);
    piece = 'T';
    rot = 0;
    table = 'standard';
    transition = '0>1';
    refs.transition.value = transition;
    render();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    document.removeEventListener('keydown', onEsc, true);
  }

  function onEsc(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }

  function open() {
    const base = settings.rotationSystem === 'custom' && settings.customRotation
      ? (() => {
          try {
            return validateCustomRotation(settings.customRotation);
          } catch {
            return SYSTEMS.srs;
          }
        })()
      : getSystem(settings);
    loadSystem(base);
    root.hidden = false;
    document.addEventListener('keydown', onEsc, true);
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  refs.name.addEventListener('input', () => {
    model.name = refs.name.value;
  });

  refs.spawnX.addEventListener('change', () => {
    model.spawn[piece][0] = clamp(Number(refs.spawnX.value), 0, 9);
    refs.spawnX.value = model.spawn[piece][0];
  });
  refs.spawnY.addEventListener('change', () => {
    model.spawn[piece][1] = clamp(Number(refs.spawnY.value), 0, 21);
    refs.spawnY.value = model.spawn[piece][1];
  });

  refs.tables.querySelectorAll('[data-table]').forEach((btn) => {
    btn.addEventListener('click', () => {
      table = btn.dataset.table;
      render();
    });
  });

  refs.transition.addEventListener('change', () => {
    transition = refs.transition.value;
    renderKicks();
  });

  root.querySelector('[data-add-kick]').addEventListener('click', () => {
    currentOffsets().push([0, 0]);
    renderKicks();
  });

  root.querySelectorAll('[data-base]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const system = SYSTEMS[btn.dataset.base];
      const name = model.name;
      loadSystem(system);
      model.name = name;
      refs.name.value = name;
      toast(`已载入 ${system.name}`, true);
    });
  });

  root.querySelector('[data-close]').addEventListener('click', close);
  root.querySelector('[data-cancel]').addEventListener('click', close);
  root.addEventListener('mousedown', (e) => {
    if (e.target === root) close();
  });

  root.querySelector('[data-apply]').addEventListener('click', () => {
    try {
      const system = validateCustomRotation(buildSystem());
      settings.customRotation = system;
      settings.rotationSystem = 'custom';
      saveSettings(settings);
      close();
      onApply();
    } catch (err) {
      toast(err.message || '配置无效');
    }
  });

  root.querySelector('[data-export]').addEventListener('click', () => {
    try {
      const system = validateCustomRotation(buildSystem());
      const blob = new Blob([JSON.stringify(system, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rotation-system.json';
      a.click();
      URL.revokeObjectURL(url);
      toast('已导出 JSON', true);
    } catch (err) {
      toast(err.message || '导出失败');
    }
  });

  root.querySelector('[data-import]').addEventListener('click', () => refs.file.click());
  refs.file.addEventListener('change', async () => {
    const file = refs.file.files?.[0];
    refs.file.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const system = validateCustomRotation(parsed);
      loadSystem(system);
      toast('已导入 JSON', true);
    } catch (err) {
      toast(err.message || '导入失败');
    }
  });

  return { open, close };
}
