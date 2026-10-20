import type { BrowserWindow, Display, Rectangle, Screen } from 'electron';
import type { AppPreferences, OverlayLayout } from '../src/shared/contracts';
import type { PreferencesStore } from './preferences';

export const OVERLAY_BASE_WIDTH = 430;
export const OVERLAY_BASE_HEIGHT = 314;
export const OVERLAY_MIN_SCALE = .75;
export const OVERLAY_MAX_SCALE = 1.75;

type ScreenAdapter = Pick<Screen, 'getPrimaryDisplay' | 'getDisplayMatching' | 'on' | 'off'>;

function roundedScale(value: number): number {
  return Math.max(OVERLAY_MIN_SCALE, Math.min(OVERLAY_MAX_SCALE, Math.round(value * 100) / 100));
}

export function resolveOverlayBounds(layout: OverlayLayout, workArea: Rectangle): { bounds: Rectangle; effectiveScale: number } {
  const availableScale = Math.max(0, Math.min(workArea.width / OVERLAY_BASE_WIDTH, workArea.height / OVERLAY_BASE_HEIGHT));
  // Tiny/virtual work areas may require a render scale below the user-facing minimum.
  // It is a transient fit value and must never overwrite the configured preference.
  const effectiveScale = Math.min(roundedScale(layout.scale), availableScale);
  const width = Math.max(1, Math.min(workArea.width, Math.round(OVERLAY_BASE_WIDTH * effectiveScale)));
  const height = Math.max(1, Math.min(workArea.height, Math.round(OVERLAY_BASE_HEIGHT * effectiveScale)));
  const preferredX = layout.x ?? workArea.x + workArea.width - width - 22;
  const preferredY = layout.y ?? workArea.y + 22;
  const x = Math.round(Math.max(workArea.x, Math.min(preferredX, workArea.x + workArea.width - width)));
  const y = Math.round(Math.max(workArea.y, Math.min(preferredY, workArea.y + workArea.height - height)));
  return { bounds: { x, y, width, height }, effectiveScale };
}

export interface OverlayWindowController {
  apply(): AppPreferences;
  setEditing(editing: boolean): void;
  resize(scale: number): AppPreferences;
  isEditing(): boolean;
  dispose(): void;
}

/**
 * Deep module for every native overlay-window invariant. Renderers only edit preferences;
 * clamping, DPI-safe logical bounds and click-through stay on the Electron side.
 */
export function createOverlayWindowController(options: {
  window: BrowserWindow;
  screen: ScreenAdapter;
  store: PreferencesStore;
  isVisibleDesired: () => boolean;
  onPreferencesChanged: (preferences: AppPreferences) => void;
  onEditingChanged: (editing: boolean) => void;
  onEffectiveScaleChanged: (scale: number) => void;
}): OverlayWindowController {
  const { window, screen, store, isVisibleDesired, onPreferencesChanged, onEditingChanged, onEffectiveScaleChanged } = options;
  let editing = false;
  let boundsTimer: NodeJS.Timeout | null = null;
  let disposed = false;
  const sameLayout = (left: OverlayLayout, right: OverlayLayout): boolean =>
    left.x === right.x && left.y === right.y && left.scale === right.scale && left.opacity === right.opacity &&
    left.locked === right.locked && left.modules.stats === right.modules.stats &&
    left.modules.skill === right.modules.skill && left.modules.items === right.modules.items &&
    left.modules.alerts === right.modules.alerts;

  const displayFor = (layout: OverlayLayout): Display => {
    if (layout.x === null || layout.y === null) return screen.getPrimaryDisplay();
    const width = Math.round(OVERLAY_BASE_WIDTH * layout.scale);
    const height = Math.round(OVERLAY_BASE_HEIGHT * layout.scale);
    return screen.getDisplayMatching({ x: layout.x, y: layout.y, width, height });
  };

  const apply = (): AppPreferences => {
    const before = store.get();
    const resolved = resolveOverlayBounds(before.overlayLayout, displayFor(before.overlayLayout).workArea);
    let preferences = before;
    if (before.overlayLayout.x !== resolved.bounds.x || before.overlayLayout.y !== resolved.bounds.y)
      preferences = store.updateOverlayLayout({ x: resolved.bounds.x, y: resolved.bounds.y });
    window.setBounds(resolved.bounds, false);
    window.setOpacity(preferences.overlayLayout.opacity);
    onEffectiveScaleChanged(resolved.effectiveScale);
    // Electron documents transparent windows as non-resizable; resizing uses the
    // renderer handle -> this controller -> setBounds instead of unsupported OS chrome.
    window.setResizable(false);
    return preferences;
  };

  const syncBounds = (): void => {
    if (!editing || store.get().overlayLayout.locked || disposed || window.isDestroyed()) return;
    const actual = window.getBounds();
    const before = store.get();
    const candidate: OverlayLayout = { ...before.overlayLayout, x: actual.x, y: actual.y };
    const resolved = resolveOverlayBounds(candidate, screen.getDisplayMatching(actual).workArea);
    let preferences = before;
    if (before.overlayLayout.x !== resolved.bounds.x || before.overlayLayout.y !== resolved.bounds.y) {
      preferences = store.updateOverlayLayout({ x: resolved.bounds.x, y: resolved.bounds.y });
      onPreferencesChanged(preferences);
    }
    if (actual.x !== resolved.bounds.x || actual.y !== resolved.bounds.y ||
        actual.width !== resolved.bounds.width || actual.height !== resolved.bounds.height) apply();
  };

  const scheduleBoundsSync = (): void => {
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(syncBounds, 120);
    boundsTimer.unref();
  };
  const reconcileDisplays = (): void => {
    if (disposed || window.isDestroyed()) return;
    const before = store.get();
    const after = apply();
    if (!sameLayout(before.overlayLayout, after.overlayLayout)) onPreferencesChanged(after);
  };
  const displayAdded = (): void => reconcileDisplays();
  const displayRemoved = (): void => reconcileDisplays();
  const displayMetricsChanged = (): void => reconcileDisplays();

  window.on('moved', scheduleBoundsSync);
  window.on('resized', scheduleBoundsSync);
  screen.on('display-added', displayAdded);
  screen.on('display-removed', displayRemoved);
  screen.on('display-metrics-changed', displayMetricsChanged);

  return {
    apply,
    setEditing(value) {
      if (disposed || window.isDestroyed()) return;
      const changed = editing !== value;
      editing = value;
      window.setResizable(false);
      window.setFocusable(editing);
      window.setIgnoreMouseEvents(!editing, editing ? undefined : { forward: true });
      if (editing) { window.show(); window.focus(); }
      else if (isVisibleDesired()) window.showInactive();
      else window.hide();
      if (changed) onEditingChanged(editing);
    },
    resize(scale) {
      if (!editing) throw new Error('O modo de edição não está ativo.');
      if (store.get().overlayLayout.locked) throw new Error('A posição e o tamanho estão bloqueados.');
      const before = store.get();
      store.updateOverlayLayout({ scale });
      const preferences = apply();
      if (!sameLayout(before.overlayLayout, preferences.overlayLayout)) onPreferencesChanged(preferences);
      return preferences;
    },
    isEditing: () => editing,
    dispose() {
      disposed = true;
      if (boundsTimer) clearTimeout(boundsTimer);
      window.off('moved', scheduleBoundsSync);
      window.off('resized', scheduleBoundsSync);
      screen.off('display-added', displayAdded);
      screen.off('display-removed', displayRemoved);
      screen.off('display-metrics-changed', displayMetricsChanged);
    },
  };
}
