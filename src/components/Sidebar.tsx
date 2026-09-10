import type { PackingObjectType, PackingObject } from '../types';
import { MB5_CONTAINER } from '../data/skus';

interface SidebarProps {
  onCreateProduct: () => void;
  onEditProduct?: () => void;
  objects: PackingObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string) => void;
  onAddObject: (type: PackingObjectType) => void;
}

export function Sidebar({ onAddObject, onCreateProduct, onEditProduct, objects, selectedObjectId, onSelectObject }: SidebarProps) {
  return (
    <aside className="panel sidebar">
      <div>
        <p className="eyebrow">Goodpack</p>
        <h1>Goodpack MB5</h1>
      </div>

      <div className="section"><h2>Produto do cliente</h2><button className="primary-button" onClick={onCreateProduct}>+ Criar produto</button><button disabled={!onEditProduct} onClick={onEditProduct}>Editar produto selecionado</button><div className="product-list">{objects.map(object => <button key={object.id} aria-pressed={object.id === selectedObjectId} onClick={() => onSelectObject(object.id)}>{object.name}</button>)}</div></div>
      <dl className="spec-list">
        <div>
          <dt>Dimensões externas</dt>
          <dd>
            {MB5_CONTAINER.externalDimensions.width} x {MB5_CONTAINER.externalDimensions.depth} x{' '}
            {MB5_CONTAINER.externalDimensions.height} mm
          </dd>
        </div>
        <div>
          <dt>Volume útil</dt>
          <dd>
            {MB5_CONTAINER.internalDimensions.width} x {MB5_CONTAINER.internalDimensions.depth} x{' '}
            {MB5_CONTAINER.internalDimensions.height} mm
          </dd>
        </div>
        <div>
          <dt>Carga máxima</dt>
          <dd>{MB5_CONTAINER.maxPayloadKg} kg</dd>
        </div>
        <div>
          <dt>Tara</dt>
          <dd>{MB5_CONTAINER.emptyWeightKg} kg</dd>
        </div>
      </dl>

      <p className="muted">Nesting de um produto por simulação. Compare grade e arranjo alternado para cilindros verticais. Não considera deformação ou resistência ao empilhamento.</p>
      <div className="section orientation-legend">
        <h2>Orientação</h2>
        <div className="legend-items" aria-label="Object face color legend">
          <span>
            <i className="legend-swatch top" />
            Verde = Topo
          </span>
          <span>
            <i className="legend-swatch bottom" />
            Laranja = Face oposta
          </span>
          <span>
            <i className="legend-swatch body" />
            Azul = Corpo
          </span>
        </div>
      </div>

      <div className="section">
        <h2>Adicionar sólido rápido</h2>
        <div className="button-stack">
          <button type="button" onClick={() => onAddObject('block')}>
            Bloco retangular
          </button>
          <button type="button" onClick={() => onAddObject('cube')}>
            Cubo
          </button>
          <button type="button" onClick={() => onAddObject('cylinder')}>
            Cilindro
          </button>
        </div>
      </div>
    </aside>
  );
}
