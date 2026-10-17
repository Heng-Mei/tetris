// 输入手感状态机：DAS 蓄力 + ARR 连发。
// 时间单位毫秒，由固定步长的循环驱动，与显示器刷新率无关。

export function createHandling() {
  return {
    dir: 0, // -1 左, 1 右, 0 无
    held: { '-1': false, '1': false },
    dasTimer: 0,
    charged: false,
    arrTimer: 0,
  };
}

export function resetHandling(h) {
  h.dir = 0;
  h.held['-1'] = false;
  h.held['1'] = false;
  h.dasTimer = 0;
  h.charged = false;
  h.arrTimer = 0;
}

// 返回需要立即执行的位移方向（0 表示无）
export function press(h, dir, settings) {
  const other = dir === 1 ? -1 : 1;
  if (!settings.lastPriority && h.dir === other) return 0;
  h.held[String(dir)] = true;
  if (h.dir === dir) return 0;
  h.dir = dir;
  h.dasTimer = 0;
  h.charged = false;
  h.arrTimer = 0;
  return dir;
}

export function release(h, dir, settings) {
  h.held[String(dir)] = false;
  if (h.dir !== dir) return 0;
  const other = dir === 1 ? -1 : 1;
  if (h.held[String(other)]) {
    h.dir = other;
    h.dasTimer = 0;
    h.charged = false;
    h.arrTimer = 0;
    return other;
  }
  h.dir = 0;
  h.dasTimer = 0;
  h.charged = false;
  h.arrTimer = 0;
  return 0;
}

// 旋转后取消 DAS 蓄力（需要重新等 DAS），方向保持按住
export function onRotate(h, settings) {
  if (!settings.cancelDasOnRotate || !h.dir) return;
  h.dasTimer = 0;
  h.charged = false;
  h.arrTimer = 0;
}

// 每个逻辑步调用一次；move(dir) 返回是否真的移动了
export function tick(h, dt, settings, move) {
  if (!h.dir) return;

  if (!h.charged) {
    h.dasTimer += dt;
    if (h.dasTimer >= settings.das) {
      h.charged = true;
      h.arrTimer = 0;
      move(h.dir);
    }
    return;
  }

  if (settings.arr <= 0) {
    // ARR 0：瞬间贴墙
    let guard = 0;
    while (guard++ < 12 && move(h.dir)) {
      /* repeat */
    }
    return;
  }

  h.arrTimer += dt;
  let guard = 0;
  while (h.arrTimer >= settings.arr && guard++ < 12) {
    h.arrTimer -= settings.arr;
    if (!move(h.dir)) {
      h.arrTimer = 0;
      break;
    }
  }
}
