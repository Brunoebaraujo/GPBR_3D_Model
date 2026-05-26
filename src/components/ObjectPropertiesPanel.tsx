import type { DimensionsMm, PackingObject, RotationDeg, Vector3Mm } from '../types';

interface ObjectPropertiesPanelProps {
  selectedObject: PackingObject | null;
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

      <button type="button" className="danger-button" onClick={() => onDeleteObject(selectedObject.id)}>
        Delete object
      </button>
    </aside>
  );
}
