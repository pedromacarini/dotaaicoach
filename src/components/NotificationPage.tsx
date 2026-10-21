import { useMemo, useState } from 'react';
import type { NotificationCenterState, NotificationRule, NotificationPosition } from '../shared/contracts';
import { formatClock } from './useOverlay';

const blankRule = (): NotificationRule => ({
  id: `custom-${Date.now()}`, enabled: true, title: '', atSeconds: 0, position: 'all', tags: [],
  repeatEverySeconds: null, repeatUntilSeconds: null, durationSeconds: 8, audio: 'silent',
});

function parseClock(value: string): number | null {
  const match = value.trim().match(/^(-)?(\d{1,3}):(\d{2})$/);
  if (!match || Number(match[3]) > 59) return null;
  return (match[1] ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

export function NotificationPage({ state, position, onMessage }: {
  state: NotificationCenterState;
  position: number;
  onMessage: (message: string) => void;
}) {
  const [draft, setDraft] = useState<NotificationRule>(() => blankRule());
  const [clockDraft, setClockDraft] = useState('06:00');
  const [ruleClockDraft, setRuleClockDraft] = useState('00:00');
  const [tagFilter, setTagFilter] = useState('all');
  const [presetId, setPresetId] = useState('');
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const tags = useMemo(() => [...new Set(state.config.rules.flatMap(rule => rule.tags))].sort(), [state.config.rules]);
  const visibleRules = tagFilter === 'all' ? state.config.rules : state.config.rules.filter(rule => rule.tags.includes(tagFilter));

  async function action<T>(work: () => Promise<T>, success?: string): Promise<{ ok: true; value: T } | { ok: false }> {
    setBusy(true);
    try {
      const value = await work();
      if (success) onMessage(success);
      return { ok: true, value };
    }
    catch (error) { onMessage(`Erro no cronograma: ${String(error)}`); return { ok: false }; }
    finally { setBusy(false); }
  }
  async function saveRule(): Promise<void> {
    const atSeconds = parseClock(ruleClockDraft);
    if (atSeconds === null) { onMessage('O tempo da regra precisa estar em MM:SS.'); return; }
    const result = await action(() => window.dotaOverlay.upsertNotificationRule({...draft,atSeconds}), 'Regra salva e aplicada ao relógio.');
    if (!result.ok) return;
    setDraft(blankRule());
    setRuleClockDraft('00:00');
  }
  function edit(rule: NotificationRule): void { setDraft({ ...rule, tags: [...rule.tags] }); setRuleClockDraft(formatClock(rule.atSeconds)); }
  async function simulate(): Promise<void> {
    const seconds = parseClock(clockDraft);
    if (seconds === null) { onMessage('Use o relógio no formato MM:SS, por exemplo 06:00 ou -01:00.'); return; }
    await action(() => window.dotaOverlay.setSimulatedGameTime(seconds), `Relógio simulado em ${formatClock(seconds)}.`);
  }
  async function applyPreset(): Promise<void> {
    if (!presetId) return;
    if (!window.confirm('Aplicar este preset substituirá todas as regras atuais. Deseja continuar?')) {
      onMessage('Aplicação do preset cancelada; suas regras foram preservadas.');
      return;
    }
    await action(() => window.dotaOverlay.applyNotificationPreset(presetId), 'Preset aplicado; regras anteriores foram substituídas.');
  }
  async function transfer(kind: 'import' | 'export'): Promise<void> {
    const result = await action(() => kind === 'import'
      ? window.dotaOverlay.importNotifications() : window.dotaOverlay.exportNotifications());
    if (!result.ok) return;
    if (result.value.canceled) {
      onMessage(kind === 'import' ? 'Importação cancelada.' : 'Exportação cancelada.');
      return;
    }
    onMessage(kind === 'import' ? 'Backup validado e restaurado.' : `Backup exportado${result.value.filePath ? ` em ${result.value.filePath}.` : '.'}`);
  }

  return <>
    <div className="page-top"><div><div className="eyebrow">LEMBRETES PELO RELÓGIO DA PARTIDA</div><h1>Cronograma</h1><p>Regras locais, editáveis e sem inferência de objetivos ocultos.</p></div><div className="page-help-actions"><div className="version">SCHEMA 1 · {state.config.mode.toUpperCase()}</div><button type="button" className="help-button" aria-label="Ajuda sobre cronograma" onClick={() => setShowHelp(value => !value)}>?</button></div></div>
    {showHelp && <section className="settings-card contextual-help"><div className="card-top"><div><h3>Como funciona o Cronograma?</h3><p>Ele usa o relógio calibrado do GSI e dispara lembretes locais no horário configurado.</p></div><button type="button" className="secondary-button" onClick={() => setShowHelp(false)}>Fechar</button></div><p>Use presets para começar e ajuste pull, stack, runas, Lotus, Roshan e Tormentor conforme sua posição. <strong>Silencioso</strong> não toca nada, <strong>som</strong> usa o beep do sistema e <strong>voz</strong> tenta o áudio em português. O relógio simulado serve para testar sem abrir o Dota.</p></section>}
    <div className="notification-summary">
      <section className="settings-card notification-clock"><div className="card-top"><div><h3>Relógio de teste</h3><p>Simule qualquer instante sem abrir o Dota. O relógio real volta ao encerrar.</p></div><span className={`mini-label ${state.runtime.simulated ? 'simulation' : ''}`}>{state.runtime.simulated ? 'SIMULAÇÃO' : 'RELÓGIO GSI'}</span></div>
        <div className="notification-test-row"><label><span>MM:SS</span><input aria-label="Relógio simulado" value={clockDraft} onChange={event => setClockDraft(event.target.value)}/></label><button type="button" className="primary-button" disabled={busy} onClick={() => void simulate()}>Simular instante</button><button type="button" className="secondary-button" disabled={busy || !state.runtime.simulated} onClick={() => void action(() => window.dotaOverlay.setSimulatedGameTime(null), 'Simulação encerrada; o GSI voltou a comandar o relógio.')}>Encerrar</button></div>
        <div className="clock-readout">{formatClock(state.runtime.gameTime)}<small>{state.runtime.simulated ? 'TEMPO SIMULADO' : 'TEMPO RECEBIDO'}</small></div>
      </section>
      <section className="settings-card notification-preset"><div className="card-top"><div><h3>Modo e preset</h3><p>Os presets são autorais e devem ser revisados após cada patch.</p></div><button type="button" className="sound-preview" disabled={busy} onClick={() => void action(() => window.dotaOverlay.previewNotificationSound(), 'Som local reproduzido.')}>♪ Testar som</button></div>
        <div className="mode-buttons"><button type="button" className={state.config.mode === 'normal' ? 'selected' : ''} aria-pressed={state.config.mode === 'normal'} onClick={() => void action(() => window.dotaOverlay.setNotificationMode('normal'), 'Modo normal selecionado.')}>Normal</button><button type="button" className={state.config.mode === 'turbo' ? 'selected' : ''} aria-pressed={state.config.mode === 'turbo'} onClick={() => void action(() => window.dotaOverlay.setNotificationMode('turbo'), 'Modo Turbo selecionado.')}>Turbo</button></div>
        <div className="preset-row"><select aria-label="Preset de cronograma" value={presetId} onChange={event => setPresetId(event.target.value)}><option value="">Escolha um preset…</option>{state.presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name} · {preset.patch}</option>)}</select><button type="button" className="secondary-button" disabled={!presetId || busy} onClick={() => void applyPreset()}>Aplicar</button></div>
      </section>
    </div>

    {state.runtime.active.length > 0 && <section className="active-alerts" aria-live="polite"><div><small>ALERTAS ATIVOS</small>{state.runtime.active.map(banner => <strong key={banner.id}>{banner.title} · {formatClock(banner.scheduledAt)}</strong>)}</div>{state.runtime.active.map(banner => <button type="button" key={banner.id} onClick={() => void window.dotaOverlay.dismissNotification(banner.id)}>Dispensar {banner.title}</button>)}</section>}

    <section className="settings-card notification-editor"><div className="card-top"><div><h3>{state.config.rules.some(rule => rule.id === draft.id) ? 'Editar regra' : 'Nova regra'}</h3><p>Posição é a função escolhida nas configurações; “Todas” vale para qualquer função.</p></div><span className="mini-label">POSIÇÃO ATUAL {position}</span></div>
      <div className="notification-form">
        <label className="wide"><span>Título</span><input maxLength={80} value={draft.title} onChange={event => setDraft({...draft,title:event.target.value})}/></label>
        <label><span>Tempo (MM:SS)</span><input value={ruleClockDraft} onChange={event => setRuleClockDraft(event.target.value)}/></label>
        <label><span>Posição</span><select value={draft.position} onChange={event => setDraft({...draft,position:(event.target.value==='all'?'all':Number(event.target.value)) as NotificationPosition})}><option value="all">Todas</option>{[1,2,3,4,5].map(value => <option key={value} value={value}>Posição {value}</option>)}</select></label>
        <label><span>Tags (vírgulas)</span><input value={draft.tags.join(', ')} onChange={event => setDraft({...draft,tags:event.target.value.split(',').map(tag=>tag.trim()).filter(Boolean).slice(0,8)})}/></label>
        <label><span>Repetir a cada (s)</span><input type="number" min="10" max="7200" value={draft.repeatEverySeconds ?? ''} onChange={event => setDraft({...draft,repeatEverySeconds:event.target.value===''?null:Number(event.target.value)})}/></label>
        <label><span>Repetir até (s)</span><input type="number" min={draft.atSeconds} max="14400" disabled={draft.repeatEverySeconds===null} value={draft.repeatUntilSeconds ?? ''} onChange={event => setDraft({...draft,repeatUntilSeconds:event.target.value===''?null:Number(event.target.value)})}/></label>
        <label><span>Duração (s)</span><input type="number" min="2" max="30" value={draft.durationSeconds} onChange={event => setDraft({...draft,durationSeconds:Number(event.target.value)})}/></label>
        <label><span>Áudio</span><select value={draft.audio} onChange={event => setDraft({...draft,audio:event.target.value as NotificationRule['audio']})}><option value="silent">Silencioso</option><option value="beep">Som do sistema</option><option value="voice">Voz em português</option></select></label>
      </div>
      <div className="notification-editor-actions"><button type="button" className="primary-button" disabled={busy || !draft.title.trim()} onClick={() => void saveRule()}>Salvar regra</button><button type="button" className="secondary-button" disabled={busy} onClick={() => { setDraft(blankRule()); setRuleClockDraft('00:00'); }}>Limpar</button></div>
    </section>

    <section className="settings-card rules-card"><div className="card-top"><div><h3>Regras ativas e filtros</h3><p>{state.config.rules.length} de 200 regras locais.</p></div><select aria-label="Filtrar por tag" value={tagFilter} onChange={event => setTagFilter(event.target.value)}><option value="all">Todas as tags</option>{tags.map(tag => <option key={tag} value={tag}>#{tag}</option>)}</select></div>
    <div className="notification-rules">{visibleRules.map(rule => <article key={rule.id} className={rule.enabled ? '' : 'disabled'}><button type="button" className={`rule-toggle ${rule.enabled ? 'on' : ''}`} aria-label={`Alternar ${rule.title}`} aria-pressed={rule.enabled} onClick={() => void action(() => window.dotaOverlay.upsertNotificationRule({...rule,enabled:!rule.enabled}), 'Regra atualizada.')}>●</button><div><strong>{rule.title}</strong><small>{formatClock(rule.atSeconds)} · {rule.position === 'all' ? 'Todas as posições' : `Posição ${rule.position}`}{rule.repeatEverySeconds ? ` · repete ${rule.repeatEverySeconds}s até ${formatClock(rule.repeatUntilSeconds ?? 14_400)}` : ''}</small><span>{rule.tags.map(tag => `#${tag}`).join(' ') || 'sem tags'} · {rule.audio === 'beep' ? 'som do sistema' : rule.audio === 'voice' ? 'voz em português' : 'silencioso'}</span></div><button type="button" onClick={() => edit(rule)}>Editar</button><button type="button" className="danger" onClick={() => void action(() => window.dotaOverlay.deleteNotificationRule(rule.id), 'Regra removida.')}>Excluir</button></article>)}</div>
    </section>
    <div className="notification-backup"><div><strong>Backup e restauração</strong><small>Somente JSON validado, no máximo 1 MB e 200 regras.</small></div><button type="button" className="secondary-button" onClick={() => void transfer('export')}>Exportar JSON</button><button type="button" className="secondary-button" onClick={() => void transfer('import')}>Importar JSON</button></div>
    <div className="footerline"><span>Tempos autorais e editáveis · Confira o patch antes de jogar</span><span>Voz local em português usa a síntese disponível no Windows</span></div>
  </>;
}
