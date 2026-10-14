import type { PackingObjectType, PackingObject } from '../types';
import { GOODPACK_MODELS, type GoodpackModel } from '../data/skus';

interface SidebarProps {
  model: GoodpackModel;
  onModelChange: (model: GoodpackModel) => void;
  onCreateProduct: () => void;
  onEditProduct?: () => void;
  objects: PackingObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string) => void;
  onAddObject: (type: PackingObjectType) => void;
}

export function Sidebar({ model, onModelChange, onAddObject, onCreateProduct, onEditProduct, objects, selectedObjectId, onSelectObject }: SidebarProps) {
  const container = GOODPACK_MODELS[model];
  return (
    <aside className="panel sidebar">
      <div>
        <p className="eyebrow">Goodpack</p>
        <h1>{container.name}</h1>
        <label>Modelo<select aria-label="Modelo" value={model} onChange={e => onModelChange(e.target.value as GoodpackModel)}><option>MB5</option><option>MB6</option></select></label>
      </div>

      <div className="section"><h2>Produto do cliente</h2><button className="primary-button" onClick={onCreateProduct}>+ Criar produto</button><button disabled={!onEditProduct} onClick={onEditProduct}>Editar produto selecionado</button><div className="product-list">{objects.map(object => <button key={object.id} aria-pressed={object.id === selectedObjectId} onClick={() => onSelectObject(object.id)}>{object.name}</button>)}</div></div>
      <dl className="spec-list">
        <div>
          <dt>Dimensões externas</dt>
          <dd>
            {container.externalDimensions.width} x {container.externalDimensions.depth} x{' '}
            {container.externalDimensions.height} mm
          </dd>
        </div>
        <div>
          <dt>Volume útil</dt>
          <dd>
            {container.internalDimensions.width} x {container.internalDimensions.depth} x{' '}
            {container.internalDimensions.height} mm
          </dd>
        </div>
        <div>
          <dt>Carga máxima</dt>
          <dd>{container.maxPayloadKg} kg</dd>
        </div>
        <div>
          <dt>Tara</dt>
          <dd>{container.emptyWeightKg} kg</dd>
        </div>
      </dl>

      <p className="muted">Nesting de um produto por simulação. Escolha orientação única ou combine giros nas sobras. Não considera deformação ou resistência ao empilhamento.</p>
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
