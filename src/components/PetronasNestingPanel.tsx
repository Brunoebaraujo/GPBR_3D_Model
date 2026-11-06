import { useEffect, useMemo, useState } from 'react';
import type { ContainerSpec } from '../types';
import { PETRONAS_SKUS } from '../data/petronas';
import {
  optimizeMultiSkuNesting, type MultiSkuScenario, type PetronasSelection,
  type MultiSkuOptions,
} from '../utils/multiSkuNesting';

interface Props {
  container: ContainerSpec;
  onShowScenario: (scenario: MultiSkuScenario) => void;
  onClearScenario: () => void;
}

const pretty = (n: number, decimals = 1) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

export function PetronasNestingPanel({ container, onShowScenario, onClearScenario }: Props) {
  const [selected, setSelected] = useState<PetronasSelection[]>([
    { skuId: 'cx24x1', minQuantity: 1, maxQuantity: null, grossWeightKg: null },
    { skuId: 'bd20l', minQuantity: 1, maxQuantity: null, grossWeightKg: null },
  ]);
  const [options, setOptions] = useState<MultiSkuOptions>({
    spacingMm: 0, allowStacking: true,
  });
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const optimization = useMemo(() => optimizeMultiSkuNesting(container, selected, options), [container, selected, options]);
  const scenarios = optimization.scenarios;
  const baseline = optimization.baseline;

  useEffect(() => { setActiveScenario(null); }, [container]);

  const invalidate = () => {
    setActiveScenario(null);
    onClearScenario();
  };
  const updateSelected = (next: PetronasSelection[]) => {
    setSelected(next);
    invalidate();
  };
  const patchSelected = (skuId: string, patch: Partial<PetronasSelection>) =>
    updateSelected(selected.map(item => item.skuId === skuId ? { ...item, ...patch } : item));
  const patchOptions = (patch: Partial<MultiSkuOptions>) => {
    setOptions(value => ({ ...value, ...patch }));
    invalidate();
  };
  const see = (scenario: MultiSkuScenario) => {
    setActiveScenario(scenario.id);
    onShowScenario(scenario);
  };

  const totalMissingWeights = selected.filter(item => item.grossWeightKg === null).length;

  return (
    <aside className="panel properties-panel petronas-panel">
      <p className="eyebrow">Petronas · Catálogo de embalagens</p>
      <h2>Nesting misto MB5 / MB6</h2>
      <p className="muted">Selecione múltiplos SKUs. Cada produto tem mínimo padrão de 1 unidade; o algoritmo busca arranjos que atendam todos os mínimos, sem deitar as embalagens.</p>

      <div className="section">
        <h3>1. Seleção de produtos</h3>
        <label className="field">
          <span>Adicionar SKU</span>
          <select aria-label="Adicionar produto Petronas" value="" onChange={event => {
            const id = event.target.value;
            if (id && !selected.some(item => item.skuId === id)) updateSelected([...selected, { skuId: id, minQuantity: 1, maxQuantity: null, grossWeightKg: null }]);
          }}>
            <option value="">Selecionar no catálogo…</option>
            {PETRONAS_SKUS.map(sku =>
              <option key={sku.id} value={sku.id} disabled={!sku.dimensions || selected.some(item => item.skuId === sku.id)}>{sku.label}</option>,
            )}
          </select>
        </label>
        {selected.map(item => {
          const sku = PETRONAS_SKUS.find(value => value.id === item.skuId)!;
          const d = sku.dimensions!;
          return (
            <div className="petronas-sku" key={item.skuId}>
              <div className="petronas-sku-heading">
                <span className="petronas-swatch" style={{ backgroundColor: sku.color }} />
                <strong>{sku.label}</strong>
                <button type="button" className="petronas-remove" title="Remover produto" aria-label={`Remover ${sku.label}`} onClick={() => updateSelected(selected.filter(value => value.skuId !== sku.id))}>×</button>
              </div>
              <p className="muted">{d.width} × {d.depth} × {d.height} mm{sku.id.startsWith('bd') ? ' · BD: até 3 camadas do mesmo produto' : ''}{sku.kind === 'cylinder' ? ' · Cilindro vertical' : ''}</p>
              <div className="petronas-fields">
                <label>Mínimo de unid.
                  <input aria-label={`Mínimo ${sku.label}`} type="number" min="0" step="1" value={item.minQuantity ?? 1} onChange={event => patchSelected(sku.id, { minQuantity: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} />
                </label>
                <label>Máximo de unid.
                  <input aria-label={`Máximo ${sku.label}`} type="number" min="1" step="1" placeholder="Livre" value={item.maxQuantity ?? ''} onChange={event => patchSelected(sku.id, { maxQuantity: event.target.value === '' ? null : Math.max(1, Math.floor(Number(event.target.value) || 1)) })} />
                </label>
                <label>Peso bruto / unid. (kg)
                  <input aria-label={`Peso ${sku.label}`} type="number" min="0.01" step="0.1" placeholder="Pendente" value={item.grossWeightKg ?? ''} onChange={event => patchSelected(sku.id, { grossWeightKg: event.target.value === '' ? null : Number(event.target.value) > 0 ? Number(event.target.value) : null })} />
                </label>
              </div>
              {sku.sourceNote && <p className="petronas-note">{sku.sourceNote}</p>}
              <details className="petronas-cages">
                <summary>Referência: quantidades nas gaiolas</summary>
                <p>1,20 × 1,20 (32): {sku.cageQuantities?.cage32 ?? '—'} · 1,20 × 1,20 (48): {sku.cageQuantities?.cage48 ?? '—'}</p>
                <p>1,14 × 1,14: {sku.cageQuantities?.cage114 ?? '—'} · 0,90 × 0,90: {sku.cageQuantities?.cage90 ?? '—'}</p>
              </details>
            </div>
          );
        })}
        {selected.length === 0 && <p className="warning-text">Selecione pelo menos um produto para simular.</p>}
        {totalMissingWeights > 0 && <p className="petronas-note"><strong>{totalMissingWeights} SKU(s) sem peso bruto:</strong> o limite de 1.650 kg NÃO estará validado. Não inferimos pesos a partir do volume nominal.</p>}
      </div>

      <div className="section">
        <h3>2. Condições do arranjo</h3>
        <p className="muted">Mínimo padrão = 1 por produto. Mínimo 0 torna o SKU opcional; mínimos maiores que o máximo ou que a capacidade do Goodpack não geram cenário.</p>
        <label className="field"><span>Folga horizontal (mm)</span>
          <input type="number" min="0" max="100" step="1" value={options.spacingMm}
            onChange={event => patchOptions({ spacingMm: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} />
        </label>
        <label className="checkbox-field"><input type="checkbox" checked={options.allowStacking} onChange={event => patchOptions({ allowStacking: event.target.checked })} />Empilhar caixas e baldes BD (até 3 camadas)</label>
        <p className="muted"><strong>Topo sempre para cima:</strong> apenas rotações horizontais de 0° e 90°. <strong>Baldes BD: no máximo 3 camadas do mesmo SKU</strong> (se a altura útil permitir), sem outras embalagens por cima. O empilhamento exige apoio geométrico integral; resistência e movimentação não são certificadas.</p>
      </div>

      <div className="section">
        <h3>3. Cenários calculados · {container.name}</h3>
        <p className="muted">{optimization.attempts} permutações testadas · até 5 combinações distintas · cada cenário atende os mínimos configurados.</p>
        {optimization.error && <p className="petronas-infeasible" role="status"><strong>Nenhuma solução válida.</strong> {optimization.error}</p>}
        {baseline && <div className="petronas-comparison"><div><span>Algoritmo anterior</span><strong>{pretty(baseline.volumePercent)}%</strong></div><div><span>Melhor resultado encontrado</span><strong>{pretty(scenarios[0]?.volumePercent ?? 0)}%</strong></div><div><span>Ganho de ocupação</span><strong>+{pretty(Math.max(0, (scenarios[0]?.volumePercent ?? 0) - baseline.volumePercent))} p.p.</strong></div></div>}
        {scenarios.map(scenario => <div className={`petronas-scenario ${activeScenario === scenario.id ? 'active' : ''}`} key={scenario.id}>
          <div className="petronas-scenario-title"><strong>{scenario.name}</strong><strong>{pretty(scenario.volumePercent)}%</strong></div>
          <p className="muted">{scenario.description}</p>
          <p><strong>{scenario.totalQuantity}</strong> unidades · {scenario.weightVerified ? `${pretty(scenario.knownWeightKg)} kg` : 'Peso não validado'}</p>
          <div className="petronas-breakdown">
            {selected.filter(item => scenario.counts[item.skuId]).map(item => {
              const sku = PETRONAS_SKUS.find(value => value.id === item.skuId)!;
              const units = scenario.objects.filter(object => object.sourceObjectId === sku.id);
              const rotated = units.filter(object => object.rotation.z === 90).length;
              return <div key={sku.id}><span className="petronas-swatch" style={{ backgroundColor: sku.color }} /><span>{sku.label}<small>{units.length - rotated} sem giro · {rotated} giradas 90°</small></span><strong>{scenario.counts[sku.id]}</strong></div>;
            })}
          </div>
          {scenario.totalQuantity === 0 && <p className="warning-text">Nenhum produto coube com as restrições atuais.</p>}
          <button type="button" className={activeScenario === scenario.id ? 'primary-button' : ''} disabled={scenario.totalQuantity === 0} onClick={() => see(scenario)}>
            {activeScenario === scenario.id ? 'Exibindo no 3D' : 'Visualizar cenário no 3D'}
          </button>
        </div>)}
      </div>
      {activeScenario !== null && <button type="button" onClick={() => { invalidate(); }}>Limpar prévia 3D</button>}
      <p className="muted">Busca heurística: a melhor solução dentre as permutações testadas, sem garantia de ótimo global. Valide pesos, dimensões reais, resistência e amarração antes da operação.</p>
    </aside>
  );
}
