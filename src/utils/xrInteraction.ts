import type { Assembly, Lab, LeverStep, Pose } from './mb6Assembly';
import { MB6, ready } from './mb6Assembly';

export type Point3 = { x: number; y: number; z: number };
export type XRPad = { mapping: string; buttons: ReadonlyArray<{ pressed: boolean; value: number }>; axes: readonly number[] };
const deadzone = (value: number) => Number.isFinite(value) && Math.abs(value) > 0.18 ? Math.sign(value) * (Math.min(1, Math.abs(value)) - 0.18) / 0.82 : 0;
export function navigationInput(pads: { left: XRPad | null; right: XRPad | null }, dt: number) {
  const time = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
  const axis = (pad: XRPad | null, i: number) => pad?.mapping === 'xr-standard' ? deadzone(pad.axes[i] ?? 0) : 0;
  const x = axis(pads.right, 2), leftZ = axis(pads.left, 3), rightZ = axis(pads.right, 3), z = Math.abs(leftZ) > Math.abs(rightZ) ? leftZ : rightZ, length = Math.max(1, Math.hypot(x, z));
  return { turn: axis(pads.left, 2) * time * 1.1, strafe: x / length * time * 1.2, forward: -z / length * time * 1.2 || 0 };
}
export const canGrabBox = (lab: Lab, box: Assembly) => ready(box) && box.support === null && !lab.boxes.some(other => (other.support === box.id || other.restingOn === box.id));
export const canOperateLever = (lab: Lab, box: Assembly, index: number) =>
  Number.isInteger(index) && index >= 0 && index < 4 && !box.lid && box.support === null && !box.restingOn &&
  !lab.boxes.some(other => other.support === box.id || other.restingOn === box.id) &&
  box.walls[index] && box.walls[(index + 1) % 4];
export function rayEndpoint(origin: Point3, direction: Point3, distance: number): Point3 {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(length) || length < 1e-8) return { ...origin };
  return { x: origin.x + direction.x / length * distance, y: origin.y + direction.y / length * distance, z: origin.z + direction.z / length * distance };
}
// Two fixed-depth rays drive a rigid, upright crate. Fit their midpoint and
// horizontal baseline without scaling when the two controllers disagree.
export function rayGrabbedPose(origin: Pose, start: [Point3, Point3], current: [Point3, Point3], previousYaw: number): Pose {
  const span = (points: [Point3, Point3]) => Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z);
  const a = midpoint(...start), b = midpoint(...current);
  const raw = span(start) > .08 && span(current) > .08
    ? Math.atan2(current[1].x-current[0].x,current[1].z-current[0].z) - Math.atan2(start[1].x-start[0].x,start[1].z-start[0].z)
    : previousYaw-origin.yaw;
  const delta = previousYaw-origin.yaw + Math.atan2(Math.sin(raw-(previousYaw-origin.yaw)), Math.cos(raw-(previousYaw-origin.yaw)));
  const dx=origin.x-a.x, dz=origin.z-a.z;
  return { x:b.x+dx*Math.cos(delta)+dz*Math.sin(delta), y:origin.y+b.y-a.y, z:b.z-dx*Math.sin(delta)+dz*Math.cos(delta), yaw:origin.yaw+delta };
}
export const midpoint = (a: Point3, b: Point3): Point3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
export function grabbedPose(origin: Pose, start: [Point3, Point3], current: [Point3, Point3], liftGain = 1): Pose {
  const initial = midpoint(...start), now = midpoint(...current);
  const span = (p: [Point3, Point3]) => Math.hypot(p[1].x - p[0].x, p[1].z - p[0].z);
  const angle = (p: [Point3, Point3]) => Math.atan2(p[1].x - p[0].x, p[1].z - p[0].z);
  const delta = span(start) > 0.1 && span(current) > 0.1 ? angle(current) - angle(start) : 0;
  const dx = origin.x - initial.x, dz = origin.z - initial.z;
  return { x: now.x + dx * Math.cos(delta) + dz * Math.sin(delta), y: origin.y + (now.y - initial.y) * liftGain, z: now.z - dx * Math.sin(delta) + dz * Math.cos(delta), yaw: origin.yaw + delta };
}
export type LeverPhase = 'lift' | 'open' | 'slide' | 'lower' | 'done';
export function leverMotion(phase: LeverPhase, delta: Point3, direction: number): LeverStep | null {
  if (phase === 'lift' && (delta.y >= 0.035 || delta.z >= 0.04)) return 'lift';
  if ((phase === 'slide' || phase === 'open') && delta.x * direction >= 0.03) return 'slide';
  if ((phase === 'lower' || phase === 'open') && (delta.y <= -0.035 || delta.z <= -0.04)) return 'lower';
  return null;
}

