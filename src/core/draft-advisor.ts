import type {
  DraftMatchupEvidence, DraftRecommendation, DraftScenario, Position,
} from '../shared/contracts';

export interface DraftHero {
  id: number;
  name: string;
  roles: string[];
  captainMode: boolean;
}

export const MIN_DRAFT_MATCHUP_SAMPLE = 20;
const REQUIRED_TEAM_ROLES = ['Carry', 'Support', 'Disabler', 'Initiator'];
const POSITION_ROLE: Record<Position, string> = { 1: 'Carry', 2: 'Nuker', 3: 'Initiator', 4: 'Disabler', 5: 'Support' };

const copyScenario = (scenario: DraftScenario): DraftScenario => ({
  ...scenario, allies: [...scenario.allies], enemies: [...scenario.enemies], bans: [...scenario.bans],
});

export function reconcileDraftScenario(scenario: DraftScenario, heroes: readonly DraftHero[]): {
  scenario: DraftScenario; removedHeroIds: number[];
} {
  const byId = new Map(heroes.map(hero => [hero.id, hero]));
  const allowed = (id: number): boolean => {
    const hero = byId.get(id);
    return Boolean(hero && (scenario.mode !== 'captains' || hero.captainMode));
  };
  const removedHeroIds = [...new Set([...scenario.allies, ...scenario.enemies, ...scenario.bans].filter(id => !allowed(id)))].sort((a,b)=>a-b);
  if (!removedHeroIds.length) return { scenario: copyScenario(scenario), removedHeroIds: [] };
  return { scenario: { ...copyScenario(scenario),
    allies: scenario.allies.filter(allowed), enemies: scenario.enemies.filter(allowed), bans: scenario.bans.filter(allowed) }, removedHeroIds };
}

export function shouldApplyDraftStoreEcho(localRevision: number, pendingSaveRevision: number | null): boolean {
  return localRevision === 0 || (pendingSaveRevision !== null && localRevision <= pendingSaveRevision);
}

export function validateDraftScenario(value: unknown, heroes?: readonly DraftHero[]): DraftScenario {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Cenário de draft inválido.');
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(raw.id)) throw new Error('Identificador do cenário inválido.');
  if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.trim().length > 60) throw new Error('Nome do cenário inválido.');
  if (raw.mode !== 'all-pick' && raw.mode !== 'turbo' && raw.mode !== 'captains') throw new Error('Modo de draft inválido.');
  if (!Number.isInteger(raw.position) || Number(raw.position) < 1 || Number(raw.position) > 5) throw new Error('Posição inválida.');
  const lists = ['allies', 'enemies', 'bans'] as const;
  const limits = { allies: 5, enemies: 5, bans: 24 };
  const parsed = {} as Record<(typeof lists)[number], number[]>;
  for (const list of lists) {
    if (!Array.isArray(raw[list]) || raw[list].length > limits[list] ||
      raw[list].some(id => !Number.isInteger(id) || Number(id) < 1 || Number(id) > 999))
      throw new Error(`Lista de ${list} inválida.`);
    parsed[list] = raw[list].map(Number);
    if (new Set(parsed[list]).size !== parsed[list].length) throw new Error(`Herói duplicado em ${list}.`);
  }
  const picked = [...parsed.allies, ...parsed.enemies];
  if (new Set(picked).size !== picked.length) throw new Error('Um herói não pode estar nos dois times.');
  if (parsed.bans.some(id => picked.includes(id))) throw new Error('Um herói não pode estar escolhido e banido.');
  if (heroes) {
    const byId = new Map(heroes.map(hero => [hero.id, hero]));
    for (const id of [...picked, ...parsed.bans]) if (!byId.has(id)) throw new Error(`Herói ${id} não existe no catálogo.`);
    if (raw.mode === 'captains') {
      const unavailable = [...picked, ...parsed.bans].map(id => byId.get(id)!).find(hero => !hero.captainMode);
      if (unavailable) throw new Error(`${unavailable.name} não está no pool de Captain's Mode do catálogo.`);
    }
  }
  if (!Number.isFinite(raw.updatedAt) || Number(raw.updatedAt) < 0) throw new Error('Data do cenário inválida.');
  return copyScenario({ id: raw.id, name: raw.name.trim(), mode: raw.mode, position: Number(raw.position) as Position,
    allies: parsed.allies, enemies: parsed.enemies, bans: parsed.bans, updatedAt: Number(raw.updatedAt) });
}

function roleCoverage(hero: DraftHero, allies: readonly DraftHero[], position: Position): DraftRecommendation['roleCoverage'] {
  const existing = new Set(allies.flatMap(ally => ally.roles));
  return {
    kind: 'heuristic',
    addedRoles: REQUIRED_TEAM_ROLES.filter(role => !existing.has(role) && hero.roles.includes(role)),
    positionRoleMatched: hero.roles.includes(POSITION_ROLE[position]),
  };
}

