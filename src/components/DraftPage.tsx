import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSection, type HeroRecord } from '../data/catalog';
import { reconcileDraftScenario, recommendDraft, shouldApplyDraftStoreEcho, validateDraftScenario, type DraftHero } from '../core/draft-advisor';
import type { DraftLiveState, DraftMatchupEvidence, DraftScenario, DraftScenarioState } from '../shared/contracts';

const modeLabel = { 'all-pick': 'All Pick', turbo: 'Turbo', captains: "Captain's Mode" } as const;
const positionLabel = ['','Carry','Mid','Offlane','Suporte 4','Suporte 5'];
const clone = (scenario: DraftScenario): DraftScenario => ({ ...scenario,
  allies: [...scenario.allies], enemies: [...scenario.enemies], bans: [...scenario.bans] });

function HeroGroup({ title, kind, ids, heroes, blocked, onAdd, onRemove }: {
  title: string; kind: 'allies' | 'enemies' | 'bans'; ids: number[]; heroes: HeroRecord[]; blocked: Set<number>;
  onAdd: (id: number) => void; onRemove: (id: number) => void;
}) {
  const [selection, setSelection] = useState('');
  const byId = useMemo(() => new Map(heroes.map(hero => [hero.id, hero])), [heroes]);
  return <section className={`draft-group ${kind}`}><div className="card-top"><h3>{title}</h3><span className="mini-label">{ids.length}</span></div>
    <div className="draft-add"><select aria-label={`Adicionar ${kind === 'allies' ? 'aliado' : kind === 'enemies' ? 'inimigo' : 'ban'}`} value={selection} onChange={event => setSelection(event.target.value)}><option value="">Escolha um herói…</option>{heroes.filter(hero => !blocked.has(hero.id)).map(hero => <option key={hero.id} value={hero.id}>{hero.name}</option>)}</select><button type="button" disabled={!selection} onClick={() => { onAdd(Number(selection)); setSelection(''); }}>Adicionar</button></div>
    <div className="draft-chips">{ids.map(id => <button type="button" key={id} title="Remover" onClick={() => onRemove(id)}>{byId.get(id)?.name ?? `Herói ${id}`} <span>×</span></button>)}{ids.length === 0 && <small>Nenhum selecionado</small>}</div>
  </section>;
}

