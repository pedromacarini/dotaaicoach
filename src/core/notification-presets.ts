import type { NotificationPreset, NotificationRule } from '../shared/contracts';

const rule = (value: NotificationRule): NotificationRule => value;

/**
 * Authorial, editable starting points. Their patch label deliberately follows the
 * local catalog snapshot; it is not a claim that the installed Dota client uses it.
 */
export const NOTIFICATION_PRESETS: NotificationPreset[] = [
  {
    id: 'normal-7.41-community', name: 'Cronograma padrão', patch: '7.41 (catálogo local)', mode: 'normal',
    description: 'Lembretes editáveis de mapa. Confira os tempos após cada atualização do Dota 2.',
    rules: [
      rule({ id: 'normal-power-rune', enabled: true, title: 'Runa de poder', atSeconds: 360, position: 'all', tags: ['runa', 'rio'], repeatEverySeconds: 120, repeatUntilSeconds: 3600, durationSeconds: 8, audio: 'silent' }),
      rule({ id: 'normal-wisdom-rune', enabled: true, title: 'Runa da Sabedoria', atSeconds: 420, position: 'all', tags: ['runa', 'xp'], repeatEverySeconds: 420, repeatUntilSeconds: 3360, durationSeconds: 8, audio: 'silent' }),
      rule({ id: 'normal-stack', enabled: true, title: 'Hora de fazer stack', atSeconds: 53, position: 'all', tags: ['farm', 'stack'], repeatEverySeconds: 60, repeatUntilSeconds: 3593, durationSeconds: 6, audio: 'silent' }),
      rule({ id: 'normal-tormentor', enabled: true, title: 'Avaliar Tormentor', atSeconds: 1200, position: 'all', tags: ['objetivo', 'time'], repeatEverySeconds: null, repeatUntilSeconds: null, durationSeconds: 10, audio: 'silent' }),
    ],
  },
  {
    id: 'turbo-7.41-community', name: 'Turbo essencial', patch: '7.41 (catálogo local)', mode: 'turbo',
    description: 'Conjunto curto e conservador para Turbo; revise os tempos nas notas do modo.',
    rules: [
      rule({ id: 'turbo-power-rune', enabled: true, title: 'Runa de poder', atSeconds: 360, position: 'all', tags: ['runa', 'turbo'], repeatEverySeconds: 120, repeatUntilSeconds: 2400, durationSeconds: 7, audio: 'silent' }),
      rule({ id: 'turbo-stack', enabled: true, title: 'Janela de stack', atSeconds: 53, position: 'all', tags: ['farm', 'stack', 'turbo'], repeatEverySeconds: 60, repeatUntilSeconds: 2393, durationSeconds: 5, audio: 'silent' }),
      rule({ id: 'turbo-objective', enabled: true, title: 'Reavaliar objetivos do mapa', atSeconds: 600, position: 'all', tags: ['objetivo', 'turbo'], repeatEverySeconds: 300, repeatUntilSeconds: 2400, durationSeconds: 8, audio: 'silent' }),
    ],
  },
];

export function copyNotificationPresets(): NotificationPreset[] {
  return NOTIFICATION_PRESETS.map(preset => ({ ...preset, rules: preset.rules.map(item => ({ ...item, tags: [...item.tags] })) }));
}
