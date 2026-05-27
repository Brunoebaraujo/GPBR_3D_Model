import type { PackingObjectType } from '../types';
import { MB5_CONTAINER } from '../data/skus';

interface SidebarProps {
  onAddObject: (type: PackingObjectType) => void;
}

export function Sidebar({ onAddObject }: SidebarProps) {
  return (
    <aside className="panel sidebar">
      <div>
        <p className="eyebrow">Container</p>
        <h1>Goodpack MB5</h1>
      </div>

      <dl className="spec-list">
        <div>
          <dt>External</dt>
          <dd>
            {MB5_CONTAINER.externalDimensions.width} x {MB5_CONTAINER.externalDimensions.depth} x{' '}
            {MB5_CONTAINER.externalDimensions.height} mm
          </dd>
        </div>
        <div>
          <dt>Usable</dt>
          <dd>
            {MB5_CONTAINER.internalDimensions.width} x {MB5_CONTAINER.internalDimensions.depth} x{' '}
            {MB5_CONTAINER.internalDimensions.height} mm
          </dd>
        </div>
        <div>
          <dt>Payload</dt>
          <dd>{MB5_CONTAINER.maxPayloadKg} kg</dd>
        </div>
        <div>
          <dt>Empty weight</dt>
          <dd>{MB5_CONTAINER.emptyWeightKg} kg</dd>
        </div>
      </dl>

      <div className="section orientation-legend">
        <h2>Orientation</h2>
        <div className="legend-items" aria-label="Object face color legend">
          <span>
            <i className="legend-swatch top" />
            Green = Top
          </span>
          <span>
            <i className="legend-swatch bottom" />
            Orange = Bottom
          </span>
          <span>
            <i className="legend-swatch body" />
            Blue = Side/body
          </span>
        </div>
      </div>

      <div className="section">
        <h2>Add object</h2>
        <div className="button-stack">
          <button type="button" onClick={() => onAddObject('block')}>
            Rectangular block
          </button>
          <button type="button" onClick={() => onAddObject('cube')}>
            Cube
          </button>
          <button type="button" onClick={() => onAddObject('cylinder')}>
            Cylinder
          </button>
        </div>
      </div>
    </aside>
  );
}
