import { LatchSupport } from './LatchSupport';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Edges, TransformControls } from '@react-three/drei';
import { CanvasTexture, Group, Vector3, Mesh, MeshStandardMaterial, Color } from 'three';
import { MB6, WALL_PIVOT_Y, WALL_SEATING_TRAVEL, MB6_VISUAL_COLLAPSED, wallMotion, leverGesture, type Action, type Assembly, type Pose, type LeverStep } from '../utils/mb6Assembly';
import { playAssemblySound } from '../utils/assemblyAudio';

type Vec = [number, number, number];
export type MouseTool = 'assemble' | 'translate' | 'rotate';
type Interaction = { enabled: boolean; busy: (value: boolean) => void; hint: (text: string) => void };

// Capture the pointer so a gesture can end outside the original mesh.
function useGesture(interaction: Interaction, hint: string, tap: () => void, drag: (dx: number, dy: number) => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const latest = useRef(interaction); latest.current = interaction;
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const cancel = () => { if (start.current) { start.current = null; latest.current.busy(false); } };
    window.addEventListener('blur', cancel); window.addEventListener('pointercancel', cancel); window.addEventListener('pointerup', cancel);
    return () => { cancel(); window.removeEventListener('blur', cancel); window.removeEventListener('pointercancel', cancel); window.removeEventListener('pointerup', cancel); };
  }, []);
  return { hovered, events: {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { if (!interaction.enabled) return; e.stopPropagation(); setHovered(true); interaction.hint(hint); },
    onPointerOut: () => setHovered(false),
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (!interaction.enabled || e.button !== 0) return;
      e.stopPropagation(); start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      (e.target as Element).setPointerCapture(e.pointerId); interaction.busy(true); interaction.hint(hint);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => { if (start.current) e.stopPropagation(); },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (!start.current || e.pointerId !== start.current.id) return;
      e.stopPropagation(); const dx = e.clientX - start.current.x, dy = e.clientY - start.current.y;
      start.current = null; (e.target as Element).releasePointerCapture(e.pointerId); interaction.busy(false);
      if (Math.hypot(dx, dy) < 6) tap(); else drag(dx, dy);
    },
  } };
}

function Part({ position, size, color = '#b8c5cd', highlight = false }: { position: Vec; size: Vec; color?: string; highlight?: boolean }) {
  return <mesh position={position}><boxGeometry args={size} /><meshStandardMaterial color={color} emissive={highlight ? '#26bba5' : '#000000'} emissiveIntensity={0.3} metalness={0.55} roughness={0.38} /><Edges color="#465564" /></mesh>;
}

