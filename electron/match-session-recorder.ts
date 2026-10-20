import type { GameSnapshot, MatchSession, MatchSessionState, Position } from '../src/shared/contracts';
import { finishSession, sampleFromSnapshot, summarizeSession } from '../src/core/match-session';
import type { SessionHistoryStore } from './session-history';

export interface MatchSessionRecorder {
  accept(snapshot: GameSnapshot): MatchRecorderUpdate;
  getActive(): MatchSession | null;
  getState(): MatchSessionState;
}

export interface MatchRecorderUpdate { changed: boolean; recentChanged: boolean; }

export const MAX_SESSION_SAMPLES = 900;
const PRE_GAME = 'DOTA_GAMERULES_STATE_PRE_GAME';
const IN_PROGRESS = 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS';

const terminalState = (state: string | null): boolean => Boolean(state && (
  state.includes('POST_GAME') || state.includes('GAME_ENDED')
));
const trackableState = (snapshot: GameSnapshot): boolean => snapshot.source === 'gsi'
  && snapshot.gameTime !== null
  && snapshot.playerActivity === 'playing'
  && (snapshot.gameState === PRE_GAME || snapshot.gameState === IN_PROGRESS);
const numberChanged = (current: number | null, previous: number | null): boolean =>
  current !== null && previous !== null && current !== previous;
const kdaChanged = (current: MatchSession['samples'][number], previous: MatchSession['samples'][number]): boolean =>
  numberChanged(current.kills, previous.kills)
  || numberChanged(current.deaths, previous.deaths)
  || numberChanged(current.assists, previous.assists);

// Mantém início, fim e eventos KDA; preenche o espaço restante com amostras distribuídas.
export function limitSessionSamples(samples: MatchSession['samples'], limit = MAX_SESSION_SAMPLES): MatchSession['samples'] {
  if (samples.length <= limit) return samples;
  let maximumTimeIndex = 0;
  for (let index = 1; index < samples.length; index++)
    if (samples[index].gameTime > samples[maximumTimeIndex].gameTime) maximumTimeIndex = index;
  const important = new Set<number>([0, maximumTimeIndex, samples.length - 1]);
  for (let index = 1; index < samples.length; index++)
    if (kdaChanged(samples[index], samples[index - 1])) important.add(index);
  let selected = [...important].sort((a, b) => a - b);
  if (selected.length > limit)
    selected = [0, ...selected.filter(index => index !== 0).slice(-(limit - 1))];
  if (selected.length < limit) {
    const candidates = samples.map((_sample, index) => index).filter(index => !important.has(index));
    const needed = limit - selected.length;
    for (let slot = 0; slot < needed && candidates.length; slot++)
      selected.push(candidates[Math.floor(slot * candidates.length / needed)]);
  }
  return [...new Set(selected)].sort((a, b) => a - b).map(index => samples[index]);
}

export function createMatchSessionRecorder(history: SessionHistoryStore,
  getPosition: () => Position): MatchSessionRecorder {
  let active: MatchSession | null = null;
  let positionLocked = false;
  const cloneActive = (): MatchSession | null => active
    ? { ...active, samples: active.samples.map(value => ({...value})), summary: {...active.summary} } : null;
  const publicState = (): MatchSessionState => ({
    active: cloneActive(),
    recent: history.get(),
  });
  const complete = (at: number, reason: 'post-game' | 'new-match'): void => {
    if (!active) return;
    const completed = finishSession(active, at, reason);
    if (completed.samples.length > 0) history.add(completed);
    active = null;
    positionLocked = false;
  };
  return {
    getActive: cloneActive,
    getState: publicState,
    accept(snapshot) {
      if (snapshot.source !== 'gsi') return { changed: false, recentChanged: false };
      const at = snapshot.receivedAt ?? Date.now();
      if (terminalState(snapshot.gameState)) {
        if (!active) return { changed: false, recentChanged: false };
        const finalSample = sampleFromSnapshot(snapshot);
        if (finalSample) active.samples = limitSessionSamples([...active.samples, finalSample]);
        complete(at, 'post-game');
        return { changed: true, recentChanged: true };
      }
      if (!trackableState(snapshot)) return { changed: false, recentChanged: false };
      const incoming = sampleFromSnapshot(snapshot)!;
      const previous = active?.samples.at(-1);
      let recentChanged = false;
      if (active && previous && previous.gameTime > 120 && incoming.gameTime < previous.gameTime - 120) {
        complete(at, 'new-match');
        recentChanged = true;
      }
      if (!active) {
        active = {
          id: `match-${at}`, source: 'real', position: getPosition(),
          heroInternalName: snapshot.heroInternalName, heroName: snapshot.heroName,
          startedAt: at, endedAt: null, endReason: null, samples: [], summary: summarizeSession([]),
        };
        positionLocked = snapshot.gameState === IN_PROGRESS;
      }
      let positionChanged = false;
      if (!positionLocked && snapshot.gameState === PRE_GAME) {
        const nextPosition = getPosition();
        positionChanged = nextPosition !== active.position;
        active.position = nextPosition;
      }
      if (snapshot.gameState === IN_PROGRESS) positionLocked = true;
      const last = active.samples.at(-1);
      const importantChange = Boolean(last && kdaChanged(incoming, last));
      if (last && incoming.gameTime >= last.gameTime && incoming.gameTime - last.gameTime < 5 && !importantChange)
        return { changed: positionChanged, recentChanged };
      active.samples.push(incoming);
      active.samples = limitSessionSamples(active.samples);
      if (!active.heroName && snapshot.heroName) {
        active.heroName = snapshot.heroName; active.heroInternalName = snapshot.heroInternalName;
      }
      active.summary = summarizeSession(active.samples);
      return { changed: true, recentChanged };
    },
  };
}
