import { useRef, useState, type PointerEvent } from 'react';
import type { PackingObject, TopFace } from '../types';
import { Scene3D } from './Scene3D';
import { TOP_FACES, getObjectVolume, isTopUp } from '../utils/productGeometry';

type Shape = 'square' | 'rectangle' | 'circle';
interface Props { product: PackingObject | null; onSave: (product: PackingObject) => void; onClose: () => void }
const initialProduct = (): PackingObject => ({
  id: `product-${crypto.randomUUID()}`, name: 'Produto do cliente', type: 'block',
  dimensions: { width: 300, depth: 200, height: 150 }, weightKg: 10,
  position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, color: '#2f80ed', topFace: '+z', keepTopUp: true,
});

export function ProductEditor({ product, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<PackingObject>(() => ({ ...(product ?? initialProduct()), type: product?.type === 'cylinder' ? 'cylinder' : 'block', position: { x: 0, y: 0, z: 0 } }));
  const [shape, setShape] = useState<Shape>(product?.type === 'cylinder' ? 'circle' : product?.dimensions.width === product?.dimensions.depth && product ? 'square' : 'rectangle');
  const [extruded, setExtruded] = useState(Boolean(product));
  const [view, setView] = useState<'sketch' | 'solid'>(product ? 'solid' : 'sketch');
  const [pickingTop, setPickingTop] = useState(false);
  const [planeSize, setPlaneSize] = useState(Math.max(1000, ...(product ? [product.dimensions.width * 1.4, product.dimensions.depth * 1.4] : [])));
  const [message, setMessage] = useState('');
  const start = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const valid = Object.values(draft.dimensions).every(v => Number.isFinite(v) && v >= 1 && v <= 100000) && Number.isFinite(draft.weightKg) && draft.weightKg >= 0 && Object.values(draft.rotation).every(Number.isFinite);
  const patch = (value: Partial<PackingObject>) => setDraft(current => ({ ...current, ...value }));
  const resize = (width: number, depth: number) => {
    setDraft(current => ({ ...current, dimensions: { ...current.dimensions, width, depth } }));
    setExtruded(false);
  };
  const chooseShape = (next: Shape) => {
    setShape(next); setView('sketch'); setPickingTop(false); setExtruded(false);
    setDraft(current => ({ ...current, type: next === 'circle' ? 'cylinder' : 'block', topFace: '+z', rotation: { x: 0, y: 0, z: 0 }, dimensions: { ...current.dimensions, depth: next === 'rectangle' ? current.dimensions.depth : current.dimensions.width } }));
  };
  const point = (event: PointerEvent<SVGSVGElement>) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: Math.min(600, Math.max(0, p.x)), y: Math.min(600, Math.max(0, p.y)) };
  };
  const draw = (event: PointerEvent<SVGSVGElement>) => {
    if (!start.current) return;
    const p = point(event); if (!p) return;
    const w = Math.max(1, Math.round(Math.abs(p.x - start.current.x) * planeSize / 600));
    const d = Math.max(1, Math.round(Math.abs(p.y - start.current.y) * planeSize / 600));
    const side = Math.max(w, d);
    resize(shape === 'rectangle' ? w : side, shape === 'rectangle' ? d : side);
  };
  const setTop = (face: TopFace) => { patch({ topFace: face }); setPickingTop(false); setMessage('Topo definido: face verde.'); };
  const width = draft.dimensions.width * 600 / planeSize;
  const depth = draft.dimensions.depth * 600 / planeSize;
  const numberInput = (label: string, value: number, onChange: (value: number) => void, min = 1, max = 100000) => (
    <label className="field"><span>{label}</span><input type="number" min={min} max={max} step="any" value={Number.isFinite(value) ? value : ''} onChange={e => onChange(e.target.value === '' ? NaN : Number(e.target.value))} /></label>
  );
  return <section className="product-editor" aria-label="Editor de produto">
    <header className="editor-header"><div><p className="eyebrow">Goodpack · Estúdio de produto</p><h1>{product ? 'Editar produto' : 'Criar produto'}</h1></div><button onClick={onClose}>Voltar ao nesting</button></header>
    <aside className="editor-tools">
      <div className="section"><h2>1. Desenhar perfil</h2><div className="shape-tools">
        {([['square', '□', 'Quadrado'], ['rectangle', '▭', 'Retângulo'], ['circle', '○', 'Círculo']] as const).map(([key, icon, label]) => <button key={key} aria-pressed={shape === key} className={shape === key ? 'active' : ''} onClick={() => chooseShape(key)}><b aria-hidden>{icon}</b>{label}</button>)}
      </div><p className="muted">Arraste na grade para dimensionar o perfil, ou digite as medidas em mm. Um perfil por produto.</p>
      <div className="dimension-fields">{numberInput(shape === 'circle' ? 'Diâmetro (mm)' : shape === 'square' ? 'Lado (mm)' : 'Largura X (mm)', draft.dimensions.width, value => resize(value, shape === 'rectangle' ? draft.dimensions.depth : value))}
        {shape === 'rectangle' && numberInput('Profundidade Y (mm)', draft.dimensions.depth, value => resize(draft.dimensions.width, value))}</div>
      </div>
      <div className="section"><h2>2. Extrudar</h2>{numberInput('Altura Z / extrusão (mm)', draft.dimensions.height, height => { patch({ dimensions: { ...draft.dimensions, height } }); setExtruded(false); })}
        <button className="primary-button" disabled={!valid} onClick={() => { setExtruded(true); setView('solid'); setMessage('Sólido atualizado. Defina o topo e a orientação.'); }}>Extrudar perfil</button></div>
      <div className="section"><h2>3. Definir topo</h2><label className="field"><span>Face superior do produto</span><select value={draft.topFace ?? '+z'} onChange={e => setTop(e.target.value as TopFace)}>{TOP_FACES.filter(face => shape !== 'circle' || face.value.endsWith('z')).map(face => <option key={face.value} value={face.value}>{face.label}</option>)}</select></label>
        <button disabled={!extruded} aria-pressed={pickingTop} onClick={() => { setView('solid'); setPickingTop(!pickingTop); }}>Definir topo clicando na face</button>
        <label className="checkbox-field"><input type="checkbox" checked={draft.keepTopUp ?? false} onChange={e => patch({ keepTopUp: e.target.checked })} />Manter topo para cima no nesting</label>
        <p className="muted">Verde: topo. Laranja: face oposta.{shape === 'circle' ? ' No cilindro, selecione uma das tampas planas.' : ''}</p>
      </div>
    </aside>
    <div className="editor-surface">
      <div className="editor-viewbar"><div className="segmented-control"><button className={view === 'sketch' ? 'active' : ''} onClick={() => { setView('sketch'); setPickingTop(false); }}>Perfil 2D</button><button disabled={!extruded} className={view === 'solid' ? 'active' : ''} onClick={() => setView('solid')}>Produto 3D</button></div><span>{view === 'sketch' ? 'Plano XY · mm' : pickingTop ? 'Clique na face que será o topo' : 'Arraste os anéis para girar o produto'}</span></div>
      {view === 'sketch' ? <div className="sketch-surface"><svg ref={svgRef} viewBox="0 0 600 600" role="img" aria-label="Área de desenho. Arraste para definir as dimensões do perfil; os campos numéricos oferecem a mesma função." onPointerDown={event => { if (event.button !== 0) return; start.current = point(event); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={draw} onPointerUp={event => { draw(event); start.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { start.current = null; }}>
        <defs><pattern id="product-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="#ccd9e5" strokeWidth="1" /></pattern></defs><rect width="600" height="600" fill="url(#product-grid)" /><path d="M 300 0 V 600 M 0 300 H 600" stroke="#93a9bb" strokeDasharray="5 5" />
        {Number.isFinite(width) && Number.isFinite(depth) && (shape === 'circle' ? <circle cx="300" cy="300" r={width / 2} fill="#2f80ed26" stroke="#2268bd" strokeWidth="2" /> : <rect x={300 - width / 2} y={300 - depth / 2} width={width} height={depth} fill="#2f80ed26" stroke="#2268bd" strokeWidth="2" />)}
        <text x="300" y="580" textAnchor="middle" fill="#36536b" fontSize="16">{shape === 'circle' ? 'Ø ' : ''}{draft.dimensions.width || '—'}{shape === 'rectangle' ? ` × ${draft.dimensions.depth || '—'}` : ''} mm</text>
      </svg><div className="sketch-scale"><label>Área da grade <select value={planeSize} onChange={e => setPlaneSize(Number(e.target.value))}>{[...new Set([500, 1000, 2000, 5000, 10000, planeSize])].sort((a,b) => a-b).map(size => <option key={size} value={size}>{Math.round(size)} mm</option>)}</select></label><button onClick={() => setPlaneSize(Math.max(100, draft.dimensions.width * 1.4 || 1000, draft.dimensions.depth * 1.4 || 1000))}>Ajustar à peça</button></div></div> : !valid ? <p className="warning-text">Corrija os campos para visualizar o sólido.</p> : <Scene3D studio objects={[draft]} selectedObjectId={draft.id} transformMode="rotate" onSelectObject={() => {}} onUpdateObject={updated => patch({ rotation: updated.rotation })} onPickTop={pickingTop ? setTop : undefined} />}
      <div className="editor-hint" role="status">{message || 'Desenhe o perfil e extrude para criar o sólido.'}</div>
    </div>
    <aside className="editor-properties"><div className="section"><h2>Produto</h2><label className="field"><span>Nome</span><input value={draft.name} onChange={e => patch({ name: e.target.value })} /></label>{numberInput('Peso por unidade (kg)', draft.weightKg, weightKg => patch({ weightKg }), 0)}<p className="muted">Volume da peça: {valid ? (getObjectVolume(draft) / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—'} L</p></div>
      <div className="section"><h2>Rotação por coordenadas</h2><p className="muted">Ângulos em graus. Z é o eixo vertical.</p>{(['x','y','z'] as const).map(axis => <div key={axis}>{numberInput(`Eixo ${axis.toUpperCase()} (°)`, draft.rotation[axis], value => patch({ rotation: { ...draft.rotation, [axis]: value } }), -36000, 36000)}</div>)}<button onClick={() => patch({ rotation: { x: 0, y: 0, z: 0 } })}>Zerar rotação</button></div>
      {valid && draft.keepTopUp && !isTopUp(draft) && <p className="warning-text">A rotação atual inclina o topo. A busca de orientação escolherá uma posição com o topo para cima.</p>}
      {!valid && <p className="warning-text">Informe dimensões de 1 a 100.000 mm, peso não negativo e ângulos válidos.</p>}
      <div className="editor-save"><button className="primary-button" disabled={!valid || !extruded || !draft.name.trim()} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>Usar no nesting →</button><p className="muted">{extruded ? 'O produto ficará selecionado no simulador.' : 'Extrude o perfil antes de enviar.'}</p></div>
    </aside>
  </section>;
}
