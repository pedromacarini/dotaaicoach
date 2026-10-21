import * as http from 'node:http';
import * as crypto from 'node:crypto';
import type { DraftLivePhase, DraftPick, DraftPickKind, DraftTeam, GameSnapshot, InventoryArea, InventorySlot, InventorySnapshot, DraftLiveState } from '../src/shared/contracts';

export const GSI_PORT = 3199;
const MAX_BODY_BYTES = 1024 * 1024;
const TARGET_PATH = '/gsi';
const IN_PROGRESS = 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS';
export type GsiServerEvent = { type: 'accepted' | 'rejected'; at: number; problem?: string };

type RecordValue = Record<string, unknown>;
const record = (v: unknown): RecordValue => v && typeof v === 'object' && !Array.isArray(v) ? v as RecordValue : {};
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const str = (v: unknown): string | null => typeof v === 'string' && v.length <= 120 ? v : null;
const identifier = (v: unknown): string | null => {
  if (typeof v === 'string' && /^\d{1,24}$/.test(v)) return v;
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return String(Math.trunc(v));
  return null;
};
const draftPhase = (v: unknown): DraftLivePhase => {
  const value = String(v ?? '').toLowerCase();
  if (value.includes('strategy')) return 'strategy';
  if (value.includes('pick')) return 'picking';
  if (value.includes('ban')) return 'banning';
  if (value.includes('complete') || value.includes('done')) return 'complete';
  if (value.includes('lobby')) return 'lobby';
  return 'unknown';
};
const draftTeam = (v: unknown): DraftTeam => {
  const value = String(v ?? '').toLowerCase();
  if (value.includes('radiant') || value === '2' || value === '0') return 'radiant';
  if (value.includes('dire') || value === '3' || value === '1') return 'dire';
  return 'unknown';
};
function normalizeDraftPick(value: unknown, kind: DraftPickKind, index: number, timestamp: number): DraftPick | null {
  const raw = record(value);
  const heroId = num(raw.hero_id) ?? num(raw.heroId) ?? num(raw.id);
  if (heroId === null || !Number.isInteger(heroId) || heroId <= 0) return null;
  const order = num(raw.order) ?? num(raw.pick_order) ?? index;
  return { heroId: Math.trunc(heroId), team: draftTeam(raw.team ?? raw.team_name ?? raw.side), kind,
    order: Math.max(0, Math.trunc(order)), source: 'gsi', confirmedAt: num(raw.confirmed_at) ?? timestamp };
}
function normalizeDraftArray(value: unknown, kind: DraftPickKind, timestamp: number): DraftPick[] {
  const candidate = record(value);
  const entries = Array.isArray(value) ? value : (num(candidate.hero_id) !== null || num(candidate.heroId) !== null || num(candidate.id) !== null)
    ? [value] : Object.values(candidate);
  const unique = new Map<string, DraftPick>();
  entries.forEach((entry, index) => {
    const pick = normalizeDraftPick(entry, kind, index, timestamp);
    if (pick) unique.set(`${pick.kind}:${pick.order}:${pick.heroId}`, pick);
  });
  return [...unique.values()].sort((left, right) => left.order - right.order || left.heroId - right.heroId);
}
export function unavailableDraft(): DraftLiveState {
  return { source: 'unavailable', phase: 'unknown', activeTeam: 'unknown', localTeam: 'unknown', secondsRemaining: null,
    allies: [], enemies: [], bans: [], revision: 0, receivedAt: null };
}
export function normalizeDraft(value: unknown, timestamp = Date.now(), localTeam: DraftTeam = 'unknown'): DraftLiveState {
  const raw = record(value);
  if (!Object.keys(raw).length) return unavailableDraft();
  const picks = normalizeDraftArray(raw.picks ?? raw.pick ?? raw.picked ?? raw.picks_list, 'pick', timestamp);
  const bans = normalizeDraftArray(raw.bans ?? raw.ban ?? raw.banned, 'ban', timestamp);
  const phase = draftPhase(raw.phase ?? raw.state ?? raw.stage ?? (picks.length || bans.length ? 'picking' : null));
  const activeTeam = draftTeam(raw.active_team ?? raw.activeTeam ?? raw.activeteam ?? raw.team);
  const secondsRemaining = num(raw.seconds_remaining) ?? num(raw.secondsRemaining) ?? num(raw.time_remaining) ?? num(raw.activeteam_time_remaining);
  const allies = localTeam === 'unknown' ? picks.filter(pick => pick.team === 'radiant') : picks.filter(pick => pick.team === localTeam);
  const enemies = localTeam === 'unknown' ? picks.filter(pick => pick.team === 'dire') : picks.filter(pick => pick.team !== 'unknown' && pick.team !== localTeam);
  return { source: 'gsi', phase, activeTeam, localTeam, secondsRemaining,
    allies, enemies, bans,
    revision: 0, receivedAt: timestamp };
}
function normalizeLearnedAbilities(value: unknown): Record<string, number> {
  const source = record(value); const result: Record<string, number> = {};
  for (const entry of Object.values(source)) {
    const ability = record(entry); const name = str(ability.name); const level = num(ability.level);
    if (name && level !== null && level > 0) result[name] = level;
  }
  return result;
}

