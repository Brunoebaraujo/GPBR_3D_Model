import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Edges } from '@react-three/drei';
import { BoxGeometry, CanvasTexture, Group, Matrix4, Mesh, MeshBasicMaterial, Raycaster, WebGLRenderer } from 'three';
import { MB6, WALL_NAMES, initialLab, reduceLab, ready, type Action, type Assembly } from '../utils/mb6Assembly';
import './vr.css';

type Vec = [number, number, number];
function Part({ position, size, color = '#b8c5cd', action }: { position: Vec; size: Vec; color?: string; action?: () => void }) {
  return <mesh position={position} userData={{ activate: action }} onClick={e => { e.stopPropagation(); action?.(); }}>
    <boxGeometry args={size} /><meshStandardMaterial color={color} metalness={0.55} roughness={0.38} /><Edges color="#465564" />
  </mesh>;
}

function Wall({ index, raised, action }: { index: number; raised: boolean; action: () => void }) {
  const ref = useRef<Group>(null);
  const side = index % 2 === 1;
  const width = side ? MB6.d - 0.06 : MB6.w - 0.06;
  
  const location: Vec = index === 0 ? [0, 0.13, MB6.d / 2 - 0.025] : index === 1 ? [MB6.w / 2 - 0.025, 0.15, 0] : index === 2 ? [0, 0.17, -MB6.d / 2 + 0.025] : [-MB6.w / 2 + 0.025, 0.19, 0];
  const height = MB6.h - 0.04 - location[1];
  const yaw = [0, Math.PI / 2, Math.PI, -Math.PI / 2][index];
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.x += ((raised ? 0 : -Math.PI / 2) - ref.current.rotation.x) * Math.min(1, dt * 9); });
  return <group position={location} rotation={[0, yaw, 0]}><group ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
    <Part position={[0, height / 2, 0]} size={[width, height, 0.018]} action={action} />
    {[-1, 0, 1].map(x => <Part key={x} position={[x * (width / 2 - 0.025), height / 2, 0.016]} size={[0.025, height, 0.025]} action={action} />)}
    {[0, 0.5, 1].map(y => <Part key={y} position={[0, y * height, 0.016]} size={[width, 0.025, 0.025]} action={action} />)}
  </group></group>;
}

