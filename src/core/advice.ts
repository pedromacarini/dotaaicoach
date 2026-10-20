import type { Position } from '../shared/contracts';

interface HeroCatalogEntry { id: number; internalName: string | null; name: string; }
interface AbilityCatalogEntry { key: string; name: string; }
interface HeroAbilityCatalogEntry { heroKey: string; abilities: string[]; talents: Array<{ name: string | null; tier: number | null }>; }
interface ItemCatalogEntry { id: number; key: string; name: string; }
interface RecommendationMatch { itemIds?: number[]; }
interface RecommendationData {
  sampleSize?: number;
  detailedMatches?: number;
  skillBuilds?: Array<{ abilityIds?: number[]; matches?: number; pickRate?: number }>;
  matches?: RecommendationMatch[];
}
interface PopularityData { [phase: string]: Record<string, number> | undefined; }

export interface AdviceAsset { id: number; key: string; name: string; imageUrl: string; }
export interface TalentRecommendation { level: number; left: AdviceAsset | null; right: AdviceAsset | null; recommended: AdviceAsset | null; }
export interface MatchAdvice {
  heroId: number;
  heroName: string;
  position: Position;
  sampleSize: number;
  nextSkill: AdviceAsset | null;
  nextSkillLevel: number | null;
  skillEvidence: number;
  talents: TalentRecommendation[];
  itemPhase: 'Iniciais' | 'Início' | 'Meio de jogo' | 'Final de jogo';
  items: AdviceAsset[];
}

export interface MatchAdviceInput {
  heroInternalName: string | null;
  heroName: string | null;
  heroLevel: number | null;
  gameTime: number | null;
  position: Position;
  libraryUrl: string;
  heroes: HeroCatalogEntry[];
  abilities: AbilityCatalogEntry[];
  heroAbilities: HeroAbilityCatalogEntry[];
  items: ItemCatalogEntry[];
  abilityIds: Record<string, string>;
  itemIds: Record<string, string>;
  recommendations: RecommendationData;
  popularity: PopularityData;
}

const imageUrl = (libraryUrl: string, kind: 'abilities' | 'items', key: string): string =>
  new URL(`data/images/${kind}/${key}-icon.png`, libraryUrl).href;

function phaseFor(gameTime: number | null): { key: string; label: MatchAdvice['itemPhase'] } {
  if (gameTime === null || gameTime <= 0) return { key: 'start_game_items', label: 'Iniciais' };
  if (gameTime <= 600) return { key: 'early_game_items', label: 'Início' };
  if (gameTime <= 1_500) return { key: 'mid_game_items', label: 'Meio de jogo' };
  return { key: 'late_game_items', label: 'Final de jogo' };
}

export function buildMatchAdvice(input: MatchAdviceInput): MatchAdvice | null {
  const normalizedName = input.heroName?.toLocaleLowerCase('en-US') ?? '';
  const hero = input.heroes.find(value => value.internalName === input.heroInternalName)
    ?? input.heroes.find(value => value.name.toLocaleLowerCase('en-US') === normalizedName);
  if (!hero) return null;

  const sequence = input.recommendations.skillBuilds?.[0];
  const nextIndex = Math.max(0, input.heroLevel ?? 0);
  const skillId = Number(sequence?.abilityIds?.[nextIndex]);
  const skillKey = Number.isFinite(skillId) ? input.abilityIds[String(skillId)] : undefined;
  const skill = skillKey ? input.abilities.find(value => value.key === skillKey) : undefined;
  const nextSkill = skill && Number.isFinite(skillId)
    ? { id: skillId, key: skill.key, name: skill.name, imageUrl: imageUrl(input.libraryUrl, 'abilities', skill.key) }
    : null;
  const heroAbilities = input.heroAbilities?.find(value => value.heroKey === hero.internalName);
  const talentEntries = (heroAbilities?.talents ?? []).filter(value => value.name && value.tier);
  const talents = [1, 2, 3, 4].map(tier => {
    const pair = talentEntries.filter(value => value.tier === tier).slice(0, 2);
    const assets = pair.map(value => {
      const key = value.name!;
      const id = Number(Object.entries(input.abilityIds).find(([, abilityKey]) => abilityKey === key)?.[0]);
      const record = input.abilities.find(value => value.key === key);
      return record && Number.isFinite(id) ? { id, key, name: record.name, imageUrl: imageUrl(input.libraryUrl, 'abilities', key) } : null;
    });
    const recommendedKey = sequence?.abilityIds?.find(id => pair.some(value => value.name === input.abilityIds[String(id)]));
    const recommended = recommendedKey === undefined ? null : assets.find(value => value?.id === recommendedKey) ?? null;
    return { level: tier * 5 + 5, left: assets[0] ?? null, right: assets[1] ?? null, recommended };
  }).filter(value => value.left || value.right);

  const phase = phaseFor(input.gameTime);
  const popular = input.popularity[phase.key] ?? {};
  const items = Object.entries(popular)
    .filter(([, count]) => Number.isFinite(Number(count)) && Number(count) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 4)
    .flatMap(([id]) => {
      const itemId = Number(id), key = input.itemIds[id];
      const item = key ? input.items.find(value => value.key === key || value.id === itemId) : undefined;
      return item ? [{ id: itemId, key: item.key, name: item.name,
        imageUrl: imageUrl(input.libraryUrl, 'items', item.key) }] : [];
    });

  return {
    heroId: hero.id,
    heroName: hero.name,
    position: input.position,
    sampleSize: Number(input.recommendations.sampleSize) || 0,
    nextSkill,
    nextSkillLevel: nextSkill ? nextIndex + 1 : null,
    skillEvidence: Number(sequence?.matches) || 0,
    talents,
    itemPhase: phase.label,
    items,
  };
}
