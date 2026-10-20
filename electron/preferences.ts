import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AppPreferences, OverlayLayout, OverlayLayoutPatch, Position } from '../src/shared/contracts';

const SCHEMA_VERSION = 2 as const;
const DEFAULT_LAYOUT: OverlayLayout = {
  x: null,
  y: null,
  scale: 1,
  opacity: 1,
  locked: false,
  modules: { stats: true, skill: true, items: true, alerts: true },
};
const DEFAULTS: AppPreferences = { schemaVersion: SCHEMA_VERSION, position: 1, overlayLayout: DEFAULT_LAYOUT };
const isPosition = (value: unknown): value is Position =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
const isFiniteCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && Math.abs(value) <= 100_000;
const isWithin = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;

const copy = (preferences: AppPreferences): AppPreferences => ({
  ...preferences,
  overlayLayout: { ...preferences.overlayLayout, modules: { ...preferences.overlayLayout.modules } },
});

export function defaultPreferences(): AppPreferences { return copy(DEFAULTS); }

/** Tolerant migration: an invalid field falls back independently instead of discarding the file. */
export function normalizePreferences(saved: unknown): AppPreferences {
  if (!saved || typeof saved !== 'object') return defaultPreferences();
  const source = saved as Record<string, unknown>;
  const rawLayout = source.overlayLayout && typeof source.overlayLayout === 'object'
    ? source.overlayLayout as Record<string, unknown> : {};
  const rawModules = rawLayout.modules && typeof rawLayout.modules === 'object'
    ? rawLayout.modules as Record<string, unknown> : {};
  const booleanOr = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback;
  return {
    schemaVersion: SCHEMA_VERSION,
    position: isPosition(source.position) ? source.position : DEFAULTS.position,
    overlayLayout: {
      x: rawLayout.x === null || isFiniteCoordinate(rawLayout.x) ? rawLayout.x as number | null : DEFAULT_LAYOUT.x,
      y: rawLayout.y === null || isFiniteCoordinate(rawLayout.y) ? rawLayout.y as number | null : DEFAULT_LAYOUT.y,
      scale: isWithin(rawLayout.scale, .75, 1.75) ? rawLayout.scale : DEFAULT_LAYOUT.scale,
      opacity: isWithin(rawLayout.opacity, .35, 1) ? rawLayout.opacity : DEFAULT_LAYOUT.opacity,
      locked: booleanOr(rawLayout.locked, DEFAULT_LAYOUT.locked),
      modules: {
        stats: booleanOr(rawModules.stats, DEFAULT_LAYOUT.modules.stats),
        skill: booleanOr(rawModules.skill, DEFAULT_LAYOUT.modules.skill),
        items: booleanOr(rawModules.items, DEFAULT_LAYOUT.modules.items),
        alerts: booleanOr(rawModules.alerts, DEFAULT_LAYOUT.modules.alerts),
      },
    },
  };
}

function mergeLayout(layout: OverlayLayout, patch: OverlayLayoutPatch): OverlayLayout {
  if (!patch || typeof patch !== 'object') throw new Error('Layout inválido.');
  if (patch.x !== undefined && patch.x !== null && !isFiniteCoordinate(patch.x)) throw new Error('Posição X inválida.');
  if (patch.y !== undefined && patch.y !== null && !isFiniteCoordinate(patch.y)) throw new Error('Posição Y inválida.');
  if (patch.scale !== undefined && !isWithin(patch.scale, .75, 1.75)) throw new Error('Escala inválida.');
  if (patch.opacity !== undefined && !isWithin(patch.opacity, .35, 1)) throw new Error('Opacidade inválida.');
  if (patch.locked !== undefined && typeof patch.locked !== 'boolean') throw new Error('Bloqueio inválido.');
  if (patch.modules !== undefined && (!patch.modules || typeof patch.modules !== 'object')) throw new Error('Módulos inválidos.');
  const modules = { ...layout.modules };
  if (patch.modules) for (const key of ['stats', 'skill', 'items', 'alerts'] as const) {
    const value = patch.modules[key];
    if (value !== undefined && typeof value !== 'boolean') throw new Error(`Visibilidade de ${key} inválida.`);
    if (value !== undefined) modules[key] = value;
  }
  return {
    ...layout,
    ...(patch.x !== undefined ? { x: patch.x } : {}),
    ...(patch.y !== undefined ? { y: patch.y } : {}),
    ...(patch.scale !== undefined ? { scale: patch.scale } : {}),
    ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
    ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
    modules,
  };
}

export interface PreferencesStore {
  get(): AppPreferences;
  setPosition(position: Position): AppPreferences;
  updateOverlayLayout(patch: OverlayLayoutPatch): AppPreferences;
  resetOverlayLayout(): AppPreferences;
  flush(): void;
  dispose(): void;
}

export function createPreferencesStore(filePath: string, options: { debounceMs?: number } = {}): PreferencesStore {
  let preferences = defaultPreferences();
  let saveTimer: NodeJS.Timeout | null = null;
  try {
    const saved: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    preferences = normalizePreferences(saved);
  } catch { /* Primeiro uso ou arquivo inválido: mantém padrão seguro. */ }

  const persist = (): void => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(preferences, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, filePath);
  };
  const persistSoon = (): void => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, options.debounceMs ?? 250);
    saveTimer.unref();
  };

  return {
    get: () => copy(preferences),
    setPosition(position) {
      if (!isPosition(position)) throw new Error('Posição inválida.');
      preferences = { ...preferences, position };
      persist();
      return copy(preferences);
    },
    updateOverlayLayout(patch) {
      preferences = { ...preferences, overlayLayout: mergeLayout(preferences.overlayLayout, patch) };
      persistSoon();
      return copy(preferences);
    },
    resetOverlayLayout() {
      preferences = { ...preferences, overlayLayout: { ...DEFAULT_LAYOUT, modules: { ...DEFAULT_LAYOUT.modules } } };
      persist();
      return copy(preferences);
    },
    flush: persist,
    dispose: persist,
  };
}
