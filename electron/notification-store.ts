import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NotificationConfig, NotificationMode, NotificationRule } from '../src/shared/contracts';
import { copyNotificationPresets } from '../src/core/notification-presets';

export const MAX_NOTIFICATION_RULES = 200;
const MAX_TITLE = 80;
const MAX_TAGS = 8;
const DEFAULT_CONFIG: NotificationConfig = {
  schemaVersion: 1,
  mode: 'normal',
  rules: copyNotificationPresets().find(preset => preset.mode === 'normal')!.rules,
};

const copyRule = (rule: NotificationRule): NotificationRule => ({ ...rule, tags: [...rule.tags] });
const copyConfig = (config: NotificationConfig): NotificationConfig => ({ ...config, rules: config.rules.map(copyRule) });
export const defaultNotificationConfig = (): NotificationConfig => copyConfig(DEFAULT_CONFIG);

function validateString(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new Error(`${label} inválido.`);
  return value.trim();
}

export function validateNotificationRule(value: unknown): NotificationRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Regra inválida.');
  const raw = value as Record<string, unknown>;
  const id = validateString(raw.id, 'Identificador', 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Identificador deve usar apenas letras, números, hífen ou sublinhado.');
  if (typeof raw.enabled !== 'boolean') throw new Error('Estado da regra inválido.');
  const title = validateString(raw.title, 'Título', MAX_TITLE);
  if (!Number.isInteger(raw.atSeconds) || Number(raw.atSeconds) < -300 || Number(raw.atSeconds) > 14_400)
    throw new Error('Tempo deve ficar entre -05:00 e 240:00.');
  const position = raw.position;
  if (position !== 'all' && (!Number.isInteger(position) || Number(position) < 1 || Number(position) > 5))
    throw new Error('Posição inválida.');
  if (!Array.isArray(raw.tags) || raw.tags.length > MAX_TAGS) throw new Error('Tags inválidas.');
  const tags = raw.tags.map(tag => validateString(tag, 'Tag', 24).toLowerCase());
  if (new Set(tags).size !== tags.length) throw new Error('Tags duplicadas.');
  const repeat = raw.repeatEverySeconds;
  if (repeat !== null && (!Number.isInteger(repeat) || Number(repeat) < 10 || Number(repeat) > 7200))
    throw new Error('Repetição inválida.');
  const until = raw.repeatUntilSeconds;
  if (until !== null && (!Number.isInteger(until) || Number(until) < Number(raw.atSeconds) || Number(until) > 14_400))
    throw new Error('Limite de repetição inválido.');
  if (repeat === null && until !== null) throw new Error('Limite requer uma repetição.');
  if (!Number.isInteger(raw.durationSeconds) || Number(raw.durationSeconds) < 2 || Number(raw.durationSeconds) > 30)
    throw new Error('Duração deve ficar entre 2 e 30 segundos.');
  if (raw.audio !== 'silent' && raw.audio !== 'beep') throw new Error('Modo de áudio inválido.');
  return { id, enabled: raw.enabled, title, atSeconds: Number(raw.atSeconds), position: position as NotificationRule['position'],
    tags, repeatEverySeconds: repeat as number | null, repeatUntilSeconds: until as number | null,
    durationSeconds: Number(raw.durationSeconds), audio: raw.audio };
}

export function validateNotificationConfig(value: unknown): NotificationConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Backup inválido.');
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 1) throw new Error('Versão de backup não suportada.');
  if (raw.mode !== 'normal' && raw.mode !== 'turbo') throw new Error('Modo inválido.');
  if (!Array.isArray(raw.rules) || raw.rules.length > MAX_NOTIFICATION_RULES) throw new Error(`O backup excede ${MAX_NOTIFICATION_RULES} regras.`);
  const rules = raw.rules.map(validateNotificationRule);
  if (new Set(rules.map(rule => rule.id)).size !== rules.length) throw new Error('O backup contém identificadores duplicados.');
  return { schemaVersion: 1, mode: raw.mode, rules };
}

export interface NotificationStore {
  get(): NotificationConfig;
  replace(config: unknown): NotificationConfig;
  upsert(rule: unknown): NotificationConfig;
  remove(id: string): NotificationConfig;
  setMode(mode: NotificationMode): NotificationConfig;
  applyPreset(id: string): NotificationConfig;
}

export function createNotificationStore(filePath: string, options: {
  persist?: (filePath: string, candidate: NotificationConfig) => void;
} = {}): NotificationStore {
  let config = defaultNotificationConfig();
  try { config = validateNotificationConfig(JSON.parse(fs.readFileSync(filePath, 'utf8'))); }
  catch { /* Primeiro uso, arquivo corrompido ou versão futura: mantém padrão seguro. */ }
  const persistCandidate = (candidate: NotificationConfig): void => {
    if (options.persist) { options.persist(filePath, copyConfig(candidate)); return; }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(candidate, null, 2), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(temporary, filePath);
    } catch (error) {
      try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch { /* Preserva o erro original. */ }
      throw error;
    }
  };
  const update = (next: NotificationConfig): NotificationConfig => {
    const candidate = copyConfig(next);
    persistCandidate(candidate);
    config = candidate;
    return copyConfig(config);
  };
  return {
    get: () => copyConfig(config),
    replace(value) { return update(validateNotificationConfig(value)); },
    upsert(value) {
      const rule = validateNotificationRule(value);
      const existing = config.rules.findIndex(item => item.id === rule.id);
      const rules = config.rules.map(copyRule);
      if (existing >= 0) rules[existing] = rule;
      else {
        if (rules.length >= MAX_NOTIFICATION_RULES) throw new Error(`Limite de ${MAX_NOTIFICATION_RULES} regras atingido.`);
        rules.push(rule);
      }
      return update({ ...config, rules });
    },
    remove(id) {
      if (typeof id !== 'string') throw new Error('Identificador inválido.');
      return update({ ...config, rules: config.rules.filter(rule => rule.id !== id) });
    },
    setMode(mode) {
      if (mode !== 'normal' && mode !== 'turbo') throw new Error('Modo inválido.');
      return update({ ...config, mode });
    },
    applyPreset(id) {
      const preset = copyNotificationPresets().find(item => item.id === id);
      if (!preset) throw new Error('Preset inexistente.');
      return update({ schemaVersion: 1, mode: preset.mode, rules: preset.rules });
    },
  };
}
