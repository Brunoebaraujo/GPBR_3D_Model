import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Vector3 } from 'three';
import { warehousePosition } from '../utils/assemblyWarehouse';

type Props = { enabled: boolean };
const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const direction = new Vector3();
const rotation = new Euler(0, 0, 0, 'YXZ');

/** Desktop first-person walkthrough. Does not modify XR controls or MB6 assembly state. */
export function DesktopWalkControls({ enabled }: Props) {
  const { camera, gl } = useThree();
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
      yaw.current -= event.movementX * 0.0022;
      pitch.current = Math.max(-Math.PI / 2 + 0.08, Math.min(Math.PI / 2 - 0.08, pitch.current - event.movementY * 0.0022));
    };
    const capture = () => {
      if (document.pointerLockElement !== canvas) void canvas.requestPointerLock().catch(() => undefined);
    };
    const clear = () => keys.current.clear();
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', clear);
    document.addEventListener('mousemove', mouseMove);
    canvas.addEventListener('click', capture);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clear);
      document.removeEventListener('mousemove', mouseMove);
      canvas.removeEventListener('click', capture);
      keys.current.clear();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [enabled, camera, gl]);

  useFrame((_, delta) => {
    if (!enabled) return;
    rotation.set(pitch.current, yaw.current, 0, 'YXZ');
    camera.quaternion.setFromEuler(rotation);
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
