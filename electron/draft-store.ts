import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DraftScenario, DraftScenarioState } from '../src/shared/contracts';
import { validateDraftScenario } from '../src/core/draft-advisor';

export const MAX_SAVED_DRAFTS = 20;
const initialScenario = (): DraftScenario => ({
  id: 'draft-default', name: 'Meu draft', mode: 'all-pick', position: 1,
  allies: [], enemies: [], bans: [], updatedAt: 0,
});
const copyScenario = (scenario: DraftScenario): DraftScenario => ({ ...scenario,
  allies: [...scenario.allies], enemies: [...scenario.enemies], bans: [...scenario.bans] });
const copyState = (state: DraftScenarioState): DraftScenarioState => ({
  schemaVersion: 1, current: copyScenario(state.current), saved: state.saved.map(copyScenario),
});

export function validateDraftState(value: unknown): DraftScenarioState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Arquivo de drafts inválido.');
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.saved) || raw.saved.length > MAX_SAVED_DRAFTS)
    throw new Error('Versão ou quantidade de drafts inválida.');
  const current = validateDraftScenario(raw.current);
  const saved = raw.saved.map(value => validateDraftScenario(value));
  if (new Set(saved.map(scenario => scenario.id)).size !== saved.length) throw new Error('Drafts duplicados.');
  return { schemaVersion: 1, current, saved };
}

export interface DraftStore {
  get(): DraftScenarioState;
  setCurrent(value: unknown): DraftScenarioState;
  save(value: unknown): DraftScenarioState;
  remove(id: string): DraftScenarioState;
}

export function createDraftStore(filePath: string, options: {
  persist?: (filePath: string, candidate: DraftScenarioState) => void;
} = {}): DraftStore {
  let state: DraftScenarioState = { schemaVersion: 1, current: initialScenario(), saved: [] };
  try { state = validateDraftState(JSON.parse(fs.readFileSync(filePath, 'utf8'))); }
  catch { /* Primeiro uso, corrupção ou versão futura: estado seguro. */ }
  const persist = (candidate: DraftScenarioState): DraftScenarioState => {
    const validated = validateDraftState(candidate);
    if (options.persist) options.persist(filePath, copyState(validated));
    else {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const temporary = `${filePath}.tmp`;
      try {
        fs.writeFileSync(temporary, JSON.stringify(validated, null, 2), { encoding: 'utf8', mode: 0o600 });
        fs.renameSync(temporary, filePath);
      } catch (error) {
        try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch { /* Preserva erro original. */ }
        throw error;
      }
    }
    state = copyState(validated);
    return copyState(state);
  };
  return {
    get: () => copyState(state),
    setCurrent(value) { return persist({ ...state, current: validateDraftScenario(value) }); },
    save(value) {
      const scenario = validateDraftScenario(value);
      const existing = state.saved.findIndex(candidate => candidate.id === scenario.id);
      const saved = state.saved.map(copyScenario);
      if (existing >= 0) saved[existing] = scenario;
      else {
        if (saved.length >= MAX_SAVED_DRAFTS) throw new Error(`Limite de ${MAX_SAVED_DRAFTS} cenários atingido.`);
        saved.push(scenario);
      }
      saved.sort((left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name));
      return persist({ schemaVersion: 1, current: scenario, saved });
    },
    remove(id) {
      if (typeof id !== 'string') throw new Error('Identificador inválido.');
      return persist({ ...state, saved: state.saved.filter(scenario => scenario.id !== id) });
    },
  };
}
