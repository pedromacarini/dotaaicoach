import type { BuildMatch, PlayerBuildObservation } from './builds';

export interface OpenDotaCatalogs {
  patches: Array<{ id: number; name: string }>;
  items: Array<{ id: number; key: string }>;
}

export interface OpenDotaNormalizationWarning {
  code: 'unknown-item';
  playerSlot: number;
  value: string;
}

export type OpenDotaRejectionReason =
  | 'invalid-match'
  | 'unparsed'
  | 'unknown-patch'
  | 'incomplete-roster'
  | 'incomplete-player-data';

export type OpenDotaNormalizationResult =
  | {
      status: 'accepted';
      match: BuildMatch;
      warnings: OpenDotaNormalizationWarning[];
    }
  | {
      status: 'rejected';
      reason: OpenDotaRejectionReason;
      details: string;
    };

interface RawPurchase {
  time: number;
  key: string;
}

interface RawPlayer {
  player_slot: number;
  isRadiant?: boolean;
  hero_id: number;
  last_hits: number;
  net_worth: number;
  win: number | boolean;
  lane_role: 1 | 2 | 3;
  is_roaming?: boolean | null;
  hero_variant?: number | null;
  rank_tier?: number | null;
  purchase_log: RawPurchase[];
  ability_upgrades_arr: number[];
}

interface RawMatch {
  match_id: number | string;
  version?: number | null;
  patch: number;
  start_time: number;
  radiant_win: boolean;
  players: RawPlayer[];
  od_data?: { has_parsed?: boolean } | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRadiantPlayer = (player: RawPlayer): boolean =>
  typeof player.isRadiant === 'boolean' ? player.isRadiant : player.player_slot < 128;

const isRawPurchase = (value: unknown): value is RawPurchase =>
  isRecord(value)
  && Number.isFinite(value.time)
  && typeof value.key === 'string';

const isRawPlayer = (value: unknown): value is RawPlayer => {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.player_slot)
    && Number.isInteger(value.hero_id)
    && (value.hero_id as number) > 0
    && Number.isFinite(value.last_hits)
    && (value.last_hits as number) >= 0
    && Number.isFinite(value.net_worth)
    && (value.net_worth as number) >= 0
    && (value.lane_role === 1 || value.lane_role === 2 || value.lane_role === 3)
    && Array.isArray(value.purchase_log)
    && value.purchase_log.every(isRawPurchase)
    && Array.isArray(value.ability_upgrades_arr)
    && value.ability_upgrades_arr.every(abilityId => Number.isInteger(abilityId));
};

const hasValidMatchMetadata = (raw: Record<string, unknown>): boolean => {
  const hasMatchId = (typeof raw.match_id === 'number' && Number.isFinite(raw.match_id))
    || (typeof raw.match_id === 'string' && raw.match_id.length > 0);
  return hasMatchId
    && Number.isInteger(raw.patch)
    && Number.isFinite(raw.start_time)
    && (raw.start_time as number) > 0
    && typeof raw.radiant_win === 'boolean';
};

export function normalizeOpenDotaMatch(
  rawValue: unknown,
  catalogs: OpenDotaCatalogs,
): OpenDotaNormalizationResult {
  if (!isRecord(rawValue)) {
    return {
      status: 'rejected',
      reason: 'invalid-match',
      details: 'A resposta da OpenDota não contém uma partida válida.',
    };
  }
  if (!hasValidMatchMetadata(rawValue)) {
    return {
      status: 'rejected',
      reason: 'invalid-match',
      details: 'A resposta da OpenDota não contém uma partida válida.',
    };
  }
  const raw = rawValue as unknown as RawMatch;
  if (typeof raw.version !== 'number' && raw.od_data?.has_parsed !== true) {
    return {
      status: 'rejected',
      reason: 'unparsed',
      details: 'A OpenDota ainda não analisou o replay desta partida.',
    };
  }
  const patch = catalogs.patches.find(value => value.id === raw.patch)?.name;
  if (!patch) {
    return {
      status: 'rejected',
      reason: 'unknown-patch',
      details: `O patch OpenDota ${String(raw.patch)} não existe no catálogo local.`,
    };
  }
  if (!Array.isArray(raw.players) || raw.players.length !== 10) {
    return {
      status: 'rejected',
      reason: 'incomplete-roster',
      details: 'A partida precisa ter exatamente cinco jogadores em cada time.',
    };
  }
  const invalidPlayerIndex = raw.players.findIndex(player => !isRawPlayer(player));
  if (invalidPlayerIndex !== -1) {
    const invalidPlayer = raw.players[invalidPlayerIndex] as unknown;
    const slot = isRecord(invalidPlayer) && Number.isInteger(invalidPlayer.player_slot)
      ? invalidPlayer.player_slot
      : invalidPlayerIndex;
    return {
      status: 'rejected',
      reason: 'incomplete-player-data',
      details: `O jogador no slot ${String(slot)} não possui todos os dados analisados necessários.`,
    };
  }
  if (raw.players.filter(isRadiantPlayer).length !== 5) {
    return {
      status: 'rejected',
      reason: 'incomplete-roster',
      details: 'A partida precisa ter exatamente cinco jogadores em cada time.',
    };
  }
  const itemIds = new Map(catalogs.items.map(item => [item.key, item.id]));
  const warnings: OpenDotaNormalizationWarning[] = [];

  const players: PlayerBuildObservation[] = raw.players.map(player => ({
    heroId: player.hero_id,
    team: isRadiantPlayer(player) ? 'radiant' : 'dire',
    laneRole: player.lane_role,
    lastHits: player.last_hits,
    netWorth: player.net_worth,
    won: player.win === 1 || player.win === true,
    isRoaming: player.is_roaming === true,
    facetId: player.hero_variant ?? null,
    purchaseLog: player.purchase_log.flatMap(purchase => {
      const itemId = itemIds.get(purchase.key);
      if (itemId === undefined) {
        warnings.push({
          code: 'unknown-item',
          playerSlot: player.player_slot,
          value: purchase.key,
        });
        return [];
      }
      return [{ time: purchase.time, itemId }];
    }),
    abilityUpgrades: [...player.ability_upgrades_arr],
  }));

  const ranks = raw.players
    .map(player => player.rank_tier)
    .filter((rank): rank is number => typeof rank === 'number');

  return {
    status: 'accepted',
    warnings,
    match: {
      matchId: String(raw.match_id),
      patch,
      startedAt: raw.start_time,
      averageRankTier: ranks.length
        ? ranks.reduce((total, rank) => total + rank, 0) / ranks.length
        : null,
      parsed: true,
      players,
    },
  };
}
