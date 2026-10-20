export interface AdviceRemoteData<Recommendations, Popularity> {
  recommendations: Recommendations;
  popularity: Popularity;
  warning: string | null;
}

export function selectCurrentAdvicePayload<Payload extends { requestKey: string }>(
  requestKey: string, payload: Payload | null,
): Payload | null {
  return payload?.requestKey === requestKey ? payload : null;
}

export async function loadAdviceRemoteData<Recommendations, Popularity>(input: {
  previous?: Pick<AdviceRemoteData<Recommendations, Popularity>, 'recommendations' | 'popularity'>;
  fallback?: { recommendations: Recommendations; popularity: Popularity };
  loadRecommendations: () => Promise<Recommendations>;
  loadPopularity: () => Promise<Popularity>;
}): Promise<AdviceRemoteData<Recommendations, Popularity>> {
  const [recommendations, popularity] = await Promise.allSettled([
    input.loadRecommendations(), input.loadPopularity(),
  ]);
  const fallback = input.previous ?? input.fallback;
  if (!fallback && (recommendations.status === 'rejected' || popularity.status === 'rejected'))
    throw recommendations.status === 'rejected' ? recommendations.reason : (popularity as PromiseRejectedResult).reason;
  const unavailable = [
    recommendations.status === 'rejected' ? 'skills/build' : null,
    popularity.status === 'rejected' ? 'itens' : null,
  ].filter((value): value is string => Boolean(value));
  const detail = [recommendations, popularity].flatMap(result => result.status === 'rejected'
    ? [result.reason instanceof Error ? result.reason.message : String(result.reason)] : []);
  return {
    recommendations: recommendations.status === 'fulfilled' ? recommendations.value : fallback!.recommendations,
    popularity: popularity.status === 'fulfilled' ? popularity.value : fallback!.popularity,
    warning: unavailable.length
      ? `OpenDota indisponível para ${unavailable.join(' e ')}; ${input.previous ? 'usando o último dado disponível' : 'mantendo somente os dados que responderam'}. ${[...new Set(detail)].join(' ')}`
      : null,
  };
}
