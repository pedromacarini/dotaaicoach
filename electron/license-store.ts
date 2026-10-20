import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import type { LicenseStatus } from '../src/shared/contracts';

const PUBLIC_KEY = Buffer.from('MCowBQYDK2VwAyEAilqNFhdk5IbHQ3ee2MU76rv6kGfRWg1w4CwNc/KSukY=', 'base64');
type LicensePayload = { schemaVersion: 1; licenseId: string; subject: string; plan: 'premium'; issuedAt: string; expiresAt: string | null; features: string[] };
const free = (reason: string): LicenseStatus => ({ valid: false, plan: 'free', subject: null, expiresAt: null, features: [], reason });
export function verifyLicense(value: unknown, now = new Date()): LicenseStatus {
  if (!value || typeof value !== 'object') return free('Nenhuma licença instalada.');
  const raw = value as Record<string, unknown>; const payload = raw.payload as LicensePayload; const signature = raw.signature;
  if (!payload || typeof signature !== 'string' || payload.schemaVersion !== 1 || payload.plan !== 'premium') return free('Formato de licença inválido.');
  let expires: Date | null = null;
  if (payload.expiresAt !== null) { expires = new Date(payload.expiresAt); if (!Number.isFinite(expires.getTime())) return free('Validade inválida.'); }
  const data = Buffer.from(JSON.stringify(payload));
  let validSignature = false; try { validSignature = crypto.verify(null, data, { key: PUBLIC_KEY, format: 'der', type: 'spki' }, Buffer.from(signature, 'base64')); } catch { validSignature = false; }
  if (!validSignature) return free('Assinatura inválida.');
  if (expires && expires <= now) return free('Licença expirada.');
  return { valid: true, plan: 'premium', subject: payload.subject, expiresAt: payload.expiresAt, features: [...payload.features], reason: 'Licença offline válida.' };
}
export interface LicenseStore { get(): LicenseStatus; importFile(filePath: string): LicenseStatus; }
export function createLicenseStore(filePath: string): LicenseStore {
  let status = free('Nenhuma licença instalada.');
  const load = (): void => { try { status = verifyLicense(JSON.parse(fs.readFileSync(filePath, 'utf8'))); } catch { status = free('Nenhuma licença instalada.'); } };
  load();
  return { get: () => ({ ...status, features: [...status.features] }), importFile(input) { const candidate = JSON.parse(fs.readFileSync(input, 'utf8')); const next = verifyLicense(candidate); if (!next.valid) throw new Error(next.reason); fs.mkdirSync(require('node:path').dirname(filePath), { recursive: true }); fs.copyFileSync(input, filePath); status = next; return { ...status, features: [...status.features] }; } };
}
