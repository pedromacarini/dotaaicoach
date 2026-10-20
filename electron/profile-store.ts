import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LocalProfile, Position } from '../src/shared/contracts';

const validPosition = (value: unknown): value is Position => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
const fresh = (): LocalProfile => { const now = new Date().toISOString(); return { schemaVersion: 1, localId: crypto.randomUUID(), displayName: 'Jogador local', preferredPosition: 1, createdAt: now, updatedAt: now }; };
function normalize(value: unknown, fallback = fresh()): LocalProfile {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const displayName = typeof raw.displayName === 'string' && raw.displayName.trim() ? raw.displayName.trim().slice(0, 40) : fallback.displayName;
  return { schemaVersion: 1, localId: typeof raw.localId === 'string' && raw.localId ? raw.localId : fallback.localId,
    displayName, preferredPosition: validPosition(raw.preferredPosition) ? raw.preferredPosition : fallback.preferredPosition,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : fallback.createdAt, updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : fallback.updatedAt };
}
export interface ProfileStore { get(): LocalProfile; update(patch: unknown): LocalProfile; }
export function createProfileStore(filePath: string): ProfileStore {
  let profile = fresh();
  try { profile = normalize(JSON.parse(fs.readFileSync(filePath, 'utf8')), profile); } catch { /* Primeiro uso. */ }
  const persist = (): void => { fs.mkdirSync(path.dirname(filePath), { recursive: true }); const tmp = `${filePath}.tmp`; fs.writeFileSync(tmp, JSON.stringify(profile, null, 2), { encoding: 'utf8', mode: 0o600 }); fs.renameSync(tmp, filePath); };
  return { get: () => ({ ...profile }), update(patch) { const raw = patch && typeof patch === 'object' ? patch as Record<string, unknown> : {}; profile = normalize({ ...profile, ...raw, updatedAt: new Date().toISOString() }, profile); persist(); return { ...profile }; } };
}
