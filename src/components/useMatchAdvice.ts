import { useEffect, useMemo, useState } from 'react';
import { buildMatchAdvice, type MatchAdvice } from '../core/advice';
import { loadSection, type AbilityRecord, type HeroRecord, type ItemRecord } from '../data/catalog';
import type { GameSnapshot, Position } from '../shared/contracts';

interface AdvicePayload {
  libraryUrl: string;
  heroes: HeroRecord[];
  abilities: AbilityRecord[];
  items: ItemRecord[];
  abilityIds: Record<string, string>;
  itemIds: Record<string, string>;
  recommendations: Parameters<typeof buildMatchAdvice>[0]['recommendations'];
  popularity: Parameters<typeof buildMatchAdvice>[0]['popularity'];
}

interface AdviceState { loading: boolean; error: string | null; payload: AdvicePayload | null; }

export function useMatchAdvice(snapshot: GameSnapshot, position: Position, enabled = true): {
  loading: boolean; error: string | null; advice: MatchAdvice | null;
} {
  const [state, setState] = useState<AdviceState>({ loading: false, error: null, payload: null });

  useEffect(() => {
    if (!enabled || (!snapshot.heroInternalName && !snapshot.heroName)) {
      setState({ loading: false, error: null, payload: null });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState(previous => ({ ...previous, loading: true, error: null }));
    void (async () => {
      const [libraryUrl, heroes, abilities, items, extrasModule] = await Promise.all([
        window.dotaOverlay.getLibraryUrl(),
        loadSection('heroes') as Promise<HeroRecord[]>,
        loadSection('abilities') as Promise<AbilityRecord[]>,
        loadSection('items') as Promise<ItemRecord[]>,
        import('../data/generated/extras.json'),
      ]);
      if (!libraryUrl) throw new Error('Biblioteca local indisponível.');
      const hero = heroes.find(value => value.internalName === snapshot.heroInternalName)
        ?? heroes.find(value => value.name === snapshot.heroName);
      if (!hero) throw new Error(`Herói não encontrado no catálogo: ${snapshot.heroName ?? snapshot.heroInternalName}`);
      const [recommendationResponse, popularityResponse] = await Promise.all([
        fetch(new URL(`api/opendota/heroes/${hero.id}/recommendations?position=${position}`, libraryUrl), { signal: controller.signal }),
        fetch(new URL(`api/opendota/heroes/${hero.id}/itemPopularity`, libraryUrl), { signal: controller.signal }),
      ]);
      const recommendationJson = await recommendationResponse.json();
      const popularityJson = await popularityResponse.json();
      if (!recommendationResponse.ok) throw new Error(recommendationJson.error || `OpenDota HTTP ${recommendationResponse.status}`);
      if (!popularityResponse.ok) throw new Error(popularityJson.error || `OpenDota HTTP ${popularityResponse.status}`);
      const extras = extrasModule.default as { ability_ids?: Record<string, string>; item_ids?: Record<string, string> };
      if (active) setState({ loading: false, error: null, payload: {
        libraryUrl, heroes, abilities, items,
        abilityIds: extras.ability_ids ?? {}, itemIds: extras.item_ids ?? {},
        recommendations: recommendationJson.data ?? {}, popularity: popularityJson.data ?? {},
      } });
    })().catch(error => {
      if (active && !controller.signal.aborted)
        setState(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : String(error) }));
    });
    return () => { active = false; controller.abort(); };
  }, [enabled, snapshot.heroInternalName, snapshot.heroName, position]);

  const advice = useMemo(() => enabled && state.payload ? buildMatchAdvice({
    heroInternalName: snapshot.heroInternalName,
    heroName: snapshot.heroName,
    heroLevel: snapshot.heroLevel,
    gameTime: snapshot.gameTime,
    position,
    ...state.payload,
  }) : null, [enabled, state.payload, snapshot.heroInternalName, snapshot.heroName, snapshot.heroLevel, snapshot.gameTime, position]);

  return { loading: state.loading, error: state.error, advice };
}
