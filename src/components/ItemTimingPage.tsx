import { useEffect, useMemo, useState } from 'react';
import { loadSection, type ItemRecord } from '../data/catalog';
import type { ItemTimingState } from '../shared/contracts';
import { formatClock } from './useOverlay';

const areaNames = { active: 'Inventário', backpack: 'Mochila', stash: 'Baú', teleport: 'TP', neutral: 'Neutro' } as const;
const verdictNames = { early: 'ADIANTADO', expected: 'NO ESPERADO', late: 'ATRASADO', 'no-sample': 'SEM AMOSTRA', 'unknown-time': 'TEMPO DESCONHECIDO' } as const;
const readableKey = (internalName: string): string => internalName.replace(/^item_/, '').replaceAll('_', ' ');

export function ItemTimingPage({ state }: { state: ItemTimingState }) {
  const [catalog, setCatalog] = useState<ItemRecord[]>([]);
  useEffect(() => { void loadSection('items').then(value => setCatalog(value as ItemRecord[])); }, []);
  const names = useMemo(() => new Map(catalog.map(item => [`item_${item.key}`, item.name])), [catalog]);
  const itemName = (internalName: string): string => names.get(internalName) ?? readableKey(internalName);
  const observed = state.inventory.slots.filter(slot => slot.state === 'present');
  const unknownCount = state.inventory.slots.filter(slot => slot.state === 'unknown').length;
  const emptyCount = state.inventory.slots.filter(slot => slot.state === 'empty').length;
  return <>
    <div className="page-top"><div><div className="eyebrow">INVENTÁRIO PRÓPRIO · PRIMEIRA OBSERVAÇÃO</div><h1>Timing de itens</h1><p>Histórico defensivo do que o GSI mostrou. Aparição não significa compra confirmada.</p></div><div className={`version item-source ${state.source}`}>{state.source === 'demo' ? 'DEMO SINTÉTICA' : state.source === 'gsi' ? 'GSI · NÃO VALIDADO' : 'AGUARDANDO GSI'}</div></div>
    <div className="item-summary">
      <section className="settings-card"><div className="card-top"><div><h3>Inventário observado</h3><p>Slots ausentes continuam desconhecidos; somente campos presentes podem ser vazios.</p></div><span className="mini-label">{observed.length} PRESENTES · {emptyCount} VAZIOS · {unknownCount} DESCONHECIDOS</span></div>
        {state.inventory.observation === 'unknown' ? <div className="stats-empty">O pacote ainda não trouxe o campo <code>items</code>.</div> : <div className="inventory-slots">{state.inventory.slots.map(slot => <div key={slot.key} className={slot.state}><small>{areaNames[slot.area]} · {slot.key}</small><strong>{slot.state === 'present' && slot.itemInternalName ? itemName(slot.itemInternalName) : slot.state === 'empty' ? 'Vazio observado' : 'Desconhecido'}</strong>{slot.charges !== null && <span>{slot.charges} cargas</span>}</div>)}</div>}
      </section>
      <section className="settings-card item-evidence"><div className="card-top"><div><h3>Qualidade da evidência</h3><p>O tracker deduplica troca de slot, mochila, baú, combinação e reaparição.</p></div></div>
        <div className="evidence-line"><span>Fonte atual</span><strong>{state.validation === 'synthetic-demo' ? 'Fixture autoral sintética' : state.validation === 'unvalidated-gsi' ? 'GSI local ainda não validado no Dota' : 'Nenhuma'}</strong></div>
        <div className="evidence-line"><span>Evento registrado</span><strong>Primeira observação, não compra</strong></div>
        <div className="evidence-line"><span>Payload salvo</span><strong>Não — somente estado compacto</strong></div>
      </section>
    </div>
    <section className="settings-card item-history"><div className="card-top"><div><h3>Histórico da build</h3><p>Comparação com benchmark demonstrativo quando há uma amostra compatível.</p></div><span className="mini-label">{state.observations.length} PRIMEIRAS OBSERVAÇÕES</span></div>
      {state.comparisons.length === 0 ? <div className="stats-empty">Ative a demonstração ou conecte uma partida para começar.</div> : <div className="timing-list">{state.comparisons.map(comparison => <article key={comparison.observation.itemInternalName}>
        <div><strong>{itemName(comparison.observation.itemInternalName)}</strong><small>{areaNames[comparison.observation.firstSeenArea]} · visto às {formatClock(comparison.observation.firstSeenAt)}</small></div>
        <span className={`timing-verdict ${comparison.verdict}`}>{verdictNames[comparison.verdict]}</span>
        <div className="timing-benchmark">{comparison.benchmark ? <><strong>{formatClock(comparison.benchmark.expectedSeconds)}</strong><small>referência ±{Math.round(comparison.benchmark.toleranceSeconds / 60)} min · n={comparison.benchmark.sampleSize}</small><small>{comparison.benchmark.source} · {comparison.benchmark.patch}</small></> : <small>Nenhum benchmark compatível para herói/posição/item.</small>}</div>
      </article>)}</div>}
    </section>
    <div className="stats-disclaimer"><strong>Limite semântico:</strong> o GSI mostra estado do inventário em pacotes. Troca, courier, combinação, venda e reaparição podem produzir mudanças, mas o app não as chama de compra. A fixture da demo não é dado profissional.</div>
  </>;
}