const INVENTORY_SLOTS: Array<{ key: string; area: InventoryArea }> = [
  ...Array.from({ length: 6 }, (_, index) => ({ key: `slot${index}`, area: 'active' as const })),
  ...Array.from({ length: 3 }, (_, index) => ({ key: `slot${index + 6}`, area: 'backpack' as const })),
  ...Array.from({ length: 6 }, (_, index) => ({ key: `stash${index}`, area: 'stash' as const })),
  { key: 'teleport0', area: 'teleport' },
  { key: 'neutral0', area: 'neutral' },
];

export function unknownInventory(): InventorySnapshot {
  return { observation: 'unknown', slots: INVENTORY_SLOTS.map(({ key, area }) => ({
    key, area, state: 'unknown', itemInternalName: null, charges: null,
  })) };
}

export function normalizeInventory(value: unknown): InventorySnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unknownInventory();
  const items = value as RecordValue;
  const slots: InventorySlot[] = INVENTORY_SLOTS.map(({ key, area }) => {
    if (!Object.prototype.hasOwnProperty.call(items, key))
      return { key, area, state: 'unknown', itemInternalName: null, charges: null };
    const item = record(items[key]);
    const name = str(item.name);
    const itemInternalName = name && name !== 'empty' && name !== 'item_empty' ? name : null;
    return {
      key, area, state: itemInternalName ? 'present' : 'empty', itemInternalName,
      charges: itemInternalName ? num(item.charges) : null,
    };
  });
  return { observation: 'observed', slots };
}

