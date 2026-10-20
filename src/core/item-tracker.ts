import type { GameSnapshot, InventorySnapshot, ItemObservation, ItemTimingState, Position } from '../shared/contracts';
import { compareItemObservations, DEMO_ITEM_TIMING_BENCHMARKS } from './item-timing';

const copyInventory = (inventory: InventorySnapshot): InventorySnapshot => ({
  observation: inventory.observation, slots: inventory.slots.map(slot => ({ ...slot })),
});
const EMPTY_INVENTORY: InventorySnapshot = { observation: 'unknown', slots: [] };

export interface ItemTracker {
  accept(snapshot: GameSnapshot, position: Position): { state: ItemTimingState; changed: boolean };
  reset(): ItemTimingState;
  getState(): ItemTimingState;
}

export function createItemTracker(): ItemTracker {
  let sessionKey: string | null = null;
  let source: GameSnapshot['source'] = 'idle';
  let inventory = copyInventory(EMPTY_INVENTORY);
  let heroInternalName: string | null = null;
  let observations: ItemObservation[] = [];
  let previousGameTime: number | null = null;
  let previousReliableMatchId: string | null = null;
  let currentPosition: Position = 1;

  const state = (position: Position): ItemTimingState => ({
    sessionKey, source,
    validation: source === 'demo' ? 'synthetic-demo' : source === 'gsi' ? 'unvalidated-gsi' : 'none',
    inventory: copyInventory(inventory),
    observations: observations.map(value => ({ ...value })),
    comparisons: compareItemObservations(observations, heroInternalName, position, DEMO_ITEM_TIMING_BENCHMARKS),
  });
  const clear = (): void => {
    sessionKey = null; source = 'idle'; inventory = copyInventory(EMPTY_INVENTORY);
    heroInternalName = null; observations = []; previousGameTime = null; previousReliableMatchId = null;
  };
  return {
    accept(snapshot, position) {
      const before = JSON.stringify(state(currentPosition));
      currentPosition = position;
      if (snapshot.source === 'idle') {
        source = 'idle'; inventory = copyInventory(snapshot.inventory);
        const next = state(position);
        return { state: next, changed: before !== JSON.stringify(next) };
      }
      const identityChanged = previousReliableMatchId !== null && snapshot.matchId !== null &&
        previousReliableMatchId !== snapshot.matchId;
      const returnedToStart = previousGameTime !== null && previousGameTime > 30 && snapshot.gameTime !== null &&
        snapshot.gameTime <= 0 && previousGameTime - snapshot.gameTime > 30;
      const sourceChanged = sessionKey !== null && source !== snapshot.source;
      if (identityChanged || returnedToStart || sourceChanged) {
        observations = [];
        previousGameTime = null;
        heroInternalName = null;
        if (returnedToStart || sourceChanged) {
          previousReliableMatchId = null;
          sessionKey = null;
        }
      }
      if (snapshot.matchId !== null) {
        previousReliableMatchId = snapshot.matchId;
        sessionKey = `match:${snapshot.matchId}`;
      } else if (sessionKey === null) sessionKey = `${snapshot.source}:unidentified`;
      source = snapshot.source;
      heroInternalName = snapshot.heroInternalName ?? heroInternalName;
      inventory = copyInventory(snapshot.inventory);
      if (snapshot.gameTime !== null) previousGameTime = snapshot.gameTime;

      const alreadySeen = new Set(observations.map(value => value.itemInternalName));
      for (const slot of snapshot.inventory.slots) {
        if (slot.state !== 'present' || !slot.itemInternalName || alreadySeen.has(slot.itemInternalName)) continue;
        observations.push({
          itemInternalName: slot.itemInternalName,
          firstSeenAt: snapshot.gameTime,
          firstSeenReceivedAt: snapshot.receivedAt,
          firstSeenArea: slot.area,
        });
        alreadySeen.add(slot.itemInternalName);
      }
      observations.sort((left, right) => (left.firstSeenAt ?? Number.POSITIVE_INFINITY) -
        (right.firstSeenAt ?? Number.POSITIVE_INFINITY) || left.itemInternalName.localeCompare(right.itemInternalName));
      const next = state(position);
      return { state: next, changed: before !== JSON.stringify(next) };
    },
    reset() { clear(); return state(currentPosition); },
    getState() { return state(currentPosition); },
  };
}