export function DraftPage({ state, draftLive, onMessage, onOpenHero }: {
  state: DraftScenarioState;
  draftLive?: DraftLiveState;
  onMessage: (message: string) => void;
  onOpenHero: (internalName: string) => void;
}) {
  const [heroes, setHeroes] = useState<HeroRecord[]>([]);
  const [scenario, setScenario] = useState<DraftScenario>(() => clone(state.current));
  const [evidence, setEvidence] = useState<DraftMatchupEvidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [onlineError, setOnlineError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [catalogWarning, setCatalogWarning] = useState('');
  const [busy, setBusy] = useState(false);
  const localRevision = useRef(0);
  const pendingSaveRevision = useRef<number | null>(null);
  const requestRevision = useRef(0);
  useEffect(() => {
    let active = true;
    void loadSection('heroes').then(value => { if (active) setHeroes(value as HeroRecord[]); })
      .catch(error => { if (active) setCatalogError(`Catálogo de heróis indisponível: ${error instanceof Error ? error.message : String(error)}`); });
    return () => { active = false; };
  }, []);
  const draftHeroes: DraftHero[] = useMemo(() => heroes.map(hero => ({ id: hero.id, name: hero.name,
    roles: [...hero.roles], captainMode: hero.captainMode })), [heroes]);
  const visibleHeroes = scenario.mode === 'captains' ? heroes.filter(hero => hero.captainMode) : heroes;
  const blocked = new Set([...scenario.allies, ...scenario.enemies, ...scenario.bans]);

  function applyLocal(candidate: DraftScenario): void {
    localRevision.current++;
    setScenario(clone(candidate));
  }
  function reconcileAndLoad(candidate: DraftScenario): void {
    const result = reconcileDraftScenario(candidate, draftHeroes);
    const next = { ...result.scenario, updatedAt: result.removedHeroIds.length ? Date.now() : result.scenario.updatedAt };
    applyLocal(next);
    if (result.removedHeroIds.length) {
      const warning = `Cenário reconciliado com o catálogo: ${result.removedHeroIds.length} herói(s) inválido(s) removido(s), inclusive fora do pool de Captain's Mode.`;
      setCatalogWarning(warning);
      onMessage(warning);
      const revision = localRevision.current;
      pendingSaveRevision.current = revision;
      setBusy(true);
      void window.dotaOverlay.saveDraftScenario(next)
        .then(() => onMessage(`${warning} A versão salva também foi atualizada.`))
        .catch(error => onMessage(`Cenário corrigido na tela, mas não foi possível atualizar a versão salva: ${String(error)}`))
        .finally(() => {
          if (pendingSaveRevision.current === revision) pendingSaveRevision.current = null;
          setBusy(false);
        });
    }
  }
  useEffect(() => {
    if (!shouldApplyDraftStoreEcho(localRevision.current, pendingSaveRevision.current)) return;
    if (!draftHeroes.length) { setScenario(clone(state.current)); return; }
    const result = reconcileDraftScenario(state.current, draftHeroes);
    if (!result.removedHeroIds.length) { setScenario(clone(result.scenario)); return; }
    const next = { ...result.scenario, updatedAt: Date.now() };
    applyLocal(next);
    const warning = `Cenário salvo reconciliado com o catálogo: ${result.removedHeroIds.length} herói(s) inválido(s) removido(s), inclusive fora do pool de Captain's Mode.`;
    setCatalogWarning(warning); onMessage(warning);
    void window.dotaOverlay.saveDraftScenario(next).catch(error =>
      onMessage(`Cenário corrigido na tela, mas não foi possível persistir: ${String(error)}`));
  }, [state.current.id, state.current.updatedAt, draftHeroes]);

  useEffect(() => {
    const revision = ++requestRevision.current;
    const requestedEnemyIds = [...scenario.enemies];
    if (!requestedEnemyIds.length) { setEvidence([]); setLoading(false); setOnlineError(''); return; }
    const controller = new AbortController();
    let active = true;
    setEvidence([]); setLoading(true); setOnlineError('');
    void window.dotaOverlay.getLibraryUrl().then(async libraryUrl => {
      if (!libraryUrl) throw new Error('Servidor local da biblioteca indisponível.');
      const results = await Promise.all(requestedEnemyIds.map(async enemyId => {
        const response = await fetch(new URL(`api/opendota/heroes/${enemyId}/matchups`, libraryUrl), { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || `OpenDota HTTP ${response.status}`);
        const rows = Array.isArray(body.data) ? body.data.flatMap((row: unknown) => {
          if (!row || typeof row !== 'object') return [];
          const raw = row as Record<string, unknown>;
          const heroId = Number(raw.hero_id), gamesPlayed = Number(raw.games_played), wins = Number(raw.wins);
          return Number.isInteger(heroId) && heroId > 0 && Number.isFinite(gamesPlayed) && gamesPlayed >= 0 &&
            Number.isFinite(wins) && wins >= 0 && wins <= gamesPlayed ? [{ heroId, gamesPlayed, wins }] : [];
        }) : [];
        return { focalEnemyId: enemyId, source: String(body.source || 'OpenDota API'),
          fetchedAt: String(body.fetchedAt || ''), rows } satisfies DraftMatchupEvidence;
      }));
      if (active && revision === requestRevision.current) setEvidence(results);
    }).catch(error => {
      if (active && revision === requestRevision.current && !controller.signal.aborted) {
        setEvidence([]); setOnlineError(error instanceof Error ? error.message : String(error));
      }
    }).finally(() => { if (active && revision === requestRevision.current) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [scenario.enemies.join(',')]);

  const recommendations = useMemo(() => {
    if (!draftHeroes.length) return [];
    try { return recommendDraft({ scenario, heroes: draftHeroes, matchups: evidence, limit: 10 }); }
    catch { return []; }
  }, [scenario, draftHeroes, evidence]);

  function change(patch: Partial<DraftScenario>): void {
    const candidate = { ...scenario, ...patch, updatedAt: Date.now() };
    try { applyLocal(validateDraftScenario(candidate, draftHeroes.length ? draftHeroes : undefined)); }
    catch (error) { onMessage(`Draft inválido: ${error instanceof Error ? error.message : String(error)}`); }
  }
  function changeMode(mode: DraftScenario['mode']): void {
    if (mode !== 'captains') { change({ mode }); return; }
    const pool = new Set(heroes.filter(hero => hero.captainMode).map(hero => hero.id));
    change({ mode, allies: scenario.allies.filter(id => pool.has(id)), enemies: scenario.enemies.filter(id => pool.has(id)), bans: scenario.bans.filter(id => pool.has(id)) });
  }
  function add(kind: 'allies'|'enemies'|'bans', id: number): void { change({ [kind]: [...scenario[kind], id] }); }
  function remove(kind: 'allies'|'enemies'|'bans', id: number): void { change({ [kind]: scenario[kind].filter(value => value !== id) }); }
  async function save(): Promise<void> {
    setBusy(true);
    pendingSaveRevision.current = localRevision.current;
    try { await window.dotaOverlay.saveDraftScenario(validateDraftScenario(scenario, draftHeroes)); onMessage('Cenário salvo localmente.'); }
    catch (error) { onMessage(`Não foi possível salvar: ${String(error)}`); }
    finally { pendingSaveRevision.current = null; setBusy(false); }
  }
  async function removeSaved(saved: DraftScenario): Promise<void> {
    if (!window.confirm(`Excluir o cenário “${saved.name}”?`)) { onMessage('Exclusão cancelada.'); return; }
    setBusy(true);
    try { await window.dotaOverlay.deleteDraftScenario(saved.id); onMessage('Cenário excluído.'); }
    catch (error) { onMessage(`Não foi possível excluir: ${String(error)}`); }
    finally { setBusy(false); }
  }
  function loadDemo(): void {
    const candidate: DraftScenario = { id: `draft-demo-${Date.now()}`, name: 'Demo explicável', mode: 'all-pick', position: 5,
      allies: [2], enemies: [1], bans: [14], updatedAt: Date.now() };
    try { applyLocal(validateDraftScenario(candidate, draftHeroes)); onMessage('Demo carregada. Os confrontos usam OpenDota; cobertura de funções continua heurística.'); }
    catch (error) { onMessage(`Não foi possível carregar a demo: ${String(error)}`); }
  }
  function newScenario(): void {
    applyLocal({ id: `draft-${Date.now()}`, name: 'Novo cenário', mode: 'all-pick', position: 1,
      allies: [], enemies: [], bans: [], updatedAt: Date.now() });
    onMessage('Novo cenário local iniciado. Salve quando terminar.');
  }
  const live = draftLive;
  const liveName = (heroId: number) => heroes.find(hero => hero.id === heroId)?.name ?? `Herói ${heroId}`;
  return <>
    <div className="page-top"><div><div className="eyebrow">PLANEJAMENTO MANUAL · FORA DA AÇÃO</div><h1>Draft Advisor</h1><p>Counters com amostra pública e cobertura de funções explicitamente heurística.</p></div><div className="version">{modeLabel[scenario.mode].toUpperCase()} · POS. {scenario.position}</div></div>
    <div className="draft-live" role="status" aria-live="polite">{catalogError || catalogWarning || (loading ? 'Consultando confrontos na OpenDota.' : `${recommendations.length} recomendações disponíveis.`)}</div>
    {live?.prompt?.visible && <section className="settings-card draft-context-prompt" role="dialog" aria-label="Ajuda contextual do draft">
      <div><div className="eyebrow">DRAFT AO VIVO · GSI</div><h3>{live.prompt.message}</h3><p>{live.enemies.length ? `${live.enemies.length} inimigo(s) confirmado(s). Você pode acompanhar ou preencher o editor manualmente.` : 'Nenhum inimigo confirmado ainda; o editor manual continua disponível.'}</p></div>
      <div className="draft-actions"><button type="button" className="primary-button" onClick={() => void window.dotaOverlay.dismissDraftPrompt('ranked')}>Ajuda ranqueada</button><button type="button" className="secondary-button" onClick={() => void window.dotaOverlay.dismissDraftPrompt('follow')}>Só acompanhar</button><button type="button" className="secondary-button" onClick={() => void window.dotaOverlay.dismissDraftPrompt('later')}>Agora não</button></div>
    </section>}
    {live?.source === 'gsi' && live.phase !== 'unknown' && <section className="settings-card draft-live-card"><div className="card-top"><div><h3>Draft recebido do GSI</h3><p>Somente escolhas confirmadas pelo jogo; dados ausentes não são preenchidos por API histórica.</p></div><span className="mini-label">{live.phase.toUpperCase()}</span></div><div className="draft-chips">{live.allies.map(pick => <span key={`a-${pick.order}-${pick.heroId}`}>{live.localTeam === 'unknown' ? 'Radiant' : 'Aliado'} · {liveName(pick.heroId)}</span>)}{live.enemies.map(pick => <span key={`e-${pick.order}-${pick.heroId}`}>{live.localTeam === 'unknown' ? 'Dire' : 'Inimigo'} · {liveName(pick.heroId)}</span>)}{live.bans.map(pick => <span key={`b-${pick.order}-${pick.heroId}`}>Ban · {liveName(pick.heroId)}</span>)}{!live.allies.length && !live.enemies.length && !live.bans.length && <small>Aguardando picks/bans confirmados.</small>}</div></section>}
    {catalogError && <div className="notice error" role="alert" aria-live="assertive">{catalogError} O editor permanece bloqueado até o catálogo local voltar.</div>}
    {catalogWarning && <div className="notice" role="status">{catalogWarning}</div>}
    <section className="settings-card draft-toolbar"><div className="draft-fields"><label><span>Nome do cenário</span><input maxLength={60} aria-label="Nome do cenário" value={scenario.name} onChange={event => change({name:event.target.value})}/></label><label><span>Modo</span><select aria-label="Modo de draft" value={scenario.mode} onChange={event => changeMode(event.target.value as DraftScenario['mode'])}><option value="all-pick">All Pick</option><option value="turbo">Turbo</option><option value="captains">Captain's Mode</option></select></label><label><span>Posição buscada</span><select aria-label="Posição do draft" value={scenario.position} onChange={event => change({position:Number(event.target.value) as DraftScenario['position']})}>{[1,2,3,4,5].map(position => <option key={position} value={position}>{position} · {positionLabel[position]}</option>)}</select></label></div>
      <div className="draft-actions"><button type="button" className="secondary-button" onClick={newScenario}>Novo</button><button type="button" className="secondary-button" disabled={!draftHeroes.length} onClick={loadDemo}>Carregar demo</button><button type="button" className="primary-button" disabled={busy || !draftHeroes.length} onClick={() => void save()}>Salvar cenário</button></div>
      {state.saved.length > 0 && <div className="saved-drafts"><span>SALVOS</span>{state.saved.map(saved => <div key={saved.id}><button type="button" disabled={busy || !draftHeroes.length} onClick={() => reconcileAndLoad(saved)}>{saved.name}</button><button type="button" disabled={busy} aria-label={`Excluir ${saved.name}`} onClick={() => void removeSaved(saved)}>×</button></div>)}</div>}
    </section>
    <div className="draft-groups"><HeroGroup title="Aliados" kind="allies" ids={scenario.allies} heroes={visibleHeroes} blocked={blocked} onAdd={id => add('allies',id)} onRemove={id => remove('allies',id)}/><HeroGroup title="Inimigos" kind="enemies" ids={scenario.enemies} heroes={visibleHeroes} blocked={blocked} onAdd={id => add('enemies',id)} onRemove={id => remove('enemies',id)}/><HeroGroup title="Bans" kind="bans" ids={scenario.bans} heroes={visibleHeroes} blocked={blocked} onAdd={id => add('bans',id)} onRemove={id => remove('bans',id)}/></div>
    <section className="settings-card draft-results" aria-busy={loading}><div className="card-top"><div><h3>Recomendações explicadas</h3><p>Ordenação estável: confronto elegível, vantagem, confiança, amostra e depois cobertura heurística.</p></div><span className={`mini-label ${onlineError ? 'draft-offline' : ''}`}>{loading ? 'CONSULTANDO OPENDOTA' : onlineError ? 'MODO OFFLINE · HEURÍSTICAS' : `${evidence.length} INIMIGOS COM DADOS`}</span></div>
      {onlineError && <div className="notice error" role="alert" aria-live="assertive">OpenDota indisponível: {onlineError}. A lista continua somente com heurísticas locais.</div>}
      <div className="draft-disclaimer">All Pick e Turbo usam o mesmo endpoint público, que não fornece filtro de modo nesta consulta. Captain's Mode filtra somente o pool marcado no catálogo. Não há sinergia estatística entre aliados.</div>
      <div className="draft-recommendations" aria-live="polite">{recommendations.map((recommendation,index) => { const hero=heroes.find(value=>value.id===recommendation.heroId); const fetchedAtValue=recommendation.statistic?.fetchedAt ? Date.parse(recommendation.statistic.fetchedAt) : Number.NaN; const fetchedAt=Number.isFinite(fetchedAtValue) ? new Date(fetchedAtValue).toLocaleString('pt-BR') : 'horário indisponível'; return <article key={recommendation.heroId}><div className="draft-rank">#{index+1}</div><div className="draft-hero"><strong>{recommendation.heroName}</strong><small>{hero?.roles.join(' · ') || 'Funções não informadas'}</small><button type="button" onClick={() => hero?.internalName && onOpenHero(hero.internalName)}>Abrir na biblioteca →</button></div><div className="draft-stat">{recommendation.statistic ? <><strong>{(recommendation.statistic.winRate*100).toFixed(1)}%</strong><small>contra inimigos · n={recommendation.statistic.sampleSize}</small><span>{recommendation.statistic.source} · confiança {recommendation.statistic.confidence}</span><span>Atualizado: {fetchedAt}</span></> : <><strong>—</strong><small>Sem amostra estatística elegível</small><span>OpenDota indisponível/insuficiente</span></>}</div><div className="draft-reasons">{recommendation.explanations.map((explanation,reasonIndex) => <p key={reasonIndex} className={explanation.kind}><span>{explanation.kind === 'statistic' ? 'ESTATÍSTICA' : explanation.kind === 'heuristic' ? 'HEURÍSTICA' : 'INDISPONÍVEL'}</span>{explanation.text}</p>)}</div></article>; })}</div>
    </section>
  </>;
}
