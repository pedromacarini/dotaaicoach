import { LibraryExplorer } from './LibraryExplorer';
import { useState } from 'react';
import { formatClock, useOverlay } from './useOverlay';
import { StatsPage } from './StatsPage';
import type { Position } from '../shared/contracts';
import { OverlaySettings } from './OverlaySettings';
import { NotificationPage } from './NotificationPage';
import { ItemTimingPage } from './ItemTimingPage';
import { DraftPage } from './DraftPage';
const value = (n: number | null) => n === null ? '—' : n.toLocaleString('pt-BR');
const positions: Array<{id:Position;name:string;detail:string}> = [
  {id:1,name:'Carry',detail:'Safe lane · prioridade de farm'},
  {id:2,name:'Mid',detail:'Rota central · ritmo e níveis'},
  {id:3,name:'Offlane',detail:'Hard lane · iniciação e pressão'},
  {id:4,name:'Suporte 4',detail:'Roaming · utilidade e criação'},
  {id:5,name:'Suporte 5',detail:'Hard support · visão e proteção'},
];
export function Dashboard() {
  const { snapshot, status, preferences, gsiDiagnostics, matchSessions, notificationCenter, itemTiming, draftScenarios } = useOverlay();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const apiAvailable = Boolean(window.dotaOverlay);
  const [page,setPage] = useState<'overview'|'library'|'gsi'|'stats'|'items'|'draft'|'notifications'|'settings'>('overview');
  const [libraryHeroKey,setLibraryHeroKey] = useState<string | null>(null);
  async function saveConfig() {
    setBusy(true); setMessage('');
    try {
      const result = await window.dotaOverlay.saveGsiConfig();
      if (!result.canceled) setMessage(`Arquivo salvo em: ${result.filePath}. Caso esteja fora da pasta do Dota 2, mova-o para gamestate_integration.`);
    } catch (e) { setMessage(`Erro ao salvar: ${String(e)}`); }
    finally { setBusy(false); }
  }
  async function setPosition(position: Position) {
    setBusy(true); setMessage('');
    try { await window.dotaOverlay.setPosition(position); setMessage(`Posição ${position} salva. O overlay já usará essa seleção.`); }
    catch (e) { setMessage(`Erro ao salvar posição: ${String(e)}`); }
    finally { setBusy(false); }
  }
  async function installConfig() {
    setBusy(true); setMessage('');
    try {
      const result = await window.dotaOverlay.installGsiConfig();
      if (result.installed) setMessage('Configuração instalada. Se o Dota 2 já estiver aberto, reinicie o jogo e entre em uma partida de teste.');
      else if (!result.canceled) setMessage(result.diagnostics.installation.error || 'A configuração não foi instalada.');
    } catch (e) { setMessage(`Erro ao instalar: ${String(e)}`); }
    finally { setBusy(false); }
  }
  const diagnosticFields = [
    ['Herói', snapshot.heroName], ['Atividade', snapshot.playerActivity], ['Nível', snapshot.heroLevel], ['Tempo', snapshot.gameTime],
    ['Last hits', snapshot.lastHits], ['Negações', snapshot.denies], ['Patrimônio', snapshot.netWorth],
    ['GPM', snapshot.gpm], ['Abates', snapshot.kills], ['Mortes', snapshot.deaths], ['Assistências', snapshot.assists],
  ] as const;
  const hasRealPacket = snapshot.source === 'gsi';
  const lastPacketText = gsiDiagnostics.lastPacketAt
    ? new Date(gsiDiagnostics.lastPacketAt).toLocaleTimeString('pt-BR') : 'Nenhum pacote recebido';
  return <div className="dashboard">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon">◈</span><div><strong>DOTA OPEN</strong><small>OVERLAY · 0.2.1</small></div></div>
      <button type="button" className={`menu-item menu-button ${page === 'overview' ? 'current' : ''}`} onClick={() => setPage('overview')}>▣ Visão geral</button>
      <button type="button" className={`menu-item menu-button ${page === 'library' ? 'current' : ''}`} onClick={() => setPage('library')}>◈ Biblioteca Dota 2</button>
      <button type="button" className={`menu-item menu-button ${page === 'gsi' ? 'current' : ''}`} onClick={() => { setPage('gsi'); setMessage(''); }}>◉ GSI local</button>
      <button type="button" className={`menu-item menu-button ${page === 'stats' ? 'current' : ''}`} onClick={() => setPage('stats')}>⌁ Estatísticas</button>
      <button type="button" className={`menu-item menu-button ${page === 'items' ? 'current' : ''}`} onClick={() => setPage('items')}>◇ Itens</button>
      <button type="button" className={`menu-item menu-button ${page === 'draft' ? 'current' : ''}`} onClick={() => { setPage('draft'); setMessage(''); }}>♙ Draft Advisor</button>
      <button type="button" className={`menu-item menu-button ${page === 'notifications' ? 'current' : ''}`} onClick={() => { setPage('notifications'); setMessage(''); }}>◴ Cronograma</button>
      <button type="button" className={`menu-item menu-button ${page === 'settings' ? 'current' : ''}`} onClick={() => setPage('settings')}>⚙ Configurações</button>
      <div className="sidebar-end">Projeto independente e experimental.<br/>Sem leitura de memória, automação ou acesso a dados ocultos.</div>
    </aside>
    <main className={`main-area ${page === 'library' ? 'library-host' : ''}`}>{page === 'library' ? <LibraryExplorer heroKey={libraryHeroKey}/> : page === 'stats' ? <StatsPage snapshot={snapshot} preferences={preferences} sessions={matchSessions}/> : page === 'items' ? <ItemTimingPage state={itemTiming}/> : page === 'draft' ? <><DraftPage state={draftScenarios} onMessage={setMessage} onOpenHero={key => { setLibraryHeroKey(key); setPage('library'); }}/>{message && <div className="notice">{message}</div>}</> : page === 'notifications' ? <><NotificationPage state={notificationCenter} position={preferences.position} onMessage={setMessage}/>{message && <div className="notice">{message}</div>}</> : page === 'gsi' ? <>
      <div className="page-top"><div><div className="eyebrow">CONEXÃO COM O DOTA 2</div><h1>Diagnóstico GSI</h1><p>Instalação, comunicação local e campos recebidos em tempo real.</p></div><div className="version">PORTA {status.gsiPort}</div></div>
      <div className="gsi-health-grid">
        <div className={status.gsiListening?'ok':'bad'}><span>1</span><small>SERVIDOR LOCAL</small><strong>{status.gsiListening?'Pronto':'Indisponível'}</strong><p>{status.gsiListening?'Escutando somente neste computador.':'A porta não pôde ser aberta.'}</p></div>
        <div className={gsiDiagnostics.installation.configCurrent?'ok':'pending'}><span>2</span><small>CONFIGURAÇÃO</small><strong>{gsiDiagnostics.installation.configCurrent?'Instalada':gsiDiagnostics.installation.detected?'Aguardando instalação':'Dota não localizado'}</strong><p>{gsiDiagnostics.installation.detectionSource || 'Você poderá selecionar a pasta manualmente.'}</p></div>
        <div className={hasRealPacket && snapshot.connected?'ok':'pending'}><span>3</span><small>DOTA 2</small><strong>{hasRealPacket && snapshot.connected?'Enviando dados':'Aguardando partida'}</strong><p>{lastPacketText}</p></div>
      </div>
      <section className="settings-card gsi-setup">
        <div className="card-top"><div><h3>Instalação automática</h3><p>O app procura as bibliotecas do Steam e grava somente o arquivo oficial de Game State Integration.</p></div><span className="mini-label">SEM LEITURA DE MEMÓRIA</span></div>
        <div className="path-box"><small>PASTA DO DOTA 2</small><code>{gsiDiagnostics.installation.dotaPath || 'Não localizada automaticamente'}</code></div>
        <div className="gsi-actions"><button type="button" className="primary-button" disabled={busy || !apiAvailable} onClick={() => void installConfig()}>{busy?'Verificando...':gsiDiagnostics.installation.configInstalled?'Verificar / atualizar configuração':'Localizar e instalar configuração'}</button><button type="button" className="secondary-button" disabled={busy || !apiAvailable} onClick={() => void saveConfig()}>Salvar CFG manualmente</button></div>
        {gsiDiagnostics.installation.configFilePath && <p className="config-target">Destino: <code>{gsiDiagnostics.installation.configFilePath}</code></p>}
        {gsiDiagnostics.installation.error && <div className="notice error">{gsiDiagnostics.installation.error}</div>}
      </section>
      <section className="settings-card">
        <div className="card-top"><div><h3>Pacotes recebidos</h3><p>O modo demonstração não conta aqui. Estes indicadores representam apenas dados enviados pelo Dota.</p></div><span className="mini-label">{gsiDiagnostics.packetsReceived} ACEITOS · {gsiDiagnostics.rejectedRequests} REJEITADOS</span></div>
        <div className="diagnostic-fields">{diagnosticFields.map(([label, fieldValue]) => {
          const received = hasRealPacket && fieldValue !== null;
          return <div key={label} className={received?'received':'missing'}><span>{received?'✓':'—'}</span><div><strong>{label}</strong><small>{received?'recebido':'ainda ausente'}</small></div></div>;
        })}</div>
        {gsiDiagnostics.lastProblem && <div className="notice error">Último problema: {gsiDiagnostics.lastProblem}</div>}
      </section>
      {message && <div className="notice">{message}</div>}
      <div className="footerline"><span>Próximo teste: reinicie o Dota e entre em lobby, partida contra bots ou replay.</span><span>Endpoint local 127.0.0.1</span></div>
    </> : page === 'settings' ? <>
      <div className="page-top"><div><div className="eyebrow">PREFERÊNCIAS DO OVERLAY</div><h1>Configurações</h1><p>Escolhas salvas no computador e compartilhadas entre o painel e o overlay.</p></div><div className="version">PERFIL LOCAL</div></div>
      <section className="settings-card">
        <div className="card-top"><div><h3>Sua posição</h3><p>Define qual amostra de builds e skills será usada durante a partida.</p></div><span className="mini-label">POSIÇÃO {preferences.position}</span></div>
        <div className="position-grid">{positions.map(position => <button type="button" key={position.id} disabled={busy} className={preferences.position===position.id?'selected':''} onClick={() => void setPosition(position.id)}><span>{position.id}</span><strong>{position.name}</strong><small>{position.detail}</small></button>)}</div>
      </section>
      <OverlaySettings preferences={preferences} status={status} onMessage={setMessage}/>
      <section className="settings-card compact"><div><h3>O que já vale no overlay</h3><p>Herói detectado pelo GSI, próxima skill da amostra profissional e itens populares da fase atual da partida.</p></div><div className="settings-status"><span className={status.gsiListening?'ok':''}>● GSI {status.gsiListening?'pronto':'indisponível'}</span><span>● Cache OpenDota: 30 min</span></div></section>
      {message && <div className="notice">{message}</div>}
      <div className="footerline"><span>Layout validado e mantido dentro da área útil do monitor.</span><span>Salvo apenas neste computador</span></div>
    </> : <>
      <div className="page-top"><div><div className="eyebrow">PAINEL DE CONTROLE</div><h1>Visão geral</h1><p>Seu Dota 2, seus dados, sua interface.</p></div><div className="version">MVP OPEN SOURCE</div></div>
      <div className="status-row"><div className={`status-pill ${snapshot.source}`}><span className="dot"/> {snapshot.source === 'demo' ? 'Demonstração ativa' : snapshot.connected ? 'Recebendo partida' : 'Sem partida conectada'}</div><div className="status-text">Servidor local: {status.gsiListening ? `127.0.0.1:${status.gsiPort}` : 'indisponível'}</div></div>
      {status.error && <div className="notice error">{status.error}</div>}
      <section className="hero-card"><div className="hero-top"><div><small>PARTIDA ATUAL</small><h2>{snapshot.heroName || 'Nenhum herói detectado'}</h2><p>{snapshot.gameState === 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS' ? 'Partida em andamento' : snapshot.source === 'idle' ? 'Inicie o Dota 2 ou ative a demonstração.' : 'Visualização de informações disponíveis'}</p></div><div className="match-clock">{formatClock(snapshot.gameTime)}<small>TEMPO DE JOGO</small></div></div>
        <div className="hero-stats"><div><small>NÍVEL</small><strong>{value(snapshot.heroLevel)}</strong></div><div><small>ÚLTIMOS HITS</small><strong>{value(snapshot.lastHits)}</strong></div><div><small>NEGAÇÕES</small><strong>{value(snapshot.denies)}</strong></div><div><small>PATRIMÔNIO</small><strong>{value(snapshot.netWorth)}</strong></div><div><small>GPM</small><strong>{value(snapshot.gpm)}</strong></div></div>
      </section>
      <div className="sections-grid">
        <section className="card"><div className="card-top"><h3>Overlay em tempo real</h3><span className="mini-label">JANELA TRANSPARENTE</span></div><p>Mostra apenas dados recebidos localmente. Para testar sem jogo, ligue o modo demonstração.</p><div className="control-row"><div><strong>Exibir overlay</strong><small>Atalho global: Ctrl + Shift + F9</small></div><button type="button" className={`toggle ${status.overlayVisible ? 'active' : ''}`} aria-label="Alternar overlay" aria-pressed={status.overlayVisible} disabled={!apiAvailable} onClick={() => void window.dotaOverlay.setOverlayVisible(!status.overlayVisible)}><span/></button></div><div className="control-row"><div><strong>Modo demonstração</strong><small>Dados fictícios claramente identificados</small></div><button type="button" className={`toggle ${status.demoEnabled ? 'active' : ''}`} aria-label="Alternar demonstração" aria-pressed={status.demoEnabled} disabled={!apiAvailable} onClick={() => void window.dotaOverlay.setDemo(!status.demoEnabled)}><span/></button></div></section>
        <section className="card"><div className="card-top"><h3>Conectar Dota 2</h3><span className="mini-label">GAME STATE INTEGRATION</span></div><p>O diagnóstico localiza o jogo, instala a configuração com sua confirmação e mostra cada campo recebido.</p><div className="steps"><span>01</span><div>Abra o diagnóstico GSI.</div></div><div className="steps"><span>02</span><div>Instale a configuração automaticamente.</div></div><div className="steps"><span>03</span><div>Reinicie o Dota 2 e abra uma partida de teste.</div></div><button type="button" className="primary-button" disabled={!apiAvailable} onClick={() => { setPage('gsi'); setMessage(''); }}>Abrir diagnóstico GSI →</button></section>
      </div>
      {message && <div className="notice">{message}</div>}
      <div className="footerline"><span>Dados locais · Nenhuma nuvem ou telemetria própria</span><span>Não é afiliado à Valve ou ao Dota2Brasil</span></div>
    </>}
    </main>
  </div>;
}
