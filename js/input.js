function actionFor(settings, code) {
  for (const [action, bound] of Object.entries(settings.bindings)) {
    if (bound === code) return action;
  }
  return null;
}

export function createInput(settings, handlers) {
  let rebind = null;

  const onKeyDown = (e) => {
    if (rebind) {
      e.preventDefault();
      if (e.code !== 'Escape') {
        settings.bindings[rebind.action] = e.code;
        const cb = rebind.cb;
        rebind = null;
        cb(e.code);
      } else {
        const cb = rebind.cb;
        rebind = null;
        cb(null);
      }
      return;
    }

    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    const action = actionFor(settings, e.code);
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return;

    if (action === 'left' || action === 'right') handlers.onPress(action === 'left' ? -1 : 1);
    else if (action === 'softDrop') handlers.onSoft(true);
    else handlers.onAction(action);
  };

  const onKeyUp = (e) => {
    if (rebind) return;
    const action = actionFor(settings, e.code);
    if (!action) return;
    if (action === 'left' || action === 'right') handlers.onRelease(action === 'left' ? -1 : 1);
    else if (action === 'softDrop') handlers.onSoft(false);
  };

  const onBlur = () => handlers.onBlur();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    beginRebind(action, cb) {
      rebind = { action, cb };
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}

export function keyLabel(code) {
  if (!code) return '未绑定';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return { Left: '←', Right: '→', Up: '↑', Down: '↓' }[code.slice(5)];
  if (code === 'Space') return 'Space';
  if (code === 'Escape') return 'Esc';
  return code;
}
