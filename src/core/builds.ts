export type Team = 'radiant' | 'dire';
export type Position = 1 | 2 | 3 | 4 | 5;

export interface PurchaseEvent {
  time: number;
  itemId: number;
}

export interface PlayerBuildObservation {
  heroId: number;
  team: Team;
  laneRole: 1 | 2 | 3;
  lastHits: number;
  netWorth: number;
  won: boolean;
  isRoaming: boolean;
  facetId: number | null;
  purchaseLog: PurchaseEvent[];
  abilityUpgrades: number[];
}

export interface BuildMatch {
  matchId: string;
  patch: string;
  startedAt: number;
  averageRankTier: number | null;
  parsed: boolean;
  players: PlayerBuildObservation[];
}

export interface BuildPolicy {
  patch: string;
  since: number;
  minRankTier: number;
  minSampleSize: number;
  minPositionConfidence: number;
}

export interface BuildInput {
  source: { name: string; fetchedAt: number };
  policy: BuildPolicy;
  matches: BuildMatch[];
}

export interface BuildRecommendation {
  heroId: number;
  position: Position;
  sampleSize: number;
  wins: number;
  winRate: number;
  positionConfidence: number;
  items: Record<ItemStage, ItemRecommendation[]>;
  skillBuilds: SkillBuildRecommendation[];
  facets: FacetRecommendation[];
}

export type ItemStage = 'starting' | 'early' | 'core' | 'late';

export interface ItemRecommendation {
  itemId: number;
  matches: number;
  pickRate: number;
  averagePurchaseTime: number;
}

export interface SkillBuildRecommendation {
  abilityIds: number[];
  matches: number;
  pickRate: number;
}

export interface FacetRecommendation {
  facetId: number;
  matches: number;
  pickRate: number;
  wins: number;
  winRate: number;
}

export interface BuildAudit {
  matchesSeen: number;
  eligibleMatches: number;
  playerObservations: number;
  classifiedPlayers: number;
  unclassifiedPlayers: number;
  publishableGroups: number;
  groupsBelowMinimum: number;
  rejectedMatches: {
    unparsed: number;
    wrongPatch: number;
    outsideWindow: number;
    belowRank: number;
    incomplete: number;
  };
}

export interface BuildResult {
  source: BuildInput['source'];
  policy: BuildPolicy;
  recommendations: BuildRecommendation[];
  audit: BuildAudit;
}

interface ClassifiedPlayer {
  player: PlayerBuildObservation;
  position: Position;
  confidence: number;
}

const economy = (player: PlayerBuildObservation): number =>
  player.netWorth + player.lastHits * 20;

function classifyPair(
  players: PlayerBuildObservation[],
  corePosition: Position,
  supportPosition: Position,
  minimumConfidence: number,
): ClassifiedPlayer[] {
  if (players.length !== 2) return [];
  const [support, core] = [...players].sort((a, b) => economy(a) - economy(b));
  const high = economy(core);
  const confidence = high > 0
    ? Math.min(1, 0.5 + 0.5 * (high - economy(support)) / high)
    : 0;
  if (confidence < minimumConfidence) return [];
  return [
    { player: core, position: corePosition, confidence },
    { player: support, position: supportPosition, confidence },
  ];
}

function classifyTeam(
  players: PlayerBuildObservation[],
  minimumConfidence: number,
): ClassifiedPlayer[] {
  if (players.length !== 5) return [];
  const safe = players.filter(player => player.laneRole === 1);
  const mid = players.filter(player => player.laneRole === 2);
  const off = players.filter(player => player.laneRole === 3);
  if (safe.length !== 2 || mid.length !== 1 || off.length !== 2) return [];
  return [
    ...classifyPair(safe, 1, 5, minimumConfidence),
    { player: mid[0], position: 2, confidence: 1 },
    ...classifyPair(off, 3, 4, minimumConfidence),
  ];
}

function isComplete(match: BuildMatch): boolean {
  if (match.players.length !== 10) return false;
  return (['radiant', 'dire'] as const).every(team =>
    match.players.filter(player => player.team === team).length === 5);
}

const itemStage = (time: number): ItemStage =>
  time <= 0 ? 'starting' : time <= 600 ? 'early' : time <= 1_500 ? 'core' : 'late';

function aggregateItems(group: ClassifiedPlayer[]): Record<ItemStage, ItemRecommendation[]> {
  const stages: Record<ItemStage, Map<number, { matches: number; timeTotal: number }>> = {
    starting: new Map(),
    early: new Map(),
    core: new Map(),
    late: new Map(),
  };

  for (const observation of group) {
    const firstPurchases = new Map<string, PurchaseEvent & { stage: ItemStage }>();
    for (const purchase of observation.player.purchaseLog) {
      const stage = itemStage(purchase.time);
      const key = `${stage}:${purchase.itemId}`;
      const previous = firstPurchases.get(key);
      if (!previous || purchase.time < previous.time)
        firstPurchases.set(key, { ...purchase, stage });
    }
    for (const purchase of firstPurchases.values()) {
      const current = stages[purchase.stage].get(purchase.itemId) ?? { matches: 0, timeTotal: 0 };
      current.matches++;
      current.timeTotal += purchase.time;
      stages[purchase.stage].set(purchase.itemId, current);
    }
  }

  return Object.fromEntries(
    (Object.keys(stages) as ItemStage[]).map(stage => [
      stage,
      [...stages[stage].entries()]
        .map(([itemId, value]) => ({
          itemId,
          matches: value.matches,
          pickRate: value.matches / group.length,
          averagePurchaseTime: value.timeTotal / value.matches,
        }))
        .sort((a, b) => b.pickRate - a.pickRate || a.averagePurchaseTime - b.averagePurchaseTime || a.itemId - b.itemId),
    ]),
  ) as Record<ItemStage, ItemRecommendation[]>;
}

