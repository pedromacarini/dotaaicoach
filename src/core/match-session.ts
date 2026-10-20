import type {
  GameSnapshot, MatchSample, MatchSession, MatchSessionEndReason, MatchSessionSummary, Position,
} from '../shared/contracts';

const lastObserved = (samples: MatchSample[], field: keyof MatchSample): number | null => {
  for (let index = samples.length - 1; index >= 0; index--) {
    const value = samples[index][field];
    if (typeof value === 'number') return value;
  }
  return null;
};

export function summarizeSession(samples: MatchSample[]): MatchSessionSummary {
  return {
    duration: samples.length ? Math.max(0, ...samples.map(sample => sample.gameTime)) : 0,
    sampleCount: samples.length,
    lastHits: lastObserved(samples, 'lastHits'), denies: lastObserved(samples, 'denies'),
    netWorth: lastObserved(samples, 'netWorth'), gpm: lastObserved(samples, 'gpm'),
    kills: lastObserved(samples, 'kills'), deaths: lastObserved(samples, 'deaths'),
    assists: lastObserved(samples, 'assists'),
  };
}

export function sampleFromSnapshot(snapshot: GameSnapshot): MatchSample | null {
  if (snapshot.gameTime === null) return null;
  return {
    recordedAt: snapshot.receivedAt ?? Date.now(), gameTime: snapshot.gameTime,
    lastHits: snapshot.lastHits, denies: snapshot.denies, netWorth: snapshot.netWorth,
    gpm: snapshot.gpm, kills: snapshot.kills, deaths: snapshot.deaths, assists: snapshot.assists,
  };
}

export function finishSession(session: MatchSession, endedAt: number,
  endReason: MatchSessionEndReason): MatchSession {
  return { ...session, endedAt, endReason, summary: summarizeSession(session.samples) };
}

export function chooseDisplayedSession(snapshotSource: GameSnapshot['source'], active: MatchSession | null,
  selectedRecentId: string | null, recent: MatchSession[], demo: MatchSession): MatchSession | null {
  if (snapshotSource === 'demo') return demo;
  return active ?? recent.find(session => session.id === selectedRecentId) ?? null;
}

export function createDemoSession(position: Position, now = Date.now()): MatchSession {
  const points = [
    [0, 0, 0, 600, 0, 0, 0, 0], [180, 13, 2, 1310, 238, 0, 0, 0],
    [360, 35, 4, 2620, 337, 1, 0, 1], [540, 56, 6, 3860, 392, 1, 1, 2],
    [720, 78, 7, 5350, 438, 3, 1, 3], [840, 91, 8, 6520, 472, 4, 2, 5],
    [982, 112, 9, 8420, 515, 5, 2, 8],
  ] as const;
  const samples: MatchSample[] = points.map(([gameTime, lastHits, denies, netWorth, gpm, kills, deaths, assists]) => ({
    recordedAt: now - (982 - gameTime) * 1000, gameTime, lastHits, denies, netWorth, gpm, kills, deaths, assists,
  }));
  return {
    id: 'demo-session', source: 'demo', position, heroInternalName: 'npc_dota_hero_axe', heroName: 'Axe',
    startedAt: samples[0].recordedAt, endedAt: now, endReason: 'demo-complete', samples,
    summary: summarizeSession(samples),
  };
}