export function formatHeroName(hero: string | null): string | null {
  if (!hero) return null;
  return hero.replace(/^npc_dota_hero_/, '').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

// Somente campos do jogador local. Não inferimos dados ocultos nem allplayers.
export function normalizeGsi(input: unknown, timestamp = Date.now()): GameSnapshot {
  const payload = record(input);
  const map = record(payload.map), player = record(payload.player), hero = record(payload.hero);
  const localTeam = draftTeam(player.team ?? player.team_name ?? player.side ?? player.player_team);
  return {
    source: 'gsi', connected: true, receivedAt: timestamp,
    gameTime: num(map.game_time) ?? num(map.clock_time),
    rawGameTime: num(map.game_time),
    patch: str(map.patch),
    mode: map.game_mode === 'turbo' || map.game_mode === 'normal' ? map.game_mode : null,
    matchId: identifier(map.matchid) ?? identifier(map.match_id),
    gameState: str(map.game_state),
    playerActivity: str(player.activity),
    heroInternalName: str(hero.name),
    heroName: formatHeroName(str(hero.name)),
    heroLevel: num(hero.level),
    lastHits: num(player.last_hits),
    denies: num(player.denies),
    netWorth: num(player.net_worth) ?? num(player.networth) ?? num(player.netWorth),
    gpm: num(player.gpm),
    kills: num(player.kills),
    deaths: num(player.deaths),
    assists: num(player.assists),
    learnedAbilities: normalizeLearnedAbilities(payload.abilities),
    inventory: normalizeInventory(payload.items),
    draft: normalizeDraft(payload.draft, timestamp, localTeam),
  };
}

/**
 * O Dota inclui estratégia/pré-jogo em map.game_time. Este normalizador mantém
 * um baseline por partida e só publica o relógio depois de GAME_IN_PROGRESS.
 * Sem game_state, clock_time é o fallback mais fiel; se também faltar, mantém
 * game_time sem calibração para não zerar uma partida iniciada no meio.
 */
export function createGsiSnapshotNormalizer(): (input: unknown, timestamp?: number) => GameSnapshot {
  let matchId: string | null = null;
  let baseline: number | null = null;
  return (input, timestamp = Date.now()) => {
    const snapshot = normalizeGsi(input, timestamp);
    const payload = record(input);
    const map = record(payload.map);
    const rawGameTime = num(map.game_time);
    const clockTime = num(map.clock_time);
    const reliableMatchChanged = Boolean(snapshot.matchId && matchId && snapshot.matchId !== matchId);
    if (reliableMatchChanged) baseline = null;
    if (snapshot.matchId) matchId = snapshot.matchId;

    if (snapshot.gameState === null) {
      return { ...snapshot, rawGameTime, gameTime: clockTime ?? rawGameTime };
    }
    if (snapshot.gameState !== IN_PROGRESS) {
      baseline = null;
      matchId = snapshot.matchId;
      return { ...snapshot, rawGameTime, gameTime: null };
    }
    if (rawGameTime === null) return { ...snapshot, rawGameTime, gameTime: clockTime };
    if (baseline === null) baseline = rawGameTime;
    return { ...snapshot, rawGameTime, gameTime: Math.max(0, rawGameTime - baseline) };
  };
}

export function makeGsiConfig(token: string): string {
  if (!/^[a-f0-9]{48}$/.test(token)) throw new Error('Token inválido.');
  return `"DotaIACoach"
{
    "uri"           "http://127.0.0.1:${GSI_PORT}${TARGET_PATH}"
    "timeout"       "5.0"
    "buffer"        "0.1"
    "throttle"      "0.2"
    "heartbeat"     "10.0"
    "data"
    {
        "provider"   "1"
        "map"        "1"
        "player"     "1"
        "hero"       "1"
        "abilities"  "1"
        "items"      "1"
        "draft"      "1"
    }
    "auth"
    {
        "token"      "${token}"
    }
}
`;
}

export function generateToken(): string { return crypto.randomBytes(24).toString('hex'); }

export function startGsiServer(token: string, onSnapshot: (value: GameSnapshot) => void,
  onEvent?: (event: GsiServerEvent) => void): Promise<http.Server> {
  const normalizeSnapshot = createGsiSnapshotNormalizer();
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.url !== TARGET_PATH || req.method !== 'POST') { res.writeHead(404).end(); return; }
    let bytes = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        onEvent?.({ type: 'rejected', at: Date.now(), problem: 'Pacote maior que 1 MB.' });
        res.writeHead(413).end();
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      try {
        const obj: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const auth = record(record(obj).auth);
        const received = typeof auth.token === 'string' ? auth.token : '';
        const a = Buffer.from(received, 'utf8');
        const b = Buffer.from(token, 'utf8');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          onEvent?.({ type: 'rejected', at: Date.now(), problem: 'Token GSI inválido.' });
          res.writeHead(401).end(); return;
        }
        const snapshot = normalizeSnapshot(obj);
        onSnapshot(snapshot);
        onEvent?.({ type: 'accepted', at: snapshot.receivedAt ?? Date.now() });
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('OK');
      } catch {
        onEvent?.({ type: 'rejected', at: Date.now(), problem: 'JSON GSI inválido.' });
        res.writeHead(400).end();
      }
    });
    req.on('error', () => { if (!res.writableEnded) res.writeHead(400).end(); });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(GSI_PORT, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}