function WallNumber({ number, height }: { number: number; height: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#163747'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 190px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(number), 128, 140);
    return new CanvasTexture(canvas);
  }, [number]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={[0.18, height * 0.68, 0.016]}><planeGeometry args={[0.19, 0.19]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>;
}

function Lever({ index, box, x, height, act, interaction, direction }: { index: number; box: Assembly; x: number; height: number; act: (a: Action) => void; interaction: Interaction; direction: number }) {
  const raised = box.leverRaised[index], bolt = box.bolts[index];
  const root = useRef<Group>(null);
  const originalColors = useRef(new Map<MeshStandardMaterial, Color>());
  const handle = useRef<Group>(null), carriage = useRef<Group>(null);
  const wasLocked = useRef(box.locks[index]);
  const clickPending = useRef(false);
  useEffect(() => {
    if (box.locks[index] && !wasLocked.current) clickPending.current = true;
    if (!box.locks[index]) clickPending.current = false;
    wasLocked.current = box.locks[index];
  }, [box.locks, index]);
  const operate = (step: LeverStep) => act({ type: 'lever', index, step });
  // Click toggles the hinged handle; horizontal drag operates the sliding bolt.
  const gesture = useGesture(interaction, `Alavanca ${index + 1}: clique para ${raised ? 'rebater' : 'levantar'}; arraste na horizontal para deslizar o ferrolho.`, () => operate(raised ? 'lower' : 'lift'), (dx, dy) => operate(leverGesture(dx, dy)));
  useFrame((_, dt) => {
    const highlighted = !!root.current?.userData.xrHovered || gesture.hovered;
    if (highlighted) root.current?.traverse(object => {
      if (object instanceof Mesh && object.material instanceof MeshStandardMaterial) {
        if (!originalColors.current.has(object.material)) originalColors.current.set(object.material, object.material.color.clone());
        object.material.color.set('#168bff');
      }
    });
    else if (originalColors.current.size) { originalColors.current.forEach((color, material) => material.color.copy(color)); originalColors.current.clear(); }
    const speed = Math.min(1, dt * 12);
    if (handle.current) handle.current.rotation.x += ((raised ? -1.15 : 0) - handle.current.rotation.x) * speed;
    if (carriage.current) carriage.current.position.x += ((bolt ? direction * 0.038 : 0) - carriage.current.position.x) * speed;
    if (clickPending.current && handle.current && Math.abs(handle.current.rotation.x) < .025) {
      playAssemblySound('click'); clickPending.current = false;
    }
  });
  return <group ref={root} position={[x, height - 0.035, 0.032]} {...gesture.events} userData={{ xrLever: { boxId: box.id, index, direction }, activate: () => operate(raised ? 'lower' : 'lift') }}>
    <Suspense fallback={<Part position={[0, 0, 0]} size={[0.15, 0.05, 0.014]} />}><LatchSupport direction={direction} /></Suspense>
    <Part position={[direction * 0.085, 0, 0.012]} size={[0.025, 0.045, 0.035]} color="#356b99" />
    <group ref={carriage}>
      <Suspense fallback={null}><LatchSupport direction={direction} slider /></Suspense>
      <group ref={handle} position={[-.056 * direction, .006, .014]}>
        <Suspense fallback={null}><LatchSupport direction={direction} handle /></Suspense>
      </group>
    </group>
    <Part position={[0, -0.18, 0]} size={[0.065, 0.018, 0.005]} color={box.locks[index] ? '#1bc89d' : '#efa94c'} />
    {/* The oversized grab target must not protrude through a folded upper wall. */}
    {!box.lid && box.walls[index] && box.walls[(index + 1) % 4] && <mesh><boxGeometry args={[0.18, 0.36, 0.15]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
  </group>;
}

function Wall({ index, box, act, interaction }: { index: number; box: Assembly; act: (a: Action) => void; interaction: Interaction }) {
  const ref = useRef<Group>(null), raised = box.walls[index];
  const velocity = useRef(0);
  const soundMotion = useRef({ angle: -Math.PI / 2, lift: index === 0 ? WALL_SEATING_TRAVEL : 0, moving: false, lastCreak: -Infinity });
  const wallData = useMemo(() => ({ xrWall: { boxId: box.id, index }, xrHeld: false, invalidUntil: 0 }), [box.id,index]);
  const width = (index % 2 ? MB6.d : MB6.w) - 0.06;
  const pivot = WALL_PIVOT_Y[index];
  const location: Vec = index === 0 ? [0, pivot, MB6.d / 2 - 0.025] : index === 1 ? [MB6.w / 2 - 0.025, pivot, 0] : index === 2 ? [0, pivot, -MB6.d / 2 + 0.025] : [-MB6.w / 2 + 0.025, pivot, 0];
  const height = MB6.h - 0.035 - location[1];
  const gesture = useGesture(interaction, `${raised ? 'Dobrar' : 'Levantar'} parede: clique ou arraste ${raised ? 'para baixo' : 'para cima'}.`, () => act({ type: 'wall', index }), (_, dy) => { if ((dy < -6 && !raised) || (dy > 6 && raised)) act({ type: 'wall', index }); });
  useFrame((_, dt) => {
    const wall=ref.current; if(!wall) return;
    const flash=performance.now()<(wall.userData.invalidUntil??0) && Math.floor(performance.now()/100)%2===0;
    wall.traverse(o=>{if(o instanceof Mesh && o.material instanceof MeshStandardMaterial){if(!o.userData.originalEmissive)o.userData.originalEmissive=o.material.emissive.clone();o.material.emissive.copy(o.userData.originalEmissive);if(flash)o.material.emissive.set('#ff0000');o.material.emissiveIntensity=flash?1:.3;}});
    const next = wallMotion(index, wall.rotation.x, wall.position.y, velocity.current, raised, !!wall.userData.xrHeld, dt);
    wall.rotation.x=next.angle; wall.position.y=next.lift; velocity.current=next.velocity;
    const sound = soundMotion.current, now = performance.now();
    const moving = Math.abs(next.angle - sound.angle) + Math.abs(next.lift - sound.lift) > .00001;
    if (moving && now - sound.lastCreak > 145) {
      playAssemblySound('creak'); sound.lastCreak = now;
    }
    if (sound.moving && next.angle === -Math.PI / 2 && !wall.userData.xrHeld) {
      playAssemblySound('impact'); sound.moving = false;
    } else if (moving) sound.moving = true;
    else if (next.angle === 0 && next.lift === 0) sound.moving = false;
    sound.angle = next.angle; sound.lift = next.lift;
  });
  return <group position={location} rotation={[0, [0, Math.PI / 2, Math.PI, -Math.PI / 2][index], 0]}>
    <Part position={[0, (0.07 - pivot) / 2, 0]} size={[width - 0.09, pivot - 0.07, 0.014]} />
    {/* Fixed U sockets capture the rotating lower rail. */}
    {[-1, 1].map(side => <group key={side} position={[side * (width / 2 - 0.035), 0, 0]}>
      {[-1, 1].map(cheek => <Part key={cheek} position={[cheek * 0.018, (0.07 - pivot) / 2, 0]} size={[0.009, pivot - 0.07 + 0.04, 0.044]} color="#d5dce0" />)}
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.009, 0.009, 0.052, 16]} /><meshStandardMaterial color="#607783" metalness={0.7} roughness={0.3} /></mesh>
    </group>)}
    <group ref={ref} position={[0, index === 0 ? WALL_SEATING_TRAVEL : 0, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={wallData}>
      {[-1, 1].map(side => <Part key={side} position={[side * (width / 2 - 0.035), 0.013, 0]} size={[0.024, 0.04, 0.014]} />)}
      <group {...gesture.events} userData={{ activate: () => act({ type: 'wall', index }) }}>
        <WallNumber number={index + 1} height={height} />
        <Part position={[0, height / 2, 0]} size={[width, height, 0.012]} highlight={gesture.hovered} />
        {[-1, 0, 1].map(x => <Part key={x} position={[x * (width / 2 - 0.025), height / 2, 0.008]} size={[0.025, height, 0.012]} highlight={gesture.hovered} />)}
        {[0, 0.5, 1].map(y => <Part key={y} position={[0, y * (height - 0.02), 0.008]} size={[width, 0.02, 0.012]} highlight={gesture.hovered} />)}
      </group>
      {(index === 0 ? [3, 0] : index === 2 ? [1, 2] : []).map((corner, side) => <Lever key={corner} index={corner} box={box} x={(side ? 1 : -1) * (width / 2 - 0.11)} height={height} act={act} interaction={interaction} direction={side ? 1 : -1} />)}
    </group>
  </group>;
}

function Lid({ box, act, interaction }: { box: Assembly; act: (a: Action) => void; interaction: Interaction }) {
  const ref = useRef<Group>(null);
  const wasClosed = useRef(box.lid), impactPending = useRef(false);
  useEffect(() => {
    if (box.lid && !wasClosed.current) impactPending.current = true;
    if (!box.lid) impactPending.current = false;
    wasClosed.current = box.lid;
  }, [box.lid]);
  const height = box.walls.some(Boolean) ? MB6.h - 0.035 : MB6_VISUAL_COLLAPSED - 0.006;
  // Keep the initial JSX transform stable: changing wall height must not teleport
  // the removed lid back onto the crate before the next animation frame.
  const [initialPosition] = useState<Vec>(() => [0, box.lid ? height : 0.025, box.lid ? 0 : 1.7]);
  const gesture = useGesture(interaction, 'Tampa: clique ou arraste para cima para retirar; para baixo para recolocar.', () => act({ type: 'lid' }), (_, dy) => { if ((dy < -6 && box.lid) || (dy > 6 && !box.lid)) act({ type: 'lid' }); });
  const target = useRef(new Vector3());
  useFrame((_, dt) => {
    target.current.set(0, box.lid ? height : 0.025, box.lid ? 0 : 1.7);
    ref.current?.position.lerp(target.current, Math.min(1, dt * 8));
    if (impactPending.current && ref.current && ref.current.position.distanceTo(target.current) < .015) {
      playAssemblySound('impact'); impactPending.current = false;
    }
  });
  return <group ref={ref} position={initialPosition} {...gesture.events} userData={{ activate: () => act({ type: 'lid' }) }}>
    <Part position={[0, 0, 0]} size={[MB6.w - 0.12, 0.012, MB6.d - 0.12]} color="#dfe7eb" highlight={gesture.hovered} />
  </group>;
}

export function Crate({ box, selected, tool, dispatch, onPose, interaction }: { box: Assembly; selected: boolean; tool: MouseTool; dispatch: (a: Action) => void; onPose: (id: number, pose: Pose) => Pose; interaction: Interaction }) {
  const previousSupport = useRef(box.support);
  useEffect(() => {
    if (box.support !== null && box.support !== previousSupport.current) playAssemblySound('celebrate');
    previousSupport.current = box.support;
  }, [box.support]);
  const [group, setGroup] = useState<Group | null>(null);
  const act = (a: Action) => { dispatch({ type: 'select', id: box.id }); dispatch(a); };
  const commit = () => {
    if (!group) return;
    const forward = new Vector3(0, 0, 1).applyQuaternion(group.quaternion);
    const pose = onPose(box.id, { x: group.position.x, y: group.position.y, z: group.position.z, yaw: Math.atan2(forward.x, forward.z) });
    group.position.set(pose.x, pose.y, pose.z); group.rotation.set(0, pose.yaw, 0); interaction.busy(false);
  };
  return <>
    <group ref={setGroup} userData={{ xrBoxId: box.id }} position={[box.pose.x, box.pose.y, box.pose.z]} rotation={[0, box.pose.yaw, 0]} onClick={e => { if (!interaction.enabled) { e.stopPropagation(); dispatch({ type: 'select', id: box.id }); } }}>
      <Part position={[0, 0.065, 0]} size={[MB6.w, 0.01, MB6.d]} color={selected ? '#829da8' : '#a9b7c0'} />
      {/* Open pallet frame with runners and intermediate supports. */}
      {[-1, 1].map(side => <group key={side}>
        <Part position={[0, 0.008, side * (MB6.d / 2 - 0.035)]} size={[MB6.w, 0.016, 0.07]} />
        <Part position={[side * (MB6.w / 2 - 0.035), 0.008, 0]} size={[0.07, 0.016, MB6.d]} />
        {[-1, 1].map(support => <group key={support}>
          <Part position={[support * MB6.w / 6, 0.038, side * (MB6.d / 2 - 0.035)]} size={[0.04, 0.044, 0.07]} />
          <Part position={[side * (MB6.w / 2 - 0.035), 0.038, support * MB6.d / 6]} size={[0.07, 0.044, 0.04]} />
        </group>)}
      </group>)}
      {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x}${z}`} position={[x * (MB6.w / 2 - MB6.inset), 0, z * (MB6.d / 2 - MB6.inset)]}>
        {[-1, 1].map(sign => <group key={sign}><Part position={[sign * 0.036, MB6.foot / 2, 0]} size={[0.018, MB6.foot, 0.09]} color="#2563ac" /><Part position={[0, MB6.foot / 2, sign * 0.036]} size={[0.054, MB6.foot, 0.018]} color="#2563ac" /></group>)}
        {box.walls.every(Boolean) && <Part position={[0, MB6.h - MB6.pin / 2, 0]} size={[0.045, MB6.pin, 0.045]} color="#33c9b2" />}
      </group>))}
      {box.walls.map((_, i) => <Wall key={i} index={i} box={box} act={act} interaction={interaction} />)}
      <Lid box={box} act={act} interaction={interaction} />
    </group>
    {selected && group && tool !== 'assemble' && <TransformControls object={group} mode={tool} showX={tool !== 'rotate'} showY showZ={tool !== 'rotate'} space="world" translationSnap={0.01} rotationSnap={Math.PI / 36} onMouseDown={() => interaction.busy(true)} onMouseUp={commit} />}
  </>;
}
