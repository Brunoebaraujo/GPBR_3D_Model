import { TOP_FACES } from '../utils/productGeometry';
import type {
  DimensionsMm,
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
            Buscar melhor orientação
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
            <p className="muted">Prévia: {lastPackingResult.positions.length} peças. O preenchimento considera apenas este produto.</p>
            {lastPackingResult.warning ? <p className="warning-text">{lastPackingResult.warning}</p> : null}
            <dl>
              <div>
                <dt>Colunas máx. × fileiras × camadas</dt>
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
