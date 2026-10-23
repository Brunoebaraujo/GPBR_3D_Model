import { useVRModule, type StudioModule } from './VRBridge';
import type { Exploration } from '../utils/xrNavigation';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CanvasTexture, WebGLRenderer } from 'three';
import { MB6, WALL_NUMBERS, WALL_NAMES, ASSEMBLY_ORDER, initialLab, reduceLab, ready, type Pose, type LeverStep } from '../utils/mb6Assembly';
import { Crate, type MouseTool } from './MB6Parts';
import { AssemblyChallenge } from './AssemblyChallenge';
import { XRInteraction } from './XRInteraction';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import './vr.css';
import { unlockAssemblyAudio } from '../utils/assemblyAudio';

type Vec = [number, number, number];
type ViewRequest = { kind: 'front' | 'back' | 'overview' | 'corner'; pose: Pose; corner?: number };
function CameraView({ request, presenting }: { request: ViewRequest | null; presenting: boolean }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    if (!request || presenting || !controls) return;
    const orbit = controls as OrbitControlsImpl;
    const { pose, kind } = request;
    if (kind === 'overview') { camera.position.set(3.4, 2.9, 5.3); orbit.target.set(0, 0.8, 0); }
    else {
      const direction = kind === 'front' ? 1 : -1;
      const c = request.corner ?? 0;
      const dx = kind === 'corner' ? ([1, 1, -1, -1][c] * 1.8) : direction * 0.2;
      const dz = kind === 'corner' ? ([1, -1, -1, 1][c] * 2.2) : direction * 2.6;
      camera.position.set(pose.x + dx * Math.cos(pose.yaw) + dz * Math.sin(pose.yaw), pose.y + 1.25, pose.z - dx * Math.sin(pose.yaw) + dz * Math.cos(pose.yaw));
      orbit.target.set(pose.x, pose.y + 0.7, pose.z);
      if (kind === 'corner') {
        // Bolts are mounted on the front/back panels, facing out from those faces.
        const side = c === 0 || c === 3 ? 1 : -1;
        const x = [1, 1, -1, -1][c] * (MB6.w / 2 - .14);
        const z = side * (MB6.d / 2 + .025);
        const world = (lx: number, lz: number) => [
          pose.x + lx * Math.cos(pose.yaw) + lz * Math.sin(pose.yaw),
          pose.z - lx * Math.sin(pose.yaw) + lz * Math.cos(pose.yaw),
        ];
        const [tx, tz] = world(x, z), [cx, cz] = world(x, z + side * .95);
        orbit.target.set(tx, pose.y + MB6.h - .105, tz);
        camera.position.set(cx, pose.y + MB6.h - .055, cz);
      }
      orbit.update();
    }
    orbit.update();
  }, [camera, controls, request, presenting]);
  return null;
}
export function Label({ text, position, action, width = 1.1, height = 0.045, color = '#183747' }: { text: string; position: Vec; action?: () => void; width?: number; height?: number; color?: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = '#ffffff'; ctx.font = '38px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines: string[] = []; let line = '';
    for (const word of text.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > 980 && line) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
    const size = Math.min(38, 112 / lines.length); ctx.font = size + 'px sans-serif';
    lines.forEach((value, i) => ctx.fillText(value, 512, 64 + (i - (lines.length - 1) / 2) * size, 990));
    return new CanvasTexture(canvas);
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position} userData={{ activate: action }} onClick={e => { e.stopPropagation(); action?.(); }}><planeGeometry args={[width, height]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>;
}

export function VRWorkspace({ activeModule, onNavigate }: { activeModule: StudioModule; onNavigate: (module: StudioModule) => void }) {
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAssemblyAudio);
    window.addEventListener('keydown', unlockAssemblyAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAssemblyAudio);
      window.removeEventListener('keydown', unlockAssemblyAudio);
    };
  }, []);
  const data = useVRModule(activeModule);
  const [flight, setFlight] = useState(false);
  const [viewpoint, setViewpoint] = useState<{ view: Exploration['view']; revision: number }>({ view: 'entry', revision: 0 });
  const visit = (view: Exploration['view']) => setViewpoint(current => ({ view, revision: current.revision + 1 }));
  const navigate = (next: StudioModule) => { setPage(0); setFlight(false); visit('entry'); onNavigate(next); };

  const [lab, dispatch] = useReducer(reduceLab, undefined, initialLab);
  const [module, setModule] = useState<'desktop' | 'vr'>('desktop');
  const [tool, setTool] = useState<MouseTool>('assemble');
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState('Clique na tampa ou arraste-a para cima para começar.');
  const [corner, setCorner] = useState(0);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<ViewRequest | null>(null);
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [xrStatus, setXRStatus] = useState('Verificando headset…');
  const [supported, setSupported] = useState(false);
  const [pending, setPending] = useState(false);
  const selected = lab.boxes.find(b => b.id === lab.selected)!;
  useEffect(() => {
    let alive = true;
    const check = async () => { try { const ok = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'); if (alive) { setSupported(ok); setXRStatus(ok ? 'Headset disponível' : 'VR indisponível neste navegador. Use o laboratório 3D.'); } } catch { if (alive) setXRStatus('Não foi possível consultar o headset. Use o laboratório 3D.'); } };
    void check(); return () => { alive = false; };
  }, []);
  const enter = async () => {
    unlockAssemblyAudio();
    if (!renderer || !navigator.xr || pending) return;
    setPending(true); setModule('vr');
    let session: XRSession | undefined;
    try { session = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] }); await renderer.xr.setSession(session); }
    catch { await session?.end().catch(() => undefined); setXRStatus('Não foi possível entrar em VR. Verifique a permissão e tente novamente.'); }
    finally { setPending(false); }
  };
  const move = (axis: 'x' | 'y' | 'z', delta: number) => dispatch({ type: 'move', pose: { ...selected.pose, [axis]: Math.round((selected.pose[axis] + delta) * 1000) / 1000 } });
  const onPose = (id: number, pose: Pose) => {
    const current = reduceLab(lab, { type: 'select', id });
    const next = reduceLab(current, { type: 'move', pose });
    dispatch({ type: 'select', id }); dispatch({ type: 'move', pose });
    return next.boxes.find(b => b.id === id)!.pose;
  };
  const chooseCorner = (index: number) => {
    setCorner(index);
    setView({ kind: 'corner', corner: index, pose: { ...selected.pose } });
  };
  const lever = (step: LeverStep) => dispatch({ type: 'lever', index: corner, step });
  const actions = [
    { label: selected.lid ? 'Retirar tampa' : 'Colocar tampa', run: () => dispatch({ type: 'lid' }) },
    ...ASSEMBLY_ORDER.map(i => ({ label: `${selected.walls[i] ? 'Dobrar' : 'Montar'} Porta ${WALL_NUMBERS[i]} · ${WALL_NAMES[i]}`, run: () => dispatch({ type: 'wall', index: i }) })),
    { label: `Alavanca ${corner + 1}: levantar`, run: () => lever('lift') },
    { label: `Alavanca ${corner + 1}: deslizar`, run: () => lever('slide') },
    { label: `Alavanca ${corner + 1}: rebater`, run: () => lever('lower') },
    { label: `Trocar vértice (${corner + 1}/4)`, run: () => chooseCorner((corner + 1) % 4) },
    { label: 'Criar segunda caixa', run: () => dispatch({ type: 'add' }) },
    { label: 'Elevar para empilhar', run: () => dispatch({ type: 'move', pose: { ...selected.pose, y: MB6.h } }) },
    { label: 'Aproximar da outra caixa', run: () => { const other = lab.boxes.find(b => b.id !== selected.id); if (other) dispatch({ type: 'move', pose: { ...selected.pose, x: other.pose.x + 0.06, z: other.pose.z } }); } },
    { label: 'Testar encaixe', run: () => dispatch({ type: 'stack' }) },
    { label: 'Desempilhar', run: () => dispatch({ type: 'unstack' }) },
    { label: 'Girar 90°', run: () => dispatch({ type: 'move', pose: { ...selected.pose, yaw: selected.pose.yaw + Math.PI / 2 } }) },
  ];
  const vrActions = activeModule === 'vr' ? [] : [
    ...(activeModule === 'road' ? [
      { label: flight ? 'Modo caminhada' : 'Modo voo', run: () => { setFlight(!flight); visit('entry'); } },
      { label: 'Entrar no equipamento', run: () => { setFlight(false); visit('inside'); } },
      { label: 'Vista externa', run: () => { setFlight(false); visit('outside'); } },
      { label: 'Vista isométrica elevada', run: () => { setFlight(true); visit('overview'); } },
    ] : []),
    ...(data?.actions ?? []),
  ];
  const vrPages = Math.max(1, Math.ceil(vrActions.length / 6));
  const safePage = Math.min(page, vrPages - 1);
  const assembly = !presenting || activeModule === 'vr';
  return <><div className="vr-launch" style={{ padding: '8px 16px' }}><button className="vr-primary" disabled={!supported || !renderer || pending || presenting} onClick={() => void enter()}>{pending ? 'Conectando…' : `Entrar em VR · ${activeModule === 'product' ? 'Produto no Goodpack' : activeModule === 'road' ? 'Estufagem' : 'Montagem MB6'}`}</button> <small>{xrStatus}</small></div><main className="vr-lab" style={activeModule === 'vr' || presenting ? { gridTemplateColumns: activeModule === 'vr' ? undefined : '1fr' } : { position: 'fixed', left: -10000, top: 0, width: 2, height: 2, minHeight: 2, visibility: 'hidden' }}>

    <aside className="vr-panel" hidden={activeModule !== 'vr'}><p className="vr-eyebrow">LOAD STUDIO · MONTAGEM</p><h1>Monte. Trave. Empilhe.</h1><p>MB6 · 1120 × 1220 × 1076 mm</p>
      <div className="vr-module-choice" aria-label="Módulo de interação"><button aria-pressed={module === 'desktop'} onClick={() => { setModule('desktop'); setTool('assemble'); }}>Desktop · Mouse</button><button aria-pressed={module === 'vr'} onClick={() => { setModule('vr'); setTool('assemble'); setHint('Esquerdo vira e avança/recua. Grip esquerdo abre a prancheta; direita seleciona.'); }}>VR · Headset</button></div>
      {module === 'vr' ? <><button className="vr-primary" disabled={!supported || !renderer || pending || presenting} onClick={() => void enter()}>{pending ? 'Conectando…' : 'Entrar em VR'}</button><small>{xrStatus}</small><p>Direito: andar e deslocar para os lados. Esquerdo: virar e também avançar/recuar. Segure o grip esquerdo para mostrar a prancheta; aponte com a direita ou selecione com seu analógico para cima/baixo e confirme com o gatilho direito. Para montar paredes, mire, segure o gatilho e puxe até o final. Com ambos os gatilhos segurando a caixa, dois pontos azuis fixam a pega. Mova e gire os controles para transladar e girar a caixa, mantendo o alcance. Ferrolhos disponíveis ficam azuis ao apontar. O encaixe alinhado trava automaticamente com click.</p></> : <><h2>Manipular com o mouse</h2><div className="vr-tools">{([['assemble', 'Montar peças'], ['translate', 'Mover caixa'], ['rotate', 'Girar caixa']] as const).map(([value, label]) => <button key={value} aria-pressed={tool === value} onClick={() => { setTool(value); setDragging(false); }}>{label}</button>)}</div><p>{tool === 'assemble' ? 'Clique ou arraste tampa e paredes. Nas alavancas: arraste para cima, na horizontal e para baixo. Arraste o fundo para orbitar; role para aproximar.' : tool === 'translate' ? 'Selecione a caixa e arraste as setas: verde eleva, vermelho e azul alinham no piso. Ao soltar, posições inválidas retornam.' : 'Arraste o arco verde para girar a caixa. A rotação ocorre em passos de 5°.'}</p></>}
      <div className="vr-row">{lab.boxes.map(b => <button key={b.id} aria-pressed={selected.id === b.id} onClick={() => dispatch({ type: 'select', id: b.id })}>Caixa {b.id}</button>)}</div>
      {module === 'desktop' && <div className="vr-tools" aria-label="Vistas da caixa">{([['front', 'Ver frente'], ['back', 'Ver fundo'], ['overview', 'Visão geral']] as const).map(([kind, label]) => <button key={kind} onClick={() => setView({ kind, pose: { ...selected.pose } })}>{label}</button>)}</div>}
      <p>{selected.walls.filter(Boolean).length}/4 paredes · {selected.locks.filter(Boolean).length}/4 travas · {selected.support ? 'Empilhada' : ready(selected) ? 'Pronta' : 'Em montagem'}<br />Rotação: {Math.round(selected.pose.yaw * 180 / Math.PI)}°</p>
      {module === 'desktop' && <div className="vr-corners" aria-label="Vértices">{selected.locks.map((locked, i) => <button key={i} aria-pressed={corner === i} onClick={() => chooseCorner(i)}>V{i + 1} · {locked ? 'travado' : selected.leverRaised[i] ? 'alça aberta' : 'livre'}</button>)}</div>}
      <p className="vr-lever-guide">Alavanca {corner + 1}: <strong>1. Levantar → 2. Deslizar → 3. Rebater</strong><br />Para destravar, repita as três etapas recolhendo o ferrolho.</p>
      <p>Montagem: Porta 4 (Frente) → 3 (Fundo) → 2 (Esquerda) → 1 (Direita).<br />Desmontagem na ordem inversa. Recolhida, de baixo para cima: Direita → Esquerda → Fundo → Frente → Tampa.</p>
      {module === 'desktop' && <><details open><summary>Comandos de apoio</summary><div className="vr-actions">{actions.map(a => <button key={a.label} onClick={a.run}>{a.label}</button>)}</div></details>
      <h2>Alinhamento dos pés</h2><small>Eleve, aproxime, ajuste X em −20 mm três vezes e teste. Gire para experimentar um encaixe incompatível.</small>
      {(['x', 'y', 'z'] as const).map(axis => <div className="vr-row" key={axis}><span>{axis.toUpperCase()} {Math.round(selected.pose[axis] * 1000)} mm</span>{[-0.02, 0.02].map(d => <button key={d} aria-label={`${axis.toUpperCase()} ${d > 0 ? '+' : '−'}20 mm`} onClick={() => move(axis, d)}>{d > 0 ? '+' : '−'}20</button>)}</div>)}
      </>}<button onClick={() => dispatch({ type: 'reset' })}>Reiniciar laboratório</button>
      <p className="vr-note">Ficha: recolhida 224 mm; tampa 10,6 kg. A folga visual da porta 4 usa curso ilustrativo de 50 mm; o envelope recolhido exibido é maior que a cota nominal. Alavancas reproduzem a sequência visual do vídeo. Cotas dos fechos e encaixes não constam na ficha e continuam aproximadas.</p>
    </aside>
    <section className="vr-stage" aria-label="Montagem MB6 em 3D"><div className="vr-feedback" role="status"><span className="vr-mode-label">{module === 'desktop' ? 'DESKTOP · MOUSE' : 'VR · HEADSET'}</span>{lab.message}</div><div className="vr-mouse-hint">{hint}</div>
      <Canvas camera={{ position: [2.4, 2.2, 3.5], fov: 48 }}><color attach="background" args={['#101e2a']} /><ambientLight intensity={1.8} /><directionalLight position={[3, 7, 4]} intensity={3} />
        {assembly && <gridHelper args={[10, 40, '#34626d', '#253b48']} />}<OrbitControls makeDefault enabled={!presenting && !dragging} target={[0, 0.8, 0]} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={0.8} maxDistance={9} />

        <CameraView request={view} presenting={presenting} />
        {!assembly && data?.scene}
        <group visible={assembly}><AssemblyChallenge lab={lab} dispatch={dispatch} /></group>
        {assembly && lab.boxes.map(b => <Crate key={b.id} box={b} selected={b.id === selected.id} tool={module === 'desktop' ? tool : 'assemble'} dispatch={action => { if (action.type === 'lever') setCorner(action.index); dispatch(action); }} onPose={onPose} interaction={{ enabled: module === 'desktop' && tool === 'assemble', busy: setDragging, hint: setHint }} />)}
        <XRInteraction exploration={{ key: `${activeModule}:${data?.vehicle?.kind ?? ''}`, mode: flight ? 'fly' : 'walk', vehicle: activeModule === 'road' ? data?.vehicle : undefined, view: viewpoint.view, revision: viewpoint.revision }} lab={lab} dispatch={action => { if (action.type === 'lever') setCorner(action.index); dispatch(action); }} onRenderer={setRenderer} onPresenting={setPresenting} onHint={setHint}>
          <mesh position={[0, 0, -0.012]}><boxGeometry args={[0.46, 0.80, 0.018]} /><meshStandardMaterial color="#203541" roughness={0.8} /></mesh>
          {(['product', 'road', 'vr'] as const).map((name, i) => <Label key={name} text={['Produto', 'Estufagem', 'Montagem MB6'][i]} color={activeModule === name ? '#087c70' : '#183747'} position={[-.145 + i * .145, .36, .002]} width={.14} height={.055} action={() => navigate(name)} />)}
          <Label text={activeModule === 'vr' ? `MB6 · Caixa ${selected.id} · ${selected.walls.filter(Boolean).length}/4 paredes · ${selected.locks.filter(Boolean).length}/4 travas` : activeModule === 'road' ? `ESTUFAGEM · ${flight ? 'VOO' : 'CAMINHADA'}` : 'PRODUTO NO GOODPACK'} position={[0, 0.27, 0.002]} width={0.42} />
          <Label text={activeModule === 'vr' ? ['MONTAGEM', 'TRAVAS E CAIXAS', 'POSIÇÃO E ENCAIXE'][safePage] : 'COMANDOS'} position={[0, 0.215, 0.002]} width={0.42} />
          {vrActions.slice(safePage * 6, safePage * 6 + 6).map((action, i) => <Label key={action.label} text={action.label} position={[-0.108 + (i % 2) * 0.216, 0.15 - Math.floor(i / 2) * 0.06, 0.002]} action={action.run} width={0.2} />)}
          {activeModule !== 'vr' && <><Label text="‹ Página" position={[-0.108, -0.035, 0.002]} width={0.2} action={() => setPage(p => (p + vrPages - 1) % vrPages)} />
          <Label text={`Página ${safePage + 1}/${vrPages} ›`} position={[0.108, -0.035, 0.002]} width={0.2} action={() => setPage(p => (p + 1) % vrPages)} />
          </>}
          <Label text={activeModule === 'road' ? (flight ? 'Direito: deslocar. Esquerdo: subir/descer e virar. Grip esquerdo: prancheta.' : 'Direito: caminhar. Esquerdo: virar. Área externa: 2 m. Grip esquerdo: prancheta.') : hint} position={[0, -0.16, 0.002]} width={0.42} height={0.06} />
          <Label text={activeModule === 'vr' ? lab.message : data?.status ?? 'Carregando cenário'} position={[0, -0.22, 0.002]} width={0.42} />
          <Label text="Sair do VR" position={[0.108, -0.28, 0.002]} width={0.2} action={() => void renderer?.xr.getSession()?.end()} />
        </XRInteraction>
      </Canvas>
    </section>
  </main></>;
}
