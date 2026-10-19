import type { Assembly, Lab, LeverStep, Pose } from './mb6Assembly';
import { ready } from './mb6Assembly';

export type Point3 = { x: number; y: number; z: number };
export type XRPad = { mapping: string; buttons: ReadonlyArray<{ pressed: boolean; value: number }>; axes: readonly number[] };
const deadzone = (value: number) => Number.isFinite(value) && Math.abs(value) > 0.18 ? Math.sign(value) * (Math.min(1, Math.abs(value)) - 0.18) / 0.82 : 0;
export function navigationInput(pads: Array<XRPad | null>, dt: number) {
  const active = pads.filter((p): p is XRPad => !!p && p.mapping === 'xr-standard' && (p.buttons[1]?.pressed || p.buttons[1]?.value > 0.65));
  const time = Math.max(0, Math.min(0.05, dt));
  const dominant = (axis: number) => active.map(p => deadzone(p.axes[axis] ?? 0)).reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0);
  return active.length >= 2
    ? { orbit: 0, elevation: 0, dolly: dominant(3) * time * 0.8 }
    : { orbit: dominant(2) * time * 0.8, elevation: -dominant(3) * time * 0.5 || 0, dolly: 0 };
}
export const canGrabBox = (lab: Lab, box: Assembly) => ready(box) && box.support === null && !lab.boxes.some(other => other.support === box.id);
export const midpoint = (a: Point3, b: Point3): Point3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
export function grabbedPose(origin: Pose, start: [Point3, Point3], current: [Point3, Point3]): Pose {
  const initial = midpoint(...start), now = midpoint(...current);
  const span = (p: [Point3, Point3]) => Math.hypot(p[1].x - p[0].x, p[1].z - p[0].z);
  const angle = (p: [Point3, Point3]) => Math.atan2(p[1].x - p[0].x, p[1].z - p[0].z);
  const delta = span(start) > 0.1 && span(current) > 0.1 ? angle(current) - angle(start) : 0;
  const dx = origin.x - initial.x, dz = origin.z - initial.z;
  return { x: now.x + dx * Math.cos(delta) + dz * Math.sin(delta), y: origin.y + now.y - initial.y, z: now.z - dx * Math.sin(delta) + dz * Math.cos(delta), yaw: origin.yaw + delta };
}
export type LeverPhase = 'lift' | 'open' | 'slide' | 'lower' | 'done';
export function leverMotion(phase: LeverPhase, delta: Point3, direction: number): LeverStep | null {
  if (phase === 'lift' && (delta.y >= 0.035 || delta.z >= 0.04)) return 'lift';
  if ((phase === 'slide' || phase === 'open') && delta.x * direction >= 0.03) return 'slide';
  if ((phase === 'lower' || phase === 'open') && (delta.y <= -0.035 || delta.z <= -0.04)) return 'lower';
  return null;
}

export function navigateRig(rig: Pose, viewer: Point3, center: Point3, nav: { orbit: number; elevation: number; dolly: number }): Pose {
  const yaw = rig.yaw - nav.orbit;
  const eyeX = rig.x + viewer.x * Math.cos(rig.yaw) + viewer.z * Math.sin(rig.yaw);
  const eyeZ = rig.z - viewer.x * Math.sin(rig.yaw) + viewer.z * Math.cos(rig.yaw);
  const dx = eyeX - center.x, dz = eyeZ - center.z;
  let x = dx * Math.cos(-nav.orbit) + dz * Math.sin(-nav.orbit);
  let z = -dx * Math.sin(-nav.orbit) + dz * Math.cos(-nav.orbit);
  const radius = Math.hypot(x,z);
  if (nav.dolly && radius > 0.001) { const scale = Math.max(0.85, Math.min(6, radius + nav.dolly)) / radius; x *= scale; z *= scale; }
  return { x: center.x + x - viewer.x * Math.cos(yaw) - viewer.z * Math.sin(yaw),
    y: Math.max(-0.5, Math.min(1.5, rig.y + nav.elevation)),
    z: center.z + z + viewer.x * Math.sin(yaw) - viewer.z * Math.cos(yaw), yaw };
}
