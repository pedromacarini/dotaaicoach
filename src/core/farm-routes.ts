import type { Position } from '../shared/contracts';

export type MapSide = 'radiant' | 'dire';
export interface FarmCamp { id: string; name: string; side: MapSide; tier: 1 | 2 | 3 | 4 | 5; respawnSeconds: number; confidence: 'authorial-v1'; }
export interface FarmRouteStep { camp: FarmCamp; arriveAt: number; durationSeconds: number; reason: string; }
export interface FarmRoute { side: MapSide; position: Position; startedAt: number; steps: FarmRouteStep[]; estimatedDuration: number; warnings: string[]; }

// Pontos abstratos e editáveis; não são coordenadas nem visão do mapa do jogo.
export const AUTHORIAL_CAMPS: readonly FarmCamp[] = [
  { id: 'safe-small', name: 'Acampamento seguro pequeno', side: 'radiant', tier: 1, respawnSeconds: 60, confidence: 'authorial-v1' },
  { id: 'safe-medium', name: 'Acampamento seguro médio', side: 'radiant', tier: 2, respawnSeconds: 60, confidence: 'authorial-v1' },
  { id: 'triangle-ancient', name: 'Triângulo ancestral', side: 'radiant', tier: 5, respawnSeconds: 60, confidence: 'authorial-v1' },
  { id: 'offlane-medium', name: 'Acampamento da offlane', side: 'dire', tier: 2, respawnSeconds: 60, confidence: 'authorial-v1' },
  { id: 'offlane-large', name: 'Acampamento grande da offlane', side: 'dire', tier: 3, respawnSeconds: 60, confidence: 'authorial-v1' },
  { id: 'dire-ancient', name: 'Triângulo ancestral Dire', side: 'dire', tier: 5, respawnSeconds: 60, confidence: 'authorial-v1' },
];

const preferredTiers: Record<Position, readonly number[]> = { 1: [2, 3, 5, 1], 2: [2, 3, 1, 5], 3: [2, 3, 1], 4: [1, 2, 3], 5: [1, 2] };

export function planFarmRoute(position: Position, side: MapSide, startSeconds: number, camps: readonly FarmCamp[] = AUTHORIAL_CAMPS): FarmRoute {
  const warnings = ['Rota abstrata: confirme a posição real no mapa antes de se deslocar.', 'Tempo e duração são estimativas; o GSI não fornece coordenadas.'];
  const available = camps.filter(camp => camp.side === side);
  const tiers = preferredTiers[position];
  const ordered = [...available].sort((left, right) => tiers.indexOf(left.tier) - tiers.indexOf(right.tier) || left.tier - right.tier);
  const steps = ordered.slice(0, 3).map((camp, index) => ({
    camp,
    arriveAt: Math.max(0, startSeconds) + index * 75,
    durationSeconds: 55 + camp.tier * 5,
    reason: index === 0 ? 'Próximo alvo compatível com a posição.' : 'Continuação com prioridade de farm e respawn padrão.',
  }));
  return { side, position, startedAt: Math.max(0, startSeconds), steps, estimatedDuration: steps.reduce((sum, step) => sum + step.durationSeconds, 0), warnings };
}
