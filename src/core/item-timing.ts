import type { ItemObservation, ItemTimingBenchmark, ItemTimingComparison, Position } from '../shared/contracts';

// Fixture autoral para provar o fluxo offline. Não representa estatística profissional nem o patch do cliente.
export const DEMO_ITEM_TIMING_BENCHMARKS: readonly ItemTimingBenchmark[] = [
  { heroInternalName: 'npc_dota_hero_axe', position: 3, itemInternalName: 'item_boots', expectedSeconds: 260,
    toleranceSeconds: 90, sampleSize: 48, patch: '7.41-fixture', source: 'Fixture autoral sintética v1', sourceKind: 'synthetic-fixture' },
  { heroInternalName: 'npc_dota_hero_axe', position: 3, itemInternalName: 'item_blink', expectedSeconds: 780,
    toleranceSeconds: 120, sampleSize: 48, patch: '7.41-fixture', source: 'Fixture autoral sintética v1', sourceKind: 'synthetic-fixture' },
];

export function compareItemTiming(
  observation: ItemObservation,
  heroInternalName: string | null,
  position: Position,
  benchmarks: readonly ItemTimingBenchmark[] = DEMO_ITEM_TIMING_BENCHMARKS,
): ItemTimingComparison {
  const benchmark = heroInternalName ? benchmarks.find(candidate =>
    candidate.heroInternalName === heroInternalName && candidate.position === position &&
    candidate.itemInternalName === observation.itemInternalName) ?? null : null;
  if (!benchmark) return { observation: { ...observation }, verdict: 'no-sample', deltaSeconds: null, benchmark: null };
  if (observation.firstSeenAt === null)
    return { observation: { ...observation }, verdict: 'unknown-time', deltaSeconds: null, benchmark: { ...benchmark } };
  const deltaSeconds = observation.firstSeenAt - benchmark.expectedSeconds;
  const verdict = deltaSeconds < -benchmark.toleranceSeconds ? 'early'
    : deltaSeconds > benchmark.toleranceSeconds ? 'late' : 'expected';
  return { observation: { ...observation }, verdict, deltaSeconds, benchmark: { ...benchmark } };
}

export function compareItemObservations(
  observations: readonly ItemObservation[], heroInternalName: string | null, position: Position,
  benchmarks: readonly ItemTimingBenchmark[] = DEMO_ITEM_TIMING_BENCHMARKS,
): ItemTimingComparison[] {
  return observations.map(observation => compareItemTiming(observation, heroInternalName, position, benchmarks));
}
