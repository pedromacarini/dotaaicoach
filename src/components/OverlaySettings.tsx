import { useEffect, useState } from 'react';
import type { AppPreferences, AppStatus, OverlayLayoutPatch, OverlayModules } from '../shared/contracts';

const moduleLabels: Array<{ key: keyof OverlayModules; name: string; detail: string }> = [
  { key: 'stats', name: 'Estatísticas', detail: 'Herói, relógio, LH, denies, patrimônio e GPM' },
  { key: 'skill', name: 'Próxima skill', detail: 'Próximo ponto da amostra profissional' },
  { key: 'items', name: 'Itens', detail: 'Itens populares da fase atual' },
  { key: 'alerts', name: 'Alertas', detail: 'Banners e som automático das regras do Cronograma' },
];

export function OverlaySettings({ preferences, status, onMessage }: {
  preferences: AppPreferences;
  status: AppStatus;
  onMessage: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const layout = preferences.overlayLayout;
  const [scaleDraft, setScaleDraft] = useState(() => String(Math.round(layout.scale * 100)));
  useEffect(() => setScaleDraft(String(Math.round(layout.scale * 100))), [layout.scale]);

  async function update(patch: OverlayLayoutPatch): Promise<void> {
    try { await window.dotaOverlay.updateOverlayLayout(patch); }
    catch (error) { onMessage(`Erro ao atualizar overlay: ${String(error)}`); }
  }
  async function edit(): Promise<void> {
    setBusy(true);
    try {
      await window.dotaOverlay.setOverlayEditing(!status.overlayEditing);
      onMessage(status.overlayEditing
        ? 'Edição concluída. O overlay voltou a ignorar o mouse.'
        : 'Modo de edição ativo. Arraste pela faixa superior e redimensione pela alça inferior direita.');
    } catch (error) { onMessage(`Erro ao alternar edição: ${String(error)}`); }
    finally { setBusy(false); }
  }
  async function reset(): Promise<void> {
    setBusy(true);
    try {
      await window.dotaOverlay.resetOverlayLayout();
      onMessage('Layout restaurado. Posição, escala, opacidade e módulos voltaram ao padrão.');
    } catch (error) { onMessage(`Erro ao restaurar layout: ${String(error)}`); }
    finally { setBusy(false); }
  }
  function commitScale(): void {
    const percent = Number(scaleDraft);
    if (!Number.isFinite(percent) || percent < 75 || percent > 175) {
      setScaleDraft(String(Math.round(layout.scale * 100)));
      onMessage('A escala deve ficar entre 75% e 175%.');
      return;
    }
    const normalized = Math.round(percent / 5) * 5;
    setScaleDraft(String(normalized));
    void update({ scale: normalized / 100 });
  }

  return <section className="settings-card overlay-settings">
    <div className="card-top"><div><h3>Editor do overlay</h3><p>Ajuste a janela em tempo real. Ao concluir, ela volta a deixar os cliques passarem para o Dota.</p></div><span className={`mini-label ${status.overlayEditing ? 'editing' : ''}`}>{status.overlayEditing ? 'EDITANDO' : 'CLICK-THROUGH'}</span></div>
    <div className="overlay-editor-actions">
      <button type="button" className="primary-button" aria-pressed={status.overlayEditing} disabled={busy} onClick={() => void edit()}>{status.overlayEditing ? 'Concluir edição' : 'Editar diretamente na tela'}</button>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => void reset()}>Restaurar padrão</button>
    </div>
    <div className="layout-controls">
      <label><span>Opacidade <strong>{Math.round(layout.opacity * 100)}%</strong></span><input aria-label="Opacidade em porcentagem" type="range" min="35" max="100" step="1" value={Math.round(layout.opacity * 100)} onChange={event => void update({ opacity: Number(event.target.value) / 100 })}/></label>
      <label><span>Escala proporcional <strong>{Math.round(layout.scale * 100)}%</strong></span><div className="range-with-number"><input aria-label="Escala proporcional" type="range" min="75" max="175" step="5" value={Math.round(layout.scale * 100)} onChange={event => { setScaleDraft(event.target.value); void update({ scale: Number(event.target.value) / 100 }); }}/><input aria-label="Escala numérica em porcentagem" type="number" min="75" max="175" step="5" value={scaleDraft} onChange={event => setScaleDraft(event.target.value)} onBlur={commitScale} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.preventDefault(); setScaleDraft(String(Math.round(layout.scale * 100))); } }}/></div></label>
      <label className="number-control"><span>Posição X</span><input type="number" step="1" value={layout.x ?? ''} onChange={event => { if (event.target.value !== '') void update({ x: Number(event.target.value) }); }}/></label>
      <label className="number-control"><span>Posição Y</span><input type="number" step="1" value={layout.y ?? ''} onChange={event => { if (event.target.value !== '') void update({ y: Number(event.target.value) }); }}/></label>
    </div>
    <div className="control-row overlay-lock"><div><strong>Bloquear posição e tamanho</strong><small>Durante a edição, impede arrastar e redimensionar sem esconder os controles.</small></div><button type="button" className={`toggle ${layout.locked ? 'active' : ''}`} aria-label="Bloquear posição e tamanho" aria-pressed={layout.locked} onClick={() => void update({ locked: !layout.locked })}><span/></button></div>
    <div className="module-controls"><small>MÓDULOS VISÍVEIS</small>{moduleLabels.map(module => <div className="control-row" key={module.key}><div><strong>{module.name}</strong><small>{module.detail}</small></div><button type="button" className={`toggle ${layout.modules[module.key] ? 'active' : ''}`} aria-label={`Alternar ${module.name}`} aria-pressed={layout.modules[module.key]} onClick={() => void update({ modules: { [module.key]: !layout.modules[module.key] } })}><span/></button></div>)}</div>
  </section>;
}
