import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MatchSession } from '../src/shared/contracts';

export interface SessionHistoryStore {
  get(): MatchSession[];
  add(session: MatchSession): MatchSession[];
}

const isSession = (value: unknown): value is MatchSession => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MatchSession>;
  return typeof candidate.id === 'string' && candidate.source === 'real'
    && typeof candidate.startedAt === 'number' && Array.isArray(candidate.samples)
    && Boolean(candidate.summary && typeof candidate.summary === 'object');
};

export function createSessionHistoryStore(filePath: string, limit = 30): SessionHistoryStore {
  let sessions: MatchSession[] = [];
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(parsed)) sessions = parsed.filter(isSession).slice(0, limit);
  } catch { /* Primeiro uso ou arquivo inválido: começa vazio. */ }

  const persist = (): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(sessions, null, 2), { encoding: 'utf8', flag: 'w' });
    fs.renameSync(temporary, filePath);
  };
  return {
    get: () => sessions.map(session => ({ ...session, samples: session.samples.map(sample => ({...sample})), summary: {...session.summary} })),
    add: session => {
      if (session.source !== 'real' || session.endedAt === null) throw new Error('Somente sessões reais finalizadas entram no histórico.');
      sessions = [session, ...sessions.filter(value => value.id !== session.id)].slice(0, limit);
      persist();
      return sessions;
    },
  };
}