function aggregateSkillBuilds(group: ClassifiedPlayer[]): SkillBuildRecommendation[] {
  const sequences = new Map<string, { abilityIds: number[]; matches: number }>();
  for (const observation of group) {
    if (!observation.player.abilityUpgrades.length) continue;
    const abilityIds = [...observation.player.abilityUpgrades];
    const key = abilityIds.join(',');
    const current = sequences.get(key) ?? { abilityIds, matches: 0 };
    current.matches++;
    sequences.set(key, current);
  }
  return [...sequences.values()]
    .sort((a, b) => b.matches - a.matches || a.abilityIds.join(',').localeCompare(b.abilityIds.join(',')))
    .slice(0, 3)
    .map(value => ({
      abilityIds: value.abilityIds,
      matches: value.matches,
      pickRate: value.matches / group.length,
    }));
}

function aggregateFacets(group: ClassifiedPlayer[]): FacetRecommendation[] {
  const facets = new Map<number, { matches: number; wins: number }>();
  for (const observation of group) {
    const facetId = observation.player.facetId;
    if (facetId === null) continue;
    const current = facets.get(facetId) ?? { matches: 0, wins: 0 };
    current.matches++;
    if (observation.player.won) current.wins++;
    facets.set(facetId, current);
  }
  return [...facets.entries()]
    .map(([facetId, value]) => ({
      facetId,
      matches: value.matches,
      pickRate: value.matches / group.length,
      wins: value.wins,
      winRate: value.wins / value.matches,
    }))
    .sort((a, b) => b.pickRate - a.pickRate || a.facetId - b.facetId);
}

export function generateBuilds(input: BuildInput): BuildResult {
  const rejectedMatches: BuildAudit['rejectedMatches'] = {
    unparsed: 0,
    wrongPatch: 0,
    outsideWindow: 0,
    belowRank: 0,
    incomplete: 0,
  };
  const eligible: BuildMatch[] = [];

  for (const match of input.matches) {
    if (!match.parsed) rejectedMatches.unparsed++;
    else if (match.patch !== input.policy.patch) rejectedMatches.wrongPatch++;
    else if (match.startedAt < input.policy.since || match.startedAt > input.source.fetchedAt)
      rejectedMatches.outsideWindow++;
    else if (match.averageRankTier === null || match.averageRankTier < input.policy.minRankTier)
      rejectedMatches.belowRank++;
    else if (!isComplete(match)) rejectedMatches.incomplete++;
    else eligible.push(match);
  }

  const classified: ClassifiedPlayer[] = [];
  let playerObservations = 0;
  for (const match of eligible) {
    playerObservations += match.players.length;
    for (const team of ['radiant', 'dire'] as const) {
      classified.push(...classifyTeam(
        match.players.filter(player => player.team === team),
        input.policy.minPositionConfidence,
      ));
    }
  }

  const groups = new Map<string, ClassifiedPlayer[]>();
  for (const value of classified) {
    const key = `${value.player.heroId}:${value.position}`;
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  const groupSizes = [...groups.values()].map(group => group.length);
  const recommendations = [...groups.values()]
    .filter(group => group.length >= input.policy.minSampleSize)
    .map(group => {
      const first = group[0];
      const wins = group.filter(value => value.player.won).length;
      return {
        heroId: first.player.heroId,
        position: first.position,
        sampleSize: group.length,
        wins,
        winRate: wins / group.length,
        positionConfidence: group.reduce((sum, value) => sum + value.confidence, 0) / group.length,
        items: aggregateItems(group),
        skillBuilds: aggregateSkillBuilds(group),
        facets: aggregateFacets(group),
      } satisfies BuildRecommendation;
    })
    .sort((a, b) => a.heroId - b.heroId || a.position - b.position);

  return {
    source: input.source,
    policy: input.policy,
    recommendations,
    audit: {
      matchesSeen: input.matches.length,
      eligibleMatches: eligible.length,
      playerObservations,
      classifiedPlayers: classified.length,
      unclassifiedPlayers: playerObservations - classified.length,
      publishableGroups: groupSizes.filter(size => size >= input.policy.minSampleSize).length,
      groupsBelowMinimum: groupSizes.filter(size => size < input.policy.minSampleSize).length,
      rejectedMatches,
    },
  };
}
