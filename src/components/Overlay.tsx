import { formatClock, useOverlay } from './useOverlay';
import { useMatchAdvice } from './useMatchAdvice';
import { useEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { evaluateEconomy, evaluateFarm } from '../core/farm-benchmark';
const value = (n: number | null) => n === null ? '—' : n.toLocaleString('pt-BR');
const positionName = ['','Carry','Mid','Offlane','Sup. 4','Sup. 5'];
export function Overlay() {
  const { snapshot, preferences, status, notificationCenter, itemTiming } = useOverlay();
  const modules = preferences.overlayLayout.modules;
  const hasAdviceModule = modules.skill || modules.items;
  const { advice, loading, error } = useMatchAdvice(snapshot, preferences.position, hasAdviceModule);
  const farm = evaluateFarm(preferences.position, snapshot.gameTime, snapshot.lastHits);
  const netWorth = evaluateEconomy(preferences.position, snapshot.gameTime, snapshot.netWorth, 'netWorth');
  const gpm = evaluateEconomy(preferences.position, snapshot.gameTime, snapshot.gpm, 'gpm');
  const spokenAlerts = useRef(new Set<string>());
  useEffect(() => {
    for (const banner of notificationCenter.runtime.active) {
      if (spokenAlerts.current.has(banner.id) || banner.audio !== 'beep') continue;
      spokenAlerts.current.add(banner.id);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(banner.title));
      }
    }
    if (spokenAlerts.current.size > 100) spokenAlerts.current.clear();
  }, [notificationCenter.runtime.active]);
  const resizeCleanup = useRef<() => void>(() => undefined);
  useEffect(() => () => resizeCleanup.current(), []);
  function beginResize(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (preferences.overlayLayout.locked) return;
    resizeCleanup.current();
    event.preventDefault();
    const originX = event.screenX;
    const originScale = preferences.overlayLayout.scale;
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    let frame: number | null = null;
    let pendingScale = originScale;
    let active = true;
    handle.setPointerCapture(pointerId);
    const calculate = (screenX: number): number =>
      Math.max(.75, Math.min(1.75, Math.round((originScale + (screenX - originX) / 430) * 100) / 100));
    const sendPending = (): void => {
      frame = null;
      if (!active) return;
      void window.dotaOverlay.resizeOverlay(pendingScale).catch(() => undefined);
    };
    const move = (next: PointerEvent): void => {
      pendingScale = calculate(next.screenX);
      if (frame === null) frame = window.requestAnimationFrame(sendPending);
    };
    const cleanup = (): void => {
      if (!active) return;
      active = false;
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      handle.removeEventListener('lostpointercapture', finish);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      resizeCleanup.current = () => undefined;
    };
    const finish = (next?: PointerEvent): void => {
      if (next && next.type === 'pointerup') pendingScale = calculate(next.screenX);
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (active) void window.dotaOverlay.resizeOverlay(pendingScale).catch(() => undefined);
      cleanup();
    };
    resizeCleanup.current = cleanup;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    handle.addEventListener('lostpointercapture', finish);
  }
  return <div className={`overlay-screen ${status.overlayEditing ? 'editing' : ''} ${preferences.overlayLayout.locked ? 'locked' : ''}`}
    style={{ '--overlay-scale': String(status.overlayEffectiveScale) } as CSSProperties}>
    <div className="overlay-panel">
      {status.overlayEditing && <div className="overlay-editbar"><span>{preferences.overlayLayout.locked ? 'POSIÇÃO BLOQUEADA' : 'ARRASTE AQUI · REDIMENSIONE PELA ALÇA INFERIOR DIREITA'}</span><button type="button" onClick={() => void window.dotaOverlay.setOverlayEditing(false).catch(() => undefined)}>Concluir edição</button></div>}
      <div className="overlay-header"><strong>◈ DOTA IACOACH</strong><span className={`live-marker ${snapshot.source}`}>{snapshot.source === 'gsi' ? (snapshot.connected ? 'AO VIVO' : 'SEM SINAL') : snapshot.source === 'demo' ? 'DEMONSTRAÇÃO' : 'AGUARDANDO'}</span></div>
      {modules.stats && <><div className="overlay-line"><span>{snapshot.heroName ?? 'Aguardando Dota 2'}</span><b>{formatClock(snapshot.gameTime)}</b></div>
      <div className="overlay-stats">
        <div className={farm ? `farm-${farm.classification}` : ''}><small>LAST HITS</small><b>{value(snapshot.lastHits)}{farm ? <em> / média {farm.targetLastHits}</em> : null}</b></div>
        <div><small>DENIES</small><b>{value(snapshot.denies)}</b></div>
        <div className={netWorth ? `farm-${netWorth.classification}` : ''}><small>NET WORTH</small><b>{value(snapshot.netWorth)}{netWorth ? <em> / média {netWorth.target.toLocaleString('pt-BR')}</em> : <em> / GSI sem dado</em>}</b></div>
        <div className={gpm ? `farm-${gpm.classification}` : ''}><small>GPM</small><b>{value(snapshot.gpm)}{gpm ? <em> / média {gpm.target}</em> : null}</b></div>
      </div></>}
      {hasAdviceModule && <div className="overlay-advice">
        <div className="advice-title"><span>GUIA AO VIVO · {positionName[preferences.position]}</span>{advice && <small>{advice.sampleSize} partidas</small>}</div>
        {!snapshot.heroName && <div className="advice-state">As recomendações aparecem quando o herói for detectado.</div>}
        {snapshot.heroName && loading && !advice && <div className="advice-state">Buscando build e skills…</div>}
        {snapshot.heroName && error && !advice && <div className="advice-state error">Sem recomendação: {error}</div>}
        {snapshot.heroName && error && advice && <div className="advice-state error">{error}</div>}
        {advice && <div className={`advice-grid ${modules.skill !== modules.items ? 'single' : ''}`}>
          {modules.skill && <div className="next-skill">
            <small>PRÓXIMO UP {advice.nextSkillLevel ? `· NV. ${advice.nextSkillLevel}` : ''}</small>
            {advice.nextSkill ? <div className="advice-asset"><img src={advice.nextSkill.imageUrl} alt=""/><strong>{advice.nextSkill.name}</strong></div>
              : <span className="advice-unavailable">Sem próximo up na amostra</span>}
          </div>}
          {modules.skill && advice.talents.length > 0 && <div className="talent-advice"><small>TALENTOS</small>{advice.talents.map(talent => <div key={talent.level}><b>NV. {talent.level}{talent.level === 30 ? ' · FINAL' : ''}</b><span className={talent.recommended?.key === talent.left?.key ? 'recommended' : ''}>{talent.left?.name ?? '—'}</span><span className={talent.recommended?.key === talent.right?.key ? 'recommended' : ''}>{talent.right?.name ?? '—'}</span></div>)}</div>}
          {modules.skill && advice.nextTalent && <div className="next-talent"><small>PRÓXIMO TALENTO · NV. {advice.nextTalent.level}</small><strong>{advice.nextTalent.asset?.name ?? 'Escolha disponível'}</strong></div>}
          {modules.items && <div className="phase-items">
            <small>ITENS · {advice.itemPhase.toUpperCase()}</small>
            <div className="advice-items">{advice.items.map(item => <div key={item.id} title={item.name}><img src={item.imageUrl} alt={item.name}/><span>{item.name}</span></div>)}</div>
          </div>}
        </div>}
      </div>}
      {modules.items && <div className="overlay-item-timing">
        <div><small>PRIMEIRA OBSERVAÇÃO · NÃO É COMPRA</small><strong>{itemTiming.inventory.observation === 'unknown' ? 'Inventário ainda desconhecido' : `${itemTiming.observations.length} tipo(s) observado(s)`}</strong></div>
        {itemTiming.comparisons.length > 0 && (() => { const last = itemTiming.comparisons[itemTiming.comparisons.length - 1]; const delta = last.deltaSeconds; const deltaLabel = delta === null ? '' : ` ${delta >= 0 ? '+' : '−'}${formatClock(Math.abs(delta))}`; return <span className={last.verdict}>{last.observation.itemInternalName.replace(/^item_/, '').replaceAll('_', ' ')} · {last.verdict === 'no-sample' ? 'sem amostra' : last.verdict === 'unknown-time' ? 'tempo desconhecido' : last.verdict === 'early' ? 'adiantado' : last.verdict === 'late' ? 'atrasado' : 'no esperado'}{deltaLabel}</span>; })()}
      </div>}
      {modules.alerts && notificationCenter.runtime.active.length > 0 && <div className="overlay-alerts" aria-live="assertive">{notificationCenter.runtime.active.map(banner => <div className="overlay-alert" key={banner.id}><div><small>{banner.tags.map(tag => `#${tag}`).join(' ') || 'LEMBRETE'}</small><strong>{banner.title}</strong><span>{formatClock(banner.scheduledAt)}</span></div>{status.overlayEditing && <button type="button" aria-label={`Dispensar ${banner.title}`} onClick={() => void window.dotaOverlay.dismissNotification(banner.id)}>×</button>}</div>)}</div>}
      {status.overlayEditing && modules.alerts && notificationCenter.runtime.active.length === 0 && <div className="overlay-alert-preview">MÓDULO DE ALERTAS · NENHUM ALERTA ATIVO</div>}
      {status.overlayEditing && !preferences.overlayLayout.locked && <button type="button" tabIndex={-1} className="overlay-resize-handle" aria-label="Alça de redimensionamento por ponteiro; alternativa numérica disponível nas configurações" onPointerDown={beginResize}>↘</button>}
    </div>
  </div>;
}
