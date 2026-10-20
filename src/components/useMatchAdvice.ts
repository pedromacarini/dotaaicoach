import { useEffect, useMemo, useRef, useState } from 'react';
import { buildMatchAdvice, type MatchAdvice } from '../core/advice';
import { loadAdviceRemoteData, selectCurrentAdvicePayload } from '../core/advice-loader';
import { loadSection, type AbilityRecord, type HeroAbilitiesRecord, type HeroRecord, type ItemRecord } from '../data/catalog';
import type { GameSnapshot, Position } from '../shared/contracts';

interface AdvicePayload {
  requestKey: string;
  libraryUrl: string;
  heroes: HeroRecord[];
  abilities: AbilityRecord[];
  heroAbilities: HeroAbilitiesRecord[];
  items: ItemRecord[];
  abilityIds: Record<string, string>;
  itemIds: Record<string, string>;
  recommendations: Parameters<typeof buildMatchAdvice>[0]['recommendations'];
  popularity: Parameters<typeof buildMatchAdvice>[0]['popularity'];
}

interface AdviceState { loading: boolean; error: string | null; payload: AdvicePayload | null; }

type Recommendations = Parameters<typeof buildMatchAdvice>[0]['recommendations'];
type Popularity = Parameters<typeof buildMatchAdvice>[0]['popularity'];
type RemoteAdvice = { recommendations: Recommendations; popularity: Popularity };

export function useMatchAdvice(snapshot: GameSnapshot, position: Position, enabled = true): {
  loading: boolean; error: string | null; advice: MatchAdvice | null;
} {
  const [state, setState] = useState<AdviceState>({ loading: false, error: null, payload: null });
  const lastRemoteByHero = useRef(new Map<string, RemoteAdvice>());
  const requestKey = `${snapshot.heroInternalName ?? snapshot.heroName}:${position}`;

  useEffect(() => {
    if (!enabled || (!snapshot.heroInternalName && !snapshot.heroName)) {
      setState({ loading: false, error: null, payload: null });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState(previous => ({ ...previous, loading: true, error: null,
      payload: previous.payload?.requestKey === requestKey ? previous.payload : null }));
    void (async () => {
      const [libraryUrl, heroes, abilities, items, heroAbilities, extrasModule] = await Promise.all([
        window.dotaOverlay.getLibraryUrl(),
        loadSection('heroes') as Promise<HeroRecord[]>,
        loadSection('abilities') as Promise<AbilityRecord[]>,
        loadSection('items') as Promise<ItemRecord[]>,
        loadSection('heroAbilities') as Promise<HeroAbilitiesRecord[]>,
        import('../data/generated/extras.json'),
      ]);
      if (!libraryUrl) throw new Error('Biblioteca local indisponível.');
      const hero = heroes.find(value => value.internalName === snapshot.heroInternalName)
        ?? heroes.find(value => value.name === snapshot.heroName);
      if (!hero) throw new Error(`Herói não encontrado no catálogo: ${snapshot.heroName ?? snapshot.heroInternalName}`);
      const remoteKey = `${hero.id}:${position}`;
      const routeWarnings = new Set<string>();
      const loadRoute = async <Value,>(url: URL): Promise<Value> => {
        const response = await fetch(url, { signal: controller.signal });
        const json = await response.json() as { data?: Value; error?: string; warning?: string };
        if (!response.ok) throw new Error(json.error || `OpenDota HTTP ${response.status}`);
        if (json.warning) routeWarnings.add(json.warning);
        return (json.data ?? {}) as Value;
      };
      const remote = await loadAdviceRemoteData<Recommendations, Popularity>({
        previous: lastRemoteByHero.current.get(remoteKey),
        fallback: { recommendations: {}, popularity: {} },
        loadRecommendations: () => loadRoute(new URL(`api/opendota/heroes/${hero.id}/recommendations?position=${position}`, libraryUrl)),
        loadPopularity: () => loadRoute(new URL(`api/opendota/heroes/${hero.id}/itemPopularity`, libraryUrl)),
      });
      const extras = extrasModule.default as { ability_ids?: Record<string, string>; item_ids?: Record<string, string> };
      if (active && !controller.signal.aborted) {
        lastRemoteByHero.current.set(remoteKey, remote);
        const warnings = [...new Set([remote.warning, ...routeWarnings].filter((value): value is string => Boolean(value)))];
        setState({ loading: false, error: warnings.join(' ') || null, payload: {
          requestKey, libraryUrl, heroes, abilities, items, heroAbilities,
          abilityIds: extras.ability_ids ?? {}, itemIds: extras.item_ids ?? {},
          recommendations: remote.recommendations, popularity: remote.popularity,
        } });
      }
    })().catch(error => {
      if (active && !controller.signal.aborted)
        setState(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : String(error) }));
    });
    return () => { active = false; controller.abort(); };
  }, [enabled, snapshot.heroInternalName, snapshot.heroName, position]);

  const currentPayload = selectCurrentAdvicePayload(requestKey, state.payload);
  const payloadMismatch = Boolean(enabled && (snapshot.heroInternalName || snapshot.heroName) && state.payload && !currentPayload);
  const advice = useMemo(() => enabled && currentPayload ? buildMatchAdvice({
    heroInternalName: snapshot.heroInternalName,
    heroName: snapshot.heroName,
    heroLevel: snapshot.heroLevel,
    gameTime: snapshot.gameTime,
    learnedAbilities: snapshot.learnedAbilities,
    position,
    ...currentPayload,
  }) : null, [enabled, currentPayload, snapshot.heroInternalName, snapshot.heroName, snapshot.heroLevel, snapshot.gameTime, position]);

  return { loading: state.loading || payloadMismatch, error: payloadMismatch ? null : state.error, advice };
}
