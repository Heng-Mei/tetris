import {
  ACTION_LABELS,
  PARAM_GROUPS,
  PRESETS,
  applyPreset,
  exportSettings,
  importSettings,
  saveSettings,
} from './settings.js';
import { keyLabel } from './input.js';

export function buildPanel(root, opts) {
  const { settings, input, onChange, onClose, onSystemDirty, onEditRotation } = opts;

  function toast(message, ok = false) {
    const node = root.querySelector('.toast');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('ok', ok);
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 2600);
  }

  function numericRow(p) {
    return `
      <label class="row">
        <span class="row-label">${p.label}${p.hint ? `<em>${p.hint}</em>` : ''}</span>
        <span class="row-control">
          <input type="range" data-key="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${settings[p.key]}">
          <output data-out="${p.key}">${settings[p.key]}${p.unit || ''}</output>
        </span>
      </label>`;
  }

  function checkRow(p) {
    return `
      <label class="row check">
        <span class="row-label">${p.label}</span>
        <input type="checkbox" data-key="${p.key}" ${settings[p.key] ? 'checked' : ''}>
      </label>`;
  }

  function selectRow(p) {
    return `
      <label class="row">
        <span class="row-label">${p.label}</span>
        <select data-key="${p.key}">
          ${p.options.map(([v, t]) => `<option value="${v}" ${settings[p.key] === v ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>`;
  }

  function render() {
    root.innerHTML = `
      <div class="panel-head">
        <h2>设置</h2>
        <button class="icon-btn" data-close aria-label="关闭">×</button>
      </div>
      <div class="panel-scroll">
        <section class="pgroup">
          <h3>预设</h3>
          <div class="preset-row">
            ${Object.entries(PRESETS).map(([id, p]) => `<button class="chip" data-preset="${id}">${p.label}</button>`).join('')}
          </div>
        </section>

        ${PARAM_GROUPS.map((group) => `
          <section class="pgroup">
            <h3>${group.title}</h3>
            ${group.params.map((p) => (p.type === 'check' ? checkRow(p) : p.type === 'select' ? selectRow(p) : numericRow(p))).join('')}
          </section>`).join('')}

        <section class="pgroup">
          <h3>自定义旋转系统</h3>
          <p class="muted">图形化编辑 7 个方块的 4 个旋转状态、出生位置与踢墙表；导入/导出为 JSON 文件。</p>
          <button class="btn small" data-edit-rotation>打开编辑器</button>
        </section>

        <section class="pgroup">
          <h3>键位</h3>
          ${Object.keys(ACTION_LABELS).map((action) => `
            <div class="row">
              <span class="row-label">${ACTION_LABELS[action]}</span>
              <button class="key-btn" data-bind="${action}">${keyLabel(settings.bindings[action])}</button>
            </div>`).join('')}
        </section>

        <section class="pgroup">
          <h3>数据</h3>
          <div class="preset-row">
            <button class="btn small" data-export>导出设置</button>
            <button class="btn small" data-import>导入设置</button>
            <button class="btn small ghost" data-reset>恢复默认</button>
          </div>
          <input type="file" accept="application/json,.json" data-file hidden>
        </section>
      </div>
      <div class="toast"></div>`;

    root.querySelector('[data-close]').addEventListener('click', onClose);

    root.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyPreset(settings, btn.dataset.preset);
        saveSettings(settings);
        onSystemDirty();
        render();
        toast('已应用预设', true);
      });
    });

    root.querySelectorAll('input[type="range"]').forEach((slider) => {
      slider.addEventListener('input', () => {
        const key = slider.dataset.key;
        const value = Number(slider.value);
        settings[key] = value;
        const out = root.querySelector(`[data-out="${key}"]`);
        const param = PARAM_GROUPS.flatMap((g) => g.params).find((p) => p.key === key);
        if (out) out.textContent = `${value}${param?.unit || ''}`;
        onChange(key, value);
      });
    });

    root.querySelectorAll('input[type="checkbox"][data-key]').forEach((box) => {
      box.addEventListener('change', () => {
        settings[box.dataset.key] = box.checked;
        onChange(box.dataset.key, box.checked);
      });
    });

    root.querySelectorAll('select[data-key]').forEach((sel) => {
      sel.addEventListener('change', () => {
        settings[sel.dataset.key] = sel.value;
        onChange(sel.dataset.key, sel.value);
        if (sel.dataset.key === 'rotationSystem') render();
      });
    });

    root.querySelectorAll('[data-bind]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.bind;
        btn.textContent = '按键中…';
        btn.classList.add('waiting');
        input.beginRebind(action, (code) => {
          btn.classList.remove('waiting');
          if (code) {
            saveSettings(settings);
            btn.textContent = keyLabel(code);
          } else {
            btn.textContent = keyLabel(settings.bindings[action]);
          }
        });
      });
    });

    root.querySelector('[data-edit-rotation]').addEventListener('click', () => onEditRotation());

    root.querySelector('[data-export]').addEventListener('click', () => exportSettings(settings));

    const fileInput = root.querySelector('[data-file]');
    root.querySelector('[data-import]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        importSettings(settings, await file.text());
        onSystemDirty();
        render();
        toast('设置已导入', true);
      } catch (err) {
        toast(err.message || '导入失败');
      }
    });

    root.querySelector('[data-reset]').addEventListener('click', () => {
      Object.assign(settings, JSON.parse(JSON.stringify(PRESETS.modern.values)));
      settings.bindings = { ...opts.defaultBindings };
      settings.customRotation = null;
      saveSettings(settings);
      onSystemDirty();
      render();
      toast('已恢复默认', true);
    });
  }

  render();
  return { render };
}
