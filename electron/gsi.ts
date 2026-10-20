import * as http from 'node:http';
import * as crypto from 'node:crypto';
import type { GameSnapshot, InventoryArea, InventorySlot, InventorySnapshot } from '../src/shared/contracts';

export const GSI_PORT = 3199;
const MAX_BODY_BYTES = 1024 * 1024;
const TARGET_PATH = '/gsi';
const IN_PROGRESS = 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS';
export type GsiServerEvent = { type: 'accepted' | 'rejected'; at: number; problem?: string };

type RecordValue = Record<string, unknown>;
const record = (v: unknown): RecordValue => v && typeof v === 'object' && !Array.isArray(v) ? v as RecordValue : {};
const num = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null => typeof v === 'string' && v.length <= 120 ? v : null;
const identifier = (v: unknown): string | null => {
  if (typeof v === 'string' && /^\d{1,24}$/.test(v)) return v;
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return String(Math.trunc(v));
  return null;
};

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
  return {
    source: 'gsi', connected: true, receivedAt: timestamp,
    gameTime: num(map.game_time) ?? num(map.clock_time),
    rawGameTime: num(map.game_time),
    matchId: identifier(map.matchid) ?? identifier(map.match_id),
    gameState: str(map.game_state),
    playerActivity: str(player.activity),
    heroInternalName: str(hero.name),
    heroName: formatHeroName(str(hero.name)),
    heroLevel: num(hero.level),
    lastHits: num(player.last_hits),
    denies: num(player.denies),
    netWorth: num(player.net_worth),
    gpm: num(player.gpm),
    kills: num(player.kills),
    deaths: num(player.deaths),
    assists: num(player.assists),
    inventory: normalizeInventory(payload.items),
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
  return `"Dota Open Overlay"
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
        "items"      "1"
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
