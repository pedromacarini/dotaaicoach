import { useMemo, useState } from 'react';
import { formatClock } from './useOverlay';
import { planFarmRoute, type MapSide } from '../core/farm-routes';
import type { Position } from '../shared/contracts';

export function FarmRoutePage({ position, gameTime }: { position: Position; gameTime: number | null }) {
  const [side, setSide] = useState<MapSide>('radiant');
  const route = useMemo(() => planFarmRoute(position, side, gameTime ?? 0), [position, side, gameTime]);
  return <>
    <div className="page-top"><div><div className="eyebrow">ASSISTENTE DE FARM</div><h1>Rotas de farm</h1><p>Uma sequência offline e explicável de acampamentos, sem coordenadas ocultas.</p></div><div className="version">AUTORAL V1</div></div>
    <section className="settings-card compact"><div><h3>Rota {side === 'radiant' ? 'Radiant' : 'Dire'}</h3><p>Posição {position} · início {formatClock(route.startedAt)} · {formatClock(route.estimatedDuration)} estimados</p></div><div className="gsi-actions"><button type="button" className={side === 'radiant' ? 'primary-button' : 'secondary-button'} onClick={() => setSide('radiant')}>Radiant</button><button type="button" className={side === 'dire' ? 'primary-button' : 'secondary-button'} onClick={() => setSide('dire')}>Dire</button></div></section>
    <section className="settings-card"><div className="card-top"><div><h3>Sequência sugerida</h3><p>Os nomes são referências autorais; valide o mapa dentro da partida.</p></div><span className="mini-label">{route.steps.length} PONTOS</span></div><div className="sample-list">{route.steps.length ? route.steps.map((step, index) => <div key={step.camp.id}><strong>#{index + 1} · {step.camp.name}</strong><span>chegar {formatClock(step.arriveAt)}</span><span>{step.durationSeconds}s · T{step.camp.tier}</span></div>) : <div className="stats-empty">Nenhum acampamento disponível para este lado.</div>}</div>{route.warnings.map(warning => <p className="stats-disclaimer" key={warning}>{warning}</p>)}</section>
  </>;
}
