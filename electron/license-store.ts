import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import type { LicenseStatus } from '../src/shared/contracts';

const PUBLIC_KEY = Buffer.from('MCowBQYDK2VwAyEAilqNFhdk5IbHQ3ee2MU76rv6kGfRWg1w4CwNc/KSukY=', 'base64');
const ACTIVATION_CODES: Record<string, { subject: string; expiresAt: string }> = {
  '1bd0fbae8051a866df6c6897c13c22676bf1c99757d3f1961bfb5dc94b26ec97': {
    subject: 'tester-01', expiresAt: '2027-12-31T23:59:59.000Z',
  },
};
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
export interface LicenseStore { get(): LicenseStatus; importFile(filePath: string): LicenseStatus; activateCode(code: string): LicenseStatus; }
export function createLicenseStore(filePath: string, now: () => Date = () => new Date()): LicenseStore {
  let status = free('Nenhuma licença instalada.');
  const load = (): void => {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      if (raw.type === 'activation' && typeof raw.codeHash === 'string') {
        const activation = ACTIVATION_CODES[raw.codeHash];
        const expires = activation ? new Date(activation.expiresAt) : null;
        status = activation && expires && expires > now()
          ? { valid: true, plan: 'premium', subject: activation.subject, expiresAt: activation.expiresAt,
            features: ['voice', 'advanced-guides', 'premium-advisor'], reason: 'Código de ativação válido.' }
          : free('Código de ativação expirado.');
      } else status = verifyLicense(raw);
    } catch { status = free('Nenhuma licença instalada.'); }
  };
  load();
  return {
    get: () => ({ ...status, features: [...status.features] }),
    importFile(input) {
      const candidate = JSON.parse(fs.readFileSync(input, 'utf8'));
      const next = verifyLicense(candidate);
      if (!next.valid) throw new Error(next.reason);
      fs.mkdirSync(require('node:path').dirname(filePath), { recursive: true }); fs.copyFileSync(input, filePath); status = next;
      return { ...status, features: [...status.features] };
    },
    activateCode(input) {
      const code = String(input ?? '').trim().toUpperCase();
      const hash = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
      const activation = ACTIVATION_CODES[hash];
      if (!activation) throw new Error('Código de ativação inválido.');
      const expires = new Date(activation.expiresAt);
      if (expires <= now()) throw new Error('Código de ativação expirado.');
      status = { valid: true, plan: 'premium', subject: activation.subject, expiresAt: activation.expiresAt,
        features: ['voice', 'advanced-guides', 'premium-advisor'], reason: 'Código de ativação válido.' };
      fs.mkdirSync(require('node:path').dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify({ type: 'activation', codeHash: hash, ...activation }, null, 2), { encoding: 'utf8', mode: 0o600 });
      return { ...status, features: [...status.features] };
    },
  };
}
