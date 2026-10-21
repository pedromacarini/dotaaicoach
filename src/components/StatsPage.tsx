import { useMemo, useState } from 'react';
import { chooseDisplayedSession, createDemoSession } from '../core/match-session';
import { evaluateEconomy, evaluateFarm, selectFarmObservation, targetLastHits, type FarmBenchmark } from '../core/farm-benchmark';
import type { AppPreferences, GameSnapshot, MatchSession, MatchSessionState, Position } from '../shared/contracts';
import { formatClock } from './useOverlay';

const positionNames: Record<Position, string> = {
  1: 'Carry', 2: 'Mid', 3: 'Offlane', 4: 'Suporte 4', 5: 'Suporte 5',
};
const number = (value: number | null): string => value === null ? '—' : value.toLocaleString('pt-BR');
const gradeCopy: Record<NonNullable<FarmBenchmark>['classification'], {title:string;detail:string}> = {
  ahead: { title: 'Acima da meta', detail: 'Seu farm está à frente deste perfil.' },
  'on-track': { title: 'Dentro da faixa', detail: 'Seu farm está próximo da referência.' },
  behind: { title: 'Abaixo da meta', detail: 'Há espaço para recuperar eficiência.' },
  unavailable: { title: 'LH não recebido', detail: 'A meta existe, mas o Dota não enviou seus last hits.' },
};

function FarmChart({ session }: {session: MatchSession}) {
  const points = session.samples.filter(sample => sample.gameTime >= 0);
  if (points.length < 2) return <div className="stats-empty">Aguardando mais amostras para desenhar a evolução.</div>;
  const maxTime = Math.max(60, ...points.map(point => point.gameTime));
  const targets = points.map(point => targetLastHits(session.position, point.gameTime));
  const maxValue = Math.max(10, ...targets, ...points.map(point => point.lastHits ?? 0));
  const x = (time: number): number => 28 + time / maxTime * 644;
  const y = (value: number): number => 194 - value / maxValue * 166;
  const actual = points.filter(point => point.lastHits !== null)
    .map((point, index) => `${index ? 'L' : 'M'} ${x(point.gameTime).toFixed(1)} ${y(point.lastHits!).toFixed(1)}`).join(' ');
  const target = points.map((point, index) => `${index ? 'L' : 'M'} ${x(point.gameTime).toFixed(1)} ${y(targets[index]).toFixed(1)}`).join(' ');
  return <div className="farm-chart">
    <div className="chart-legend"><span className="actual">Seus LH</span><span className="target">Meta experimental</span></div>
    <svg viewBox="0 0 700 220" role="img" aria-label="Evolução de last hits comparada à meta experimental">
      <line x1="28" y1="194" x2="672" y2="194" className="axis"/><line x1="28" y1="28" x2="28" y2="194" className="axis"/>
      <path d={target} className="target-line"/><path d={actual} className="actual-line"/>
      <text x="28" y="214">00:00</text><text x="628" y="214">{formatClock(maxTime)}</text>
      <text x="4" y="33">{maxValue}</text><text x="14" y="198">0</text>
    </svg>
  </div>;
}