function statisticFor(candidateId: number, enemyIds: readonly number[], evidence: readonly DraftMatchupEvidence[]): DraftRecommendation['statistic'] {
  let games = 0, candidateWins = 0, opponentsCovered = 0;
  const sources = new Set<string>();
  const fetchedDates: string[] = [];
  const currentEnemies = new Set(enemyIds);
  const byEnemy = new Map<number, DraftMatchupEvidence>();
  const orderedEvidence = [...evidence].filter(value => currentEnemies.has(value.focalEnemyId))
    .sort((left,right) => right.fetchedAt.localeCompare(left.fetchedAt) || left.source.localeCompare(right.source));
  for (const matchup of orderedEvidence) if (!byEnemy.has(matchup.focalEnemyId)) byEnemy.set(matchup.focalEnemyId, matchup);
  for (const matchup of byEnemy.values()) {
    const row = matchup.rows.filter(value => value.heroId === candidateId && value.gamesPlayed >= MIN_DRAFT_MATCHUP_SAMPLE)
      .sort((left,right) => right.gamesPlayed-left.gamesPlayed || right.wins-left.wins)[0];
    if (!row) continue;
    games += row.gamesPlayed;
    candidateWins += row.gamesPlayed - row.wins;
    opponentsCovered++;
    sources.add(matchup.source);
    if (matchup.fetchedAt) fetchedDates.push(matchup.fetchedAt);
  }
  if (!games || !opponentsCovered) return null;
  const winRate = candidateWins / games;
  const coverage = enemyIds.length ? opponentsCovered / enemyIds.length : 0;
  const confidence = coverage === 1 && games >= 500 ? 'high' : coverage >= .5 && games >= 150 ? 'medium' : 'low';
  return { source: [...sources].sort().join(' + ') || 'OpenDota API', fetchedAt: fetchedDates.sort()[0] ?? '', sampleSize: games, opponentsCovered,
    winRate, advantage: winRate - .5, confidence };
}

export function recommendDraft(input: {
  scenario: DraftScenario;
  heroes: readonly DraftHero[];
  matchups: readonly DraftMatchupEvidence[];
  limit?: number;
}): DraftRecommendation[] {
  const scenario = validateDraftScenario(input.scenario, input.heroes);
  const byId = new Map(input.heroes.map(hero => [hero.id, hero]));
  const allies = scenario.allies.map(id => byId.get(id)!);
  const unavailable = new Set([...scenario.allies, ...scenario.enemies, ...scenario.bans]);
  const candidates = input.heroes.filter(hero => !unavailable.has(hero.id) &&
    (scenario.mode !== 'captains' || hero.captainMode));
  const recommendations = candidates.map(hero => {
    const statistic = statisticFor(hero.id, scenario.enemies, input.matchups);
    const coverage = roleCoverage(hero, allies, scenario.position);
    const explanations: DraftRecommendation['explanations'] = [];
    if (statistic) explanations.push({ kind: 'statistic', text:
      `OpenDota: ${(statistic.winRate * 100).toFixed(1)}% contra ${statistic.opponentsCovered}/${scenario.enemies.length} inimigos, n=${statistic.sampleSize}, confiança ${statistic.confidence}.` });
    else explanations.push({ kind: 'unavailable', text: scenario.enemies.length
      ? `OpenDota: sem confronto com amostra mínima de ${MIN_DRAFT_MATCHUP_SAMPLE}.` : 'OpenDota: adicione inimigos para calcular confrontos.' });
    explanations.push({ kind: 'heuristic', text: coverage.addedRoles.length
      ? `Heurística de catálogo: acrescenta ${coverage.addedRoles.join(', ')} à cobertura de funções.`
      : 'Heurística de catálogo: não preenche função essencial ausente.' });
    explanations.push({ kind: 'heuristic', text: coverage.positionRoleMatched
      ? `Heurística de posição: catálogo inclui ${POSITION_ROLE[scenario.position]}.`
      : `Heurística de posição: catálogo não inclui ${POSITION_ROLE[scenario.position]}.` });
    explanations.push({ kind: 'unavailable', text: 'Sinergia estatística entre aliados: indisponível; nenhum score foi inventado.' });
    return { heroId: hero.id, heroName: hero.name, captainMode: hero.captainMode,
      statistic, roleCoverage: coverage, explanations } satisfies DraftRecommendation;
  });
  const confidenceRank = { high: 3, medium: 2, low: 1 };
  return recommendations.sort((left, right) => {
    if (Boolean(left.statistic) !== Boolean(right.statistic)) return left.statistic ? -1 : 1;
    if (left.statistic && right.statistic) {
      const advantage = right.statistic.advantage - left.statistic.advantage;
      if (advantage) return advantage;
      const confidence = confidenceRank[right.statistic.confidence] - confidenceRank[left.statistic.confidence];
      if (confidence) return confidence;
      if (right.statistic.sampleSize !== left.statistic.sampleSize) return right.statistic.sampleSize - left.statistic.sampleSize;
    }
    if (right.roleCoverage.addedRoles.length !== left.roleCoverage.addedRoles.length)
      return right.roleCoverage.addedRoles.length - left.roleCoverage.addedRoles.length;
    if (left.roleCoverage.positionRoleMatched !== right.roleCoverage.positionRoleMatched)
      return left.roleCoverage.positionRoleMatched ? -1 : 1;
    return left.heroName.localeCompare(right.heroName, 'pt-BR') || left.heroId - right.heroId;
  }).slice(0, Math.max(1, Math.min(20, input.limit ?? 10)));
}