// Turning pivots around the actual headset, including room-scale offsets.
// Movement follows the headset's horizontal heading, never its pitch.
export function navigateRig(rig: Pose, viewer: Point3, headYaw: number, nav: { turn: number; strafe: number; forward: number }): Pose {
  const yaw = rig.yaw - nav.turn;
  const eyeX = rig.x + viewer.x * Math.cos(rig.yaw) + viewer.z * Math.sin(rig.yaw);
  const eyeZ = rig.z - viewer.x * Math.sin(rig.yaw) + viewer.z * Math.cos(rig.yaw);
  const heading = yaw + headYaw;
  return {
    x: eyeX - viewer.x * Math.cos(yaw) - viewer.z * Math.sin(yaw) + nav.strafe * Math.cos(heading) - nav.forward * Math.sin(heading),
    y: rig.y,
    z: eyeZ + viewer.x * Math.sin(yaw) - viewer.z * Math.cos(yaw) - nav.strafe * Math.sin(heading) - nav.forward * Math.cos(heading),
    yaw,
  };
}

export const gripHeld = (pad: XRPad | null) => !!pad && pad.mapping === 'xr-standard' && !!(pad.buttons[1]?.pressed || pad.buttons[1]?.value > 0.65);
export function heldBoxInput(pads: { left: XRPad | null; right: XRPad | null }, dt: number) {
  const nav = navigationInput({left: pads.left, right: pads.right ? { ...pads.right, axes: [0,0,pads.right.axes[2] ?? 0,0] } : null}, dt);
  const lift = pads.right?.mapping === 'xr-standard' ? -deadzone(pads.right.axes[3] ?? 0) * Math.max(0, Math.min(.05,dt)) * .9 : 0;
  return { ...nav, lift: lift || 0 };
}
// The hand pulls the grabbed point around the hinge, with a minimum lever arm.
export function wallPullAngle(start: number, radius: number, delta: Point3): number {
  const r = Math.max(.25, radius);
  const arc = Math.atan2(r * Math.sin(start) + delta.z, r * Math.cos(start) + delta.y);
  // Permit a natural upward pull without requiring a full arm-length horizontal sweep.
  const lift = start + Math.max(0, delta.y) / Math.min(r, .45) * Math.PI / 2;
  return Math.max(-Math.PI / 2, Math.min(0, start < -.12 ? Math.max(arc,lift) : arc));
}
export const wallPullComplete = (angle: number, raising: boolean) => raising ? angle >= -.12 : angle <= -Math.PI / 2 + .12;

// A forgiving 12 cm target around each upper corner, never the wall center.
export function boxGrabCorner(point: Point3): number | null {
  if (![point.x,point.y,point.z].every(Number.isFinite) || Math.abs(point.y-(MB6.h-.04)) > .12) return null;
  if (Math.abs(Math.abs(point.x)-(MB6.w/2-MB6.inset)) > .12 || Math.abs(Math.abs(point.z)-(MB6.d/2-MB6.inset)) > .12) return null;
  return (point.x >= 0 ? 1 : 0) + (point.z >= 0 ? 2 : 0);
}