function SessionHistory({ sessions, selectedId, onSelect }: {
  sessions: MatchSession[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  if (!sessions.length) return <div className="stats-empty">Nenhuma partida real finalizada ainda. O histórico será salvo somente neste computador.</div>;
  return <div className="match-history">{sessions.slice(0, 8).map(session => <button type="button" className={selectedId === session.id ? 'selected' : ''} onClick={() => onSelect(selectedId === session.id ? null : session.id)} key={session.id}>
    <div><strong>{session.heroName || 'Herói não informado'}</strong><small>{positionNames[session.position]} · {new Date(session.startedAt).toLocaleDateString('pt-BR')}</small></div>
    <div><strong>{number(session.summary.lastHits)} LH</strong><small>{formatClock(session.summary.duration)} · {session.summary.sampleCount} amostras</small></div>
    <div><strong>{number(session.summary.kills)}/{number(session.summary.deaths)}/{number(session.summary.assists)}</strong><small>K / D / A</small></div>
    <span className="source-real">{selectedId === session.id ? 'ABERTA' : 'VER'}</span>
  </button>)}</div>;
}

export function StatsPage({ snapshot, preferences, sessions }: {
  snapshot: GameSnapshot; preferences: AppPreferences; sessions: MatchSessionState;
}) {
  const [selectedRecentId, setSelectedRecentId] = useState<string | null>(null);
  const demo = useMemo(() => createDemoSession(preferences.position), [preferences.position]);
  const current = chooseDisplayedSession(snapshot.source, sessions.active, selectedRecentId, sessions.recent, demo);
  const latest = current?.samples.at(-1) ?? null;
  const benchmarkPosition = current?.position ?? preferences.position;
  const isPastSession = Boolean(current && current.source === 'real' && current.endedAt !== null);
  const observation = isPastSession
    ? { gameTime: current?.summary.duration ?? null, lastHits: current?.summary.lastHits ?? null }
    : selectFarmObservation(snapshot, latest);
  const assessment = evaluateFarm(benchmarkPosition, observation.gameTime, observation.lastHits);
  const economyTime = observation.gameTime;
  const netWorthAssessment = evaluateEconomy(benchmarkPosition, economyTime, isPastSession ? current?.summary.netWorth ?? null : snapshot.netWorth, 'netWorth');
  const gpmAssessment = evaluateEconomy(benchmarkPosition, economyTime, isPastSession ? current?.summary.gpm ?? null : snapshot.gpm, 'gpm');
  const grade = assessment ? gradeCopy[assessment.classification] : null;
  return <>
    <div className="page-top"><div><div className="eyebrow">DESEMPENHO LOCAL</div><h1>Estatísticas</h1><p>Compare sua evolução com uma referência aberta e acompanhe sessões salvas no computador.</p></div><div className="version">META EXPERIMENTAL V1</div></div>
    <div className="stats-disclaimer">Este benchmark é um ponto de partida autoral, não uma verdade competitiva. Os valores estão documentados e serão calibrados com testes reais.</div>
    <section className="stats-current">
      <div className={`farm-grade ${assessment?.classification ?? 'unavailable'}`}><small>AVALIAÇÃO ATUAL · {positionNames[benchmarkPosition]}</small><strong>{grade?.title ?? 'Sem partida ativa'}</strong><p>{grade?.detail ?? 'Ative a demonstração ou conecte uma partida para comparar.'}</p></div>
      <div><small>LAST HITS</small><strong>{number(assessment?.actualLastHits ?? null)}</strong></div>
      <div><small>META AGORA</small><strong>{assessment?.targetLastHits ?? '—'}</strong></div>
      <div><small>DIFERENÇA</small><strong className={assessment && assessment.delta !== null && assessment.delta >= 0 ? 'positive' : 'negative'}>{assessment?.delta === null || assessment?.delta === undefined ? '—' : `${assessment.delta > 0 ? '+' : ''}${assessment.delta}`}</strong></div>
      <div><small>FAIXA DA META</small><strong>{assessment ? `±${assessment.tolerance}` : '—'}</strong></div>
    </section>
    <section className="stats-economy">{[['PATRIMÔNIO TOTAL', netWorthAssessment], ['GPM', gpmAssessment]].map(([label, economy]) => {
      const value = economy as ReturnType<typeof evaluateEconomy>;
      return <div className={`farm-grade ${value?.classification ?? 'unavailable'}`} key={label as string}><small>{label as string} · {positionNames[benchmarkPosition]}</small><strong>{value?.actual === null || value?.actual === undefined ? 'Sem dado' : number(value.actual)}</strong><p>{value ? `Média ${number(value.target)} · ${value.delta !== null && value.delta >= 0 ? '+' : ''}${value.delta ?? '—'}` : 'Aguardando tempo e dado do GSI.'}</p></div>;
    })}</section>
    <div className="stats-layout">
      <section className="settings-card stats-chart-card"><div className="card-top"><div><h3>Evolução de farm</h3><p>{current ? `${current.heroName || 'Herói não informado'} · ${current.source === 'demo' ? 'sessão simulada' : current.endedAt ? 'partida salva' : 'partida real em andamento'}` : 'A curva aparece durante uma sessão.'}</p></div>{current && <span className={`session-source ${current.source}`}>{current.source === 'demo' ? 'DEMONSTRAÇÃO' : current.endedAt ? 'HISTÓRICO' : 'REAL · AO VIVO'}</span>}</div>
        {current ? <FarmChart session={current}/> : <div className="stats-empty">Sem sessão ativa. O modo demonstração cria uma partida rica sem precisar abrir o Dota.</div>}
      </section>
      <section className="settings-card stats-samples"><div className="card-top"><div><h3>Evolução da sessão</h3><p>Últimas amostras registradas, sem preencher campos ausentes.</p></div><span className="mini-label">{current?.samples.length ?? 0} AMOSTRAS</span></div>
        {current ? <div className="sample-list">{current.samples.slice(-6).reverse().map(sample => <div key={`${sample.recordedAt}-${sample.gameTime}`}><strong>{formatClock(sample.gameTime)}</strong><span>{number(sample.lastHits)} LH</span><span>{number(sample.netWorth)} patrimônio</span><span>{number(sample.gpm)} GPM</span></div>)}</div> : <div className="stats-empty">Nenhuma amostra nesta sessão.</div>}
      </section>
    </div>
    <section className="settings-card stats-history"><div className="card-top"><div><h3>Partidas recentes</h3><p>Clique em uma sessão para abrir seu gráfico e detalhes. Uma partida ao vivo sempre tem prioridade.</p></div><span className="mini-label">LOCAL · ATÉ 30</span></div><SessionHistory sessions={sessions.recent} selectedId={selectedRecentId} onSelect={setSelectedRecentId}/></section>
    <div className="footerline"><span>Perfil experimental documentado · dados locais · nenhuma estatística ausente é estimada</span><span>{snapshot.source === 'demo' ? 'Demonstração ativa' : snapshot.source === 'gsi' ? 'GSI conectado' : 'Aguardando partida'}</span></div>
  </>;
}
