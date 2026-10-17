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
    if (player.over || opponent?.over) {
      return { winner: player.over ? 'ai' : 'player', reason: 'topout', time: elapsed };
    }
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
