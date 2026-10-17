import { ATTACK_PRESETS, validateAttackTable } from './attack.js';
import { saveSettings } from './settings.js';

const BASE_FIELDS = [
  ['single', '单消'],
  ['double', '双消'],
  ['triple', '三消'],
  ['tetris', 'Tetris'],
  ['tspinMini', 'T-Spin Mini'],
  ['tspinSingle', 'T-Spin 单'],
  ['tspinDouble', 'T-Spin 双'],
  ['tspinTriple', 'T-Spin 三'],
  ['perfectClear', 'Perfect Clear'],
];

const clone = (value) => JSON.parse(JSON.stringify(value));

function element(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function createAttackEditor({ settings, onApply }) {
  const root = element(`
    <div class="modal attack-modal" hidden>
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="自定义攻击表">
        <header class="modal-head">
          <h2>攻击表</h2>
          <button class="icon-btn" data-close aria-label="关闭">×</button>
        </header>
        <div class="modal-body">
          <label class="row">
            <span class="row-label">名称</span>
            <input class="text-input" data-name maxlength="32" spellcheck="false">
          </label>
          <div class="preset-row">
            ${Object.entries(ATTACK_PRESETS).map(([id, p]) => `<button class="chip" data-preset="${id}">${p.name}</button>`).join('')}
          </div>

          <h3 class="modal-title">基础攻击</h3>
          <div class="attack-grid">
            ${BASE_FIELDS.map(([key, label]) => `
              <label class="row tight">
                <span class="row-label nowrap">${label}</span>
                <input class="num-input" type="number" min="0" max="20" step="1" data-base="${key}">
              </label>`).join('')}
          </div>

          <h3 class="modal-title">B2B</h3>
          <label class="row tight">
            <span class="row-label">B2B 加成</span>
            <input class="num-input" type="number" min="0" max="20" step="1" data-b2b>
          </label>

          <h3 class="modal-title">Combo 表</h3>
          <p class="muted small">首消为 0，超出长度时重复最后一项。</p>
          <div class="kick-list" data-combo></div>
          <button class="btn small" data-add-combo>+ 添加一档</button>
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
    b2b: root.querySelector('[data-b2b]'),
    combo: root.querySelector('[data-combo]'),
    toast: root.querySelector('[data-toast]'),
    file: root.querySelector('[data-file]'),
  };

  let model = clone(ATTACK_PRESETS.guideline);

  function toast(message, ok = false) {
    refs.toast.textContent = message;
    refs.toast.classList.toggle('ok', ok);
    refs.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => refs.toast.classList.remove('show'), 2400);
  }

  function build() {
    return validateAttackTable(model);
  }

  function renderBase() {
    refs.name.value = model.name;
    refs.b2b.value = model.b2b;
    for (const [key] of BASE_FIELDS) {
      root.querySelector(`[data-base="${key}"]`).value = model.base[key];
    }
  }

  function renderCombo() {
    refs.combo.innerHTML = model.combo
      .map((value, i) => `
        <div class="kick-row">
          <span class="muted">#${i}</span>
          <input class="num-input" type="number" min="0" max="20" step="1" data-combo-val="${i}" value="${value}">
          <button class="icon-btn" data-combo-remove="${i}" aria-label="删除">×</button>
        </div>`)
      .join('');
    refs.combo.querySelectorAll('[data-combo-val]').forEach((input) => {
      input.addEventListener('input', () => {
        model.combo[Number(input.dataset.comboVal)] = Number(input.value);
      });
      input.addEventListener('change', () => {
        const i = Number(input.dataset.comboVal);
        model.combo[i] = Math.max(0, Math.min(20, Math.round(Number(input.value) || 0)));
        input.value = model.combo[i];
      });
    });
    refs.combo.querySelectorAll('[data-combo-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (model.combo.length === 1) {
          toast('至少保留一档');
          return;
        }
        model.combo.splice(Number(btn.dataset.comboRemove), 1);
        renderCombo();
      });
    });
  }

  function renderAll() {
    renderBase();
    renderCombo();
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
    try {
      model = validateAttackTable(settings.attackTable);
    } catch {
      model = clone(ATTACK_PRESETS.guideline);
    }
    renderAll();
    root.hidden = false;
    document.addEventListener('keydown', onEsc, true);
  }

  root.querySelectorAll('[data-base]').forEach((input) => {
    input.addEventListener('input', () => {
      model.base[input.dataset.base] = Number(input.value);
    });
    input.addEventListener('change', () => {
      const key = input.dataset.base;
      model.base[key] = Math.max(0, Math.min(20, Math.round(Number(input.value) || 0)));
      input.value = model.base[key];
    });
  });

  refs.b2b.addEventListener('input', () => {
    model.b2b = Number(refs.b2b.value);
  });
  refs.b2b.addEventListener('change', () => {
    model.b2b = Math.max(0, Math.min(20, Math.round(Number(refs.b2b.value) || 0)));
    refs.b2b.value = model.b2b;
  });

  refs.name.addEventListener('input', () => {
    model.name = refs.name.value;
  });

  root.querySelector('[data-add-combo]').addEventListener('click', () => {
    if (model.combo.length >= 20) return;
    model.combo.push(model.combo[model.combo.length - 1] || 0);
    renderCombo();
  });

  root.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      model = clone(ATTACK_PRESETS[btn.dataset.preset]);
      renderAll();
      toast(`已载入 ${model.name}`, true);
    });
  });

  root.querySelector('[data-apply]').addEventListener('click', () => {
    try {
      settings.attackTable = build();
      saveSettings(settings);
      close();
      onApply();
    } catch (err) {
      toast(err.message || '配置无效');
    }
  });

  root.querySelector('[data-export]').addEventListener('click', () => {
    try {
      const table = build();
      const blob = new Blob([JSON.stringify(table, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'attack-table.json';
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
      model = validateAttackTable(parsed);
      renderAll();
      toast('已导入 JSON', true);
    } catch (err) {
      toast(err.message || '导入失败');
    }
  });

  root.querySelector('[data-close]').addEventListener('click', close);
  root.querySelector('[data-cancel]').addEventListener('click', close);
  root.addEventListener('mousedown', (e) => {
    if (e.target === root) close();
  });

  return { open, close };
}
