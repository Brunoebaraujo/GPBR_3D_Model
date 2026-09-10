import { TOP_FACES } from '../utils/productGeometry';
import type {
  DimensionsMm,
  NestingMode,
  GridPackingResult,
  OrientationOptimizationResult,
  PackingObject,
  RotationDeg,
  TransformMode,
  TopFace,
  Vector3Mm,
} from '../types';
import { formatNumber } from '../utils/unitConversion';

interface ObjectPropertiesPanelProps {
  selectedObject: PackingObject | null;
  nestingMode: NestingMode;
  onNestingModeChange: (mode: NestingMode) => void;
  fillSpacingMm: number;
  lastPackingResult: GridPackingResult | null;
  orientationResult: OrientationOptimizationResult | null;
  transformMode: TransformMode;
  onTransformModeChange: (mode: TransformMode) => void;
  onFillSpacingChange: (spacingMm: number) => void;
  onFillContainer: () => void;
  onFindBestOrientation: () => void;
  onClearAutoFill: () => void;
  onUpdateObject: (object: PackingObject) => void;
  onDeleteObject: (id: string) => void;
}

type DimensionField = keyof DimensionsMm;
type PositionField = keyof Vector3Mm;
type RotationField = keyof RotationDeg;

const numberValue = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function ObjectPropertiesPanel({
  selectedObject,
  nestingMode,
  onNestingModeChange,
  fillSpacingMm,
  lastPackingResult,
  orientationResult,
  transformMode,
  onTransformModeChange,
  onFillSpacingChange,
  onFillContainer,
  onFindBestOrientation,
  onClearAutoFill,
  onUpdateObject,
  onDeleteObject,
}: ObjectPropertiesPanelProps) {
  if (!selectedObject) {
    return (
      <aside className="panel properties-panel">
        <p className="eyebrow">Propriedades</p>
        <h2>Nenhum produto selecionado</h2>
        <p className="muted">Selecione um produto na lista ou na cena para editar.</p>
      </aside>
    );
  }

  const update = (patch: Partial<PackingObject>) => {
    onUpdateObject({ ...selectedObject, ...patch });
  };

  const updateDimension = (field: DimensionField, value: string) => {
    const size = Math.max(1, numberValue(value));
    const dimensions = { ...selectedObject.dimensions, [field]: size };
    if (selectedObject.type === 'cylinder' && field !== 'height') dimensions.width = dimensions.depth = size;
    if (selectedObject.type === 'cube') dimensions.width = dimensions.depth = dimensions.height = size;
    update({ dimensions });
  };

  const updatePosition = (field: PositionField, value: string) => {
    update({
      position: {
        ...selectedObject.position,
        [field]: numberValue(value),
      },
    });
  };

  const updateRotation = (field: RotationField, value: string) => {
    update({
      rotation: {
        ...selectedObject.rotation,
        [field]: numberValue(value),
      },
    });
  };

  return (
    <aside className="panel properties-panel">
      <p className="eyebrow">Propriedades</p>
      <h2>{selectedObject.name}</h2>

      <label className="field">
        <span>Nome</span>
        <input value={selectedObject.name} onChange={(event) => update({ name: event.target.value })} />
      </label>

      <label className="field">
        <span>Peso por unidade (kg)</span>
        <input
          type="number"
          min="0"
          step="0.1"
          value={selectedObject.weightKg}
          onChange={(event) => update({ weightKg: Math.max(0, numberValue(event.target.value)) })}
        />
      </label>

      <div className="section">
        <h3>Manipular com o mouse</h3>
        <div className="segmented-control">
          <button
            type="button"
            className={transformMode === 'translate' ? 'active' : ''}
            onClick={() => onTransformModeChange('translate')}
          >
            Mover
          </button>
          <button
            type="button"
            className={transformMode === 'rotate' ? 'active' : ''}
            onClick={() => onTransformModeChange('rotate')}
          >
            Girar
          </button>
        </div>
      </div>

      <div className="section">
        <h3>Dimensões (mm)</h3>
        <div className="grid-fields">
          <label className="field">
            <span>Largura X</span>
            <input
              type="number"
              min="1"
              value={selectedObject.dimensions.width}
              onChange={(event) => updateDimension('width', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Profundidade Y</span>
            <input
              type="number"
              min="1"
              value={selectedObject.dimensions.depth}
              onChange={(event) => updateDimension('depth', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Altura Z</span>
            <input
              type="number"
              min="1"
              value={selectedObject.dimensions.height}
              onChange={(event) => updateDimension('height', event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="section">
        <h3>Posição (mm)</h3>
        <div className="grid-fields">
          <label className="field">
            <span>X</span>
            <input
              type="number"
              value={selectedObject.position.x}
              onChange={(event) => updatePosition('x', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Y</span>
            <input
              type="number"
              value={selectedObject.position.y}
              onChange={(event) => updatePosition('y', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Z</span>
            <input
              type="number"
              value={selectedObject.position.z}
              onChange={(event) => updatePosition('z', event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="section">
        <h3>Rotação (graus)</h3>
        <div className="grid-fields">
          <label className="field">
            <span>X</span>
            <input
              type="number"
              value={selectedObject.rotation.x}
              onChange={(event) => updateRotation('x', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Y</span>
            <input
              type="number"
              value={selectedObject.rotation.y}
              onChange={(event) => updateRotation('y', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Z</span>
            <input
              type="number"
              value={selectedObject.rotation.z}
              onChange={(event) => updateRotation('z', event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="section"><h3>Topo do produto</h3><label className="field"><span>Face superior</span><select value={selectedObject.topFace ?? '+z'} onChange={e => update({ topFace: e.target.value as TopFace })}>{TOP_FACES.filter(face => selectedObject.type !== 'cylinder' || face.value.endsWith('z')).map(face => <option key={face.value} value={face.value}>{face.label}</option>)}</select></label><label className="checkbox-field"><input type="checkbox" checked={selectedObject.keepTopUp ?? false} onChange={e => update({ keepTopUp: e.target.checked })} />Manter topo para cima</label></div>
      <div className="section fill-section">
        <h3>Preencher Goodpack</h3>
        <fieldset className="nesting-modes">
          <legend>Modo de nesting</legend>
          <label className={nestingMode === 'uniform' ? 'selected' : ''}>
            <input type="radio" name="nesting-mode" value="uniform" checked={nestingMode === 'uniform'} onChange={() => onNestingModeChange('uniform')} />
            <span><strong>Orientação única</strong><small>Todas as peças com a mesma rotação.</small></span>
          </label>
          <label className={nestingMode === 'mixed' ? 'selected' : ''}>
            <input type="radio" name="nesting-mode" value="mixed" checked={nestingMode === 'mixed'} onChange={() => onNestingModeChange('mixed')} />
            <span><strong>Orientações combinadas</strong><small>Preserva a grade principal e preenche as sobras com peças giradas.</small></span>
          </label>
        </fieldset>
        {nestingMode === 'mixed' && <div className="nesting-guidance">
          <p>A rotação acima define a orientação principal. As peças adicionais aparecem em roxo; o topo continua verde.</p>
          {selectedObject.keepTopUp
            ? <p><strong>Topo protegido:</strong> para permitir peças de pé ou deitadas com outra face para cima, desmarque “Manter topo para cima”.</p>
            : <p>Peças de pé e deitadas são permitidas. Peso e folga continuam sendo respeitados.</p>}
        </div>}
        <label className="field">
          <span>Folga entre peças (mm)</span>
          <input
            type="number"
            min="0"
            value={fillSpacingMm}
            onChange={(event) => onFillSpacingChange(Math.max(0, numberValue(event.target.value)))}
          />
        </label>
        <div className="button-stack">
          <button type="button" onClick={onFindBestOrientation}>
            {nestingMode === 'mixed' ? 'Buscar melhor combinação' : 'Buscar melhor orientação'}
          </button>
          <button type="button" onClick={onFillContainer}>
            Preencher Goodpack
          </button>
          <button type="button" onClick={onClearAutoFill}>
            Limpar preenchimento
          </button>
        </div>
        {orientationResult ? (
          <div className="fill-summary">
            <p><strong>{lastPackingResult?.pattern}</strong></p>
            <dl>
              <div>
                <dt>Melhor rotação</dt>
                <dd>
                  X {orientationResult.rotation.x} / Y {orientationResult.rotation.y} / Z {orientationResult.rotation.z}
                </dd>
              </div>
              <div>
                <dt>Orientações testadas</dt>
                <dd>{orientationResult.testedCount}</dd>
              </div>
              <div>
                <dt>Capacidade geométrica</dt>
                <dd>{orientationResult.packingResult.totalQuantity} peças</dd>
              </div>
              <div>
                <dt>Capacidade por peso</dt>
                <dd>{orientationResult.packingResult.payloadLimitedQuantity} peças</dd>
              </div>
              <div>
                <dt>Peso da capacidade geométrica</dt>
                <dd>{formatNumber(orientationResult.packingResult.totalWeight)} kg</dd>
              </div>
              <div>
                <dt>Ocupação com carga permitida</dt>
                <dd>{formatNumber(orientationResult.packingResult.volumeUtilizationPercent)}%</dd>
              </div>
              <div>
                <dt>Critério</dt>
                <dd>{orientationResult.reason}</dd>
              </div>
            </dl>
          </div>
        ) : null}
        {lastPackingResult ? (
          <div className="fill-summary">
            <strong>{lastPackingResult.pattern}</strong>
            {lastPackingResult.orientationBreakdown && <>
              <div className="nesting-comparison" aria-label="Comparação com orientação única">
                <div><span>Orientação única</span><strong>{lastPackingResult.uniformQuantity}</strong></div>
                <div><span>Resultado combinado</span><strong>{lastPackingResult.payloadLimitedQuantity}</strong></div>
                <div><span>Ganho com peso permitido</span><strong>+{lastPackingResult.addedQuantity}</strong></div>
              </div>
              <p className="muted">{lastPackingResult.mixedNote}</p>
              <div className="orientation-table"><table>
                <caption>Quantidade por orientação</caption>
                <thead><tr><th scope="col">Rotação X / Y / Z (°)</th><th scope="col">Geom.</th><th scope="col">Por peso</th></tr></thead>
                <tbody>{lastPackingResult.orientationBreakdown.map((group, index) => <tr key={index}>
                  <th scope="row"><span className={group.isSecondary ? 'orientation-dot secondary' : 'orientation-dot'} style={group.isSecondary ? undefined : { backgroundColor: selectedObject.color }} />{group.isSecondary ? 'Adicional' : 'Principal'}<small>{formatNumber(group.rotation.x, 0)} / {formatNumber(group.rotation.y, 0)} / {formatNumber(group.rotation.z, 0)}</small></th>
                  <td>{group.geometricalQuantity}</td><td>{group.quantity}</td>
                </tr>)}</tbody>
              </table></div>
              <p className="muted">A comparação mantém a mesma orientação principal e folga. É uma simulação geométrica; apoio e resistência ao empilhamento não são calculados.</p>
            </>}
            <p className="muted">Prévia: {lastPackingResult.positions.length} peças. O preenchimento considera apenas este produto.</p>
            {lastPackingResult.warning ? <p className="warning-text">{lastPackingResult.warning}</p> : null}
            <dl>
              <div>
                <dt>{nestingMode === 'mixed' ? 'Grade principal: colunas × fileiras × camadas' : 'Colunas máx. × fileiras × camadas'}</dt>
                <dd>
                  {lastPackingResult.countX} x {lastPackingResult.countY} x {lastPackingResult.countZ}
                </dd>
              </div>
              <div>
                <dt>Capacidade geométrica</dt>
                <dd>{lastPackingResult.totalQuantity} peças</dd>
              </div>
              <div>
                <dt>Capacidade por peso</dt>
                <dd>{lastPackingResult.payloadLimitedQuantity} peças</dd>
              </div>
              <div>
                <dt>Peso da capacidade geométrica</dt>
                <dd>{formatNumber(lastPackingResult.totalWeight)} kg</dd>
              </div>
              <div>
                <dt>Saldo na capacidade geométrica</dt>
                <dd>{formatNumber(lastPackingResult.remainingPayload)} kg</dd>
              </div>
              <div>
                <dt>Capacidade geométrica × peso</dt>
                <dd>{lastPackingResult.exceedsPayload ? 'Excede carga máxima' : 'Dentro do limite'}</dd>
              </div>
              <div>
                <dt>Ocupação com carga permitida</dt>
                <dd>{formatNumber(lastPackingResult.volumeUtilizationPercent)}%</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>

      <button type="button" className="danger-button" onClick={() => onDeleteObject(selectedObject.id)}>
        Delete object
      </button>
    </aside>
  );
}
