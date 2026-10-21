import type { DraftContextPrompt, DraftLiveState, DraftPick } from '../shared/contracts';

const empty = (): DraftLiveState => ({ source: 'unavailable', phase: 'unknown', activeTeam: 'unknown',
  localTeam: 'unknown', secondsRemaining: null, allies: [], enemies: [], bans: [], revision: 0, receivedAt: null });
const copyPick = (pick: DraftPick): DraftPick => ({ ...pick });
const copyState = (state: DraftLiveState): DraftLiveState => ({ ...state,
  allies: state.allies.map(copyPick), enemies: state.enemies.map(copyPick), bans: state.bans.map(copyPick),
  prompt: state.prompt ? { ...state.prompt } : undefined });

function promptFor(state: DraftLiveState, cooldownUntil: number | null, now: number): DraftContextPrompt {
  const eligible = state.source === 'gsi' && (state.phase === 'strategy' || state.phase === 'picking' || state.phase === 'banning');
  const visible = eligible && (cooldownUntil === null || now >= cooldownUntil);
  return { visible, phase: state.phase, cooldownUntil, action: visible ? null : null,
    message: eligible ? 'Quer ajuda no draft?' : 'Aguardando dados do draft do GSI.' };
}

export interface DraftLiveTracker {
  accept(state: DraftLiveState | undefined, matchId: string | null, receivedAt?: number | null): DraftLiveState;
  dismiss(action: 'ranked' | 'follow' | 'later', now?: number): DraftLiveState;
  get(): DraftLiveState;
  reset(): DraftLiveState;
}

export function createDraftLiveTracker(clock: () => number = Date.now): DraftLiveTracker {
  let current = empty();
  let sessionKey: string | null = null;
  let cooldownUntil: number | null = null;
  const applyPrompt = (state: DraftLiveState): DraftLiveState => ({ ...state, prompt: promptFor(state, cooldownUntil, clock()) });
  return {
    accept(input, matchId, receivedAt = null) {
      const nextSession = matchId || null;
      // A match id can arrive after the first draft packet. Do not erase the
      // already confirmed stream when the previous session was anonymous.
      const shouldReset = sessionKey !== null && nextSession !== null && sessionKey !== nextSession;
      if (shouldReset) { sessionKey = nextSession; cooldownUntil = null; current = empty(); }
      else if (sessionKey === null && nextSession !== null) sessionKey = nextSession;
      // O campo draft pode faltar em um pacote transitório. Preserve o stream confirmado
      // na mesma partida; ausência não pode apagar picks/bans já recebidos.
      const next = input && input.source === 'gsi' ? copyState(input) : copyState(current);
      if (!input && nextSession === null) return copyState(applyPrompt(empty()));
      if (input && input.source === 'gsi') {
        const merge = (previous: DraftPick[], incoming: DraftPick[]) => {
          const byKey = new Map(previous.map(p => [`${p.kind}:${p.order}:${p.heroId}`, p]));
          incoming.forEach(p => byKey.set(`${p.kind}:${p.order}:${p.heroId}`, p));
          return [...byKey.values()].sort((a, b) => a.order - b.order || a.heroId - b.heroId);
        };
        next.allies = merge(current.allies, next.allies);
        next.enemies = merge(current.enemies, next.enemies);
        next.bans = merge(current.bans, next.bans);
        if (next.localTeam === 'unknown') next.localTeam = current.localTeam;
      }
      const previousKeys = new Set([...current.allies, ...current.enemies, ...current.bans].map(p => `${p.kind}:${p.order}:${p.heroId}`));
      const incoming = [...next.allies, ...next.enemies, ...next.bans];
      const changed = incoming.length !== previousKeys.size || incoming.some(p => !previousKeys.has(`${p.kind}:${p.order}:${p.heroId}`));
      next.revision = current.revision + (changed || next.phase !== current.phase || next.activeTeam !== current.activeTeam ? 1 : 0);
      next.receivedAt = receivedAt ?? next.receivedAt;
      current = applyPrompt(next);
      return copyState(current);
    },
    dismiss(action, now = clock()) {
      if (action === 'later') cooldownUntil = now + 5 * 60 * 1000;
      else cooldownUntil = now + 30 * 1000;
      current = applyPrompt(current);
      return copyState(current);
    },
    get: () => copyState(current),
    reset() { sessionKey = null; cooldownUntil = null; current = empty(); return copyState(current); },
  };
}
