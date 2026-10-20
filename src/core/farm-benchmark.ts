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
