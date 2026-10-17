import {
  createGame,
  resetGame,
  step,
  tryMove,
  rotate,
  hardDrop,
  holdPiece,
  lockPiece,
  spawnNext,
  insertGarbage,
} from './engine.js';
import { createHandling, press, release, tick, resetHandling, onRotate } from './handling.js';
import { createInput } from './input.js';
import { buildPanel } from './ui.js';
import { createRotationEditor } from './rotation-editor.js';
import { DEFAULT_BINDINGS, loadSettings, saveSettings, getSystem } from './settings.js';
import { createRenderer, createOpponentRenderer } from './render.js';
import { AI_PROFILES, choosePlacement } from './ai.js';
import { MODES, checkOutcome, gravityFor } from './modes.js';
import { computeAttack } from './attack.js';

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
  hint: document.querySelector('.hint'),
  modeSelect: document.getElementById('modeSelect'),
  aiSelect: document.getElementById('aiSelect'),
  aiWrap: document.getElementById('aiWrap'),
  attackRow: document.getElementById('attackRow'),
  incomingRow: document.getElementById('incomingRow'),
  attack: document.getElementById('attack'),
  incoming: document.getElementById('incoming'),
  vsBox: document.getElementById('vsBox'),
  aiLabel: document.getElementById('aiLabel'),
  opponent: document.getElementById('opponent'),
  oppIncoming: document.getElementById('oppIncoming'),
  oppSent: document.getElementById('oppSent'),
};

const renderer = createRenderer(dom);
const oppRenderer = createOpponentRenderer(dom.opponent);

const playerSide = { game, incoming: 0, sent: 0 };
const aiSide = { game: null, incoming: 0, sent: 0 };

let running = false;
let paused = false;
let softHeld = false;
let flash = 0;
let acc = 0;
let modeClock = 0;
let finished = false;
let opponent = null;
let aiTimer = 0;
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
  modeClock = 0;
  aiTimer = 0;
  finished = false;
  running = true;
  paused = false;
  playerSide.incoming = 0;
  playerSide.sent = 0;
  aiSide.incoming = 0;
  aiSide.sent = 0;
  aiSide.game = null;
  opponent = null;
  if (settings.mode === 'vs') {
    opponent = createGame();
    resetGame(opponent);
    aiSide.game = opponent;
  }
  refreshModeUi();
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
  if (settings.mode === 'vs' && opponent) resolveSide(playerSide, aiSide, info);
}

function resolveSide(side, other, info) {
  const attack = info ? computeAttack(info, settings.attackTable) : 0;
  const before = side.incoming;
  const cancelled = Math.min(before, attack);
  side.incoming = before - cancelled;
  const send = attack - cancelled;
  if (send > 0) {
    other.incoming += send;
    side.sent += send;
  }
  if (side.incoming > 0) {
    insertGarbage(side.game, side.incoming, Math.random);
    side.incoming = 0;
  }
}

function aiMove() {
  if (!opponent || opponent.status === 'over') return;
  if (opponent.status === 'spawning') spawnNext(opponent, system, settings);
  if (opponent.status !== 'playing' || !opponent.current) return;
  const profile = AI_PROFILES[settings.aiDifficulty] || AI_PROFILES.normal;
  const p = choosePlacement(opponent.board, system, opponent.current.type, profile);
  if (!p) {
    opponent.status = 'over';
    return;
  }
  opponent.current.r = p.r;
  opponent.current.x = p.x;
  opponent.current.y = p.y;
  const info = lockPiece(opponent, system, settings);
  if (settings.mode === 'vs') resolveSide(aiSide, playerSide, info);
}

