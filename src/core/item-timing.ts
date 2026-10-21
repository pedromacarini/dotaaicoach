import type { ItemObservation, ItemPurchaseLogSample, ItemTimingBenchmark, ItemTimingComparison, ItemTimingMode, Position } from '../shared/contracts';

export const DEFAULT_MINIMUM_ITEM_TIMING_SAMPLE = 30;

export interface ItemTimingBenchmarkContext { patch: string | null; mode: ItemTimingMode | null; }

const percentile = (sorted: readonly number[], ratio: number): number => {
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index), upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower));
};

/** Agrega somente a primeira compra de cada item por partida e descarta grupos abaixo da amostra mínima. */
export function aggregatePurchaseLogBenchmarks(samples: readonly ItemPurchaseLogSample[], options: {
  minimumSampleSize?: number; updatedAt?: string;
} = {}): ItemTimingBenchmark[] {
  const minimum = Math.max(1, Math.trunc(options.minimumSampleSize ?? DEFAULT_MINIMUM_ITEM_TIMING_SAMPLE));
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const firstByMatch = new Map<string, ItemPurchaseLogSample>();
  for (const sample of samples) {
    if (!sample.matchId || !sample.heroInternalName || !sample.itemInternalName || !sample.patch || !sample.source ||
        !Number.isFinite(sample.purchaseTimeSeconds) || sample.purchaseTimeSeconds < 0 ||
        ![1, 2, 3, 4, 5].includes(sample.position) || !['normal', 'turbo'].includes(sample.mode)) continue;
    const key = [sample.sourceKind, sample.source, sample.patch, sample.mode, sample.heroInternalName,
      sample.position, sample.itemInternalName, sample.matchId].join('|');
    const previous = firstByMatch.get(key);
    if (!previous || sample.purchaseTimeSeconds < previous.purchaseTimeSeconds) firstByMatch.set(key, sample);
  }
  const groups = new Map<string, ItemPurchaseLogSample[]>();
  for (const sample of firstByMatch.values()) {
    const key = [sample.sourceKind, sample.source, sample.patch, sample.mode, sample.heroInternalName,
      sample.position, sample.itemInternalName].join('|');
    const group = groups.get(key) ?? [];
    group.push(sample); groups.set(key, group);
  }
  return [...groups.values()].filter(group => group.length >= minimum).map(group => {
    const first = group[0];
    const values = group.map(value => value.purchaseTimeSeconds).sort((left, right) => left - right);
    return { schemaVersion: 1 as const, heroInternalName: first.heroInternalName, position: first.position,
      itemInternalName: first.itemInternalName, medianSeconds: percentile(values, .5),
      p25Seconds: percentile(values, .25), p75Seconds: percentile(values, .75), sampleSize: values.length,
      patch: first.patch, mode: first.mode, source: first.source, sourceKind: first.sourceKind, updatedAt };
  }).sort((left, right) => left.heroInternalName.localeCompare(right.heroInternalName) ||
    left.position - right.position || left.itemInternalName.localeCompare(right.itemInternalName));
}

// Fixture autoral para provar o fluxo offline. Não representa estatística profissional nem o patch do cliente.
export const DEMO_ITEM_TIMING_BENCHMARKS: readonly ItemTimingBenchmark[] = [
  { schemaVersion: 1, heroInternalName: 'npc_dota_hero_axe', position: 3, itemInternalName: 'item_boots',
    medianSeconds: 260, p25Seconds: 170, p75Seconds: 350, sampleSize: 48, patch: '7.41-fixture', mode: 'normal',
    source: 'Fixture autoral sintética v1', sourceKind: 'synthetic-fixture', updatedAt: '2026-10-01T00:00:00.000Z' },
  { schemaVersion: 1, heroInternalName: 'npc_dota_hero_axe', position: 3, itemInternalName: 'item_blink',
    medianSeconds: 780, p25Seconds: 660, p75Seconds: 900, sampleSize: 48, patch: '7.41-fixture', mode: 'normal',
    source: 'Fixture autoral sintética v1', sourceKind: 'synthetic-fixture', updatedAt: '2026-10-01T00:00:00.000Z' },
];

export function compareItemTiming(
  observation: ItemObservation,
  heroInternalName: string | null,
  position: Position,
  benchmarks: readonly ItemTimingBenchmark[],
  context: ItemTimingBenchmarkContext,
): ItemTimingComparison {
  const benchmark = heroInternalName && context.patch && context.mode ? benchmarks.find(candidate =>
    candidate.heroInternalName === heroInternalName && candidate.position === position &&
    candidate.itemInternalName === observation.itemInternalName && candidate.patch === context.patch &&
    candidate.mode === context.mode && candidate.sampleSize > 0) ?? null : null;
  if (!benchmark) return { observation: { ...observation }, verdict: 'no-sample', deltaSeconds: null, benchmark: null };
  if (observation.firstSeenAt === null)
    return { observation: { ...observation }, verdict: 'unknown-time', deltaSeconds: null, benchmark: { ...benchmark } };
  const deltaSeconds = observation.firstSeenAt - benchmark.medianSeconds;
  const verdict = observation.firstSeenAt < benchmark.p25Seconds ? 'early'
    : observation.firstSeenAt > benchmark.p75Seconds ? 'late' : 'expected';
  return { observation: { ...observation }, verdict, deltaSeconds, benchmark: { ...benchmark } };
}

export function compareItemObservations(
  observations: readonly ItemObservation[], heroInternalName: string | null, position: Position,
  benchmarks: readonly ItemTimingBenchmark[], context: ItemTimingBenchmarkContext,
): ItemTimingComparison[] {
  return observations.map(observation => compareItemTiming(observation, heroInternalName, position, benchmarks, context));
}
