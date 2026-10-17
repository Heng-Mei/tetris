import {
  createGame,
  resetGame,
  step,
  tryMove,
  rotate,
  hardDrop,
  holdPiece,
  lockPiece,
} from './engine.js';
import { createHandling, press, release, tick, resetHandling, onRotate } from './handling.js';
import { createInput } from './input.js';
import { buildPanel } from './ui.js';
import { DEFAULT_BINDINGS, loadSettings, saveSettings, getSystem } from './settings.js';
import { createRenderer } from './render.js';

const STEP = 1000 / 60;

const settings = loadSettings();
let system = getSystem(settings);
const game = createGame();
const handling = createHandling();

const dom = {
  board: document.getElementById('board'),
  hold: document.getElementById('hold'),
  next: document.getElementById('next'),
  score: document.getElementById('score'),
  lines: document.getElementById('lines'),
  level: document.getElementById('level'),
  time: document.getElementById('time'),
  pps: document.getElementById('pps'),
  b2b: document.getElementById('b2b'),
  overlay: document.getElementById('overlay'),
  overlayTitle: document.getElementById('overlayTitle'),
  overlayText: document.getElementById('overlayText'),
  overlayBtn: document.getElementById('overlayBtn'),
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  restartBtn: document.getElementById('restartBtn'),
  panelBtn: document.getElementById('panelBtn'),
  panel: document.getElementById('panel'),
  panelBody: document.getElementById('panelBody'),
};

const renderer = createRenderer(dom);

let running = false;
let paused = false;
let softHeld = false;
let flash = 0;
let acc = 0;
let lastTime = performance.now();

function showOverlay(title, text, button) {
  dom.overlayTitle.textContent = title;
  dom.overlayText.textContent = text;
  dom.overlayBtn.textContent = button || '';
  dom.overlayBtn.hidden = !button;
  dom.overlay.classList.add('show');
}

function hideOverlay() {
  dom.overlay.classList.remove('show');
}

function updatePauseLabel() {
  dom.pauseBtn.textContent = paused ? '继续' : '暂停';
}

function start() {
  resetGame(game);
  resetHandling(handling);
  softHeld = false;
  flash = 0;
  acc = 0;
  running = true;
  paused = false;
  updatePauseLabel();
  hideOverlay();
}

function togglePause() {
  if (!running) {
    if (game.status === 'over') start();
    return;
  }
  if (game.status === 'over' || game.status === 'idle') return;
  paused = !paused;
  updatePauseLabel();
  if (paused) {
    softHeld = false;
    resetHandling(handling);
    showOverlay('已暂停', '按 Esc 或点击继续', '继续');
  } else {
    hideOverlay();
  }
}

function handleLock(info) {
  if (!info) return;
  if (info.lines > 0) flash = 140;
}

function doRotate(dir) {
  if (!running || paused) return;
  if (settings.rot180 === 'off' && dir === '180') return;
  if (settings.irs && game.status === 'spawning') {
    game.pendingIRS = dir;
    return;
  }
  if (game.status !== 'playing') return;
  rotate(game, system, settings, dir);
  onRotate(handling, settings);
}

function doHold() {
  if (!running || paused) return;
  if (settings.ihs && game.status === 'spawning') {
    game.pendingIHS = true;
    return;
  }
  if (game.status !== 'playing') return;
  holdPiece(game, system, settings);
}

function doHardDrop() {
  if (!running || paused || game.status !== 'playing') return;
  hardDrop(game, system);
  const info = lockPiece(game, system, settings);
  handleLock(info);
}

const handlers = {
  onPress(dir) {
    if (!running || paused) return;
    const d = press(handling, dir, settings);
    if (d) tryMove(game, system, d, 0, settings);
  },
  onRelease(dir) {
    if (!running || paused) return;
    const d = release(handling, dir, settings);
    if (d) tryMove(game, system, d, 0, settings);
  },
  onSoft(active) {
    softHeld = active;
  },
  onAction(action) {
    switch (action) {
      case 'rotateCW':
        doRotate('cw');
        break;
      case 'rotateCCW':
        doRotate('ccw');
        break;
      case 'rotate180':
        doRotate('180');
        break;
      case 'hardDrop':
        doHardDrop();
        break;
      case 'hold':
        doHold();
        break;
      case 'pause':
        togglePause();
        break;
      case 'restart':
        start();
        break;
      default:
        break;
    }
  },
  onBlur() {
    softHeld = false;
    resetHandling(handling);
    if (running && !paused) togglePause();
  },
};

const input = createInput(settings, handlers);

buildPanel(dom.panelBody, {
  settings,
  input,
  defaultBindings: DEFAULT_BINDINGS,
  onClose: () => togglePanel(false),
  onChange() {
    saveSettings(settings);
    system = getSystem(settings);
  },
  onSystemDirty() {
    saveSettings(settings);
    system = getSystem(settings);
  },
});

function togglePanel(open) {
  const next = open ?? !dom.panel.classList.contains('open');
  dom.panel.classList.toggle('open', next);
  dom.panel.setAttribute('aria-hidden', String(!next));
}

dom.startBtn.addEventListener('click', start);
dom.restartBtn.addEventListener('click', start);
dom.pauseBtn.addEventListener('click', togglePause);
dom.panelBtn.addEventListener('click', () => togglePanel());
dom.overlayBtn.addEventListener('click', () => {
  if (paused) {
    paused = false;
    updatePauseLabel();
    hideOverlay();
  } else {
    start();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && (!running || game.status === 'over')) {
    e.preventDefault();
    start();
  }
});

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateHud() {
  dom.score.textContent = game.score.toLocaleString('en-US');
  dom.lines.textContent = String(game.lines);
  dom.level.textContent = String(game.level);
  dom.time.textContent = formatTime(game.time);
  const seconds = game.time / 1000;
  dom.pps.textContent = seconds > 0.5 ? (game.pieces / seconds).toFixed(2) : '0.00';
  dom.b2b.textContent = game.b2b ? 'B2B' : '—';
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(now - lastTime, 100);
  lastTime = now;

  if (running && !paused) {
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 6) {
      acc -= STEP;
      tick(handling, STEP, settings, (d) => tryMove(game, system, d, 0, settings));
      const info = step(game, system, settings, STEP, softHeld);
      handleLock(info);
      if (game.status === 'over' && running) {
        running = false;
        showOverlay('游戏结束', `分数 ${game.score.toLocaleString('en-US')} · 消行 ${game.lines}`, '再来一局');
      }
    }
    if (flash > 0) flash = Math.max(0, flash - dt);
  }

  renderer.draw(game, settings, system, { flash });
  updateHud();
}

window.addEventListener('resize', () => renderer.resize());
renderer.resize();
updatePauseLabel();
showOverlay('准备好了？', '按 Enter 开始 · 设置里可以调手感与旋转', '开始');
requestAnimationFrame(frame);

// 调试钩子：方便在控制台观察/自动验证
window.__tetris = {
  game,
  settings,
  get system() {
    return system;
  },
  start,
};
