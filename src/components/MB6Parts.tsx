import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Edges, TransformControls } from '@react-three/drei';
import { CanvasTexture, Group, Vector3 } from 'three';
import { MB6, WALL_PIVOT_Y, leverGesture, type Action, type Assembly, type Pose, type LeverStep } from '../utils/mb6Assembly';

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
  const handle = useRef<Group>(null), carriage = useRef<Group>(null);
  const operate = (step: LeverStep) => act({ type: 'lever', index, step });
  // Click toggles the hinged handle; horizontal drag operates the sliding bolt.
  const gesture = useGesture(interaction, `Alavanca ${index + 1}: clique para ${raised ? 'rebater' : 'levantar'}; arraste na horizontal para deslizar o ferrolho.`, () => operate(raised ? 'lower' : 'lift'), (dx, dy) => operate(leverGesture(dx, dy)));
  useFrame((_, dt) => {
    const speed = Math.min(1, dt * 12);
    if (handle.current) handle.current.rotation.x += ((raised ? -1.15 : 0) - handle.current.rotation.x) * speed;
    if (carriage.current) carriage.current.position.x += ((bolt ? direction * 0.038 : 0) - carriage.current.position.x) * speed;
  });
  return <group position={[x, height - 0.035, 0.032]} {...gesture.events} userData={{ xrLever: { boxId: box.id, index, direction }, activate: () => operate(raised ? 'lower' : 'lift') }}>
    <Part position={[0, 0, 0]} size={[0.15, 0.05, 0.014]} />
    <Part position={[direction * 0.085, 0, 0.012]} size={[0.025, 0.045, 0.035]} color="#356b99" />
    <group ref={carriage}>
      <Part position={[0, 0, 0.018]} size={[0.12, 0.014, 0.014]} highlight={gesture.hovered} />
      <group ref={handle}>
        <Part position={[0, -0.035, 0.022]} size={[0.016, 0.07, 0.015]} highlight={gesture.hovered} />
        <mesh position={[0, -0.105, 0.022]} scale={[1, 1.75, 1]}><torusGeometry args={[0.025, 0.006, 8, 32]} /><meshStandardMaterial color="#b8c5cd" metalness={0.55} roughness={0.38} emissive={gesture.hovered ? '#26bba5' : '#000000'} emissiveIntensity={0.3} /></mesh>
      </group>
    </group>
    <Part position={[0, -0.18, 0]} size={[0.065, 0.018, 0.005]} color={box.locks[index] ? '#1bc89d' : '#efa94c'} />
    <mesh><boxGeometry args={[0.18, 0.36, 0.15]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
  </group>;
}

function Wall({ index, box, act, interaction }: { index: number; box: Assembly; act: (a: Action) => void; interaction: Interaction }) {
  const ref = useRef<Group>(null), raised = box.walls[index];
  const width = (index % 2 ? MB6.d : MB6.w) - 0.06;
  const pivot = WALL_PIVOT_Y[index];
  const location: Vec = index === 0 ? [0, pivot, MB6.d / 2 - 0.025] : index === 1 ? [MB6.w / 2 - 0.025, pivot, 0] : index === 2 ? [0, pivot, -MB6.d / 2 + 0.025] : [-MB6.w / 2 + 0.025, pivot, 0];
  const height = MB6.h - 0.035 - location[1];
  const gesture = useGesture(interaction, `${raised ? 'Dobrar' : 'Levantar'} parede: clique ou arraste ${raised ? 'para baixo' : 'para cima'}.`, () => act({ type: 'wall', index }), (_, dy) => { if ((dy < -6 && !raised) || (dy > 6 && raised)) act({ type: 'wall', index }); });
  useFrame((_, dt) => { if (ref.current && !ref.current.userData.xrHeld) ref.current.rotation.x += ((raised ? 0 : -Math.PI / 2) - ref.current.rotation.x) * Math.min(1, dt * 9); });
  return <group position={location} rotation={[0, [0, Math.PI / 2, Math.PI, -Math.PI / 2][index], 0]}>
    <Part position={[0, (0.07 - pivot) / 2, 0]} size={[width - 0.09, pivot - 0.07, 0.014]} />
    {/* Fixed U sockets capture the rotating lower rail. */}
    {[-1, 1].map(side => <group key={side} position={[side * (width / 2 - 0.035), 0, 0]}>
      {[-1, 1].map(cheek => <Part key={cheek} position={[cheek * 0.018, (0.07 - pivot) / 2, 0]} size={[0.009, pivot - 0.07 + 0.04, 0.044]} color="#d5dce0" />)}
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.009, 0.009, 0.052, 16]} /><meshStandardMaterial color="#607783" metalness={0.7} roughness={0.3} /></mesh>
    </group>)}
    <group ref={ref} rotation={[-Math.PI / 2, 0, 0]} userData={{ xrWall: { boxId: box.id, index } }}>
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
  const height = box.walls.some(Boolean) ? MB6.h - 0.035 : MB6.collapsed - 0.006;
  // Keep the initial JSX transform stable: changing wall height must not teleport
  // the removed lid back onto the crate before the next animation frame.
  const [initialPosition] = useState<Vec>(() => [0, box.lid ? height : 0.025, box.lid ? 0 : 1.7]);
  const gesture = useGesture(interaction, 'Tampa: clique ou arraste para cima para retirar; para baixo para recolocar.', () => act({ type: 'lid' }), (_, dy) => { if ((dy < -6 && box.lid) || (dy > 6 && !box.lid)) act({ type: 'lid' }); });
  const target = useRef(new Vector3());
  useFrame((_, dt) => {
    target.current.set(0, box.lid ? height : 0.025, box.lid ? 0 : 1.7);
    ref.current?.position.lerp(target.current, Math.min(1, dt * 8));
  });
  return <group ref={ref} position={initialPosition} {...gesture.events} userData={{ activate: () => act({ type: 'lid' }) }}>
    <Part position={[0, 0, 0]} size={[MB6.w - 0.12, 0.012, MB6.d - 0.12]} color="#dfe7eb" highlight={gesture.hovered} />
  </group>;
}

export function Crate({ box, selected, tool, dispatch, onPose, interaction }: { box: Assembly; selected: boolean; tool: MouseTool; dispatch: (a: Action) => void; onPose: (id: number, pose: Pose) => Pose; interaction: Interaction }) {
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
