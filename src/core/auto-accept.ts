export type AutoAcceptState = 'disabled' | 'armed' | 'detected' | 'cooldown';
export type AutoAcceptResult = 'disabled' | 'armed' | 'detected' | 'manual-required' | 'cooldown' | 'panic';

export interface AutoAcceptConfig { enabled: boolean; cooldownSeconds: number; }
export interface AutoAcceptSnapshot { state: AutoAcceptState; detectedAt: number | null; cooldownUntil: number | null; actionsTaken: 0; }

// Segurança: este módulo nunca envia clique, tecla ou comando para o Steam/Dota.
// Ele somente controla o alerta e exige confirmação humana fora do módulo.
export function createAutoAcceptController(config: AutoAcceptConfig, now = Date.now()) {
  let state: AutoAcceptState = config.enabled ? 'armed' : 'disabled';
  let detectedAt: number | null = null;
  let cooldownUntil: number | null = null;
  const snapshot = (): AutoAcceptSnapshot => ({ state, detectedAt, cooldownUntil, actionsTaken: 0 });
  return {
    getState: snapshot,
    arm(): AutoAcceptResult { if (!config.enabled) return 'disabled'; if (state === 'cooldown') return 'cooldown'; state = 'armed'; return 'armed'; },
    detect(at = Date.now()): AutoAcceptResult {
      if (!config.enabled || state === 'disabled') return 'disabled';
      if (cooldownUntil !== null && at < cooldownUntil) { state = 'cooldown'; return 'cooldown'; }
      state = 'detected'; detectedAt = at; return 'detected';
    },
    confirmManually(at = Date.now()): AutoAcceptResult {
      if (state !== 'detected') return state === 'cooldown' ? 'cooldown' : 'disabled';
      state = 'cooldown'; cooldownUntil = at + Math.max(1, config.cooldownSeconds) * 1000; return 'manual-required';
    },
    panic(): AutoAcceptResult { state = 'disabled'; detectedAt = null; cooldownUntil = null; return 'panic'; },
  };
}
