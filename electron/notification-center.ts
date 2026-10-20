import type { NotificationBanner, NotificationCenterState, NotificationConfig, NotificationContextEvent, Position } from '../src/shared/contracts';
import { copyNotificationPresets } from '../src/core/notification-presets';
import { createNotificationScheduler } from '../src/core/notification-scheduler';
import type { NotificationStore } from './notification-store';

export interface NotificationCenter {
  getState(now?: number): NotificationCenterState;
  acceptGameTime(gameTime: number | null, now?: number, sessionIdentity?: string | null, disconnectedBoundary?: boolean): boolean;
  acceptContext(event: NotificationContextEvent, now?: number): boolean;
  setSimulatedTime(gameTime: number | null, now?: number): boolean;
  configurationChanged(config: NotificationConfig, now?: number): void;
  dismiss(id: string): boolean;
  expire(now?: number): boolean;
}

export function createNotificationCenter(options: {
  store: NotificationStore;
  getPosition: () => Position;
  getAlertsEnabled: () => boolean;
  onSound: () => void;
}): NotificationCenter {
  const { store, getPosition, getAlertsEnabled, onSound } = options;
  const scheduler = createNotificationScheduler();
  let active: NotificationBanner[] = [];
  let gameTime: number | null = null;
  let simulated = false;
  let previousObservedTime: number | null = null;
  let previousSessionIdentity: string | null = null;
  let boundaryPending = false;
  const contextFired = new Set<string>();

  const expire = (now = Date.now()): boolean => {
    const next = active.filter(banner => banner.expiresAt > now);
    if (next.length === active.length) return false;
    active = next;
    return true;
  };
  const advance = (time: number, now: number): boolean => {
    const expired = expire(now);
    const config = store.get();
    const banners = scheduler.advance(time, config.rules, { mode: config.mode, position: getPosition() }, now);
    if (!banners.length) return expired;
    const existing = new Set(active.map(banner => banner.id));
    active = [...active, ...banners.filter(banner => !existing.has(banner.id))]
      .sort((left, right) => right.scheduledAt - left.scheduledAt)
      .slice(0, 6);
    if (getAlertsEnabled() && banners.some(banner => banner.audio === 'beep')) onSound();
    return true;
  };
  return {
    getState(now = Date.now()) {
      expire(now);
      return { config: store.get(), presets: copyNotificationPresets(), runtime: {
        gameTime, simulated, active: active.map(banner => ({ ...banner, tags: [...banner.tags] })),
      } };
    },
    acceptGameTime(time, now = Date.now(), sessionIdentity = null, disconnectedBoundary = false) {
      if (simulated) return false;
      const timeChanged = gameTime !== time;
      if (disconnectedBoundary) boundaryPending = true;
      const identityChanged = sessionIdentity !== null && previousSessionIdentity !== null &&
        sessionIdentity !== previousSessionIdentity;
      const sameReliableIdentity = sessionIdentity !== null && previousSessionIdentity !== null &&
        sessionIdentity === previousSessionIdentity;
      const disconnectedWithoutIdentity = boundaryPending && !sameReliableIdentity;
      const returnedToStart = time !== null && previousObservedTime !== null && previousObservedTime > 30 &&
        time <= 0 && previousObservedTime - time > 30;
      if (time !== null && (identityChanged || disconnectedWithoutIdentity || returnedToStart)) {
        scheduler.reset();
        active = [];
      }
      if (sessionIdentity !== null) previousSessionIdentity = sessionIdentity;
      if (time !== null) { previousObservedTime = time; boundaryPending = false; }
      gameTime = time;
      return (time === null ? expire(now) : advance(time, now)) || timeChanged || identityChanged || returnedToStart;
    },
    acceptContext(event, now = Date.now()) {
      if (!event.id || contextFired.has(event.id)) return false;
      contextFired.add(event.id);
      expire(now);
      const banner: NotificationBanner = { id: event.id, ruleId: `context:${event.id}`, title: event.title,
        scheduledAt: event.scheduledAt ?? gameTime ?? 0, tags: [...event.tags],
        expiresAt: now + Math.max(1, event.durationSeconds) * 1000, audio: event.audio };
      active = [banner, ...active.filter(item => item.id !== banner.id)].slice(0, 6);
      if (getAlertsEnabled() && event.audio === 'beep') onSound();
      return true;
    },
    setSimulatedTime(time, now = Date.now()) {
      simulated = time !== null;
      gameTime = time;
      active = [];
      scheduler.reset();
      if (time !== null) advance(time, now);
      return true;
    },
    configurationChanged(_config, now = Date.now()) {
      active = [];
      scheduler.reset();
      if (gameTime !== null) advance(gameTime, now);
    },
    dismiss(id) {
      const next = active.filter(banner => banner.id !== id);
      if (next.length === active.length) return false;
      active = next;
      return true;
    },
    expire,
  };
}
