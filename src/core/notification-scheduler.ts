import type { NotificationBanner, NotificationMode, NotificationPosition, NotificationRule, Position } from '../shared/contracts';

export interface NotificationScheduler {
  advance(gameTime: number, rules: NotificationRule[], context: { mode: NotificationMode; position: Position }, now?: number): NotificationBanner[];
  reset(): void;
}

export const MAX_GAME_TIME_SECONDS = 14_400;
export const MAX_OCCURRENCES_PER_ADVANCE = 64;

const appliesToPosition = (rulePosition: NotificationPosition, position: Position): boolean =>
  rulePosition === 'all' || rulePosition === position;

export function scheduledTimes(rule: NotificationRule, fromExclusive: number, toInclusive: number, maximum = 200): number[] {
  if (!rule.enabled || toInclusive < rule.atSeconds) return [];
  const result: number[] = [];
  if (rule.repeatEverySeconds === null) {
    if (rule.atSeconds > fromExclusive && rule.atSeconds <= toInclusive) result.push(rule.atSeconds);
    return result;
  }
  // An omitted end remains useful: repeat until the global 240-minute clock ceiling.
  const final = rule.repeatUntilSeconds ?? MAX_GAME_TIME_SECONDS;
  const startIndex = Math.max(0, Math.floor((fromExclusive - rule.atSeconds) / rule.repeatEverySeconds) + 1);
  const endIndex = Math.floor((Math.min(toInclusive, final) - rule.atSeconds) / rule.repeatEverySeconds);
  for (let index = startIndex; index <= endIndex && result.length < maximum; index++)
    result.push(rule.atSeconds + index * rule.repeatEverySeconds);
  return result;
}

/** Clock-driven and deterministic: duplicate packets and clock regressions never refire an occurrence. */
export function createNotificationScheduler(): NotificationScheduler {
  let previousTime: number | null = null;
  const fired = new Set<string>();
  return {
    advance(gameTime, rules, context, now = Date.now()) {
      if (!Number.isFinite(gameTime)) return [];
      const from = previousTime === null ? gameTime - 3 : Math.min(previousTime, gameTime);
      previousTime = gameTime;
      const banners: NotificationBanner[] = [];
      for (const rule of rules) {
        if (banners.length >= MAX_OCCURRENCES_PER_ADVANCE) break;
        if (!appliesToPosition(rule.position, context.position)) continue;
        for (const scheduledAt of scheduledTimes(rule, from, gameTime, MAX_OCCURRENCES_PER_ADVANCE - banners.length)) {
          const occurrence = `${context.mode}:${rule.id}:${scheduledAt}`;
          if (fired.has(occurrence)) continue;
          fired.add(occurrence);
          banners.push({
            id: occurrence, ruleId: rule.id, title: rule.title, scheduledAt,
            tags: [...rule.tags], expiresAt: now + rule.durationSeconds * 1000, audio: rule.audio,
          });
          if (banners.length >= MAX_OCCURRENCES_PER_ADVANCE) break;
        }
      }
      return banners.sort((left, right) => left.scheduledAt - right.scheduledAt || left.ruleId.localeCompare(right.ruleId));
    },
    reset() { previousTime = null; fired.clear(); },
  };
}