function finishGame(outcome) {
  if (finished) return;
  finished = true;
  running = false;
  paused = false;
  softHeld = false;
  resetHandling(handling);
  updatePauseLabel();
  const score = game.score.toLocaleString('en-US');

  if (settings.mode === 'vs') {
    if (outcome.winner === 'player') {
      showOverlay('胜利', `AI 顶死 · 你 ${game.lines} 行 · 攻击 ${playerSide.sent}`, '再来一局');
    } else {
      showOverlay('失败', `你顶死了 · AI ${opponent?.lines ?? 0} 行 · AI 攻击 ${aiSide.sent}`, '再来一局');
    }
  } else if (settings.mode === 'sprint') {
    if (outcome.reason === 'goal') {
      showOverlay('40 行完成', `用时 ${formatTime(outcome.time)}`, '再来一次');
    } else {
      showOverlay('未完成', `已消 ${game.lines} / 40 行`, '再来一次');
    }
  } else if (settings.mode === 'blitz') {
    if (outcome.reason === 'time') {
      showOverlay('时间到', `分数 ${score} · ${game.lines} 行`, '再来一局');
    } else {
      showOverlay('顶死', `分数 ${score} · ${game.lines} 行`, '再来一局');
    }
  } else {
    showOverlay('游戏结束', `分数 ${score} · 消行 ${game.lines}`, '再来一局');
  }
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

const editor = createRotationEditor({
  settings,
  onApply() {
    system = getSystem(settings);
    panelUi.render();
  },
});

const panelUi = buildPanel(dom.panelBody, {
  settings,
  input,
  defaultBindings: DEFAULT_BINDINGS,
  onClose: () => togglePanel(false),
  onEditRotation: () => editor.open(),
  onChange() {
    saveSettings(settings);
    system = getSystem(settings);
    refreshModeUi();
  },
  onSystemDirty() {
    saveSettings(settings);
    system = getSystem(settings);
    refreshModeUi();
  },
});

function togglePanel(open) {
  const next = open ?? !dom.panel.classList.contains('open');
  dom.panel.classList.toggle('open', next);
  dom.panel.setAttribute('aria-hidden', String(!next));
  if (next && running && !paused) togglePause();
}

dom.startBtn.addEventListener('click', start);
dom.restartBtn.addEventListener('click', start);
dom.pauseBtn.addEventListener('click', togglePause);
dom.panelBtn.addEventListener('click', () => togglePanel());
dom.modeSelect.addEventListener('change', () => {
  settings.mode = dom.modeSelect.value;
  saveSettings(settings);
  start();
});
dom.aiSelect.addEventListener('change', () => {
  settings.aiDifficulty = dom.aiSelect.value;
  saveSettings(settings);
  refreshModeUi();
  if (settings.mode === 'vs') start();
});
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
  dom.lines.textContent =
    settings.mode === 'sprint' ? `${Math.min(game.lines, 40)} / 40` : String(game.lines);
  dom.level.textContent = String(game.level);
  const isBlitz = settings.mode === 'blitz';
  dom.time.textContent = formatTime(
    isBlitz ? Math.max(0, MODES.blitz.duration - modeClock) : modeClock,
  );
  const seconds = game.time / 1000;
  dom.pps.textContent = seconds > 0.5 ? (game.pieces / seconds).toFixed(2) : '0.00';
  dom.b2b.textContent = game.b2b ? 'B2B' : '—';
  dom.attack.textContent = String(playerSide.sent);
  dom.incoming.textContent = String(playerSide.incoming);
  dom.oppIncoming.textContent = String(aiSide.incoming);
  dom.oppSent.textContent = String(aiSide.sent);
}

function refreshModeUi() {
  const isVs = settings.mode === 'vs';
  dom.aiWrap.hidden = !isVs;
  dom.vsBox.hidden = !isVs;
  dom.attackRow.hidden = !isVs;
  dom.incomingRow.hidden = !isVs;
  dom.hint.hidden = isVs;
  dom.modeSelect.value = settings.mode;
  dom.aiSelect.value = settings.aiDifficulty;
  dom.aiLabel.textContent = AI_PROFILES[settings.aiDifficulty]?.label || '普通';
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
      modeClock += STEP;
      const stepSettings =
        settings.mode === 'blitz'
          ? { ...settings, gravity: gravityFor('blitz', game.level, settings.gravity) }
          : settings;
      tick(handling, STEP, stepSettings, (d) => tryMove(game, system, d, 0, stepSettings));
      const info = step(game, system, stepSettings, STEP, softHeld);
      handleLock(info);
      if (settings.mode === 'vs' && opponent) {
        aiTimer += STEP;
        const profile = AI_PROFILES[settings.aiDifficulty] || AI_PROFILES.normal;
        if (aiTimer >= profile.interval) {
          aiTimer = 0;
          aiMove();
        }
      }
      const outcome = checkOutcome(
        settings.mode,
        { lines: game.lines, over: game.status === 'over' },
        { over: opponent?.status === 'over' },
        modeClock,
      );
      if (outcome) {
        finishGame(outcome);
        break;
      }
    }
    if (flash > 0) flash = Math.max(0, flash - dt);
  }

  renderer.draw(game, settings, system, { flash });
  if (settings.mode === 'vs') oppRenderer.draw(opponent, settings, system);
  updateHud();
}

window.addEventListener('resize', () => {
  renderer.resize();
  oppRenderer.resize();
});
renderer.resize();
updatePauseLabel();
refreshModeUi();
showOverlay('准备好了？', '按 Enter 开始 · 设置里可以调手感与旋转', '开始');
requestAnimationFrame(frame);

// 调试钩子：方便在控制台观察/自动验证
window.__tetris = {
  game,
  settings,
  get system() {
    return system;
  },
  get opponent() {
    return opponent;
  },
  get modeClock() {
    return modeClock;
  },
  get sides() {
    return {
      player: { incoming: playerSide.incoming, sent: playerSide.sent },
      ai: { incoming: aiSide.incoming, sent: aiSide.sent },
    };
  },
  start,
};
