import type { DimensionsMm, GridPackingResult, PackingObject, RotationDeg, Vector3Mm } from '../types';
import { formatNumber } from '../utils/unitConversion';

interface ObjectPropertiesPanelProps {
  selectedObject: PackingObject | null;
  fillSpacingMm: number;
  lastPackingResult: GridPackingResult | null;
  onFillSpacingChange: (spacingMm: number) => void;
  onFillContainer: () => void;
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
  onFillSpacingChange,
  onFillContainer,
  onClearAutoFill,
  onUpdateObject,
  onDeleteObject,
}: ObjectPropertiesPanelProps) {
  if (!selectedObject) {
    return (
      <aside className="panel properties-panel">
        <p className="eyebrow">Properties</p>
        <h2>No object selected</h2>
        <p className="muted">Select an object in the scene to edit its dimensions, weight, position, and rotation.</p>
      </aside>
    );
  }

  const update = (patch: Partial<PackingObject>) => {
    onUpdateObject({ ...selectedObject, ...patch });
  };

  const updateDimension = (field: DimensionField, value: string) => {
    update({
      dimensions: {
        ...selectedObject.dimensions,
        [field]: Math.max(1, numberValue(value)),
      },
    });
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
      <p className="eyebrow">Properties</p>
      <h2>{selectedObject.name}</h2>

      <label className="field">
        <span>Name</span>
        <input value={selectedObject.name} onChange={(event) => update({ name: event.target.value })} />
      </label>

      <label className="field">
        <span>Weight kg</span>
        <input
          type="number"
          min="0"
          step="0.1"
          value={selectedObject.weightKg}
          onChange={(event) => update({ weightKg: Math.max(0, numberValue(event.target.value)) })}
        />
      </label>

      <div className="section">
        <h3>Dimensions mm</h3>
        <div className="grid-fields">
          <label className="field">
            <span>Width</span>
            <input
              type="number"
              min="1"
              value={selectedObject.dimensions.width}
              onChange={(event) => updateDimension('width', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Depth</span>
            <input
              type="number"
              min="1"
              value={selectedObject.dimensions.depth}
              onChange={(event) => updateDimension('depth', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Height</span>
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
        <h3>Position mm</h3>
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
        <h3>Rotation deg</h3>
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

      <div className="section fill-section">
        <h3>Fill container</h3>
        <label className="field">
          <span>Spacing mm</span>
          <input
            type="number"
            min="0"
            value={fillSpacingMm}
            onChange={(event) => onFillSpacingChange(Math.max(0, numberValue(event.target.value)))}
          />
        </label>
        <div className="button-stack">
          <button type="button" onClick={onFillContainer}>
            Fill container
          </button>
          <button type="button" onClick={onClearAutoFill}>
            Clear auto-fill
          </button>
        </div>
        {lastPackingResult ? (
          <div className="fill-summary">
            {lastPackingResult.warning ? <p className="warning-text">{lastPackingResult.warning}</p> : null}
            <dl>
              <div>
                <dt>Grid</dt>
                <dd>
                  {lastPackingResult.countX} x {lastPackingResult.countY} x {lastPackingResult.countZ}
                </dd>
              </div>
              <div>
                <dt>Geometrical capacity</dt>
                <dd>{lastPackingResult.totalQuantity} objects</dd>
              </div>
              <div>
                <dt>Payload-limited capacity</dt>
                <dd>{lastPackingResult.payloadLimitedQuantity} objects</dd>
              </div>
              <div>
                <dt>Geometrical total weight</dt>
                <dd>{formatNumber(lastPackingResult.totalWeight)} kg</dd>
              </div>
              <div>
                <dt>Remaining payload</dt>
                <dd>{formatNumber(lastPackingResult.remainingPayload)} kg</dd>
              </div>
              <div>
                <dt>Payload status</dt>
                <dd>{lastPackingResult.exceedsPayload ? 'Exceeds payload limit' : 'Within payload limit'}</dd>
              </div>
              <div>
                <dt>Volume utilization</dt>
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
