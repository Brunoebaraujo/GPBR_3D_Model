import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Raycaster, Vector2, Vector3, type Object3D } from 'three';
import { warehousePosition } from '../utils/assemblyWarehouse';

type Props = { enabled: boolean; onHint: (text: string) => void };
type Gesture = { hint: string; hover: (value: boolean) => void; finish: (dx: number, dy: number) => void };
const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const direction = new Vector3();
const rotation = new Euler(0, 0, 0, 'YXZ');

/** Desktop first-person walkthrough. Does not modify XR controls or MB6 assembly state. */
export function DesktopWalkControls({ enabled, onHint }: Props) {
  const { camera, gl, scene } = useThree();
  const ray = useRef(new Raycaster());
  const center = useRef(new Vector2());
  const hovered = useRef<Object3D | null>(null);
  const held = useRef<{ gesture: Gesture; dx: number; dy: number } | null>(null);
  const hint = useRef(onHint); hint.current = onHint;
  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    camera.position.set(0, 1.65, 5.5);
    yaw.current = 0;
    pitch.current = 0;
    camera.rotation.set(0, 0, 0, 'YXZ');

    const canvas = gl.domElement;
    const keyDown = (event: KeyboardEvent) => {
      if (!KEYS.has(event.code)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      keys.current.add(event.code);
    };
    const keyUp = (event: KeyboardEvent) => { keys.current.delete(event.code); };
    const mouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      if (held.current) { held.current.dx += event.movementX; held.current.dy += event.movementY; return; }
      yaw.current -= event.movementX * 0.0022;
      pitch.current = Math.max(-Math.PI / 2 + 0.08, Math.min(Math.PI / 2 - 0.08, pitch.current - event.movementY * 0.0022));
    };
    const capture = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (document.pointerLockElement !== canvas) { try { void Promise.resolve(canvas.requestPointerLock()).catch(() => undefined); } catch { hint.current('Não foi possível capturar o mouse.'); } return; }
      const gesture = hovered.current?.userData.desktopGesture as Gesture | undefined;
      if (gesture) { held.current = { gesture, dx: 0, dy: 0 }; hint.current('Segurando peça · mova o mouse e solte para concluir.'); }
    };
    const release = (event: MouseEvent) => {
      if (event.button !== 0 || !held.current) return;
      const { gesture, dx, dy } = held.current; held.current = null;
      gesture.finish(dx, dy);
    };
    const clear = () => { keys.current.clear(); held.current = null; };
    const lockChange = () => { if (document.pointerLockElement !== canvas) clear(); };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', clear);
    document.addEventListener('mousemove', mouseMove);
    canvas.addEventListener('mousedown', capture);
    window.addEventListener('mouseup', release);
    document.addEventListener('pointerlockchange', lockChange);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clear);
      document.removeEventListener('mousemove', mouseMove);
      canvas.removeEventListener('mousedown', capture);
      window.removeEventListener('mouseup', release);
      document.removeEventListener('pointerlockchange', lockChange);
      (hovered.current?.userData.desktopGesture as Gesture | undefined)?.hover(false);
      hovered.current = null; clear();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [enabled, camera, gl]);

  useFrame((_, delta) => {
    if (!enabled) return;
    rotation.set(pitch.current, yaw.current, 0, 'YXZ');
    camera.quaternion.setFromEuler(rotation);
    if (!held.current) {
      let next: Object3D | null = null;
      if (document.pointerLockElement === gl.domElement) {
        camera.updateMatrixWorld();
        ray.current.setFromCamera(center.current, camera); ray.current.far = 2.5;
        for (const hit of ray.current.intersectObjects(scene.children, true)) {
          let node: Object3D | null = hit.object;
          let visible = true;
          for (let parent: Object3D | null = node; parent; parent = parent.parent) if (!parent.visible) { visible = false; break; }
          if (!visible) continue;
          while (node && !node.userData.desktopGesture) node = node.parent;
          if (node) { next = node; break; }
          if (hit.object.type === 'Mesh') break;
        }
      }
      if (next !== hovered.current) {
        (hovered.current?.userData.desktopGesture as Gesture | undefined)?.hover(false);
        hovered.current = next;
        const gesture = next?.userData.desktopGesture as Gesture | undefined;
        gesture?.hover(true);
        hint.current(gesture?.hint ?? 'WASD · mire na peça e segure o botão esquerdo.');
      }
    }
    if (held.current) return;
    const k = keys.current;
    const forward = Number(k.has('KeyW') || k.has('ArrowUp')) - Number(k.has('KeyS') || k.has('ArrowDown'));
    const right = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft'));
    if (!forward && !right) return;
    const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 4.4 : 2.1) * Math.min(delta, 0.05);
    direction.set(right, 0, -forward).normalize().applyAxisAngle(new Vector3(0, 1, 0), yaw.current);
    const next = warehousePosition(camera.position.x + direction.x * speed, camera.position.z + direction.z * speed);
    camera.position.set(next.x, 1.65, next.z);
  });
  return null;
}
