import type { GameSnapshot, MatchSample, Position } from '../shared/contracts';

export type FarmClassification = 'ahead' | 'on-track' | 'behind' | 'unavailable';

export interface FarmBenchmark {
  position: Position;
  gameTime: number;
  actualLastHits: number | null;
  targetLastHits: number;
  delta: number | null;
  classification: FarmClassification;
  tolerance: number;
  profile: 'experimental-v1';
}

export interface FarmObservation {
  gameTime: number | null;
  lastHits: number | null;
}

export type EconomyMetric = 'netWorth' | 'gpm';
export interface EconomyBenchmark { metric: EconomyMetric; gameTime: number; actual: number | null; target: number; delta: number | null; classification: FarmClassification; tolerance: number; }

type Anchor = readonly [minute: number, lastHits: number];

// Perfil autoral e experimental: pontos fáceis de auditar e ajustar após testes reais.
// Não representa promessa de desempenho nem reproduz dados de outro aplicativo.
export const EXPERIMENTAL_FARM_PROFILE: Readonly<Record<Position, readonly Anchor[]>> = {
  1: [[0, 0], [5, 28], [10, 67], [15, 108], [20, 151], [30, 241], [40, 333], [60, 515]],
  2: [[0, 0], [5, 27], [10, 63], [15, 101], [20, 141], [30, 224], [40, 307], [60, 470]],
  3: [[0, 0], [5, 23], [10, 54], [15, 86], [20, 121], [30, 190], [40, 257], [60, 390]],
  4: [[0, 0], [5, 8], [10, 19], [15, 31], [20, 45], [30, 72], [40, 100], [60, 158]],
  5: [[0, 0], [5, 5], [10, 12], [15, 20], [20, 29], [30, 48], [40, 68], [60, 108]],
};
const ECONOMY_PROFILE: Readonly<Record<Position, { netWorth: readonly Anchor[]; gpm: readonly Anchor[] }>> = {
  1: { netWorth: [[0, 0], [10, 3200], [20, 7000], [30, 11500], [40, 16500]], gpm: [[0, 0], [10, 420], [20, 510], [30, 580], [40, 640]] },
  2: { netWorth: [[0, 0], [10, 3000], [20, 6500], [30, 10800], [40, 15500]], gpm: [[0, 0], [10, 400], [20, 490], [30, 560], [40, 620]] },
  3: { netWorth: [[0, 0], [10, 2700], [20, 5800], [30, 9600], [40, 13800]], gpm: [[0, 0], [10, 360], [20, 450], [30, 520], [40, 575]] },
  4: { netWorth: [[0, 0], [10, 1800], [20, 3900], [30, 6500], [40, 9200]], gpm: [[0, 0], [10, 250], [20, 320], [30, 390], [40, 440]] },
  5: { netWorth: [[0, 0], [10, 1600], [20, 3500], [30, 5800], [40, 8200]], gpm: [[0, 0], [10, 230], [20, 300], [30, 360], [40, 410]] },
};
function interpolate(anchors: readonly Anchor[], gameTime: number): number {
  const minute = Math.max(0, gameTime) / 60;
  let left = anchors[0], right = anchors[1];
  for (let index = 1; index < anchors.length; index++) { right = anchors[index]; if (minute <= right[0]) break; left = right; }
  const progress = (minute - left[0]) / Math.max(1, right[0] - left[0]);
  if (minute > anchors[anchors.length - 1][0]) { const previous = anchors[anchors.length - 2]; const rate = (right[1] - previous[1]) / (right[0] - previous[0]); return Math.round(right[1] + (minute - right[0]) * rate); }
  return Math.round(left[1] + (right[1] - left[1]) * Math.max(0, Math.min(1, progress)));
}
export function evaluateEconomy(position: Position, gameTime: number | null, actual: number | null, metric: EconomyMetric): EconomyBenchmark | null {
  if (gameTime === null) return null;
  const target = interpolate(ECONOMY_PROFILE[position][metric], gameTime);
  const tolerance = metric === 'gpm' ? 35 : Math.max(250, Math.round(target * .08));
  const delta = actual === null ? null : actual - target;
  const classification: FarmClassification = delta === null ? 'unavailable' : delta > tolerance ? 'ahead' : delta < -tolerance ? 'behind' : 'on-track';
  return { metric, gameTime, actual, target, delta, classification, tolerance };
}

export function targetLastHits(position: Position, gameTime: number): number {
  const seconds = Math.max(0, gameTime);
  const minute = seconds / 60;
  const anchors = EXPERIMENTAL_FARM_PROFILE[position];
  let left = anchors[0];
  let right = anchors[1];
  for (let index = 1; index < anchors.length; index++) {
    right = anchors[index];
    if (minute <= right[0]) break;
    left = right;
    if (index === anchors.length - 1) {
      const previous = anchors[index - 1];
      const rate = (right[1] - previous[1]) / (right[0] - previous[0]);
      return Math.round(right[1] + (minute - right[0]) * rate);
    }
  }
  const progress = (minute - left[0]) / Math.max(1, right[0] - left[0]);
  return Math.round(left[1] + (right[1] - left[1]) * Math.max(0, Math.min(1, progress)));
}

export function evaluateFarm(position: Position, gameTime: number | null,
  actualLastHits: number | null): FarmBenchmark | null {
  if (gameTime === null) return null;
  const target = targetLastHits(position, gameTime);
  const tolerance = Math.max(3, Math.round(target * 0.08));
  const delta = actualLastHits === null ? null : actualLastHits - target;
  const classification: FarmClassification = delta === null ? 'unavailable'
    : delta > tolerance ? 'ahead' : delta < -tolerance ? 'behind' : 'on-track';
  return { position, gameTime, actualLastHits, targetLastHits: target, delta,
    classification, tolerance, profile: 'experimental-v1' };
}

// Um pacote atual explícito tem precedência até quando contém null: ausência não é dado antigo.
// O fallback existe apenas quando não há pacote de partida no renderer.
export function selectFarmObservation(snapshot: GameSnapshot,
  latestSample: MatchSample | null): FarmObservation {
  if (snapshot.source !== 'idle')
    return { gameTime: snapshot.gameTime, lastHits: snapshot.lastHits };
  return { gameTime: latestSample?.gameTime ?? null, lastHits: latestSample?.lastHits ?? null };
}