function Crate({ box, dispatch }: { box: Assembly; dispatch: (a: Action) => void }) {
  const act = (a: Action) => { dispatch({ type: 'select', id: box.id }); dispatch(a); };
  const lidY = box.walls.some(Boolean) ? MB6.h - 0.025 : 0.25;
  return <group position={[box.pose.x, box.pose.y, box.pose.z]} rotation={[0, box.pose.yaw, 0]}>
    <Part position={[0, 0.1, 0]} size={[MB6.w, 0.05, MB6.d]} action={() => dispatch({ type: 'select', id: box.id })} />
    {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x}${z}`} position={[x * (MB6.w / 2 - MB6.inset), 0, z * (MB6.d / 2 - MB6.inset)]}>
      {[-1, 1].map(sign => <group key={sign}><Part position={[sign * 0.036, MB6.foot / 2, 0]} size={[0.018, MB6.foot, 0.09]} color="#2563ac" /><Part position={[0, MB6.foot / 2, sign * 0.036]} size={[0.054, MB6.foot, 0.018]} color="#2563ac" /></group>)}
      {box.walls.every(Boolean) && <Part position={[0, MB6.h, 0]} size={[0.045, MB6.pin * 2, 0.045]} color="#33c9b2" />}
    </group>))}
    {box.walls.map((raised, i) => <Wall key={i} index={i} raised={raised} action={() => act({ type: 'wall', index: i })} />)}
    {[[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([x, z], i) => <Part key={i} position={[x * (MB6.w / 2 - 0.025), box.walls[i] && box.walls[(i + 1) % 4] ? MB6.h - 0.085 : 0.22, z * (MB6.d / 2 - 0.025)]} size={[0.065, 0.1, 0.065]} color={box.locks[i] ? '#24c5a2' : '#eea447'} action={() => act({ type: 'lock', index: i })} />)}
    <Part position={box.lid ? [0, lidY, 0] : [0, 0.025, 1.7]} size={[MB6.w - 0.12, 0.035, MB6.d - 0.12]} color="#e0e7ea" action={() => act({ type: 'lid' })} />
  </group>;
}

function Label({ text, position, action, width = 1.1, color = '#183747' }: { text: string; position: Vec; action?: () => void; width?: number; color?: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = '#ffffff'; ctx.font = '38px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 64, 990); return new CanvasTexture(canvas);
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position} userData={{ activate: action }} onClick={e => { e.stopPropagation(); action?.(); }}><planeGeometry args={[width, 0.13]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>;
}

// Native WebXR controllers share the same commands and guards as pointer/keyboard UI.
function XRBridge({ onRenderer, onPresenting }: { onRenderer: (gl: WebGLRenderer | null) => void; onPresenting: (v: boolean) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    gl.xr.enabled = true; gl.xr.setReferenceSpaceType('local-floor'); onRenderer(gl);
    const ray = new Raycaster(), rotation = new Matrix4();
    const cameraRig = new Group(); cameraRig.position.z = 3; scene.add(cameraRig); const originalParent = camera.parent;
    const saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
    const start = () => { saved.position.copy(camera.position); saved.quaternion.copy(camera.quaternion); cameraRig.add(camera); camera.position.set(0, 0, 0); camera.quaternion.identity(); onPresenting(true); };
    const end = () => { cameraRig.remove(camera); originalParent?.add(camera); camera.position.copy(saved.position); camera.quaternion.copy(saved.quaternion); onPresenting(false); };
    gl.xr.addEventListener('sessionstart', start); gl.xr.addEventListener('sessionend', end);
    const controllers = [0, 1].map(i => {
      const controller = gl.xr.getController(i);
      // A world-space rig leaves the headset's floor origin in front of the workbench.
      const rig = new Group(); rig.position.set(0, 0, 3); rig.add(controller); scene.add(rig);
      const beam = new Mesh(new BoxGeometry(0.004, 0.004, 4), new MeshBasicMaterial({ color: '#42e8cc' })); beam.position.z = -2; controller.add(beam);
      const select = () => {
        controller.updateWorldMatrix(true, false); rotation.extractRotation(controller.matrixWorld);
        ray.ray.origin.setFromMatrixPosition(controller.matrixWorld); ray.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
        const hit = ray.intersectObjects(scene.children, true).find(h => typeof h.object.userData.activate === 'function');
        hit?.object.userData.activate();
      };
      controller.addEventListener('select', select);
      return { controller, rig, beam, select };
    });
    return () => {
      void gl.xr.getSession()?.end(); end(); scene.remove(cameraRig); onRenderer(null);
      gl.xr.removeEventListener('sessionstart', start); gl.xr.removeEventListener('sessionend', end);
      controllers.forEach(({ controller, rig, beam, select }) => { controller.removeEventListener('select', select); controller.remove(beam); scene.remove(rig); beam.geometry.dispose(); beam.material.dispose(); });
    };
  }, [gl, scene, camera, onRenderer, onPresenting]);
  return null;
}

export function VRWorkspace() {
  const [lab, dispatch] = useReducer(reduceLab, undefined, initialLab);
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
    if (!renderer || !navigator.xr || pending) return;
    setPending(true);
    let session: XRSession | undefined;
    try { session = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'] }); await renderer.xr.setSession(session); }
    catch { await session?.end().catch(() => undefined); setXRStatus('Não foi possível entrar em VR. Verifique a permissão e tente novamente.'); }
    finally { setPending(false); }
  };
  const move = (axis: 'x' | 'y' | 'z', delta: number) => dispatch({ type: 'move', pose: { ...selected.pose, [axis]: Math.round((selected.pose[axis] + delta) * 1000) / 1000 } });
  const actions = [
    { label: selected.lid ? 'Retirar tampa' : 'Colocar tampa', run: () => dispatch({ type: 'lid' }) },
    ...WALL_NAMES.map((name, i) => ({ label: `${selected.walls[i] ? 'Dobrar' : 'Montar'} ${name}`, run: () => dispatch({ type: 'wall', index: i }) })),
    ...selected.locks.map((locked, i) => ({ label: `${locked ? 'Destravar' : 'Travar'} vértice ${i + 1}`, run: () => dispatch({ type: 'lock', index: i }) })),
    { label: 'Criar segunda caixa', run: () => dispatch({ type: 'add' }) },
    { label: 'Elevar para empilhar', run: () => dispatch({ type: 'move', pose: { ...selected.pose, y: MB6.h } }) },
    { label: 'Aproximar da outra caixa', run: () => { const other = lab.boxes.find(b => b.id !== selected.id); if (other) dispatch({ type: 'move', pose: { ...selected.pose, x: other.pose.x + 0.06, z: other.pose.z } }); } },
    { label: 'Testar encaixe', run: () => dispatch({ type: 'stack' }) },
    { label: 'Desempilhar', run: () => dispatch({ type: 'unstack' }) },
    { label: 'Girar 90°', run: () => dispatch({ type: 'move', pose: { ...selected.pose, yaw: selected.pose.yaw + Math.PI / 2 } }) },
  ];
  return <main className="vr-lab">
    <aside className="vr-panel"><p className="vr-eyebrow">LABORATÓRIO INTERATIVO</p><h1>Monte. Trave. Empilhe.</h1><p>MB6 · escala 1:1 · duas caixas</p>
      <button className="vr-primary" disabled={!supported || !renderer || pending} onClick={() => void enter()}>{pending ? 'Conectando…' : 'Entrar em VR'}</button><small>{xrStatus}</small>
      <p>Mouse: arraste para orbitar e role para aproximar. Clique nas peças ou nos botões. VR: aponte o controle e aperte o gatilho nos painéis ou peças.</p>
      <div className="vr-row">{lab.boxes.map(b => <button key={b.id} aria-pressed={selected.id === b.id} onClick={() => dispatch({ type: 'select', id: b.id })}>Caixa {b.id}</button>)}</div>
      <p>{selected.walls.filter(Boolean).length}/4 paredes · {selected.locks.filter(Boolean).length}/4 travas · {selected.support ? 'Empilhada' : ready(selected) ? 'Pronta' : 'Em montagem'}</p>
      <div className="vr-actions">{actions.map(a => <button key={a.label} onClick={a.run}>{a.label}</button>)}</div>
      <h2>Alinhamento dos pés</h2><small>Eleve, aproxime, ajuste X em −20 mm três vezes e teste. Gire para experimentar um encaixe incompatível.</small>
      {(['x', 'y', 'z'] as const).map(axis => <div className="vr-row" key={axis}><span>{axis.toUpperCase()} {Math.round(selected.pose[axis] * 1000)} mm</span>{[-0.02, 0.02].map(d => <button key={d} aria-label={`${axis.toUpperCase()} ${d > 0 ? '+' : '−'}20 mm`} onClick={() => move(axis, d)}>{d > 0 ? '+' : '−'}20</button>)}</div>)}
      <button onClick={() => dispatch({ type: 'reset' })}>Reiniciar laboratório</button>
      <p className="vr-note">Encaixes ilustrativos: medidas dos pés, travas e dobradiças ainda precisam ser conferidas na ficha técnica. Não simula resistência estrutural.</p>
    </aside>
    <section className="vr-stage" aria-label="Montagem MB6 em 3D"><div className="vr-feedback" role="status">{lab.message}</div>
      <Canvas camera={{ position: [3.4, 2.9, 5.3], fov: 48 }}><color attach="background" args={['#101e2a']} /><ambientLight intensity={1.8} /><directionalLight position={[3, 7, 4]} intensity={3} />
        <gridHelper args={[10, 40, '#34626d', '#253b48']} /><OrbitControls enabled={!presenting} target={[0, 0.8, 0]} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={2} maxDistance={9} />
        <XRBridge onRenderer={setRenderer} onPresenting={setPresenting} />
        {lab.boxes.map(b => <Crate key={b.id} box={b} dispatch={dispatch} />)}
        <group position={[0, 0, -1.6]}>
          <Label text={`MB6 • CAIXA ${selected.id} • ${selected.walls.filter(Boolean).length}/4 PAREDES • ${selected.locks.filter(Boolean).length}/4 TRAVAS`} position={[0, 2.6, 0]} width={3.8} />
          <Label text={lab.message} position={[0, 2.42, 0]} width={3.8} />
          {actions.map((a, i) => <Label key={i} text={a.label} position={[-1.3 + (i % 3) * 1.3, 2.2 - Math.floor(i / 3) * 0.18, 0]} action={a.run} />)}
          {(['x', 'y', 'z'] as const).flatMap((axis, i) => [-0.02, 0.02].map((d, j) => <Label key={`${axis}${d}`} text={`${axis.toUpperCase()} ${d > 0 ? '+' : '−'}20 mm`} position={[-1.5 + (i * 2 + j) * 0.6, 1.22, 0]} width={0.55} action={() => move(axis, d)} />))}
          {lab.boxes.map((b, i) => <Label key={b.id} text={`Selecionar caixa ${b.id}`} position={[-0.65 + i * 1.3, 1.02, 0]} action={() => dispatch({ type: 'select', id: b.id })} />)}
          <Label text="Reiniciar" position={[-0.65, 0.82, 0]} action={() => dispatch({ type: 'reset' })} /><Label text="Sair do VR" position={[0.65, 0.82, 0]} action={() => void renderer?.xr.getSession()?.end()} />
        </group>
      </Canvas>
    </section>
  </main>;
}

