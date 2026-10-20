import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TelemetryEvent, TelemetryState } from '../src/shared/contracts';

const MAX_EVENTS = 500;

function fresh(): TelemetryState {
  return { schemaVersion: 1, enabled: false, events: [] };
}

function normalize(value: unknown): TelemetryState {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const events = Array.isArray(raw.events) ? raw.events.filter(item => {
    if (!item || typeof item !== 'object') return false;
    const event = item as Record<string, unknown>;
    return typeof event.name === 'string' && typeof event.at === 'string' && event.data && typeof event.data === 'object';
  }).slice(-MAX_EVENTS).map(item => {
    const event = item as Record<string, unknown>;
    const source = event.data as Record<string, unknown>;
    const data: TelemetryEvent['data'] = {};
    for (const [key, value] of Object.entries(source)) {
      if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') data[key] = value;
    }
    return { name: String(event.name).slice(0, 80), at: String(event.at), data };
  }) : [];
  return { schemaVersion: 1, enabled: raw.enabled === true, events };
}

export interface TelemetryStore {
  get(): TelemetryState;
  setEnabled(enabled: boolean): TelemetryState;
  record(name: string, data?: TelemetryEvent['data']): void;
  clear(): TelemetryState;
}

export function createTelemetryStore(filePath: string): TelemetryStore {
  let state = fresh();
  try { state = normalize(JSON.parse(fs.readFileSync(filePath, 'utf8'))); } catch { /* Primeiro uso. */ }
  const persist = (): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, filePath);
  };
  return {
    get: () => structuredClone(state),
    setEnabled(enabled) {
      state = { ...state, enabled: Boolean(enabled) };
      persist();
      return structuredClone(state);
    },
    record(name, data = {}) {
      if (!state.enabled) return;
      state = { ...state, events: [...state.events, { name: name.slice(0, 80), at: new Date().toISOString(), data }].slice(-MAX_EVENTS) };
      persist();
    },
    clear() {
      state = { ...state, events: [] };
      persist();
      return structuredClone(state);
    },
  };
}
